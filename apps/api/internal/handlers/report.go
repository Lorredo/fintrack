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

func getFilters(c *fiber.Ctx) (string, string, string, string) {
	now := time.Now()
	startDate := c.Query("startDate", time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC).Format("2006-01-02"))
	endDate := c.Query("endDate", now.Format("2006-01-02"))
	accountId := c.Query("accountId", "")
	txType := c.Query("type", "")
	return startDate, endDate, accountId, txType
}

func (h *ReportHandler) Trends(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)
	startDate, endDate, accountId, txType := getFilters(c)

	trends, err := h.service.GetTrends(c.Context(), userID, startDate, endDate, accountId, txType)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to fetch trends",
		})
	}

	return c.JSON(fiber.Map{
		"trends": trends,
	})
}

func (h *ReportHandler) Categories(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)
	startDate, endDate, accountId, txType := getFilters(c)

	comparisons, err := h.service.GetCategories(c.Context(), userID, startDate, endDate, accountId, txType)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to fetch categories",
		})
	}

	return c.JSON(fiber.Map{
		"categoryComparisons": comparisons,
	})
}

func (h *ReportHandler) Export(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)
	startDate, endDate, accountId, txType := getFilters(c)

	csvData, err := h.service.ExportCSV(c.Context(), userID, startDate, endDate, accountId, txType)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to export transactions",
		})
	}

	format := c.Query("format", "csv")
	if format == "csv" {
		c.Set("Content-Type", "text/csv")
		c.Set("Content-Disposition", fmt.Sprintf("attachment; filename=transactions_%s_to_%s.csv", startDate, endDate))
		return c.SendString(csvData)
	}

	return c.JSON(fiber.Map{
		"data":  csvData,
		"startDate": startDate,
		"endDate": endDate,
	})
}
