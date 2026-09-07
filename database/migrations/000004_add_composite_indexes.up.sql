-- Add composite indexes to optimize dashboard and report queries
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, date);
CREATE INDEX IF NOT EXISTS idx_transactions_user_category_type ON transactions(user_id, category, type);
CREATE INDEX IF NOT EXISTS idx_budgets_user_month ON budgets(user_id, month);
