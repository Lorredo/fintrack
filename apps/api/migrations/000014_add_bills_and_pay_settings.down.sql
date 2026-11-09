ALTER TABLE accounts DROP COLUMN IF EXISTS in_safe_to_spend;

ALTER TABLE users DROP COLUMN IF EXISTS bill_reminders;
ALTER TABLE users DROP COLUMN IF EXISTS savings_per_payday;
ALTER TABLE users DROP COLUMN IF EXISTS pay_schedule;

DROP TABLE IF EXISTS bill_payments;
DROP TABLE IF EXISTS bills;
