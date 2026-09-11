package services

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/Lorredo/fintrack/api/internal/database"
	"github.com/Lorredo/fintrack/api/internal/models"
)

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
			a.id, a.user_id, a.name, a.type, a.color, a.created_at, a.updated_at,
			COALESCE(
				SUM(
					CASE 
						WHEN t.type = 'income' AND t.account_id = a.id THEN t.amount 
						WHEN t.type = 'expense' AND t.account_id = a.id THEN -t.amount 
						WHEN t.type = 'transfer' AND t.account_id = a.id THEN -t.amount 
						WHEN t.type = 'transfer' AND t.transfer_account_id = a.id THEN t.amount 
						ELSE 0 
					END
				), 0
			) as balance
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
		if err := rows.Scan(&a.ID, &a.UserID, &a.Name, &a.Type, &a.Color, &a.CreatedAt, &a.UpdatedAt, &a.Balance); err != nil {
			return nil, err
		}
		accounts = append(accounts, a)
	}

	return accounts, nil
}

func (s *AccountService) Create(ctx context.Context, userID string, req models.CreateAccountRequest) (*models.Account, error) {
	var a models.Account
	err := s.db.QueryRow(
		ctx,
		`INSERT INTO accounts (user_id, name, type, color) VALUES ($1, $2, $3, $4) RETURNING id, user_id, name, type, color, created_at, updated_at`,
		userID, req.Name, req.Type, req.Color,
	).Scan(&a.ID, &a.UserID, &a.Name, &a.Type, &a.Color, &a.CreatedAt, &a.UpdatedAt)

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

	if len(setClauses) == 0 {
		return nil, fmt.Errorf("no fields to update")
	}

	setClauses = append(setClauses, "updated_at = NOW()")
	args = append(args, id, userID)

	query := fmt.Sprintf(
		`UPDATE accounts SET %s WHERE id = $%d AND user_id = $%d RETURNING id, user_id, name, type, color, created_at, updated_at`,
		joinStrings(setClauses, ", "), argIdx, argIdx+1,
	)

	var a models.Account
	err := s.db.QueryRow(ctx, query, args...).Scan(&a.ID, &a.UserID, &a.Name, &a.Type, &a.Color, &a.CreatedAt, &a.UpdatedAt)
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
