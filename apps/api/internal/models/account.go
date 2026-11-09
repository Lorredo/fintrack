package models

import "time"

type Account struct {
	ID        string    `json:"id"`
	UserID    string    `json:"userId"`
	Name      string    `json:"name"`
	Type      string    `json:"type"`
	Color     string    `json:"color"`
	Balance   float64   `json:"balance"`
	// False for wallets such as savings, which Safe to Spend leaves out.
	InSafeToSpend bool `json:"inSafeToSpend"`
	// Null until the wallet's balance has been updated.
	LastAdjustedAt *time.Time `json:"lastAdjustedAt"`
	CreatedAt      time.Time  `json:"createdAt"`
	UpdatedAt      time.Time  `json:"updatedAt"`
}

type CreateAccountRequest struct {
	Name  string `json:"name" validate:"required"`
	Type  string `json:"type" validate:"required,oneof=cash bank ewallet investment"`
	Color string `json:"color" validate:"required,hexcolor"`
	// Defaults to true when left out.
	InSafeToSpend *bool `json:"inSafeToSpend,omitempty"`
}

type UpdateAccountRequest struct {
	Name  string  `json:"name,omitempty"`
	Type  string  `json:"type,omitempty" validate:"omitempty,oneof=cash bank ewallet investment"`
	Color *string `json:"color,omitempty" validate:"omitempty,hexcolor"`
	InSafeToSpend *bool `json:"inSafeToSpend,omitempty"`
}

type SetBalanceRequest struct {
	// A pointer so a balance of 0 passes the required check.
	Balance *float64 `json:"balance" validate:"required,gte=0"`
	Date    string   `json:"date" validate:"required,datetime=2006-01-02"`
}

type SetBalanceResult struct {
	Balance  float64 `json:"balance"`
	Adjusted bool    `json:"adjusted"`
}

type AccountResponse struct {
	Message string   `json:"message"`
	Data    *Account `json:"data,omitempty"`
}
