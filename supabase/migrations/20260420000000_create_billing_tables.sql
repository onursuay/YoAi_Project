-- Billing system: real subscriptions, credit balances, payment transactions.
-- Replaces the localStorage-based subscription/credit system.
-- All monetary decisions (price, credits granted, period length) are derived
-- server-side from the plan_id; frontend-submitted amounts are ignored.

CREATE TABLE IF NOT EXISTS subscriptions (
  user_id uuid PRIMARY KEY REFERENCES signups(id) ON DELETE CASCADE,
  plan_id text NOT NULL CHECK (plan_id IN ('free','basic','starter','premium','enterprise')),
  status text NOT NULL CHECK (status IN ('trial','active','cancelled','expired')),
  billing_cycle text NOT NULL CHECK (billing_cycle IN ('monthly','yearly')),
  ad_accounts int NOT NULL DEFAULT 2,
  trial_end_date timestamptz,
  current_period_end timestamptz NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS credit_balances (
  user_id uuid PRIMARY KEY REFERENCES signups(id) ON DELETE CASCADE,
  balance int NOT NULL DEFAULT 100,
  total_earned int NOT NULL DEFAULT 100,
  total_spent int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES signups(id) ON DELETE CASCADE,
  conversation_id text NOT NULL UNIQUE,
  iyzico_token text UNIQUE,
  iyzico_payment_id text UNIQUE,
  item_type text NOT NULL CHECK (item_type IN ('subscription','credit_pack')),
  plan_id text,
  package_id text,
  billing_cycle text CHECK (billing_cycle IN ('monthly','yearly')),
  ad_accounts int,
  amount numeric(10,2) NOT NULL,
  currency text NOT NULL DEFAULT 'TRY',
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','succeeded','failed','processed')),
  raw_init jsonb,
  raw_callback jsonb,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_user ON payment_transactions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON payment_transactions (status);

COMMENT ON TABLE subscriptions IS 'Server-side source of truth for user plan. localStorage "yoai-subscription" is removed.';
COMMENT ON TABLE credit_balances IS 'Server-side source of truth for user credits. localStorage "yoai-credits" is removed.';
COMMENT ON TABLE payment_transactions IS 'Iyzico payment records. conversation_id is generated server-side and echoed back by Iyzico to prevent tampering.';
