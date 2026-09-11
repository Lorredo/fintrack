package handlers

import (
	"strconv"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5"

	"github.com/Lorredo/fintrack/api/internal/models"
	"github.com/Lorredo/fintrack/api/internal/services"
	"github.com/Lorredo/fintrack/api/internal/validator"
)

type TransactionHandler struct {
	service *services.TransactionService
}

func NewTransactionHandler(service *services.TransactionService) *TransactionHandler {
	return &TransactionHandler{service: service}
}

// List returns paginated transactions for the authenticated user.
func (h *TransactionHandler) List(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)

	page, _ := strconv.Atoi(c.Query("page", "1"))
	limit, _ := strconv.Atoi(c.Query("limit", "20"))

	filter := services.TransactionFilter{
		Type:     c.Query("type", ""),
		Category: c.Query("category", ""),
		DateFrom: c.Query("dateFrom", ""),
		DateTo:   c.Query("dateTo", ""),
		Search:   c.Query("search", ""),
	}

	result, err := h.service.List(c.Context(), userID, page, limit, filter)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to fetch transactions",
		})
	}

	return c.JSON(result)
}

// Get returns a single transaction by ID.
func (h *TransactionHandler) Get(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)
	transactionID := c.Params("id")

	t, err := h.service.Get(c.Context(), transactionID, userID)
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

	return c.JSON(models.TransactionResponse{
		Message: "Transaction fetched successfully",
		Data:    t,
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

	if errs := validator.ValidateStruct(req); errs != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Validation failed",
			"errors":  errs,
		})
	}

	t, err := h.service.Create(c.Context(), userID, req)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to create transaction",
			"error":   err.Error(),
		})
	}

	return c.Status(fiber.StatusCreated).JSON(models.TransactionResponse{
		Message: "Transaction created successfully",
		Data:    t,
	})
}

// Update updates an existing transaction.
func (h *TransactionHandler) Update(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)
	transactionID := c.Params("id")

	var req models.UpdateTransactionRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Invalid request body",
		})
	}

	if errs := validator.ValidateStruct(req); errs != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Validation failed",
			"errors":  errs,
		})
	}

	t, err := h.service.Update(c.Context(), transactionID, userID, req)
	if err == pgx.ErrNoRows {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"message": "Transaction not found",
		})
	}
	if err != nil {
		if err.Error() == "no fields to update" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"message": "No fields to update",
			})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to update transaction",
			"error":   err.Error(),
		})
	}

	return c.JSON(models.TransactionResponse{
		Message: "Transaction updated successfully",
		Data:    t,
	})
}

// Delete removes a transaction by ID.
func (h *TransactionHandler) Delete(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)
	transactionID := c.Params("id")

	err := h.service.Delete(c.Context(), transactionID, userID)
	if err == pgx.ErrNoRows {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"message": "Transaction not found",
		})
	}
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to delete transaction",
		})
	}

	return c.JSON(models.TransactionResponse{
		Message: "Transaction deleted successfully",
	})
}
