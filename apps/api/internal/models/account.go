package models

import "time"

type Account struct {
	ID        string    `json:"id"`
	UserID    string    `json:"userId"`
	Name      string    `json:"name"`
	Type      string    `json:"type"`
	Color     string    `json:"color"`
	Balance   float64   `json:"balance"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type CreateAccountRequest struct {
	Name string `json:"name" validate:"required"`
	Type string `json:"type" validate:"required,oneof=cash bank ewallet investment"`
	Color string `json:"color" validate:"required,hexcolor"`
}

type UpdateAccountRequest struct {
	Name string `json:"name,omitempty"`
	Type string `json:"type,omitempty" validate:"omitempty,oneof=cash bank ewallet investment"`
	Color *string `json:"color,omitempty" validate:"omitempty,hexcolor"`
}

type AccountResponse struct {
	Message string   `json:"message"`
	Data    *Account `json:"data,omitempty"`
}
