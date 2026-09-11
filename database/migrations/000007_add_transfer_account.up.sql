ALTER TABLE transactions 
ADD COLUMN transfer_account_id UUID REFERENCES accounts(id) ON DELETE CASCADE;
