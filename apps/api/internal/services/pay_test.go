package services

import (
	"testing"
	"time"

	"github.com/Lorredo/fintrack/api/internal/models"
)

func paySettingsForTest() *models.PaySettings {
	schedule := PayScheduleSemiMonthly
	return &models.PaySettings{
		PaySchedule:     &schedule,
		SalaryPerPayday: 15000,
		RegularIncomes: []models.RegularIncome{
			{Name: "Rice allowance", Amount: 1500, Kind: models.RegularIncomeByDay, Day: 15},
			{Name: "Augmentation", Amount: 2000, Kind: models.RegularIncomeByWeekday, Nth: 1, Weekday: int(time.Friday)},
		},
	}
}

func TestPayItemsUseMovedAndScheduledDates(t *testing.T) {
	items := payItemsInPeriod(paySettingsForTest(), CurrentPayPeriod(PayScheduleSemiMonthly, mustDay(t, "2026-11-26")))
	if len(items) != 2 {
		t.Fatalf("got %d items, want 2: %+v", len(items), items)
	}
	for _, item := range items {
		// Both are due on Sunday the 15th and arrive on Friday the 13th.
		if item.Date != "2026-11-13" || item.PayDate != "2026-11-15" {
			t.Errorf("%s: date %s, pay date %s", item.Key, item.Date, item.PayDate)
		}
	}
}

func TestFindPayItemAcceptsBothDates(t *testing.T) {
	settings := paySettingsForTest()
	cases := []struct{ key, date, payDate string }{
		{"salary", "2026-11-30", "2026-11-30"},
		{"salary", "2026-11-27", "2026-11-30"}, // sent by older app versions
		{"salary", "2026-11-15", "2026-11-15"}, // pay recorded before the change
		{"income:rice allowance", "2026-11-13", "2026-11-15"},
		{"income:rice allowance", "2026-11-15", "2026-11-15"},
		{"salary", "2026-12-30", "2026-12-30"},
	}
	for _, tc := range cases {
		item, err := findPayItem(settings, tc.key, mustDay(t, tc.date))
		if err != nil {
			t.Errorf("%s on %s: %v", tc.key, tc.date, err)
			continue
		}
		if item.PayDate != tc.payDate {
			t.Errorf("%s on %s: pay date %s, want %s", tc.key, tc.date, item.PayDate, tc.payDate)
		}
	}
	if _, err := findPayItem(settings, "salary", mustDay(t, "2026-11-20")); err != ErrNotAPayItem {
		t.Errorf("no salary on the 20th, got %v", err)
	}
}
