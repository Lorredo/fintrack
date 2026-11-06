package handlers_test

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"math/big"
	"net/http"
	"net/http/httptest"
	"os"
	"sync/atomic"
	"testing"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/Lorredo/fintrack/api/internal/database"
	"github.com/Lorredo/fintrack/api/internal/handlers"
	"github.com/Lorredo/fintrack/api/internal/oidc"
	"github.com/Lorredo/fintrack/api/internal/routes"
	"github.com/Lorredo/fintrack/api/internal/services"
)

const (
	testSecret  = "test-secret"
	testClient  = "client.apps.googleusercontent.com"
	accessLife  = 15 * time.Minute
	refreshLife = 168 * time.Hour
	password    = "correct-horse"
	newPassword = "battery-staple"
)

type env struct {
	app *fiber.App
	key *rsa.PrivateKey
}

var emailCounter atomic.Int64

// Runs against a real database, so it's skipped unless TEST_DATABASE_URL points
// at a disposable one.
func setup(t *testing.T) *env {
	t.Helper()
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("TEST_DATABASE_URL not set")
	}
	if err := database.RunMigrations(url, "../../migrations"); err != nil {
		t.Fatal(err)
	}
	pool, err := pgxpool.New(context.Background(), url)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(pool.Close)
	database.Pool = pool

	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	jwks := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]interface{}{"keys": []map[string]string{{
			"kty": "RSA", "kid": "k1", "alg": "RS256",
			"n": base64.RawURLEncoding.EncodeToString(key.N.Bytes()),
			"e": base64.RawURLEncoding.EncodeToString(big.NewInt(int64(key.E)).Bytes()),
		}}})
	}))
	t.Cleanup(jwks.Close)

	sessions := services.NewSessionService(pool, testSecret, accessLife, refreshLife)
	google := oidc.NewVerifier(jwks.URL, oidc.GoogleIssuers, []string{testClient})
	auth := handlers.NewAuthHandler(sessions, google, google)

	app := fiber.New()
	routes.Setup(app, testSecret, auth,
		handlers.NewTransactionHandler(services.NewTransactionService(pool)),
		handlers.NewDashboardHandler(services.NewDashboardService(pool)),
		handlers.NewBudgetHandler(services.NewBudgetService(pool)),
		handlers.NewReportHandler(services.NewReportService(pool)),
		handlers.NewAccountHandler(services.NewAccountService(pool)),
	)
	return &env{app: app, key: key}
}

func (e *env) call(t *testing.T, method, path, bearer string, body interface{}) (int, map[string]interface{}) {
	t.Helper()
	var reader *bytes.Reader
	if body == nil {
		reader = bytes.NewReader(nil)
	} else {
		data, _ := json.Marshal(body)
		reader = bytes.NewReader(data)
	}
	req := httptest.NewRequest(method, path, reader)
	req.Header.Set("Content-Type", "application/json")
	if bearer != "" {
		req.Header.Set("Authorization", "Bearer "+bearer)
	}
	resp, err := e.app.Test(req, 30000)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	var out map[string]interface{}
	_ = json.NewDecoder(resp.Body).Decode(&out)
	return resp.StatusCode, out
}

func (e *env) register(t *testing.T) (email, code string) {
	t.Helper()
	email = fmt.Sprintf("user%d-%d@example.com", time.Now().UnixNano(), emailCounter.Add(1))
	status, out := e.call(t, "POST", "/api/v1/auth/register", "", map[string]string{
		"firstName": "A", "lastName": "B", "email": email, "password": password,
	})
	if status != 201 {
		t.Fatalf("register: %d %v", status, out)
	}
	code, _ = out["recoveryCode"].(string)
	if len(code) != 19 {
		t.Fatalf("recovery code = %q", code)
	}
	return email, code
}

func tokensFrom(t *testing.T, out map[string]interface{}) (access, refresh string) {
	t.Helper()
	tokens, ok := out["tokens"].(map[string]interface{})
	if !ok {
		t.Fatalf("no tokens: %v", out)
	}
	return tokens["accessToken"].(string), tokens["refreshToken"].(string)
}

func (e *env) login(t *testing.T, email, pass string) (access, refresh string) {
	t.Helper()
	status, out := e.call(t, "POST", "/api/v1/auth/login", "", map[string]string{"email": email, "password": pass})
	if status != 200 {
		t.Fatalf("login: %d %v", status, out)
	}
	return tokensFrom(t, out)
}

func (e *env) refresh(t *testing.T, token string) (int, string) {
	t.Helper()
	status, out := e.call(t, "POST", "/api/v1/auth/refresh", "", map[string]string{"refreshToken": token})
	next, _ := out["refreshToken"].(string)
	return status, next
}

func (e *env) googleToken(t *testing.T, email string) string {
	t.Helper()
	token := jwt.NewWithClaims(jwt.SigningMethodRS256, jwt.MapClaims{
		"iss": "https://accounts.google.com", "aud": testClient, "email": email,
		"email_verified": true, "given_name": "G", "family_name": "U",
		"exp": time.Now().Add(time.Hour).Unix(),
	})
	token.Header["kid"] = "k1"
	signed, err := token.SignedString(e.key)
	if err != nil {
		t.Fatal(err)
	}
	return signed
}

func legacyToken(t *testing.T, userID string, life time.Duration) string {
	t.Helper()
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub": userID, "iat": time.Now().Unix(), "exp": time.Now().Add(life).Unix(),
	})
	signed, err := token.SignedString([]byte(testSecret))
	if err != nil {
		t.Fatal(err)
	}
	return signed
}

func userID(t *testing.T, email string) string {
	t.Helper()
	var id string
	if err := database.Pool.QueryRow(context.Background(), `SELECT id FROM users WHERE email = $1`, email).Scan(&id); err != nil {
		t.Fatal(err)
	}
	return id
}

func TestTokenTypes(t *testing.T) {
	e := setup(t)
	email, _ := e.register(t)
	access, refresh := e.login(t, email, password)

	if status, _ := e.call(t, "GET", "/api/v1/auth/me", access, nil); status != 200 {
		t.Errorf("access token on API: %d", status)
	}
	if status, _ := e.call(t, "GET", "/api/v1/auth/me", refresh, nil); status != 401 {
		t.Errorf("refresh token on API: %d", status)
	}
	if status, _ := e.refresh(t, access); status != 401 {
		t.Errorf("access token on refresh: %d", status)
	}
}

func TestRotationAndReuse(t *testing.T) {
	e := setup(t)
	email, _ := e.register(t)
	_, first := e.login(t, email, password)

	status, second := e.refresh(t, first)
	if status != 200 || second == "" || second == first {
		t.Fatalf("rotate: %d", status)
	}

	// A retry straight after is a lost response, not theft.
	status, third := e.refresh(t, first)
	if status != 200 {
		t.Fatalf("grace retry: %d", status)
	}

	if _, err := database.Pool.Exec(context.Background(),
		`UPDATE refresh_tokens SET rotated_at = NOW() - INTERVAL '1 minute' WHERE user_id = $1 AND rotated_at IS NOT NULL`,
		userID(t, email)); err != nil {
		t.Fatal(err)
	}

	if status, _ := e.refresh(t, first); status != 401 {
		t.Errorf("reuse: %d", status)
	}
	if status, _ := e.refresh(t, third); status != 401 {
		t.Errorf("session survived reuse: %d", status)
	}
}

func TestLogout(t *testing.T) {
	e := setup(t)
	email, _ := e.register(t)
	access, refresh := e.login(t, email, password)
	_, other := e.login(t, email, password)

	if status, _ := e.call(t, "POST", "/api/v1/auth/logout", access, map[string]string{"refreshToken": refresh}); status != 200 {
		t.Fatalf("logout: %d", status)
	}
	if status, _ := e.refresh(t, refresh); status != 401 {
		t.Errorf("refresh after logout: %d", status)
	}
	status, next := e.refresh(t, other)
	if status != 200 {
		t.Errorf("other session ended: %d", status)
	}

	// Older apps log out with no body.
	if status, _ := e.call(t, "POST", "/api/v1/auth/logout", access, nil); status != 200 {
		t.Errorf("logout without body: %d", status)
	}

	if status, _ := e.call(t, "POST", "/api/v1/auth/logout-all", access, nil); status != 200 {
		t.Fatalf("logout-all: %d", status)
	}
	if status, _ := e.refresh(t, next); status != 401 {
		t.Errorf("refresh after logout-all: %d", status)
	}
}

func TestLegacyTokens(t *testing.T) {
	e := setup(t)
	email, _ := e.register(t)
	id := userID(t, email)

	legacyAccess := legacyToken(t, id, accessLife)
	if status, _ := e.call(t, "GET", "/api/v1/auth/me", legacyAccess, nil); status != 200 {
		t.Errorf("legacy access token on API: %d", status)
	}
	if status, _ := e.refresh(t, legacyAccess); status != 401 {
		t.Errorf("legacy access token on refresh: %d", status)
	}

	legacyRefresh := legacyToken(t, id, refreshLife)
	status, upgraded := e.refresh(t, legacyRefresh)
	if status != 200 {
		t.Fatalf("legacy upgrade: %d", status)
	}
	if status, _ := e.refresh(t, upgraded); status != 200 {
		t.Errorf("upgraded token: %d", status)
	}

	if _, err := database.Pool.Exec(context.Background(),
		`UPDATE refresh_tokens SET rotated_at = NOW() - INTERVAL '1 minute' WHERE user_id = $1 AND rotated_at IS NOT NULL`, id); err != nil {
		t.Fatal(err)
	}
	if status, _ := e.refresh(t, legacyRefresh); status != 401 {
		t.Errorf("legacy token reused: %d", status)
	}
}

func TestRecoverWithCode(t *testing.T) {
	e := setup(t)
	email, code := e.register(t)
	_, oldRefresh := e.login(t, email, password)

	wrong, _ := e.call(t, "POST", "/api/v1/auth/recover", "", map[string]string{
		"email": email, "code": "AAAA-AAAA-AAAA-AAAA", "newPassword": newPassword,
	})
	unknown, unknownBody := e.call(t, "POST", "/api/v1/auth/recover", "", map[string]string{
		"email": "nobody@example.com", "code": code, "newPassword": newPassword,
	})
	if wrong != 401 || unknown != 401 || unknownBody["message"] != "Invalid email or recovery code" {
		t.Errorf("failures differ: %d %d %v", wrong, unknown, unknownBody)
	}

	// Typed by hand: lower case, no dashes.
	typed := bytes.ToLower(bytes.ReplaceAll([]byte(code), []byte("-"), nil))
	status, out := e.call(t, "POST", "/api/v1/auth/recover", "", map[string]string{
		"email": email, "code": string(typed), "newPassword": newPassword,
	})
	if status != 200 {
		t.Fatalf("recover: %d %v", status, out)
	}
	if next, _ := out["recoveryCode"].(string); next == "" || next == code {
		t.Errorf("code not replaced: %v", out)
	}

	if status, _ := e.call(t, "POST", "/api/v1/auth/recover", "", map[string]string{
		"email": email, "code": code, "newPassword": password,
	}); status != 401 {
		t.Errorf("old code reused: %d", status)
	}
	if status, _ := e.refresh(t, oldRefresh); status != 401 {
		t.Errorf("old session survived: %d", status)
	}
	if status, _ := e.call(t, "POST", "/api/v1/auth/login", "", map[string]string{"email": email, "password": password}); status != 401 {
		t.Errorf("old password: %d", status)
	}
	e.login(t, email, newPassword)
}

func TestRecoverWithGoogle(t *testing.T) {
	e := setup(t)
	email, _ := e.register(t)
	_, oldRefresh := e.login(t, email, password)

	if status, _ := e.call(t, "POST", "/api/v1/auth/recover/google", "", map[string]string{
		"idToken": e.googleToken(t, "nobody-here@example.com"), "newPassword": newPassword,
	}); status != 401 {
		t.Errorf("unknown Google email: %d", status)
	}
	if status, _ := e.call(t, "POST", "/api/v1/auth/recover/google", "", map[string]string{
		"idToken": "forged", "newPassword": newPassword,
	}); status != 401 {
		t.Errorf("forged token: %d", status)
	}

	if status, out := e.call(t, "POST", "/api/v1/auth/recover/google", "", map[string]string{
		"idToken": e.googleToken(t, email), "newPassword": newPassword,
	}); status != 200 {
		t.Fatalf("recover: %d %v", status, out)
	}
	if status, _ := e.refresh(t, oldRefresh); status != 401 {
		t.Errorf("old session survived: %d", status)
	}
	e.login(t, email, newPassword)
}

func TestFirstGoogleSignInClaimsAccount(t *testing.T) {
	e := setup(t)
	email, code := e.register(t)
	access, attacker := e.login(t, email, password)
	if status, _ := e.call(t, "POST", "/api/v1/auth/pin", access, map[string]string{"pin": "1234"}); status != 200 {
		t.Fatalf("set pin: %d", status)
	}

	status, out := e.call(t, "POST", "/api/v1/auth/google", "", map[string]string{"idToken": e.googleToken(t, email)})
	if status != 200 {
		t.Fatalf("google: %d %v", status, out)
	}
	_, owner := tokensFrom(t, out)

	if status, _ := e.refresh(t, attacker); status != 401 {
		t.Errorf("earlier session survived: %d", status)
	}
	if status, _ := e.call(t, "POST", "/api/v1/auth/login", "", map[string]string{"email": email, "password": password}); status != 401 {
		t.Errorf("earlier password works: %d", status)
	}
	if status, _ := e.call(t, "POST", "/api/v1/auth/pin-login", "", map[string]string{"email": email, "pin": "1234"}); status != 401 {
		t.Errorf("earlier PIN works: %d", status)
	}
	if status, _ := e.call(t, "POST", "/api/v1/auth/recover", "", map[string]string{"email": email, "code": code, "newPassword": newPassword}); status != 401 {
		t.Errorf("earlier recovery code works: %d", status)
	}

	// Later sign-ins change nothing.
	status, out = e.call(t, "POST", "/api/v1/auth/google", "", map[string]string{"idToken": e.googleToken(t, email)})
	if status != 200 {
		t.Fatalf("second google: %d", status)
	}
	if status, _ := e.refresh(t, owner); status != 200 {
		t.Errorf("owner's session ended: %d", status)
	}
}

func TestRecoveryCodeNeedsCredential(t *testing.T) {
	e := setup(t)
	email, code := e.register(t)
	access, _ := e.login(t, email, password)

	if status, _ := e.call(t, "POST", "/api/v1/auth/recovery-code", access, map[string]string{}); status != 401 {
		t.Errorf("no credential: %d", status)
	}
	if status, _ := e.call(t, "POST", "/api/v1/auth/recovery-code", access, map[string]string{"password": "wrong-password"}); status != 401 {
		t.Errorf("wrong password: %d", status)
	}
	status, out := e.call(t, "POST", "/api/v1/auth/recovery-code", access, map[string]string{"password": password})
	if status != 200 || out["recoveryCode"] == code {
		t.Fatalf("create: %d %v", status, out)
	}
	if status, _ := e.call(t, "POST", "/api/v1/auth/recover", "", map[string]string{"email": email, "code": code, "newPassword": newPassword}); status != 401 {
		t.Errorf("replaced code works: %d", status)
	}
}

func TestPinMustBeDigits(t *testing.T) {
	e := setup(t)
	email, _ := e.register(t)
	access, _ := e.login(t, email, password)

	if status, _ := e.call(t, "POST", "/api/v1/auth/pin", access, map[string]string{"pin": "12ab"}); status != 400 {
		t.Errorf("letters in PIN: %d", status)
	}
}

func TestLoginRateLimit(t *testing.T) {
	e := setup(t)
	email, _ := e.register(t)

	for i := 0; i < 10; i++ {
		if status, _ := e.call(t, "POST", "/api/v1/auth/login", "", map[string]string{"email": email, "password": "wrong-password"}); status != 401 {
			t.Fatalf("attempt %d: %d", i, status)
		}
	}
	if status, _ := e.call(t, "POST", "/api/v1/auth/login", "", map[string]string{"email": email, "password": "wrong-password"}); status != 429 {
		t.Errorf("11th attempt: %d", status)
	}
}
