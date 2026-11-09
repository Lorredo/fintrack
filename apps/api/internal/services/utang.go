package services

import (
	"context"
	"errors"
	"fmt"
	"math"
	"sort"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/Lorredo/fintrack/api/internal/database"
	"github.com/Lorredo/fintrack/api/internal/models"
)

var (
	ErrDebtNotFound        = errors.New("Utang not found")
	ErrDebtPaymentNotFound = errors.New("Payment not found")
	ErrPaymentTooLarge     = errors.New("That's more than what's left to pay")
	ErrPaluwaganNotFound   = errors.New("Paluwagan not found")
	ErrRoundRecorded       = errors.New("This round is already recorded")
	ErrBadRound            = errors.New("That round isn't part of this paluwagan")
	ErrNotYourTurn         = errors.New("The payout is only for your turn")
	ErrTurnOutOfRange      = errors.New("Your turn must be between 1 and the number of members")
	ErrNeedsWallet         = errors.New("Choose a wallet for this")
)

// UtangService covers utang (money lent or borrowed) and paluwagan, which both
// move wallet money as loan_in and loan_out: real money, but not income or
// spending.
type UtangService struct {
	db database.Querier
}

func NewUtangService(db database.Querier) *UtangService {
	if db == nil {
		db = database.Pool
	}
	return &UtangService{db: db}
}

func (s *UtangService) begin(ctx context.Context) (pgx.Tx, error) {
	beginner, ok := s.db.(txBeginner)
	if !ok {
		return nil, errNoTransactionAPI
	}
	return beginner.Begin(ctx)
}

func dayString(t time.Time) string {
	return FormatDay(dayOf(t.Year(), t.Month(), t.Day()))
}

func optionalDay(t *time.Time) *string {
	if t == nil {
		return nil
	}
	day := dayString(*t)
	return &day
}

// ---------------------------------------------------------------- Utang ----

const debtColumns = `id, person_name, direction, amount, account_id, date, due_date, notes, created_at, updated_at`

func scanDebt(row pgx.Row) (*models.Debt, error) {
	var d models.Debt
	var date time.Time
	var due *time.Time
	if err := row.Scan(&d.ID, &d.PersonName, &d.Direction, &d.Amount, &d.AccountID, &date, &due, &d.Notes, &d.CreatedAt, &d.UpdatedAt); err != nil {
		return nil, err
	}
	d.Date = dayString(date)
	d.DueDate = optionalDay(due)
	d.Payments = make([]models.DebtPayment, 0)
	return &d, nil
}

func (s *UtangService) paymentsByDebt(ctx context.Context, userID string) (map[string][]models.DebtPayment, error) {
	rows, err := s.db.Query(ctx,
		`SELECT debt_id, id, amount, date, account_id, transaction_id FROM debt_payments WHERE user_id = $1 ORDER BY date, created_at`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	payments := map[string][]models.DebtPayment{}
	for rows.Next() {
		var debtID string
		var p models.DebtPayment
		var date time.Time
		if err := rows.Scan(&debtID, &p.ID, &p.Amount, &date, &p.AccountID, &p.TransactionID); err != nil {
			return nil, err
		}
		p.Date = dayString(date)
		payments[debtID] = append(payments[debtID], p)
	}
	return payments, rows.Err()
}

func settle(d *models.Debt, payments []models.DebtPayment) {
	if payments != nil {
		d.Payments = payments
	}
	d.Paid = 0
	for _, p := range d.Payments {
		d.Paid += p.Amount
	}
	d.Paid = round2(d.Paid)
	d.Remaining = round2(math.Max(d.Amount-d.Paid, 0))
	d.Settled = d.Remaining == 0
}

func (s *UtangService) ListDebts(ctx context.Context, userID string) (*models.DebtSummary, error) {
	payments, err := s.paymentsByDebt(ctx, userID)
	if err != nil {
		return nil, err
	}
	rows, err := s.db.Query(ctx, `SELECT `+debtColumns+` FROM debts WHERE user_id = $1 ORDER BY date DESC, created_at DESC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	summary := &models.DebtSummary{Debts: make([]models.Debt, 0), People: make([]models.PersonBalance, 0)}
	people := map[string]*models.PersonBalance{}
	for rows.Next() {
		d, err := scanDebt(rows)
		if err != nil {
			return nil, err
		}
		settle(d, payments[d.ID])
		summary.Debts = append(summary.Debts, *d)

		// Names are grouped without regard to case or spacing ("juan " is Juan).
		key := strings.ToLower(strings.Join(strings.Fields(d.PersonName), " "))
		person := people[key]
		if person == nil {
			person = &models.PersonBalance{PersonName: d.PersonName}
			people[key] = person
		}
		if d.Direction == models.DebtLent {
			person.OwedToYou += d.Remaining
			summary.OwedToYou += d.Remaining
		} else {
			person.YouOwe += d.Remaining
			summary.YouOwe += d.Remaining
		}
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	for _, person := range people {
		person.OwedToYou = round2(person.OwedToYou)
		person.YouOwe = round2(person.YouOwe)
		person.Net = round2(person.OwedToYou - person.YouOwe)
		summary.People = append(summary.People, *person)
	}
	sort.Slice(summary.People, func(i, j int) bool {
		a, b := summary.People[i], summary.People[j]
		if (a.Net == 0) != (b.Net == 0) {
			return a.Net != 0
		}
		return strings.ToLower(a.PersonName) < strings.ToLower(b.PersonName)
	})
	summary.OwedToYou = round2(summary.OwedToYou)
	summary.YouOwe = round2(summary.YouOwe)
	return summary, nil
}

func (s *UtangService) GetDebt(ctx context.Context, userID, id string) (*models.Debt, error) {
	d, err := scanDebt(s.db.QueryRow(ctx, `SELECT `+debtColumns+` FROM debts WHERE id = $1 AND user_id = $2`, id, userID))
	if errors.Is(err, pgx.ErrNoRows) || IsInvalidID(err) {
		return nil, ErrDebtNotFound
	}
	if err != nil {
		return nil, err
	}
	payments, err := s.paymentsByDebt(ctx, userID)
	if err != nil {
		return nil, err
	}
	settle(d, payments[d.ID])
	return d, nil
}

// CreateDebt records the utang and the money it moved: lending takes it out
// of the wallet, borrowing puts it in.
func (s *UtangService) CreateDebt(ctx context.Context, userID string, req models.CreateDebtRequest) (*models.Debt, error) {
	name := strings.TrimSpace(req.PersonName)
	tx, err := s.begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	if err := ownsWallet(ctx, tx, userID, req.AccountID); err != nil {
		return nil, err
	}
	txType, description := models.TransactionTypeLoanOut, "Lent to "+name
	if req.Direction == models.DebtBorrowed {
		txType, description = models.TransactionTypeLoanIn, "Borrowed from "+name
	}
	moved, err := CreateTransaction(ctx, tx, userID, models.CreateTransactionRequest{
		AccountID: req.AccountID, Type: txType, Amount: round2(req.Amount), Category: "Utang", Description: &description, Date: req.Date,
	})
	if err != nil {
		return nil, err
	}

	var id string
	err = tx.QueryRow(ctx,
		`INSERT INTO debts (user_id, person_name, direction, amount, account_id, date, due_date, notes, transaction_id)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
		userID, name, req.Direction, round2(req.Amount), req.AccountID, req.Date, req.DueDate, req.Notes, moved.ID,
	).Scan(&id)
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return s.GetDebt(ctx, userID, id)
}

func (s *UtangService) UpdateDebt(ctx context.Context, userID, id string, req models.UpdateDebtRequest) (*models.Debt, error) {
	set := []string{}
	args := []interface{}{}
	add := func(column string, value interface{}) {
		args = append(args, value)
		set = append(set, fmt.Sprintf("%s = $%d", column, len(args)))
	}
	if req.PersonName != nil {
		add("person_name", strings.TrimSpace(*req.PersonName))
	}
	if req.ClearDueDate {
		add("due_date", nil)
	} else if req.DueDate != nil {
		add("due_date", *req.DueDate)
	}
	if req.Notes != nil {
		add("notes", *req.Notes)
	}
	if len(set) == 0 {
		return nil, ErrNothingToUpdate
	}
	args = append(args, id, userID)
	tag, err := s.db.Exec(ctx, fmt.Sprintf(`UPDATE debts SET %s, updated_at = NOW() WHERE id = $%d AND user_id = $%d`,
		strings.Join(set, ", "), len(args)-1, len(args)), args...)
	if IsInvalidID(err) {
		return nil, ErrDebtNotFound
	}
	if err != nil {
		return nil, err
	}
	if tag.RowsAffected() == 0 {
		return nil, ErrDebtNotFound
	}
	return s.GetDebt(ctx, userID, id)
}

// DeleteDebt removes the utang and every transaction it made, so wallet
// balances go back to how they were.
func (s *UtangService) DeleteDebt(ctx context.Context, userID, id string) error {
	tx, err := s.begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var transactionID *string
	err = tx.QueryRow(ctx, `SELECT transaction_id FROM debts WHERE id = $1 AND user_id = $2`, id, userID).Scan(&transactionID)
	if errors.Is(err, pgx.ErrNoRows) || IsInvalidID(err) {
		return ErrDebtNotFound
	}
	if err != nil {
		return err
	}
	if _, err := tx.Exec(ctx,
		`DELETE FROM transactions WHERE user_id = $1 AND id IN (SELECT transaction_id FROM debt_payments WHERE debt_id = $2)`,
		userID, id); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `DELETE FROM debts WHERE id = $1`, id); err != nil {
		return err
	}
	if transactionID != nil {
		if _, err := tx.Exec(ctx, `DELETE FROM transactions WHERE id = $1 AND user_id = $2`, *transactionID, userID); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

// AddDebtPayment records part or all of an utang being paid back. Money comes
// in when someone repays the user, and goes out when the user repays.
func (s *UtangService) AddDebtPayment(ctx context.Context, userID, id string, req models.DebtPaymentRequest) (*models.Debt, error) {
	tx, err := s.begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	d, err := scanDebt(tx.QueryRow(ctx, `SELECT `+debtColumns+` FROM debts WHERE id = $1 AND user_id = $2 FOR UPDATE`, id, userID))
	if errors.Is(err, pgx.ErrNoRows) || IsInvalidID(err) {
		return nil, ErrDebtNotFound
	}
	if err != nil {
		return nil, err
	}
	var paid float64
	if err := tx.QueryRow(ctx, `SELECT COALESCE(SUM(amount), 0) FROM debt_payments WHERE debt_id = $1`, id).Scan(&paid); err != nil {
		return nil, err
	}
	amount := round2(req.Amount)
	if amount > round2(d.Amount-paid)+0.001 {
		return nil, ErrPaymentTooLarge
	}

	accountID := d.AccountID
	if req.AccountID != nil && *req.AccountID != "" {
		accountID = req.AccountID
	}
	if accountID == nil {
		return nil, ErrNeedsWallet
	}
	if err := ownsWallet(ctx, tx, userID, *accountID); err != nil {
		return nil, err
	}

	txType, description := models.TransactionTypeLoanIn, "Paid back by "+d.PersonName
	if d.Direction == models.DebtBorrowed {
		txType, description = models.TransactionTypeLoanOut, "Paid back to "+d.PersonName
	}
	moved, err := CreateTransaction(ctx, tx, userID, models.CreateTransactionRequest{
		AccountID: *accountID, Type: txType, Amount: amount, Category: "Utang", Description: &description, Date: req.Date,
	})
	if err != nil {
		return nil, err
	}
	if _, err := tx.Exec(ctx,
		`INSERT INTO debt_payments (debt_id, user_id, amount, date, account_id, transaction_id) VALUES ($1, $2, $3, $4, $5, $6)`,
		id, userID, amount, req.Date, *accountID, moved.ID); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return s.GetDebt(ctx, userID, id)
}

// DeleteDebtPayment undoes a payment and the money it moved.
func (s *UtangService) DeleteDebtPayment(ctx context.Context, userID, debtID, paymentID string) (*models.Debt, error) {
	tx, err := s.begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var transactionID *string
	err = tx.QueryRow(ctx, `SELECT transaction_id FROM debt_payments WHERE id = $1 AND debt_id = $2 AND user_id = $3`,
		paymentID, debtID, userID).Scan(&transactionID)
	if errors.Is(err, pgx.ErrNoRows) || IsInvalidID(err) {
		return nil, ErrDebtPaymentNotFound
	}
	if err != nil {
		return nil, err
	}
	if _, err := tx.Exec(ctx, `DELETE FROM debt_payments WHERE id = $1`, paymentID); err != nil {
		return nil, err
	}
	if transactionID != nil {
		if _, err := tx.Exec(ctx, `DELETE FROM transactions WHERE id = $1 AND user_id = $2`, *transactionID, userID); err != nil {
			return nil, err
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return s.GetDebt(ctx, userID, debtID)
}

// ------------------------------------------------------------ Paluwagan ----

const paluwaganColumns = `id, name, contribution, frequency, start_date, members, my_turn, payout_amount, account_id, active, created_at, updated_at`

func scanPaluwagan(row pgx.Row) (*models.Paluwagan, time.Time, error) {
	var p models.Paluwagan
	var start time.Time
	err := row.Scan(&p.ID, &p.Name, &p.Contribution, &p.Frequency, &start, &p.Members, &p.MyTurn, &p.PayoutAmount,
		&p.AccountID, &p.Active, &p.CreatedAt, &p.UpdatedAt)
	if err != nil {
		return nil, time.Time{}, err
	}
	start = dayOf(start.Year(), start.Month(), start.Day())
	p.StartDate = FormatDay(start)
	return &p, start, nil
}

type roundPayments struct {
	contributed map[int]float64
	payout      map[int]bool
}

func (s *UtangService) paluwaganPayments(ctx context.Context, q database.Querier, userID string) (map[string]*roundPayments, error) {
	rows, err := q.Query(ctx, `SELECT paluwagan_id, round, kind, amount FROM paluwagan_payments WHERE user_id = $1`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := map[string]*roundPayments{}
	for rows.Next() {
		var id, kind string
		var round int
		var amount float64
		if err := rows.Scan(&id, &round, &kind, &amount); err != nil {
			return nil, err
		}
		if result[id] == nil {
			result[id] = &roundPayments{contributed: map[int]float64{}, payout: map[int]bool{}}
		}
		if kind == "payout" {
			result[id].payout[round] = true
		} else {
			result[id].contributed[round] = amount
		}
	}
	return result, rows.Err()
}

func describePaluwagan(p *models.Paluwagan, start time.Time, paid *roundPayments, today time.Time) {
	if paid == nil {
		paid = &roundPayments{contributed: map[int]float64{}, payout: map[int]bool{}}
	}
	p.Rounds = make([]models.PaluwaganRound, 0, p.Members)
	p.NextContribution = nil
	for n := 1; n <= p.Members; n++ {
		date := PaluwaganRoundDate(start, p.Frequency, n)
		amount, contributed := paid.contributed[n]
		round := models.PaluwaganRound{
			Round: n, Date: FormatDay(date), Contributed: contributed, IsMyTurn: n == p.MyTurn,
			PayoutReceived: paid.payout[n], IsPast: date.Before(today),
		}
		if contributed {
			p.ContributedCount++
			p.TotalContributed += amount
		} else {
			if date.Before(today) {
				p.OverdueCount++
			}
			if p.NextContribution == nil {
				next := round
				p.NextContribution = &next
			}
		}
		if n == p.MyTurn {
			p.MyPayoutDate = FormatDay(date)
		}
		p.Rounds = append(p.Rounds, round)
	}
	p.TotalContributed = round2(p.TotalContributed)
	p.Finished = p.NextContribution == nil && paid.payout[p.MyTurn]
}

func (s *UtangService) ListPaluwagans(ctx context.Context, userID string, today time.Time) ([]models.Paluwagan, error) {
	payments, err := s.paluwaganPayments(ctx, s.db, userID)
	if err != nil {
		return nil, err
	}
	rows, err := s.db.Query(ctx, `SELECT `+paluwaganColumns+` FROM paluwagans WHERE user_id = $1 ORDER BY active DESC, start_date DESC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	list := make([]models.Paluwagan, 0)
	for rows.Next() {
		p, start, err := scanPaluwagan(rows)
		if err != nil {
			return nil, err
		}
		describePaluwagan(p, start, payments[p.ID], today)
		list = append(list, *p)
	}
	return list, rows.Err()
}

func (s *UtangService) GetPaluwagan(ctx context.Context, userID, id string, today time.Time) (*models.Paluwagan, error) {
	p, start, err := scanPaluwagan(s.db.QueryRow(ctx, `SELECT `+paluwaganColumns+` FROM paluwagans WHERE id = $1 AND user_id = $2`, id, userID))
	if errors.Is(err, pgx.ErrNoRows) || IsInvalidID(err) {
		return nil, ErrPaluwaganNotFound
	}
	if err != nil {
		return nil, err
	}
	payments, err := s.paluwaganPayments(ctx, s.db, userID)
	if err != nil {
		return nil, err
	}
	describePaluwagan(p, start, payments[p.ID], today)
	return p, nil
}

func (s *UtangService) CreatePaluwagan(ctx context.Context, userID string, req models.CreatePaluwaganRequest, today time.Time) (*models.Paluwagan, error) {
	if req.MyTurn > req.Members {
		return nil, ErrTurnOutOfRange
	}
	if req.AccountID != nil && *req.AccountID == "" {
		req.AccountID = nil
	}
	if req.AccountID != nil {
		if err := ownsWallet(ctx, s.db, userID, *req.AccountID); err != nil {
			return nil, err
		}
	}
	payout := round2(req.Contribution * float64(req.Members))
	if req.PayoutAmount != nil {
		payout = round2(*req.PayoutAmount)
	}
	var id string
	err := s.db.QueryRow(ctx,
		`INSERT INTO paluwagans (user_id, name, contribution, frequency, start_date, members, my_turn, payout_amount, account_id)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
		userID, strings.TrimSpace(req.Name), round2(req.Contribution), req.Frequency, req.StartDate, req.Members, req.MyTurn, payout, req.AccountID,
	).Scan(&id)
	if err != nil {
		return nil, err
	}
	return s.GetPaluwagan(ctx, userID, id, today)
}

func (s *UtangService) UpdatePaluwagan(ctx context.Context, userID, id string, req models.UpdatePaluwaganRequest, today time.Time) (*models.Paluwagan, error) {
	current, err := s.GetPaluwagan(ctx, userID, id, today)
	if err != nil {
		return nil, err
	}
	set := []string{}
	args := []interface{}{}
	add := func(column string, value interface{}) {
		args = append(args, value)
		set = append(set, fmt.Sprintf("%s = $%d", column, len(args)))
	}
	if req.Name != nil {
		add("name", strings.TrimSpace(*req.Name))
	}
	if req.Contribution != nil {
		add("contribution", round2(*req.Contribution))
	}
	if req.MyTurn != nil {
		if *req.MyTurn > current.Members {
			return nil, ErrTurnOutOfRange
		}
		add("my_turn", *req.MyTurn)
	}
	if req.PayoutAmount != nil {
		add("payout_amount", round2(*req.PayoutAmount))
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
	if req.Active != nil {
		add("active", *req.Active)
	}
	if len(set) == 0 {
		return nil, ErrNothingToUpdate
	}
	args = append(args, id, userID)
	if _, err := s.db.Exec(ctx, fmt.Sprintf(`UPDATE paluwagans SET %s, updated_at = NOW() WHERE id = $%d AND user_id = $%d`,
		strings.Join(set, ", "), len(args)-1, len(args)), args...); err != nil {
		return nil, err
	}
	return s.GetPaluwagan(ctx, userID, id, today)
}

// DeletePaluwagan removes the group and the contributions and payouts it
// recorded.
func (s *UtangService) DeletePaluwagan(ctx context.Context, userID, id string) error {
	tx, err := s.begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if _, err := tx.Exec(ctx,
		`DELETE FROM transactions WHERE user_id = $1 AND id IN (SELECT transaction_id FROM paluwagan_payments WHERE paluwagan_id = $2)`,
		userID, id); err != nil {
		if IsInvalidID(err) {
			return ErrPaluwaganNotFound
		}
		return err
	}
	tag, err := tx.Exec(ctx, `DELETE FROM paluwagans WHERE id = $1 AND user_id = $2`, id, userID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrPaluwaganNotFound
	}
	return tx.Commit(ctx)
}

// recordRound saves a contribution or the payout for one round, with its
// transaction, in one database transaction.
func (s *UtangService) recordRound(ctx context.Context, userID, id, kind string, req models.PaluwaganPaymentRequest, today time.Time) (*models.Paluwagan, error) {
	tx, err := s.begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	p, _, err := scanPaluwagan(tx.QueryRow(ctx, `SELECT `+paluwaganColumns+` FROM paluwagans WHERE id = $1 AND user_id = $2 FOR UPDATE`, id, userID))
	if errors.Is(err, pgx.ErrNoRows) || IsInvalidID(err) {
		return nil, ErrPaluwaganNotFound
	}
	if err != nil {
		return nil, err
	}
	if req.Round > p.Members {
		return nil, ErrBadRound
	}
	if kind == "payout" && req.Round != p.MyTurn {
		return nil, ErrNotYourTurn
	}

	accountID := p.AccountID
	if req.AccountID != nil && *req.AccountID != "" {
		accountID = req.AccountID
	}
	if accountID == nil {
		return nil, ErrNeedsWallet
	}
	if err := ownsWallet(ctx, tx, userID, *accountID); err != nil {
		return nil, err
	}

	amount, txType, label := p.Contribution, models.TransactionTypeLoanOut, "contribution"
	if kind == "payout" {
		amount, txType, label = p.PayoutAmount, models.TransactionTypeLoanIn, "payout"
	}
	if req.Amount != nil {
		amount = round2(*req.Amount)
	}

	var paymentID string
	err = tx.QueryRow(ctx,
		`INSERT INTO paluwagan_payments (paluwagan_id, user_id, round, kind, amount, date) VALUES ($1, $2, $3, $4, $5, $6)
		 ON CONFLICT (paluwagan_id, round, kind) DO NOTHING RETURNING id`,
		id, userID, req.Round, kind, amount, req.Date).Scan(&paymentID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrRoundRecorded
	}
	if err != nil {
		return nil, err
	}

	description := fmt.Sprintf("%s · Round %d %s", p.Name, req.Round, label)
	moved, err := CreateTransaction(ctx, tx, userID, models.CreateTransactionRequest{
		AccountID: *accountID, Type: txType, Amount: amount, Category: "Paluwagan", Description: &description, Date: req.Date,
	})
	if err != nil {
		return nil, err
	}
	if _, err := tx.Exec(ctx, `UPDATE paluwagan_payments SET transaction_id = $1 WHERE id = $2`, moved.ID, paymentID); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return s.GetPaluwagan(ctx, userID, id, today)
}

func (s *UtangService) Contribute(ctx context.Context, userID, id string, req models.PaluwaganPaymentRequest, today time.Time) (*models.Paluwagan, error) {
	return s.recordRound(ctx, userID, id, "contribution", req, today)
}

func (s *UtangService) ReceivePayout(ctx context.Context, userID, id string, req models.PaluwaganPaymentRequest, today time.Time) (*models.Paluwagan, error) {
	return s.recordRound(ctx, userID, id, "payout", req, today)
}

// ------------------------------------------------------ Safe to Spend ----

// commitmentsForPeriod lists money the user has to pay out besides bills:
// paluwagan contributions and utang they owe with a due date. "unpaid" is
// what is still due on or before lastDay (for the balance check); "period"
// is what comes out of this period's pay, paid or not, including unpaid ones
// from before the period.
func commitmentsForPeriod(ctx context.Context, q database.Querier, userID string, period PayPeriod, today time.Time) (unpaid, inPeriod []models.ReservedBill, err error) {
	lastDay := period.NextPayday.AddDate(0, 0, -1)
	unpaid = make([]models.ReservedBill, 0)
	inPeriod = make([]models.ReservedBill, 0)

	utang := &UtangService{db: q}
	payments, err := utang.paluwaganPayments(ctx, q, userID)
	if err != nil {
		return nil, nil, err
	}
	rows, err := q.Query(ctx, `SELECT `+paluwaganColumns+` FROM paluwagans WHERE user_id = $1 AND active`, userID)
	if err != nil {
		return nil, nil, err
	}
	type group struct {
		p     *models.Paluwagan
		start time.Time
	}
	var groups []group
	for rows.Next() {
		p, start, err := scanPaluwagan(rows)
		if err != nil {
			rows.Close()
			return nil, nil, err
		}
		groups = append(groups, group{p, start})
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, nil, err
	}
	for _, g := range groups {
		paid := payments[g.p.ID]
		for n := 1; n <= g.p.Members; n++ {
			due := PaluwaganRoundDate(g.start, g.p.Frequency, n)
			if due.After(lastDay) {
				break
			}
			contributed := false
			if paid != nil {
				_, contributed = paid.contributed[n]
			}
			item := models.ReservedBill{
				BillID: g.p.ID, Name: fmt.Sprintf("%s · Round %d", g.p.Name, n), DueDate: FormatDay(due),
				Amount: g.p.Contribution, Overdue: due.Before(today),
			}
			if !contributed {
				unpaid = append(unpaid, item)
			}
			if !due.Before(period.Start) || !contributed {
				inPeriod = append(inPeriod, item)
			}
		}
	}

	// Utang the user owes, with a due date up to the day before payday.
	debtRows, err := q.Query(ctx, `
		SELECT d.id, d.person_name, d.amount, d.due_date,
			COALESCE((SELECT SUM(amount) FROM debt_payments p WHERE p.debt_id = d.id), 0),
			COALESCE((SELECT SUM(amount) FROM debt_payments p WHERE p.debt_id = d.id AND p.date >= $2), 0)
		FROM debts d
		WHERE d.user_id = $1 AND d.direction = 'borrowed' AND d.due_date IS NOT NULL AND d.due_date <= $3`,
		userID, FormatDay(period.Start), FormatDay(lastDay))
	if err != nil {
		return nil, nil, err
	}
	defer debtRows.Close()
	for debtRows.Next() {
		var id, name string
		var amount, paid, paidThisPeriod float64
		var due time.Time
		if err := debtRows.Scan(&id, &name, &amount, &due, &paid, &paidThisPeriod); err != nil {
			return nil, nil, err
		}
		due = dayOf(due.Year(), due.Month(), due.Day())
		remaining := round2(math.Max(amount-paid, 0))
		label := "Utang to " + name
		if remaining > 0 {
			unpaid = append(unpaid, models.ReservedBill{BillID: id, Name: label, DueDate: FormatDay(due), Amount: remaining, Overdue: due.Before(today)})
		}
		// This pay covers what's left plus what was already paid back this period.
		if planned := round2(remaining + paidThisPeriod); planned > 0 {
			inPeriod = append(inPeriod, models.ReservedBill{BillID: id, Name: label, DueDate: FormatDay(due), Amount: planned, Overdue: due.Before(today)})
		}
	}
	return unpaid, inPeriod, debtRows.Err()
}
