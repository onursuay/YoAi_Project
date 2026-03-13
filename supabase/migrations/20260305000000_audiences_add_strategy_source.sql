-- Add 'STRATEGY' to audiences source CHECK constraint
-- This allows the strategy module to create draft audiences from personas

ALTER TABLE audiences DROP CONSTRAINT IF EXISTS audiences_source_check;
ALTER TABLE audiences ADD CONSTRAINT audiences_source_check
  CHECK (source IS NULL OR source IN ('PIXEL', 'IG', 'PAGE', 'VIDEO', 'LEADFORM', 'CATALOG', 'APP', 'OFFLINE', 'CUSTOMER_LIST', 'STRATEGY'));
