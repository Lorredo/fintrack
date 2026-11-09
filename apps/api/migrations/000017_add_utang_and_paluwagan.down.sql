DROP TABLE IF EXISTS paluwagan_payments;
DROP TABLE IF EXISTS paluwagans;
DROP TABLE IF EXISTS debt_payments;
DROP TABLE IF EXISTS debts;

DELETE FROM transactions WHERE type IN ('loan_in', 'loan_out');
ALTER TABLE transactions DROP CONSTRAINT transactions_type_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_type_check
    CHECK (type IN ('income', 'expense', 'transfer', 'adjust_in', 'adjust_out'));
