-- User signup registrations with email verification flow.
-- Status: pending → active (after email verification) or expired.

CREATE TABLE IF NOT EXISTS signups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  company text,
  phone text,
  verification_token text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'expired')),
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_signups_email ON signups (email);
CREATE UNIQUE INDEX IF NOT EXISTS idx_signups_token ON signups (verification_token);
CREATE INDEX IF NOT EXISTS idx_signups_status ON signups (status);

COMMENT ON TABLE signups IS 'Landing page signup registrations with email verification. Token validated via /api/signup/verify.';
