-- Utang and paluwagan move wallet money without being income or expenses.
ALTER TABLE transactions DROP CONSTRAINT transactions_type_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_type_check
    CHECK (type IN ('income', 'expense', 'transfer', 'adjust_in', 'adjust_out', 'loan_in', 'loan_out'));

CREATE TABLE IF NOT EXISTS debts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    person_name VARCHAR(80) NOT NULL,
    -- lent: they owe the user. borrowed: the user owes them.
    direction VARCHAR(10) NOT NULL CHECK (direction IN ('lent', 'borrowed')),
    amount DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
    account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
    date DATE NOT NULL,
    due_date DATE,
    notes TEXT,
    -- The money that moved when the debt was made.
    transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_debts_user_id ON debts(user_id);

CREATE TABLE IF NOT EXISTS debt_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    debt_id UUID NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
    date DATE NOT NULL,
    account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
    -- Deleting the transaction deletes the payment, so the debt is owed again.
    transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_debt_payments_debt_id ON debt_payments(debt_id);

CREATE TABLE IF NOT EXISTS paluwagans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(80) NOT NULL,
    contribution DECIMAL(12, 2) NOT NULL CHECK (contribution > 0),
    frequency VARCHAR(15) NOT NULL CHECK (frequency IN ('weekly', 'semi_monthly', 'monthly')),
    -- Round 1's date. Later rounds follow from the frequency.
    start_date DATE NOT NULL,
    members SMALLINT NOT NULL CHECK (members BETWEEN 2 AND 50),
    my_turn SMALLINT NOT NULL CHECK (my_turn >= 1 AND my_turn <= members),
    payout_amount DECIMAL(12, 2) NOT NULL CHECK (payout_amount > 0),
    account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_paluwagans_user_id ON paluwagans(user_id);

CREATE TABLE IF NOT EXISTS paluwagan_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    paluwagan_id UUID NOT NULL REFERENCES paluwagans(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    round SMALLINT NOT NULL CHECK (round >= 1),
    kind VARCHAR(15) NOT NULL CHECK (kind IN ('contribution', 'payout')),
    amount DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
    date DATE NOT NULL,
    transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (paluwagan_id, round, kind)
);
CREATE INDEX idx_paluwagan_payments_user_id ON paluwagan_payments(user_id);
