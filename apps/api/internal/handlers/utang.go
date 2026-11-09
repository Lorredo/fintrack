package handlers

import (
	"errors"

	"github.com/gofiber/fiber/v2"

	"github.com/Lorredo/fintrack/api/internal/models"
	"github.com/Lorredo/fintrack/api/internal/services"
)

type UtangHandler struct {
	service *services.UtangService
}

func NewUtangHandler(service *services.UtangService) *UtangHandler {
	return &UtangHandler{service: service}
}

func utangError(c *fiber.Ctx, err error, fallback string) error {
	switch {
	case errors.Is(err, services.ErrDebtNotFound), errors.Is(err, services.ErrDebtPaymentNotFound),
		errors.Is(err, services.ErrPaluwaganNotFound), errors.Is(err, services.ErrWalletNotFound):
		return finish(respond(c, fiber.StatusNotFound, err.Error()))
	case errors.Is(err, services.ErrRoundRecorded):
		return finish(respond(c, fiber.StatusConflict, err.Error()))
	case errors.Is(err, services.ErrPaymentTooLarge), errors.Is(err, services.ErrBadRound), errors.Is(err, services.ErrNotYourTurn),
		errors.Is(err, services.ErrTurnOutOfRange), errors.Is(err, services.ErrNeedsWallet), errors.Is(err, services.ErrNothingToUpdate):
		return finish(respond(c, fiber.StatusBadRequest, err.Error()))
	case errors.Is(err, services.ErrInsufficientBalance):
		return finish(respond(c, fiber.StatusUnprocessableEntity, err.Error()))
	default:
		return finish(respond(c, fiber.StatusInternalServerError, fallback))
	}
}

// ---------------------------------------------------------------- Utang ----

func (h *UtangHandler) ListDebts(c *fiber.Ctx) error {
	summary, err := h.service.ListDebts(c.Context(), userIDOf(c))
	if err != nil {
		return utangError(c, err, "Failed to fetch utang")
	}
	return c.JSON(fiber.Map{"data": summary})
}

func (h *UtangHandler) CreateDebt(c *fiber.Ctx) error {
	var req models.CreateDebtRequest
	if err := parseBody(c, &req); err != nil {
		return finish(err)
	}
	debt, err := h.service.CreateDebt(c.Context(), userIDOf(c), req)
	if err != nil {
		return utangError(c, err, "Failed to save utang")
	}
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"message": "Utang saved", "data": debt})
}

func (h *UtangHandler) UpdateDebt(c *fiber.Ctx) error {
	var req models.UpdateDebtRequest
	if err := parseBody(c, &req); err != nil {
		return finish(err)
	}
	debt, err := h.service.UpdateDebt(c.Context(), userIDOf(c), c.Params("id"), req)
	if err != nil {
		return utangError(c, err, "Failed to update utang")
	}
	return c.JSON(fiber.Map{"message": "Utang updated", "data": debt})
}

func (h *UtangHandler) DeleteDebt(c *fiber.Ctx) error {
	if err := h.service.DeleteDebt(c.Context(), userIDOf(c), c.Params("id")); err != nil {
		return utangError(c, err, "Failed to delete utang")
	}
	return c.JSON(fiber.Map{"message": "Utang deleted"})
}

func (h *UtangHandler) AddDebtPayment(c *fiber.Ctx) error {
	var req models.DebtPaymentRequest
	if err := parseBody(c, &req); err != nil {
		return finish(err)
	}
	debt, err := h.service.AddDebtPayment(c.Context(), userIDOf(c), c.Params("id"), req)
	if err != nil {
		return utangError(c, err, "Failed to record payment")
	}
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"message": "Payment recorded", "data": debt})
}

func (h *UtangHandler) DeleteDebtPayment(c *fiber.Ctx) error {
	debt, err := h.service.DeleteDebtPayment(c.Context(), userIDOf(c), c.Params("id"), c.Params("paymentId"))
	if err != nil {
		return utangError(c, err, "Failed to delete payment")
	}
	return c.JSON(fiber.Map{"message": "Payment deleted", "data": debt})
}

// ------------------------------------------------------------ Paluwagan ----

func (h *UtangHandler) ListPaluwagans(c *fiber.Ctx) error {
	today, err := parseToday(c)
	if err != nil {
		return finish(err)
	}
	list, err := h.service.ListPaluwagans(c.Context(), userIDOf(c), today)
	if err != nil {
		return utangError(c, err, "Failed to fetch paluwagan")
	}
	return c.JSON(fiber.Map{"data": list})
}

func (h *UtangHandler) CreatePaluwagan(c *fiber.Ctx) error {
	today, err := parseToday(c)
	if err != nil {
		return finish(err)
	}
	var req models.CreatePaluwaganRequest
	if err := parseBody(c, &req); err != nil {
		return finish(err)
	}
	p, err := h.service.CreatePaluwagan(c.Context(), userIDOf(c), req, today)
	if err != nil {
		return utangError(c, err, "Failed to save paluwagan")
	}
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"message": "Paluwagan saved", "data": p})
}

func (h *UtangHandler) UpdatePaluwagan(c *fiber.Ctx) error {
	today, err := parseToday(c)
	if err != nil {
		return finish(err)
	}
	var req models.UpdatePaluwaganRequest
	if err := parseBody(c, &req); err != nil {
		return finish(err)
	}
	p, err := h.service.UpdatePaluwagan(c.Context(), userIDOf(c), c.Params("id"), req, today)
	if err != nil {
		return utangError(c, err, "Failed to update paluwagan")
	}
	return c.JSON(fiber.Map{"message": "Paluwagan updated", "data": p})
}

func (h *UtangHandler) DeletePaluwagan(c *fiber.Ctx) error {
	if err := h.service.DeletePaluwagan(c.Context(), userIDOf(c), c.Params("id")); err != nil {
		return utangError(c, err, "Failed to delete paluwagan")
	}
	return c.JSON(fiber.Map{"message": "Paluwagan deleted"})
}

func (h *UtangHandler) recordRound(c *fiber.Ctx, payout bool) error {
	today, err := parseToday(c)
	if err != nil {
		return finish(err)
	}
	var req models.PaluwaganPaymentRequest
	if err := parseBody(c, &req); err != nil {
		return finish(err)
	}
	var p *models.Paluwagan
	if payout {
		p, err = h.service.ReceivePayout(c.Context(), userIDOf(c), c.Params("id"), req, today)
	} else {
		p, err = h.service.Contribute(c.Context(), userIDOf(c), c.Params("id"), req, today)
	}
	if err != nil {
		return utangError(c, err, "Failed to record this round")
	}
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"message": "Recorded", "data": p})
}

func (h *UtangHandler) Contribute(c *fiber.Ctx) error {
	return h.recordRound(c, false)
}

func (h *UtangHandler) ReceivePayout(c *fiber.Ctx) error {
	return h.recordRound(c, true)
}
