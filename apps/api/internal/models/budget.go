package models

import "time"

type Budget struct {
	ID          string    `json:"id"`
	UserID      string    `json:"userId"`
	AccountID   string    `json:"accountId"`
	Category    string    `json:"category"`
	Amount      float64   `json:"amount"`
	PeriodType  string    `json:"periodType"`
	StartDate   string    `json:"startDate"`
	EndDate     string    `json:"endDate"`
	Spent       float64   `json:"spent"`
	Remaining   float64   `json:"remaining"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

type CreateBudgetRequest struct {
	AccountID  string  `json:"accountId" validate:"required"`
	Category   string  `json:"category" validate:"required"`
	Amount     float64 `json:"amount" validate:"required,gt=0"`
	PeriodType string  `json:"periodType" validate:"required"`
	StartDate  string  `json:"startDate" validate:"required"`
	EndDate    string  `json:"endDate" validate:"required"`
}

type UpdateBudgetRequest struct {
	AccountID  string  `json:"accountId,omitempty"`
	Category   string  `json:"category,omitempty"`
	Amount     float64 `json:"amount,omitempty" validate:"omitempty,gt=0"`
	PeriodType string  `json:"periodType,omitempty"`
	StartDate  string  `json:"startDate,omitempty"`
	EndDate    string  `json:"endDate,omitempty"`
}

type BudgetResponse struct {
	Message string  `json:"message"`
	Data    *Budget `json:"data,omitempty"`
}

type BudgetListResponse struct {
	Data  []Budget `json:"data"`
	Total int      `json:"total"`
}
