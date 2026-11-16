package handlers_test

import (
	"crypto/rand"
	"fmt"
	"testing"
)

func newUUID(t *testing.T) string {
	t.Helper()
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		t.Fatal(err)
	}
	b[6] = b[6]&0x0f | 0x40
	b[8] = b[8]&0x3f | 0x80
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:])
}

// A change saved offline is sent with the app's own id, and may be sent again
// if the first reply was lost. It must only be saved once.
func TestCreateWithClientIDIsSavedOnce(t *testing.T) {
	e := setup(t)
	u := newUser(t, e)
	gcash := u.wallet(t, "GCash", true)
	bank := u.wallet(t, "Bank", true)
	u.transaction(t, map[string]interface{}{"accountId": gcash, "type": "income", "amount": 1000, "category": "Salary", "date": today})

	transfer := map[string]interface{}{
		"id": newUUID(t), "accountId": gcash, "transferAccountId": bank,
		"type": "transfer", "amount": 300, "fee": 15, "category": "Transfer", "date": today,
	}
	first := dataOf(t, u.must(t, 201, "POST", "/api/v1/transactions", transfer))
	again := dataOf(t, u.must(t, 200, "POST", "/api/v1/transactions", transfer))
	if first["id"] != transfer["id"] || again["id"] != transfer["id"] {
		t.Fatalf("ids: %v, %v, want %v", first["id"], again["id"], transfer["id"])
	}
	// 1000 - 300 - 15 fee, counted once.
	if got := u.walletBalance(t, gcash); got != 685 {
		t.Fatalf("GCash balance = %v, want 685", got)
	}
	if got := u.walletBalance(t, bank); got != 300 {
		t.Fatalf("Bank balance = %v, want 300", got)
	}

	// A replay is returned even when the wallet couldn't cover it again.
	u.must(t, 200, "POST", "/api/v1/transactions", map[string]interface{}{
		"id": transfer["id"], "accountId": gcash, "transferAccountId": bank,
		"type": "transfer", "amount": 5000, "category": "Transfer", "date": today,
	})

	// Someone else can't reuse the id, and a bad id is refused.
	other := newUser(t, e)
	theirs := other.wallet(t, "Theirs", true)
	other.must(t, 409, "POST", "/api/v1/transactions", map[string]interface{}{
		"id": transfer["id"], "accountId": theirs, "type": "income", "amount": 1, "category": "Salary", "date": today,
	})
	u.must(t, 400, "POST", "/api/v1/transactions", map[string]interface{}{
		"id": "not-a-uuid", "accountId": gcash, "type": "income", "amount": 1, "category": "Salary", "date": today,
	})

	// Without an id it still works, and deleting twice gives 404 the second time.
	id := u.transaction(t, map[string]interface{}{"accountId": gcash, "type": "expense", "amount": 85, "category": "Food & Drinks", "date": today})
	u.must(t, 200, "DELETE", "/api/v1/transactions/"+id, nil)
	u.must(t, 404, "DELETE", "/api/v1/transactions/"+id, nil)
}
