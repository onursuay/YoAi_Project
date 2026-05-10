-- ─────────────────────────────────────────────────────────────
-- YoAlgoritma — Pending Approvals (Faz 0C)
--
-- AI Reklam Önerileri için kalıcı approval queue. Her proposal
-- üretildiğinde (generate-ad) bir kayıt oluşur (pending), kullanıcı
-- onayla/reddet/beklet/düzenle aksiyonlarıyla state'i değiştirir.
--
-- Status değerleri:
--   pending    — kullanıcı henüz karar vermedi
--   approved   — kullanıcı onayladı; publish henüz yapılmadı (ara state)
--   rejected   — kullanıcı reddetti (terminal)
--   hold       — kullanıcı beklet dedi (re-açılabilir)
--   editing    — kullanıcı wizard'da düzenliyor (Faz 0C: pasif placeholder)
--   published  — publish başarılı (terminal, publish_audit_id ile bağlı)
--   failed     — publish başarısız ama proposal yine yaşıyor (retry mümkün)
--   expired    — TTL veya manuel expire (Faz 0C+'de doldurulacak)
--
-- Tenant izolasyonu: signups(id) UUID FK + RLS.
-- Idempotent migration (IF NOT EXISTS / DROP POLICY IF EXISTS).
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.yoai_pending_approvals (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES public.signups(id) ON DELETE CASCADE,
  proposal_id         TEXT NOT NULL,
  source_run_id       UUID,
  platform            TEXT NOT NULL,
  source_campaign_id  TEXT,
  campaign_type       TEXT,
  proposal_snapshot   JSONB NOT NULL,
  status              TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'hold', 'editing', 'published', 'failed', 'expired')),
  status_reason       TEXT,
  rejection_reason    TEXT,
  hold_reason         TEXT,
  edited_payload      JSONB,
  approved_at         TIMESTAMPTZ,
  rejected_at         TIMESTAMPTZ,
  held_at             TIMESTAMPTZ,
  published_at        TIMESTAMPTZ,
  failed_at           TIMESTAMPTZ,
  publish_audit_id    UUID REFERENCES public.yoai_publish_audit_log(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata            JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- (user_id, proposal_id) tekilliği — duplicate pending kayıt engeli için.
CREATE UNIQUE INDEX IF NOT EXISTS uq_yoai_pending_approvals_user_proposal
  ON public.yoai_pending_approvals (user_id, proposal_id);

CREATE INDEX IF NOT EXISTS idx_yoai_pending_approvals_user
  ON public.yoai_pending_approvals (user_id);

CREATE INDEX IF NOT EXISTS idx_yoai_pending_approvals_status
  ON public.yoai_pending_approvals (status);

CREATE INDEX IF NOT EXISTS idx_yoai_pending_approvals_proposal_id
  ON public.yoai_pending_approvals (proposal_id);

CREATE INDEX IF NOT EXISTS idx_yoai_pending_approvals_platform
  ON public.yoai_pending_approvals (platform);

CREATE INDEX IF NOT EXISTS idx_yoai_pending_approvals_source_campaign
  ON public.yoai_pending_approvals (source_campaign_id)
  WHERE source_campaign_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_yoai_pending_approvals_created
  ON public.yoai_pending_approvals (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_yoai_pending_approvals_user_status_created
  ON public.yoai_pending_approvals (user_id, status, created_at DESC);

-- RLS: kullanıcı sadece kendi approval kayıtlarına erişir.
-- Service role key bypass eder; bu uygulama kodunu kırmaz.
ALTER TABLE public.yoai_pending_approvals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "yoai_pending_approvals_select_own" ON public.yoai_pending_approvals;
CREATE POLICY "yoai_pending_approvals_select_own"
  ON public.yoai_pending_approvals
  FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "yoai_pending_approvals_insert_own" ON public.yoai_pending_approvals;
CREATE POLICY "yoai_pending_approvals_insert_own"
  ON public.yoai_pending_approvals
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "yoai_pending_approvals_update_own" ON public.yoai_pending_approvals;
CREATE POLICY "yoai_pending_approvals_update_own"
  ON public.yoai_pending_approvals
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "yoai_pending_approvals_delete_own" ON public.yoai_pending_approvals;
CREATE POLICY "yoai_pending_approvals_delete_own"
  ON public.yoai_pending_approvals
  FOR DELETE
  USING (user_id = auth.uid());

COMMENT ON TABLE public.yoai_pending_approvals IS
  'AI Reklam Önerileri için approval lifecycle queue (Faz 0C). publish_audit_id alanı yoai_publish_audit_log''e bağlanır.';
COMMENT ON COLUMN public.yoai_pending_approvals.proposal_snapshot IS
  'Proposal anının snapshot''ı (sanitize edilmiş). Token/secret içermez.';
COMMENT ON COLUMN public.yoai_pending_approvals.metadata IS
  'Genişletilebilir alan: last_publish_attempt, source, vb.';
