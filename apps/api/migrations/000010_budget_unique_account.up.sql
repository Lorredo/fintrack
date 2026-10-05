ALTER TABLE budgets DROP CONSTRAINT budgets_user_id_category_start_date_end_date_key;
ALTER TABLE budgets ADD CONSTRAINT budgets_user_id_account_id_category_start_date_end_date_key UNIQUE (user_id, account_id, category, start_date, end_date);
