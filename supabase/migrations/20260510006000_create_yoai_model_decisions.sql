-- ──────────────────────────────────────────────────────────
-- YoAlgoritma — Multi-AI Decision Desk audit log (Faz 4)
--
-- Her AI rol çağrısı (strategist/creative/risk_policy/
-- technical_validator/judge) ve judge sentezi bu tabloya
-- yazılır. Shadow mode: publish yapmaz, sadece audit eder.
-- ──────────────────────────────────────────────────────────

create table if not exists yoai_model_decisions (
  id                   uuid        primary key default gen_random_uuid(),
  user_id              uuid        not null references signups(id) on delete cascade,
  proposal_id          text        null,
  source_campaign_id   text        null,
  platform             text        null,
  campaign_type        text        null,
  synthesis_hash       text        not null,
  role                 text        not null,   -- strategist | creative | risk_policy | technical_validator | judge
  provider             text        not null,   -- openai | anthropic | gemini | deterministic
  model                text        null,
  input_hash           text        not null,
  output_json          jsonb       not null default '{}'::jsonb,
  raw_excerpt          text        null,
  confidence           integer     default 0,
  risk_level           text        null,
  publish_ready        boolean     default false,
  requires_human_review boolean    default true,
  cost_estimate        jsonb       default '{}'::jsonb,
  token_usage          jsonb       default '{}'::jsonb,
  latency_ms           integer     null,
  status               text        not null default 'success',  -- success | failed | skipped | timeout | disabled | skipped_cost_guard
  error_message        text        null,
  created_at           timestamptz default now(),
  updated_at           timestamptz default now()
);

-- ── Indexler ──

create index if not exists idx_yoai_model_decisions_user_id
  on yoai_model_decisions (user_id);

create index if not exists idx_yoai_model_decisions_proposal_id
  on yoai_model_decisions (proposal_id);

create index if not exists idx_yoai_model_decisions_source_campaign_id
  on yoai_model_decisions (source_campaign_id);

create index if not exists idx_yoai_model_decisions_role
  on yoai_model_decisions (role);

create index if not exists idx_yoai_model_decisions_provider
  on yoai_model_decisions (provider);

create index if not exists idx_yoai_model_decisions_synthesis_hash
  on yoai_model_decisions (synthesis_hash);

create index if not exists idx_yoai_model_decisions_created_at
  on yoai_model_decisions (created_at desc);

create index if not exists idx_yoai_model_decisions_user_campaign_role
  on yoai_model_decisions (user_id, source_campaign_id, role, created_at desc);

-- ── RLS ──

alter table yoai_model_decisions enable row level security;

-- Kullanıcı yalnızca kendi kayıtlarını okuyabilir
create policy "yoai_model_decisions_select_own"
  on yoai_model_decisions
  for select
  using (user_id::text = auth.uid()::text);

-- Write işlemleri service_role üzerinden yapılır (RLS bypass)
-- Insert/update/delete policy yok — sadece service_role key ile yazılır
