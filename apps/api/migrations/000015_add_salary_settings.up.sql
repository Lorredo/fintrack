-- Safe to Spend plans from each payday's salary. Income above it (overtime,
-- bonuses) is split between savings and spending by this percentage.
ALTER TABLE users ADD COLUMN IF NOT EXISTS salary_per_payday DECIMAL(12, 2) NOT NULL DEFAULT 0
    CHECK (salary_per_payday >= 0);
ALTER TABLE users ADD COLUMN IF NOT EXISTS extra_to_savings_percent SMALLINT NOT NULL DEFAULT 50
    CHECK (extra_to_savings_percent BETWEEN 0 AND 100);
