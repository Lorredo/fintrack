package handlers

import (
	"time"

	"github.com/gofiber/fiber/v2"

	"github.com/Lorredo/fintrack/api/internal/services"
)

type DashboardHandler struct {
	service *services.DashboardService
}

func NewDashboardHandler(service *services.DashboardService) *DashboardHandler {
	return &DashboardHandler{service: service}
}

// Summary returns aggregated dashboard data for the authenticated user.
func (h *DashboardHandler) Summary(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)

	now := time.Now()
	month := c.Query("month", now.Format("2006-01"))

	if _, err := time.Parse("2006-01", month); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Invalid month format, use YYYY-MM",
		})
	}

	summary, err := h.service.GetSummary(c.Context(), userID, month)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to fetch dashboard summary",
		})
	}

	return c.JSON(summary)
}
