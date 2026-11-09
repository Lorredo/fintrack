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

const (
	RegularIncomeByDay     = "day"
	RegularIncomeByWeekday = "weekday"
)

// RegularIncome is pay besides the salary that arrives every month, such as
// an allowance. It counts as expected pay, like the salary, not as extra.
type RegularIncome struct {
	Name   string  `json:"name" validate:"required,max=50"`
	Amount float64 `json:"amount" validate:"required,gt=0"`
	// "day": on day Day of the month. "weekday": on the Nth Weekday of the
	// month, where Nth 5 means the last one and Weekday 0 is Sunday.
	Kind    string `json:"kind" validate:"required,oneof=day weekday"`
	Day     int    `json:"day,omitempty" validate:"min=0,max=31"`
	Nth     int    `json:"nth,omitempty" validate:"min=0,max=5"`
	Weekday int    `json:"weekday" validate:"min=0,max=6"`
}

// ExpectedIncome is one regular income due in the current pay period.
type ExpectedIncome struct {
	Name   string  `json:"name"`
	Amount float64 `json:"amount"`
	Date   string  `json:"date"`
}

type PaySettings struct {
	// Null until the user sets a payday.
	PaySchedule      *string `json:"paySchedule"`
	SavingsPerPayday float64 `json:"savingsPerPayday"`
	BillReminders    bool    `json:"billReminders"`
	// 0 keeps Safe to Spend based on wallet balances only.
	SalaryPerPayday float64 `json:"salaryPerPayday"`
	// Share of income above the salary (overtime, bonuses) that goes to savings.
	ExtraToSavingsPercent int             `json:"extraToSavingsPercent"`
	RegularIncomes        []RegularIncome `json:"regularIncomes"`
}

type UpdatePaySettingsRequest struct {
	PaySchedule      *string  `json:"paySchedule,omitempty" validate:"omitempty,oneof=semi_monthly irregular"`
	SavingsPerPayday *float64 `json:"savingsPerPayday,omitempty" validate:"omitempty,gte=0"`
	BillReminders    *bool    `json:"billReminders,omitempty"`
	SalaryPerPayday  *float64 `json:"salaryPerPayday,omitempty" validate:"omitempty,gte=0"`
	// Pointer so 0 ("spend it all") is accepted.
	ExtraToSavingsPercent *int `json:"extraToSavingsPercent,omitempty" validate:"omitempty,oneof=0 50 100"`
	// The whole list; an empty list removes them all.
	RegularIncomes *[]RegularIncome `json:"regularIncomes,omitempty" validate:"omitempty,max=10,dive"`
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

	// "salary" plans from this period's pay; "balance" uses wallet balances only.
	Mode string `json:"mode"`
	// The balance-based amount, which also caps the salary-based one.
	BalanceLeft      float64 `json:"balanceLeft"`
	LimitedByBalance bool    `json:"limitedByBalance"`

	// Salary mode only.
	Salary         float64 `json:"salary"`
	IncomeRecorded float64 `json:"incomeRecorded"`
	// True until the salary has been recorded as income this period.
	PayEstimated bool `json:"payEstimated"`
	// Salary plus the regular income due this period.
	ExpectedPay      float64          `json:"expectedPay"`
	RegularIncome    []ExpectedIncome `json:"regularIncome"`
	Pay              float64          `json:"pay"`
	ExtraIncome      float64          `json:"extraIncome"`
	ExtraSaved       float64          `json:"extraSaved"`
	BillsThisPeriod  float64          `json:"billsThisPeriod"`
	PeriodBills      []ReservedBill   `json:"periodBills"`
	SpendingMoney    float64          `json:"spendingMoney"`
	SpentSincePayday float64          `json:"spentSincePayday"`
	PlannedLeft      float64          `json:"plannedLeft"`
	PeriodStart      string           `json:"periodStart"`
}
