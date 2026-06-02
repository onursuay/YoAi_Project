# Email Bounce Auto-Block & Drip Sequence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** (A) Hard bounce / spam şikayeti gelince kişiyi otomatik opt-out et; (B) 2-3 adımlı zaman gecikmeli e-posta dizisi (drip) desteği ekle.

**Architecture:**
Part A — Resend webhook'u `POST /api/email/webhooks/resend` endpoint'i alır; `resend_id` üzerinden `email_sends` kaydını bulur; hard bounce / complaint durumunda `email_contacts.opt_out = true` + `crm_leads.email_opt_out = true` yapar; `email_events` tablosuna event kaydeder.
Part B — `email_automation_steps` (adımlar) ve `email_drip_queue` (bekleyen gönderimler) tabloları eklenir. `automationRunner.ts` adım varsa anında göndermek yerine kuyruğa ekler. Saatlik cron (`/api/cron/email-drip-process`) vakti gelenlerini gönderir. Geri uyumluluk korunur: adımsız eski otomasyonlar eskisi gibi çalışır.

**Tech Stack:** Next.js App Router, Supabase (postgres service-role), Resend webhook, next-intl (tr+en), vercel.json cron.

**Genel kurallar (her task'ta uy):**
- Hardcoded string YOK — tüm UI metni `tr.json` + `en.json` (aynı key).
- Native `<select>` YOK — `WizardSelect`. Amber/sarı renk YOK.
- Meta/Google entegrasyon koduna **dokunma**.
- Her task sonunda `npx tsc --noEmit` 0 hata; sonra commit.

---

## PART A — Bounce Auto-Block

### Task 1: Resend Webhook Endpoint

**Files:**
- Create: `app/api/email/webhooks/resend/route.ts`

Resend webhook payload örnekleri:
```json
// email.bounced
{ "type": "email.bounced", "data": { "email_id": "re_abc123", "to": ["user@example.com"], "bounce": { "type": "hard" } } }

// email.complained
{ "type": "email.complained", "data": { "email_id": "re_abc123", "to": ["user@example.com"] } }

// email.delivered
{ "type": "email.delivered", "data": { "email_id": "re_abc123", "to": ["user@example.com"] } }
```

- [ ] **Step 1: Endpoint dosyasını yaz**

```ts
// app/api/email/webhooks/resend/route.ts
import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'

export const dynamic = 'force-dynamic'

const HARD_BOUNCE_TYPES = new Set(['email.bounced', 'email.complained'])

export async function POST(req: Request) {
  // Basit secret kontrolü — Resend dashboard'da webhook URL'sine ?secret=... ekle
  const url = new URL(req.url)
  const secret = url.searchParams.get('secret')
  if (!process.env.RESEND_WEBHOOK_SECRET || secret !== process.env.RESEND_WEBHOOK_SECRET) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  let body: { type: string; data: { email_id: string; to: string[]; bounce?: { type: string } } }
  try { body = await req.json() } catch { return NextResponse.json({ ok: false }, { status: 400 }) }

  const { type, data } = body
  const emailId = data?.email_id
  if (!emailId || !supabase) return NextResponse.json({ ok: true })

  // resend_id ile send kaydını bul
  const { data: send } = await supabase
    .from('email_sends')
    .select('id, user_id, email, contact_id')
    .eq('resend_id', emailId)
    .maybeSingle()

  if (!send) return NextResponse.json({ ok: true })

  const isHardBounce = type === 'email.bounced' && data.bounce?.type === 'hard'
  const isComplaint = type === 'email.complained'
  const isDelivered = type === 'email.delivered'

  // email_events'e kaydet
  const eventType = isHardBounce ? 'bounced' : isComplaint ? 'complained' : isDelivered ? 'delivered' : type.replace('email.', '')
  await supabase.from('email_events').insert({
    send_id: send.id,
    user_id: send.user_id,
    type: eventType,
    at: new Date().toISOString(),
    meta: data.bounce ? { bounce_type: data.bounce.type } : {},
  })

  // email_sends status güncelle
  if (isHardBounce || isComplaint) {
    await supabase.from('email_sends').update({ status: isComplaint ? 'complained' : 'bounced' }).eq('id', send.id)
  } else if (isDelivered) {
    await supabase.from('email_sends').update({ status: 'delivered' }).eq('id', send.id)
  }

  // Hard bounce veya complaint → kişiyi opt-out et
  if (isHardBounce || isComplaint) {
    const email = send.email.trim().toLowerCase()
    await supabase
      .from('email_contacts')
      .update({ opt_out: true, opt_out_at: new Date().toISOString() })
      .eq('user_id', send.user_id)
      .eq('email', email)

    // CRM'de de işaretle (eğer kayıt varsa)
    await supabase
      .from('crm_leads')
      .update({ email_opt_out: true })
      .eq('user_id', send.user_id)
      .eq('email', email)
  }

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: TypeScript kontrolü**

```bash
cd "/Users/onursuay/Desktop/Onur Suay/YO Dijital/YOAİ/YoAi_Project"
npx tsc --noEmit 2>&1 | grep "webhooks/resend"
```

Beklenen: Çıktı yok (hata yok).

- [ ] **Step 3: `email_sends` tablosuna `complained` status ekle (migration)**

`email_sends.status` için mevcut CHECK: `queued|sent|delivered|bounced|failed`.
`complained` eklenecek.

```sql
-- supabase/migrations/20260602000000_email_sends_bounce_webhook.sql
-- email_sends: 'complained' status ekleniyor ve status kısıtı güncelleniyor
-- Mevcut CHECK constraint'i drop edip yeniden oluştur (Postgres izin verir)
ALTER TABLE public.email_sends
  DROP CONSTRAINT IF EXISTS email_sends_status_check;

ALTER TABLE public.email_sends
  ADD CONSTRAINT email_sends_status_check
  CHECK (status IN ('queued','sent','delivered','bounced','complained','failed'));
```

Dosyayı `supabase/migrations/20260602000000_email_sends_bounce_webhook.sql` olarak kaydet.

- [ ] **Step 4: Migration'ı Supabase omddq'ya uygula**

Supabase dashboard → SQL Editor → içeriği yapıştır → RUN.
Beklenen: "Success" mesajı.

- [ ] **Step 5: `.env.local`'a secret ekle**

```bash
# .env.local dosyasına ekle:
RESEND_WEBHOOK_SECRET=buraya-guclu-rastgele-bir-deger-yaz
```

Resend dashboard → Webhooks → Add Webhook:
- URL: `https://yoai.yodijital.com/api/email/webhooks/resend?secret=<RESEND_WEBHOOK_SECRET_DEGERI>`
- Events: `email.bounced`, `email.complained`, `email.delivered`

Vercel dashboard'a da `RESEND_WEBHOOK_SECRET` env var olarak ekle.

- [ ] **Step 6: Commit**

```bash
git add app/api/email/webhooks/resend/route.ts supabase/migrations/20260602000000_email_sends_bounce_webhook.sql
git commit -m "feat(email): bounce/complaint webhook → auto opt-out + event log"
git push
```

---

## PART B — Drip Sequence

### Task 2: DB Migration — automation_steps + drip_queue

**Files:**
- Create: `supabase/migrations/20260602001000_email_drip_steps.sql`

- [ ] **Step 1: Migration dosyasını yaz**

```sql
-- supabase/migrations/20260602001000_email_drip_steps.sql
-- Mevcut otomasyonlar geri uyumlu çalışmaya devam eder (adım yoksa eski davranış).

CREATE TABLE IF NOT EXISTS public.email_automation_steps (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id uuid NOT NULL REFERENCES public.email_automations(id) ON DELETE CASCADE,
  step_order    int NOT NULL DEFAULT 0,
  subject       text NOT NULL DEFAULT '',
  html          text NOT NULL DEFAULT '',
  delay_days    int NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (automation_id, step_order)
);
CREATE INDEX IF NOT EXISTS idx_automation_steps_automation ON public.email_automation_steps(automation_id);

CREATE TABLE IF NOT EXISTS public.email_drip_queue (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id uuid NOT NULL REFERENCES public.email_automations(id) ON DELETE CASCADE,
  step_id       uuid NOT NULL REFERENCES public.email_automation_steps(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES public.signups(id) ON DELETE CASCADE,
  contact_id    uuid REFERENCES public.email_contacts(id) ON DELETE SET NULL,
  email         text NOT NULL,
  scheduled_at  timestamptz NOT NULL,
  status        text NOT NULL DEFAULT 'pending',
  sent_at       timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_drip_queue_due ON public.email_drip_queue(scheduled_at, status)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_drip_queue_user ON public.email_drip_queue(user_id);

-- RLS
ALTER TABLE public.email_automation_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_drip_queue       ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email_automation_steps_own" ON public.email_automation_steps
  FOR SELECT USING (
    automation_id IN (SELECT id FROM public.email_automations WHERE user_id = auth.uid())
  );
CREATE POLICY "email_drip_queue_own" ON public.email_drip_queue
  FOR SELECT USING (user_id = auth.uid());
```

- [ ] **Step 2: Migration'ı Supabase omddq'ya uygula**

Supabase dashboard → SQL Editor → içeriği yapıştır → RUN.
Beklenen: iki yeni tablo oluştu.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260602001000_email_drip_steps.sql
git commit -m "feat(email/drip): automation_steps + drip_queue migration"
git push
```

---

### Task 3: automationStepsStore + dripQueue lib

**Files:**
- Create: `lib/email/automationStepsStore.ts`
- Create: `lib/email/dripQueue.ts`

- [ ] **Step 1: `automationStepsStore.ts` yaz**

```ts
// lib/email/automationStepsStore.ts
import 'server-only'
import { supabase } from '@/lib/supabase/client'

export interface StepRow {
  id: string
  automation_id: string
  step_order: number
  subject: string
  html: string
  delay_days: number
  created_at: string
}

export interface StepInput {
  step_order: number
  subject: string
  html: string
  delay_days: number
}

export async function listSteps(automationId: string): Promise<StepRow[]> {
  if (!supabase) return []
  const { data } = await supabase
    .from('email_automation_steps')
    .select('*')
    .eq('automation_id', automationId)
    .order('step_order', { ascending: true })
  return (data ?? []) as StepRow[]
}

export async function replaceSteps(automationId: string, steps: StepInput[]): Promise<void> {
  if (!supabase) return
  // Önce sil, sonra yeniden ekle (basit upsert yerine)
  await supabase.from('email_automation_steps').delete().eq('automation_id', automationId)
  if (steps.length === 0) return
  const rows = steps.map((s) => ({ ...s, automation_id: automationId }))
  await supabase.from('email_automation_steps').insert(rows)
}
```

- [ ] **Step 2: `dripQueue.ts` yaz**

```ts
// lib/email/dripQueue.ts
import 'server-only'
import { supabase } from '@/lib/supabase/client'
import type { StepRow } from './automationStepsStore'

export interface QueueItem {
  id: string
  automation_id: string
  step_id: string
  user_id: string
  contact_id: string | null
  email: string
  scheduled_at: string
  status: string
}

export async function enqueueSteps(
  userId: string,
  automationId: string,
  steps: StepRow[],
  contact: { email: string; contactId?: string | null },
): Promise<void> {
  if (!supabase || steps.length === 0) return
  const now = new Date()
  let cumulativeDays = 0
  const rows = steps.map((s) => {
    cumulativeDays += s.delay_days
    const scheduledAt = new Date(now.getTime() + cumulativeDays * 86_400_000).toISOString()
    return {
      automation_id: automationId,
      step_id: s.id,
      user_id: userId,
      contact_id: contact.contactId ?? null,
      email: contact.email,
      scheduled_at: scheduledAt,
      status: 'pending',
    }
  })
  await supabase.from('email_drip_queue').insert(rows)
}

export async function getDueItems(limit = 100): Promise<QueueItem[]> {
  if (!supabase) return []
  const now = new Date().toISOString()
  const { data } = await supabase
    .from('email_drip_queue')
    .select('*')
    .eq('status', 'pending')
    .lte('scheduled_at', now)
    .order('scheduled_at', { ascending: true })
    .limit(limit)
  return (data ?? []) as QueueItem[]
}

export async function markItemSent(itemId: string): Promise<void> {
  if (!supabase) return
  await supabase
    .from('email_drip_queue')
    .update({ status: 'sent', sent_at: new Date().toISOString() })
    .eq('id', itemId)
}

export async function markItemFailed(itemId: string): Promise<void> {
  if (!supabase) return
  await supabase.from('email_drip_queue').update({ status: 'failed' }).eq('id', itemId)
}
```

- [ ] **Step 3: TypeScript kontrolü**

```bash
npx tsc --noEmit 2>&1 | grep -E "automationSteps|dripQueue"
```

Beklenen: Çıktı yok.

- [ ] **Step 4: Commit**

```bash
git add lib/email/automationStepsStore.ts lib/email/dripQueue.ts
git commit -m "feat(email/drip): automationStepsStore + dripQueue lib"
git push
```

---

### Task 4: automationRunner.ts Güncelleme

**Files:**
- Modify: `lib/email/automationRunner.ts`

Mevcut `sendToContact()` dokunulmaz. Adımlar varsa kuyruğa ekle, yoksa eski davranış.

- [ ] **Step 1: automationRunner.ts güncelle**

```ts
// lib/email/automationRunner.ts
// Mevcut import'ların sonuna şunları ekle:
import { listSteps } from './automationStepsStore'
import { enqueueSteps } from './dripQueue'
```

`runStageAutomations()` içindeki `sendToContact` çağrısını şöyle güncelle:

```ts
// Mevcut:
// await sendToContact(userId, lead.email, matching)

// YENİ — her otomasyon için adım kontrolü yap:
for (const automation of matching) {
  const steps = await listSteps(automation.id)
  if (steps.length > 0) {
    // Drip: kuyruğa ekle
    await enqueueSteps(userId, automation.id, steps, {
      email: lead.email,
      contactId: null,
    })
  } else {
    // Eski davranış: tek adım, hemen gönder
    await sendToContact(userId, lead.email, [automation])
  }
}
```

Aynı pattern `runContactAddedAutomations()` içinde de uygula:

```ts
for (const automation of matching) {
  const steps = await listSteps(automation.id)
  if (steps.length > 0) {
    await enqueueSteps(userId, automation.id, steps, {
      email: contact.email,
      contactId: null,
    })
  } else {
    await sendToContact(userId, contact.email, [automation])
  }
}
```

**Tam güncellenmiş `runStageAutomations`:**

```ts
export async function runStageAutomations(
  userId: string,
  lead: { email: string | null; full_name?: string | null },
  stage: string,
): Promise<void> {
  if (!lead.email) return
  const all = await listEnabledAutomations(userId)
  const matching = all.filter(
    (a) => (a.trigger as AutomationTrigger).type === 'crm_stage_enter' &&
            (a.trigger as { type: string; stage: string }).stage === stage,
  )
  if (matching.length === 0) return
  for (const automation of matching) {
    const steps = await listSteps(automation.id)
    if (steps.length > 0) {
      await enqueueSteps(userId, automation.id, steps, { email: lead.email, contactId: null })
    } else {
      await sendToContact(userId, lead.email, [automation])
    }
  }
}
```

**Tam güncellenmiş `runContactAddedAutomations`:**

```ts
export async function runContactAddedAutomations(
  userId: string,
  contact: { email: string },
): Promise<void> {
  const all = await listEnabledAutomations(userId)
  const matching = all.filter((a) => (a.trigger as AutomationTrigger).type === 'contact_added')
  if (matching.length === 0) return
  for (const automation of matching) {
    const steps = await listSteps(automation.id)
    if (steps.length > 0) {
      await enqueueSteps(userId, automation.id, steps, { email: contact.email, contactId: null })
    } else {
      await sendToContact(userId, contact.email, [automation])
    }
  }
}
```

- [ ] **Step 2: TypeScript kontrolü**

```bash
npx tsc --noEmit 2>&1 | grep "automationRunner"
```

Beklenen: Çıktı yok.

- [ ] **Step 3: Commit**

```bash
git add lib/email/automationRunner.ts
git commit -m "feat(email/drip): runner drip adımları varsa kuyruğa ekler"
git push
```

---

### Task 5: Drip Queue Processor — Cron Endpoint

**Files:**
- Create: `app/api/cron/email-drip-process/route.ts`

Bu endpoint mevcut `crm-lead-pull` pattern'ini (Bearer CRON_SECRET) kullanır.

- [ ] **Step 1: Endpoint yaz**

```ts
// app/api/cron/email-drip-process/route.ts
import { NextResponse } from 'next/server'
import { getDueItems, markItemSent, markItemFailed } from '@/lib/email/dripQueue'
import { supabase } from '@/lib/supabase/client'
import { buildDispatch, buildHtml } from '@/lib/email/sender'
import { listSteps } from '@/lib/email/automationStepsStore'
import { unsubscribeUrl } from '@/lib/email/unsubscribe'
import { isOptedOut } from '@/lib/email/automationRunner'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://yoai.yodijital.com'

export async function GET(request: Request) {
  const auth = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  const items = await getDueItems(50)
  let sent = 0
  let failed = 0

  for (const item of items) {
    try {
      // Opt-out kontrolü
      if (await isOptedOut(item.user_id, item.email)) {
        await markItemFailed(item.id)
        failed++
        continue
      }

      // Step içeriğini al
      if (!supabase) { await markItemFailed(item.id); failed++; continue }
      const { data: step } = await supabase
        .from('email_automation_steps')
        .select('subject, html')
        .eq('id', item.step_id)
        .maybeSingle()

      if (!step) { await markItemFailed(item.id); failed++; continue }

      // Gönderim hesabı
      const built = await buildDispatch(item.user_id)
      if (!built) { await markItemFailed(item.id); failed++; continue }

      const html = buildHtml(
        step.html,
        unsubscribeUrl(APP_URL, 'automation', item.email),
      )

      const resendId = await built.dispatch(item.email, step.subject || '(konusuz)', html)

      // email_sends'e kaydet
      await supabase.from('email_sends').insert({
        automation_id: item.automation_id,
        user_id: item.user_id,
        contact_id: item.contact_id,
        email: item.email,
        resend_id: resendId,
        status: resendId ? 'sent' : 'failed',
        sent_at: new Date().toISOString(),
      })

      await markItemSent(item.id)
      sent++
    } catch (err) {
      console.error('[DripProcess] ITEM_FAIL', item.id, err)
      await markItemFailed(item.id)
      failed++
    }
  }

  return NextResponse.json({ ok: true, sent, failed, total: items.length })
}
```

> **Not:** `isOptedOut` şu an `automationRunner.ts`'de private fonksiyon. Task 5'i uygulamadan önce onu `export` olarak işaretle:
> ```ts
> // lib/email/automationRunner.ts
> export async function isOptedOut(userId: string, email: string): Promise<boolean> { ... }
> ```

- [ ] **Step 2: `isOptedOut` fonksiyonunu export et (`automationRunner.ts`)**

```ts
// lib/email/automationRunner.ts — sadece `async function isOptedOut` → `export async function isOptedOut` yap
```

- [ ] **Step 3: `vercel.json`'a cron ekle**

```json
// vercel.json'daki "crons" dizisine ekle:
{
  "path": "/api/cron/email-drip-process",
  "schedule": "0 * * * *"
}
```

- [ ] **Step 4: TypeScript kontrolü**

```bash
npx tsc --noEmit 2>&1 | grep -E "drip-process|dripQueue|automationRunner"
```

Beklenen: Çıktı yok.

- [ ] **Step 5: Commit**

```bash
git add app/api/cron/email-drip-process/route.ts lib/email/automationRunner.ts vercel.json
git commit -m "feat(email/drip): saatlik cron processor → kuyruktaki adımları gönderir"
git push
```

---

### Task 6: Automation API — Steps Desteği

**Files:**
- Modify: `app/api/email/automations/route.ts`
- Modify: `app/api/email/automations/[id]/route.ts`

GET listesi steps'i de dönsün; POST/PATCH steps'i kabul etsin.

- [ ] **Step 1: `app/api/email/automations/route.ts` güncelle**

GET yanıtını, her otomasyona `steps: StepRow[]` ekleyecek şekilde genişlet:

```ts
// app/api/email/automations/route.ts — GET handler içinde:
import { listSteps } from '@/lib/email/automationStepsStore'

// listAutomations() sonrası:
const automations = await listAutomations(access.user.id)
const withSteps = await Promise.all(
  automations.map(async (a) => ({
    id: a.id, name: a.name, trigger: a.trigger,
    subject: a.subject, html: a.html, enabled: a.enabled, createdAt: a.created_at,
    steps: await listSteps(a.id),
  }))
)
return NextResponse.json({ ok: true, automations: withSteps })
```

POST handler'da `steps` array'i kabul et:

```ts
// POST handler içinde — upsertAutomation sonrası:
import { replaceSteps } from '@/lib/email/automationStepsStore'
import type { StepInput } from '@/lib/email/automationStepsStore'

const steps = Array.isArray(body.steps) ? (body.steps as StepInput[]) : []
if (steps.length > 0 && row) {
  await replaceSteps(row.id, steps)
}
```

- [ ] **Step 2: `app/api/email/automations/[id]/route.ts` güncelle**

PATCH handler içinde steps kabul et (aynı pattern):

```ts
import { replaceSteps } from '@/lib/email/automationStepsStore'
import type { StepInput } from '@/lib/email/automationStepsStore'

// upsertAutomation sonrası:
if (body.steps !== undefined && row) {
  const steps = Array.isArray(body.steps) ? (body.steps as StepInput[]) : []
  await replaceSteps(id, steps)
}
```

- [ ] **Step 3: TypeScript kontrolü**

```bash
npx tsc --noEmit 2>&1 | grep "automations"
```

- [ ] **Step 4: Commit**

```bash
git add "app/api/email/automations/route.ts" "app/api/email/automations/[id]/route.ts"
git commit -m "feat(email/drip): automation API steps desteği (GET list + POST/PATCH)"
git push
```

---

### Task 7: AutomationsTab.tsx — Multi-Step UI

**Files:**
- Modify: `components/email/AutomationsTab.tsx`
- Modify: `locales/tr.json`, `locales/en.json`

Mevcut tek subject/html alanı → sekme tabanlı adım editörü.

**Tasarım:**
- Composer'da `steps: StepInput[]` state (min 1 adım, step_order=0, delay_days=0)
- Adım seçici: "Adım 1 | Adım 2 | + Adım Ekle" tab'ları
- Aktif adım için: delay_days (gün) + subject + html textarea + preview iframe
- Adım 1'de delay_days girişi yoktur (her zaman 0, anında gönderilir)
- Max 5 adım (makul limit)

- [ ] **Step 1: i18n anahtarları ekle**

`locales/tr.json` içinde `"campaigns"` bloğunun ardından `"automations"` namespace'i içine ekle:

```json
"steps": {
  "label": "Adımlar",
  "add": "+ Adım Ekle",
  "tab": "Adım {n}",
  "remove": "Bu adımı sil",
  "delayFirst": "Tetiklenince hemen gönderilir",
  "delayLabel": "Önceki adımdan kaç gün sonra?",
  "delayDays": "{n} gün sonra",
  "maxReached": "En fazla 5 adım ekleyebilirsiniz."
}
```

`locales/en.json` eşdeğeri:

```json
"steps": {
  "label": "Steps",
  "add": "+ Add Step",
  "tab": "Step {n}",
  "remove": "Delete this step",
  "delayFirst": "Sent immediately when triggered",
  "delayLabel": "Days after previous step?",
  "delayDays": "{n} days later",
  "maxReached": "You can add up to 5 steps."
}
```

- [ ] **Step 2: `AutomationsTab.tsx` state güncellemesi**

Mevcut `subject/html` state'i koru (tek adım legacy için); yeni `steps` state ekle:

```ts
interface StepDraft {
  step_order: number
  subject: string
  html: string
  delay_days: number
}

// State:
const [steps, setSteps] = useState<StepDraft[]>([{ step_order: 0, subject: '', html: '', delay_days: 0 }])
const [activeStep, setActiveStep] = useState(0)
```

`openEdit` / `openNew` içinde steps'i doldur:

```ts
// Yeni otomasyon:
setSteps([{ step_order: 0, subject: '', html: '', delay_days: 0 }])
setActiveStep(0)

// Mevcut otomasyon (edit):
const existing = item.steps?.length > 0
  ? item.steps.map((s) => ({ step_order: s.step_order, subject: s.subject, html: s.html, delay_days: s.delay_days }))
  : [{ step_order: 0, subject: item.subject || '', html: item.html || '', delay_days: 0 }]
setSteps(existing)
setActiveStep(0)
```

- [ ] **Step 3: Composer'da adım UI'ını yaz**

Mevcut subject+html alanlarının yerine (Composer bölümü):

```tsx
{/* Adım sekmeleri */}
<div>
  <div className="flex items-center gap-1 mb-4 flex-wrap">
    {steps.map((s, i) => (
      <button
        key={i}
        onClick={() => setActiveStep(i)}
        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
          activeStep === i ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
      >
        {t('automations.steps.tab', { n: i + 1 })}
      </button>
    ))}
    {steps.length < 5 && (
      <button
        onClick={() => {
          setSteps((prev) => [
            ...prev,
            { step_order: prev.length, subject: '', html: '', delay_days: 1 },
          ])
          setActiveStep(steps.length)
        }}
        className="px-3 py-1.5 rounded-lg text-sm text-primary border border-primary/30 hover:bg-primary/5 transition"
      >
        {t('automations.steps.add')}
      </button>
    )}
  </div>

  {/* Aktif adım formu */}
  {steps[activeStep] && (
    <div className="space-y-4">
      {activeStep === 0 ? (
        <p className="text-xs text-gray-500">{t('automations.steps.delayFirst')}</p>
      ) : (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            {t('automations.steps.delayLabel')}
          </label>
          <input
            type="number"
            min={1}
            max={30}
            value={steps[activeStep].delay_days}
            onChange={(e) => {
              const v = Math.max(1, parseInt(e.target.value) || 1)
              setSteps((prev) => prev.map((s, i) => i === activeStep ? { ...s, delay_days: v } : s))
            }}
            className="w-24 rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
          />
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('automations.subject')}</label>
        <input
          value={steps[activeStep].subject}
          onChange={(e) => setSteps((prev) => prev.map((s, i) => i === activeStep ? { ...s, subject: e.target.value } : s))}
          className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('automations.content')}</label>
        <textarea
          value={steps[activeStep].html}
          onChange={(e) => setSteps((prev) => prev.map((s, i) => i === activeStep ? { ...s, html: e.target.value } : s))}
          rows={10}
          className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-mono focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
        />
      </div>

      {steps.length > 1 && (
        <button
          onClick={() => {
            setSteps((prev) => prev.filter((_, i) => i !== activeStep).map((s, i) => ({ ...s, step_order: i })))
            setActiveStep(Math.max(0, activeStep - 1))
          }}
          className="text-xs text-red-500 hover:text-red-700 transition"
        >
          {t('automations.steps.remove')}
        </button>
      )}
    </div>
  )}
</div>

{/* Preview — aktif adım için */}
<div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
  <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
    <p className="text-sm font-semibold text-gray-900">{steps[activeStep]?.subject || t('automations.noSubject')}</p>
  </div>
  <iframe
    title="step-preview"
    sandbox=""
    className="w-full min-h-[260px] border-0 block bg-white"
    srcDoc={`<!doctype html><html><body style="margin:0;padding:16px;font-family:Arial,sans-serif;font-size:14px;color:#1f2937;line-height:1.6">${steps[activeStep]?.html || ''}</body></html>`}
  />
</div>
```

- [ ] **Step 4: `handleSave` içinde steps'i gönder**

```ts
// handleSave içinde payload'a steps ekle:
const payload = {
  name: name || t('automations.untitled'),
  trigger: decodeTrig(trig),
  subject: steps[0]?.subject ?? '',  // legacy uyumluluk
  html: steps[0]?.html ?? '',        // legacy uyumluluk
  enabled: true,
  steps: steps.map((s, i) => ({ step_order: i, subject: s.subject, html: s.html, delay_days: s.delay_days })),
}
```

- [ ] **Step 5: TypeScript kontrolü + lint**

```bash
npx tsc --noEmit && npx next lint --dir components/email/AutomationsTab.tsx 2>&1 | tail -5
```

- [ ] **Step 6: Commit**

```bash
git add components/email/AutomationsTab.tsx locales/tr.json locales/en.json
git commit -m "feat(email/drip): multi-step otomasyon composer UI (tab'lı adım editörü)"
git push
```

---

### Task 8: CHANGELOG + Son Doğrulama

- [ ] **Step 1: CHANGELOG güncelle**

`docs/CHANGELOG.md` başına ekle:

```markdown
## 2026-06-02 — Email: Bounce Auto-Block + Drip Sequence
- **Sorun:** Hard bounce / spam şikayeti gelince kişi opt-out edilmiyordu; otomasyonlar tek mail ile sınırlıydı.
- **Çözüm:** (A) Resend webhook → hard bounce / complaint → email_contacts.opt_out + crm_leads.email_opt_out otomatik. (B) email_automation_steps + email_drip_queue tabloları; automationRunner adımlı otomasyonları kuyruğa yazar; saatlik cron vakti gelenleri gönderir. (C) AutomationsTab'da çok adımlı sekme editörü (max 5 adım, gecikme gün cinsinden).
- **Dosyalar:** app/api/email/webhooks/resend, lib/email/automationStepsStore, lib/email/dripQueue, lib/email/automationRunner, app/api/cron/email-drip-process, app/api/email/automations, components/email/AutomationsTab, vercel.json, locales
```

- [ ] **Step 2: Son TypeScript kontrolü**

```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
```

Beklenen: `0`

- [ ] **Step 3: Final commit**

```bash
git add docs/CHANGELOG.md
git commit -m "docs: bounce auto-block + drip sequence CHANGELOG"
git push
```

---

## Verification

1. **Bounce webhook test:** Resend dashboard → Webhooks → "Send test event" (email.bounced, type:hard) → Supabase'de `email_events` + `email_contacts.opt_out = true` kontrol et.
2. **Drip kuyruğu test:** Bir otomasyon oluştur, 2 adımlı yap (adım 2: delay_days=1). CRM lead'ini tetikleyici aşamaya taşı → `email_drip_queue` tablosunda 2 satır görünmeli.
3. **Cron test:** `GET /api/cron/email-drip-process` endpoint'ini `Authorization: Bearer <CRON_SECRET>` ile çağır → kuyruktaki gönderimler gitmeli, status `sent` olmalı.
4. **UI test:** Otomasyon composer'da `+ Adım Ekle` ile 3 adım ekle, kaydet → API'dan `steps` array'i geri geldiğini kontrol et.
