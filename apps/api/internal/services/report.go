package services

import (
	"context"
	"encoding/csv"
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

func generateLabels(start, end time.Time, truncType string) []string {
	var labels []string
	curr := start
	for curr.Before(end) || curr.Equal(end) {
		switch truncType {
		case "day":
			labels = append(labels, curr.Format("2006-01-02"))
			curr = curr.AddDate(0, 0, 1)
		case "week":
			offset := int(time.Monday - curr.Weekday())
			if offset > 0 {
				offset -= 7
			}
			labels = append(labels, curr.AddDate(0, 0, offset).Format("2006-01-02"))
			curr = curr.AddDate(0, 0, 7)
		case "year":
			labels = append(labels, curr.Format("2006")+"-01-01")
			curr = curr.AddDate(1, 0, 0)
		default:
			labels = append(labels, curr.Format("2006-01")+"-01")
			curr = curr.AddDate(0, 1, 0)
		}
	}
	return labels
}

func (s *ReportService) GetTrends(ctx context.Context, userID, startDate, endDate, accountId, txType string) ([]models.MonthlyTrend, error) {
	start, err := time.Parse("2006-01-02", startDate)
	if err != nil {
		return nil, err
	}
	end, err := time.Parse("2006-01-02", endDate)
	if err != nil {
		return nil, err
	}
	
	days := end.Sub(start).Hours() / 24
	truncType := "month"
	if days <= 31 {
		truncType = "day"
	} else if days <= 180 {
		truncType = "week"
	} else if days > 730 {
		truncType = "year"
	}

	labels := generateLabels(start, end, truncType)

	query := fmt.Sprintf(`
		SELECT to_char(date_trunc('%s', date), 'YYYY-MM-DD') as period_label,
		       COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as income,
		       COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as expense
		FROM transactions
		WHERE user_id = $1 AND date >= $2::date AND date <= $3::date
	`, truncType)

	args := []interface{}{userID, startDate, endDate}
	
	if accountId != "" {
		query += fmt.Sprintf(" AND (account_id = $%d OR transfer_account_id = $%d)", len(args)+1, len(args)+1)
		args = append(args, accountId)
	}
	if txType != "" {
		query += fmt.Sprintf(" AND type = $%d", len(args)+1)
		args = append(args, txType)
	}

	query += " GROUP BY period_label ORDER BY period_label ASC"

	rows, err := s.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	trendMap := make(map[string]*models.MonthlyTrend)
	for rows.Next() {
		var t models.MonthlyTrend
		if err := rows.Scan(&t.Month, &t.Income, &t.Expense); err == nil {
			t.Net = t.Income - t.Expense
			trendMap[t.Month] = &t
		}
	}

	trends := make([]models.MonthlyTrend, 0, len(labels))
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

func (s *ReportService) GetCategories(ctx context.Context, userID, startDate, endDate, accountId, txType string) ([]models.CategoryComparison, error) {
	start, err := time.Parse("2006-01-02", startDate)
	if err != nil {
		return nil, err
	}
	end, err := time.Parse("2006-01-02", endDate)
	if err != nil {
		return nil, err
	}
	
	days := int(end.Sub(start).Hours() / 24)
	prevStart := start.AddDate(0, 0, -(days+1)).Format("2006-01-02")
	prevEnd := start.AddDate(0, 0, -1).Format("2006-01-02")
	
	queryStr := `SELECT category, type, SUM(amount) as total FROM transactions WHERE user_id = $1 AND date >= $2 AND date <= $3`
	argsCurr := []interface{}{userID, startDate, endDate}
	argsPrev := []interface{}{userID, prevStart, prevEnd}

	if accountId != "" {
		queryStr += fmt.Sprintf(" AND account_id = $%d", len(argsCurr)+1)
		argsCurr = append(argsCurr, accountId)
		argsPrev = append(argsPrev, accountId)
	}
	if txType != "" {
		queryStr += fmt.Sprintf(" AND type = $%d", len(argsCurr)+1)
		argsCurr = append(argsCurr, txType)
		argsPrev = append(argsPrev, txType)
	}

	queryStr += " GROUP BY category, type ORDER BY total DESC"

	currentRows, err := s.db.Query(ctx, queryStr, argsCurr...)
	if err != nil {
		return nil, err
	}
	defer currentRows.Close()

	currentMap := make(map[string]models.CategoryComparison)
	for currentRows.Next() {
		var cat, tType string
		var total float64
		if err := currentRows.Scan(&cat, &tType, &total); err == nil {
			currentMap[cat] = models.CategoryComparison{
				Category:          cat,
				Type:              tType,
				CurrentMonthTotal: total,
				PreviousMonthTotal: 0,
			}
		}
	}

	prevRows, err := s.db.Query(ctx, queryStr, argsPrev...)
	if err != nil {
		return nil, err
	}
	defer prevRows.Close()

	for prevRows.Next() {
		var cat, tType string
		var total float64
		if err := prevRows.Scan(&cat, &tType, &total); err == nil {
			if existing, ok := currentMap[cat]; ok {
				existing.PreviousMonthTotal = total
				currentMap[cat] = existing
			} else {
				currentMap[cat] = models.CategoryComparison{
					Category:          cat,
					Type:              tType,
					CurrentMonthTotal: 0,
					PreviousMonthTotal: total,
				}
			}
		}
	}

	comparisons := make([]models.CategoryComparison, 0, len(currentMap))
	for _, c := range currentMap {
		comparisons = append(comparisons, c)
	}
	return comparisons, nil
}

// ExportRows returns every transaction in the period, newest first, with wallet
// names resolved. Transactions without a description are included.
func (s *ReportService) ExportRows(ctx context.Context, userID, startDate, endDate, accountId, txType string) ([]models.ExportRow, error) {
	queryStr := `SELECT t.date, t.type, t.amount, t.category, COALESCE(t.description, ''), COALESCE(a.name, ''), COALESCE(ta.name, '')
		FROM transactions t
		LEFT JOIN accounts a ON a.id = t.account_id
		LEFT JOIN accounts ta ON ta.id = t.transfer_account_id
		WHERE t.user_id = $1 AND t.date >= $2 AND t.date <= $3`
	args := []interface{}{userID, startDate, endDate}

	if accountId != "" {
		queryStr += fmt.Sprintf(" AND (t.account_id = $%d OR t.transfer_account_id = $%d)", len(args)+1, len(args)+1)
		args = append(args, accountId)
	}
	if txType != "" {
		queryStr += fmt.Sprintf(" AND t.type = $%d", len(args)+1)
		args = append(args, txType)
	}

	queryStr += " ORDER BY t.date DESC, t.created_at DESC"

	rows, err := s.db.Query(ctx, queryStr, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make([]models.ExportRow, 0)
	for rows.Next() {
		var date time.Time
		var row models.ExportRow
		var transferWallet string
		if err := rows.Scan(&date, &row.Type, &row.Amount, &row.Category, &row.Description, &row.Wallet, &transferWallet); err != nil {
			return nil, err
		}
		row.Date = date.Format("2006-01-02")
		if transferWallet != "" {
			row.Wallet += " → " + transferWallet
		}
		result = append(result, row)
	}
	return result, rows.Err()
}

func (s *ReportService) ExportCSV(ctx context.Context, userID, startDate, endDate, accountId, txType string) (string, error) {
	rows, err := s.ExportRows(ctx, userID, startDate, endDate, accountId, txType)
	if err != nil {
		return "", err
	}

	var sb strings.Builder
	w := csv.NewWriter(&sb)
	if err := w.Write([]string{"Date", "Type", "Amount", "Category", "Description"}); err != nil {
		return "", err
	}
	for _, row := range rows {
		record := []string{row.Date, row.Type, fmt.Sprintf("%.2f", row.Amount), row.Category, row.Description}
		if err := w.Write(record); err != nil {
			return "", err
		}
	}
	w.Flush()
	return sb.String(), w.Error()
}
