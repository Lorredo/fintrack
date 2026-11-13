-- The wallet a salary lands in, for the one-tap "Record pay" prompt.
ALTER TABLE users ADD COLUMN IF NOT EXISTS salary_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL;

-- One row per recorded (or "already added") salary or allowance. Deleting the
-- income deletes the row, so that pay is pending again.
CREATE TABLE IF NOT EXISTS pay_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    -- 'salary', or 'income:' plus the allowance's name in lower case.
    item_key VARCHAR(120) NOT NULL,
    pay_date DATE NOT NULL,
    transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE,
    skipped BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, item_key, pay_date)
);

CREATE INDEX idx_pay_records_transaction_id ON pay_records(transaction_id);
