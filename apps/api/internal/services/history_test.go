package services

import (
	"testing"
	"time"
)

func TestBasePeriodsBefore(t *testing.T) {
	// From the period that starts Nov 27, 2026, walk back through moved
	// paydays (Nov 15 is a Sunday, Oct 30 is a Friday).
	got := basePeriodsBefore(PayScheduleSemiMonthly, mustDay(t, "2026-11-27"), 3)
	want := [][2]string{{"2026-11-13", "2026-11-27"}, {"2026-10-30", "2026-11-13"}, {"2026-10-15", "2026-10-30"}}
	for i, w := range want {
		if FormatDay(got[i].Start) != w[0] || FormatDay(got[i].NextPayday) != w[1] {
			t.Errorf("period %d = %s to %s, want %s to %s", i, FormatDay(got[i].Start), FormatDay(got[i].NextPayday), w[0], w[1])
		}
	}
	// Through February: Feb 28, 2027 is a Sunday, so it's the 26th.
	got = basePeriodsBefore(PayScheduleSemiMonthly, mustDay(t, "2027-03-15"), 2)
	if FormatDay(got[0].Start) != "2027-02-26" || FormatDay(got[1].Start) != "2027-02-15" {
		t.Errorf("February: got %s and %s", FormatDay(got[0].Start), FormatDay(got[1].Start))
	}
	// Irregular pay goes month by month.
	got = basePeriodsBefore(PayScheduleIrregular, mustDay(t, "2026-11-01"), 2)
	if FormatDay(got[0].Start) != "2026-10-01" || FormatDay(got[1].Start) != "2026-09-01" {
		t.Errorf("irregular: got %s and %s", FormatDay(got[0].Start), FormatDay(got[1].Start))
	}
}

func TestChainPeriodsWithEarlyPay(t *testing.T) {
	bases := basePeriodsBefore(PayScheduleSemiMonthly, mustDay(t, "2026-12-15"), 2)
	// The Nov 30 salary (due Nov 27) came on Nov 25.
	early := map[string]time.Time{"2026-11-30": mustDay(t, "2026-11-25")}
	periods := chainPeriods(bases, early, mustDay(t, "2026-12-15"))
	if FormatDay(periods[0].start) != "2026-11-25" || FormatDay(periods[0].end) != "2026-12-15" {
		t.Errorf("paid early: %s to %s", FormatDay(periods[0].start), FormatDay(periods[0].end))
	}
	if FormatDay(periods[1].start) != "2026-11-13" || FormatDay(periods[1].end) != "2026-11-25" {
		t.Errorf("period before is cut short: %s to %s", FormatDay(periods[1].start), FormatDay(periods[1].end))
	}
}

func TestSummarizePeriod(t *testing.T) {
	period := historyPeriod{start: mustDay(t, "2026-11-13"), end: mustDay(t, "2026-11-27")}
	plan := &periodPlan{expected: 15000, savingsPerPayday: 2000, extraPercent: 50}

	// Salary ₱15,000 and overtime ₱2,000: ₱1,000 of the overtime is saved, so
	// spending money is 17,000 − 3,000 bills − 3,000 savings = 11,000.
	got := summarizePeriod(period, periodTotals{pay: 15000, other: 2000, spent: 10100, bills: 3000, savings: 3000}, plan, false)
	if got.End != "2026-11-26" || got.Received != 17000 || got.SpendingMoney != 11000 || got.Result != 900 || !got.HasPlan {
		t.Errorf("under plan: got %+v", got)
	}
	if got = summarizePeriod(period, periodTotals{pay: 15000, spent: 10600, bills: 3000}, plan, false); got.Result != -600 {
		t.Errorf("over plan: result %v, want -600", got.Result)
	}
	// Salary never recorded: still planned from the expected pay.
	if got = summarizePeriod(period, periodTotals{spent: 5000}, plan, false); !got.PayEstimated || got.Pay != 15000 {
		t.Errorf("salary not recorded: got %+v", got)
	}
	// Irregular: freelance income counts toward the expected amount, not extra.
	if got = summarizePeriod(period, periodTotals{other: 15000}, plan, true); got.ExtraIncome != 0 || got.Pay != 15000 {
		t.Errorf("irregular: got %+v", got)
	}
	// Without a plan, the result is what was kept.
	if got = summarizePeriod(period, periodTotals{pay: 10000, spent: 6000, bills: 1500}, nil, false); got.HasPlan || got.Result != 2500 {
		t.Errorf("no plan: got %+v", got)
	}
}

func TestTotalsForCountsOnlyThePeriod(t *testing.T) {
	period := historyPeriod{start: mustDay(t, "2026-11-13"), end: mustDay(t, "2026-11-15")}
	days := map[string]*periodTotals{
		"2026-11-12": {spent: 100},
		"2026-11-13": {pay: 15000, spent: 200},
		"2026-11-14": {bills: 500, spent: 300},
		"2026-11-15": {spent: 400},
	}
	got := totalsFor(period, days)
	if got.pay != 15000 || got.spent != 500 || got.bills != 500 {
		t.Errorf("got %+v", got)
	}
}
