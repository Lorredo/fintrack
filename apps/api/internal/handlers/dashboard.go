package handlers

import (
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/Lorredo/fintrack/api/internal/services"
)

type DashboardHandler struct {
	dashboardService *services.DashboardService
}

func NewDashboardHandler(dashboardService *services.DashboardService) *DashboardHandler {
	return &DashboardHandler{dashboardService: dashboardService}
}

func (h *DashboardHandler) Summary(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)
	
	month := c.Query("month")
	if month == "" {
		month = time.Now().Format("2006-01")
	}

	accountID := c.Query("account_id") // Optional

	summary, err := h.dashboardService.GetSummary(c.Context(), userID, month, accountID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to fetch dashboard summary",
			"error":   err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"message": "Dashboard summary fetched successfully",
		"data":    summary,
	})
}
