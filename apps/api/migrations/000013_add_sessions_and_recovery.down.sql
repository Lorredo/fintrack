ALTER TABLE users DROP COLUMN IF EXISTS email_verified;
ALTER TABLE users DROP COLUMN IF EXISTS recovery_code_hash;

DROP TABLE IF EXISTS refresh_tokens;
