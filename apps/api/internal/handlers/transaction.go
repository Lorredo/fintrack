package handlers

import (
	"context"
	"fmt"
	"math"
	"strconv"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5"

	"github.com/Lorredo/fintrack/api/internal/database"
	"github.com/Lorredo/fintrack/api/internal/models"
)

type TransactionHandler struct {
	db database.Querier
}

func NewTransactionHandler() *TransactionHandler {
	return &TransactionHandler{db: database.Pool}
}

// NewTransactionHandlerWithDB creates a handler with a custom DB (for testing).
func NewTransactionHandlerWithDB(db database.Querier) *TransactionHandler {
	return &TransactionHandler{db: db}
}

// List returns paginated transactions for the authenticated user.
func (h *TransactionHandler) List(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)

	page, _ := strconv.Atoi(c.Query("page", "1"))
	limit, _ := strconv.Atoi(c.Query("limit", "20"))
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}
	offset := (page - 1) * limit

	// Optional filters
	typeFilter := c.Query("type", "")
	categoryFilter := c.Query("category", "")
	dateFrom := c.Query("dateFrom", "")
	dateTo := c.Query("dateTo", "")

	// Build query
	baseQuery := `FROM transactions WHERE user_id = $1`
	args := []interface{}{userID}
	argIdx := 2

	if typeFilter != "" {
		baseQuery += fmt.Sprintf(` AND type = $%d`, argIdx)
		args = append(args, typeFilter)
		argIdx++
	}
	if categoryFilter != "" {
		baseQuery += fmt.Sprintf(` AND category = $%d`, argIdx)
		args = append(args, categoryFilter)
		argIdx++
	}
	if dateFrom != "" {
		baseQuery += fmt.Sprintf(` AND date >= $%d`, argIdx)
		args = append(args, dateFrom)
		argIdx++
	}
	if dateTo != "" {
		baseQuery += fmt.Sprintf(` AND date <= $%d`, argIdx)
		args = append(args, dateTo)
		argIdx++
	}

	// Count total
	var total int
	countQuery := `SELECT COUNT(*) ` + baseQuery
	err := h.db.QueryRow(context.Background(), countQuery, args...).Scan(&total)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to count transactions",
		})
	}

	// Fetch paginated results
	selectQuery := fmt.Sprintf(
		`SELECT id, user_id, type, amount, category, description, date, created_at, updated_at %s ORDER BY date DESC, created_at DESC LIMIT $%d OFFSET $%d`,
		baseQuery, argIdx, argIdx+1,
	)
	args = append(args, limit, offset)

	rows, err := h.db.Query(context.Background(), selectQuery, args...)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to fetch transactions",
		})
	}
	defer rows.Close()

	transactions := make([]models.Transaction, 0)
	for rows.Next() {
		var t models.Transaction
		var dateTime time.Time
		err := rows.Scan(&t.ID, &t.UserID, &t.Type, &t.Amount, &t.Category, &t.Description, &dateTime, &t.CreatedAt, &t.UpdatedAt)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"message": "Failed to scan transaction row",
				"error":   err.Error(),
			})
		}
		t.Date = dateTime.Format("2006-01-02")
		transactions = append(transactions, t)
	}

	totalPages := int(math.Ceil(float64(total) / float64(limit)))

	return c.JSON(models.TransactionListResponse{
		Data:       transactions,
		Total:      total,
		Page:       page,
		Limit:      limit,
		TotalPages: totalPages,
	})
}

// Get returns a single transaction by ID.
func (h *TransactionHandler) Get(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)
	transactionID := c.Params("id")

	var t models.Transaction
	var dateTime time.Time
	err := h.db.QueryRow(
		context.Background(),
		`SELECT id, user_id, type, amount, category, description, date, created_at, updated_at
		 FROM transactions WHERE id = $1 AND user_id = $2`,
		transactionID, userID,
	).Scan(&t.ID, &t.UserID, &t.Type, &t.Amount, &t.Category, &t.Description, &dateTime, &t.CreatedAt, &t.UpdatedAt)

	if err == pgx.ErrNoRows {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"message": "Transaction not found",
		})
	}
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to fetch transaction",
		})
	}

	t.Date = dateTime.Format("2006-01-02")

	return c.JSON(models.TransactionResponse{
		Message: "Transaction fetched successfully",
		Data:    &t,
	})
}

// Create creates a new transaction.
func (h *TransactionHandler) Create(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)

	var req models.CreateTransactionRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Invalid request body",
		})
	}

	if req.Type != models.TransactionTypeIncome && req.Type != models.TransactionTypeExpense {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Type must be 'income' or 'expense'",
		})
	}
	if req.Amount <= 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Amount must be greater than zero",
		})
	}
	if req.Category == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Category is required",
		})
	}
	if req.Date == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Date is required",
		})
	}

	var t models.Transaction
	var dateTime time.Time
	err := h.db.QueryRow(
		context.Background(),
		`INSERT INTO transactions (user_id, type, amount, category, description, date)
		 VALUES ($1, $2, $3, $4, $5, $6)
		 RETURNING id, user_id, type, amount, category, description, date, created_at, updated_at`,
		userID, req.Type, req.Amount, req.Category, req.Description, req.Date,
	).Scan(&t.ID, &t.UserID, &t.Type, &t.Amount, &t.Category, &t.Description, &dateTime, &t.CreatedAt, &t.UpdatedAt)

	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to create transaction",
			"error":   err.Error(),
		})
	}

	t.Date = dateTime.Format("2006-01-02")

	return c.Status(fiber.StatusCreated).JSON(models.TransactionResponse{
		Message: "Transaction created successfully",
		Data:    &t,
	})
}

// Update updates an existing transaction.
func (h *TransactionHandler) Update(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)
	transactionID := c.Params("id")

	// First check the transaction exists and belongs to user
	var existingID string
	err := h.db.QueryRow(
		context.Background(),
		`SELECT id FROM transactions WHERE id = $1 AND user_id = $2`,
		transactionID, userID,
	).Scan(&existingID)

	if err == pgx.ErrNoRows {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"message": "Transaction not found",
		})
	}
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to fetch transaction",
		})
	}

	var req models.UpdateTransactionRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Invalid request body",
		})
	}

	// Build dynamic update query
	setClauses := []string{}
	args := []interface{}{}
	argIdx := 1

	if req.Type != "" {
		if req.Type != models.TransactionTypeIncome && req.Type != models.TransactionTypeExpense {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"message": "Type must be 'income' or 'expense'",
			})
		}
		setClauses = append(setClauses, fmt.Sprintf("type = $%d", argIdx))
		args = append(args, req.Type)
		argIdx++
	}
	if req.Amount > 0 {
		setClauses = append(setClauses, fmt.Sprintf("amount = $%d", argIdx))
		args = append(args, req.Amount)
		argIdx++
	}
	if req.Category != "" {
		setClauses = append(setClauses, fmt.Sprintf("category = $%d", argIdx))
		args = append(args, req.Category)
		argIdx++
	}
	if req.Description != nil {
		setClauses = append(setClauses, fmt.Sprintf("description = $%d", argIdx))
		args = append(args, *req.Description)
		argIdx++
	}
	if req.Date != "" {
		setClauses = append(setClauses, fmt.Sprintf("date = $%d", argIdx))
		args = append(args, req.Date)
		argIdx++
	}

	if len(setClauses) == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "No fields to update",
		})
	}

	setClauses = append(setClauses, "updated_at = NOW()")
	args = append(args, transactionID, userID)

	query := fmt.Sprintf(
		`UPDATE transactions SET %s WHERE id = $%d AND user_id = $%d RETURNING id, user_id, type, amount, category, description, date, created_at, updated_at`,
		joinStrings(setClauses, ", "),
		argIdx, argIdx+1,
	)

	var t models.Transaction
	var dateTime time.Time
	err = h.db.QueryRow(context.Background(), query, args...).Scan(
		&t.ID, &t.UserID, &t.Type, &t.Amount, &t.Category, &t.Description, &dateTime, &t.CreatedAt, &t.UpdatedAt,
	)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to update transaction",
			"error":   err.Error(),
		})
	}

	t.Date = dateTime.Format("2006-01-02")

	return c.JSON(models.TransactionResponse{
		Message: "Transaction updated successfully",
		Data:    &t,
	})
}

// Delete removes a transaction by ID.
func (h *TransactionHandler) Delete(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)
	transactionID := c.Params("id")

	result, err := h.db.Exec(
		context.Background(),
		`DELETE FROM transactions WHERE id = $1 AND user_id = $2`,
		transactionID, userID,
	)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to delete transaction",
		})
	}

	if result.RowsAffected() == 0 {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"message": "Transaction not found",
		})
	}

	return c.JSON(models.TransactionResponse{
		Message: "Transaction deleted successfully",
	})
}

// joinStrings is a helper to join strings with a separator.
func joinStrings(strs []string, sep string) string {
	result := ""
	for i, s := range strs {
		if i > 0 {
			result += sep
		}
		result += s
	}
	return result
}
