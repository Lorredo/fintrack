package services

import "time"

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
