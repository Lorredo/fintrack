package models

import "time"

type User struct {
	ID              string    `json:"id"`
	FirstName       string    `json:"firstName"`
	LastName        string    `json:"lastName"`
	Email           string    `json:"email"`
	PasswordHash    *string   `json:"-"`
	AuthProvider    string    `json:"authProvider"`
	AuthProviderID  *string   `json:"-"`
	AvatarURL       *string   `json:"avatarUrl,omitempty"`
	PINHash         *string   `json:"-"`
	HasPIN          bool      `json:"hasPin"`
	HasPassword     bool      `json:"hasPassword"`
	HasRecoveryCode bool      `json:"hasRecoveryCode"`
	CreatedAt       time.Time `json:"createdAt"`
	UpdatedAt       time.Time `json:"updatedAt"`
}

type LoginRequest struct {
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required,min=8"`
}

type RegisterRequest struct {
	FirstName string `json:"firstName" validate:"required"`
	LastName  string `json:"lastName" validate:"required"`
	Email     string `json:"email" validate:"required,email"`
	Password  string `json:"password" validate:"required,min=8"`
}

// Identity (email, name, avatar) comes only from the verified ID token.
type GoogleAuthRequest struct {
	IDToken string `json:"idToken" validate:"required"`
}

// Apple puts the email in the verified identity token but only sends the
// user's name to the app, once, on first sign-in, so the name is taken from
// the request.
type AppleAuthRequest struct {
	IdentityToken string `json:"identityToken" validate:"required"`
	FullName      string `json:"fullName"`
}

type SetPINRequest struct {
	PIN string `json:"pin" validate:"required,len=4,numeric"`
}

type VerifyPINRequest struct {
	PIN string `json:"pin" validate:"required,len=4,numeric"`
}

type PinLoginRequest struct {
	Email string `json:"email" validate:"required,email"`
	PIN   string `json:"pin" validate:"required,len=4,numeric"`
}

type PINResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
}

type LoginResponse struct {
	User   User       `json:"user"`
	Tokens AuthTokens `json:"tokens"`
}

type AuthTokens struct {
	AccessToken  string `json:"accessToken"`
	RefreshToken string `json:"refreshToken"`
}

type RefreshTokenRequest struct {
	RefreshToken string `json:"refreshToken" validate:"required"`
}

type RefreshTokenResponse struct {
	AccessToken  string `json:"accessToken"`
	RefreshToken string `json:"refreshToken"`
}

type AuthResponse struct {
	Message      string `json:"message"`
	RecoveryCode string `json:"recoveryCode,omitempty"`
}

type LogoutRequest struct {
	RefreshToken string `json:"refreshToken"`
}

// Either credential confirms it's really the account owner.
type CreateRecoveryCodeRequest struct {
	Password string `json:"password"`
	PIN      string `json:"pin" validate:"omitempty,len=4,numeric"`
}

type RecoverRequest struct {
	Email       string `json:"email" validate:"required,email"`
	Code        string `json:"code" validate:"required"`
	NewPassword string `json:"newPassword" validate:"required,min=8,max=72"`
}

type GoogleRecoverRequest struct {
	IDToken     string `json:"idToken" validate:"required"`
	NewPassword string `json:"newPassword" validate:"required,min=8,max=72"`
}

type RecoveryCodeResponse struct {
	RecoveryCode string `json:"recoveryCode"`
}
