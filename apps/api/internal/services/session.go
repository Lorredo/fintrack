package services

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5"

	"github.com/Lorredo/fintrack/api/internal/database"
	"github.com/Lorredo/fintrack/api/internal/models"
)

const (
	tokenTypeAccess  = "access"
	tokenTypeRefresh = "refresh"

	// A client that loses the response to a refresh retries with the token it
	// still has, so a reuse this soon isn't treated as theft.
	refreshReuseGrace = 30 * time.Second
)

var ErrInvalidRefreshToken = errors.New("invalid refresh token")

// SessionService issues tokens and tracks refresh tokens, so a session can be
// ended before its tokens expire. Only hashes of refresh tokens are stored.
type SessionService struct {
	db            database.Querier
	secret        []byte
	accessExpiry  time.Duration
	refreshExpiry time.Duration
}

func NewSessionService(db database.Querier, secret string, accessExpiry, refreshExpiry time.Duration) *SessionService {
	if db == nil {
		db = database.Pool
	}
	return &SessionService{
		db:            db,
		secret:        []byte(secret),
		accessExpiry:  accessExpiry,
		refreshExpiry: refreshExpiry,
	}
}

// Issue starts a new session for the user.
func (s *SessionService) Issue(ctx context.Context, userID string) (*models.AuthTokens, error) {
	if _, err := s.db.Exec(ctx, `DELETE FROM refresh_tokens WHERE user_id = $1 AND expires_at < NOW()`, userID); err != nil {
		return nil, err
	}

	var familyID string
	if err := s.db.QueryRow(ctx, `SELECT uuid_generate_v4()::text`).Scan(&familyID); err != nil {
		return nil, err
	}
	return s.issueInFamily(ctx, userID, familyID)
}

func (s *SessionService) issueInFamily(ctx context.Context, userID, familyID string) (*models.AuthTokens, error) {
	accessToken, err := s.signToken(userID, tokenTypeAccess, s.accessExpiry)
	if err != nil {
		return nil, err
	}
	refreshToken, err := s.signToken(userID, tokenTypeRefresh, s.refreshExpiry)
	if err != nil {
		return nil, err
	}

	_, err = s.db.Exec(ctx,
		`INSERT INTO refresh_tokens (user_id, family_id, token_hash, expires_at) VALUES ($1, $2, $3, $4)`,
		userID, familyID, hashToken(refreshToken), time.Now().Add(s.refreshExpiry))
	if err != nil {
		return nil, err
	}
	return &models.AuthTokens{AccessToken: accessToken, RefreshToken: refreshToken}, nil
}

func (s *SessionService) signToken(userID, tokenType string, expiry time.Duration) (string, error) {
	jti := make([]byte, 16)
	if _, err := rand.Read(jti); err != nil {
		return "", err
	}
	now := time.Now()
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub": userID,
		"typ": tokenType,
		"jti": hex.EncodeToString(jti),
		"iat": now.Unix(),
		"exp": now.Add(expiry).Unix(),
	})
	return token.SignedString(s.secret)
}

// Refresh swaps a refresh token for a new pair and retires the old one.
func (s *SessionService) Refresh(ctx context.Context, raw string) (*models.AuthTokens, error) {
	claims, err := s.parseRefreshClaims(raw)
	if err != nil {
		return nil, ErrInvalidRefreshToken
	}
	userID, _ := claims["sub"].(string)
	if userID == "" {
		return nil, ErrInvalidRefreshToken
	}

	var familyID string
	var expiresAt time.Time
	var rotatedAt, revokedAt *time.Time
	tokenHash := hashToken(raw)
	err = s.db.QueryRow(ctx,
		`SELECT family_id::text, expires_at, rotated_at, revoked_at FROM refresh_tokens WHERE token_hash = $1 AND user_id = $2`,
		tokenHash, userID).Scan(&familyID, &expiresAt, &rotatedAt, &revokedAt)

	if errors.Is(err, pgx.ErrNoRows) {
		if _, typed := claims["typ"]; typed {
			return nil, ErrInvalidRefreshToken
		}
		return s.upgradeLegacyToken(ctx, userID, tokenHash, claims)
	}
	if err != nil {
		return nil, err
	}
	if revokedAt != nil || time.Now().After(expiresAt) {
		return nil, ErrInvalidRefreshToken
	}

	if rotatedAt != nil {
		if time.Since(*rotatedAt) > refreshReuseGrace {
			if err := s.revokeFamily(ctx, familyID); err != nil {
				return nil, err
			}
			return nil, ErrInvalidRefreshToken
		}
		return s.issueInFamily(ctx, userID, familyID)
	}

	if _, err := s.db.Exec(ctx,
		`UPDATE refresh_tokens SET rotated_at = NOW() WHERE token_hash = $1 AND rotated_at IS NULL`, tokenHash); err != nil {
		return nil, err
	}
	return s.issueInFamily(ctx, userID, familyID)
}

// upgradeLegacyToken moves a token issued before sessions were tracked onto a
// stored session. Recording it as already used means it only works once.
func (s *SessionService) upgradeLegacyToken(ctx context.Context, userID, tokenHash string, claims jwt.MapClaims) (*models.AuthTokens, error) {
	expiresAt, err := claims.GetExpirationTime()
	if err != nil || expiresAt == nil {
		return nil, ErrInvalidRefreshToken
	}

	var familyID string
	if err := s.db.QueryRow(ctx, `SELECT uuid_generate_v4()::text`).Scan(&familyID); err != nil {
		return nil, err
	}
	_, err = s.db.Exec(ctx,
		`INSERT INTO refresh_tokens (user_id, family_id, token_hash, expires_at, rotated_at) VALUES ($1, $2, $3, $4, NOW())`,
		userID, familyID, tokenHash, expiresAt.Time)
	if err != nil {
		return nil, err
	}
	return s.issueInFamily(ctx, userID, familyID)
}

func (s *SessionService) parseRefreshClaims(raw string) (jwt.MapClaims, error) {
	token, err := jwt.Parse(raw, func(*jwt.Token) (interface{}, error) {
		return s.secret, nil
	}, jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}), jwt.WithExpirationRequired())
	if err != nil {
		return nil, err
	}
	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return nil, ErrInvalidRefreshToken
	}

	if tokenType, typed := claims["typ"]; typed {
		if tokenType != tokenTypeRefresh {
			return nil, ErrInvalidRefreshToken
		}
		return claims, nil
	}

	// Legacy tokens have no type, so tell them apart by lifetime: access
	// tokens can't be upgraded into a session.
	issuedAt, err := claims.GetIssuedAt()
	if err != nil || issuedAt == nil {
		return nil, ErrInvalidRefreshToken
	}
	expiresAt, err := claims.GetExpirationTime()
	if err != nil || expiresAt.Sub(issuedAt.Time) <= s.accessExpiry {
		return nil, ErrInvalidRefreshToken
	}
	return claims, nil
}

// Revoke ends the session a refresh token belongs to. Unknown tokens are
// ignored, so logging out always succeeds.
func (s *SessionService) Revoke(ctx context.Context, raw string) error {
	_, err := s.db.Exec(ctx,
		`UPDATE refresh_tokens SET revoked_at = NOW()
		 WHERE revoked_at IS NULL
		   AND family_id = (SELECT family_id FROM refresh_tokens WHERE token_hash = $1)`,
		hashToken(raw))
	return err
}

func (s *SessionService) revokeFamily(ctx context.Context, familyID string) error {
	_, err := s.db.Exec(ctx,
		`UPDATE refresh_tokens SET revoked_at = NOW() WHERE family_id = $1 AND revoked_at IS NULL`, familyID)
	return err
}

// RevokeAll ends every session the user has.
func (s *SessionService) RevokeAll(ctx context.Context, userID string) error {
	_, err := s.db.Exec(ctx,
		`UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL`, userID)
	return err
}

func hashToken(raw string) string {
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:])
}
