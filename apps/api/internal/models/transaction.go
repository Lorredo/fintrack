package models

import "time"

type TransactionType string

const (
	TransactionTypeIncome  TransactionType = "income"
	TransactionTypeExpense TransactionType = "expense"
)

type Transaction struct {
	ID          string          `json:"id"`
	UserID      string          `json:"userId"`
	Type        TransactionType `json:"type"`
	Amount      float64         `json:"amount"`
	Category    string          `json:"category"`
	Description *string         `json:"description,omitempty"`
	Date        string          `json:"date"`
	CreatedAt   time.Time       `json:"createdAt"`
	UpdatedAt   time.Time       `json:"updatedAt"`
}

type CreateTransactionRequest struct {
	Type        TransactionType `json:"type" validate:"required,oneof=income expense"`
	Amount      float64         `json:"amount" validate:"required,gt=0"`
	Category    string          `json:"category" validate:"required"`
	Description *string         `json:"description,omitempty"`
	Date        string          `json:"date" validate:"required"`
}

type UpdateTransactionRequest struct {
	Type        TransactionType `json:"type,omitempty" validate:"omitempty,oneof=income expense"`
	Amount      float64         `json:"amount,omitempty" validate:"omitempty,gt=0"`
	Category    string          `json:"category,omitempty"`
	Description *string         `json:"description,omitempty"`
	Date        string          `json:"date,omitempty"`
}

type TransactionResponse struct {
	Message string       `json:"message"`
	Data    *Transaction `json:"data,omitempty"`
}

type TransactionListResponse struct {
	Data       []Transaction `json:"data"`
	Total      int           `json:"total"`
	Page       int           `json:"page"`
	Limit      int           `json:"limit"`
	TotalPages int           `json:"totalPages"`
}
