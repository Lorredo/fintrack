package handlers

import (
	"errors"
	"time"

	"github.com/gofiber/fiber/v2"

	"github.com/Lorredo/fintrack/api/internal/models"
	"github.com/Lorredo/fintrack/api/internal/services"
	"github.com/Lorredo/fintrack/api/internal/validator"
)

type BillHandler struct {
	service *services.BillService
}

func NewBillHandler(service *services.BillService) *BillHandler {
	return &BillHandler{service: service}
}

// errResponded means the helper already sent an error response.
var errResponded = errors.New("response sent")

func respond(c *fiber.Ctx, status int, message string) error {
	if err := c.Status(status).JSON(fiber.Map{"message": message}); err != nil {
		return err
	}
	return errResponded
}

// parseToday reads the user's local date from ?today=. The server runs on UTC,
// so its own clock can be a day off for the user.
func parseToday(c *fiber.Ctx) (time.Time, error) {
	today, err := services.ParseDay(c.Query("today"))
	if err != nil {
		return time.Time{}, respond(c, fiber.StatusBadRequest, "today must be a date like 2026-11-09")
	}
	return today, nil
}

func parseBody(c *fiber.Ctx, req interface{}) error {
	if err := c.BodyParser(req); err != nil {
		return respond(c, fiber.StatusBadRequest, "Invalid request body")
	}
	if errs := validator.ValidateStruct(req); errs != nil {
		if err := c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"message": "Validation failed", "errors": errs}); err != nil {
			return err
		}
		return errResponded
	}
	return nil
}

// finish ends a request whose helper may already have responded.
func finish(err error) error {
	if errors.Is(err, errResponded) {
		return nil
	}
	return err
}

// billError turns known service errors into responses.
func billError(c *fiber.Ctx, err error, fallback string) error {
	switch {
	case errors.Is(err, services.ErrBillNotFound), services.IsInvalidID(err):
		return finish(respond(c, fiber.StatusNotFound, services.ErrBillNotFound.Error()))
	case errors.Is(err, services.ErrWalletNotFound):
		return finish(respond(c, fiber.StatusNotFound, err.Error()))
	case errors.Is(err, services.ErrBillAlreadyPaid), errors.Is(err, services.ErrPayAlreadyRecorded):
		return finish(respond(c, fiber.StatusConflict, err.Error()))
	case errors.Is(err, services.ErrNotADueDate), errors.Is(err, services.ErrBillNeedsWallet),
		errors.Is(err, services.ErrNothingToUpdate), errors.Is(err, services.ErrBadRegularIncome),
		errors.Is(err, services.ErrDuplicateIncome), errors.Is(err, services.ErrNotAPayItem),
		errors.Is(err, services.ErrPayNeedsWallet):
		return finish(respond(c, fiber.StatusBadRequest, err.Error()))
	case errors.Is(err, services.ErrInsufficientBalance):
		return finish(respond(c, fiber.StatusUnprocessableEntity, err.Error()))
	default:
		return finish(respond(c, fiber.StatusInternalServerError, fallback))
	}
}

func userIDOf(c *fiber.Ctx) string {
	return c.Locals("userID").(string)
}

func (h *BillHandler) List(c *fiber.Ctx) error {
	today, err := parseToday(c)
	if err != nil {
		return finish(err)
	}
	bills, err := h.service.List(c.Context(), userIDOf(c), today)
	if err != nil {
		return billError(c, err, "Failed to fetch bills")
	}
	return c.JSON(fiber.Map{"data": bills, "total": len(bills)})
}

func (h *BillHandler) Create(c *fiber.Ctx) error {
	today, err := parseToday(c)
	if err != nil {
		return finish(err)
	}
	var req models.CreateBillRequest
	if err := parseBody(c, &req); err != nil {
		return finish(err)
	}
	bill, err := h.service.Create(c.Context(), userIDOf(c), req, today)
	if err != nil {
		return billError(c, err, "Failed to create bill")
	}
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"message": "Bill created", "data": bill})
}

func (h *BillHandler) Update(c *fiber.Ctx) error {
	today, err := parseToday(c)
	if err != nil {
		return finish(err)
	}
	var req models.UpdateBillRequest
	if err := parseBody(c, &req); err != nil {
		return finish(err)
	}
	bill, err := h.service.Update(c.Context(), userIDOf(c), c.Params("id"), req, today)
	if err != nil {
		return billError(c, err, "Failed to update bill")
	}
	return c.JSON(fiber.Map{"message": "Bill updated", "data": bill})
}

func (h *BillHandler) Delete(c *fiber.Ctx) error {
	if err := h.service.Delete(c.Context(), userIDOf(c), c.Params("id")); err != nil {
		return billError(c, err, "Failed to delete bill")
	}
	return c.JSON(fiber.Map{"message": "Bill deleted"})
}

func (h *BillHandler) Pay(c *fiber.Ctx) error {
	var req models.PayBillRequest
	if err := parseBody(c, &req); err != nil {
		return finish(err)
	}
	transaction, err := h.service.Pay(c.Context(), userIDOf(c), c.Params("id"), req)
	if err != nil {
		return billError(c, err, "Failed to pay bill")
	}
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"message": "Bill paid", "data": transaction})
}

func (h *BillHandler) Skip(c *fiber.Ctx) error {
	var req models.SkipBillRequest
	if err := parseBody(c, &req); err != nil {
		return finish(err)
	}
	if err := h.service.Skip(c.Context(), userIDOf(c), c.Params("id"), req); err != nil {
		return billError(c, err, "Failed to skip bill")
	}
	return c.JSON(fiber.Map{"message": "Bill skipped"})
}

func (h *BillHandler) GetSettings(c *fiber.Ctx) error {
	settings, err := h.service.GetSettings(c.Context(), userIDOf(c))
	if err != nil {
		return billError(c, err, "Failed to fetch settings")
	}
	return c.JSON(fiber.Map{"data": settings})
}

func (h *BillHandler) UpdateSettings(c *fiber.Ctx) error {
	var req models.UpdatePaySettingsRequest
	if err := parseBody(c, &req); err != nil {
		return finish(err)
	}
	settings, err := h.service.UpdateSettings(c.Context(), userIDOf(c), req)
	if err != nil {
		return billError(c, err, "Failed to update settings")
	}
	return c.JSON(fiber.Map{"message": "Settings updated", "data": settings})
}

func (h *BillHandler) SafeToSpend(c *fiber.Ctx) error {
	today, err := parseToday(c)
	if err != nil {
		return finish(err)
	}
	result, err := h.service.SafeToSpend(c.Context(), userIDOf(c), today)
	if err != nil {
		return billError(c, err, "Failed to work out Safe to Spend")
	}
	return c.JSON(fiber.Map{"data": result})
}

func (h *BillHandler) PendingPay(c *fiber.Ctx) error {
	today, err := parseToday(c)
	if err != nil {
		return finish(err)
	}
	result, err := h.service.PendingPay(c.Context(), userIDOf(c), today)
	if err != nil {
		return billError(c, err, "Failed to fetch pay to record")
	}
	return c.JSON(fiber.Map{"data": result})
}

func (h *BillHandler) RecordPay(c *fiber.Ctx) error {
	var req models.RecordPayRequest
	if err := parseBody(c, &req); err != nil {
		return finish(err)
	}
	transaction, err := h.service.RecordPay(c.Context(), userIDOf(c), req)
	if err != nil {
		return billError(c, err, "Failed to record pay")
	}
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"message": "Pay recorded", "data": transaction})
}

func (h *BillHandler) SkipPay(c *fiber.Ctx) error {
	var req models.SkipPayRequest
	if err := parseBody(c, &req); err != nil {
		return finish(err)
	}
	if err := h.service.SkipPay(c.Context(), userIDOf(c), req); err != nil {
		return billError(c, err, "Failed to mark pay")
	}
	return c.JSON(fiber.Map{"message": "Pay marked as added"})
}
