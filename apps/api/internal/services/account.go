package services

import (
	"context"
	"errors"
	"fmt"
	"math"

	"github.com/jackc/pgx/v5"
	"github.com/Lorredo/fintrack/api/internal/database"
	"github.com/Lorredo/fintrack/api/internal/models"
)

var ErrAccountNotFound = errors.New("account not found")

type AccountService struct {
	db database.Querier
}

func NewAccountService(db database.Querier) *AccountService {
	if db == nil {
		db = database.Pool
	}
	return &AccountService{db: db}
}

func (s *AccountService) List(ctx context.Context, userID string) ([]models.Account, error) {
	query := `
		SELECT 
			a.id, a.user_id, a.name, a.type, a.color, a.in_safe_to_spend, a.created_at, a.updated_at,
			COALESCE(
				SUM(
					CASE 
						WHEN t.type IN ('income', 'adjust_in', 'loan_in') AND t.account_id = a.id THEN t.amount 
						WHEN t.type IN ('expense', 'adjust_out', 'loan_out') AND t.account_id = a.id THEN -t.amount 
						WHEN t.type = 'transfer' AND t.account_id = a.id THEN -t.amount 
						WHEN t.type = 'transfer' AND t.transfer_account_id = a.id THEN t.amount 
						ELSE 0 
					END
				), 0
			) as balance,
			MAX(t.created_at) FILTER (WHERE t.type IN ('adjust_in', 'adjust_out')) as last_adjusted_at
		FROM accounts a
		LEFT JOIN transactions t ON (a.id = t.account_id OR a.id = t.transfer_account_id)
		WHERE a.user_id = $1
		GROUP BY a.id
		ORDER BY a.created_at ASC`
	
	rows, err := s.db.Query(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	accounts := make([]models.Account, 0)
	for rows.Next() {
		var a models.Account
		if err := rows.Scan(&a.ID, &a.UserID, &a.Name, &a.Type, &a.Color, &a.InSafeToSpend, &a.CreatedAt, &a.UpdatedAt, &a.Balance, &a.LastAdjustedAt); err != nil {
			return nil, err
		}
		accounts = append(accounts, a)
	}

	return accounts, nil
}

// balanceAdjustment returns the transaction that moves a wallet from current to
// target. ok is false when they already match to the centavo.
func balanceAdjustment(current, target float64) (txType models.TransactionType, amount float64, ok bool) {
	difference := math.Round((target-current)*100) / 100
	switch {
	case difference > 0:
		return models.TransactionTypeAdjustIn, difference, true
	case difference < 0:
		return models.TransactionTypeAdjustOut, -difference, true
	default:
		return "", 0, false
	}
}

// SetBalance records whatever adjustment makes the wallet's balance match the
// real one.
func (s *AccountService) SetBalance(ctx context.Context, id, userID string, req models.SetBalanceRequest) (*models.SetBalanceResult, error) {
	var current float64
	err := s.db.QueryRow(ctx, `
		SELECT COALESCE(
			SUM(
				CASE
					WHEN t.type IN ('income', 'adjust_in', 'loan_in') AND t.account_id = a.id THEN t.amount
					WHEN t.type IN ('expense', 'adjust_out', 'loan_out') AND t.account_id = a.id THEN -t.amount
					WHEN t.type = 'transfer' AND t.account_id = a.id THEN -t.amount
					WHEN t.type = 'transfer' AND t.transfer_account_id = a.id THEN t.amount
					ELSE 0
				END
			), 0
		)
		FROM accounts a
		LEFT JOIN transactions t ON (a.id = t.account_id OR a.id = t.transfer_account_id)
		WHERE a.id = $1 AND a.user_id = $2
		GROUP BY a.id`, id, userID).Scan(&current)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrAccountNotFound
	}
	if err != nil {
		return nil, err
	}

	txType, amount, ok := balanceAdjustment(current, *req.Balance)
	if !ok {
		return &models.SetBalanceResult{Balance: *req.Balance, Adjusted: false}, nil
	}

	_, err = s.db.Exec(ctx,
		`INSERT INTO transactions (user_id, account_id, type, amount, category, date) VALUES ($1, $2, $3, $4, $5, $6)`,
		userID, id, txType, amount, "Balance Adjustment", req.Date)
	if err != nil {
		return nil, err
	}
	return &models.SetBalanceResult{Balance: *req.Balance, Adjusted: true}, nil
}

func (s *AccountService) Create(ctx context.Context, userID string, req models.CreateAccountRequest) (*models.Account, error) {
	inSafeToSpend := true
	if req.InSafeToSpend != nil {
		inSafeToSpend = *req.InSafeToSpend
	}

	var a models.Account
	err := s.db.QueryRow(
		ctx,
		`INSERT INTO accounts (user_id, name, type, color, in_safe_to_spend) VALUES ($1, $2, $3, $4, $5) RETURNING id, user_id, name, type, color, in_safe_to_spend, created_at, updated_at`,
		userID, req.Name, req.Type, req.Color, inSafeToSpend,
	).Scan(&a.ID, &a.UserID, &a.Name, &a.Type, &a.Color, &a.InSafeToSpend, &a.CreatedAt, &a.UpdatedAt)

	if err != nil {
		return nil, err
	}
	return &a, nil
}

func (s *AccountService) Update(ctx context.Context, id, userID string, req models.UpdateAccountRequest) (*models.Account, error) {
	setClauses := []string{}
	args := []interface{}{}
	argIdx := 1

	if req.Name != "" {
		setClauses = append(setClauses, fmt.Sprintf("name = $%d", argIdx))
		args = append(args, req.Name)
		argIdx++
	}
	if req.Type != "" {
		setClauses = append(setClauses, fmt.Sprintf("type = $%d", argIdx))
		args = append(args, req.Type)
		argIdx++
	}
	if req.Color != nil {
		setClauses = append(setClauses, fmt.Sprintf("color = $%d", argIdx))
		args = append(args, *req.Color)
		argIdx++
	}
	if req.InSafeToSpend != nil {
		setClauses = append(setClauses, fmt.Sprintf("in_safe_to_spend = $%d", argIdx))
		args = append(args, *req.InSafeToSpend)
		argIdx++
	}

	if len(setClauses) == 0 {
		return nil, fmt.Errorf("no fields to update")
	}

	setClauses = append(setClauses, "updated_at = NOW()")
	args = append(args, id, userID)

	query := fmt.Sprintf(
		`UPDATE accounts SET %s WHERE id = $%d AND user_id = $%d RETURNING id, user_id, name, type, color, in_safe_to_spend, created_at, updated_at`,
		joinStrings(setClauses, ", "), argIdx, argIdx+1,
	)

	var a models.Account
	err := s.db.QueryRow(ctx, query, args...).Scan(&a.ID, &a.UserID, &a.Name, &a.Type, &a.Color, &a.InSafeToSpend, &a.CreatedAt, &a.UpdatedAt)
	if err != nil {
		return nil, err
	}

	return &a, nil
}

func (s *AccountService) Delete(ctx context.Context, id, userID string) error {
	result, err := s.db.Exec(ctx, `DELETE FROM accounts WHERE id = $1 AND user_id = $2`, id, userID)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return nil
}
