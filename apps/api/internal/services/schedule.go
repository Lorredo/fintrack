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

// Payday is a scheduled payday (the 15th or the 30th) and the day the pay
// actually comes: the working day before when it falls on a weekend or a
// holiday.
type Payday struct {
	Scheduled time.Time
	Date      time.Time
}

func paydayOf(scheduled time.Time) Payday {
	return Payday{Scheduled: scheduled, Date: PreviousWorkingDay(scheduled)}
}

// PayPeriod is the stretch Safe to Spend covers: from the last payday up to,
// but not including, the next one.
type PayPeriod struct {
	Start      time.Time
	NextPayday time.Time
	// The payday that opened the period and the one that ends it. Start is
	// Opening.Date unless the salary came early, and NextPayday is
	// Closing.Date. For irregular pay both are the month's boundaries.
	Opening Payday
	Closing Payday
}

// semiMonthlyPaydays are the 15th and the 30th (the month's last day in
// February), moved back to a working day when needed. A move never leaves the
// month or reorders the two.
func semiMonthlyPaydays(year int, month time.Month) [2]Payday {
	return [2]Payday{paydayOf(dayOf(year, month, 15)), paydayOf(clampedDay(year, month, 30))}
}

func periodBetween(opening, closing Payday) PayPeriod {
	return PayPeriod{Start: opening.Date, NextPayday: closing.Date, Opening: opening, Closing: closing}
}

// CurrentPayPeriod finds the period that today falls in. On a payday, a new
// period starts that day. Irregular pay counts to the end of the month.
func CurrentPayPeriod(schedule string, today time.Time) PayPeriod {
	year, month := today.Year(), today.Month()

	if schedule != PayScheduleSemiMonthly {
		first, next := dayOf(year, month, 1), dayOf(year, month+1, 1)
		return periodBetween(Payday{first, first}, Payday{next, next})
	}

	this := semiMonthlyPaydays(year, month)
	switch {
	case today.Before(this[0].Date):
		return periodBetween(semiMonthlyPaydays(year, month-1)[1], this[0])
	case today.Before(this[1].Date):
		return periodBetween(this[0], this[1])
	default:
		return periodBetween(this[1], semiMonthlyPaydays(year, month+1)[0])
	}
}

// PeriodAfter is the period that follows one.
func PeriodAfter(schedule string, period PayPeriod) PayPeriod {
	return CurrentPayPeriod(schedule, period.NextPayday)
}

// DaysBetween counts whole days from a to b.
func DaysBetween(a, b time.Time) int {
	return int(b.Sub(a).Hours() / 24)
}

// RegularIncomeDate is when a regular income is due in a given month. Day N
// (clamped to the month's end) moves back to a working day like the salary,
// since payroll pays it the same way. The Nth weekday, where Nth 5 is the last
// one in the month, stays as it is.
func RegularIncomeDate(income models.RegularIncome, year int, month time.Month) Payday {
	if income.Kind != models.RegularIncomeByWeekday {
		return paydayOf(clampedDay(year, month, income.Day))
	}
	date := nthWeekday(income, year, month)
	return Payday{Scheduled: date, Date: date}
}

func nthWeekday(income models.RegularIncome, year int, month time.Month) time.Time {
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
// which can span two months (for example Oct 30 to Nov 13). A date moved back
// from the next month can land in it too.
func RegularIncomeInPeriod(incomes []models.RegularIncome, period PayPeriod) []models.ExpectedIncome {
	expected := make([]models.ExpectedIncome, 0)
	for _, income := range incomes {
		for month := dayOf(period.Start.Year(), period.Start.Month(), 1); !month.After(period.NextPayday.AddDate(0, 0, 7)); month = month.AddDate(0, 1, 0) {
			due := RegularIncomeDate(income, month.Year(), month.Month())
			if !due.Date.Before(period.Start) && due.Date.Before(period.NextPayday) {
				expected = append(expected, models.ExpectedIncome{
					Name: income.Name, Amount: income.Amount, Date: FormatDay(due.Date), PayDate: FormatDay(due.Scheduled),
				})
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

// nextSemiMonthlyPayday is the first 15th or 30th after date, as scheduled:
// paluwagan rounds don't move for weekends or holidays.
func nextSemiMonthlyPayday(date time.Time) time.Time {
	this := semiMonthlyPaydays(date.Year(), date.Month())
	for _, payday := range this {
		if payday.Scheduled.After(date) {
			return payday.Scheduled
		}
	}
	return semiMonthlyPaydays(date.Year(), date.Month()+1)[0].Scheduled
}
