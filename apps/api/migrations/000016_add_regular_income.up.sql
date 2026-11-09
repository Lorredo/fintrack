-- Regular income besides the salary, such as allowances, planned as part of
-- each pay period's expected pay. A JSON list of {name, amount, kind, day, nth, weekday}.
ALTER TABLE users ADD COLUMN IF NOT EXISTS regular_incomes JSONB NOT NULL DEFAULT '[]'::jsonb;
