package models

type DashboardSummary struct {
	TotalIncome        float64           `json:"totalIncome"`
	TotalExpense       float64           `json:"totalExpense"`
	Balance            float64           `json:"balance"`
	RecentTransactions []Transaction     `json:"recentTransactions"`
	CategoryBreakdown  []CategorySummary `json:"categoryBreakdown"`
	ActiveBudgets      []Budget          `json:"activeBudgets"`
}

type CategorySummary struct {
	Category string  `json:"category"`
	Type     string  `json:"type"`
	Total    float64 `json:"total"`
	Count    int     `json:"count"`
}
