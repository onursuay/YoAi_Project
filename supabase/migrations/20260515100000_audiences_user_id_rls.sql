-- Faz 2: Add user_id column + RLS to audiences table
-- Application-level isolation: all routes filter by user_id (primary guard)
-- RLS enabled for defence-in-depth (service role key bypasses by design)
-- user_id TEXT — consistent with rest of project (yoai_action_outcomes, user_business_profiles, etc.)

ALTER TABLE audiences ADD COLUMN IF NOT EXISTS user_id TEXT;

CREATE INDEX IF NOT EXISTS idx_audiences_user_id ON audiences (user_id);

ALTER TABLE audiences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audiences_select_own" ON audiences;
CREATE POLICY "audiences_select_own" ON audiences
  FOR SELECT
  USING (user_id = COALESCE(auth.uid()::text, current_setting('request.jwt.claim.sub', true)));

DROP POLICY IF EXISTS "audiences_insert_own" ON audiences;
CREATE POLICY "audiences_insert_own" ON audiences
  FOR INSERT
  WITH CHECK (user_id = COALESCE(auth.uid()::text, current_setting('request.jwt.claim.sub', true)));

DROP POLICY IF EXISTS "audiences_update_own" ON audiences;
CREATE POLICY "audiences_update_own" ON audiences
  FOR UPDATE
  USING (user_id = COALESCE(auth.uid()::text, current_setting('request.jwt.claim.sub', true)))
  WITH CHECK (user_id = COALESCE(auth.uid()::text, current_setting('request.jwt.claim.sub', true)));

DROP POLICY IF EXISTS "audiences_delete_own" ON audiences;
CREATE POLICY "audiences_delete_own" ON audiences
  FOR DELETE
  USING (user_id = COALESCE(auth.uid()::text, current_setting('request.jwt.claim.sub', true)));
