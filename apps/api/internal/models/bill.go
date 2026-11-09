package models

import "time"

const (
	BillStatusOverdue  = "overdue"
	BillStatusDueSoon  = "due_soon"
	BillStatusUpcoming = "upcoming"
	BillStatusPaused   = "paused"
)

type Bill struct {
	ID               string  `json:"id"`
	AccountID        *string `json:"accountId"`
	Name             string  `json:"name"`
	Category         string  `json:"category"`
	Amount           float64 `json:"amount"`
	Frequency        string  `json:"frequency"`
	StartDate        string  `json:"startDate"`
	RemindDaysBefore int     `json:"remindDaysBefore"`
	Active           bool    `json:"active"`
	Notes            *string `json:"notes"`

	// Worked out for the "today" the app sent.
	NextDue      string `json:"nextDue"`
	DaysUntil    int    `json:"daysUntil"`
	OverdueCount int    `json:"overdueCount"`
	Status       string `json:"status"`

	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type CreateBillRequest struct {
	AccountID        *string `json:"accountId,omitempty"`
	Name             string  `json:"name" validate:"required,max=100"`
	Category         string  `json:"category,omitempty" validate:"omitempty,max=100"`
	Amount           float64 `json:"amount" validate:"required,gt=0"`
	Frequency        string  `json:"frequency" validate:"required,oneof=weekly monthly yearly"`
	StartDate        string  `json:"startDate" validate:"required,datetime=2006-01-02"`
	RemindDaysBefore *int    `json:"remindDaysBefore,omitempty" validate:"omitempty,gte=0,lte=14"`
	Notes            *string `json:"notes,omitempty"`
}

type UpdateBillRequest struct {
	// An empty string removes the wallet.
	AccountID        *string  `json:"accountId,omitempty"`
	Name             *string  `json:"name,omitempty" validate:"omitempty,min=1,max=100"`
	Category         *string  `json:"category,omitempty" validate:"omitempty,min=1,max=100"`
	Amount           *float64 `json:"amount,omitempty" validate:"omitempty,gt=0"`
	Frequency        *string  `json:"frequency,omitempty" validate:"omitempty,oneof=weekly monthly yearly"`
	StartDate        *string  `json:"startDate,omitempty" validate:"omitempty,datetime=2006-01-02"`
	RemindDaysBefore *int     `json:"remindDaysBefore,omitempty" validate:"omitempty,gte=0,lte=14"`
	Active           *bool    `json:"active,omitempty"`
	Notes            *string  `json:"notes,omitempty"`
}

type PayBillRequest struct {
	// Which due date this pays, usually the bill's nextDue.
	DueDate string `json:"dueDate" validate:"required,datetime=2006-01-02"`
	// Defaults to the bill's amount and wallet.
	Amount    *float64 `json:"amount,omitempty" validate:"omitempty,gt=0"`
	AccountID *string  `json:"accountId,omitempty"`
	// The day it was paid, for the expense.
	Date string `json:"date" validate:"required,datetime=2006-01-02"`
}

type SkipBillRequest struct {
	DueDate string `json:"dueDate" validate:"required,datetime=2006-01-02"`
}

type PaySettings struct {
	// Null until the user sets a payday.
	PaySchedule      *string `json:"paySchedule"`
	SavingsPerPayday float64 `json:"savingsPerPayday"`
	BillReminders    bool    `json:"billReminders"`
}

type UpdatePaySettingsRequest struct {
	PaySchedule      *string  `json:"paySchedule,omitempty" validate:"omitempty,oneof=semi_monthly irregular"`
	SavingsPerPayday *float64 `json:"savingsPerPayday,omitempty" validate:"omitempty,gte=0"`
	BillReminders    *bool    `json:"billReminders,omitempty"`
}

type ReservedBill struct {
	BillID  string  `json:"billId"`
	Name    string  `json:"name"`
	DueDate string  `json:"dueDate"`
	Amount  float64 `json:"amount"`
	Overdue bool    `json:"overdue"`
}

type SafeToSpend struct {
	Configured  bool    `json:"configured"`
	PaySchedule *string `json:"paySchedule"`
	Today       string  `json:"today"`
	NextPayday  string  `json:"nextPayday"`
	DaysLeft    int     `json:"daysLeft"`
	// Total of the wallets that count toward Safe to Spend.
	Balance         float64        `json:"balance"`
	BillsReserved   float64        `json:"billsReserved"`
	SavingsTarget   float64        `json:"savingsTarget"`
	SavingsMoved    float64        `json:"savingsMoved"`
	SavingsReserved float64        `json:"savingsReserved"`
	Spendable       float64        `json:"spendable"`
	PerDay          float64        `json:"perDay"`
	Bills           []ReservedBill `json:"bills"`
}
