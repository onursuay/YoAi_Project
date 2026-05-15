-- Manual signup approval + pre-meeting scheduling.
--
-- Mevcut `signups.status` (pending|active|expired) email doğrulama akışı
-- içindir; bu migration ayrıca bir `approval_status` alanı ekler. Email
-- doğrulanmış olsa bile (status='active') kullanıcı `approval_status='approved'`
-- olmadan iç panellere erişemez.

ALTER TABLE signups
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'pending'
    CHECK (approval_status IN ('pending','approved','rejected','call_scheduled','call_declined','needs_call')),
  ADD COLUMN IF NOT EXISTS approval_note text,
  ADD COLUMN IF NOT EXISTS signup_source text,
  ADD COLUMN IF NOT EXISTS premeeting_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS premeeting_status text NOT NULL DEFAULT 'pending'
    CHECK (premeeting_status IN ('pending','scheduled','declined')),
  ADD COLUMN IF NOT EXISTS premeeting_scheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS premeeting_calendar_event_id text,
  ADD COLUMN IF NOT EXISTS premeeting_declined_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by text,
  ADD COLUMN IF NOT EXISTS rejected_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejected_by text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_signups_approval_status ON signups (approval_status);
CREATE INDEX IF NOT EXISTS idx_signups_premeeting_status ON signups (premeeting_status);

COMMENT ON COLUMN signups.approval_status IS
  'Manuel onay durumu: pending → owner onayı bekliyor; approved → iç paneller açık; rejected → erişim engelli; call_scheduled / call_declined → ön görüşme akışı sonucu.';
COMMENT ON COLUMN signups.premeeting_status IS
  '30 dk ön görüşme durumu: pending → henüz seçim yok; scheduled → randevu alındı; declined → kullanıcı planlamak istemedi.';

-- Signup'a bağlı ön görüşme randevuları. Landing page'deki `bookings` tablosundan
-- ayrı tutuyoruz çünkü buradaki kayıtlar oturumlu signup'lara bağlı ve
-- approval akışında zorunlu sıra koruma noktası.
CREATE TABLE IF NOT EXISTS signup_premeeting_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  signup_id uuid NOT NULL REFERENCES signups(id) ON DELETE CASCADE,
  scheduled_at timestamptz NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 30,
  status text NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled','completed','cancelled')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_signup_premeeting_bookings_scheduled_at
  ON signup_premeeting_bookings (scheduled_at);
CREATE INDEX IF NOT EXISTS idx_signup_premeeting_bookings_signup_id
  ON signup_premeeting_bookings (signup_id);

-- Aynı slot iki signup tarafından alınamasın.
CREATE UNIQUE INDEX IF NOT EXISTS idx_signup_premeeting_bookings_slot_unique
  ON signup_premeeting_bookings (scheduled_at)
  WHERE status = 'scheduled';

COMMENT ON TABLE signup_premeeting_bookings IS
  'Manuel onay öncesi 30 dk ön görüşme randevuları. Slot çakışmasına izin vermez.';

-- Notification log — owner bildirim maillerinin gönderim/başarısızlık kayıtları.
CREATE TABLE IF NOT EXISTS notification_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient text NOT NULL,
  subject text,
  notification_type text NOT NULL,
  related_user_id uuid,
  status text NOT NULL CHECK (status IN ('sent','failed')),
  error_message text,
  sent_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notification_log_type ON notification_log (notification_type);
CREATE INDEX IF NOT EXISTS idx_notification_log_user ON notification_log (related_user_id);
CREATE INDEX IF NOT EXISTS idx_notification_log_sent_at ON notification_log (sent_at DESC);

COMMENT ON TABLE notification_log IS
  'Owner / kullanıcı bildirim maillerinin gönderim sonucu logu. Başarısız gönderimler de kaydedilir.';
