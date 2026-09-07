package services

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/Lorredo/fintrack/api/internal/database"
	"github.com/Lorredo/fintrack/api/internal/models"
)

type ReportService struct {
	db database.Querier
}

func NewReportService(db database.Querier) *ReportService {
	if db == nil {
		db = database.Pool
	}
	return &ReportService{db: db}
}

func generatePeriodLabels(now time.Time, periodType string, periods int) []string {
	labels := make([]string, periods)
	for i := 0; i < periods; i++ {
		switch periodType {
		case "weekly":
			t := now.AddDate(0, 0, -7*(periods-1-i))
			// Find Monday
			offset := int(time.Monday - t.Weekday())
			if offset > 0 {
				offset -= 7
			}
			labels[i] = t.AddDate(0, 0, offset).Format("2006-01-02")
		case "yearly":
			t := now.AddDate(-(periods-1-i), 0, 0)
			labels[i] = t.Format("2006") + "-01-01"
		default:
			t := now.AddDate(0, -(periods-1-i), 0)
			labels[i] = t.Format("2006-01") + "-01"
		}
	}
	return labels
}

func (s *ReportService) GetTrends(ctx context.Context, userID string, periods int, periodType string) ([]models.MonthlyTrend, error) {
	now := time.Now()
	labels := generatePeriodLabels(now, periodType, periods)
	startDate := labels[0]

	truncType := "month"
	if periodType == "weekly" {
		truncType = "week"
	} else if periodType == "yearly" {
		truncType = "year"
	}

	query := fmt.Sprintf(`
		SELECT to_char(date_trunc('%s', date), 'YYYY-MM-DD') as period_label,
		       COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as income,
		       COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as expense
		FROM transactions
		WHERE user_id = $1 AND date >= $2::date
		GROUP BY period_label
		ORDER BY period_label ASC`, truncType)

	rows, err := s.db.Query(ctx, query, userID, startDate)
	if err != nil {
		return nil, err
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

	trends := make([]models.MonthlyTrend, 0, periods)
	for _, label := range labels {
		if t, ok := trendMap[label]; ok {
			trends = append(trends, *t)
		} else {
			trends = append(trends, models.MonthlyTrend{
				Month:   label,
				Income:  0,
				Expense: 0,
				Net:     0,
			})
		}
	}

	return trends, nil
}

func (s *ReportService) GetCategories(ctx context.Context, userID, refDateStr, periodType string) ([]models.CategoryComparison, error) {
	var currentStart, currentEnd, prevStart, prevEnd time.Time
	refDate, err := time.Parse("2006-01-02", refDateStr)
	if err != nil {
		// Fallback if they pass just YYYY-MM
		refDate, err = time.Parse("2006-01", refDateStr)
		if err != nil {
			refDate = time.Now()
		}
	}

	if periodType == "weekly" {
		offset := int(time.Monday - refDate.Weekday())
		if offset > 0 {
			offset -= 7
		}
		currentStart = refDate.AddDate(0, 0, offset)
		currentEnd = currentStart.AddDate(0, 0, 7)
		prevStart = currentStart.AddDate(0, 0, -7)
		prevEnd = currentStart
	} else if periodType == "yearly" {
		currentStart = time.Date(refDate.Year(), 1, 1, 0, 0, 0, 0, time.UTC)
		currentEnd = currentStart.AddDate(1, 0, 0)
		prevStart = currentStart.AddDate(-1, 0, 0)
		prevEnd = currentStart
	} else {
		currentStart = time.Date(refDate.Year(), refDate.Month(), 1, 0, 0, 0, 0, time.UTC)
		currentEnd = currentStart.AddDate(0, 1, 0)
		prevStart = currentStart.AddDate(0, -1, 0)
		prevEnd = currentStart
	}

	currentRows, err := s.db.Query(
		ctx,
		`SELECT category, type, SUM(amount) as total
		 FROM transactions
		 WHERE user_id = $1 AND date >= $2 AND date < $3
		 GROUP BY category, type
		 ORDER BY total DESC`,
		userID, currentStart.Format("2006-01-02"), currentEnd.Format("2006-01-02"),
	)
	if err != nil {
		return nil, err
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

	prevRows, err := s.db.Query(
		ctx,
		`SELECT category, type, SUM(amount) as total
		 FROM transactions
		 WHERE user_id = $1 AND date >= $2 AND date < $3
		 GROUP BY category, type`,
		userID, prevStart.Format("2006-01-02"), prevEnd.Format("2006-01-02"),
	)
	if err != nil {
		return nil, err
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

	return comparisons, nil
}

func (s *ReportService) ExportCSV(ctx context.Context, userID, month string) (string, error) {
	t, err := time.Parse("2006-01", month)
	if err != nil {
		t, _ = time.Parse("2006-01-02", month)
	}

	startDate := time.Date(t.Year(), t.Month(), 1, 0, 0, 0, 0, time.UTC).Format("2006-01-02")
	endDate := time.Date(t.Year(), t.Month(), 1, 0, 0, 0, 0, time.UTC).AddDate(0, 1, 0).Format("2006-01-02")

	rows, err := s.db.Query(
		ctx,
		`SELECT date, type, amount, category, description
		 FROM transactions
		 WHERE user_id = $1 AND date >= $2 AND date < $3
		 ORDER BY date DESC, created_at DESC`,
		userID, startDate, endDate,
	)
	if err != nil {
		return "", err
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
		desc := strings.ReplaceAll(description, "\"", "\"\"")
		sb.WriteString(fmt.Sprintf("%s,%s,%.2f,%s,\"%s\"\n",
			date.Format("2006-01-02"), type_, amount, category, desc))
	}
	return sb.String(), nil
}
