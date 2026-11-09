package models

import "time"

const (
	DebtLent     = "lent"
	DebtBorrowed = "borrowed"
)

type DebtPayment struct {
	ID            string  `json:"id"`
	Amount        float64 `json:"amount"`
	Date          string  `json:"date"`
	AccountID     *string `json:"accountId"`
	TransactionID *string `json:"transactionId"`
}

type Debt struct {
	ID         string `json:"id"`
	PersonName string `json:"personName"`
	// "lent": they owe the user. "borrowed": the user owes them.
	Direction string        `json:"direction"`
	Amount    float64       `json:"amount"`
	AccountID *string       `json:"accountId"`
	Date      string        `json:"date"`
	DueDate   *string       `json:"dueDate"`
	Notes     *string       `json:"notes"`
	Paid      float64       `json:"paid"`
	Remaining float64       `json:"remaining"`
	Settled   bool          `json:"settled"`
	Payments  []DebtPayment `json:"payments"`
	CreatedAt time.Time     `json:"createdAt"`
	UpdatedAt time.Time     `json:"updatedAt"`
}

// PersonBalance is the net between the user and one person. Positive: they
// owe the user. Negative: the user owes them.
type PersonBalance struct {
	PersonName string  `json:"personName"`
	OwedToYou  float64 `json:"owedToYou"`
	YouOwe     float64 `json:"youOwe"`
	Net        float64 `json:"net"`
}

type DebtSummary struct {
	Debts     []Debt          `json:"debts"`
	People    []PersonBalance `json:"people"`
	OwedToYou float64         `json:"owedToYou"`
	YouOwe    float64         `json:"youOwe"`
}

type CreateDebtRequest struct {
	PersonName string  `json:"personName" validate:"required,max=80"`
	Direction  string  `json:"direction" validate:"required,oneof=lent borrowed"`
	Amount     float64 `json:"amount" validate:"required,gt=0"`
	AccountID  string  `json:"accountId" validate:"required"`
	Date       string  `json:"date" validate:"required,datetime=2006-01-02"`
	DueDate    *string `json:"dueDate,omitempty" validate:"omitempty,datetime=2006-01-02"`
	Notes      *string `json:"notes,omitempty"`
}

type UpdateDebtRequest struct {
	PersonName *string `json:"personName,omitempty" validate:"omitempty,min=1,max=80"`
	// An empty string removes the due date.
	DueDate *string `json:"dueDate,omitempty" validate:"omitempty,datetime=2006-01-02"`
	Notes   *string `json:"notes,omitempty"`
	// Set to clear the due date.
	ClearDueDate bool `json:"clearDueDate,omitempty"`
}

type DebtPaymentRequest struct {
	Amount    float64 `json:"amount" validate:"required,gt=0"`
	Date      string  `json:"date" validate:"required,datetime=2006-01-02"`
	AccountID *string `json:"accountId,omitempty"`
}

const (
	PaluwaganWeekly      = "weekly"
	PaluwaganSemiMonthly = "semi_monthly"
	PaluwaganMonthly     = "monthly"
)

type PaluwaganRound struct {
	Round          int    `json:"round"`
	Date           string `json:"date"`
	Contributed    bool   `json:"contributed"`
	IsMyTurn       bool   `json:"isMyTurn"`
	PayoutReceived bool   `json:"payoutReceived"`
	IsPast         bool   `json:"isPast"`
}

type Paluwagan struct {
	ID           string  `json:"id"`
	Name         string  `json:"name"`
	Contribution float64 `json:"contribution"`
	Frequency    string  `json:"frequency"`
	StartDate    string  `json:"startDate"`
	Members      int     `json:"members"`
	MyTurn       int     `json:"myTurn"`
	PayoutAmount float64 `json:"payoutAmount"`
	AccountID    *string `json:"accountId"`
	Active       bool    `json:"active"`

	Rounds []PaluwaganRound `json:"rounds"`
	// The earliest round not yet contributed to, or nil when all are paid.
	NextContribution *PaluwaganRound `json:"nextContribution"`
	MyPayoutDate     string          `json:"myPayoutDate"`
	TotalContributed float64         `json:"totalContributed"`
	ContributedCount int             `json:"contributedCount"`
	// Contributions due before today that aren't paid.
	OverdueCount int  `json:"overdueCount"`
	Finished     bool `json:"finished"`

	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type CreatePaluwaganRequest struct {
	Name         string  `json:"name" validate:"required,max=80"`
	Contribution float64 `json:"contribution" validate:"required,gt=0"`
	Frequency    string  `json:"frequency" validate:"required,oneof=weekly semi_monthly monthly"`
	StartDate    string  `json:"startDate" validate:"required,datetime=2006-01-02"`
	Members      int     `json:"members" validate:"required,min=2,max=50"`
	MyTurn       int     `json:"myTurn" validate:"required,min=1,max=50"`
	// Defaults to contribution × members.
	PayoutAmount *float64 `json:"payoutAmount,omitempty" validate:"omitempty,gt=0"`
	AccountID    *string  `json:"accountId,omitempty"`
}

type UpdatePaluwaganRequest struct {
	Name         *string  `json:"name,omitempty" validate:"omitempty,min=1,max=80"`
	Contribution *float64 `json:"contribution,omitempty" validate:"omitempty,gt=0"`
	MyTurn       *int     `json:"myTurn,omitempty" validate:"omitempty,min=1,max=50"`
	PayoutAmount *float64 `json:"payoutAmount,omitempty" validate:"omitempty,gt=0"`
	AccountID    *string  `json:"accountId,omitempty"`
	Active       *bool    `json:"active,omitempty"`
}

type PaluwaganPaymentRequest struct {
	Round     int      `json:"round" validate:"required,min=1,max=50"`
	Date      string   `json:"date" validate:"required,datetime=2006-01-02"`
	Amount    *float64 `json:"amount,omitempty" validate:"omitempty,gt=0"`
	AccountID *string  `json:"accountId,omitempty"`
}
