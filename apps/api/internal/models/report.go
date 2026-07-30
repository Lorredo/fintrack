package models

// MonthlyTrend represents income/expense for a single month.
type MonthlyTrend struct {
	Month  string  `json:"month"`
	Income float64 `json:"income"`
	Expense float64 `json:"expense"`
	Net    float64 `json:"net"`
}

// CategoryComparison compares a category's totals between two months.
type CategoryComparison struct {
	Category          string  `json:"category"`
	Type              string  `json:"type"`
	CurrentMonthTotal float64 `json:"currentMonthTotal"`
	PreviousMonthTotal float64 `json:"previousMonthTotal"`
	Change            float64 `json:"change"`
	ChangePercent     float64 `json:"changePercent"`
}

// ReportSummary is the top-level response for the reports endpoint.
type ReportSummary struct {
	Trends             []MonthlyTrend      `json:"trends"`
	CategoryComparisons []CategoryComparison `json:"categoryComparisons"`
}