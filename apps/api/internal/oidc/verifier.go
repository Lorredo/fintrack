// Package oidc verifies OpenID Connect ID tokens (Google, Apple) against the
// issuer's published signing keys.
package oidc

import (
	"context"
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"math/big"
	"net/http"
	"slices"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const (
	GoogleJWKSURL = "https://www.googleapis.com/oauth2/v3/certs"
	AppleJWKSURL  = "https://appleid.apple.com/auth/keys"

	keyCacheTTL = time.Hour
)

var (
	// Unknown kids trigger a refetch, but not more often than this, so junk
	// tokens can't make us hammer the issuer.
	minRefetchInterval = time.Minute

	GoogleIssuers = []string{"accounts.google.com", "https://accounts.google.com"}
	AppleIssuers  = []string{"https://appleid.apple.com"}
)

type Verifier struct {
	jwksURL   string
	issuers   []string
	audiences []string
	client    *http.Client

	mu        sync.Mutex
	keys      map[string]*rsa.PublicKey
	fetchedAt time.Time
}

func NewVerifier(jwksURL string, issuers, audiences []string) *Verifier {
	return &Verifier{
		jwksURL:   jwksURL,
		issuers:   issuers,
		audiences: audiences,
		client:    &http.Client{Timeout: 10 * time.Second},
	}
}

// Verify checks the token's signature, expiry, issuer and audience and
// returns its claims.
func (v *Verifier) Verify(ctx context.Context, raw string) (jwt.MapClaims, error) {
	if len(v.audiences) == 0 {
		return nil, errors.New("oidc: no audiences configured")
	}

	claims := jwt.MapClaims{}
	_, err := jwt.ParseWithClaims(raw, claims, func(t *jwt.Token) (any, error) {
		kid, _ := t.Header["kid"].(string)
		if kid == "" {
			return nil, errors.New("oidc: token has no kid")
		}
		return v.key(ctx, kid)
	},
		jwt.WithValidMethods([]string{"RS256"}),
		jwt.WithExpirationRequired(),
		jwt.WithLeeway(30*time.Second),
	)
	if err != nil {
		return nil, err
	}

	iss, _ := claims.GetIssuer()
	if !slices.Contains(v.issuers, iss) {
		return nil, fmt.Errorf("oidc: unexpected issuer %q", iss)
	}
	aud, _ := claims.GetAudience()
	if !slices.ContainsFunc(aud, func(a string) bool { return slices.Contains(v.audiences, a) }) {
		return nil, errors.New("oidc: token was not issued for this app")
	}
	return claims, nil
}

func (v *Verifier) key(ctx context.Context, kid string) (*rsa.PublicKey, error) {
	v.mu.Lock()
	defer v.mu.Unlock()

	if k, ok := v.keys[kid]; ok && time.Since(v.fetchedAt) < keyCacheTTL {
		return k, nil
	}
	if v.keys == nil || time.Since(v.fetchedAt) >= minRefetchInterval {
		keys, err := v.fetchKeys(ctx)
		if err != nil {
			// Keep serving cached keys if the issuer is briefly unreachable.
			if k, ok := v.keys[kid]; ok {
				return k, nil
			}
			return nil, err
		}
		v.keys, v.fetchedAt = keys, time.Now()
	}
	if k, ok := v.keys[kid]; ok {
		return k, nil
	}
	return nil, fmt.Errorf("oidc: unknown signing key %q", kid)
}

func (v *Verifier) fetchKeys(ctx context.Context) (map[string]*rsa.PublicKey, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, v.jwksURL, nil)
	if err != nil {
		return nil, err
	}
	resp, err := v.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("oidc: fetching keys: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("oidc: fetching keys: status %d", resp.StatusCode)
	}

	var set struct {
		Keys []struct {
			Kty string `json:"kty"`
			Kid string `json:"kid"`
			N   string `json:"n"`
			E   string `json:"e"`
		} `json:"keys"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&set); err != nil {
		return nil, fmt.Errorf("oidc: decoding keys: %w", err)
	}

	keys := make(map[string]*rsa.PublicKey, len(set.Keys))
	for _, k := range set.Keys {
		if k.Kty != "RSA" || k.Kid == "" {
			continue
		}
		n, errN := base64.RawURLEncoding.DecodeString(k.N)
		e, errE := base64.RawURLEncoding.DecodeString(k.E)
		if errN != nil || errE != nil {
			continue
		}
		keys[k.Kid] = &rsa.PublicKey{
			N: new(big.Int).SetBytes(n),
			E: int(new(big.Int).SetBytes(e).Int64()),
		}
	}
	if len(keys) == 0 {
		return nil, errors.New("oidc: issuer returned no usable keys")
	}
	return keys, nil
}
