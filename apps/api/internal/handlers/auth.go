package handlers

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"golang.org/x/crypto/bcrypt"

	"github.com/Lorredo/fintrack/api/internal/database"
	"github.com/Lorredo/fintrack/api/internal/models"
	"github.com/Lorredo/fintrack/api/internal/oidc"
	"github.com/Lorredo/fintrack/api/internal/validator"
)

type AuthHandler struct {
	jwtSecret        string
	jwtAccessExpiry  time.Duration
	jwtRefreshExpiry time.Duration
	googleVerifier   *oidc.Verifier
	appleVerifier    *oidc.Verifier
}

func NewAuthHandler(secret string, accessExpiry, refreshExpiry time.Duration, googleVerifier, appleVerifier *oidc.Verifier) *AuthHandler {
	return &AuthHandler{
		jwtSecret:        secret,
		jwtAccessExpiry:  accessExpiry,
		jwtRefreshExpiry: refreshExpiry,
		googleVerifier:   googleVerifier,
		appleVerifier:    appleVerifier,
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

	var user models.User
	err = database.Pool.QueryRow(
		context.Background(),
		`INSERT INTO users (first_name, last_name, email, password_hash)
		 VALUES ($1, $2, $3, $4)
		 RETURNING id, first_name, last_name, email, created_at, updated_at`,
		req.FirstName, req.LastName, req.Email, string(hash),
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
		Message: "Registration successful",
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
		`SELECT id, first_name, last_name, email, password_hash, COALESCE(auth_provider, 'email'), avatar_url, pin_hash, created_at, updated_at
		 FROM users WHERE email = $1`,
		req.Email,
	).Scan(&user.ID, &user.FirstName, &user.LastName, &user.Email, &passwordHash, &user.AuthProvider, &avatarURL, &pinHash, &user.CreatedAt, &user.UpdatedAt)

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

	accessToken, err := h.generateToken(user.ID, h.jwtAccessExpiry)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to generate access token",
		})
	}

	refreshToken, err := h.generateToken(user.ID, h.jwtRefreshExpiry)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to generate refresh token",
		})
	}

	return c.JSON(models.LoginResponse{
		User: user,
		Tokens: models.AuthTokens{
			AccessToken:  accessToken,
			RefreshToken: refreshToken,
		},
	})
}

func (h *AuthHandler) Refresh(c *fiber.Ctx) error {
	var req models.RefreshTokenRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Invalid request body",
		})
	}

	token, err := jwt.Parse(req.RefreshToken, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fiber.ErrUnauthorized
		}
		return []byte(h.jwtSecret), nil
	})

	if err != nil || !token.Valid {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"message": "Invalid or expired refresh token",
		})
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"message": "Invalid token claims",
		})
	}

	userID, ok := claims["sub"].(string)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"message": "Invalid token subject",
		})
	}

	accessToken, err := h.generateToken(userID, h.jwtAccessExpiry)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to generate access token",
		})
	}

	newRefreshToken, err := h.generateToken(userID, h.jwtRefreshExpiry)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to generate refresh token",
		})
	}

	return c.JSON(models.RefreshTokenResponse{
		AccessToken:  accessToken,
		RefreshToken: newRefreshToken,
	})
}

func (h *AuthHandler) Logout(c *fiber.Ctx) error {
	return c.JSON(models.AuthResponse{
		Message: "Logged out successfully",
	})
}

func (h *AuthHandler) Me(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)

	var user models.User
	var pinHash *string
	var avatarURL *string
	err := database.Pool.QueryRow(
		context.Background(),
		`SELECT id, first_name, last_name, email, COALESCE(auth_provider, 'email'), avatar_url, pin_hash, created_at, updated_at
		 FROM users WHERE id = $1`,
		userID,
	).Scan(&user.ID, &user.FirstName, &user.LastName, &user.Email, &user.AuthProvider, &avatarURL, &pinHash, &user.CreatedAt, &user.UpdatedAt)

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

func (h *AuthHandler) generateToken(userID string, expiry time.Duration) (string, error) {
	claims := jwt.MapClaims{
		"sub": userID,
		"iat": time.Now().Unix(),
		"exp": time.Now().Add(expiry).Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(h.jwtSecret))
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

	// Delete in reverse order of dependency
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
func (h *AuthHandler) socialLogin(c *fiber.Ctx, provider, email, firstName, lastName, avatarURL string) error {
	var avatar *string
	if avatarURL != "" {
		avatar = &avatarURL
	}

	var user models.User
	var pinHash *string
	err := database.Pool.QueryRow(
		context.Background(),
		`INSERT INTO users (first_name, last_name, email, auth_provider, avatar_url)
		 VALUES ($1, $2, $3, $4, $5)
		 ON CONFLICT (email) DO UPDATE SET avatar_url = COALESCE(users.avatar_url, EXCLUDED.avatar_url)
		 RETURNING id, first_name, last_name, email, COALESCE(auth_provider, $4), avatar_url, pin_hash, created_at, updated_at`,
		firstName, lastName, email, provider, avatar,
	).Scan(&user.ID, &user.FirstName, &user.LastName, &user.Email, &user.AuthProvider, &user.AvatarURL, &pinHash, &user.CreatedAt, &user.UpdatedAt)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to sign in",
		})
	}

	user.HasPIN = pinHash != nil && *pinHash != ""

	accessToken, err := h.generateToken(user.ID, h.jwtAccessExpiry)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to generate access token",
		})
	}

	refreshToken, err := h.generateToken(user.ID, h.jwtRefreshExpiry)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to generate refresh token",
		})
	}

	return c.JSON(models.LoginResponse{
		User: user,
		Tokens: models.AuthTokens{
			AccessToken:  accessToken,
			RefreshToken: refreshToken,
		},
	})
}

func (h *AuthHandler) SetPIN(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)

	var req models.SetPINRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Invalid request body",
		})
	}

	if len(req.PIN) != 4 {
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
		`SELECT id, first_name, last_name, email, COALESCE(auth_provider, 'email'), avatar_url, pin_hash, created_at, updated_at
		 FROM users WHERE email = $1`,
		req.Email,
	).Scan(&user.ID, &user.FirstName, &user.LastName, &user.Email, &user.AuthProvider, &avatarURL, &pinHash, &user.CreatedAt, &user.UpdatedAt)

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

	accessToken, err := h.generateToken(user.ID, h.jwtAccessExpiry)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to generate access token",
		})
	}

	refreshToken, err := h.generateToken(user.ID, h.jwtRefreshExpiry)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to generate refresh token",
		})
	}

	return c.JSON(models.LoginResponse{
		User: user,
		Tokens: models.AuthTokens{
			AccessToken:  accessToken,
			RefreshToken: refreshToken,
		},
	})
}

