package services

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"sort"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"github.com/Lorredo/fintrack/api/internal/database"
	"github.com/Lorredo/fintrack/api/internal/models"
)

var (
	ErrBillNotFound     = errors.New("Bill not found")
	ErrWalletNotFound   = errors.New("Wallet not found")
	ErrBillAlreadyPaid  = errors.New("This due date is already paid or skipped")
	ErrNotADueDate      = errors.New("That date isn't one of this bill's due dates")
	ErrBillNeedsWallet  = errors.New("Choose a wallet to pay this bill from")
	ErrNothingToUpdate  = errors.New("No fields to update")
	ErrBadRegularIncome = errors.New("Each regular income needs a day of the month (1-31), or which weekday (first to last)")
	ErrDuplicateIncome  = errors.New("Each regular income needs its own name")
	errNoTransactionAPI = errors.New("database does not support transactions")
)

// Bills shown as "due soon" within this many days.
const dueSoonDays = 3

type BillService struct {
	db database.Querier
}

func NewBillService(db database.Querier) *BillService {
	if db == nil {
		db = database.Pool
	}
	return &BillService{db: db}
}

// IsInvalidID reports a malformed UUID in a query, which can't match a row.
func IsInvalidID(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "22P02"
}

type txBeginner interface {
	Begin(ctx context.Context) (pgx.Tx, error)
}

const billColumns = `id, account_id, name, category, amount, frequency, start_date, remind_days_before, active, notes, created_at, updated_at`

func scanBill(row pgx.Row) (*models.Bill, time.Time, error) {
	var b models.Bill
	var start time.Time
	err := row.Scan(&b.ID, &b.AccountID, &b.Name, &b.Category, &b.Amount, &b.Frequency, &start,
		&b.RemindDaysBefore, &b.Active, &b.Notes, &b.CreatedAt, &b.UpdatedAt)
	if err != nil {
		return nil, time.Time{}, err
	}
	start = dayOf(start.Year(), start.Month(), start.Day())
	b.StartDate = FormatDay(start)
	return &b, start, nil
}

// paidDates maps each bill to the due dates already paid or skipped.
func (s *BillService) paidDates(ctx context.Context, userID string) (map[string]map[string]bool, error) {
	rows, err := s.db.Query(ctx, `SELECT bill_id, due_date FROM bill_payments WHERE user_id = $1`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	paid := map[string]map[string]bool{}
	for rows.Next() {
		var billID string
		var due time.Time
		if err := rows.Scan(&billID, &due); err != nil {
			return nil, err
		}
		if paid[billID] == nil {
			paid[billID] = map[string]bool{}
		}
		paid[billID][FormatDay(dayOf(due.Year(), due.Month(), due.Day()))] = true
	}
	return paid, rows.Err()
}

// unpaidDueDates lists due dates up to and including until that have no
// payment.
func unpaidDueDates(start time.Time, frequency string, paid map[string]bool, until time.Time) []time.Time {
	var dates []time.Time
	for _, date := range Occurrences(start, frequency, until) {
		if !paid[FormatDay(date)] {
			dates = append(dates, date)
		}
	}
	return dates
}

// nextUnpaidDueDate is the earliest due date with no payment. Among the first
// len(paid)+1 due dates at least one is unpaid, so the loop always ends.
func nextUnpaidDueDate(start time.Time, frequency string, paid map[string]bool) time.Time {
	for n := 0; ; n++ {
		date := Occurrence(start, frequency, n)
		if !paid[FormatDay(date)] {
			return date
		}
	}
}

func isDueDate(start time.Time, frequency string, date time.Time) bool {
	occurrences := Occurrences(start, frequency, date)
	return len(occurrences) > 0 && occurrences[len(occurrences)-1].Equal(date)
}

// describe fills in the fields that depend on today.
func describe(b *models.Bill, start time.Time, paid map[string]bool, today time.Time) {
	next := nextUnpaidDueDate(start, b.Frequency, paid)
	b.NextDue = FormatDay(next)
	b.DaysUntil = DaysBetween(today, next)
	b.OverdueCount = len(unpaidDueDates(start, b.Frequency, paid, today.AddDate(0, 0, -1)))

	switch {
	case !b.Active:
		b.Status = models.BillStatusPaused
	case b.OverdueCount > 0:
		b.Status = models.BillStatusOverdue
	case b.DaysUntil <= dueSoonDays:
		b.Status = models.BillStatusDueSoon
	default:
		b.Status = models.BillStatusUpcoming
	}
}

func (s *BillService) List(ctx context.Context, userID string, today time.Time) ([]models.Bill, error) {
	paid, err := s.paidDates(ctx, userID)
	if err != nil {
		return nil, err
	}

	rows, err := s.db.Query(ctx, `SELECT `+billColumns+` FROM bills WHERE user_id = $1`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	bills := make([]models.Bill, 0)
	for rows.Next() {
		b, start, err := scanBill(rows)
		if err != nil {
			return nil, err
		}
		describe(b, start, paid[b.ID], today)
		bills = append(bills, *b)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	// Active bills first, then the soonest due.
	sort.SliceStable(bills, func(i, j int) bool {
		if bills[i].Active != bills[j].Active {
			return bills[i].Active
		}
		if bills[i].NextDue != bills[j].NextDue {
			return bills[i].NextDue < bills[j].NextDue
		}
		return bills[i].Name < bills[j].Name
	})
	return bills, nil
}

func (s *BillService) Get(ctx context.Context, userID, id string, today time.Time) (*models.Bill, error) {
	b, start, err := scanBill(s.db.QueryRow(ctx, `SELECT `+billColumns+` FROM bills WHERE id = $1 AND user_id = $2`, id, userID))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrBillNotFound
	}
	if err != nil {
		return nil, err
	}
	paid, err := s.paidDates(ctx, userID)
	if err != nil {
		return nil, err
	}
	describe(b, start, paid[b.ID], today)
	return b, nil
}

func ownsWallet(ctx context.Context, q database.Querier, userID, accountID string) error {
	var exists bool
	err := q.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM accounts WHERE id = $1 AND user_id = $2)`, accountID, userID).Scan(&exists)
	if IsInvalidID(err) {
		return ErrWalletNotFound
	}
	if err != nil {
		return err
	}
	if !exists {
		return ErrWalletNotFound
	}
	return nil
}

func (s *BillService) Create(ctx context.Context, userID string, req models.CreateBillRequest, today time.Time) (*models.Bill, error) {
	if req.AccountID != nil && *req.AccountID == "" {
		req.AccountID = nil
	}
	if req.AccountID != nil {
		if err := ownsWallet(ctx, s.db, userID, *req.AccountID); err != nil {
			return nil, err
		}
	}
	category := strings.TrimSpace(req.Category)
	if category == "" {
		category = "Bills & Utilities"
	}
	remind := 1
	if req.RemindDaysBefore != nil {
		remind = *req.RemindDaysBefore
	}

	var id string
	err := s.db.QueryRow(ctx,
		`INSERT INTO bills (user_id, account_id, name, category, amount, frequency, start_date, remind_days_before, notes)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
		userID, req.AccountID, strings.TrimSpace(req.Name), category, req.Amount, req.Frequency, req.StartDate, remind, req.Notes,
	).Scan(&id)
	if err != nil {
		return nil, err
	}
	return s.Get(ctx, userID, id, today)
}

func (s *BillService) Update(ctx context.Context, userID, id string, req models.UpdateBillRequest, today time.Time) (*models.Bill, error) {
	set := []string{}
	args := []interface{}{}
	add := func(column string, value interface{}) {
		args = append(args, value)
		set = append(set, fmt.Sprintf("%s = $%d", column, len(args)))
	}

	if req.AccountID != nil {
		if *req.AccountID == "" {
			add("account_id", nil)
		} else {
			if err := ownsWallet(ctx, s.db, userID, *req.AccountID); err != nil {
				return nil, err
			}
			add("account_id", *req.AccountID)
		}
	}
	if req.Name != nil {
		add("name", strings.TrimSpace(*req.Name))
	}
	if req.Category != nil {
		add("category", strings.TrimSpace(*req.Category))
	}
	if req.Amount != nil {
		add("amount", *req.Amount)
	}
	if req.Frequency != nil {
		add("frequency", *req.Frequency)
	}
	if req.StartDate != nil {
		add("start_date", *req.StartDate)
	}
	if req.RemindDaysBefore != nil {
		add("remind_days_before", *req.RemindDaysBefore)
	}
	if req.Active != nil {
		add("active", *req.Active)
	}
	if req.Notes != nil {
		add("notes", *req.Notes)
	}
	if len(set) == 0 {
		return nil, ErrNothingToUpdate
	}

	args = append(args, id, userID)
	tag, err := s.db.Exec(ctx, fmt.Sprintf(
		`UPDATE bills SET %s, updated_at = NOW() WHERE id = $%d AND user_id = $%d`,
		strings.Join(set, ", "), len(args)-1, len(args),
	), args...)
	if err != nil {
		return nil, err
	}
	if tag.RowsAffected() == 0 {
		return nil, ErrBillNotFound
	}
	return s.Get(ctx, userID, id, today)
}

func (s *BillService) Delete(ctx context.Context, userID, id string) error {
	tag, err := s.db.Exec(ctx, `DELETE FROM bills WHERE id = $1 AND user_id = $2`, id, userID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrBillNotFound
	}
	return nil
}

func (s *BillService) begin(ctx context.Context) (pgx.Tx, error) {
	beginner, ok := s.db.(txBeginner)
	if !ok {
		return nil, errNoTransactionAPI
	}
	return beginner.Begin(ctx)
}

// lockBill reads the bill inside tx and checks that dueDate is one of its due
// dates.
func lockBill(ctx context.Context, tx pgx.Tx, userID, id string, dueDate time.Time) (*models.Bill, error) {
	b, start, err := scanBill(tx.QueryRow(ctx, `SELECT `+billColumns+` FROM bills WHERE id = $1 AND user_id = $2 FOR UPDATE`, id, userID))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrBillNotFound
	}
	if err != nil {
		return nil, err
	}
	if !isDueDate(start, b.Frequency, dueDate) {
		return nil, ErrNotADueDate
	}
	return b, nil
}

// recordPayment claims the due date. The unique (bill_id, due_date) key makes
// a second tap, or a retried request, fail instead of paying twice.
func recordPayment(ctx context.Context, tx pgx.Tx, userID, billID string, dueDate time.Time, skipped bool) (string, error) {
	var paymentID string
	err := tx.QueryRow(ctx,
		`INSERT INTO bill_payments (bill_id, user_id, due_date, skipped) VALUES ($1, $2, $3, $4)
		 ON CONFLICT (bill_id, due_date) DO NOTHING RETURNING id`,
		billID, userID, FormatDay(dueDate), skipped,
	).Scan(&paymentID)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", ErrBillAlreadyPaid
	}
	return paymentID, err
}

// Pay records the expense and marks the due date paid, together or not at all.
func (s *BillService) Pay(ctx context.Context, userID, id string, req models.PayBillRequest) (*models.Transaction, error) {
	dueDate, err := ParseDay(req.DueDate)
	if err != nil {
		return nil, ErrNotADueDate
	}

	tx, err := s.begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	b, err := lockBill(ctx, tx, userID, id, dueDate)
	if err != nil {
		return nil, err
	}

	accountID := b.AccountID
	if req.AccountID != nil && *req.AccountID != "" {
		accountID = req.AccountID
	}
	if accountID == nil {
		return nil, ErrBillNeedsWallet
	}
	if err := ownsWallet(ctx, tx, userID, *accountID); err != nil {
		return nil, err
	}
	amount := b.Amount
	if req.Amount != nil {
		amount = *req.Amount
	}

	paymentID, err := recordPayment(ctx, tx, userID, b.ID, dueDate, false)
	if err != nil {
		return nil, err
	}

	description := b.Name
	transaction, err := CreateTransaction(ctx, tx, userID, models.CreateTransactionRequest{
		AccountID:   *accountID,
		Type:        models.TransactionTypeExpense,
		Amount:      amount,
		Category:    b.Category,
		Description: &description,
		Date:        req.Date,
	})
	if err != nil {
		return nil, err
	}

	if _, err := tx.Exec(ctx, `UPDATE bill_payments SET transaction_id = $1 WHERE id = $2`, transaction.ID, paymentID); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return transaction, nil
}

// Skip marks a due date as not needing payment, such as a month with no bill.
func (s *BillService) Skip(ctx context.Context, userID, id string, req models.SkipBillRequest) error {
	dueDate, err := ParseDay(req.DueDate)
	if err != nil {
		return ErrNotADueDate
	}

	tx, err := s.begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	b, err := lockBill(ctx, tx, userID, id, dueDate)
	if err != nil {
		return err
	}
	if _, err := recordPayment(ctx, tx, userID, b.ID, dueDate, true); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

const settingsColumns = `pay_schedule, savings_per_payday, bill_reminders, salary_per_payday, extra_to_savings_percent, regular_incomes, salary_account_id`

func scanSettings(row pgx.Row) (*models.PaySettings, error) {
	var settings models.PaySettings
	var incomes []byte
	err := row.Scan(&settings.PaySchedule, &settings.SavingsPerPayday, &settings.BillReminders,
		&settings.SalaryPerPayday, &settings.ExtraToSavingsPercent, &incomes, &settings.SalaryAccountID)
	if err != nil {
		return nil, err
	}
	settings.RegularIncomes = make([]models.RegularIncome, 0)
	if len(incomes) > 0 {
		if err := json.Unmarshal(incomes, &settings.RegularIncomes); err != nil {
			return nil, err
		}
	}
	return &settings, nil
}

// cleanRegularIncomes checks the fields each kind needs and clears the
// others, so stored items are unambiguous.
func cleanRegularIncomes(incomes []models.RegularIncome) ([]models.RegularIncome, error) {
	cleaned := make([]models.RegularIncome, 0, len(incomes))
	names := make(map[string]bool)
	for _, income := range incomes {
		income.Name = strings.TrimSpace(income.Name)
		// The name keys its Record pay history, so it must be unique.
		if key := regularIncomeKey(income.Name); names[key] {
			return nil, ErrDuplicateIncome
		} else {
			names[key] = true
		}
		if income.AccountID != nil && *income.AccountID == "" {
			income.AccountID = nil
		}
		switch income.Kind {
		case models.RegularIncomeByDay:
			if income.Day < 1 || income.Day > 31 {
				return nil, ErrBadRegularIncome
			}
			income.Nth, income.Weekday = 0, 0
		case models.RegularIncomeByWeekday:
			if income.Nth < 1 || income.Nth > 5 {
				return nil, ErrBadRegularIncome
			}
			income.Day = 0
		default:
			return nil, ErrBadRegularIncome
		}
		income.Amount = round2(income.Amount)
		cleaned = append(cleaned, income)
	}
	return cleaned, nil
}

func (s *BillService) GetSettings(ctx context.Context, userID string) (*models.PaySettings, error) {
	return scanSettings(s.db.QueryRow(ctx, `SELECT `+settingsColumns+` FROM users WHERE id = $1`, userID))
}

func (s *BillService) UpdateSettings(ctx context.Context, userID string, req models.UpdatePaySettingsRequest) (*models.PaySettings, error) {
	var incomes []byte
	if req.RegularIncomes != nil {
		cleaned, err := cleanRegularIncomes(*req.RegularIncomes)
		if err != nil {
			return nil, err
		}
		for _, income := range cleaned {
			if income.AccountID != nil {
				if err := ownsWallet(ctx, s.db, userID, *income.AccountID); err != nil {
					return nil, err
				}
			}
		}
		if incomes, err = json.Marshal(cleaned); err != nil {
			return nil, err
		}
	}
	if req.SalaryAccountID != nil && *req.SalaryAccountID != "" {
		if err := ownsWallet(ctx, s.db, userID, *req.SalaryAccountID); err != nil {
			return nil, err
		}
	}
	// A nil []byte is sent as NULL, which keeps the stored list.
	var incomesParam interface{}
	if incomes != nil {
		incomesParam = string(incomes)
	}
	return scanSettings(s.db.QueryRow(ctx,
		`UPDATE users SET
			pay_schedule = COALESCE($2::varchar, pay_schedule),
			savings_per_payday = COALESCE($3::numeric, savings_per_payday),
			bill_reminders = COALESCE($4::boolean, bill_reminders),
			salary_per_payday = COALESCE($5::numeric, salary_per_payday),
			extra_to_savings_percent = COALESCE($6::smallint, extra_to_savings_percent),
			regular_incomes = COALESCE($7::jsonb, regular_incomes),
			salary_account_id = CASE
				WHEN $8::text IS NULL THEN salary_account_id
				WHEN $8::text = '' THEN NULL
				ELSE $8::uuid
			END,
			updated_at = NOW()
		 WHERE id = $1
		 RETURNING `+settingsColumns,
		userID, req.PaySchedule, req.SavingsPerPayday, req.BillReminders, req.SalaryPerPayday, req.ExtraToSavingsPercent, incomesParam, req.SalaryAccountID,
	))
}

func round2(value float64) float64 {
	return math.Round(value*100) / 100
}

// sumInPeriod adds up one kind of transaction from counted wallets dated
// within [start, end). Bill payments are left out, since bills are planned
// for separately.
func (s *BillService) sumInPeriod(ctx context.Context, userID, txType string, start, end time.Time) (float64, error) {
	var total float64
	err := s.db.QueryRow(ctx, `
		SELECT COALESCE(SUM(t.amount), 0)
		FROM transactions t
		JOIN accounts a ON a.id = t.account_id
		WHERE t.user_id = $1 AND t.type = $2 AND a.in_safe_to_spend
			AND t.date >= $3 AND t.date < $4
			AND NOT EXISTS (SELECT 1 FROM bill_payments bp WHERE bp.transaction_id = t.id)`,
		userID, txType, FormatDay(start), FormatDay(end)).Scan(&total)
	return total, err
}

// SafeToSpend works out what can be spent each day until the next payday.
//
// With a salary set, it plans from this period's pay: pay, minus every bill
// due this period, minus savings (plus a share of any income above the
// salary), minus what has been spent since payday. That plan is capped by the
// balance-based amount, so it never suggests money the wallets don't hold.
//
// Without a salary, it is the balance-based amount: counted wallets, minus
// unpaid bills before payday and the savings still to set aside.
func (s *BillService) SafeToSpend(ctx context.Context, userID string, today time.Time) (*models.SafeToSpend, error) {
	settings, err := s.GetSettings(ctx, userID)
	if err != nil {
		return nil, err
	}

	result := &models.SafeToSpend{
		Configured:    settings.PaySchedule != nil,
		PaySchedule:   settings.PaySchedule,
		Today:         FormatDay(today),
		Mode:          "balance",
		Bills:         make([]models.ReservedBill, 0),
		PeriodBills:   make([]models.ReservedBill, 0),
		RegularIncome: make([]models.ExpectedIncome, 0),
	}

	// Transfers between two counted wallets cancel out here, since each side
	// is joined once.
	err = s.db.QueryRow(ctx, `
		SELECT COALESCE(SUM(
			CASE
				WHEN t.type IN ('income', 'adjust_in', 'loan_in') AND t.account_id = a.id THEN t.amount
				WHEN t.type IN ('expense', 'adjust_out', 'loan_out') AND t.account_id = a.id THEN -t.amount
				WHEN t.type = 'transfer' AND t.account_id = a.id THEN -t.amount
				WHEN t.type = 'transfer' AND t.transfer_account_id = a.id THEN t.amount
				ELSE 0
			END
		), 0)
		FROM accounts a
		JOIN transactions t ON (t.account_id = a.id OR t.transfer_account_id = a.id)
		WHERE a.user_id = $1 AND a.in_safe_to_spend`, userID).Scan(&result.Balance)
	if err != nil {
		return nil, err
	}

	schedule := PayScheduleIrregular
	if settings.PaySchedule != nil {
		schedule = *settings.PaySchedule
	}
	period := CurrentPayPeriod(schedule, today)
	result.PeriodStart = FormatDay(period.Start)
	result.NextPayday = FormatDay(period.NextPayday)
	result.DaysLeft = DaysBetween(today, period.NextPayday)

	paid, err := s.paidDates(ctx, userID)
	if err != nil {
		return nil, err
	}
	rows, err := s.db.Query(ctx, `SELECT `+billColumns+` FROM bills WHERE user_id = $1 AND active`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	lastDay := period.NextPayday.AddDate(0, 0, -1)
	beforePeriod := period.Start.AddDate(0, 0, -1)
	for rows.Next() {
		b, start, err := scanBill(rows)
		if err != nil {
			return nil, err
		}
		reserve := func(list *[]models.ReservedBill, total *float64, due time.Time) {
			*total += b.Amount
			*list = append(*list, models.ReservedBill{
				BillID: b.ID, Name: b.Name, DueDate: FormatDay(due), Amount: b.Amount, Overdue: due.Before(today),
			})
		}

		// Balance: bills still to pay before payday.
		for _, due := range unpaidDueDates(start, b.Frequency, paid[b.ID], lastDay) {
			reserve(&result.Bills, &result.BillsReserved, due)
		}
		// Salary plan: every bill this period comes out of this pay, paid or
		// not, plus unpaid ones carried over from before.
		for _, due := range unpaidDueDates(start, b.Frequency, paid[b.ID], beforePeriod) {
			reserve(&result.PeriodBills, &result.BillsThisPeriod, due)
		}
		for _, due := range Occurrences(start, b.Frequency, lastDay) {
			if !due.Before(period.Start) {
				reserve(&result.PeriodBills, &result.BillsThisPeriod, due)
			}
		}
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	// Paluwagan contributions and utang the user owes are set aside like bills.
	unpaidCommitments, periodCommitments, err := commitmentsForPeriod(ctx, s.db, userID, period, today)
	if err != nil {
		return nil, err
	}
	for _, item := range unpaidCommitments {
		result.Bills = append(result.Bills, item)
		result.BillsReserved += item.Amount
	}
	for _, item := range periodCommitments {
		result.PeriodBills = append(result.PeriodBills, item)
		result.BillsThisPeriod += item.Amount
	}

	sort.SliceStable(result.Bills, func(i, j int) bool { return result.Bills[i].DueDate < result.Bills[j].DueDate })
	sort.SliceStable(result.PeriodBills, func(i, j int) bool { return result.PeriodBills[i].DueDate < result.PeriodBills[j].DueDate })

	// Regular income (allowances) is expected pay, like the salary, so only
	// income above both counts as extra.
	result.RegularIncome = RegularIncomeInPeriod(settings.RegularIncomes, period)
	result.ExpectedPay = settings.SalaryPerPayday
	for _, income := range result.RegularIncome {
		result.ExpectedPay += income.Amount
	}

	salaryMode := settings.SalaryPerPayday > 0 || len(settings.RegularIncomes) > 0
	if salaryMode {
		result.Mode = "salary"
		result.Salary = settings.SalaryPerPayday
		if result.IncomeRecorded, err = s.sumInPeriod(ctx, userID, "income", period.Start, period.NextPayday); err != nil {
			return nil, err
		}
		if result.SpentSincePayday, err = s.sumInPeriod(ctx, userID, "expense", period.Start, period.NextPayday); err != nil {
			return nil, err
		}
		result.PayEstimated = result.IncomeRecorded < result.ExpectedPay
		result.Pay = math.Max(result.IncomeRecorded, result.ExpectedPay)
		result.ExtraIncome = math.Max(result.IncomeRecorded-result.ExpectedPay, 0)
		result.ExtraSaved = round2(result.ExtraIncome * float64(settings.ExtraToSavingsPercent) / 100)
	}

	// Money already moved into a wallet that isn't counted (such as savings)
	// this period has been set aside, so it isn't reserved a second time.
	result.SavingsTarget = settings.SavingsPerPayday + result.ExtraSaved
	if result.SavingsTarget > 0 {
		err = s.db.QueryRow(ctx, `
			SELECT COALESCE(SUM(t.amount), 0)
			FROM transactions t
			JOIN accounts source ON source.id = t.account_id
			JOIN accounts target ON target.id = t.transfer_account_id
			WHERE t.user_id = $1 AND t.type = 'transfer'
				AND source.in_safe_to_spend AND NOT target.in_safe_to_spend
				AND t.date >= $2 AND t.date < $3`,
			userID, FormatDay(period.Start), FormatDay(period.NextPayday)).Scan(&result.SavingsMoved)
		if err != nil {
			return nil, err
		}
		result.SavingsReserved = math.Max(result.SavingsTarget-result.SavingsMoved, 0)
	}

	result.Balance = round2(result.Balance)
	result.BillsReserved = round2(result.BillsReserved)
	result.SavingsTarget = round2(result.SavingsTarget)
	result.SavingsMoved = round2(result.SavingsMoved)
	result.SavingsReserved = round2(result.SavingsReserved)
	result.BalanceLeft = round2(result.Balance - result.BillsReserved - result.SavingsReserved)
	result.Spendable = result.BalanceLeft

	if salaryMode {
		result.IncomeRecorded = round2(result.IncomeRecorded)
		result.ExpectedPay = round2(result.ExpectedPay)
		result.Pay = round2(result.Pay)
		result.ExtraIncome = round2(result.ExtraIncome)
		result.BillsThisPeriod = round2(result.BillsThisPeriod)
		result.SpentSincePayday = round2(result.SpentSincePayday)
		result.SpendingMoney = round2(result.Pay - result.BillsThisPeriod - result.SavingsTarget)
		result.PlannedLeft = round2(result.SpendingMoney - result.SpentSincePayday)
		result.LimitedByBalance = result.BalanceLeft < result.PlannedLeft
		result.Spendable = math.Min(result.PlannedLeft, result.BalanceLeft)
	}

	result.PerDay = round2(result.Spendable / float64(max(result.DaysLeft, 1)))
	return result, nil
}
