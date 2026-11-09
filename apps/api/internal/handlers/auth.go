package handlers

import (
	"context"
	"crypto/subtle"
	"errors"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"golang.org/x/crypto/bcrypt"

	"github.com/Lorredo/fintrack/api/internal/database"
	"github.com/Lorredo/fintrack/api/internal/models"
	"github.com/Lorredo/fintrack/api/internal/oidc"
	"github.com/Lorredo/fintrack/api/internal/services"
	"github.com/Lorredo/fintrack/api/internal/validator"
)

type AuthHandler struct {
	sessions       *services.SessionService
	googleVerifier *oidc.Verifier
	appleVerifier  *oidc.Verifier
}

func NewAuthHandler(sessions *services.SessionService, googleVerifier, appleVerifier *oidc.Verifier) *AuthHandler {
	return &AuthHandler{
		sessions:       sessions,
		googleVerifier: googleVerifier,
		appleVerifier:  appleVerifier,
	}
}

func (h *AuthHandler) Register(c *fiber.Ctx) error {
	var req models.RegisterRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Invalid request body",
		})
	}

	if errs := validator.ValidateStruct(req); errs != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Validation failed",
			"errors":  errs,
		})
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to hash password",
		})
	}

	recoveryCode, recoveryCodeHash, err := services.NewRecoveryCode()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to create user",
		})
	}

	var user models.User
	err = database.Pool.QueryRow(
		context.Background(),
		`INSERT INTO users (first_name, last_name, email, password_hash, recovery_code_hash)
		 VALUES ($1, $2, $3, $4, $5)
		 RETURNING id, first_name, last_name, email, created_at, updated_at`,
		req.FirstName, req.LastName, req.Email, string(hash), recoveryCodeHash,
	).Scan(&user.ID, &user.FirstName, &user.LastName, &user.Email, &user.CreatedAt, &user.UpdatedAt)

	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return c.Status(fiber.StatusConflict).JSON(fiber.Map{
				"message": "Email already registered",
			})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to create user",
		})
	}

	return c.Status(fiber.StatusCreated).JSON(models.AuthResponse{
		Message:      "Registration successful",
		RecoveryCode: recoveryCode,
	})
}

func (h *AuthHandler) Login(c *fiber.Ctx) error {
	var req models.LoginRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Invalid request body",
		})
	}

	if errs := validator.ValidateStruct(req); errs != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Validation failed",
			"errors":  errs,
		})
	}

	var user models.User
	var passwordHash *string
	var pinHash *string
	var avatarURL *string
	err := database.Pool.QueryRow(
		context.Background(),
		`SELECT id, first_name, last_name, email, password_hash, COALESCE(auth_provider, 'email'), avatar_url, pin_hash, recovery_code_hash IS NOT NULL, created_at, updated_at
		 FROM users WHERE email = $1`,
		req.Email,
	).Scan(&user.ID, &user.FirstName, &user.LastName, &user.Email, &passwordHash, &user.AuthProvider, &avatarURL, &pinHash, &user.HasRecoveryCode, &user.CreatedAt, &user.UpdatedAt)

	if err == pgx.ErrNoRows {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"message": "Invalid email or password",
		})
	}
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to query user",
		})
	}

	if passwordHash == nil || *passwordHash == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"message": "This account was registered using Google or Apple. Please sign in with that provider.",
		})
	}

	if err := bcrypt.CompareHashAndPassword([]byte(*passwordHash), []byte(req.Password)); err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"message": "Invalid email or password",
		})
	}

	user.AvatarURL = avatarURL
	user.HasPIN = pinHash != nil && *pinHash != ""

	return h.startSession(c, user)
}

func (h *AuthHandler) startSession(c *fiber.Ctx, user models.User) error {
	tokens, err := h.sessions.Issue(c.Context(), user.ID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to start session",
		})
	}
	return c.JSON(models.LoginResponse{User: user, Tokens: *tokens})
}

func (h *AuthHandler) Refresh(c *fiber.Ctx) error {
	var req models.RefreshTokenRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Invalid request body",
		})
	}

	tokens, err := h.sessions.Refresh(c.Context(), req.RefreshToken)
	if errors.Is(err, services.ErrInvalidRefreshToken) {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"message": "Invalid or expired refresh token",
		})
	}
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to refresh session",
		})
	}

	return c.JSON(models.RefreshTokenResponse{
		AccessToken:  tokens.AccessToken,
		RefreshToken: tokens.RefreshToken,
	})
}

func (h *AuthHandler) Logout(c *fiber.Ctx) error {
	// Older app versions send no body and just drop their tokens.
	var req models.LogoutRequest
	if err := c.BodyParser(&req); err == nil && req.RefreshToken != "" {
		if err := h.sessions.Revoke(c.Context(), req.RefreshToken); err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"message": "Failed to log out",
			})
		}
	}

	return c.JSON(models.AuthResponse{
		Message: "Logged out successfully",
	})
}

func (h *AuthHandler) LogoutAll(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)

	if err := h.sessions.RevokeAll(c.Context(), userID); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to log out",
		})
	}

	return c.JSON(models.AuthResponse{
		Message: "Logged out of all devices",
	})
}

// CreateRecoveryCode replaces the account's recovery code. A stolen access
// token alone can't do this, because it needs the password or PIN too.
func (h *AuthHandler) CreateRecoveryCode(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)

	var req models.CreateRecoveryCodeRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Invalid request body",
		})
	}
	if errs := validator.ValidateStruct(req); errs != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Validation failed",
			"errors":  errs,
		})
	}

	var passwordHash, pinHash *string
	err := database.Pool.QueryRow(
		context.Background(),
		`SELECT password_hash, pin_hash FROM users WHERE id = $1`,
		userID,
	).Scan(&passwordHash, &pinHash)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to create recovery code",
		})
	}

	confirmed := matchesHash(passwordHash, req.Password) || matchesHash(pinHash, req.PIN)
	if !confirmed {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"message": "Incorrect password or PIN",
		})
	}

	code, codeHash, err := services.NewRecoveryCode()
	if err == nil {
		_, err = database.Pool.Exec(
			context.Background(),
			`UPDATE users SET recovery_code_hash = $1, updated_at = NOW() WHERE id = $2`,
			codeHash, userID,
		)
	}
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to create recovery code",
		})
	}

	return c.JSON(models.RecoveryCodeResponse{RecoveryCode: code})
}

func matchesHash(hash *string, value string) bool {
	return hash != nil && *hash != "" && value != "" &&
		bcrypt.CompareHashAndPassword([]byte(*hash), []byte(value)) == nil
}

// Recover sets a new password using a recovery code. Every failure gets the
// same response, so it can't be used to probe which accounts exist.
func (h *AuthHandler) Recover(c *fiber.Ctx) error {
	var req models.RecoverRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Invalid request body",
		})
	}
	if errs := validator.ValidateStruct(req); errs != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Validation failed",
			"errors":  errs,
		})
	}

	invalid := func() error {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"message": "Invalid email or recovery code",
		})
	}

	var userID string
	var storedHash *string
	err := database.Pool.QueryRow(
		context.Background(),
		`SELECT id, recovery_code_hash FROM users WHERE email = $1`,
		req.Email,
	).Scan(&userID, &storedHash)
	if err != nil && err != pgx.ErrNoRows {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to recover account",
		})
	}
	if err == pgx.ErrNoRows || storedHash == nil {
		return invalid()
	}

	codeHash := services.HashRecoveryCode(req.Code)
	if subtle.ConstantTimeCompare([]byte(codeHash), []byte(*storedHash)) != 1 {
		return invalid()
	}

	passwordHash, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to recover account",
		})
	}
	newCode, newCodeHash, err := services.NewRecoveryCode()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to recover account",
		})
	}

	// Matching on the old hash means two requests can't both use one code.
	tag, err := database.Pool.Exec(
		context.Background(),
		`UPDATE users SET password_hash = $1, recovery_code_hash = $2, updated_at = NOW()
		 WHERE id = $3 AND recovery_code_hash = $4`,
		string(passwordHash), newCodeHash, userID, codeHash,
	)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to recover account",
		})
	}
	if tag.RowsAffected() == 0 {
		return invalid()
	}

	if err := h.sessions.RevokeAll(c.Context(), userID); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to recover account",
		})
	}

	return c.JSON(models.RecoveryCodeResponse{RecoveryCode: newCode})
}

// RecoverWithGoogle sets a new password once Google confirms the caller owns
// the account's email.
func (h *AuthHandler) RecoverWithGoogle(c *fiber.Ctx) error {
	var req models.GoogleRecoverRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Invalid request body",
		})
	}
	if errs := validator.ValidateStruct(req); errs != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Validation failed",
			"errors":  errs,
		})
	}

	invalid := func() error {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"message": "This Google account doesn't match a FinTrack account",
		})
	}

	claims, err := h.googleVerifier.Verify(c.Context(), req.IDToken)
	if err != nil {
		return invalid()
	}
	email, _ := claims["email"].(string)
	if verified, _ := claims["email_verified"].(bool); email == "" || !verified {
		return invalid()
	}

	passwordHash, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to recover account",
		})
	}

	var userID string
	err = database.Pool.QueryRow(
		context.Background(),
		`UPDATE users SET password_hash = $1, email_verified = TRUE, updated_at = NOW()
		 WHERE email = $2 RETURNING id`,
		string(passwordHash), email,
	).Scan(&userID)
	if err == pgx.ErrNoRows {
		return invalid()
	}
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to recover account",
		})
	}

	if err := h.sessions.RevokeAll(c.Context(), userID); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to recover account",
		})
	}

	return c.JSON(models.AuthResponse{Message: "Password updated"})
}

func (h *AuthHandler) Me(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)

	var user models.User
	var pinHash *string
	var avatarURL *string
	err := database.Pool.QueryRow(
		context.Background(),
		`SELECT id, first_name, last_name, email, COALESCE(auth_provider, 'email'), avatar_url, pin_hash, password_hash IS NOT NULL, recovery_code_hash IS NOT NULL, created_at, updated_at
		 FROM users WHERE id = $1`,
		userID,
	).Scan(&user.ID, &user.FirstName, &user.LastName, &user.Email, &user.AuthProvider, &avatarURL, &pinHash, &user.HasPassword, &user.HasRecoveryCode, &user.CreatedAt, &user.UpdatedAt)

	if err == pgx.ErrNoRows {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"message": "User not found",
		})
	}
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to fetch user",
		})
	}

	user.AvatarURL = avatarURL
	user.HasPIN = pinHash != nil && *pinHash != ""

	return c.JSON(user)
}

func (h *AuthHandler) WipeData(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)
	ctx := context.Background()

	// Start a database transaction
	tx, err := database.Pool.Begin(ctx)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to start transaction",
		})
	}
	defer tx.Rollback(ctx)

	// Delete in reverse order of dependency. Bills go first; their payments
	// go with them.
	// Utang and paluwagan go too; their payments go with them.
	if _, err := tx.Exec(ctx, `DELETE FROM debts WHERE user_id = $1`, userID); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to delete utang",
		})
	}

	if _, err := tx.Exec(ctx, `DELETE FROM paluwagans WHERE user_id = $1`, userID); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to delete paluwagan",
		})
	}

	if _, err := tx.Exec(ctx, `DELETE FROM bills WHERE user_id = $1`, userID); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to delete bills",
		})
	}

	if _, err := tx.Exec(ctx, `UPDATE users SET pay_schedule = NULL, savings_per_payday = 0, salary_per_payday = 0, extra_to_savings_percent = 50, regular_incomes = '[]'::jsonb, updated_at = NOW() WHERE id = $1`, userID); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to reset pay settings",
		})
	}

	if _, err := tx.Exec(ctx, `DELETE FROM transactions WHERE user_id = $1`, userID); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to delete transactions",
		})
	}

	if _, err := tx.Exec(ctx, `DELETE FROM budgets WHERE user_id = $1`, userID); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to delete budgets",
		})
	}

	if _, err := tx.Exec(ctx, `DELETE FROM accounts WHERE user_id = $1`, userID); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to delete accounts",
		})
	}

	if err := tx.Commit(ctx); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to commit transaction",
		})
	}

	return c.JSON(fiber.Map{
		"message": "All financial data has been wiped successfully",
	})
}

func (h *AuthHandler) GoogleLogin(c *fiber.Ctx) error {
	var req models.GoogleAuthRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Invalid request body",
		})
	}
	if err := validator.ValidateStruct(req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "idToken is required",
		})
	}

	claims, err := h.googleVerifier.Verify(c.Context(), req.IDToken)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"message": "Invalid Google sign-in",
		})
	}

	email, _ := claims["email"].(string)
	if verified, _ := claims["email_verified"].(bool); email == "" || !verified {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"message": "Your Google account email is not verified",
		})
	}
	firstName, _ := claims["given_name"].(string)
	lastName, _ := claims["family_name"].(string)
	avatarURL, _ := claims["picture"].(string)
	if firstName == "" {
		firstName = "User"
	}

	return h.socialLogin(c, "google", email, firstName, lastName, avatarURL)
}

func (h *AuthHandler) AppleLogin(c *fiber.Ctx) error {
	var req models.AppleAuthRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Invalid request body",
		})
	}
	if err := validator.ValidateStruct(req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "identityToken is required",
		})
	}

	claims, err := h.appleVerifier.Verify(c.Context(), req.IdentityToken)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"message": "Invalid Apple sign-in",
		})
	}

	email, _ := claims["email"].(string)
	if email == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"message": "Unable to determine email from Apple sign-in",
		})
	}

	firstName, lastName, _ := strings.Cut(strings.TrimSpace(req.FullName), " ")
	if firstName == "" {
		firstName, lastName = "Apple", "User"
	}

	return h.socialLogin(c, "apple", email, firstName, strings.TrimSpace(lastName), "")
}

// socialLogin finds or creates the user for a verified provider email and
// issues tokens. The upsert is a single statement so concurrent first
// sign-ins can't race into a unique-constraint failure.
//
// Registration doesn't prove email ownership, so anyone could have created
// this account. The first verified sign-in claims it: credentials set before
// then are cancelled, and so are any sessions they started.
func (h *AuthHandler) socialLogin(c *fiber.Ctx, provider, email, firstName, lastName, avatarURL string) error {
	var avatar *string
	if avatarURL != "" {
		avatar = &avatarURL
	}

	var user models.User
	var pinHash *string
	var claimed bool
	err := database.Pool.QueryRow(
		context.Background(),
		`WITH previous AS (
			SELECT email_verified, password_hash FROM users WHERE email = $3
		 )
		 INSERT INTO users (first_name, last_name, email, auth_provider, avatar_url, email_verified)
		 VALUES ($1, $2, $3, $4, $5, TRUE)
		 ON CONFLICT (email) DO UPDATE SET
			avatar_url = COALESCE(users.avatar_url, EXCLUDED.avatar_url),
			password_hash = CASE WHEN users.email_verified THEN users.password_hash END,
			pin_hash = CASE WHEN users.email_verified THEN users.pin_hash END,
			recovery_code_hash = CASE WHEN users.email_verified THEN users.recovery_code_hash END,
			email_verified = TRUE
		 RETURNING id, first_name, last_name, email, COALESCE(auth_provider, $4), avatar_url, pin_hash,
			recovery_code_hash IS NOT NULL, created_at, updated_at,
			COALESCE((SELECT NOT email_verified FROM previous), FALSE)`,
		firstName, lastName, email, provider, avatar,
	).Scan(&user.ID, &user.FirstName, &user.LastName, &user.Email, &user.AuthProvider, &user.AvatarURL, &pinHash, &user.HasRecoveryCode, &user.CreatedAt, &user.UpdatedAt, &claimed)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to sign in",
		})
	}

	if claimed {
		if err := h.sessions.RevokeAll(c.Context(), user.ID); err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"message": "Failed to sign in",
			})
		}
	}

	user.HasPIN = pinHash != nil && *pinHash != ""

	return h.startSession(c, user)
}

func (h *AuthHandler) SetPIN(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)

	var req models.SetPINRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Invalid request body",
		})
	}

	if errs := validator.ValidateStruct(req); errs != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "PIN must be exactly 4 digits",
		})
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.PIN), bcrypt.DefaultCost)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to hash PIN",
		})
	}

	_, err = database.Pool.Exec(
		context.Background(),
		`UPDATE users SET pin_hash = $1, updated_at = NOW() WHERE id = $2`,
		string(hash), userID,
	)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to update PIN",
		})
	}

	return c.JSON(models.PINResponse{
		Success: true,
		Message: "4-digit security PIN set successfully",
	})
}

func (h *AuthHandler) VerifyPIN(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)

	var req models.VerifyPINRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Invalid request body",
		})
	}

	var pinHash *string
	err := database.Pool.QueryRow(
		context.Background(),
		`SELECT pin_hash FROM users WHERE id = $1`,
		userID,
	).Scan(&pinHash)

	if err != nil || pinHash == nil || *pinHash == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "PIN not set for this user",
		})
	}

	if err := bcrypt.CompareHashAndPassword([]byte(*pinHash), []byte(req.PIN)); err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"message": "Incorrect PIN",
		})
	}

	return c.JSON(models.PINResponse{
		Success: true,
		Message: "PIN verified successfully",
	})
}

func (h *AuthHandler) PinLogin(c *fiber.Ctx) error {
	var req models.PinLoginRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Invalid request body",
		})
	}

	if errs := validator.ValidateStruct(req); errs != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Validation failed",
			"errors":  errs,
		})
	}

	var user models.User
	var pinHash *string
	var avatarURL *string
	err := database.Pool.QueryRow(
		context.Background(),
		`SELECT id, first_name, last_name, email, COALESCE(auth_provider, 'email'), avatar_url, pin_hash, recovery_code_hash IS NOT NULL, created_at, updated_at
		 FROM users WHERE email = $1`,
		req.Email,
	).Scan(&user.ID, &user.FirstName, &user.LastName, &user.Email, &user.AuthProvider, &avatarURL, &pinHash, &user.HasRecoveryCode, &user.CreatedAt, &user.UpdatedAt)

	if err != nil && err != pgx.ErrNoRows {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to look up user",
		})
	}

	// Same response for unknown email, no PIN set, and wrong PIN so the
	// endpoint can't be used to probe which accounts exist. A PIN can only
	// be set by an already-authenticated user via POST /auth/pin.
	if err == pgx.ErrNoRows || pinHash == nil || *pinHash == "" ||
		bcrypt.CompareHashAndPassword([]byte(*pinHash), []byte(req.PIN)) != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"message": "Invalid email or PIN",
		})
	}

	user.AvatarURL = avatarURL
	user.HasPIN = true

	return h.startSession(c, user)
}

