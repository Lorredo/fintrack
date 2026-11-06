package services

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"math/big"
	"strings"
)

// No 0/O, 1/I/L, so a code copied by hand can't be misread.
const recoveryCodeAlphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"

const (
	recoveryCodeLength    = 16
	recoveryCodeGroupSize = 4
)

// NewRecoveryCode returns a code formatted for reading, such as
// ABCD-EFGH-JKMN-PQRS, and the hash to store. The code has about 79 bits of
// randomness, so a fast hash is safe here.
func NewRecoveryCode() (code, hash string, err error) {
	var sb strings.Builder
	alphabetSize := big.NewInt(int64(len(recoveryCodeAlphabet)))
	for i := 0; i < recoveryCodeLength; i++ {
		if i > 0 && i%recoveryCodeGroupSize == 0 {
			sb.WriteByte('-')
		}
		n, err := rand.Int(rand.Reader, alphabetSize)
		if err != nil {
			return "", "", err
		}
		sb.WriteByte(recoveryCodeAlphabet[n.Int64()])
	}
	code = sb.String()
	return code, HashRecoveryCode(code), nil
}

// HashRecoveryCode ignores case, spaces and dashes, so a code typed by hand
// matches however it was entered.
func HashRecoveryCode(code string) string {
	normalized := strings.NewReplacer("-", "", " ", "").Replace(strings.ToUpper(code))
	sum := sha256.Sum256([]byte(normalized))
	return hex.EncodeToString(sum[:])
}
