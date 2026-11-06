package services

import (
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/xuri/excelize/v2"

	"github.com/Lorredo/fintrack/api/internal/models"
)

const (
	summarySheet      = "Summary"
	transactionsSheet = "Transactions"
	allTimeStartDate  = "2000-01-01"
	pesoFormat        = `"₱"#,##0.00`
)

type workbookStyles struct {
	title, subtitle, label, header, money, moneyBold, percent, date, text int
}

// BuildReportWorkbook renders the rows as a two-sheet .xlsx: a summary with
// totals and spending by category, and the full transaction list.
func BuildReportWorkbook(rows []models.ExportRow, startDate, endDate string) ([]byte, error) {
	f := excelize.NewFile()
	defer f.Close()

	styles, err := newWorkbookStyles(f)
	if err != nil {
		return nil, err
	}
	if err := f.SetSheetName("Sheet1", summarySheet); err != nil {
		return nil, err
	}
	if _, err := f.NewSheet(transactionsSheet); err != nil {
		return nil, err
	}
	if err := writeSummarySheet(f, styles, rows, startDate, endDate); err != nil {
		return nil, err
	}
	if err := writeTransactionsSheet(f, styles, rows); err != nil {
		return nil, err
	}

	buffer, err := f.WriteToBuffer()
	if err != nil {
		return nil, err
	}
	return buffer.Bytes(), nil
}

func newWorkbookStyles(f *excelize.File) (workbookStyles, error) {
	var styles workbookStyles
	moneyFormat := pesoFormat
	dateFormat := "mmm d, yyyy"
	definitions := []struct {
		target *int
		style  excelize.Style
	}{
		{&styles.title, excelize.Style{Font: &excelize.Font{Bold: true, Size: 18, Color: "111827"}}},
		{&styles.subtitle, excelize.Style{Font: &excelize.Font{Size: 11, Color: "6B7280"}}},
		{&styles.label, excelize.Style{Font: &excelize.Font{Bold: true, Size: 11, Color: "111827"}}},
		{&styles.header, excelize.Style{
			Font:      &excelize.Font{Bold: true, Color: "FFFFFF"},
			Fill:      excelize.Fill{Type: "pattern", Color: []string{"2563EB"}, Pattern: 1},
			Alignment: &excelize.Alignment{Vertical: "center"},
		}},
		{&styles.money, excelize.Style{CustomNumFmt: &moneyFormat}},
		{&styles.moneyBold, excelize.Style{CustomNumFmt: &moneyFormat, Font: &excelize.Font{Bold: true}}},
		{&styles.percent, excelize.Style{NumFmt: 10}},
		{&styles.date, excelize.Style{CustomNumFmt: &dateFormat, Alignment: &excelize.Alignment{Horizontal: "left"}}},
		{&styles.text, excelize.Style{Alignment: &excelize.Alignment{WrapText: true, Vertical: "top"}}},
	}
	for _, definition := range definitions {
		style := definition.style
		id, err := f.NewStyle(&style)
		if err != nil {
			return styles, err
		}
		*definition.target = id
	}
	return styles, nil
}

type categoryTotal struct {
	name  string
	total float64
}

func summarizeRows(rows []models.ExportRow) (income, expense float64, categories []categoryTotal) {
	totals := make(map[string]float64)
	for _, row := range rows {
		switch row.Type {
		case "income":
			income += row.Amount
		case "expense":
			expense += row.Amount
			totals[row.Category] += row.Amount
		}
	}
	for name, total := range totals {
		categories = append(categories, categoryTotal{name, total})
	}
	sort.Slice(categories, func(i, j int) bool {
		if categories[i].total != categories[j].total {
			return categories[i].total > categories[j].total
		}
		return categories[i].name < categories[j].name
	})
	return income, expense, categories
}

func formatReportPeriod(startDate, endDate string) string {
	if startDate == allTimeStartDate {
		return "All Time"
	}
	format := func(value string) string {
		date, err := time.Parse("2006-01-02", value)
		if err != nil {
			return value
		}
		return date.Format("Jan 2, 2006")
	}
	if startDate == endDate {
		return format(startDate)
	}
	return format(startDate) + " - " + format(endDate)
}

func writeSummarySheet(f *excelize.File, styles workbookStyles, rows []models.ExportRow, startDate, endDate string) error {
	income, expense, categories := summarizeRows(rows)
	sheet := summarySheet

	type cell struct {
		ref   string
		value interface{}
		style int
	}
	cells := []cell{
		{"A1", "FinTrack Financial Report", styles.title},
		{"A2", formatReportPeriod(startDate, endDate), styles.subtitle},
		{"A4", "Income", styles.label},
		{"B4", income, styles.money},
		{"A5", "Expenses", styles.label},
		{"B5", expense, styles.money},
		{"A6", "Net", styles.label},
		{"B6", income - expense, styles.moneyBold},
		{"A7", "Transactions", styles.label},
		{"B7", len(rows), 0},
	}

	if len(categories) > 0 {
		cells = append(cells,
			cell{"A9", "Spending by Category", styles.header},
			cell{"B9", "Amount", styles.header},
			cell{"C9", "Share", styles.header},
		)
		for i, category := range categories {
			row := 10 + i
			cells = append(cells,
				cell{fmt.Sprintf("A%d", row), category.name, 0},
				cell{fmt.Sprintf("B%d", row), category.total, styles.money},
				cell{fmt.Sprintf("C%d", row), category.total / expense, styles.percent},
			)
		}
	}

	for _, c := range cells {
		if err := f.SetCellValue(sheet, c.ref, c.value); err != nil {
			return err
		}
		if c.style != 0 {
			if err := f.SetCellStyle(sheet, c.ref, c.ref, c.style); err != nil {
				return err
			}
		}
	}

	if err := f.SetColWidth(sheet, "A", "A", 30); err != nil {
		return err
	}
	return f.SetColWidth(sheet, "B", "C", 16)
}

func writeTransactionsSheet(f *excelize.File, styles workbookStyles, rows []models.ExportRow) error {
	sheet := transactionsSheet
	headers := []string{"Date", "Type", "Category", "Description", "Wallet", "Amount"}
	widths := []float64{14, 11, 22, 34, 22, 15}

	for i, header := range headers {
		ref, err := excelize.CoordinatesToCellName(i+1, 1)
		if err != nil {
			return err
		}
		if err := f.SetCellStr(sheet, ref, header); err != nil {
			return err
		}
		column, err := excelize.ColumnNumberToName(i + 1)
		if err != nil {
			return err
		}
		if err := f.SetColWidth(sheet, column, column, widths[i]); err != nil {
			return err
		}
	}
	if err := f.SetCellStyle(sheet, "A1", "F1", styles.header); err != nil {
		return err
	}

	for i, row := range rows {
		number := i + 2
		date, err := time.Parse("2006-01-02", row.Date)
		if err != nil {
			return err
		}
		if err := f.SetCellValue(sheet, fmt.Sprintf("A%d", number), date); err != nil {
			return err
		}
		// SetCellStr keeps user text as text, so a description starting with
		// "=" can't become a formula.
		for column, value := range map[string]string{
			"B": titleCase(row.Type),
			"C": row.Category,
			"D": row.Description,
			"E": row.Wallet,
		} {
			if err := f.SetCellStr(sheet, fmt.Sprintf("%s%d", column, number), value); err != nil {
				return err
			}
		}
		if err := f.SetCellValue(sheet, fmt.Sprintf("F%d", number), row.Amount); err != nil {
			return err
		}
	}

	last := len(rows) + 1
	if len(rows) > 0 {
		if err := f.SetCellStyle(sheet, "A2", fmt.Sprintf("A%d", last), styles.date); err != nil {
			return err
		}
		if err := f.SetCellStyle(sheet, "D2", fmt.Sprintf("D%d", last), styles.text); err != nil {
			return err
		}
		if err := f.SetCellStyle(sheet, "F2", fmt.Sprintf("F%d", last), styles.money); err != nil {
			return err
		}
	}

	if err := f.AutoFilter(sheet, fmt.Sprintf("A1:F%d", last), nil); err != nil {
		return err
	}
	return f.SetPanes(sheet, &excelize.Panes{
		Freeze:      true,
		YSplit:      1,
		TopLeftCell: "A2",
		ActivePane:  "bottomLeft",
	})
}

func titleCase(value string) string {
	if value == "" {
		return value
	}
	return strings.ToUpper(value[:1]) + value[1:]
}
