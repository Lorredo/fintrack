package models

type RebalanceBudgetRequest struct {
	FromBudgetID string  `json:"fromBudgetId" validate:"required"`
	ToBudgetID   string  `json:"toBudgetId" validate:"required"`
	Amount       float64 `json:"amount" validate:"required,gt=0"`
}
