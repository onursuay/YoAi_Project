# Email Funnel — Koşullu Adım Sistemi Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Drip otomasyonuna "önceki mail açıldıysa / açılmadıysa / tıklandıysa" koşullu dallanma ekle; her adım ayrı sekme olarak gösterilsin, sekme etiketi koşulu göstersin.

**Architecture:**
Mevcut "tüm adımlar tetikleyicide kuyruğa eklenir" modeli **"ilk adım kuyruğa eklenir, cron her adımı gönderdikten sonra bir sonrakini koşul sonucuna göre kuyruğa ekler"** modeline geçer. `email_automation_steps.condition` JSONB kolonu koşul tipini tutar; `email_drip_queue.parent_queue_id` ve `email_drip_queue.email_send_id` önceki adımın send kaydına ulaşmayı sağlar. Cron gönderimden sonra `email_events` tablosunu sorgulayarak koşulu değerlendirir ve sadece koşul sağlanırsa bir sonraki adımı kuyruğa ekler.

**Tech Stack:** Next.js App Router, Supabase Postgres (service-role), next-intl (tr+en), WizardSelect, mevcut `email_events` tracking altyapısı.

**Genel kurallar:**
- Hardcoded string YOK — tüm UI metni tr.json + en.json (aynı key).
- Native `<select>` YOK — WizardSelect. Amber/sarı renk YOK.
- Meta/Google entegrasyon koduna dokunma.
- Her task sonunda `npx tsc --noEmit` 0 hata; sonra commit.

---

## Veri Modeli Değişiklikleri

### Mevcut → Yeni Akış

```
ESKI: Trigger → tüm adımlar anında queue'ya (kümülatif delay ile)
YENİ: Trigger → yalnız Adım 0 queue'ya
      Cron: Adım 0 gönderilir → email_send_id kaydedilir → Adım 1 koşul kontrol edilir
            ├─ koşul sağlanırsa → Adım 1 queue'ya eklenir (delay sonra)
            └─ sağlanmazsa → skipped
```

### Yeni kolonlar

**`email_automation_steps.condition`** — jsonb, varsayılan `{"type":"always"}`
```json
{ "type": "always" }          // koşulsuz (geri uyumluluk)
{ "type": "if_opened" }       // önceki adım açıldıysa
{ "type": "if_not_opened" }   // önceki adım açılmadıysa
{ "type": "if_clicked" }      // önceki adımdaki linke tıklandıysa
```

**`email_drip_queue.parent_queue_id`** — önceki queue öğesine FK (koşul değerlendirmek için)
**`email_drip_queue.email_send_id`** — bu adım gönderildikten sonra set edilen email_sends.id
**`email_drip_queue.status`** — `'skipped'` değeri ekleniyor (koşul sağlanmadı)

---

## Task 1: DB Migration

**Files:**
- Create: `supabase/migrations/20260602002000_email_funnel_conditions.sql`

- [ ] **Step 1: Migration dosyasını oluştur**

```sql
-- supabase/migrations/20260602002000_email_funnel_conditions.sql
-- email_automation_steps: koşul kolonu
ALTER TABLE public.email_automation_steps
  ADD COLUMN IF NOT EXISTS condition jsonb NOT NULL DEFAULT '{"type":"always"}';

-- email_drip_queue: parent bağlantısı + send kaydı
ALTER TABLE public.email_drip_queue
  ADD COLUMN IF NOT EXISTS parent_queue_id uuid REFERENCES public.email_drip_queue(id) ON DELETE SET NULL;

ALTER TABLE public.email_drip_queue
  ADD COLUMN IF NOT EXISTS email_send_id uuid REFERENCES public.email_sends(id) ON DELETE SET NULL;

-- 'skipped' status desteği
ALTER TABLE public.email_drip_queue
  DROP CONSTRAINT IF EXISTS email_drip_queue_status_check;

ALTER TABLE public.email_drip_queue
  ADD CONSTRAINT email_drip_queue_status_check
  CHECK (status IN ('pending','sent','failed','skipped'));
```

- [ ] **Step 2: Supabase omddq'ya uygula**

Supabase dashboard → SQL Editor → içeriği yapıştır → RUN.
Beklenen: "Success. No rows returned."

- [ ] **Step 3: Commit**

```bash
cd "/Users/onursuay/Desktop/Onur Suay/YO Dijital/YOAİ/YoAi_Project"
git add supabase/migrations/20260602002000_email_funnel_conditions.sql
git commit -m "feat(email/funnel): condition kolonu + parent_queue_id + email_send_id migration"
git push
```

---

## Task 2: automationStepsStore — Condition Desteği

**Files:**
- Modify: `lib/email/automationStepsStore.ts`

- [ ] **Step 1: StepRow ve StepInput'a condition ekle**

```ts
// lib/email/automationStepsStore.ts — TAMAMEN YENİ İÇERİK:
import 'server-only'
import { supabase } from '@/lib/supabase/client'

export type StepConditionType = 'always' | 'if_opened' | 'if_not_opened' | 'if_clicked'

export interface StepCondition {
  type: StepConditionType
}

export interface StepRow {
  id: string
  automation_id: string
  step_order: number
  subject: string
  html: string
  delay_days: number
  condition: StepCondition
  created_at: string
}

export interface StepInput {
  step_order: number
  subject: string
  html: string
  delay_days: number
  condition: StepCondition
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

export async function getStep(stepId: string): Promise<StepRow | null> {
  if (!supabase) return null
  const { data } = await supabase
    .from('email_automation_steps')
    .select('*')
    .eq('id', stepId)
    .maybeSingle()
  return data as StepRow | null
}

export async function getNextStep(automationId: string, currentOrder: number): Promise<StepRow | null> {
  if (!supabase) return null
  const { data } = await supabase
    .from('email_automation_steps')
    .select('*')
    .eq('automation_id', automationId)
    .eq('step_order', currentOrder + 1)
    .maybeSingle()
  return data as StepRow | null
}

export async function replaceSteps(automationId: string, steps: StepInput[]): Promise<void> {
  if (!supabase) return
  await supabase.from('email_automation_steps').delete().eq('automation_id', automationId)
  if (steps.length === 0) return
  const rows = steps.map((s) => ({ ...s, automation_id: automationId }))
  await supabase.from('email_automation_steps').insert(rows)
}
```

- [ ] **Step 2: TypeScript kontrolü**

```bash
cd "/Users/onursuay/Desktop/Onur Suay/YO Dijital/YOAİ/YoAi_Project"
npx tsc --noEmit 2>&1 | grep "error TS" | head -10
```

Beklenen: Çıktı yok (0 hata).

- [ ] **Step 3: Commit**

```bash
git add lib/email/automationStepsStore.ts
git commit -m "feat(email/funnel): StepRow/StepInput condition alanı + getNextStep + getStep"
git push
```

---

## Task 3: dripQueue — Lazy Enqueue + Condition Evaluation

**Files:**
- Modify: `lib/email/dripQueue.ts`

Bu dosya tamamen yeniden yazılır. Eski `enqueueSteps` (tüm adımları birden ekle) → `enqueueFirstStep` (sadece ilk adımı ekle) + `enqueueNextStep` (bir sonraki adımı ekle).

- [ ] **Step 1: dripQueue.ts'i yeniden yaz**

```ts
// lib/email/dripQueue.ts — TAMAMEN YENİ İÇERİK:
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
  parent_queue_id: string | null
  email_send_id: string | null
}

/** Tetikleyicide yalnız ilk adımı (step_order=0) kuyruğa ekler. */
export async function enqueueFirstStep(
  userId: string,
  automationId: string,
  firstStep: StepRow,
  contact: { email: string; contactId?: string | null },
): Promise<void> {
  if (!supabase) return
  await supabase.from('email_drip_queue').insert({
    automation_id: automationId,
    step_id: firstStep.id,
    user_id: userId,
    contact_id: contact.contactId ?? null,
    email: contact.email,
    scheduled_at: new Date().toISOString(),
    status: 'pending',
    parent_queue_id: null,
    email_send_id: null,
  })
}

/** Mevcut adım gönderildikten sonra bir sonraki adımı kuyruğa ekler. */
export async function enqueueNextStep(
  parentQueueId: string,
  nextStep: StepRow,
  current: { userId: string; automationId: string; email: string; contactId: string | null },
): Promise<void> {
  if (!supabase) return
  const scheduledAt = new Date(Date.now() + nextStep.delay_days * 86_400_000).toISOString()
  await supabase.from('email_drip_queue').insert({
    automation_id: current.automationId,
    step_id: nextStep.id,
    user_id: current.userId,
    contact_id: current.contactId,
    email: current.email,
    scheduled_at: scheduledAt,
    status: 'pending',
    parent_queue_id: parentQueueId,
    email_send_id: null,
  })
}

/** Gönderim sonrası queue öğesine email_send_id yazar. */
export async function setEmailSendId(queueItemId: string, emailSendId: string): Promise<void> {
  if (!supabase) return
  await supabase
    .from('email_drip_queue')
    .update({ email_send_id: emailSendId })
    .eq('id', queueItemId)
}

/**
 * Adımın koşulunu değerlendirir.
 * condition.type === 'always' → her zaman true
 * condition.type === 'if_opened' / 'if_not_opened' / 'if_clicked'
 *   → parent_queue_id üzerinden önceki send kaydının eventlerini kontrol eder
 */
export async function evaluateCondition(item: QueueItem, condition: { type: string }): Promise<boolean> {
  if (condition.type === 'always') return true
  if (!supabase || !item.parent_queue_id) return false

  // Önceki queue öğesinin email_send_id'sini al
  const { data: parent } = await supabase
    .from('email_drip_queue')
    .select('email_send_id')
    .eq('id', item.parent_queue_id)
    .maybeSingle()

  if (!parent?.email_send_id) return false

  const { data: events } = await supabase
    .from('email_events')
    .select('type')
    .eq('send_id', parent.email_send_id)

  const eventTypes = new Set((events ?? []).map((e: { type: string }) => e.type))

  if (condition.type === 'if_opened') return eventTypes.has('opened')
  if (condition.type === 'if_not_opened') return !eventTypes.has('opened')
  if (condition.type === 'if_clicked') return eventTypes.has('clicked')

  return false
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

export async function markItemSkipped(itemId: string): Promise<void> {
  if (!supabase) return
  await supabase.from('email_drip_queue').update({ status: 'skipped' }).eq('id', itemId)
}
```

- [ ] **Step 2: TypeScript kontrolü**

```bash
npx tsc --noEmit 2>&1 | grep "error TS" | head -10
```

- [ ] **Step 3: Commit**

```bash
git add lib/email/dripQueue.ts
git commit -m "feat(email/funnel): dripQueue lazy enqueue + condition evaluation + skipped status"
git push
```

---

## Task 4: automationRunner — enqueueFirstStep Kullan

**Files:**
- Modify: `lib/email/automationRunner.ts`

- [ ] **Step 1: automationRunner.ts'i güncelle**

Mevcut dosyayı oku. `enqueueSteps` importunu `enqueueFirstStep` ile değiştir.
`runStageAutomations` ve `runContactAddedAutomations` içindeki çağrıları güncelle:

```ts
// lib/email/automationRunner.ts — DEĞİŞECEK SATIRLAR:

// ESKI import:
// import { enqueueSteps } from './dripQueue'

// YENİ import:
import { enqueueFirstStep } from './dripQueue'

// runStageAutomations içinde — ESKI:
// await enqueueSteps(userId, automation.id, steps, { email: lead.email, contactId: null })

// YENİ (sadece ilk adımı kuyruğa ekle):
if (steps.length > 0) {
  await enqueueFirstStep(userId, automation.id, steps[0], { email: lead.email, contactId: null })
} else {
  await sendToContact(userId, lead.email, [automation])
}

// runContactAddedAutomations içinde de aynı değişiklik:
if (steps.length > 0) {
  await enqueueFirstStep(userId, automation.id, steps[0], { email: contact.email, contactId: null })
} else {
  await sendToContact(userId, contact.email, [automation])
}
```

Tam güncellenmiş `runStageAutomations`:
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
      await enqueueFirstStep(userId, automation.id, steps[0], { email: lead.email, contactId: null })
    } else {
      await sendToContact(userId, lead.email, [automation])
    }
  }
}
```

Tam güncellenmiş `runContactAddedAutomations`:
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
      await enqueueFirstStep(userId, automation.id, steps[0], { email: contact.email, contactId: null })
    } else {
      await sendToContact(userId, contact.email, [automation])
    }
  }
}
```

- [ ] **Step 2: TypeScript kontrolü**

```bash
npx tsc --noEmit 2>&1 | grep "error TS" | head -10
```

- [ ] **Step 3: Commit**

```bash
git add lib/email/automationRunner.ts
git commit -m "feat(email/funnel): runner yalnız ilk adımı enqueueFirstStep ile kuyruğa ekler"
git push
```

---

## Task 5: Cron Processor — Koşul Değerlendirme + Sonraki Adım Kuyruğa Ekleme

**Files:**
- Modify: `app/api/cron/email-drip-process/route.ts`

- [ ] **Step 1: Cron processor'ı tamamen yeniden yaz**

```ts
// app/api/cron/email-drip-process/route.ts — TAMAMEN YENİ İÇERİK:
import { NextResponse } from 'next/server'
import {
  getDueItems, markItemSent, markItemFailed, markItemSkipped,
  setEmailSendId, enqueueNextStep, evaluateCondition,
} from '@/lib/email/dripQueue'
import { getStep, getNextStep } from '@/lib/email/automationStepsStore'
import { supabase } from '@/lib/supabase/client'
import { buildDispatch, buildHtml } from '@/lib/email/sender'
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
  let skipped = 0

  for (const item of items) {
    try {
      // 1. Koşul değerlendirme — adımın condition'ını al
      const currentStep = await getStep(item.step_id)
      if (!currentStep) { await markItemFailed(item.id); failed++; continue }

      const conditionMet = await evaluateCondition(item, currentStep.condition ?? { type: 'always' })
      if (!conditionMet) {
        await markItemSkipped(item.id)
        skipped++
        continue
      }

      // 2. Opt-out kontrolü
      if (await isOptedOut(item.user_id, item.email)) {
        await markItemFailed(item.id); failed++; continue
      }

      // 3. Gönderim
      if (!supabase) { await markItemFailed(item.id); failed++; continue }

      const built = await buildDispatch(item.user_id)
      if (!built) { await markItemFailed(item.id); failed++; continue }

      const html = buildHtml(
        currentStep.html,
        unsubscribeUrl(APP_URL, 'automation', item.email),
      )
      const resendId = await built.dispatch(item.email, currentStep.subject || '(konusuz)', html)

      // 4. email_sends'e kaydet → send kaydının ID'sini al
      let emailSendId: string | null = null
      if (supabase) {
        const { data: sendRow } = await supabase
          .from('email_sends')
          .insert({
            automation_id: item.automation_id,
            user_id: item.user_id,
            contact_id: item.contact_id,
            email: item.email,
            resend_id: resendId,
            status: resendId ? 'sent' : 'failed',
            sent_at: new Date().toISOString(),
          })
          .select('id')
          .single()
        emailSendId = sendRow?.id ?? null
      }

      // 5. Queue öğesini sent olarak işaretle + email_send_id yaz
      await markItemSent(item.id)
      if (emailSendId) await setEmailSendId(item.id, emailSendId)
      sent++

      // 6. Bir sonraki adımı koşulsuz kuyruğa ekle
      //    (Koşul zamanı geldiğinde evaluateCondition ile değerlendirilecek)
      const nextStep = await getNextStep(item.automation_id, currentStep.step_order)
      if (nextStep) {
        await enqueueNextStep(item.id, nextStep, {
          userId: item.user_id,
          automationId: item.automation_id,
          email: item.email,
          contactId: item.contact_id,
        })
      }
    } catch (err) {
      console.error('[DripProcess] ITEM_FAIL', item.id, err)
      await markItemFailed(item.id)
      failed++
    }
  }

  return NextResponse.json({ ok: true, sent, failed, skipped, total: items.length })
}
```

- [ ] **Step 2: TypeScript kontrolü**

```bash
npx tsc --noEmit 2>&1 | grep "error TS" | head -10
```

Beklenen: 0 hata.

- [ ] **Step 3: Commit**

```bash
git add app/api/cron/email-drip-process/route.ts
git commit -m "feat(email/funnel): cron koşul değerlendirme + sonraki adımı lazy enqueue"
git push
```

---

## Task 6: i18n — Koşul Etiketleri

**Files:**
- Modify: `locales/tr.json`
- Modify: `locales/en.json`

- [ ] **Step 1: tr.json — automations.steps içine condition ekle**

`locales/tr.json` içinde `"email.automations.steps"` bloğuna şunu ekle:

```json
"condition": {
  "label": "Bu adım ne zaman gönderilsin?",
  "always": "Her zaman gönder",
  "if_opened": "Önceki mail açıldıysa",
  "if_not_opened": "Önceki mail açılmadıysa",
  "if_clicked": "Önceki maildeki linke tıklandıysa"
}
```

- [ ] **Step 2: en.json — aynı key path'e ekle**

```json
"condition": {
  "label": "When should this step be sent?",
  "always": "Always send",
  "if_opened": "If previous email was opened",
  "if_not_opened": "If previous email was not opened",
  "if_clicked": "If a link in the previous email was clicked"
}
```

- [ ] **Step 3: Commit**

```bash
git add locales/tr.json locales/en.json
git commit -m "feat(email/funnel): koşul i18n anahtarları (tr+en)"
git push
```

---

## Task 7: AutomationsTab UI — Koşul Dropdown + Sekme Etiketi

**Files:**
- Modify: `components/email/AutomationsTab.tsx`

Bu task mevcut tab editörüne iki ekleme yapar:
1. Her adım sekmesinin etiketine koşul badge'i (step_order > 0 için)
2. Aktif adım formuna koşul dropdown'u (step_order > 0 için, WizardSelect ile)

**Tasarım:**
- Sekme: `"Adım 2 • Açıldıysa"` (yeşil nokta ile)
- Dropdown: WizardSelect, 4 seçenek (always/if_opened/if_not_opened/if_clicked)
- Adım 1 (index 0) için dropdown gösterilmez (her zaman gönderilir)

- [ ] **Step 1: StepDraft interface'ine condition ekle**

Dosyayı oku. Mevcut `StepDraft` interface'ini güncelle:

```ts
interface StepDraft {
  step_order: number
  subject: string
  html: string
  delay_days: number
  condition: { type: 'always' | 'if_opened' | 'if_not_opened' | 'if_clicked' }
}
```

`openNew` içinde steps başlangıcını güncelle:
```ts
setSteps([{ step_order: 0, subject: '', html: '', delay_days: 0, condition: { type: 'always' } }])
```

"+ Adım Ekle" butonunda default condition ekle:
```ts
{ step_order: prev.length, subject: '', html: '', delay_days: 1, condition: { type: 'always' } }
```

`openEdit` içinde mevcut otomasyonu yüklerken condition'ı da al:
```ts
const existingSteps = (a.steps && a.steps.length > 0)
  ? a.steps.map((s: { step_order: number; subject: string; html: string; delay_days: number; condition?: { type: string } }) => ({
      step_order: s.step_order,
      subject: s.subject,
      html: s.html,
      delay_days: s.delay_days ?? 0,
      condition: (s.condition as { type: 'always'|'if_opened'|'if_not_opened'|'if_clicked' }) ?? { type: 'always' },
    }))
  : [{ step_order: 0, subject: a.subject || '', html: a.html || '', delay_days: 0, condition: { type: 'always' as const } }]
```

`handleSave` payload'unda condition'ı da gönder:
```ts
steps: steps.map((s, i) => ({
  step_order: i,
  subject: s.subject,
  html: s.html,
  delay_days: s.delay_days,
  condition: s.condition,
})),
```

- [ ] **Step 2: Sekme etiketine koşul badge'i ekle**

Mevcut tab butonunu bul (steps.map içindeki, `{t('automations.steps.tab', { n: i + 1 })}` içeren).
Şöyle güncelle:

```tsx
{steps.map((s, i) => {
  const condLabel =
    i === 0 ? null
    : s.condition.type === 'if_opened' ? '✓'
    : s.condition.type === 'if_not_opened' ? '✗'
    : s.condition.type === 'if_clicked' ? '↗'
    : null

  return (
    <button
      key={i}
      onClick={() => setActiveStep(i)}
      className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
        activeStep === i ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      }`}
    >
      {t('automations.steps.tab', { n: i + 1 })}
      {condLabel && (
        <span className={`text-[10px] font-bold ${activeStep === i ? 'text-white/80' : 'text-gray-400'}`}>
          {condLabel}
        </span>
      )}
    </button>
  )
})}
```

- [ ] **Step 3: Aktif adım formuna koşul dropdown'u ekle**

Adım formunda delay input'unun hemen üstüne (step_order > 0 koşuluyla) WizardSelect ekle:

```tsx
{activeStep > 0 && (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1.5">
      {t('automations.steps.condition.label')}
    </label>
    <WizardSelect
      value={steps[activeStep].condition.type}
      onChange={(v) =>
        setSteps((prev) =>
          prev.map((s, i) =>
            i === activeStep
              ? { ...s, condition: { type: v as 'always' | 'if_opened' | 'if_not_opened' | 'if_clicked' } }
              : s
          )
        )
      }
      options={[
        { value: 'always', label: t('automations.steps.condition.always') },
        { value: 'if_opened', label: t('automations.steps.condition.if_opened') },
        { value: 'if_not_opened', label: t('automations.steps.condition.if_not_opened') },
        { value: 'if_clicked', label: t('automations.steps.condition.if_clicked') },
      ]}
    />
  </div>
)}
```

Bu JSX'i step form bölümünde, delay input bloğundan ÖNCE koy.

- [ ] **Step 4: TypeScript kontrolü**

```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
```

Beklenen: `0`

- [ ] **Step 5: Commit**

```bash
git add components/email/AutomationsTab.tsx
git commit -m "feat(email/funnel): otomasyon adımlarına koşul dropdown + sekme badge"
git push
```

---

## Task 8: CHANGELOG + Son Doğrulama

**Files:**
- Modify: `docs/CHANGELOG.md`

- [ ] **Step 1: CHANGELOG güncelle**

`docs/CHANGELOG.md` başına ekle:

```markdown
## 2026-06-02 — Email Funnel: Koşullu Adım Dallanması
- **Sorun:** Drip otomasyonu tüm adımları koşulsuz gönderiyordu; açılma/tıklama davranışına göre dallanma yoktu.
- **Çözüm:** `email_automation_steps.condition` JSONB kolonu (always/if_opened/if_not_opened/if_clicked); `email_drip_queue.parent_queue_id` + `email_send_id` ile önceki adımın event'leri sorgulanıyor; cron processor koşulu değerlendirip ya gönderir ya 'skipped' işaretler; UI'da her adım sekmesine koşul badge + WizardSelect dropdown eklendi.
- **Dosyalar:** `supabase/migrations/20260602002000_*`, `lib/email/automationStepsStore.ts`, `lib/email/dripQueue.ts`, `lib/email/automationRunner.ts`, `app/api/cron/email-drip-process/route.ts`, `components/email/AutomationsTab.tsx`, `locales/tr.json`, `locales/en.json`
```

- [ ] **Step 2: Final TypeScript kontrolü**

```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
```

Beklenen: `0`

- [ ] **Step 3: Final commit**

```bash
git add docs/CHANGELOG.md
git commit -m "docs: email funnel koşullu adım sistemi CHANGELOG"
git push
```

---

## Verification

1. **Migration test:** Supabase Table Editor → `email_automation_steps` tablosunda `condition` kolonu görünüyor mu?
2. **UI test:** Email Marketing → Otomasyon → Yeni Oluştur → 2. adımda "Bu adım ne zaman gönderilsin?" dropdown görünüyor mu?
3. **Koşul badge test:** Adım 2'de "Önceki mail açıldıysa" seçilince sekme etiketi `"Adım 2 ✓"` oluyor mu?
4. **API test:** Otomasyon kaydedince `GET /api/email/automations` yanıtında `steps[1].condition.type === "if_opened"` dönüyor mu?
5. **Cron test:** `email_drip_queue`'de `parent_queue_id` dolu bir öğe varken cron'u çağır → `email_events`'te açılma yoksa `status = 'skipped'` olmalı.

---

## Supabase Migration SQL

Aşağıdaki SQL'i omddq dashboard → SQL Editor'da çalıştır:

```sql
ALTER TABLE public.email_automation_steps
  ADD COLUMN IF NOT EXISTS condition jsonb NOT NULL DEFAULT '{"type":"always"}';

ALTER TABLE public.email_drip_queue
  ADD COLUMN IF NOT EXISTS parent_queue_id uuid REFERENCES public.email_drip_queue(id) ON DELETE SET NULL;

ALTER TABLE public.email_drip_queue
  ADD COLUMN IF NOT EXISTS email_send_id uuid REFERENCES public.email_sends(id) ON DELETE SET NULL;

ALTER TABLE public.email_drip_queue
  DROP CONSTRAINT IF EXISTS email_drip_queue_status_check;

ALTER TABLE public.email_drip_queue
  ADD CONSTRAINT email_drip_queue_status_check
  CHECK (status IN ('pending','sent','failed','skipped'));
```
