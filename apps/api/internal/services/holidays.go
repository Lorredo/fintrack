package services

import "time"

// Philippine non-working days, for moving paydays to the working day before.
// Banks close on special non-working days too, so those count as well.

type monthDay struct {
	month time.Month
	day   int
}

// phFixedHolidays fall on the same date every year.
var phFixedHolidays = map[monthDay]string{
	{time.January, 1}:   "New Year's Day",
	{time.April, 9}:     "Araw ng Kagitingan",
	{time.May, 1}:       "Labor Day",
	{time.June, 12}:     "Independence Day",
	{time.August, 21}:   "Ninoy Aquino Day",
	{time.November, 1}:  "All Saints' Day",
	{time.November, 30}: "Bonifacio Day",
	{time.December, 8}:  "Immaculate Conception",
	{time.December, 24}: "Christmas Eve",
	{time.December, 25}: "Christmas Day",
	{time.December, 30}: "Rizal Day",
	{time.December, 31}: "Last Day of the Year",
}

// phDeclaredHolidays are set each year by proclamation (Proclamation 1006 for
// 2026, 1427 for 2027). Eid'l Fitr and Eid'l Adha are declared separately
// during the year; add them here once announced.
var phDeclaredHolidays = map[string]string{
	"2026-02-17": "Chinese New Year",
	"2026-11-02": "All Souls' Day",
	"2027-02-06": "Chinese New Year",
	"2027-11-02": "All Souls' Day",
}

// easterSunday uses the anonymous Gregorian algorithm.
func easterSunday(year int) time.Time {
	a := year % 19
	b, c := year/100, year%100
	d, e := b/4, b%4
	f := (b + 8) / 25
	g := (b - f + 1) / 3
	h := (19*a + b - d - g + 15) % 30
	i, k := c/4, c%4
	l := (32 + 2*e + 2*i - h - k) % 7
	m := (a + 11*h + 22*l) / 451
	month := (h + l - 7*m + 114) / 31
	day := (h+l-7*m+114)%31 + 1
	return dayOf(year, time.Month(month), day)
}

// phHoliday names the holiday on a day, if there is one.
func phHoliday(day time.Time) (string, bool) {
	if name, ok := phFixedHolidays[monthDay{day.Month(), day.Day()}]; ok {
		return name, true
	}
	if name, ok := phDeclaredHolidays[FormatDay(day)]; ok {
		return name, true
	}
	switch DaysBetween(easterSunday(day.Year()), day) {
	case -3:
		return "Maundy Thursday", true
	case -2:
		return "Good Friday", true
	case -1:
		return "Black Saturday", true
	}
	// National Heroes Day is the last Monday of August.
	if day.Month() == time.August && day.Weekday() == time.Monday && day.Day() > 24 {
		return "National Heroes Day", true
	}
	return "", false
}

// IsWorkingDay is false on weekends and Philippine holidays.
func IsWorkingDay(day time.Time) bool {
	if day.Weekday() == time.Saturday || day.Weekday() == time.Sunday {
		return false
	}
	_, holiday := phHoliday(day)
	return !holiday
}

// PreviousWorkingDay is day itself when it's a working day, or else the
// closest working day before it.
func PreviousWorkingDay(day time.Time) time.Time {
	for !IsWorkingDay(day) {
		day = day.AddDate(0, 0, -1)
	}
	return day
}

// PaydayNote explains why a payday moved, such as "Moved from Nov 30 ·
// Bonifacio Day", or is empty when it didn't.
func PaydayNote(scheduled, actual time.Time) string {
	if scheduled.Equal(actual) {
		return ""
	}
	reason := scheduled.Weekday().String()
	if name, ok := phHoliday(scheduled); ok {
		reason = name
	}
	return "Moved from " + scheduled.Format("Jan 2") + " · " + reason
}
