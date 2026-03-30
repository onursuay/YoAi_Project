-- YoAi Daily Run — stores daily analysis results
-- Each user gets one run per day (Europe/Istanbul timezone)
-- Page refresh reads from this table instead of re-running analysis

CREATE TABLE IF NOT EXISTS yoai_daily_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  run_date DATE NOT NULL,                    -- YYYY-MM-DD in Europe/Istanbul
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  command_center_data JSONB,                 -- DeepAnalysisResult
  ad_proposals_data JSONB,                   -- { proposals, summary, fitAnalyses }
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, run_date)                 -- one run per user per day
);

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_yoai_daily_runs_user_date
  ON yoai_daily_runs (user_id, run_date DESC);

CREATE INDEX IF NOT EXISTS idx_yoai_daily_runs_user_status
  ON yoai_daily_runs (user_id, status, run_date DESC);
