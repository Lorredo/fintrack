package services

import (
	"context"
	"time"

	"github.com/Lorredo/fintrack/api/internal/database"
	"github.com/Lorredo/fintrack/api/internal/models"
)

type DashboardService struct {
	db database.Querier
}

func NewDashboardService(db database.Querier) *DashboardService {
	if db == nil {
		db = database.Pool
	}
	return &DashboardService{db: db}
}

func (s *DashboardService) GetSummary(ctx context.Context, userID, month string) (*models.DashboardSummary, error) {
	startDate := month + "-01"
	endDate := addMonths(month, 1) + "-01"

	var totalIncome float64
	err := s.db.QueryRow(
		ctx,
		`SELECT COALESCE(SUM(amount), 0) FROM transactions
		 WHERE user_id = $1 AND type = 'income' AND date >= $2 AND date < $3`,
		userID, startDate, endDate,
	).Scan(&totalIncome)
	if err != nil {
		return nil, err
	}

	var totalExpense float64
	err = s.db.QueryRow(
		ctx,
		`SELECT COALESCE(SUM(amount), 0) FROM transactions
		 WHERE user_id = $1 AND type = 'expense' AND date >= $2 AND date < $3`,
		userID, startDate, endDate,
	).Scan(&totalExpense)
	if err != nil {
		return nil, err
	}

	rows, err := s.db.Query(
		ctx,
		`SELECT id, user_id, type, amount, category, description, date, created_at, updated_at
		 FROM transactions WHERE user_id = $1
		 ORDER BY date DESC, created_at DESC LIMIT 5`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	recentTransactions := make([]models.Transaction, 0)
	for rows.Next() {
		var t models.Transaction
		var dateTime time.Time
		if err := rows.Scan(&t.ID, &t.UserID, &t.Type, &t.Amount, &t.Category, &t.Description, &dateTime, &t.CreatedAt, &t.UpdatedAt); err != nil {
			continue
		}
		t.Date = dateTime.Format("2006-01-02")
		recentTransactions = append(recentTransactions, t)
	}

	catRows, err := s.db.Query(
		ctx,
		`SELECT category, type, SUM(amount) as total, COUNT(*) as count
		 FROM transactions WHERE user_id = $1 AND date >= $2 AND date < $3
		 GROUP BY category, type ORDER BY total DESC`,
		userID, startDate, endDate,
	)
	if err != nil {
		return nil, err
	}
	defer catRows.Close()

	categoryBreakdown := make([]models.CategorySummary, 0)
	for catRows.Next() {
		var cs models.CategorySummary
		if err := catRows.Scan(&cs.Category, &cs.Type, &cs.Total, &cs.Count); err != nil {
			continue
		}
		categoryBreakdown = append(categoryBreakdown, cs)
	}

	balance := totalIncome - totalExpense

	// Fetch active budgets for CURRENT_DATE
	budgetRows, err := s.db.Query(
		ctx,
		`SELECT b.id, b.user_id, b.category, b.amount, b.period_type, TO_CHAR(b.start_date, 'YYYY-MM-DD'), TO_CHAR(b.end_date, 'YYYY-MM-DD'), b.created_at, b.updated_at,
			COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END), 0) as spent
		 FROM budgets b
		 LEFT JOIN transactions t ON b.user_id = t.user_id AND b.category = t.category
			AND t.date >= b.start_date AND t.date <= b.end_date
		 WHERE b.user_id = $1 AND b.start_date <= CURRENT_DATE AND b.end_date >= CURRENT_DATE
		 GROUP BY b.id, b.user_id, b.category, b.amount, b.period_type, b.start_date, b.end_date, b.created_at, b.updated_at
		 ORDER BY b.end_date ASC, b.category ASC`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer budgetRows.Close()

	activeBudgets := make([]models.Budget, 0)
	for budgetRows.Next() {
		var b models.Budget
		if err := budgetRows.Scan(&b.ID, &b.UserID, &b.Category, &b.Amount, &b.PeriodType, &b.StartDate, &b.EndDate, &b.CreatedAt, &b.UpdatedAt, &b.Spent); err == nil {
			b.Remaining = b.Amount - b.Spent
			activeBudgets = append(activeBudgets, b)
		}
	}

	return &models.DashboardSummary{
		TotalIncome:        totalIncome,
		TotalExpense:       totalExpense,
		Balance:            balance,
		RecentTransactions: recentTransactions,
		CategoryBreakdown:  categoryBreakdown,
		ActiveBudgets:      activeBudgets,
	}, nil
}

func addMonths(yearMonth string, months int) string {
	t, err := time.Parse("2006-01", yearMonth)
	if err != nil {
		return yearMonth
	}
	return t.AddDate(0, months, 0).Format("2006-01")
}
