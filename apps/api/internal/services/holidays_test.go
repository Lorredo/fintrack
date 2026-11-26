package services

import "testing"

func TestEasterSunday(t *testing.T) {
	want := map[int]string{
		2025: "2025-04-20", 2026: "2026-04-05", 2027: "2027-03-28",
		2028: "2028-04-16", 2029: "2029-04-01", 2030: "2030-04-21",
	}
	for year, date := range want {
		if got := FormatDay(easterSunday(year)); got != date {
			t.Errorf("Easter %d = %s, want %s", year, got, date)
		}
	}
}

func TestPhHoliday(t *testing.T) {
	cases := map[string]string{
		"2026-11-30": "Bonifacio Day",
		"2026-12-30": "Rizal Day",
		"2026-04-02": "Maundy Thursday",
		"2026-04-03": "Good Friday",
		"2027-03-27": "Black Saturday",
		"2026-08-31": "National Heroes Day",
		"2027-08-30": "National Heroes Day",
		"2026-02-17": "Chinese New Year",
	}
	for date, name := range cases {
		if got, ok := phHoliday(mustDay(t, date)); !ok || got != name {
			t.Errorf("%s = %q, want %q", date, got, name)
		}
	}
	for _, date := range []string{"2026-11-27", "2026-08-24", "2026-12-15"} {
		if name, ok := phHoliday(mustDay(t, date)); ok {
			t.Errorf("%s is not a holiday, got %q", date, name)
		}
	}
}

func TestPreviousWorkingDay(t *testing.T) {
	cases := []struct{ name, day, want string }{
		{"working day stays", "2026-12-15", "2026-12-15"},
		{"Saturday", "2026-08-15", "2026-08-14"},
		{"Sunday", "2026-08-30", "2026-08-28"},
		{"holiday Monday", "2026-11-30", "2026-11-27"},
		{"holiday Wednesday", "2026-12-30", "2026-12-29"},
		{"through New Year's Eve and Rizal Day", "2027-01-01", "2026-12-29"},
		{"through Holy Week", "2027-03-26", "2027-03-24"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := FormatDay(PreviousWorkingDay(mustDay(t, tc.day))); got != tc.want {
				t.Errorf("got %s, want %s", got, tc.want)
			}
		})
	}
}

func TestPaydayNote(t *testing.T) {
	if got := PaydayNote(mustDay(t, "2026-11-30"), mustDay(t, "2026-11-27")); got != "Moved from Nov 30 · Bonifacio Day" {
		t.Errorf("holiday: got %q", got)
	}
	if got := PaydayNote(mustDay(t, "2026-11-15"), mustDay(t, "2026-11-13")); got != "Moved from Nov 15 · Sunday" {
		t.Errorf("weekend: got %q", got)
	}
	if got := PaydayNote(mustDay(t, "2026-12-15"), mustDay(t, "2026-12-15")); got != "" {
		t.Errorf("not moved: got %q", got)
	}
}
