package services

import (
	"bytes"
	"strings"
	"testing"

	"github.com/xuri/excelize/v2"

	"github.com/Lorredo/fintrack/api/internal/models"
)

func openWorkbook(t *testing.T, rows []models.ExportRow, start, end string) *excelize.File {
	t.Helper()
	data, err := BuildReportWorkbook(rows, start, end)
	if err != nil {
		t.Fatalf("BuildReportWorkbook: %v", err)
	}
	f, err := excelize.OpenReader(bytes.NewReader(data))
	if err != nil {
		t.Fatalf("open workbook: %v", err)
	}
	t.Cleanup(func() { _ = f.Close() })
	return f
}

func cellValue(t *testing.T, f *excelize.File, sheet, ref string) string {
	t.Helper()
	value, err := f.GetCellValue(sheet, ref)
	if err != nil {
		t.Fatalf("GetCellValue %s!%s: %v", sheet, ref, err)
	}
	return value
}

func TestBuildReportWorkbook(t *testing.T) {
	rows := []models.ExportRow{
		{Date: "2026-11-30", Type: "income", Amount: 1000, Category: "Salary", Wallet: "Main"},
		{Date: "2026-11-02", Type: "expense", Amount: 250.5, Category: "Food, Drinks", Description: "=SUM(A1)", Wallet: "Main"},
		{Date: "2026-11-01", Type: "expense", Amount: 749.5, Category: "Housing", Wallet: "Main"},
		{Date: "2026-11-01", Type: "transfer", Amount: 500, Category: "Transfer", Wallet: "Main → Savings"},
		{Date: "2026-11-01", Type: "adjust_out", Amount: 70, Category: "Balance Adjustment", Wallet: "Main"},
	}
	f := openWorkbook(t, rows, "2026-11-01", "2026-11-30")

	if got := f.GetSheetList(); strings.Join(got, ",") != "Summary,Transactions" {
		t.Fatalf("sheets = %v", got)
	}

	summary := map[string]string{
		"A2":  "Nov 1, 2026 - Nov 30, 2026",
		"B4":  "₱1,000.00",
		"B5":  "₱1,000.00", // transfers and adjustments are not spending
		"B6":  "₱0.00",
		"B7":  "5",
		"A10": "Housing", // largest category first
		"B10": "₱749.50",
		"C10": "74.95%",
		"A11": "Food, Drinks",
	}
	for ref, want := range summary {
		if got := cellValue(t, f, "Summary", ref); got != want {
			t.Errorf("Summary!%s = %q, want %q", ref, got, want)
		}
	}

	transactions := map[string]string{
		"A1": "Date",
		"A2": "Nov 30, 2026",
		"B2": "Income",
		"D2": "",
		"F3": "₱250.50",
		"E5": "Main → Savings",
		"B6": "Adjustment",
	}
	for ref, want := range transactions {
		if got := cellValue(t, f, "Transactions", ref); got != want {
			t.Errorf("Transactions!%s = %q, want %q", ref, got, want)
		}
	}

	// User text stays text rather than becoming a formula.
	if formula, err := f.GetCellFormula("Transactions", "D3"); err != nil || formula != "" {
		t.Errorf("Transactions!D3 formula = %q, err = %v", formula, err)
	}
	if got := cellValue(t, f, "Transactions", "D3"); got != "=SUM(A1)" {
		t.Errorf("Transactions!D3 = %q", got)
	}
}

func TestBuildReportWorkbookWithNoRows(t *testing.T) {
	f := openWorkbook(t, nil, "2000-01-01", "2026-11-30")

	if got := cellValue(t, f, "Summary", "A2"); got != "All Time" {
		t.Errorf("Summary!A2 = %q", got)
	}
	if got := cellValue(t, f, "Summary", "A9"); got != "" {
		t.Errorf("Summary!A9 = %q, want no category table", got)
	}
}
