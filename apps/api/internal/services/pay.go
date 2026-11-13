package services

import (
	"context"
	"errors"
	"sort"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/Lorredo/fintrack/api/internal/models"
)

var (
	ErrNotAPayItem        = errors.New("That pay isn't due on this date")
	ErrPayAlreadyRecorded = errors.New("This pay is already recorded")
	ErrPayNeedsWallet     = errors.New("Choose the wallet this pay goes to")
)

const (
	salaryCategory    = "Salary"
	allowanceCategory = "Allowance"
)

// regularIncomeKey identifies an allowance across edits to its amount or day.
func regularIncomeKey(name string) string {
	return "income:" + strings.ToLower(strings.TrimSpace(name))
}

// payItemsInPeriod lists the salary and allowances due within a pay period.
// Irregular pay has no fixed payday, so only allowances are listed.
func payItemsInPeriod(settings *models.PaySettings, period PayPeriod) []models.PayItem {
	items := make([]models.PayItem, 0)
	if settings.PaySchedule != nil && *settings.PaySchedule == PayScheduleSemiMonthly && settings.SalaryPerPayday > 0 {
		items = append(items, models.PayItem{
			Key:       models.PayItemSalary,
			Name:      salaryCategory,
			Kind:      models.PayItemSalary,
			Amount:    settings.SalaryPerPayday,
			Date:      FormatDay(period.Start),
			AccountID: settings.SalaryAccountID,
		})
	}
	for _, income := range settings.RegularIncomes {
		accountID := income.AccountID
		if accountID == nil {
			accountID = settings.SalaryAccountID
		}
		for _, expected := range RegularIncomeInPeriod([]models.RegularIncome{income}, period) {
			items = append(items, models.PayItem{
				Key:       regularIncomeKey(income.Name),
				Name:      income.Name,
				Kind:      models.PayItemAllowance,
				Amount:    income.Amount,
				Date:      expected.Date,
				AccountID: accountID,
			})
		}
	}
	sort.SliceStable(items, func(i, j int) bool { return items[i].Date < items[j].Date })
	return items
}

func payScheduleOf(settings *models.PaySettings) string {
	if settings.PaySchedule != nil {
		return *settings.PaySchedule
	}
	return PayScheduleIrregular
}

// recordedPay returns the "key|date" of every recorded or skipped pay from a
// date on.
func (s *BillService) recordedPay(ctx context.Context, userID string, from time.Time) (map[string]bool, error) {
	rows, err := s.db.Query(ctx,
		`SELECT item_key, pay_date FROM pay_records WHERE user_id = $1 AND pay_date >= $2`,
		userID, FormatDay(from))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	recorded := make(map[string]bool)
	for rows.Next() {
		var key string
		var date time.Time
		if err := rows.Scan(&key, &date); err != nil {
			return nil, err
		}
		recorded[key+"|"+FormatDay(date)] = true
	}
	return recorded, rows.Err()
}

// PendingPay lists the pay due so far this period that hasn't been recorded,
// and what comes after today through the next period.
func (s *BillService) PendingPay(ctx context.Context, userID string, today time.Time) (*models.PendingPay, error) {
	settings, err := s.GetSettings(ctx, userID)
	if err != nil {
		return nil, err
	}
	schedule := payScheduleOf(settings)
	period := CurrentPayPeriod(schedule, today)
	next := CurrentPayPeriod(schedule, period.NextPayday)

	recorded, err := s.recordedPay(ctx, userID, period.Start)
	if err != nil {
		return nil, err
	}

	result := &models.PendingPay{Pending: make([]models.PayItem, 0), Upcoming: make([]models.PayItem, 0)}
	todayText := FormatDay(today)
	items := append(payItemsInPeriod(settings, period), payItemsInPeriod(settings, next)...)
	for _, item := range items {
		if recorded[item.Key+"|"+item.Date] {
			continue
		}
		if item.Date <= todayText {
			result.Pending = append(result.Pending, item)
		} else {
			result.Upcoming = append(result.Upcoming, item)
		}
	}
	return result, nil
}

// findPayItem checks that key is due on payDate, in the period payDate falls in.
func findPayItem(settings *models.PaySettings, key string, payDate time.Time) (*models.PayItem, error) {
	date := FormatDay(payDate)
	for _, item := range payItemsInPeriod(settings, CurrentPayPeriod(payScheduleOf(settings), payDate)) {
		if item.Key == key && item.Date == date {
			return &item, nil
		}
	}
	return nil, ErrNotAPayItem
}

// claimPay marks the pay as recorded. The unique key makes a second tap, or a
// retried request, fail instead of adding the income twice.
func claimPay(ctx context.Context, tx pgx.Tx, userID, key string, payDate time.Time, skipped bool) (string, error) {
	var recordID string
	err := tx.QueryRow(ctx,
		`INSERT INTO pay_records (user_id, item_key, pay_date, skipped) VALUES ($1, $2, $3, $4)
		 ON CONFLICT (user_id, item_key, pay_date) DO NOTHING RETURNING id`,
		userID, key, FormatDay(payDate), skipped,
	).Scan(&recordID)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", ErrPayAlreadyRecorded
	}
	return recordID, err
}

// RecordPay adds the income and marks the pay recorded, together or not at all.
func (s *BillService) RecordPay(ctx context.Context, userID string, req models.RecordPayRequest) (*models.Transaction, error) {
	payDate, err := ParseDay(req.PayDate)
	if err != nil {
		return nil, ErrNotAPayItem
	}
	settings, err := s.GetSettings(ctx, userID)
	if err != nil {
		return nil, err
	}
	item, err := findPayItem(settings, req.Key, payDate)
	if err != nil {
		return nil, err
	}

	accountID := item.AccountID
	if req.AccountID != nil && *req.AccountID != "" {
		accountID = req.AccountID
	}
	if accountID == nil {
		return nil, ErrPayNeedsWallet
	}
	amount := item.Amount
	if req.Amount != nil {
		amount = *req.Amount
	}

	tx, err := s.begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	if err := ownsWallet(ctx, tx, userID, *accountID); err != nil {
		return nil, err
	}
	recordID, err := claimPay(ctx, tx, userID, item.Key, payDate, false)
	if err != nil {
		return nil, err
	}

	category := salaryCategory
	if item.Kind == models.PayItemAllowance {
		category = allowanceCategory
	}
	description := item.Name
	transaction, err := CreateTransaction(ctx, tx, userID, models.CreateTransactionRequest{
		AccountID:   *accountID,
		Type:        models.TransactionTypeIncome,
		Amount:      amount,
		Category:    category,
		Description: &description,
		Date:        req.Date,
	})
	if err != nil {
		return nil, err
	}
	if _, err := tx.Exec(ctx, `UPDATE pay_records SET transaction_id = $1 WHERE id = $2`, transaction.ID, recordID); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return transaction, nil
}

// SkipPay marks pay as handled without adding income, for pay the user already
// entered by hand.
func (s *BillService) SkipPay(ctx context.Context, userID string, req models.SkipPayRequest) error {
	payDate, err := ParseDay(req.PayDate)
	if err != nil {
		return ErrNotAPayItem
	}
	settings, err := s.GetSettings(ctx, userID)
	if err != nil {
		return err
	}
	item, err := findPayItem(settings, req.Key, payDate)
	if err != nil {
		return err
	}

	tx, err := s.begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if _, err := claimPay(ctx, tx, userID, item.Key, payDate, true); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
