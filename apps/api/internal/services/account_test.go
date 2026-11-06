package services

import (
	"testing"

	"github.com/Lorredo/fintrack/api/internal/models"
)

func TestBalanceAdjustment(t *testing.T) {
	tests := []struct {
		name            string
		current, target float64
		wantType        models.TransactionType
		wantAmount      float64
		wantOK          bool
	}{
		{"real balance is higher", 1000, 1250.5, models.TransactionTypeAdjustIn, 250.5, true},
		{"real balance is lower", 1250, 1180, models.TransactionTypeAdjustOut, 70, true},
		{"negative balance raised to zero", -50, 0, models.TransactionTypeAdjustIn, 50, true},
		{"already matches", 500, 500, "", 0, false},
		{"float noise is not a change", 0.1 + 0.2, 0.3, "", 0, false},
		{"under half a centavo is not a change", 100, 100.004, "", 0, false},
		{"one centavo is a change", 100, 100.01, models.TransactionTypeAdjustIn, 0.01, true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gotType, gotAmount, gotOK := balanceAdjustment(tt.current, tt.target)
			if gotType != tt.wantType || gotAmount != tt.wantAmount || gotOK != tt.wantOK {
				t.Fatalf("got (%q, %v, %v), want (%q, %v, %v)", gotType, gotAmount, gotOK, tt.wantType, tt.wantAmount, tt.wantOK)
			}
		})
	}
}
