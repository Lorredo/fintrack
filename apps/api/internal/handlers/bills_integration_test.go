package handlers_test

import (
	"math"
	"testing"
)

const today = "2026-11-09"

type user struct {
	e     *env
	token string
}

func newUser(t *testing.T, e *env) *user {
	t.Helper()
	email, _ := e.register(t)
	access, _ := e.login(t, email, password)
	return &user{e: e, token: access}
}

func (u *user) do(t *testing.T, method, path string, body interface{}) (int, map[string]interface{}) {
	t.Helper()
	return u.e.call(t, method, path, u.token, body)
}

// must calls the API and fails the test unless it returns want.
func (u *user) must(t *testing.T, want int, method, path string, body interface{}) map[string]interface{} {
	t.Helper()
	status, out := u.do(t, method, path, body)
	if status != want {
		t.Fatalf("%s %s: status %d, want %d: %v", method, path, status, want, out)
	}
	return out
}

func dataOf(t *testing.T, out map[string]interface{}) map[string]interface{} {
	t.Helper()
	data, ok := out["data"].(map[string]interface{})
	if !ok {
		t.Fatalf("no data object: %v", out)
	}
	return data
}

func (u *user) wallet(t *testing.T, name string, counted bool) string {
	t.Helper()
	out := u.must(t, 201, "POST", "/api/v1/accounts", map[string]interface{}{
		"name": name, "type": "ewallet", "color": "#2563EB", "inSafeToSpend": counted,
	})
	data := dataOf(t, out)
	if data["inSafeToSpend"] != counted {
		t.Fatalf("inSafeToSpend = %v, want %v", data["inSafeToSpend"], counted)
	}
	return data["id"].(string)
}

func (u *user) transaction(t *testing.T, body map[string]interface{}) string {
	t.Helper()
	return dataOf(t, u.must(t, 201, "POST", "/api/v1/transactions", body))["id"].(string)
}

func (u *user) bill(t *testing.T, name string, amount float64, start, walletID string) string {
	t.Helper()
	body := map[string]interface{}{"name": name, "amount": amount, "frequency": "monthly", "startDate": start}
	if walletID != "" {
		body["accountId"] = walletID
	}
	return dataOf(t, u.must(t, 201, "POST", "/api/v1/bills?today="+today, body))["id"].(string)
}

func (u *user) safeToSpend(t *testing.T) map[string]interface{} {
	t.Helper()
	return dataOf(t, u.must(t, 200, "GET", "/api/v1/dashboard/safe-to-spend?today="+today, nil))
}

func (u *user) billByID(t *testing.T, id string) map[string]interface{} {
	t.Helper()
	out := u.must(t, 200, "GET", "/api/v1/bills?today="+today, nil)
	for _, item := range out["data"].([]interface{}) {
		bill := item.(map[string]interface{})
		if bill["id"] == id {
			return bill
		}
	}
	t.Fatalf("bill %s not listed", id)
	return nil
}

func expectNumber(t *testing.T, data map[string]interface{}, field string, want float64) {
	t.Helper()
	got, ok := data[field].(float64)
	if !ok || math.Abs(got-want) > 0.001 {
		t.Errorf("%s = %v, want %v", field, data[field], want)
	}
}

func expectField(t *testing.T, data map[string]interface{}, field string, want interface{}) {
	t.Helper()
	if data[field] != want {
		t.Errorf("%s = %v, want %v", field, data[field], want)
	}
}

func TestSafeToSpend(t *testing.T) {
	e := setup(t)
	u := newUser(t, e)

	gcash := u.wallet(t, "GCash", true)
	savings := u.wallet(t, "Savings", false)
	u.transaction(t, map[string]interface{}{
		"accountId": gcash, "type": "income", "amount": 10000, "category": "Salary", "date": "2026-11-01",
	})

	before := u.safeToSpend(t)
	expectField(t, before, "configured", false)
	expectNumber(t, before, "balance", 10000)

	settings := dataOf(t, u.must(t, 200, "PUT", "/api/v1/settings", map[string]interface{}{
		"paySchedule": "semi_monthly", "savingsPerPayday": 1000,
	}))
	expectField(t, settings, "paySchedule", "semi_monthly")
	expectField(t, settings, "billReminders", true)

	// Before payday on the 15th, overdue twice, and after payday.
	meralco := u.bill(t, "Meralco", 2000, "2026-11-11", gcash)
	u.bill(t, "Water", 500, "2026-10-05", gcash)
	u.bill(t, "Internet", 1500, "2026-11-20", gcash)

	s := u.safeToSpend(t)
	expectField(t, s, "configured", true)
	expectField(t, s, "nextPayday", "2026-11-15")
	expectNumber(t, s, "daysLeft", 6)
	expectNumber(t, s, "balance", 10000)
	expectNumber(t, s, "billsReserved", 3000)
	expectNumber(t, s, "savingsReserved", 1000)
	expectNumber(t, s, "spendable", 6000)
	expectNumber(t, s, "perDay", 1000)
	if bills := s["bills"].([]interface{}); len(bills) != 3 {
		t.Errorf("reserved bills = %d, want 3 (Water twice, Meralco)", len(bills))
	}

	// Moving money to savings this period counts toward the savings amount.
	u.transaction(t, map[string]interface{}{
		"accountId": gcash, "transferAccountId": savings, "type": "transfer", "amount": 400, "date": "2026-11-02",
	})
	s = u.safeToSpend(t)
	expectNumber(t, s, "balance", 9600)
	expectNumber(t, s, "savingsMoved", 400)
	expectNumber(t, s, "savingsReserved", 600)
	expectNumber(t, s, "spendable", 6000)

	// A transfer from last period doesn't count.
	u.transaction(t, map[string]interface{}{
		"accountId": gcash, "transferAccountId": savings, "type": "transfer", "amount": 100, "date": "2026-10-29",
	})
	s = u.safeToSpend(t)
	expectNumber(t, s, "savingsMoved", 400)

	// Paying a bill moves it from reserved into the balance.
	paid := u.must(t, 201, "POST", "/api/v1/bills/"+meralco+"/pay", map[string]interface{}{
		"dueDate": "2026-11-11", "date": today,
	})
	expense := dataOf(t, paid)
	expectField(t, expense, "type", "expense")
	expectField(t, expense, "category", "Bills & Utilities")
	expectField(t, expense, "description", "Meralco")
	s = u.safeToSpend(t)
	expectNumber(t, s, "balance", 7500)
	expectNumber(t, s, "billsReserved", 1000)
	expectNumber(t, s, "spendable", 5900)

	// A negative result is returned as is, so the app can show the shortfall.
	u.must(t, 200, "PUT", "/api/v1/settings", map[string]interface{}{"savingsPerPayday": 20000})
	s = u.safeToSpend(t)
	if spendable := s["spendable"].(float64); spendable >= 0 {
		t.Errorf("spendable = %v, want a shortfall", spendable)
	}

}

func TestBillPayments(t *testing.T) {
	e := setup(t)
	u := newUser(t, e)
	gcash := u.wallet(t, "GCash", true)
	u.transaction(t, map[string]interface{}{
		"accountId": gcash, "type": "income", "amount": 5000, "category": "Salary", "date": "2026-11-01",
	})

	meralco := u.bill(t, "Meralco", 2000, "2026-11-11", gcash)
	bill := u.billByID(t, meralco)
	expectField(t, bill, "nextDue", "2026-11-11")
	expectNumber(t, bill, "daysUntil", 2)
	expectField(t, bill, "status", "due_soon")

	pay := map[string]interface{}{"dueDate": "2026-11-11", "date": today}
	expenseID := dataOf(t, u.must(t, 201, "POST", "/api/v1/bills/"+meralco+"/pay", pay))["id"].(string)

	// A second tap, or a retried request, doesn't pay twice.
	u.must(t, 409, "POST", "/api/v1/bills/"+meralco+"/pay", pay)

	bill = u.billByID(t, meralco)
	expectField(t, bill, "nextDue", "2026-12-11")
	expectField(t, bill, "status", "upcoming")

	// Deleting the expense makes the due date unpaid again.
	u.must(t, 200, "DELETE", "/api/v1/transactions/"+expenseID, nil)
	expectField(t, u.billByID(t, meralco), "nextDue", "2026-11-11")

	// Only real due dates can be paid.
	u.must(t, 400, "POST", "/api/v1/bills/"+meralco+"/pay", map[string]interface{}{"dueDate": "2026-11-12", "date": today})
	u.must(t, 400, "POST", "/api/v1/bills/"+meralco+"/pay", map[string]interface{}{"dueDate": "2026-10-11", "date": today})

	// Not enough money: nothing is recorded, so the bill stays unpaid.
	big := u.bill(t, "Tuition", 50000, "2026-11-10", gcash)
	u.must(t, 422, "POST", "/api/v1/bills/"+big+"/pay", map[string]interface{}{"dueDate": "2026-11-10", "date": today})
	expectField(t, u.billByID(t, big), "nextDue", "2026-11-10")

	// Paying a different amount from the default.
	out := u.must(t, 201, "POST", "/api/v1/bills/"+big+"/pay", map[string]interface{}{
		"dueDate": "2026-11-10", "date": today, "amount": 1200,
	})
	expectNumber(t, dataOf(t, out), "amount", 1200)

	// Skipping an overdue due date clears it.
	water := u.bill(t, "Water", 500, "2026-10-05", gcash)
	bill = u.billByID(t, water)
	expectNumber(t, bill, "overdueCount", 2)
	expectField(t, bill, "status", "overdue")
	expectField(t, bill, "nextDue", "2026-10-05")
	u.must(t, 200, "POST", "/api/v1/bills/"+water+"/skip", map[string]interface{}{"dueDate": "2026-10-05"})
	bill = u.billByID(t, water)
	expectNumber(t, bill, "overdueCount", 1)
	expectField(t, bill, "nextDue", "2026-11-05")

	// A bill with no wallet needs one when paid.
	noWallet := u.bill(t, "Rent", 100, "2026-11-30", "")
	u.must(t, 400, "POST", "/api/v1/bills/"+noWallet+"/pay", map[string]interface{}{"dueDate": "2026-11-30", "date": today})
	u.must(t, 201, "POST", "/api/v1/bills/"+noWallet+"/pay", map[string]interface{}{
		"dueDate": "2026-11-30", "date": today, "accountId": gcash,
	})

	// Pausing keeps the bill but leaves it out of Safe to Spend.
	updated := dataOf(t, u.must(t, 200, "PUT", "/api/v1/bills/"+water+"?today="+today, map[string]interface{}{"active": false}))
	expectField(t, updated, "status", "paused")
}

func TestBillsBelongToTheirUser(t *testing.T) {
	e := setup(t)
	owner := newUser(t, e)
	other := newUser(t, e)
	gcash := owner.wallet(t, "GCash", true)
	bill := owner.bill(t, "Meralco", 100, "2026-11-11", gcash)

	other.must(t, 404, "POST", "/api/v1/bills/"+bill+"/pay", map[string]interface{}{"dueDate": "2026-11-11", "date": today})
	other.must(t, 404, "PUT", "/api/v1/bills/"+bill+"?today="+today, map[string]interface{}{"name": "Mine"})
	other.must(t, 404, "DELETE", "/api/v1/bills/"+bill, nil)
	if out := other.must(t, 200, "GET", "/api/v1/bills?today="+today, nil); len(out["data"].([]interface{})) != 0 {
		t.Errorf("another user's bills are listed: %v", out["data"])
	}

	// Someone else's wallet can't be used.
	otherWallet := other.wallet(t, "Theirs", true)
	owner.must(t, 404, "POST", "/api/v1/bills?today="+today, map[string]interface{}{
		"name": "X", "amount": 10, "frequency": "monthly", "startDate": "2026-11-11", "accountId": otherWallet,
	})

	owner.must(t, 404, "DELETE", "/api/v1/bills/not-a-uuid", nil)
}

func TestBillValidation(t *testing.T) {
	e := setup(t)
	u := newUser(t, e)

	u.must(t, 400, "GET", "/api/v1/bills", nil)
	u.must(t, 400, "GET", "/api/v1/bills?today=11/09/2026", nil)
	u.must(t, 400, "GET", "/api/v1/dashboard/safe-to-spend", nil)
	u.must(t, 400, "POST", "/api/v1/bills?today="+today, map[string]interface{}{
		"name": "X", "amount": 10, "frequency": "daily", "startDate": "2026-11-11",
	})
	u.must(t, 400, "POST", "/api/v1/bills?today="+today, map[string]interface{}{
		"name": "X", "amount": 0, "frequency": "monthly", "startDate": "2026-11-11",
	})
	u.must(t, 400, "PUT", "/api/v1/settings", map[string]interface{}{"paySchedule": "weekly"})
	u.must(t, 400, "PUT", "/api/v1/settings", map[string]interface{}{"savingsPerPayday": -5})

	status, _ := e.call(t, "GET", "/api/v1/bills?today="+today, "", nil)
	if status != 401 {
		t.Errorf("signed out: status %d, want 401", status)
	}
}

func TestWipeDataRemovesBills(t *testing.T) {
	e := setup(t)
	u := newUser(t, e)
	gcash := u.wallet(t, "GCash", true)
	u.bill(t, "Meralco", 100, "2026-11-11", gcash)
	u.must(t, 200, "PUT", "/api/v1/settings", map[string]interface{}{"paySchedule": "irregular", "savingsPerPayday": 500})

	u.must(t, 200, "DELETE", "/api/v1/auth/wipe-data", nil)

	if out := u.must(t, 200, "GET", "/api/v1/bills?today="+today, nil); len(out["data"].([]interface{})) != 0 {
		t.Errorf("bills left after wipe: %v", out["data"])
	}
	settings := dataOf(t, u.must(t, 200, "GET", "/api/v1/settings", nil))
	expectField(t, settings, "paySchedule", nil)
	expectNumber(t, settings, "savingsPerPayday", 0)
}

func TestSafeToSpendFromSalary(t *testing.T) {
	e := setup(t)
	u := newUser(t, e)
	gcash := u.wallet(t, "GCash", true)
	maya := u.wallet(t, "Maya", true)

	// Money from an earlier pay period is in the balance but isn't this pay.
	u.transaction(t, map[string]interface{}{
		"accountId": gcash, "type": "income", "amount": 20000, "category": "Salary", "date": "2026-10-20",
	})
	u.must(t, 200, "PUT", "/api/v1/settings", map[string]interface{}{
		"paySchedule": "semi_monthly", "savingsPerPayday": 2000, "salaryPerPayday": 7000,
	})
	rent := u.bill(t, "Rent", 3500, "2026-11-10", gcash)

	// Before the salary is recorded, the expected salary is used.
	s := u.safeToSpend(t)
	expectField(t, s, "mode", "salary")
	expectField(t, s, "periodStart", "2026-10-30")
	expectField(t, s, "payEstimated", true)
	expectNumber(t, s, "pay", 7000)
	expectNumber(t, s, "billsThisPeriod", 3500)
	expectNumber(t, s, "spendingMoney", 1500)
	expectNumber(t, s, "plannedLeft", 1500)
	expectNumber(t, s, "balanceLeft", 14500)
	expectField(t, s, "limitedByBalance", false)
	expectNumber(t, s, "spendable", 1500)
	expectNumber(t, s, "perDay", 250)

	// Recording the salary and spending from it.
	u.transaction(t, map[string]interface{}{
		"accountId": gcash, "type": "income", "amount": 7000, "category": "Salary", "date": "2026-10-30",
	})
	u.transaction(t, map[string]interface{}{
		"accountId": gcash, "type": "expense", "amount": 300, "category": "Food & Drinks", "date": "2026-11-05",
	})
	s = u.safeToSpend(t)
	expectField(t, s, "payEstimated", false)
	expectNumber(t, s, "spentSincePayday", 300)
	expectNumber(t, s, "spendable", 1200)

	// Paying a bill or moving money between counted wallets isn't spending.
	u.must(t, 201, "POST", "/api/v1/bills/"+rent+"/pay", map[string]interface{}{"dueDate": "2026-11-10", "date": today})
	u.transaction(t, map[string]interface{}{
		"accountId": gcash, "transferAccountId": maya, "type": "transfer", "amount": 100, "date": "2026-11-06",
	})
	s = u.safeToSpend(t)
	expectNumber(t, s, "billsThisPeriod", 3500)
	expectNumber(t, s, "spentSincePayday", 300)
	expectNumber(t, s, "spendable", 1200)

	// Overtime is split: half to savings, half to spending.
	u.transaction(t, map[string]interface{}{
		"accountId": maya, "type": "income", "amount": 1000, "category": "Overtime", "date": "2026-11-06",
	})
	s = u.safeToSpend(t)
	expectNumber(t, s, "extraIncome", 1000)
	expectNumber(t, s, "extraSaved", 500)
	expectNumber(t, s, "savingsTarget", 2500)
	expectNumber(t, s, "spendingMoney", 2000)
	expectNumber(t, s, "spendable", 1700)

	u.must(t, 200, "PUT", "/api/v1/settings", map[string]interface{}{"extraToSavingsPercent": 0})
	expectNumber(t, u.safeToSpend(t), "spendable", 2200)
	u.must(t, 200, "PUT", "/api/v1/settings", map[string]interface{}{"extraToSavingsPercent": 100})
	expectNumber(t, u.safeToSpend(t), "spendable", 1200)
	u.must(t, 400, "PUT", "/api/v1/settings", map[string]interface{}{"extraToSavingsPercent": 30})

	// Turning the salary off goes back to the balance-based amount.
	u.must(t, 200, "PUT", "/api/v1/settings", map[string]interface{}{"salaryPerPayday": 0})
	s = u.safeToSpend(t)
	expectField(t, s, "mode", "balance")
	expectNumber(t, s, "spendable", s["balanceLeft"].(float64))
}

func TestSalaryPlanLimitedByBalance(t *testing.T) {
	e := setup(t)
	u := newUser(t, e)
	gcash := u.wallet(t, "GCash", true)
	u.transaction(t, map[string]interface{}{
		"accountId": gcash, "type": "income", "amount": 500, "category": "Salary", "date": "2026-10-20",
	})
	u.must(t, 200, "PUT", "/api/v1/settings", map[string]interface{}{
		"paySchedule": "semi_monthly", "salaryPerPayday": 7000,
	})
	// Unpaid from before this period, so it comes out of this pay.
	u.bill(t, "Water", 200, "2026-10-20", gcash)

	s := u.safeToSpend(t)
	expectNumber(t, s, "billsThisPeriod", 200)
	expectNumber(t, s, "plannedLeft", 6800)
	expectNumber(t, s, "balanceLeft", 300)
	expectField(t, s, "limitedByBalance", true)
	expectNumber(t, s, "spendable", 300)

	u.must(t, 200, "DELETE", "/api/v1/auth/wipe-data", nil)
	settings := dataOf(t, u.must(t, 200, "GET", "/api/v1/settings", nil))
	expectNumber(t, settings, "salaryPerPayday", 0)
	expectNumber(t, settings, "extraToSavingsPercent", 50)
}

func TestRegularIncomeIsExpectedPay(t *testing.T) {
	e := setup(t)
	u := newUser(t, e)
	gcash := u.wallet(t, "GCash", true)
	// Old money, so the balance limit doesn't get in the way.
	u.transaction(t, map[string]interface{}{
		"accountId": gcash, "type": "income", "amount": 50000, "category": "Salary", "date": "2026-10-01",
	})

	settings := dataOf(t, u.must(t, 200, "PUT", "/api/v1/settings", map[string]interface{}{
		"paySchedule": "semi_monthly", "salaryPerPayday": 7000, "savingsPerPayday": 2000,
		"regularIncomes": []map[string]interface{}{
			{"name": "Augmentation", "amount": 2000, "kind": "weekday", "nth": 1, "weekday": 5},
			{"name": "Rice allowance", "amount": 1500, "kind": "day", "day": 15},
		},
	}))
	if items := settings["regularIncomes"].([]interface{}); len(items) != 2 {
		t.Fatalf("regularIncomes = %v", settings["regularIncomes"])
	}

	// Oct 30 to Nov 14: augmentation (first Friday, Nov 6) is in, rice allowance isn't.
	s := u.safeToSpend(t)
	expectNumber(t, s, "expectedPay", 9000)
	expectField(t, s, "payEstimated", true)
	if income := s["regularIncome"].([]interface{}); len(income) != 1 ||
		income[0].(map[string]interface{})["date"] != "2026-11-06" {
		t.Errorf("regularIncome = %v", s["regularIncome"])
	}
	expectNumber(t, s, "spendingMoney", 7000) // 9,000 − 2,000 savings

	// Recording salary and augmentation is expected pay, not extra.
	for _, amount := range []float64{7000, 2000} {
		u.transaction(t, map[string]interface{}{
			"accountId": gcash, "type": "income", "amount": amount, "category": "Salary", "date": "2026-11-06",
		})
	}
	s = u.safeToSpend(t)
	expectField(t, s, "payEstimated", false)
	expectNumber(t, s, "extraIncome", 0)
	expectNumber(t, s, "extraSaved", 0)
	expectNumber(t, s, "spendingMoney", 7000)

	// Only income above salary and allowances is split.
	u.transaction(t, map[string]interface{}{
		"accountId": gcash, "type": "income", "amount": 1000, "category": "Overtime", "date": "2026-11-07",
	})
	s = u.safeToSpend(t)
	expectNumber(t, s, "extraIncome", 1000)
	expectNumber(t, s, "extraSaved", 500)
	expectNumber(t, s, "spendingMoney", 7500)

	// The next pay period has the rice allowance instead.
	next := dataOf(t, u.must(t, 200, "GET", "/api/v1/dashboard/safe-to-spend?today=2026-11-20", nil))
	expectNumber(t, next, "expectedPay", 8500)
	if income := next["regularIncome"].([]interface{}); len(income) != 1 ||
		income[0].(map[string]interface{})["name"] != "Rice allowance" {
		t.Errorf("next period regularIncome = %v", next["regularIncome"])
	}

	// Leaving the list out keeps it; an empty list clears it.
	kept := dataOf(t, u.must(t, 200, "PUT", "/api/v1/settings", map[string]interface{}{"savingsPerPayday": 1000}))
	if items := kept["regularIncomes"].([]interface{}); len(items) != 2 {
		t.Errorf("regularIncomes changed: %v", kept["regularIncomes"])
	}
	cleared := dataOf(t, u.must(t, 200, "PUT", "/api/v1/settings", map[string]interface{}{"regularIncomes": []interface{}{}}))
	if items := cleared["regularIncomes"].([]interface{}); len(items) != 0 {
		t.Errorf("regularIncomes not cleared: %v", cleared["regularIncomes"])
	}
}

func TestRegularIncomeValidation(t *testing.T) {
	e := setup(t)
	u := newUser(t, e)
	bad := []map[string]interface{}{
		{"name": "X", "amount": 100, "kind": "weekday", "nth": 1, "weekday": 9},
		{"name": "X", "amount": 100, "kind": "weekday", "nth": 0, "weekday": 5},
		{"name": "X", "amount": 100, "kind": "day", "day": 0},
		{"name": "X", "amount": 0, "kind": "day", "day": 15},
		{"name": "", "amount": 100, "kind": "day", "day": 15},
		{"name": "X", "amount": 100, "kind": "yearly", "day": 15},
	}
	for _, item := range bad {
		u.must(t, 400, "PUT", "/api/v1/settings", map[string]interface{}{"regularIncomes": []interface{}{item}})
	}
	tooMany := make([]interface{}, 11)
	for i := range tooMany {
		tooMany[i] = map[string]interface{}{"name": "X", "amount": 100, "kind": "day", "day": 15}
	}
	u.must(t, 400, "PUT", "/api/v1/settings", map[string]interface{}{"regularIncomes": tooMany})

	u.must(t, 200, "PUT", "/api/v1/settings", map[string]interface{}{
		"regularIncomes": []interface{}{map[string]interface{}{"name": "Rice", "amount": 100, "kind": "day", "day": 15}},
	})
	u.must(t, 200, "DELETE", "/api/v1/auth/wipe-data", nil)
	settings := dataOf(t, u.must(t, 200, "GET", "/api/v1/settings", nil))
	if items := settings["regularIncomes"].([]interface{}); len(items) != 0 {
		t.Errorf("wipe left regularIncomes: %v", settings["regularIncomes"])
	}
}
