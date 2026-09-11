ALTER TABLE budgets ADD COLUMN month VARCHAR(7);

UPDATE budgets SET
    month = to_char(start_date, 'YYYY-MM');

ALTER TABLE budgets ALTER COLUMN month SET NOT NULL;

ALTER TABLE budgets DROP CONSTRAINT budgets_user_id_category_start_date_end_date_key;
ALTER TABLE budgets ADD CONSTRAINT budgets_user_id_category_month_key UNIQUE (user_id, category, month);

ALTER TABLE budgets DROP COLUMN start_date;
ALTER TABLE budgets DROP COLUMN end_date;
ALTER TABLE budgets DROP COLUMN period_type;
