package services

import (
	"testing"
	"time"

	"github.com/Lorredo/fintrack/api/internal/models"
)

func mustDay(t *testing.T, value string) time.Time {
	t.Helper()
	day, err := ParseDay(value)
	if err != nil {
		t.Fatalf("bad test date %q: %v", value, err)
	}
	return day
}

func TestOccurrence(t *testing.T) {
	cases := []struct {
		name, start, frequency string
		n                      int
		want                   string
	}{
		{"monthly first", "2026-01-31", FrequencyMonthly, 0, "2026-01-31"},
		{"31st in February", "2026-01-31", FrequencyMonthly, 1, "2026-02-28"},
		{"back to the 31st", "2026-01-31", FrequencyMonthly, 2, "2026-03-31"},
		{"30-day month", "2026-01-31", FrequencyMonthly, 3, "2026-04-30"},
		{"leap February", "2028-01-31", FrequencyMonthly, 1, "2028-02-29"},
		{"across the year", "2026-11-15", FrequencyMonthly, 3, "2027-02-15"},
		{"many months", "2026-01-10", FrequencyMonthly, 25, "2028-02-10"},
		{"weekly", "2026-11-02", FrequencyWeekly, 2, "2026-11-16"},
		{"weekly across months", "2026-11-30", FrequencyWeekly, 1, "2026-12-07"},
		{"yearly", "2026-03-10", FrequencyYearly, 1, "2027-03-10"},
		{"yearly from Feb 29", "2028-02-29", FrequencyYearly, 1, "2029-02-28"},
		{"yearly back to Feb 29", "2028-02-29", FrequencyYearly, 4, "2032-02-29"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := FormatDay(Occurrence(mustDay(t, tc.start), tc.frequency, tc.n))
			if got != tc.want {
				t.Errorf("Occurrence(%s, %s, %d) = %s, want %s", tc.start, tc.frequency, tc.n, got, tc.want)
			}
		})
	}
}

func TestOccurrences(t *testing.T) {
	got := Occurrences(mustDay(t, "2026-11-05"), FrequencyMonthly, mustDay(t, "2027-01-05"))
	want := []string{"2026-11-05", "2026-12-05", "2027-01-05"}
	if len(got) != len(want) {
		t.Fatalf("got %d dates, want %d", len(got), len(want))
	}
	for i := range want {
		if FormatDay(got[i]) != want[i] {
			t.Errorf("date %d = %s, want %s", i, FormatDay(got[i]), want[i])
		}
	}

	if dates := Occurrences(mustDay(t, "2026-12-01"), FrequencyMonthly, mustDay(t, "2026-11-30")); len(dates) != 0 {
		t.Errorf("a bill that starts later has no due dates yet, got %d", len(dates))
	}
}

func TestCurrentPayPeriod(t *testing.T) {
	cases := []struct {
		name, schedule, today string
		start, next           string
	}{
		{"before the 15th", PayScheduleSemiMonthly, "2026-11-09", "2026-10-30", "2026-11-15"},
		{"the 14th", PayScheduleSemiMonthly, "2026-11-14", "2026-10-30", "2026-11-15"},
		{"on the 15th", PayScheduleSemiMonthly, "2026-11-15", "2026-11-15", "2026-11-30"},
		{"the 16th", PayScheduleSemiMonthly, "2026-11-16", "2026-11-15", "2026-11-30"},
		{"on the 30th", PayScheduleSemiMonthly, "2026-11-30", "2026-11-30", "2026-12-15"},
		{"the 31st", PayScheduleSemiMonthly, "2026-12-31", "2026-12-30", "2027-01-15"},
		{"early January", PayScheduleSemiMonthly, "2027-01-03", "2026-12-30", "2027-01-15"},
		{"late February", PayScheduleSemiMonthly, "2027-02-20", "2027-02-15", "2027-02-28"},
		{"on Feb 28", PayScheduleSemiMonthly, "2027-02-28", "2027-02-28", "2027-03-15"},
		{"early March", PayScheduleSemiMonthly, "2027-03-01", "2027-02-28", "2027-03-15"},
		{"leap February", PayScheduleSemiMonthly, "2028-02-28", "2028-02-15", "2028-02-29"},
		{"irregular", PayScheduleIrregular, "2026-11-09", "2026-11-01", "2026-12-01"},
		{"irregular in December", PayScheduleIrregular, "2026-12-31", "2026-12-01", "2027-01-01"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			period := CurrentPayPeriod(tc.schedule, mustDay(t, tc.today))
			if got := FormatDay(period.Start); got != tc.start {
				t.Errorf("start = %s, want %s", got, tc.start)
			}
			if got := FormatDay(period.NextPayday); got != tc.next {
				t.Errorf("next payday = %s, want %s", got, tc.next)
			}
		})
	}
}

func TestDaysBetween(t *testing.T) {
	if got := DaysBetween(mustDay(t, "2026-11-09"), mustDay(t, "2026-11-15")); got != 6 {
		t.Errorf("got %d, want 6", got)
	}
	if got := DaysBetween(mustDay(t, "2027-02-27"), mustDay(t, "2027-03-15")); got != 16 {
		t.Errorf("got %d, want 16", got)
	}
}

func TestRegularIncomeDate(t *testing.T) {
	friday := models.RegularIncome{Kind: models.RegularIncomeByWeekday, Nth: 1, Weekday: int(time.Friday)}
	lastMonday := models.RegularIncome{Kind: models.RegularIncomeByWeekday, Nth: 5, Weekday: int(time.Monday)}
	cases := []struct {
		name   string
		income models.RegularIncome
		year   int
		month  time.Month
		want   string
	}{
		{"first Friday of Nov", friday, 2026, time.November, "2026-11-06"},
		{"first Friday of Dec", friday, 2026, time.December, "2026-12-04"},
		{"first Friday on the 1st", friday, 2027, time.January, "2027-01-01"},
		{"second Friday", models.RegularIncome{Kind: models.RegularIncomeByWeekday, Nth: 2, Weekday: int(time.Friday)}, 2026, time.November, "2026-11-13"},
		{"last Monday", lastMonday, 2026, time.November, "2026-11-30"},
		{"last Monday not on the 31st", lastMonday, 2026, time.December, "2026-12-28"},
		{"day 15", models.RegularIncome{Kind: models.RegularIncomeByDay, Day: 15}, 2026, time.November, "2026-11-15"},
		{"day 31 in February", models.RegularIncome{Kind: models.RegularIncomeByDay, Day: 31}, 2027, time.February, "2027-02-28"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := FormatDay(RegularIncomeDate(tc.income, tc.year, tc.month)); got != tc.want {
				t.Errorf("got %s, want %s", got, tc.want)
			}
		})
	}
}

func TestRegularIncomeInPeriod(t *testing.T) {
	incomes := []models.RegularIncome{
		{Name: "Augmentation", Amount: 2000, Kind: models.RegularIncomeByWeekday, Nth: 1, Weekday: int(time.Friday)},
		{Name: "Rice allowance", Amount: 1500, Kind: models.RegularIncomeByDay, Day: 15},
	}
	// Oct 30 to Nov 14 spans two months: augmentation on Nov 6, no rice allowance.
	got := RegularIncomeInPeriod(incomes, CurrentPayPeriod(PayScheduleSemiMonthly, mustDay(t, "2026-11-09")))
	if len(got) != 1 || got[0].Name != "Augmentation" || got[0].Date != "2026-11-06" {
		t.Errorf("Oct 30 to Nov 14: got %+v", got)
	}
	// Nov 15 to Nov 29: rice allowance on the 15th.
	got = RegularIncomeInPeriod(incomes, CurrentPayPeriod(PayScheduleSemiMonthly, mustDay(t, "2026-11-20")))
	if len(got) != 1 || got[0].Name != "Rice allowance" || got[0].Date != "2026-11-15" {
		t.Errorf("Nov 15 to Nov 29: got %+v", got)
	}
	// Irregular pay covers the whole month, so both arrive.
	if got = RegularIncomeInPeriod(incomes, CurrentPayPeriod(PayScheduleIrregular, mustDay(t, "2026-11-20"))); len(got) != 2 {
		t.Errorf("whole month: got %+v", got)
	}
}

func TestPaluwaganRoundDate(t *testing.T) {
	cases := []struct {
		name, start, frequency string
		round                  int
		want                   string
	}{
		{"weekly round 1", "2026-11-06", models.PaluwaganWeekly, 1, "2026-11-06"},
		{"weekly round 3", "2026-11-06", models.PaluwaganWeekly, 3, "2026-11-20"},
		{"monthly on the 31st", "2026-01-31", models.PaluwaganMonthly, 2, "2026-02-28"},
		{"monthly back to the 31st", "2026-01-31", models.PaluwaganMonthly, 3, "2026-03-31"},
		{"semi-monthly from the 15th", "2026-11-15", models.PaluwaganSemiMonthly, 2, "2026-11-30"},
		{"semi-monthly into December", "2026-11-15", models.PaluwaganSemiMonthly, 3, "2026-12-15"},
		{"semi-monthly through February", "2027-02-15", models.PaluwaganSemiMonthly, 2, "2027-02-28"},
		{"semi-monthly after February", "2027-02-15", models.PaluwaganSemiMonthly, 3, "2027-03-15"},
		{"semi-monthly from the 30th", "2026-11-30", models.PaluwaganSemiMonthly, 2, "2026-12-15"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := FormatDay(PaluwaganRoundDate(mustDay(t, tc.start), tc.frequency, tc.round)); got != tc.want {
				t.Errorf("got %s, want %s", got, tc.want)
			}
		})
	}
}
