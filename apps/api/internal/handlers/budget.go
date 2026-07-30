package handlers

import (
	"context"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5"

	"github.com/Lorredo/fintrack/api/internal/database"
	"github.com/Lorredo/fintrack/api/internal/models"
)

type BudgetHandler struct {
	db database.Querier
}

func NewBudgetHandler() *BudgetHandler {
	return &BudgetHandler{db: database.Pool}
}

// NewBudgetHandlerWithDB creates a handler with a custom DB (for testing).
func NewBudgetHandlerWithDB(db database.Querier) *BudgetHandler {
	return &BudgetHandler{db: db}
}

// List returns all budgets for the authenticated user, optionally filtered by month.
func (h *BudgetHandler) List(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)
	month := c.Query("month", "")

	var rows pgx.Rows
	var err error

	if month != "" {
		rows, err = h.db.Query(
			context.Background(),
			`SELECT b.id, b.user_id, b.category, b.amount, b.month, b.created_at, b.updated_at,
				COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END), 0) as spent
				FROM budgets b
				LEFT JOIN transactions t ON b.user_id = t.user_id AND b.category = t.category
					AND t.date >= (b.month || '-01')::date
					AND t.date < (to_date(b.month || '-01', 'YYYY-MM-DD') + INTERVAL '1 month')::date
				WHERE b.user_id = $1 AND b.month = $2
				GROUP BY b.id, b.user_id, b.category, b.amount, b.month, b.created_at, b.updated_at
				ORDER BY b.month DESC, b.category ASC`,
			userID, month,
		)
	} else {
		rows, err = h.db.Query(
			context.Background(),
			`SELECT b.id, b.user_id, b.category, b.amount, b.month, b.created_at, b.updated_at,
				COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END), 0) as spent
				FROM budgets b
				LEFT JOIN transactions t ON b.user_id = t.user_id AND b.category = t.category
					AND t.date >= (b.month || '-01')::date
					AND t.date < (to_date(b.month || '-01', 'YYYY-MM-DD') + INTERVAL '1 month')::date
				WHERE b.user_id = $1
				GROUP BY b.id, b.user_id, b.category, b.amount, b.month, b.created_at, b.updated_at
				ORDER BY b.month DESC, b.category ASC`,
			userID,
		)
	}
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to fetch budgets",
		})
	}
	defer rows.Close()

	budgets := make([]models.Budget, 0)
	for rows.Next() {
		var b models.Budget
		err := rows.Scan(&b.ID, &b.UserID, &b.Category, &b.Amount, &b.Month, &b.CreatedAt, &b.UpdatedAt, &b.Spent)
		if err != nil {
			continue
		}
		b.Remaining = b.Amount - b.Spent
		budgets = append(budgets, b)
	}

	return c.JSON(models.BudgetListResponse{
		Data:  budgets,
		Total: len(budgets),
	})
}

// Get returns a single budget by ID.
func (h *BudgetHandler) Get(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)
	budgetID := c.Params("id")

	var b models.Budget
	err := h.db.QueryRow(
		context.Background(),
		`SELECT id, user_id, category, amount, month, created_at, updated_at
		 FROM budgets WHERE id = $1 AND user_id = $2`,
		budgetID, userID,
	).Scan(&b.ID, &b.UserID, &b.Category, &b.Amount, &b.Month, &b.CreatedAt, &b.UpdatedAt)

	if err == pgx.ErrNoRows {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"message": "Budget not found",
		})
	}
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to fetch budget",
		})
	}

	// Calculate spent for this budget's category and month
	err = h.db.QueryRow(
		context.Background(),
		`SELECT COALESCE(SUM(amount), 0) FROM transactions
		 WHERE user_id = $1 AND category = $2 AND type = 'expense'
		 AND date >= ($3 || '-01')::date
		 AND date < (to_date($3 || '-01', 'YYYY-MM-DD') + INTERVAL '1 month')::date`,
		userID, b.Category, b.Month,
	).Scan(&b.Spent)
	if err != nil {
		b.Spent = 0
	}

	b.Remaining = b.Amount - b.Spent

	return c.JSON(models.BudgetResponse{
		Message: "Budget fetched successfully",
		Data:    &b,
	})
}

// Create creates a new budget.
func (h *BudgetHandler) Create(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)

	var req models.CreateBudgetRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Invalid request body",
		})
	}

	if req.Category == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Category is required",
		})
	}
	if req.Amount <= 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Amount must be greater than zero",
		})
	}
	if req.Month == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Month is required (YYYY-MM)",
		})
	}

	var b models.Budget
	err := h.db.QueryRow(
		context.Background(),
		`INSERT INTO budgets (user_id, category, amount, month)
		 VALUES ($1, $2, $3, $4)
		 RETURNING id, user_id, category, amount, month, created_at, updated_at`,
		userID, req.Category, req.Amount, req.Month,
	).Scan(&b.ID, &b.UserID, &b.Category, &b.Amount, &b.Month, &b.CreatedAt, &b.UpdatedAt)

	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to create budget",
			"error":   err.Error(),
		})
	}

	return c.Status(fiber.StatusCreated).JSON(models.BudgetResponse{
		Message: "Budget created successfully",
		Data:    &b,
	})
}

// Update updates an existing budget.
func (h *BudgetHandler) Update(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)
	budgetID := c.Params("id")

	// Check exists
	err := h.db.QueryRow(
		context.Background(),
		`SELECT id FROM budgets WHERE id = $1 AND user_id = $2`,
		budgetID, userID,
	).Scan()

	if err == pgx.ErrNoRows {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"message": "Budget not found",
		})
	}
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to fetch budget",
		})
	}

	var req models.UpdateBudgetRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Invalid request body",
		})
	}

	var b models.Budget
	query := `UPDATE budgets SET
		category = COALESCE(NULLIF($1, ''), category),
		amount = CASE WHEN $2 > 0 THEN $2 ELSE amount END,
		month = COALESCE(NULLIF($3, ''), month),
		updated_at = NOW()
		WHERE id = $4 AND user_id = $5
		RETURNING id, user_id, category, amount, month, created_at, updated_at`
	err = h.db.QueryRow(
		context.Background(), query,
		req.Category, req.Amount, req.Month, budgetID, userID,
	).Scan(&b.ID, &b.UserID, &b.Category, &b.Amount, &b.Month, &b.CreatedAt, &b.UpdatedAt)

	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to update budget",
			"error":   err.Error(),
		})
	}

	return c.JSON(models.BudgetResponse{
		Message: "Budget updated successfully",
		Data:    &b,
	})
}

// Delete removes a budget by ID.
func (h *BudgetHandler) Delete(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)
	budgetID := c.Params("id")

	result, err := h.db.Exec(
		context.Background(),
		`DELETE FROM budgets WHERE id = $1 AND user_id = $2`,
		budgetID, userID,
	)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to delete budget",
		})
	}

	if result.RowsAffected() == 0 {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"message": "Budget not found",
		})
	}

	return c.JSON(models.BudgetResponse{
		Message: "Budget deleted successfully",
	})
}
