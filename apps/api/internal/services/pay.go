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
	ErrPayTooEarly        = errors.New("Pay can be recorded early only within a week of payday")
)

// earlyPayDays is how long before payday the salary can be recorded early.
const earlyPayDays = 7

const (
	salaryCategory    = "Salary"
	allowanceCategory = "Allowance"
)

// regularIncomeKey identifies an allowance across edits to its amount or day.
func regularIncomeKey(name string) string {
	return "income:" + strings.ToLower(strings.TrimSpace(name))
}

func salaryItem(settings *models.PaySettings, payday Payday) models.PayItem {
	return models.PayItem{
		Key:       models.PayItemSalary,
		Name:      salaryCategory,
		Kind:      models.PayItemSalary,
		Amount:    settings.SalaryPerPayday,
		Date:      FormatDay(payday.Date),
		PayDate:   FormatDay(payday.Scheduled),
		AccountID: settings.SalaryAccountID,
	}
}

func hasSalaryItem(settings *models.PaySettings) bool {
	return payScheduleOf(settings) == PayScheduleSemiMonthly && settings.SalaryPerPayday > 0
}

// payItemsInPeriod lists the salary and allowances due within a pay period.
// Irregular pay has no fixed payday, so only allowances are listed.
func payItemsInPeriod(settings *models.PaySettings, period PayPeriod) []models.PayItem {
	items := make([]models.PayItem, 0)
	if hasSalaryItem(settings) {
		items = append(items, salaryItem(settings, period.Opening))
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
				PayDate:   expected.PayDate,
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

// earlyStart is the day the salary for payday was actually received, when it
// was recorded before payday.
func (s *BillService) earlyStart(ctx context.Context, userID string, payday Payday) (time.Time, bool, error) {
	var received time.Time
	err := s.db.QueryRow(ctx,
		`SELECT received_on FROM pay_records
		 WHERE user_id = $1 AND item_key = $2 AND pay_date = $3 AND received_on IS NOT NULL AND received_on < $4`,
		userID, models.PayItemSalary, FormatDay(payday.Scheduled), FormatDay(payday.Date)).Scan(&received)
	if errors.Is(err, pgx.ErrNoRows) {
		return time.Time{}, false, nil
	}
	return received, err == nil, err
}

// effectivePeriod is the pay period today falls in, starting on the day the
// salary actually came when it came early. Recording the next salary early
// starts the next period that day; deleting that income undoes it.
func (s *BillService) effectivePeriod(ctx context.Context, userID string, settings *models.PaySettings, today time.Time) (PayPeriod, error) {
	schedule := payScheduleOf(settings)
	period := CurrentPayPeriod(schedule, today)
	if schedule != PayScheduleSemiMonthly {
		return period, nil
	}

	received, early, err := s.earlyStart(ctx, userID, period.Closing)
	if err != nil {
		return period, err
	}
	if early && !received.After(today) {
		next := PeriodAfter(schedule, period)
		next.Start = received
		return next, nil
	}

	// Paid early last time: this period began when the money came.
	received, early, err = s.earlyStart(ctx, userID, period.Opening)
	if err != nil {
		return period, err
	}
	if early {
		period.Start = received
	}
	return period, nil
}

// earlyPay is the next salary while it can still be recorded before payday.
func (s *BillService) earlyPay(ctx context.Context, userID string, settings *models.PaySettings, period PayPeriod, today time.Time) (*models.PayItem, error) {
	if !hasSalaryItem(settings) || DaysBetween(today, period.Closing.Date) > earlyPayDays {
		return nil, nil
	}
	var recorded bool
	err := s.db.QueryRow(ctx,
		`SELECT EXISTS (SELECT 1 FROM pay_records WHERE user_id = $1 AND item_key = $2 AND pay_date = $3)`,
		userID, models.PayItemSalary, FormatDay(period.Closing.Scheduled)).Scan(&recorded)
	if err != nil || recorded {
		return nil, err
	}
	item := salaryItem(settings, period.Closing)
	return &item, nil
}

// PendingPay lists the pay due so far this period that hasn't been recorded,
// and what comes after today through the next period. Salary recorded early
// counts as recorded, so it's left out.
func (s *BillService) PendingPay(ctx context.Context, userID string, today time.Time) (*models.PendingPay, error) {
	settings, err := s.GetSettings(ctx, userID)
	if err != nil {
		return nil, err
	}
	schedule := payScheduleOf(settings)
	period := CurrentPayPeriod(schedule, today)
	next := PeriodAfter(schedule, period)

	recorded, err := s.recordedPay(ctx, userID, period.Start)
	if err != nil {
		return nil, err
	}

	result := &models.PendingPay{Pending: make([]models.PayItem, 0), Upcoming: make([]models.PayItem, 0)}
	todayText := FormatDay(today)
	items := append(payItemsInPeriod(settings, period), payItemsInPeriod(settings, next)...)
	for _, item := range items {
		if recorded[item.Key+"|"+item.PayDate] {
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

// findPayItem checks that key is due on payDate, which is either the date
// it's scheduled for or the working day it moved to (sent by older app
// versions). A date moved back can sit in the period before the scheduled
// date's, so both are checked.
func findPayItem(settings *models.PaySettings, key string, payDate time.Time) (*models.PayItem, error) {
	date := FormatDay(payDate)
	schedule := payScheduleOf(settings)
	period := CurrentPayPeriod(schedule, payDate)
	previous := CurrentPayPeriod(schedule, period.Start.AddDate(0, 0, -1))
	for _, item := range append(payItemsInPeriod(settings, period), payItemsInPeriod(settings, previous)...) {
		if item.Key == key && (item.PayDate == date || item.Date == date) {
			return &item, nil
		}
	}
	return nil, ErrNotAPayItem
}

// claimPay marks the pay as recorded under its scheduled date. The unique key
// makes a second tap, or a retried request, fail instead of adding the income
// twice. receivedOn is the day the money came, or nil when skipped.
func claimPay(ctx context.Context, tx pgx.Tx, userID string, item *models.PayItem, receivedOn *string, skipped bool) (string, error) {
	var recordID string
	err := tx.QueryRow(ctx,
		`INSERT INTO pay_records (user_id, item_key, pay_date, received_on, skipped) VALUES ($1, $2, $3, $4, $5)
		 ON CONFLICT (user_id, item_key, pay_date) DO NOTHING RETURNING id`,
		userID, item.Key, item.PayDate, receivedOn, skipped,
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
	received, err := ParseDay(req.Date)
	if err != nil {
		return nil, ErrNotAPayItem
	}
	if due, _ := ParseDay(item.Date); DaysBetween(received, due) > earlyPayDays {
		return nil, ErrPayTooEarly
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
	recordID, err := claimPay(ctx, tx, userID, item, &req.Date, false)
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
	if _, err := claimPay(ctx, tx, userID, item, nil, true); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
