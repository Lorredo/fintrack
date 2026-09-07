package handlers

import (
	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5"

	"github.com/Lorredo/fintrack/api/internal/models"
	"github.com/Lorredo/fintrack/api/internal/services"
	"github.com/Lorredo/fintrack/api/internal/validator"
)

type BudgetHandler struct {
	service *services.BudgetService
}

func NewBudgetHandler(service *services.BudgetService) *BudgetHandler {
	return &BudgetHandler{service: service}
}

// List returns all budgets for the authenticated user, optionally filtered by date.
func (h *BudgetHandler) List(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)
	date := c.Query("date", "")

	budgets, err := h.service.List(c.Context(), userID, date)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to fetch budgets",
		})
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

	b, err := h.service.Get(c.Context(), budgetID, userID)
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

	return c.JSON(models.BudgetResponse{
		Message: "Budget fetched successfully",
		Data:    b,
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

	if errs := validator.ValidateStruct(req); errs != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Validation failed",
			"errors":  errs,
		})
	}

	b, err := h.service.Create(c.Context(), userID, req)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to create budget",
			"error":   err.Error(),
		})
	}

	return c.Status(fiber.StatusCreated).JSON(models.BudgetResponse{
		Message: "Budget created successfully",
		Data:    b,
	})
}

// Update updates an existing budget.
func (h *BudgetHandler) Update(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)
	budgetID := c.Params("id")

	var req models.UpdateBudgetRequest
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

	b, err := h.service.Update(c.Context(), budgetID, userID, req)
	if err == pgx.ErrNoRows {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"message": "Budget not found",
		})
	}
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to update budget",
			"error":   err.Error(),
		})
	}

	return c.JSON(models.BudgetResponse{
		Message: "Budget updated successfully",
		Data:    b,
	})
}

// Delete removes a budget by ID.
func (h *BudgetHandler) Delete(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)
	budgetID := c.Params("id")

	err := h.service.Delete(c.Context(), budgetID, userID)
	if err == pgx.ErrNoRows {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"message": "Budget not found",
		})
	}
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to delete budget",
		})
	}

	return c.JSON(models.BudgetResponse{
		Message: "Budget deleted successfully",
	})
}

// Rebalance transfers funds from one budget to another to cover overspending.
func (h *BudgetHandler) Rebalance(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)

	var req models.RebalanceBudgetRequest
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

	err := h.service.Rebalance(c.Context(), userID, req)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to rebalance budgets. Ensure sufficient funds.",
			"error":   err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"message": "Budgets rebalanced successfully",
	})
}
