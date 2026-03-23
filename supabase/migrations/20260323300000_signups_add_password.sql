-- Add password_hash to signups for authenticated login.
ALTER TABLE signups ADD COLUMN IF NOT EXISTS password_hash text;
