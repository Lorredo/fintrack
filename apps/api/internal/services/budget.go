package services

import (
	"context"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/Lorredo/fintrack/api/internal/database"
	"github.com/Lorredo/fintrack/api/internal/models"
)

type BudgetService struct {
	db database.Querier
}

func NewBudgetService(db database.Querier) *BudgetService {
	if db == nil {
		db = database.Pool
	}
	return &BudgetService{db: db}
}

func (s *BudgetService) List(ctx context.Context, userID, targetDate string) ([]models.Budget, error) {
	var rows pgx.Rows
	var err error

	if targetDate != "" {
		rows, err = s.db.Query(
			ctx,
			`SELECT b.id, b.user_id, b.category, b.amount, b.period_type, TO_CHAR(b.start_date, 'YYYY-MM-DD'), TO_CHAR(b.end_date, 'YYYY-MM-DD'), b.created_at, b.updated_at,
				COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END), 0) as spent
				FROM budgets b
				LEFT JOIN transactions t ON b.user_id = t.user_id AND b.category = t.category
					AND t.date >= b.start_date AND t.date <= b.end_date
				WHERE b.user_id = $1 AND b.start_date <= $2::DATE AND b.end_date >= $2::DATE
				GROUP BY b.id, b.user_id, b.category, b.amount, b.period_type, b.start_date, b.end_date, b.created_at, b.updated_at
				ORDER BY b.end_date ASC, b.category ASC`,
			userID, targetDate,
		)
	} else {
		rows, err = s.db.Query(
			ctx,
			`SELECT b.id, b.user_id, b.category, b.amount, b.period_type, TO_CHAR(b.start_date, 'YYYY-MM-DD'), TO_CHAR(b.end_date, 'YYYY-MM-DD'), b.created_at, b.updated_at,
				COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END), 0) as spent
				FROM budgets b
				LEFT JOIN transactions t ON b.user_id = t.user_id AND b.category = t.category
					AND t.date >= b.start_date AND t.date <= b.end_date
				WHERE b.user_id = $1
				GROUP BY b.id, b.user_id, b.category, b.amount, b.period_type, b.start_date, b.end_date, b.created_at, b.updated_at
				ORDER BY b.end_date DESC, b.category ASC`,
			userID,
		)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	budgets := make([]models.Budget, 0)
	for rows.Next() {
		var b models.Budget
		if err := rows.Scan(&b.ID, &b.UserID, &b.Category, &b.Amount, &b.PeriodType, &b.StartDate, &b.EndDate, &b.CreatedAt, &b.UpdatedAt, &b.Spent); err != nil {
			return nil, err
		}
		b.Remaining = b.Amount - b.Spent
		budgets = append(budgets, b)
	}
	return budgets, nil
}

func (s *BudgetService) Get(ctx context.Context, id, userID string) (*models.Budget, error) {
	var b models.Budget
	err := s.db.QueryRow(
		ctx,
		`SELECT id, user_id, category, amount, period_type, TO_CHAR(start_date, 'YYYY-MM-DD'), TO_CHAR(end_date, 'YYYY-MM-DD'), created_at, updated_at
		 FROM budgets WHERE id = $1 AND user_id = $2`,
		id, userID,
	).Scan(&b.ID, &b.UserID, &b.Category, &b.Amount, &b.PeriodType, &b.StartDate, &b.EndDate, &b.CreatedAt, &b.UpdatedAt)

	if err != nil {
		return nil, err
	}

	err = s.db.QueryRow(
		ctx,
		`SELECT COALESCE(SUM(amount), 0) FROM transactions
		 WHERE user_id = $1 AND category = $2 AND type = 'expense'
		 AND date >= $3::DATE AND date <= $4::DATE`,
		userID, b.Category, b.StartDate, b.EndDate,
	).Scan(&b.Spent)
	if err != nil {
		b.Spent = 0
	}

	b.Remaining = b.Amount - b.Spent
	return &b, nil
}

func (s *BudgetService) Create(ctx context.Context, userID string, req models.CreateBudgetRequest) (*models.Budget, error) {
	var b models.Budget
	err := s.db.QueryRow(
		ctx,
		`INSERT INTO budgets (user_id, category, amount, period_type, start_date, end_date)
		 VALUES ($1, $2, $3, $4, $5, $6)
		 RETURNING id, user_id, category, amount, period_type, TO_CHAR(start_date, 'YYYY-MM-DD'), TO_CHAR(end_date, 'YYYY-MM-DD'), created_at, updated_at`,
		userID, req.Category, req.Amount, req.PeriodType, req.StartDate, req.EndDate,
	).Scan(&b.ID, &b.UserID, &b.Category, &b.Amount, &b.PeriodType, &b.StartDate, &b.EndDate, &b.CreatedAt, &b.UpdatedAt)

	if err != nil {
		return nil, err
	}
	b.Remaining = b.Amount
	return &b, nil
}

func (s *BudgetService) Update(ctx context.Context, id, userID string, req models.UpdateBudgetRequest) (*models.Budget, error) {
	var b models.Budget
	query := `UPDATE budgets SET
		category = COALESCE(NULLIF($1, ''), category),
		amount = CASE WHEN $2 > 0 THEN $2 ELSE amount END,
		period_type = COALESCE(NULLIF($3, ''), period_type),
		start_date = COALESCE(NULLIF($4, '')::DATE, start_date),
		end_date = COALESCE(NULLIF($5, '')::DATE, end_date),
		updated_at = NOW()
		WHERE id = $6 AND user_id = $7
		RETURNING id, user_id, category, amount, period_type, TO_CHAR(start_date, 'YYYY-MM-DD'), TO_CHAR(end_date, 'YYYY-MM-DD'), created_at, updated_at`
	
	err := s.db.QueryRow(
		ctx, query,
		req.Category, req.Amount, req.PeriodType, req.StartDate, req.EndDate, id, userID,
	).Scan(&b.ID, &b.UserID, &b.Category, &b.Amount, &b.PeriodType, &b.StartDate, &b.EndDate, &b.CreatedAt, &b.UpdatedAt)

	if err != nil {
		return nil, err
	}
	return &b, nil
}

func (s *BudgetService) Delete(ctx context.Context, id, userID string) error {
	result, err := s.db.Exec(
		ctx,
		`DELETE FROM budgets WHERE id = $1 AND user_id = $2`,
		id, userID,
	)
	if err != nil {
		return err
	}

	if result.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return nil
}

func (s *BudgetService) Rebalance(ctx context.Context, userID string, req models.RebalanceBudgetRequest) error {
	tx, err := s.db.(*pgxpool.Pool).Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// Subtract from source
	_, err = tx.Exec(
		ctx,
		`UPDATE budgets SET amount = amount - $1, updated_at = NOW() WHERE id = $2 AND user_id = $3 AND amount >= $1`,
		req.Amount, req.FromBudgetID, userID,
	)
	if err != nil {
		return err
	}

	// Add to target
	_, err = tx.Exec(
		ctx,
		`UPDATE budgets SET amount = amount + $1, updated_at = NOW() WHERE id = $2 AND user_id = $3`,
		req.Amount, req.ToBudgetID, userID,
	)
	if err != nil {
		return err
	}

	return tx.Commit(ctx)
}
