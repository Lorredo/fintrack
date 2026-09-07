package handlers

import (
	"fmt"
	"time"

	"github.com/gofiber/fiber/v2"

	"github.com/Lorredo/fintrack/api/internal/services"
)

type ReportHandler struct {
	service *services.ReportService
}

func NewReportHandler(service *services.ReportService) *ReportHandler {
	return &ReportHandler{service: service}
}

// Trends returns monthly income/expense/net trends for the last N months.
func (h *ReportHandler) Trends(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)

	periods := 6
	if m := c.Query("months", ""); m != "" {
		fmt.Sscanf(m, "%d", &periods)
	}
	if periods < 1 || periods > 52 {
		periods = 6
	}
	
	periodType := c.Query("period", "monthly")

	trends, err := h.service.GetTrends(c.Context(), userID, periods, periodType)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to fetch trends",
		})
	}

	return c.JSON(fiber.Map{
		"trends": trends,
	})
}

// Categories returns category breakdown with previous month comparison.
func (h *ReportHandler) Categories(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)

	now := time.Now()
	refDate := c.Query("month", now.Format("2006-01-02"))
	periodType := c.Query("period", "monthly")

	comparisons, err := h.service.GetCategories(c.Context(), userID, refDate, periodType)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to fetch categories",
		})
	}

	return c.JSON(fiber.Map{
		"categoryComparisons": comparisons,
	})
}

// Export returns transactions as CSV for a given month.
func (h *ReportHandler) Export(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)

	now := time.Now()
	month := c.Query("month", now.Format("2006-01"))

	if _, err := time.Parse("2006-01", month); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Invalid month format, use YYYY-MM",
		})
	}

	csvData, err := h.service.ExportCSV(c.Context(), userID, month)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to export transactions",
		})
	}

	format := c.Query("format", "csv")
	if format == "csv" {
		c.Set("Content-Type", "text/csv")
		c.Set("Content-Disposition", fmt.Sprintf("attachment; filename=transactions_%s.csv", month))
		return c.SendString(csvData)
	}

	return c.JSON(fiber.Map{
		"data":  csvData,
		"month": month,
	})
}