package models

import "time"

type Budget struct {
	ID        string    `json:"id"`
	UserID    string    `json:"userId"`
	Category  string    `json:"category"`
	Amount    float64   `json:"amount"`
	Month     string    `json:"month"`
	Spent     float64   `json:"spent"`
	Remaining float64   `json:"remaining"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type CreateBudgetRequest struct {
	Category string  `json:"category" validate:"required"`
	Amount   float64 `json:"amount" validate:"required,gt=0"`
	Month    string  `json:"month" validate:"required"`
}

type UpdateBudgetRequest struct {
	Category string  `json:"category,omitempty"`
	Amount   float64 `json:"amount,omitempty" validate:"omitempty,gt=0"`
	Month    string  `json:"month,omitempty"`
}

type BudgetResponse struct {
	Message string  `json:"message"`
	Data    *Budget `json:"data,omitempty"`
}

type BudgetListResponse struct {
	Data  []Budget `json:"data"`
	Total int      `json:"total"`
}
