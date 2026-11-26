-- The day the pay actually arrived. When the salary comes before payday, the
-- new pay period starts on this day. NULL for pay marked "already added".
ALTER TABLE pay_records ADD COLUMN IF NOT EXISTS received_on DATE;
