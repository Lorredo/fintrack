ALTER TABLE budgets ADD COLUMN start_date DATE;
ALTER TABLE budgets ADD COLUMN end_date DATE;
ALTER TABLE budgets ADD COLUMN period_type VARCHAR(20);

UPDATE budgets SET
    start_date = (month || '-01')::DATE,
    end_date = ((month || '-01')::DATE + INTERVAL '1 month' - INTERVAL '1 day')::DATE,
    period_type = 'monthly';

ALTER TABLE budgets ALTER COLUMN start_date SET NOT NULL;
ALTER TABLE budgets ALTER COLUMN end_date SET NOT NULL;
ALTER TABLE budgets ALTER COLUMN period_type SET NOT NULL;

ALTER TABLE budgets DROP CONSTRAINT budgets_user_id_category_month_key;
ALTER TABLE budgets ADD CONSTRAINT budgets_user_id_category_start_date_end_date_key UNIQUE (user_id, category, start_date, end_date);
ALTER TABLE budgets DROP COLUMN month;
