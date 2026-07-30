package handlers

import (
	"context"
	"time"

	"github.com/gofiber/fiber/v2"

	"github.com/Lorredo/fintrack/api/internal/database"
	"github.com/Lorredo/fintrack/api/internal/models"
)

type DashboardHandler struct {
	db database.Querier
}

func NewDashboardHandler() *DashboardHandler {
	return &DashboardHandler{db: database.Pool}
}

// NewDashboardHandlerWithDB creates a handler with a custom DB (for testing).
func NewDashboardHandlerWithDB(db database.Querier) *DashboardHandler {
	return &DashboardHandler{db: db}
}

// Summary returns aggregated dashboard data for the authenticated user.
func (h *DashboardHandler) Summary(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)

	// Default to current month
	now := time.Now()
	month := c.Query("month", now.Format("2006-01"))

	// Calculate date range for the month
	startDate := month + "-01"
	endDate := addMonths(month, 1) + "-01"

	// Get total income for the month
	var totalIncome float64
	err := h.db.QueryRow(
		context.Background(),
		`SELECT COALESCE(SUM(amount), 0) FROM transactions
		 WHERE user_id = $1 AND type = 'income' AND date >= $2 AND date < $3`,
		userID, startDate, endDate,
	).Scan(&totalIncome)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to calculate income",
		})
	}

	// Get total expense for the month
	var totalExpense float64
	err = h.db.QueryRow(
		context.Background(),
		`SELECT COALESCE(SUM(amount), 0) FROM transactions
		 WHERE user_id = $1 AND type = 'expense' AND date >= $2 AND date < $3`,
		userID, startDate, endDate,
	).Scan(&totalExpense)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to calculate expenses",
		})
	}

	// Get recent transactions
	rows, err := h.db.Query(
		context.Background(),
		`SELECT id, user_id, type, amount, category, description, date, created_at, updated_at
		 FROM transactions WHERE user_id = $1
		 ORDER BY date DESC, created_at DESC LIMIT 5`,
		userID,
	)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to fetch recent transactions",
		})
	}
	defer rows.Close()

	recentTransactions := make([]models.Transaction, 0)
	for rows.Next() {
		var t models.Transaction
		var dateTime time.Time
		err := rows.Scan(&t.ID, &t.UserID, &t.Type, &t.Amount, &t.Category, &t.Description, &dateTime, &t.CreatedAt, &t.UpdatedAt)
		if err != nil {
			continue
		}
		t.Date = dateTime.Format("2006-01-02")
		recentTransactions = append(recentTransactions, t)
	}

	// Get category breakdown for the month
	catRows, err := h.db.Query(
		context.Background(),
		`SELECT category, type, SUM(amount) as total, COUNT(*) as count
		 FROM transactions WHERE user_id = $1 AND date >= $2 AND date < $3
		 GROUP BY category, type ORDER BY total DESC`,
		userID, startDate, endDate,
	)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to fetch category breakdown",
		})
	}
	defer catRows.Close()

	categoryBreakdown := make([]models.CategorySummary, 0)
	for catRows.Next() {
		var cs models.CategorySummary
		err := catRows.Scan(&cs.Category, &cs.Type, &cs.Total, &cs.Count)
		if err != nil {
			continue
		}
		categoryBreakdown = append(categoryBreakdown, cs)
	}

	balance := totalIncome - totalExpense

	return c.JSON(models.DashboardSummary{
		TotalIncome:        totalIncome,
		TotalExpense:       totalExpense,
		Balance:            balance,
		RecentTransactions: recentTransactions,
		CategoryBreakdown:  categoryBreakdown,
	})
}

// addMonths adds a month to a YYYY-MM string and returns the result as YYYY-MM.
func addMonths(yearMonth string, months int) string {
	t, err := time.Parse("2006-01", yearMonth)
	if err != nil {
		return yearMonth
	}
	return t.AddDate(0, months, 0).Format("2006-01")
}
