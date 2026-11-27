-- The plan each pay period was worked out with, so Pay period history keeps
-- showing it after the salary or savings target changes. Saved while the
-- period is current; it stops changing once the period ends.
CREATE TABLE IF NOT EXISTS pay_period_plans (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    -- The period's opening payday as scheduled, or the month's 1st for irregular pay.
    period_key DATE NOT NULL,
    expected_pay DECIMAL(12,2) NOT NULL,
    savings_per_payday DECIMAL(12,2) NOT NULL,
    extra_to_savings_percent SMALLINT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, period_key)
);
