package oidc

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"math/big"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const (
	testIssuer   = "https://accounts.google.com"
	testAudience = "client-123.apps.googleusercontent.com"
)

type jwksServer struct {
	*httptest.Server
	keys    atomic.Value // map[string]*rsa.PrivateKey
	fetches atomic.Int32
}

func newJWKSServer(t *testing.T, keys map[string]*rsa.PrivateKey) *jwksServer {
	t.Helper()
	s := &jwksServer{}
	s.keys.Store(keys)
	s.Server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		s.fetches.Add(1)
		var set struct {
			Keys []map[string]string `json:"keys"`
		}
		for kid, k := range s.keys.Load().(map[string]*rsa.PrivateKey) {
			set.Keys = append(set.Keys, map[string]string{
				"kty": "RSA",
				"kid": kid,
				"alg": "RS256",
				"n":   base64.RawURLEncoding.EncodeToString(k.N.Bytes()),
				"e":   base64.RawURLEncoding.EncodeToString(big.NewInt(int64(k.E)).Bytes()),
			})
		}
		_ = json.NewEncoder(w).Encode(set)
	}))
	t.Cleanup(s.Close)
	return s
}

func newKey(t *testing.T) *rsa.PrivateKey {
	t.Helper()
	k, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	return k
}

func sign(t *testing.T, key *rsa.PrivateKey, kid string, claims jwt.MapClaims) string {
	t.Helper()
	tok := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	tok.Header["kid"] = kid
	s, err := tok.SignedString(key)
	if err != nil {
		t.Fatal(err)
	}
	return s
}

func validClaims() jwt.MapClaims {
	return jwt.MapClaims{
		"iss":            testIssuer,
		"aud":            testAudience,
		"sub":            "1234567890",
		"email":          "user@example.com",
		"email_verified": true,
		"exp":            time.Now().Add(time.Hour).Unix(),
		"iat":            time.Now().Unix(),
	}
}

func TestVerify(t *testing.T) {
	key, otherKey := newKey(t), newKey(t)
	srv := newJWKSServer(t, map[string]*rsa.PrivateKey{"k1": key})
	v := NewVerifier(srv.URL, GoogleIssuers, []string{"other-client", testAudience})

	with := func(mutate func(jwt.MapClaims)) jwt.MapClaims {
		c := validClaims()
		mutate(c)
		return c
	}

	tests := []struct {
		name    string
		token   string
		wantErr bool
	}{
		{"valid", sign(t, key, "k1", validClaims()), false},
		{"wrong audience", sign(t, key, "k1", with(func(c jwt.MapClaims) { c["aud"] = "someone-else" })), true},
		{"wrong issuer", sign(t, key, "k1", with(func(c jwt.MapClaims) { c["iss"] = "https://evil.example" })), true},
		{"expired", sign(t, key, "k1", with(func(c jwt.MapClaims) { c["exp"] = time.Now().Add(-time.Hour).Unix() })), true},
		{"no expiry", sign(t, key, "k1", with(func(c jwt.MapClaims) { delete(c, "exp") })), true},
		{"signed by another key", sign(t, otherKey, "k1", validClaims()), true},
		{"alg none", noneToken(t), true},
		{"garbage", "x", true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			claims, err := v.Verify(context.Background(), tt.token)
			if (err != nil) != tt.wantErr {
				t.Fatalf("Verify() error = %v, wantErr %v", err, tt.wantErr)
			}
			if !tt.wantErr && claims["email"] != "user@example.com" {
				t.Fatalf("unexpected claims: %v", claims)
			}
		})
	}
}

func noneToken(t *testing.T) string {
	t.Helper()
	tok := jwt.NewWithClaims(jwt.SigningMethodNone, validClaims())
	tok.Header["kid"] = "k1"
	s, err := tok.SignedString(jwt.UnsafeAllowNoneSignatureType)
	if err != nil {
		t.Fatal(err)
	}
	return s
}

func TestVerifyRefetchesOnUnknownKid(t *testing.T) {
	old := minRefetchInterval
	minRefetchInterval = 0
	t.Cleanup(func() { minRefetchInterval = old })

	key1, key2 := newKey(t), newKey(t)
	srv := newJWKSServer(t, map[string]*rsa.PrivateKey{"k1": key1})
	v := NewVerifier(srv.URL, GoogleIssuers, []string{testAudience})

	if _, err := v.Verify(context.Background(), sign(t, key1, "k1", validClaims())); err != nil {
		t.Fatalf("first verify: %v", err)
	}
	// The issuer rotates its keys.
	srv.keys.Store(map[string]*rsa.PrivateKey{"k2": key2})
	if _, err := v.Verify(context.Background(), sign(t, key2, "k2", validClaims())); err != nil {
		t.Fatalf("verify after rotation: %v", err)
	}
	if got := srv.fetches.Load(); got != 2 {
		t.Fatalf("fetches = %d, want 2", got)
	}
}

func TestVerifyThrottlesRefetch(t *testing.T) {
	key := newKey(t)
	srv := newJWKSServer(t, map[string]*rsa.PrivateKey{"k1": key})
	v := NewVerifier(srv.URL, GoogleIssuers, []string{testAudience})

	for range 5 {
		_, _ = v.Verify(context.Background(), sign(t, key, "unknown", validClaims()))
	}
	if got := srv.fetches.Load(); got != 1 {
		t.Fatalf("fetches = %d, want 1", got)
	}
}
