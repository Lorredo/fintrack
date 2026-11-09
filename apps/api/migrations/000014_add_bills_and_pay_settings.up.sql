CREATE TABLE IF NOT EXISTS bills (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
    name VARCHAR(100) NOT NULL,
    category VARCHAR(100) NOT NULL DEFAULT 'Bills & Utilities',
    amount DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
    frequency VARCHAR(10) NOT NULL CHECK (frequency IN ('weekly', 'monthly', 'yearly')),
    -- The first due date. Later ones follow from the frequency, keeping this
    -- day of the month (or the month's last day when it is shorter).
    start_date DATE NOT NULL,
    remind_days_before SMALLINT NOT NULL DEFAULT 1 CHECK (remind_days_before BETWEEN 0 AND 14),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bills_user_id ON bills(user_id);

-- One row per paid or skipped due date. Deleting the expense deletes the row,
-- so that due date is unpaid again.
CREATE TABLE IF NOT EXISTS bill_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bill_id UUID NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    due_date DATE NOT NULL,
    transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE,
    skipped BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (bill_id, due_date)
);

CREATE INDEX idx_bill_payments_user_id ON bill_payments(user_id);
CREATE INDEX idx_bill_payments_transaction_id ON bill_payments(transaction_id);

ALTER TABLE users ADD COLUMN IF NOT EXISTS pay_schedule VARCHAR(20)
    CHECK (pay_schedule IN ('semi_monthly', 'irregular'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS savings_per_payday DECIMAL(12, 2) NOT NULL DEFAULT 0
    CHECK (savings_per_payday >= 0);
ALTER TABLE users ADD COLUMN IF NOT EXISTS bill_reminders BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE accounts ADD COLUMN IF NOT EXISTS in_safe_to_spend BOOLEAN NOT NULL DEFAULT TRUE;
