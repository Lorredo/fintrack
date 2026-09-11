CREATE TABLE IF NOT EXISTS accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'cash',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 1. Add account_id columns (nullable initially for backfilling)
ALTER TABLE transactions ADD COLUMN account_id UUID REFERENCES accounts(id) ON DELETE CASCADE;
ALTER TABLE budgets ADD COLUMN account_id UUID REFERENCES accounts(id) ON DELETE CASCADE;

-- 2. Backfill existing data
DO $$
DECLARE
    u_record RECORD;
    new_account_id UUID;
BEGIN
    FOR u_record IN SELECT id FROM users LOOP
        -- Create default Cash account for user
        INSERT INTO accounts (user_id, name, type) 
        VALUES (u_record.id, 'Cash', 'cash') 
        RETURNING id INTO new_account_id;
        
        -- Update transactions and budgets for this user
        UPDATE transactions SET account_id = new_account_id WHERE user_id = u_record.id;
        UPDATE budgets SET account_id = new_account_id WHERE user_id = u_record.id;
    END LOOP;
END $$;

-- 3. Make account_id NOT NULL now that data is backfilled
ALTER TABLE transactions ALTER COLUMN account_id SET NOT NULL;
ALTER TABLE budgets ALTER COLUMN account_id SET NOT NULL;
