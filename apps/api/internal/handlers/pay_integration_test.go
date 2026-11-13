package handlers_test

import "testing"

const payday = "2026-11-15"

func (u *user) pendingPay(t *testing.T, day string) (pending, upcoming []map[string]interface{}) {
	t.Helper()
	data := dataOf(t, u.must(t, 200, "GET", "/api/v1/pay/pending?today="+day, nil))
	list := func(field string) []map[string]interface{} {
		items := make([]map[string]interface{}, 0)
		for _, item := range data[field].([]interface{}) {
			items = append(items, item.(map[string]interface{}))
		}
		return items
	}
	return list("pending"), list("upcoming")
}

func keysOf(items []map[string]interface{}) []string {
	keys := make([]string, 0, len(items))
	for _, item := range items {
		keys = append(keys, item["key"].(string)+"@"+item["date"].(string))
	}
	return keys
}

func expectKeys(t *testing.T, label string, items []map[string]interface{}, want ...string) {
	t.Helper()
	got := keysOf(items)
	if len(got) != len(want) {
		t.Fatalf("%s = %v, want %v", label, got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("%s = %v, want %v", label, got, want)
		}
	}
}

func TestRecordPay(t *testing.T) {
	e := setup(t)
	u := newUser(t, e)
	gcash := u.wallet(t, "GCash", true)
	bank := u.wallet(t, "Bank", true)

	u.must(t, 200, "PUT", "/api/v1/settings", map[string]interface{}{
		"paySchedule": "semi_monthly", "salaryPerPayday": 7000, "salaryAccountId": gcash,
		"regularIncomes": []map[string]interface{}{
			{"name": "Rice allowance", "amount": 1500, "kind": "day", "day": 15},
			// The first Friday of December 2026 is the 4th.
			{"name": "Augmentation", "amount": 2000, "kind": "weekday", "nth": 1, "weekday": 5, "accountId": bank},
		},
	})

	// On payday, the salary and the rice allowance are due; the next
	// period's pay is upcoming.
	pending, upcoming := u.pendingPay(t, payday)
	expectKeys(t, "pending", pending, "salary@2026-11-15", "income:rice allowance@2026-11-15")
	expectKeys(t, "upcoming", upcoming, "salary@2026-11-30", "income:augmentation@2026-12-04")
	if pending[0]["accountId"] != gcash || pending[1]["accountId"] != gcash || upcoming[1]["accountId"] != bank {
		t.Fatalf("wallets: %v %v", pending, upcoming)
	}

	// Record the salary with overtime.
	out := u.must(t, 201, "POST", "/api/v1/pay/record", map[string]interface{}{
		"key": "salary", "payDate": payday, "amount": 8000, "date": payday,
	})
	salaryTx := dataOf(t, out)
	expectField(t, salaryTx, "type", "income")
	expectField(t, salaryTx, "category", "Salary")
	if got := u.walletBalance(t, gcash); got != 8000 {
		t.Fatalf("GCash balance = %v, want 8000", got)
	}
	u.must(t, 409, "POST", "/api/v1/pay/record", map[string]interface{}{"key": "salary", "payDate": payday, "date": payday})

	pending, _ = u.pendingPay(t, payday)
	expectKeys(t, "pending after salary", pending, "income:rice allowance@2026-11-15")

	// Already added by hand: marked without changing the balance.
	u.must(t, 200, "POST", "/api/v1/pay/skip", map[string]interface{}{"key": "income:rice allowance", "payDate": payday})
	pending, _ = u.pendingPay(t, payday)
	expectKeys(t, "pending after skip", pending)
	if got := u.walletBalance(t, gcash); got != 8000 {
		t.Fatalf("GCash balance after skip = %v, want 8000", got)
	}

	// Deleting the income makes the salary pending again.
	u.must(t, 200, "DELETE", "/api/v1/transactions/"+salaryTx["id"].(string), nil)
	pending, _ = u.pendingPay(t, payday)
	expectKeys(t, "pending after delete", pending, "salary@2026-11-15")

	// Not a payday for that item, and other users' wallets.
	u.must(t, 400, "POST", "/api/v1/pay/record", map[string]interface{}{"key": "salary", "payDate": "2026-11-16", "date": payday})
	u.must(t, 400, "POST", "/api/v1/pay/record", map[string]interface{}{"key": "income:bonus", "payDate": payday, "date": payday})
	other := newUser(t, e)
	foreign := other.wallet(t, "Theirs", true)
	u.must(t, 404, "POST", "/api/v1/pay/record", map[string]interface{}{
		"key": "salary", "payDate": payday, "date": payday, "accountId": foreign,
	})
	u.must(t, 404, "PUT", "/api/v1/settings", map[string]interface{}{"salaryAccountId": foreign})
	other.must(t, 400, "POST", "/api/v1/pay/record", map[string]interface{}{"key": "salary", "payDate": payday, "date": payday})

	// Recording the salary counts toward Safe to Spend's pay.
	u.must(t, 201, "POST", "/api/v1/pay/record", map[string]interface{}{"key": "salary", "payDate": payday, "date": payday})
	sts := dataOf(t, u.must(t, 200, "GET", "/api/v1/dashboard/safe-to-spend?today="+payday, nil))
	expectNumber(t, sts, "incomeRecorded", 7000)

	// Duplicate allowance names are refused; clearing the salary wallet works.
	u.must(t, 400, "PUT", "/api/v1/settings", map[string]interface{}{
		"regularIncomes": []map[string]interface{}{
			{"name": "Rice", "amount": 1, "kind": "day", "day": 1},
			{"name": " rice ", "amount": 2, "kind": "day", "day": 2},
		},
	})
	settings := dataOf(t, u.must(t, 200, "PUT", "/api/v1/settings", map[string]interface{}{"salaryAccountId": ""}))
	if settings["salaryAccountId"] != nil {
		t.Fatalf("salaryAccountId = %v, want null", settings["salaryAccountId"])
	}
	u.must(t, 400, "POST", "/api/v1/pay/record", map[string]interface{}{"key": "salary", "payDate": "2026-11-30", "date": "2026-11-30"})

	// Wipe data clears recorded pay.
	u.must(t, 200, "DELETE", "/api/v1/auth/wipe-data", nil)
	pending, upcoming = u.pendingPay(t, payday)
	expectKeys(t, "pending after wipe", pending)
	expectKeys(t, "upcoming after wipe", upcoming)
}

func TestRecordPayIrregularHasNoSalary(t *testing.T) {
	e := setup(t)
	u := newUser(t, e)
	u.wallet(t, "GCash", true)
	u.must(t, 200, "PUT", "/api/v1/settings", map[string]interface{}{
		"paySchedule": "irregular", "salaryPerPayday": 7000,
		"regularIncomes": []map[string]interface{}{{"name": "Rice allowance", "amount": 1500, "kind": "day", "day": 15}},
	})
	pending, _ := u.pendingPay(t, payday)
	expectKeys(t, "pending", pending, "income:rice allowance@2026-11-15")
	// No wallet for the salary or the allowance yet.
	u.must(t, 400, "POST", "/api/v1/pay/record", map[string]interface{}{"key": "income:rice allowance", "payDate": payday, "date": payday})
}
