package services

import (
	"time"

	"github.com/Lorredo/fintrack/api/internal/models"
)

// Dates here are calendar days: midnight UTC stands for the user's local date,
// which the app sends, so the server's own time zone never shifts a day.

const dateLayout = "2006-01-02"

const (
	FrequencyWeekly  = "weekly"
	FrequencyMonthly = "monthly"
	FrequencyYearly  = "yearly"

	PayScheduleSemiMonthly = "semi_monthly"
	PayScheduleIrregular   = "irregular"
)

// ParseDay reads a YYYY-MM-DD date as a calendar day.
func ParseDay(value string) (time.Time, error) {
	return time.Parse(dateLayout, value)
}

func FormatDay(day time.Time) string {
	return day.Format(dateLayout)
}

func dayOf(year int, month time.Month, day int) time.Time {
	return time.Date(year, month, day, 0, 0, 0, 0, time.UTC)
}

func daysInMonth(year int, month time.Month) int {
	return dayOf(year, month+1, 0).Day()
}

// clampedDay is the given day of a month, or the month's last day when the
// month is shorter (the 31st in February is the 28th or 29th).
func clampedDay(year int, month time.Month, day int) time.Time {
	if last := daysInMonth(year, month); day > last {
		day = last
	}
	return dayOf(year, month, day)
}

// Occurrence returns the n-th due date (n = 0 is start). Monthly and yearly
// dates always come from start, so a bill due on the 31st returns to the 31st
// after a short month instead of drifting.
func Occurrence(start time.Time, frequency string, n int) time.Time {
	switch frequency {
	case FrequencyWeekly:
		return start.AddDate(0, 0, 7*n)
	case FrequencyYearly:
		return clampedDay(start.Year()+n, start.Month(), start.Day())
	default:
		months := int(start.Month()) - 1 + n
		return clampedDay(start.Year()+months/12, time.Month(months%12+1), start.Day())
	}
}

// Occurrences lists due dates from start up to and including until.
func Occurrences(start time.Time, frequency string, until time.Time) []time.Time {
	var dates []time.Time
	for n := 0; ; n++ {
		date := Occurrence(start, frequency, n)
		if date.After(until) {
			return dates
		}
		dates = append(dates, date)
	}
}

// PayPeriod is the stretch Safe to Spend covers: from the last payday up to,
// but not including, the next one.
type PayPeriod struct {
	Start      time.Time
	NextPayday time.Time
}

// semiMonthlyPaydays are the 15th and the 30th, which is the month's last day
// in February.
func semiMonthlyPaydays(year int, month time.Month) [2]time.Time {
	return [2]time.Time{dayOf(year, month, 15), clampedDay(year, month, 30)}
}

// CurrentPayPeriod finds the period that today falls in. On a payday, a new
// period starts that day. Irregular pay counts to the end of the month.
func CurrentPayPeriod(schedule string, today time.Time) PayPeriod {
	year, month := today.Year(), today.Month()

	if schedule != PayScheduleSemiMonthly {
		return PayPeriod{
			Start:      dayOf(year, month, 1),
			NextPayday: dayOf(year, month+1, 1),
		}
	}

	this := semiMonthlyPaydays(year, month)
	switch {
	case today.Before(this[0]):
		previous := semiMonthlyPaydays(year, month-1)
		return PayPeriod{Start: previous[1], NextPayday: this[0]}
	case today.Before(this[1]):
		return PayPeriod{Start: this[0], NextPayday: this[1]}
	default:
		next := semiMonthlyPaydays(year, month+1)
		return PayPeriod{Start: this[1], NextPayday: next[0]}
	}
}

// DaysBetween counts whole days from a to b.
func DaysBetween(a, b time.Time) int {
	return int(b.Sub(a).Hours() / 24)
}

// RegularIncomeDate is the day a regular income arrives in a given month:
// day N (clamped to the month's end), or the Nth weekday, where Nth 5 is the
// last one in the month.
func RegularIncomeDate(income models.RegularIncome, year int, month time.Month) time.Time {
	if income.Kind != models.RegularIncomeByWeekday {
		return clampedDay(year, month, income.Day)
	}
	weekday := time.Weekday(income.Weekday)
	if income.Nth >= 5 {
		last := clampedDay(year, month, 31)
		return last.AddDate(0, 0, -((int(last.Weekday()) - int(weekday) + 7) % 7))
	}
	first := dayOf(year, month, 1)
	offset := (int(weekday) - int(first.Weekday()) + 7) % 7
	return first.AddDate(0, 0, offset+7*(max(income.Nth, 1)-1))
}

// RegularIncomeInPeriod lists regular income arriving within the period,
// which can span two months (for example Oct 30 to Nov 14).
func RegularIncomeInPeriod(incomes []models.RegularIncome, period PayPeriod) []models.ExpectedIncome {
	expected := make([]models.ExpectedIncome, 0)
	lastDay := period.NextPayday.AddDate(0, 0, -1)
	for _, income := range incomes {
		months := []time.Time{dayOf(period.Start.Year(), period.Start.Month(), 1)}
		if lastDay.Month() != period.Start.Month() || lastDay.Year() != period.Start.Year() {
			months = append(months, dayOf(lastDay.Year(), lastDay.Month(), 1))
		}
		for _, month := range months {
			date := RegularIncomeDate(income, month.Year(), month.Month())
			if !date.Before(period.Start) && date.Before(period.NextPayday) {
				expected = append(expected, models.ExpectedIncome{Name: income.Name, Amount: income.Amount, Date: FormatDay(date)})
			}
		}
	}
	return expected
}

// PaluwaganRoundDate is the date of round n (1-based). Monthly rounds keep the
// start day like bills; semi-monthly rounds alternate between the 15th and
// the 30th (the month's last day in February), starting from the start date.
func PaluwaganRoundDate(start time.Time, frequency string, round int) time.Time {
	n := round - 1
	switch frequency {
	case models.PaluwaganWeekly:
		return start.AddDate(0, 0, 7*n)
	case models.PaluwaganSemiMonthly:
		date := start
		for i := 0; i < n; i++ {
			date = nextSemiMonthlyPayday(date)
		}
		return date
	default:
		return Occurrence(start, FrequencyMonthly, n)
	}
}

// nextSemiMonthlyPayday is the first 15th or 30th after date.
func nextSemiMonthlyPayday(date time.Time) time.Time {
	this := semiMonthlyPaydays(date.Year(), date.Month())
	for _, payday := range this {
		if payday.After(date) {
			return payday
		}
	}
	return semiMonthlyPaydays(date.Year(), date.Month()+1)[0]
}
