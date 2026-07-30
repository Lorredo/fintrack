package handlers

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"

	"github.com/Lorredo/fintrack/api/internal/database"
	"github.com/Lorredo/fintrack/api/internal/models"
)

type ReportHandler struct {
	db database.Querier
}

func NewReportHandler() *ReportHandler {
	return &ReportHandler{db: database.Pool}
}

// Trends returns monthly income/expense/net trends for the last N months.
func (h *ReportHandler) Trends(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)

	months := 6
	if m := c.Query("months", ""); m != "" {
		fmt.Sscanf(m, "%d", &months)
	}
	if months < 1 || months > 24 {
		months = 6
	}

	now := time.Now()
	startMonth := now.AddDate(0, -(months - 1), 0).Format("2006-01")

	rows, err := h.db.Query(
		context.Background(),
		`SELECT to_char(date, 'YYYY-MM') as month,
		        COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as income,
		        COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as expense
		 FROM transactions
		 WHERE user_id = $1 AND date >= $2::date
		 GROUP BY month
		 ORDER BY month ASC`,
		userID, startMonth+"-01",
	)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to fetch trends",
		})
	}
	defer rows.Close()

	trendMap := make(map[string]*models.MonthlyTrend)
	for rows.Next() {
		var t models.MonthlyTrend
		if err := rows.Scan(&t.Month, &t.Income, &t.Expense); err != nil {
			continue
		}
		t.Net = t.Income - t.Expense
		trendMap[t.Month] = &t
	}

	// Fill in missing months with zero values
	trends := make([]models.MonthlyTrend, 0, months)
	for i := 0; i < months; i++ {
		month := now.AddDate(0, -(months - 1 - i), 0).Format("2006-01")
		if t, ok := trendMap[month]; ok {
			trends = append(trends, *t)
		} else {
			trends = append(trends, models.MonthlyTrend{
				Month:   month,
				Income:  0,
				Expense: 0,
				Net:     0,
			})
		}
	}

	return c.JSON(fiber.Map{
		"trends": trends,
	})
}

// Categories returns category breakdown with previous month comparison.
func (h *ReportHandler) Categories(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)

	now := time.Now()
	month := c.Query("month", now.Format("2006-01"))

	// Calculate previous month
	t, err := time.Parse("2006-01", month)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Invalid month format, use YYYY-MM",
		})
	}
	prevMonth := t.AddDate(0, -1, 0).Format("2006-01")

	currentStart := month + "-01"
	currentEnd := t.AddDate(0, 1, 0).Format("2006-01") + "-01"
	prevStart := prevMonth + "-01"
	prevEnd := month + "-01"

	// Get current month category totals
	currentRows, err := h.db.Query(
		context.Background(),
		`SELECT category, type, SUM(amount) as total
		 FROM transactions
		 WHERE user_id = $1 AND date >= $2 AND date < $3
		 GROUP BY category, type
		 ORDER BY total DESC`,
		userID, currentStart, currentEnd,
	)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to fetch current month categories",
		})
	}
	defer currentRows.Close()

	currentMap := make(map[string]models.CategoryComparison)
	type currentRow struct {
		category string
		type_    string
		total    float64
	}
	var currentCategories []currentRow

	for currentRows.Next() {
		var cr currentRow
		if err := currentRows.Scan(&cr.category, &cr.type_, &cr.total); err != nil {
			continue
		}
		currentCategories = append(currentCategories, cr)
		currentMap[cr.category+"|"+cr.type_] = models.CategoryComparison{
			Category:           cr.category,
			Type:               cr.type_,
			CurrentMonthTotal:  cr.total,
			PreviousMonthTotal: 0,
			Change:             cr.total,
			ChangePercent:      100,
		}
	}

	// Get previous month category totals
	prevRows, err := h.db.Query(
		context.Background(),
		`SELECT category, type, SUM(amount) as total
		 FROM transactions
		 WHERE user_id = $1 AND date >= $2 AND date < $3
		 GROUP BY category, type`,
		userID, prevStart, prevEnd,
	)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to fetch previous month categories",
		})
	}
	defer prevRows.Close()

	for prevRows.Next() {
		var category, type_ string
		var total float64
		if err := prevRows.Scan(&category, &type_, &total); err != nil {
			continue
		}
		key := category + "|" + type_
		if existing, ok := currentMap[key]; ok {
			existing.PreviousMonthTotal = total
			existing.Change = existing.CurrentMonthTotal - total
			if total > 0 {
				existing.ChangePercent = ((existing.CurrentMonthTotal - total) / total) * 100
			}
			currentMap[key] = existing
		} else {
			currentMap[key] = models.CategoryComparison{
				Category:           category,
				Type:               type_,
				CurrentMonthTotal:  0,
				PreviousMonthTotal: total,
				Change:             -total,
				ChangePercent:      -100,
			}
		}
	}

	// Build result preserving current month order, then append previous-only
	comparisons := make([]models.CategoryComparison, 0, len(currentMap))
	seen := make(map[string]bool)
	for _, cr := range currentCategories {
		key := cr.category + "|" + cr.type_
		if cc, ok := currentMap[key]; ok {
			comparisons = append(comparisons, cc)
			seen[key] = true
		}
	}
	for key, cc := range currentMap {
		if !seen[key] {
			comparisons = append(comparisons, cc)
		}
	}

	return c.JSON(fiber.Map{
		"categoryComparisons": comparisons,
	})
}

// Export returns transactions as CSV for a given month.
func (h *ReportHandler) Export(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)

	now := time.Now()
	month := c.Query("month", now.Format("2006-01"))

	t, err := time.Parse("2006-01", month)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Invalid month format, use YYYY-MM",
		})
	}

	startDate := month + "-01"
	endDate := t.AddDate(0, 1, 0).Format("2006-01") + "-01"

	rows, err := h.db.Query(
		context.Background(),
		`SELECT date, type, amount, category, description
		 FROM transactions
		 WHERE user_id = $1 AND date >= $2 AND date < $3
		 ORDER BY date DESC, created_at DESC`,
		userID, startDate, endDate,
	)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to fetch transactions for export",
		})
	}
	defer rows.Close()

	var sb strings.Builder
	sb.WriteString("Date,Type,Amount,Category,Description\n")

	for rows.Next() {
		var date time.Time
		var type_, category, description string
		var amount float64
		if err := rows.Scan(&date, &type_, &amount, &category, &description); err != nil {
			continue
		}
		// Escape CSV fields
		desc := strings.ReplaceAll(description, "\"", "\"\"")
		sb.WriteString(fmt.Sprintf("%s,%s,%.2f,%s,\"%s\"\n",
			date.Format("2006-01-02"), type_, amount, category, desc))
	}

	format := c.Query("format", "csv")
	if format == "csv" {
		c.Set("Content-Type", "text/csv")
		c.Set("Content-Disposition", fmt.Sprintf("attachment; filename=transactions_%s.csv", month))
		return c.SendString(sb.String())
	}

	return c.JSON(fiber.Map{
		"data": sb.String(),
		"month": month,
	})
}