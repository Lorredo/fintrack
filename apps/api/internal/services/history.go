package services

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/Lorredo/fintrack/api/internal/models"
)

// Pay period history: how each past pay period turned out against its plan.
// The actual amounts come from transactions, so past periods show up without
// anything saved for them; only the plan is saved, in pay_period_plans.

const historyPageSize = 12

// periodPlan is what a period was planned with.
type periodPlan struct {
	expected         float64
	savingsPerPayday float64
	extraPercent     int
	estimated        bool
}

// periodTotals are a period's transactions from counted wallets, by kind.
type periodTotals struct {
	pay, other, spent, bills, savings float64
}

func (t *periodTotals) add(kind string, amount float64) {
	switch kind {
	case "pay":
		t.pay += amount
	case "other":
		t.other += amount
	case "spent":
		t.spent += amount
	case "bills":
		t.bills += amount
	case "savings":
		t.savings += amount
	}
}

// historyPeriod is a finished or current pay period: [start, end).
type historyPeriod struct {
	start, end time.Time
	base       PayPeriod
}

// basePeriodsBefore lists n pay periods, newest first, ending at the one that
// contains the day before cursor.
func basePeriodsBefore(schedule string, cursor time.Time, n int) []PayPeriod {
	periods := make([]PayPeriod, 0, n)
	for i := 0; i < n; i++ {
		period := CurrentPayPeriod(schedule, cursor.AddDate(0, 0, -1))
		periods = append(periods, period)
		cursor = period.Opening.Date
	}
	return periods
}

// chainPeriods turns base periods (newest first) into the stretches they
// actually covered. A salary recorded early (in early, by scheduled payday)
// starts its period that day and ends the one before it. The newest period
// ends at end.
func chainPeriods(bases []PayPeriod, early map[string]time.Time, end time.Time) []historyPeriod {
	periods := make([]historyPeriod, 0, len(bases))
	for _, base := range bases {
		start := base.Opening.Date
		if received, ok := early[FormatDay(base.Opening.Scheduled)]; ok && received.Before(start) {
			start = received
		}
		periods = append(periods, historyPeriod{start: start, end: end, base: base})
		end = start
	}
	return periods
}

// summarizePeriod works out one period. With a plan, the result is spending
// money (pay − bills − savings target) minus what was spent; without one, it
// is what was kept.
func summarizePeriod(period historyPeriod, totals periodTotals, plan *periodPlan, irregular bool) models.PayPeriodSummary {
	summary := models.PayPeriodSummary{
		Start:          FormatDay(period.start),
		End:            FormatDay(period.end.AddDate(0, 0, -1)),
		Received:       round2(totals.pay + totals.other),
		Bills:          round2(totals.bills),
		MovedToSavings: round2(totals.savings),
		Spent:          round2(totals.spent),
	}
	if plan == nil {
		summary.Result = round2(totals.pay + totals.other - totals.spent - totals.bills)
		return summary
	}

	payIncome, otherIncome := totals.pay, totals.other
	if irregular {
		payIncome, otherIncome = payIncome+otherIncome, 0
	}
	split := splitPay(plan.expected, payIncome, otherIncome, plan.extraPercent)
	summary.HasPlan = true
	summary.PlanEstimated = plan.estimated
	summary.Pay = round2(split.pay)
	summary.PayEstimated = split.estimated
	summary.ExtraIncome = round2(split.extra)
	summary.SavingsTarget = round2(plan.savingsPerPayday + split.extraSaved)
	summary.SpendingMoney = round2(split.pay - totals.bills - summary.SavingsTarget)
	summary.Result = round2(summary.SpendingMoney - totals.spent)
	return summary
}

// savePeriodPlan keeps the plan of the current period up to date. It writes
// only when something changed, so loading the dashboard normally writes
// nothing.
func (s *BillService) savePeriodPlan(ctx context.Context, userID string, period PayPeriod, expected float64, settings *models.PaySettings) error {
	_, err := s.db.Exec(ctx, `
		INSERT INTO pay_period_plans (user_id, period_key, expected_pay, savings_per_payday, extra_to_savings_percent)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (user_id, period_key) DO UPDATE
		SET expected_pay = EXCLUDED.expected_pay,
			savings_per_payday = EXCLUDED.savings_per_payday,
			extra_to_savings_percent = EXCLUDED.extra_to_savings_percent,
			updated_at = NOW()
		WHERE (pay_period_plans.expected_pay, pay_period_plans.savings_per_payday, pay_period_plans.extra_to_savings_percent)
			IS DISTINCT FROM (EXCLUDED.expected_pay, EXCLUDED.savings_per_payday, EXCLUDED.extra_to_savings_percent)`,
		userID, FormatDay(period.Opening.Scheduled), round2(expected), settings.SavingsPerPayday, settings.ExtraToSavingsPercent)
	return err
}

// earlyPayStarts maps scheduled paydays to the day their salary actually
// came, for salary recorded before payday.
func (s *BillService) earlyPayStarts(ctx context.Context, userID string, from, to time.Time) (map[string]time.Time, error) {
	rows, err := s.db.Query(ctx, `
		SELECT pay_date, received_on FROM pay_records
		WHERE user_id = $1 AND item_key = $2 AND received_on IS NOT NULL AND received_on < pay_date
			AND pay_date >= $3 AND pay_date <= $4`,
		userID, models.PayItemSalary, FormatDay(from), FormatDay(to))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	early := make(map[string]time.Time)
	for rows.Next() {
		var payDate, received time.Time
		if err := rows.Scan(&payDate, &received); err != nil {
			return nil, err
		}
		early[FormatDay(payDate)] = received
	}
	return early, rows.Err()
}

// savedPlans returns saved plans by period key.
func (s *BillService) savedPlans(ctx context.Context, userID string, from, to time.Time) (map[string]periodPlan, error) {
	rows, err := s.db.Query(ctx, `
		SELECT period_key, expected_pay, savings_per_payday, extra_to_savings_percent FROM pay_period_plans
		WHERE user_id = $1 AND period_key >= $2 AND period_key <= $3`,
		userID, FormatDay(from), FormatDay(to))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	plans := make(map[string]periodPlan)
	for rows.Next() {
		var key time.Time
		var plan periodPlan
		if err := rows.Scan(&key, &plan.expected, &plan.savingsPerPayday, &plan.extraPercent); err != nil {
			return nil, err
		}
		plans[FormatDay(key)] = plan
	}
	return plans, rows.Err()
}

// dailyTotals adds up counted-wallet transactions in [from, to) by day and
// kind, in one query for the whole page.
func (s *BillService) dailyTotals(ctx context.Context, userID string, from, to time.Time) (map[string]*periodTotals, error) {
	rows, err := s.db.Query(ctx, `
		SELECT t.date, k.kind, SUM(t.amount)
		FROM transactions t
		JOIN accounts a ON a.id = t.account_id
		LEFT JOIN accounts target ON target.id = t.transfer_account_id
		CROSS JOIN LATERAL (SELECT CASE
			WHEN t.type = 'income' AND LOWER(t.category) IN ($4, $5) THEN 'pay'
			WHEN t.type = 'income' THEN 'other'
			WHEN t.type = 'expense' AND EXISTS (SELECT 1 FROM bill_payments bp WHERE bp.transaction_id = t.id) THEN 'bills'
			WHEN t.type = 'expense' THEN 'spent'
			WHEN t.type = 'loan_out' AND (
				EXISTS (SELECT 1 FROM paluwagan_payments pp WHERE pp.transaction_id = t.id)
				OR EXISTS (SELECT 1 FROM debt_payments dp WHERE dp.transaction_id = t.id)) THEN 'bills'
			WHEN t.type = 'transfer' AND target.id IS NOT NULL AND NOT target.in_safe_to_spend THEN 'savings'
		END AS kind) k
		WHERE t.user_id = $1 AND a.in_safe_to_spend AND t.date >= $2 AND t.date < $3 AND k.kind IS NOT NULL
		GROUP BY t.date, k.kind`,
		userID, FormatDay(from), FormatDay(to), strings.ToLower(salaryCategory), strings.ToLower(allowanceCategory))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	days := make(map[string]*periodTotals)
	for rows.Next() {
		var date time.Time
		var kind string
		var amount float64
		if err := rows.Scan(&date, &kind, &amount); err != nil {
			return nil, err
		}
		key := FormatDay(date)
		if days[key] == nil {
			days[key] = &periodTotals{}
		}
		days[key].add(kind, amount)
	}
	return days, rows.Err()
}

// totalsFor adds up the days of a period.
func totalsFor(period historyPeriod, days map[string]*periodTotals) periodTotals {
	var totals periodTotals
	for day := period.start; day.Before(period.end); day = day.AddDate(0, 0, 1) {
		if t := days[FormatDay(day)]; t != nil {
			totals.pay += t.pay
			totals.other += t.other
			totals.spent += t.spent
			totals.bills += t.bills
			totals.savings += t.savings
		}
	}
	return totals
}

func (s *BillService) firstTransactionDate(ctx context.Context, userID string) (time.Time, bool, error) {
	var first *time.Time
	if err := s.db.QueryRow(ctx, `SELECT MIN(date) FROM transactions WHERE user_id = $1`, userID).Scan(&first); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return time.Time{}, false, nil
		}
		return time.Time{}, false, err
	}
	if first == nil {
		return time.Time{}, false, nil
	}
	return dayOf(first.Year(), first.Month(), first.Day()), true, nil
}

// SafeToSpendHistory lists pay periods newest first. Without before, it starts
// with the current period, then the 12 before it; with before (a period's
// start from a previous page), it lists the 12 periods before that day.
func (s *BillService) SafeToSpendHistory(ctx context.Context, userID string, today time.Time, before *time.Time) (*models.SafeToSpendHistory, error) {
	settings, err := s.GetSettings(ctx, userID)
	if err != nil {
		return nil, err
	}
	schedule := payScheduleOf(settings)
	result := &models.SafeToSpendHistory{Periods: make([]models.PayPeriodSummary, 0)}

	var current *models.SafeToSpend
	var cursor, end time.Time
	if before == nil {
		if current, err = s.SafeToSpend(ctx, userID, today); err != nil {
			return nil, err
		}
		if cursor, err = ParseDay(current.PeriodStart); err != nil {
			return nil, err
		}
		if end, err = ParseDay(current.NextPayday); err != nil {
			return nil, err
		}
	} else {
		cursor, end = *before, *before
	}

	first, hasData, err := s.firstTransactionDate(ctx, userID)
	if err != nil || !hasData {
		return result, err
	}

	// The current period first (first page only), then finished ones until
	// the first transaction.
	var periods []historyPeriod
	if current != nil {
		periods = append(periods, historyPeriod{start: cursor, end: end})
	}
	bases := make([]PayPeriod, 0, historyPageSize)
	for _, base := range basePeriodsBefore(schedule, cursor, historyPageSize) {
		if !base.NextPayday.After(first) {
			break
		}
		bases = append(bases, base)
	}
	if len(bases) > 0 {
		oldest, newest := bases[len(bases)-1], bases[0]
		early, err := s.earlyPayStarts(ctx, userID, oldest.Opening.Scheduled, newest.Opening.Scheduled)
		if err != nil {
			return nil, err
		}
		periods = append(periods, chainPeriods(bases, early, cursor)...)
	}
	if len(periods) == 0 {
		return result, nil
	}

	from, to := periods[len(periods)-1].start, periods[0].end
	days, err := s.dailyTotals(ctx, userID, from, to)
	if err != nil {
		return nil, err
	}
	saved, err := s.savedPlans(ctx, userID, from.AddDate(0, 0, -7), to)
	if err != nil {
		return nil, err
	}

	salaryMode := settings.SalaryPerPayday > 0 || len(settings.RegularIncomes) > 0
	irregular := schedule != PayScheduleSemiMonthly
	for i, period := range periods {
		if i == 0 && current != nil {
			result.Periods = append(result.Periods, currentSummary(period, current, totalsFor(period, days), irregular))
			continue
		}
		var plan *periodPlan
		if p, ok := saved[FormatDay(period.base.Opening.Scheduled)]; ok {
			plan = &p
		} else if salaryMode {
			expected := settings.SalaryPerPayday
			for _, income := range RegularIncomeInPeriod(settings.RegularIncomes, PayPeriod{Start: period.start, NextPayday: period.end}) {
				expected += income.Amount
			}
			plan = &periodPlan{expected: expected, savingsPerPayday: settings.SavingsPerPayday, extraPercent: settings.ExtraToSavingsPercent, estimated: true}
		}
		summary := summarizePeriod(period, totalsFor(period, days), plan, irregular)
		result.Periods = append(result.Periods, summary)

		result.Totals.Periods++
		result.Totals.MovedToSavings += summary.MovedToSavings
		if summary.HasPlan {
			result.Totals.Result += summary.Result
			if summary.Result >= 0 {
				result.Totals.Under++
			} else {
				result.Totals.Over++
			}
		}
	}
	result.Totals.Result = round2(result.Totals.Result)
	result.Totals.MovedToSavings = round2(result.Totals.MovedToSavings)

	// More to load while the oldest period here still starts after the first
	// transaction.
	if oldest := periods[len(periods)-1]; len(bases) == historyPageSize && oldest.start.After(first) {
		next := FormatDay(oldest.start)
		result.NextBefore = &next
	}
	return result, nil
}

// currentSummary is the period in progress, using Safe to Spend's own numbers
// so it matches the card.
func currentSummary(period historyPeriod, safe *models.SafeToSpend, totals periodTotals, irregular bool) models.PayPeriodSummary {
	summary := summarizePeriod(period, totals, nil, irregular)
	summary.Current = true
	summary.DaysLeft = safe.DaysLeft
	if safe.Mode != "salary" {
		return summary
	}
	summary.HasPlan = true
	summary.Pay = safe.Pay
	summary.PayEstimated = safe.PayEstimated
	summary.ExtraIncome = safe.ExtraIncome
	summary.Bills = safe.BillsThisPeriod
	summary.SavingsTarget = safe.SavingsTarget
	summary.MovedToSavings = safe.SavingsMoved
	summary.SpendingMoney = safe.SpendingMoney
	summary.Spent = safe.SpentSincePayday
	summary.Result = safe.PlannedLeft
	return summary
}
