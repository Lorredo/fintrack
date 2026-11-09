package handlers_test

import (
	"testing"
)

func (u *user) walletBalance(t *testing.T, id string) float64 {
	t.Helper()
	out := u.must(t, 200, "GET", "/api/v1/accounts", nil)
	for _, item := range out["data"].([]interface{}) {
		account := item.(map[string]interface{})
		if account["id"] == id {
			return account["balance"].(float64)
		}
	}
	t.Fatalf("wallet %s not listed", id)
	return 0
}

func (u *user) monthTotals(t *testing.T) (income, expense float64) {
	t.Helper()
	data := dataOf(t, u.must(t, 200, "GET", "/api/v1/dashboard/summary?month=2026-11", nil))
	return data["totalIncome"].(float64), data["totalExpense"].(float64)
}

func TestUtang(t *testing.T) {
	e := setup(t)
	u := newUser(t, e)
	gcash := u.wallet(t, "GCash", true)
	u.transaction(t, map[string]interface{}{
		"accountId": gcash, "type": "income", "amount": 5000, "category": "Salary", "date": "2026-11-01",
	})
	u.must(t, 200, "PUT", "/api/v1/settings", map[string]interface{}{"paySchedule": "semi_monthly", "salaryPerPayday": 5000})
	before := u.safeToSpend(t)

	// Lending moves money out of the wallet but isn't spending.
	lent := dataOf(t, u.must(t, 201, "POST", "/api/v1/debts", map[string]interface{}{
		"personName": "Juan", "direction": "lent", "amount": 1500, "accountId": gcash, "date": "2026-11-03",
	}))
	expectNumber(t, lent, "remaining", 1500)
	if got := u.walletBalance(t, gcash); got != 3500 {
		t.Errorf("balance after lending = %v, want 3500", got)
	}
	income, expense := u.monthTotals(t)
	if income != 5000 || expense != 0 {
		t.Errorf("month totals = %v / %v, want 5000 / 0", income, expense)
	}
	s := u.safeToSpend(t)
	expectNumber(t, s, "spentSincePayday", before["spentSincePayday"].(float64))
	expectNumber(t, s, "pay", before["pay"].(float64))

	// Lending more than the wallet holds is refused.
	u.must(t, 422, "POST", "/api/v1/debts", map[string]interface{}{
		"personName": "Juan", "direction": "lent", "amount": 999999, "accountId": gcash, "date": "2026-11-03",
	})

	// Partial repayment brings money back.
	repaid := dataOf(t, u.must(t, 201, "POST", "/api/v1/debts/"+lent["id"].(string)+"/payments", map[string]interface{}{
		"amount": 500, "date": "2026-11-05",
	}))
	expectNumber(t, repaid, "paid", 500)
	expectNumber(t, repaid, "remaining", 1000)
	if got := u.walletBalance(t, gcash); got != 4000 {
		t.Errorf("balance after repayment = %v, want 4000", got)
	}
	u.must(t, 400, "POST", "/api/v1/debts/"+lent["id"].(string)+"/payments", map[string]interface{}{"amount": 1001, "date": "2026-11-05"})

	// Borrowing puts money in, and what's owed by its due date is set aside.
	borrowed := dataOf(t, u.must(t, 201, "POST", "/api/v1/debts", map[string]interface{}{
		"personName": "juan ", "direction": "borrowed", "amount": 300, "accountId": gcash, "date": "2026-11-04", "dueDate": "2026-11-12",
	}))
	if got := u.walletBalance(t, gcash); got != 4300 {
		t.Errorf("balance after borrowing = %v, want 4300", got)
	}
	s = u.safeToSpend(t)
	expectNumber(t, s, "pay", before["pay"].(float64)) // borrowed money isn't pay
	expectNumber(t, s, "billsThisPeriod", 300)

	// Totals per person net out, ignoring case and spacing in names.
	summary := dataOf(t, u.must(t, 200, "GET", "/api/v1/debts", nil))
	expectNumber(t, summary, "owedToYou", 1000)
	expectNumber(t, summary, "youOwe", 300)
	people := summary["people"].([]interface{})
	if len(people) != 1 {
		t.Fatalf("people = %v, want one Juan", people)
	}
	expectNumber(t, people[0].(map[string]interface{}), "net", 700)

	// Undoing a payment and deleting an utang reverse their wallet effect.
	payments := repaid["payments"].([]interface{})
	paymentID := payments[0].(map[string]interface{})["id"].(string)
	undone := dataOf(t, u.must(t, 200, "DELETE", "/api/v1/debts/"+lent["id"].(string)+"/payments/"+paymentID, nil))
	expectNumber(t, undone, "remaining", 1500)
	u.must(t, 200, "DELETE", "/api/v1/debts/"+borrowed["id"].(string), nil)
	u.must(t, 200, "DELETE", "/api/v1/debts/"+lent["id"].(string), nil)
	if got := u.walletBalance(t, gcash); got != 5000 {
		t.Errorf("balance after deleting = %v, want 5000", got)
	}

	// Other users can't touch them.
	other := newUser(t, e)
	mine := dataOf(t, u.must(t, 201, "POST", "/api/v1/debts", map[string]interface{}{
		"personName": "Ana", "direction": "lent", "amount": 100, "accountId": gcash, "date": "2026-11-03",
	}))
	other.must(t, 404, "DELETE", "/api/v1/debts/"+mine["id"].(string), nil)
	other.must(t, 404, "POST", "/api/v1/debts/"+mine["id"].(string)+"/payments", map[string]interface{}{"amount": 10, "date": "2026-11-05"})
	other.must(t, 404, "POST", "/api/v1/debts", map[string]interface{}{
		"personName": "Ana", "direction": "lent", "amount": 100, "accountId": gcash, "date": "2026-11-03",
	})
	u.must(t, 400, "POST", "/api/v1/debts", map[string]interface{}{
		"personName": "Ana", "direction": "gave", "amount": 100, "accountId": gcash, "date": "2026-11-03",
	})
}

func TestPaluwagan(t *testing.T) {
	e := setup(t)
	u := newUser(t, e)
	gcash := u.wallet(t, "GCash", true)
	u.transaction(t, map[string]interface{}{
		"accountId": gcash, "type": "income", "amount": 5000, "category": "Salary", "date": "2026-10-31",
	})
	u.must(t, 200, "PUT", "/api/v1/settings", map[string]interface{}{"paySchedule": "semi_monthly", "salaryPerPayday": 5000})

	// Weekly, 5 members, from Nov 6. Your turn is round 2 (Nov 13).
	created := dataOf(t, u.must(t, 201, "POST", "/api/v1/paluwagans?today="+today, map[string]interface{}{
		"name": "Office", "contribution": 500, "frequency": "weekly", "startDate": "2026-11-06",
		"members": 5, "myTurn": 2, "accountId": gcash,
	}))
	id := created["id"].(string)
	expectNumber(t, created, "payoutAmount", 2500)
	expectField(t, created, "myPayoutDate", "2026-11-13")
	expectNumber(t, created, "overdueCount", 1) // round 1 was Nov 6
	if rounds := created["rounds"].([]interface{}); len(rounds) != 5 {
		t.Fatalf("rounds = %d, want 5", len(rounds))
	}

	// Rounds 1 (overdue) and 2 (Nov 13) are before payday on the 15th.
	s := u.safeToSpend(t)
	expectNumber(t, s, "billsReserved", 1000)
	expectNumber(t, s, "billsThisPeriod", 1000)

	// Paying round 1 moves money but isn't spending, and can't be paid twice.
	paid := dataOf(t, u.must(t, 201, "POST", "/api/v1/paluwagans/"+id+"/contribute?today="+today, map[string]interface{}{
		"round": 1, "date": today,
	}))
	expectNumber(t, paid, "contributedCount", 1)
	expectNumber(t, paid, "overdueCount", 0)
	u.must(t, 409, "POST", "/api/v1/paluwagans/"+id+"/contribute?today="+today, map[string]interface{}{"round": 1, "date": today})
	if got := u.walletBalance(t, gcash); got != 4500 {
		t.Errorf("balance after contributing = %v, want 4500", got)
	}
	s = u.safeToSpend(t)
	expectNumber(t, s, "billsReserved", 500)    // only round 2 is still to pay
	expectNumber(t, s, "billsThisPeriod", 1000) // both still come out of this pay
	expectNumber(t, s, "spentSincePayday", 0)

	// The payout is only for your turn, and it isn't income.
	u.must(t, 400, "POST", "/api/v1/paluwagans/"+id+"/payout?today="+today, map[string]interface{}{"round": 3, "date": today})
	u.must(t, 400, "POST", "/api/v1/paluwagans/"+id+"/contribute?today="+today, map[string]interface{}{"round": 6, "date": today})
	u.must(t, 201, "POST", "/api/v1/paluwagans/"+id+"/payout?today="+today, map[string]interface{}{"round": 2, "date": today})
	if got := u.walletBalance(t, gcash); got != 7000 {
		t.Errorf("balance after payout = %v, want 7000", got)
	}
	income, _ := u.monthTotals(t)
	if income != 0 {
		t.Errorf("November income = %v, want 0 (the payout isn't income)", income)
	}
	expectNumber(t, u.safeToSpend(t), "incomeRecorded", 5000)

	// Validation and ownership.
	u.must(t, 400, "POST", "/api/v1/paluwagans?today="+today, map[string]interface{}{
		"name": "X", "contribution": 100, "frequency": "weekly", "startDate": "2026-11-06", "members": 3, "myTurn": 4,
	})
	other := newUser(t, e)
	other.must(t, 404, "POST", "/api/v1/paluwagans/"+id+"/contribute?today="+today, map[string]interface{}{"round": 3, "date": today})
	other.must(t, 404, "DELETE", "/api/v1/paluwagans/"+id, nil)

	// Deleting the group reverses its money and clears it from Safe to Spend.
	u.must(t, 200, "DELETE", "/api/v1/paluwagans/"+id, nil)
	if got := u.walletBalance(t, gcash); got != 5000 {
		t.Errorf("balance after deleting = %v, want 5000", got)
	}
	expectNumber(t, u.safeToSpend(t), "billsReserved", 0)

	// Wipe data clears utang and paluwagan.
	u.must(t, 201, "POST", "/api/v1/paluwagans?today="+today, map[string]interface{}{
		"name": "Again", "contribution": 100, "frequency": "monthly", "startDate": "2026-11-20", "members": 3, "myTurn": 1,
	})
	u.must(t, 201, "POST", "/api/v1/debts", map[string]interface{}{
		"personName": "Ana", "direction": "lent", "amount": 100, "accountId": gcash, "date": "2026-11-03",
	})
	u.must(t, 200, "DELETE", "/api/v1/auth/wipe-data", nil)
	if list := u.must(t, 200, "GET", "/api/v1/paluwagans?today="+today, nil)["data"].([]interface{}); len(list) != 0 {
		t.Errorf("paluwagans left after wipe: %v", list)
	}
	if debts := dataOf(t, u.must(t, 200, "GET", "/api/v1/debts", nil))["debts"].([]interface{}); len(debts) != 0 {
		t.Errorf("debts left after wipe: %v", debts)
	}
}
