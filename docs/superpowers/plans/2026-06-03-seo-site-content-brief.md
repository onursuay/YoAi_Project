# SEO Site-Bazlı İçerik Brief'i — Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** SEO otomatik makale konularını kullanıcının tek işletme profili yerine hedef sitenin kendisinden taranıp türetilen siteye-özgü bir "içerik brief"ine bağlamak; ayrıca kategori-bazlı konu rotasyonu ve esnek yayın takvimi eklemek.

**Architecture:** Her `site_connection` için bir `site_content_briefs` kaydı (Claude'un siteyi tarayıp sentezlediği kimlik). `selectDailyTopic` artık brief'i okur; brief yoksa bugünkü profil mantığına düşer (sıfır regresyon). Yayın takvimi `schedule_mode` (daily | weekly_days | monthly_days) ile genişler.

**Tech Stack:** Next.js (App Router) API routes, Supabase (service-role client, omddq), Anthropic Claude (`lib/anthropic/text.ts`), mevcut `businessSourceScanner`. Test framework YOK → saf-mantık birimleri standalone `scripts/*.mjs` node script'leriyle, entegrasyon DB doğrulamasıyla test edilir.

**Referans spec:** `docs/superpowers/specs/2026-06-03-seo-site-content-brief-design.md`

---

## Önemli kısıtlar (her görevde uy)

- Meta/Google reklam entegrasyon koduna **dokunma** (`lib/meta/*`, `lib/google/*`, `components/meta/*`, `components/google/*`).
- Tüm yeni kullanıcı-yüzlü metinler **`locales/tr.json` + `locales/en.json`** ikisine birden.
- UI standardı: `max-w-7xl`, `animate-card-enter`, amber/sarı YASAK, dropdown için `WizardSelect`.
- Migration **additive** ve idempotent (`IF NOT EXISTS`), omddq'ya uygulanır.
- Her görev sonunda commit + push (proje kuralı; commit mesajı sonuna `Co-Authored-By` satırı).

---

## Task 1: Migration — `site_content_briefs` tablosu + `article_schedules` ek kolonları

**Files:**
- Create: `supabase/migrations/20260603000000_site_content_briefs.sql`
- Create: `scripts/apply-site-content-briefs-migration.mjs`
- Test: omddq'da kolon/tablo varlık sorgusu

- [ ] **Step 1: Migration SQL'ini yaz**

`supabase/migrations/20260603000000_site_content_briefs.sql`:

```sql
-- ─────────────────────────────────────────────────────────────
-- SEO — site_content_briefs (Hedef site içerik kimliği brief'i)
--
-- Her site_connection için Claude'un siteyi tarayıp sentezlediği
-- siteye-özgü kimlik. SEO konu seçimi bu brief'ten beslenir →
-- çoklu işletme/site doğru çalışır.
--
-- + article_schedules'e kategori hedefleme ve esnek takvim kolonları
--   (tümü additive, NULLABLE/DEFAULT → geriye dönük uyumlu).
--
-- Idempotent: tekrar çalıştırılabilir.
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.site_content_briefs (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid NOT NULL REFERENCES public.signups(id) ON DELETE CASCADE,
  site_connection_id   uuid NOT NULL REFERENCES public.site_connections(id) ON DELETE CASCADE,
  scan_status          text NOT NULL DEFAULT 'pending'
                         CHECK (scan_status IN ('pending','running','completed','partial','failed')),
  company_name         text,
  sector               text,
  brand_tone           text,
  target_audience      text,
  products_or_services text[] NOT NULL DEFAULT '{}',
  categories           text[] NOT NULL DEFAULT '{}',
  keyword_themes       text[] NOT NULL DEFAULT '{}',
  content_angles       text[] NOT NULL DEFAULT '{}',
  audience_pains       text[] NOT NULL DEFAULT '{}',
  summary_text         text,
  last_error           text,
  scanned_at           timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_site_content_briefs_conn
  ON public.site_content_briefs(site_connection_id);
CREATE INDEX IF NOT EXISTS idx_site_content_briefs_user
  ON public.site_content_briefs(user_id);
CREATE INDEX IF NOT EXISTS idx_site_content_briefs_scanned
  ON public.site_content_briefs(scanned_at);

ALTER TABLE public.site_content_briefs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "site_content_briefs_select_own" ON public.site_content_briefs;
CREATE POLICY "site_content_briefs_select_own"
  ON public.site_content_briefs FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "site_content_briefs_insert_own" ON public.site_content_briefs;
CREATE POLICY "site_content_briefs_insert_own"
  ON public.site_content_briefs FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "site_content_briefs_update_own" ON public.site_content_briefs;
CREATE POLICY "site_content_briefs_update_own"
  ON public.site_content_briefs FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "site_content_briefs_delete_own" ON public.site_content_briefs;
CREATE POLICY "site_content_briefs_delete_own"
  ON public.site_content_briefs FOR DELETE USING (user_id = auth.uid());

-- article_schedules — kategori hedefleme + esnek takvim (additive)
ALTER TABLE public.article_schedules
  ADD COLUMN IF NOT EXISTS target_categories text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.article_schedules
  ADD COLUMN IF NOT EXISTS schedule_mode text NOT NULL DEFAULT 'daily'
    CHECK (schedule_mode IN ('daily','weekly_days','monthly_days'));
ALTER TABLE public.article_schedules
  ADD COLUMN IF NOT EXISTS days_of_week int[] NOT NULL DEFAULT '{}';
ALTER TABLE public.article_schedules
  ADD COLUMN IF NOT EXISTS days_of_month int[] NOT NULL DEFAULT '{}';
```

- [ ] **Step 2: Apply script'ini yaz**

`scripts/apply-site-content-briefs-migration.mjs` (kalıp: `scripts/apply-per-account-business-profiles-migration.mjs`):

```js
#!/usr/bin/env node
/**
 * YoAi — SEO site_content_briefs migration uygulayıcı.
 * Additive + idempotent. CANONICAL (omddq) projeye uygulanır.
 * Gerekli env (.env.local): DATABASE_URL (Transaction mode, port 6543).
 */
import { readFileSync } from 'fs'
import { resolve } from 'path'
import pg from 'pg'

const { Client } = pg
const ROOT = process.cwd()
try {
  const env = readFileSync(resolve(ROOT, '.env.local'), 'utf8')
  for (const line of env.split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
  }
} catch {}

const DATABASE_URL = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL
if (!DATABASE_URL) {
  console.error('\n❌  DATABASE_URL bulunamadı (.env.local). omddq Transaction mode (6543) bağlantısı gerekli.')
  console.error('   Alternatif: SQL\'i Supabase Dashboard > SQL Editor (omddq) içine yapıştır.\n')
  process.exit(1)
}
const FILE = 'supabase/migrations/20260603000000_site_content_briefs.sql'
async function main() {
  console.log('\n🚀  SEO site_content_briefs migration\n')
  const client = new Client({ connectionString: DATABASE_URL })
  await client.connect()
  try {
    const sql = readFileSync(resolve(ROOT, FILE), 'utf8')
    console.log(`▶  ${FILE}`)
    await client.query(sql)
    console.log('   ✓  Başarılı\n')
  } finally {
    await client.end()
  }
}
main().catch((err) => { console.error('\n❌  Migration başarısız:', err.message); process.exit(1) })
```

`package.json` scripts'e ekle: `"db:migrate:site-briefs": "node scripts/apply-site-content-briefs-migration.mjs"`.

- [ ] **Step 3: Migration'ı omddq'ya uygula**

Run: `node scripts/apply-site-content-briefs-migration.mjs`
Expected: `✓  Başarılı`

- [ ] **Step 4: Tablo + kolonların varlığını doğrula (read-only)**

Bir kerelik node probe (çalıştır, sonra sil):

```js
// scripts/_probe.mjs — geçici
import { readFileSync } from 'fs'; import { resolve } from 'path'; import { createClient } from '@supabase/supabase-js'
const env = readFileSync(resolve(process.cwd(),'.env.local'),'utf8')
for (const l of env.split('\n')){const m=l.match(/^([^#=]+)=(.*)$/);if(m)process.env[m[1].trim()]=m[2].trim().replace(/^["']|["']$/g,'')}
const sb=createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}})
const a=await sb.from('site_content_briefs').select('id,scan_status,categories').limit(1)
console.log('briefs table:', a.error?.message||'OK')
const b=await sb.from('article_schedules').select('id,target_categories,schedule_mode,days_of_week,days_of_month').limit(1)
console.log('schedule cols:', b.error?.message||'OK')
```
Run: `node scripts/_probe.mjs && rm scripts/_probe.mjs`
Expected: `briefs table: OK` ve `schedule cols: OK`

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260603000000_site_content_briefs.sql scripts/apply-site-content-briefs-migration.mjs package.json
git commit -m "feat(seo): site_content_briefs tablosu + article_schedules takvim/kategori kolonları (migration)"
git push
```

---

## Task 2: `siteContentBriefStore.ts` — erişim katmanı

**Files:**
- Create: `lib/seo/siteContentBriefStore.ts`

- [ ] **Step 1: Store'u yaz**

`lib/seo/siteContentBriefStore.ts` (kalıp: `lib/seo/scheduleStore.ts`):

```ts
import 'server-only'
import { supabase } from '@/lib/supabase/client'

export type BriefScanStatus = 'pending' | 'running' | 'completed' | 'partial' | 'failed'

export interface SiteContentBriefRow {
  id: string
  user_id: string
  site_connection_id: string
  scan_status: BriefScanStatus
  company_name: string | null
  sector: string | null
  brand_tone: string | null
  target_audience: string | null
  products_or_services: string[]
  categories: string[]
  keyword_themes: string[]
  content_angles: string[]
  audience_pains: string[]
  summary_text: string | null
  last_error: string | null
  scanned_at: string | null
  created_at: string
  updated_at: string
}

export type BriefPatch = Partial<Omit<SiteContentBriefRow, 'id' | 'user_id' | 'site_connection_id' | 'created_at' | 'updated_at'>>

/** Site bağlantısına ait brief (yoksa null). */
export async function getBriefByConnection(siteConnectionId: string): Promise<SiteContentBriefRow | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('site_content_briefs')
    .select('*')
    .eq('site_connection_id', siteConnectionId)
    .maybeSingle()
  if (error || !data) return null
  return data as SiteContentBriefRow
}

/** find-then-write (constraint-agnostik): site başına tek brief upsert. */
export async function upsertBrief(
  userId: string,
  siteConnectionId: string,
  patch: BriefPatch
): Promise<SiteContentBriefRow | null> {
  if (!supabase) return null
  const now = new Date().toISOString()
  const existing = await getBriefByConnection(siteConnectionId)
  const payload: Record<string, unknown> = { ...patch, updated_at: now }

  if (existing) {
    const { data, error } = await supabase
      .from('site_content_briefs')
      .update(payload)
      .eq('id', existing.id)
      .select()
      .single()
    if (error || !data) { console.error('[BriefStore] UPDATE_FAIL', error?.message); return null }
    return data as SiteContentBriefRow
  }

  payload.user_id = userId
  payload.site_connection_id = siteConnectionId
  payload.created_at = now
  const { data, error } = await supabase.from('site_content_briefs').insert(payload).select().single()
  if (error || !data) { console.error('[BriefStore] INSERT_FAIL', error?.message); return null }
  return data as SiteContentBriefRow
}

/** Bayatlamış (scanned_at < cutoff) VEYA pending/failed brief'ler — aylık tazeleme için. */
export async function listStaleBriefs(cutoffIso: string): Promise<SiteContentBriefRow[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('site_content_briefs')
    .select('*')
    .or(`scanned_at.is.null,scanned_at.lt.${cutoffIso},scan_status.eq.failed`)
  if (error) { console.error('[BriefStore] LIST_STALE_FAIL', error.message); return [] }
  return (data ?? []) as SiteContentBriefRow[]
}
```

- [ ] **Step 2: Tip derlemesini doğrula**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep siteContentBriefStore || echo "no type errors in store"`
Expected: `no type errors in store`

- [ ] **Step 3: Commit**

```bash
git add lib/seo/siteContentBriefStore.ts
git commit -m "feat(seo): site_content_briefs erişim katmanı (get/upsert/listStale)"
git push
```

---

## Task 3: `siteBriefPipeline.ts` — tara + Claude sentezi + persist

**Files:**
- Create: `lib/seo/siteBriefPipeline.ts`
- Test: `scripts/verify-site-brief.mjs` (gerçek site taraması — manuel doğrulama)

- [ ] **Step 1: Pipeline'ı yaz**

`lib/seo/siteBriefPipeline.ts`:

```ts
import 'server-only'
import { supabase } from '@/lib/supabase/client'
import { scanBusinessSource } from '@/lib/yoai/businessSourceScanner'
import { claudeText, isClaudeReady } from '@/lib/anthropic/text'
import { upsertBrief } from '@/lib/seo/siteContentBriefStore'

export interface SiteBriefResult {
  ok: boolean
  status: 'completed' | 'partial' | 'failed'
  error?: string
}

/** Modelden gelen metinden ilk JSON objesini ayıkla (kod bloğu toleranslı). */
function extractJson(text: string): Record<string, unknown> | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fenced ? fenced[1] : text
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start === -1 || end === -1 || end < start) return null
  try { return JSON.parse(candidate.slice(start, end + 1)) } catch { return null }
}

function asArr(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.map((x) => String(x).trim()).filter(Boolean).slice(0, 30)
}

async function getBaseUrl(siteConnectionId: string): Promise<string | null> {
  if (!supabase) return null
  const { data } = await supabase
    .from('site_connections')
    .select('base_url')
    .eq('id', siteConnectionId)
    .maybeSingle()
  return (data as { base_url?: string } | null)?.base_url ?? null
}

/**
 * Hedef siteyi tarar, Claude ile siteye-özgü içerik brief'i sentezler ve
 * site_content_briefs'e yazar. THROW etmez — hata = 'failed' kaydı.
 * Fire-and-forget güvenli; makale akışını asla bloklamaz.
 */
export async function runSiteBriefPipeline(siteConnectionId: string, userId: string): Promise<SiteBriefResult> {
  await upsertBrief(userId, siteConnectionId, { scan_status: 'running', last_error: null })

  const baseUrl = await getBaseUrl(siteConnectionId)
  if (!baseUrl) {
    await upsertBrief(userId, siteConnectionId, { scan_status: 'failed', last_error: 'no_base_url' })
    return { ok: false, status: 'failed', error: 'no_base_url' }
  }

  // 1) Tara (HTTP scrape; LLM yok)
  const scan = await scanBusinessSource({ source_type: 'website', source_url: baseUrl })
  if (scan.scan_status === 'failed') {
    await upsertBrief(userId, siteConnectionId, {
      scan_status: 'failed',
      last_error: scan.error_message ?? 'scan_failed',
      scanned_at: new Date().toISOString(),
    })
    return { ok: false, status: 'failed', error: scan.error_message ?? 'scan_failed' }
  }

  // 2) Claude sentezi (yoksa deterministik scrape alanlarıyla 'partial')
  const fallback = {
    company_name: scan.extracted_title,
    sector: null as string | null,
    brand_tone: scan.extracted_brand_tone,
    target_audience: scan.extracted_audience,
    products_or_services: scan.extracted_products,
    categories: scan.extracted_services,
    keyword_themes: scan.extracted_keywords,
    content_angles: [] as string[],
    audience_pains: [] as string[],
  }

  if (!isClaudeReady()) {
    await upsertBrief(userId, siteConnectionId, {
      scan_status: 'partial',
      ...fallback,
      summary_text: buildSummary(fallback),
      scanned_at: new Date().toISOString(),
      last_error: null,
    })
    return { ok: true, status: 'partial' }
  }

  const prompt = `Aşağıda bir işletmenin web sitesinden taranmış içerik var. Bu işletmenin SEO blog içeriği üretimi için kullanılacak yapılandırılmış bir profil çıkar.

SİTE: ${baseUrl}
BAŞLIK: ${scan.extracted_title ?? '-'}
AÇIKLAMA: ${scan.extracted_description ?? '-'}
TESPİT EDİLEN HİZMETLER: ${scan.extracted_services.join(', ') || '-'}
TESPİT EDİLEN ÜRÜNLER: ${scan.extracted_products.join(', ') || '-'}
ANAHTAR KELİMELER: ${scan.extracted_keywords.join(', ') || '-'}
SAYFA METNİ (özet): ${scan.raw_excerpt ?? '-'}

SADECE şu şemada geçerli bir JSON döndür (kod bloğu/açıklama ekleme):
{
  "company_name": "firma adı",
  "sector": "ana sektör (kısa)",
  "brand_tone": "marka tonu (kısa)",
  "target_audience": "hedef kitle (kısa)",
  "products_or_services": ["..."],
  "categories": ["sitedeki ayrı hizmet/kategoriler — her biri bir blog konusu ekseni olabilecek şekilde"],
  "keyword_themes": ["..."],
  "content_angles": ["blog içerik açıları"],
  "audience_pains": ["kitlenin sorunları/ihtiyaçları"]
}`

  const text = await claudeText({ user: prompt, maxTokens: 1500, temperature: 0.4, timeoutMs: 60000 })
  const parsed = text ? extractJson(text) : null

  const merged = parsed
    ? {
        company_name: (parsed.company_name as string) || fallback.company_name,
        sector: (parsed.sector as string) || fallback.sector,
        brand_tone: (parsed.brand_tone as string) || fallback.brand_tone,
        target_audience: (parsed.target_audience as string) || fallback.target_audience,
        products_or_services: asArr(parsed.products_or_services).length ? asArr(parsed.products_or_services) : fallback.products_or_services,
        categories: asArr(parsed.categories).length ? asArr(parsed.categories) : fallback.categories,
        keyword_themes: asArr(parsed.keyword_themes).length ? asArr(parsed.keyword_themes) : fallback.keyword_themes,
        content_angles: asArr(parsed.content_angles),
        audience_pains: asArr(parsed.audience_pains),
      }
    : fallback

  await upsertBrief(userId, siteConnectionId, {
    scan_status: parsed ? 'completed' : 'partial',
    ...merged,
    summary_text: buildSummary(merged),
    scanned_at: new Date().toISOString(),
    last_error: null,
  })
  return { ok: true, status: parsed ? 'completed' : 'partial' }
}

function buildSummary(b: {
  company_name: string | null; sector: string | null; brand_tone: string | null
  target_audience: string | null; products_or_services: string[]; categories: string[]
  keyword_themes: string[]; content_angles: string[]; audience_pains: string[]
}): string {
  const lines: string[] = []
  if (b.company_name) lines.push(`İşletme: ${b.company_name}`)
  if (b.sector) lines.push(`Sektör: ${b.sector}`)
  if (b.products_or_services.length) lines.push(`Ürün/Hizmetler: ${b.products_or_services.join(', ')}`)
  if (b.categories.length) lines.push(`Kategoriler: ${b.categories.join(', ')}`)
  if (b.target_audience) lines.push(`Hedef kitle: ${b.target_audience}`)
  if (b.keyword_themes.length) lines.push(`Anahtar temalar: ${b.keyword_themes.join(', ')}`)
  if (b.content_angles.length) lines.push(`İçerik açıları: ${b.content_angles.join(', ')}`)
  if (b.audience_pains.length) lines.push(`Kitle sorunları: ${b.audience_pains.join(', ')}`)
  if (b.brand_tone) lines.push(`Marka tonu: ${b.brand_tone}`)
  return lines.join('\n')
}
```

- [ ] **Step 2: Gerçek site ile doğrula (ustasiniyolla.com)**

`scripts/verify-site-brief.mjs` — ustasiniyolla.com bağlantısı için pipeline'ı bir TS-runner üzerinden çağırmak yerine, doğrudan tarama+sentez mantığını sıralı çalıştırıp brief'in site kimliğini yansıttığını teyit et. Pratik yol: deploy sonrası Task 13'teki backfill ile çalıştır. Burada yalnız tip derlemesini doğrula:

Run: `npx tsc --noEmit 2>&1 | grep siteBriefPipeline || echo "no type errors in pipeline"`
Expected: `no type errors in pipeline`

- [ ] **Step 3: Commit**

```bash
git add lib/seo/siteBriefPipeline.ts
git commit -m "feat(seo): runSiteBriefPipeline — site tara + Claude sentezi → içerik brief'i"
git push
```

---

## Task 4: Brief tetikleyicileri — yeni site bağlanınca + otomasyon kaydında

**Files:**
- Modify: `lib/seo/siteConnectionStore.ts` (insert branch'inde fire-and-forget)
- Modify: `app/api/seo/schedules/route.ts` (kayıt sonrası brief yoksa tetikle)

- [ ] **Step 1: `upsertConnection` insert branch'ine tetik ekle**

`lib/seo/siteConnectionStore.ts` — dosya başına import:

```ts
import { runSiteBriefPipeline } from '@/lib/seo/siteBriefPipeline'
```

`upsertConnection` içinde, **yeni insert** başarılı olduğunda (mevcut `payload.created_at = now` bloğundaki insert'ten sonra, `return toMasked(...)` öncesi) fire-and-forget tetik ekle:

```ts
  payload.created_at = now
  const { data, error } = await supabase
    .from('site_connections')
    .insert(payload)
    .select()
    .single()
  if (error || !data) {
    console.error('[SiteConnectionStore] INSERT_FAIL', { user: shortUser(userId), message: error?.message })
    return null
  }
  // Yeni site bağlandı → içerik brief'ini arka planda üret (fire-and-forget).
  const inserted = data as SiteConnectionRow
  void runSiteBriefPipeline(inserted.id, userId).catch((e) =>
    console.error('[SiteConnectionStore] BRIEF_TRIGGER_FAIL', (e as Error).message)
  )
  return toMasked(inserted)
```

- [ ] **Step 2: Otomasyon kaydında brief yoksa tetikle**

`app/api/seo/schedules/route.ts` — import ekle:

```ts
import { getBriefByConnection } from '@/lib/seo/siteContentBriefStore'
import { runSiteBriefPipeline } from '@/lib/seo/siteBriefPipeline'
```

POST'ta `if (!schedule) ...` kontrolünden SONRA, `return` öncesi:

```ts
  // Hedef sitenin brief'i yoksa arka planda üret (fire-and-forget).
  if (schedule.site_connection_id) {
    const existing = await getBriefByConnection(schedule.site_connection_id)
    if (!existing) {
      void runSiteBriefPipeline(schedule.site_connection_id, userId).catch((e) =>
        console.error('[schedules] BRIEF_TRIGGER_FAIL', (e as Error).message)
      )
    }
  }
```

- [ ] **Step 3: Tip derlemesini doğrula**

Run: `npx tsc --noEmit 2>&1 | grep -E "siteConnectionStore|schedules/route" || echo "no type errors"`
Expected: `no type errors`

- [ ] **Step 4: Commit**

```bash
git add lib/seo/siteConnectionStore.ts app/api/seo/schedules/route.ts
git commit -m "feat(seo): yeni site bağlanınca + otomasyon kaydında içerik brief'i fire-and-forget tetikle"
git push
```

---

## Task 5: `topicSelector.ts` — site brief bağlamı + kategori rotasyonu

**Files:**
- Modify: `lib/seo/topicSelector.ts`
- Test: `scripts/verify-topic-rotation.mjs`

- [ ] **Step 1: `topicSelector.ts`'i güncelle**

Importlara ekle:

```ts
import { getBriefByConnection, type SiteContentBriefRow } from '@/lib/seo/siteContentBriefStore'
```

Brief'ten bağlam kuran yardımcı ekle (mevcut `buildContext`'in yanına):

```ts
function buildContextFromBrief(brief: SiteContentBriefRow): string {
  if (brief.summary_text && brief.summary_text.trim()) return brief.summary_text
  const lines: string[] = []
  if (brief.company_name) lines.push(`İşletme: ${brief.company_name}`)
  if (brief.sector) lines.push(`Sektör: ${brief.sector}`)
  if (brief.products_or_services?.length) lines.push(`Ürün/Hizmetler: ${brief.products_or_services.join(', ')}`)
  if (brief.categories?.length) lines.push(`Kategoriler: ${brief.categories.join(', ')}`)
  if (brief.target_audience) lines.push(`Hedef kitle: ${brief.target_audience}`)
  if (brief.keyword_themes?.length) lines.push(`Anahtar temalar: ${brief.keyword_themes.join(', ')}`)
  return lines.join('\n')
}

/** Son başlıklarda EN AZ kullanılmış kategoriyi seç (round-robin kapsama). */
export function pickRotatingCategory(categories: string[], recentTitles: string[]): string | null {
  const cats = categories.map((c) => c.trim()).filter(Boolean)
  if (!cats.length) return null
  const lowered = recentTitles.map((t) => t.toLowerCase())
  let best = cats[0]
  let bestCount = Infinity
  for (const cat of cats) {
    const c = cat.toLowerCase()
    const count = lowered.filter((t) => t.includes(c)).length
    if (count < bestCount) { bestCount = count; best = cat }
  }
  return best
}
```

`aiSelectKeyword`'e opsiyonel `category` parametresi ekle:

```ts
async function aiSelectKeyword(
  businessContext: string,
  recentTitles: string[],
  language: 'tr' | 'en',
  category?: string | null
): Promise<string | null> {
  const langName = language === 'en' ? 'English' : 'Türkçe'
  const recent = recentTitles.length
    ? `\n\nZaten yayınlanmış başlıklar (bunlardan FARKLI, çakışmayan bir konu seç):\n${recentTitles.map((t) => `- ${t}`).join('\n')}`
    : ''
  const catLine = category ? `\n\nBu makale ŞU HİZMET/KATEGORİYE odaklanmalı: ${category}` : ''
  const prompt = `Aşağıdaki işletme için ${langName} dilinde, SEO açısından değerli, arama hacmi olabilecek YENİ bir blog makalesi konusu/anahtar kelimesi öner.
İşletme bağlamı:
${businessContext || '(bağlam yok — sektörel genel bir konu seç)'}${catLine}${recent}

SADECE anahtar kelime/konu ifadesini döndür (3-6 kelime), başka hiçbir şey yazma.`
  const text = await claudeText({ user: prompt, maxTokens: 60, temperature: 0.8 })
  const kw = text?.trim().replace(/^["'•\-\s]+|["'\s]+$/g, '')
  return kw || null
}
```

`selectDailyTopic`'i değiştir:

```ts
export async function selectDailyTopic(
  userId: string,
  opts: { keywordPool?: string[]; language?: 'tr' | 'en'; siteConnectionId?: string; targetCategories?: string[] }
): Promise<TopicResult> {
  const language = opts.language ?? 'tr'
  const recentTitles = await fetchRecentTitles(userId)

  // Bağlam: önce site brief (completed), yoksa profil fallback (bugünkü davranış).
  let businessContext = ''
  let briefCategories: string[] = []
  const brief = opts.siteConnectionId ? await getBriefByConnection(opts.siteConnectionId) : null
  if (brief && brief.scan_status === 'completed') {
    businessContext = buildContextFromBrief(brief)
    briefCategories = brief.categories ?? []
  } else {
    const [profile, intel] = await Promise.all([getProfileByUserId(userId), getIntelligenceByUserId(userId)])
    businessContext = buildContext(profile, intel)
  }

  // 1) Havuz doluysa → kullanıcı kelimesi HER ZAMAN kazanır.
  const fromPool = pickFromPool(opts.keywordPool ?? [], recentTitles)
  if (fromPool) {
    return { keyword: fromPool, businessContext, recentTitles }
  }

  // 2) Kategori rotasyonu + AI seçimi.
  const cats = (opts.targetCategories && opts.targetCategories.length) ? opts.targetCategories : briefCategories
  const category = pickRotatingCategory(cats, recentTitles)
  const aiKeyword = await aiSelectKeyword(businessContext, recentTitles, language, category)
  if (aiKeyword) {
    return { keyword: aiKeyword, businessContext, recentTitles }
  }

  // 3) Son çare.
  const fallback =
    briefCategories[0] ||
    (language === 'en' ? 'industry tips' : 'sektörel öneriler')
  return { keyword: fallback, businessContext, recentTitles }
}
```

> Not: `profile`/`intel` artık yalnız brief yoksa yükleniyor. `buildContext`, `getProfileByUserId`, `getIntelligenceByUserId` importları korunur (fallback'te kullanılır).

- [ ] **Step 2: `pickRotatingCategory` için failing test yaz**

`scripts/verify-topic-rotation.mjs`:

```js
// pickRotatingCategory mantığını izole test eder (saf fonksiyon kopyası).
function pickRotatingCategory(categories, recentTitles) {
  const cats = categories.map((c) => c.trim()).filter(Boolean)
  if (!cats.length) return null
  const lowered = recentTitles.map((t) => t.toLowerCase())
  let best = cats[0], bestCount = Infinity
  for (const cat of cats) {
    const c = cat.toLowerCase()
    const count = lowered.filter((t) => t.includes(c)).length
    if (count < bestCount) { bestCount = count; best = cat }
  }
  return best
}
const cats = ['Koltuk Yıkama', 'Halı Yıkama', 'Klima Servisi']
let pass = true
// Hiç başlık yoksa → ilk kategori
if (pickRotatingCategory(cats, []) !== 'Koltuk Yıkama') { console.error('FAIL: empty'); pass = false }
// Koltuk çok kullanıldı → en az kullanılana döner
const recent = ['Koltuk Yıkama nasıl yapılır', 'Koltuk Yıkama fiyatları', 'Halı Yıkama rehberi']
if (pickRotatingCategory(cats, recent) !== 'Klima Servisi') { console.error('FAIL: rotation'); pass = false }
// Boş kategori → null
if (pickRotatingCategory([], recent) !== null) { console.error('FAIL: null'); pass = false }
console.log(pass ? '✅ pickRotatingCategory PASS' : '❌ FAIL')
process.exit(pass ? 0 : 1)
```

Run: `node scripts/verify-topic-rotation.mjs`
Expected: ilk çalıştırmada kopyalanan mantık doğruysa `✅ pickRotatingCategory PASS` (mantık `topicSelector.ts`'tekiyle birebir aynı olmalı).

- [ ] **Step 3: Tip derlemesi**

Run: `npx tsc --noEmit 2>&1 | grep topicSelector || echo "no type errors"`
Expected: `no type errors`

- [ ] **Step 4: Commit**

```bash
git add lib/seo/topicSelector.ts scripts/verify-topic-rotation.mjs
git commit -m "feat(seo): konu seçimi site brief bağlamı + kategori rotasyonu (havuz boşken)"
git push
```

---

## Task 6: `isScheduleDue` — esnek takvim (daily | weekly_days | monthly_days)

**Files:**
- Modify: `lib/seo/timezone.ts`
- Test: `scripts/verify-schedule-due.mjs`

- [ ] **Step 1: `isScheduleDue`'yu obje-girdili + yeni modlarla yeniden yaz**

`lib/seo/timezone.ts` — `isScheduleDue`'yu değiştir:

```ts
export interface ScheduleDueInput {
  publishTime: string
  timezone: string
  lastRunDate: string | null
  scheduleMode?: string | null            // 'daily' | 'weekly_days' | 'monthly_days'
  daysOfWeek?: number[] | null            // 0=Pazar..6=Cumartesi
  daysOfMonth?: number[] | null           // 1..31
  // legacy (schedule_mode yoksa kullanılır)
  frequency?: 'daily' | 'weekdays' | 'weekly'
  weekday?: number | null
}

function lastDayOfMonth(year: number, month1to12: number): number {
  return new Date(year, month1to12, 0).getDate() // month1to12 ay sonu
}

export function isScheduleDue(input: ScheduleDueInput, at: Date = new Date()): boolean {
  const local = getLocalParts(input.timezone, at)
  const [hStr, mStr] = input.publishTime.split(':')
  const targetMinutes = parseInt(hStr ?? '9', 10) * 60 + parseInt(mStr ?? '0', 10)

  // Aynı yerel günde zaten çalıştıysa tekrar tetikleme.
  if (input.lastRunDate === local.date) return false

  const [yStr, moStr, dStr] = local.date.split('-')
  const year = parseInt(yStr, 10)
  const month = parseInt(moStr, 10)
  const dayOfMonth = parseInt(dStr, 10)

  const mode = input.scheduleMode || ''
  let dayOk: boolean

  if (mode === 'weekly_days') {
    dayOk = (input.daysOfWeek ?? []).includes(local.weekday)
  } else if (mode === 'monthly_days') {
    const dom = input.daysOfMonth ?? []
    const lastDay = lastDayOfMonth(year, month)
    // Kısa ayda 29-31 seçilmişse → ayın son gününe clamp.
    dayOk = dom.some((d) => d === dayOfMonth || (d > lastDay && dayOfMonth === lastDay))
  } else if (mode === 'daily') {
    dayOk = true
  } else {
    // Legacy: schedule_mode yoksa eski frequency mantığı.
    const freq = input.frequency ?? 'daily'
    if (freq === 'weekdays' && (local.weekday === 0 || local.weekday === 6)) dayOk = false
    else if (freq === 'weekly' && input.weekday != null && local.weekday !== input.weekday) dayOk = false
    else dayOk = true
  }
  if (!dayOk) return false

  const nowMinutes = local.hour * 60 + local.minute
  return nowMinutes >= targetMinutes
}
```

- [ ] **Step 2: `isScheduleDue` testleri yaz**

`scripts/verify-schedule-due.mjs` (saf mantığın kopyası + senaryolar):

```js
// timezone.ts:isScheduleDue mantığının izole kopyası — DST için Intl kullanır.
const WEEKDAY_MAP = { Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6 }
function getLocalParts(tz, at) {
  const fmt = new Intl.DateTimeFormat('en-US',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false,weekday:'short'})
  const p = fmt.formatToParts(at); const g=(t)=>p.find(x=>x.type===t)?.value??''
  let hour=parseInt(g('hour'),10); if(hour===24)hour=0
  return { date:`${g('year')}-${g('month')}-${g('day')}`, hour, minute:parseInt(g('minute'),10), weekday:WEEKDAY_MAP[g('weekday')]??0 }
}
function lastDayOfMonth(y,m){return new Date(y,m,0).getDate()}
function isScheduleDue(input, at) {
  const local=getLocalParts(input.timezone,at)
  const [h,m]=input.publishTime.split(':'); const target=parseInt(h,10)*60+parseInt(m,10)
  if(input.lastRunDate===local.date)return false
  const [y,mo,d]=local.date.split('-').map(n=>parseInt(n,10))
  const mode=input.scheduleMode||''; let dayOk
  if(mode==='weekly_days')dayOk=(input.daysOfWeek??[]).includes(local.weekday)
  else if(mode==='monthly_days'){const dom=input.daysOfMonth??[];const last=lastDayOfMonth(y,mo);dayOk=dom.some(x=>x===d||(x>last&&d===last))}
  else if(mode==='daily')dayOk=true
  else{const f=input.frequency??'daily';if(f==='weekdays'&&(local.weekday===0||local.weekday===6))dayOk=false;else if(f==='weekly'&&input.weekday!=null&&local.weekday!==input.weekday)dayOk=false;else dayOk=true}
  if(!dayOk)return false
  return local.hour*60+local.minute>=target
}
const TZ='Europe/Istanbul'
// 2026-06-03 Çarşamba (weekday=3), saat 12:00 TR
const wed = new Date('2026-06-03T09:00:00Z') // 12:00 TR
let pass=true
const check=(name,got,exp)=>{ if(got!==exp){console.error('FAIL',name,'got',got);pass=false} }
// daily → due
check('daily', isScheduleDue({publishTime:'10:00',timezone:TZ,lastRunDate:null,scheduleMode:'daily'},wed), true)
// weekly_days Çar seçili → due
check('weekly hit', isScheduleDue({publishTime:'10:00',timezone:TZ,lastRunDate:null,scheduleMode:'weekly_days',daysOfWeek:[1,3,5]},wed), true)
// weekly_days Çar seçili değil → değil
check('weekly miss', isScheduleDue({publishTime:'10:00',timezone:TZ,lastRunDate:null,scheduleMode:'weekly_days',daysOfWeek:[1,5]},wed), false)
// monthly_days 3 seçili → due
check('monthly hit', isScheduleDue({publishTime:'10:00',timezone:TZ,lastRunDate:null,scheduleMode:'monthly_days',daysOfMonth:[1,3,15]},wed), true)
// monthly_days 3 değil → değil
check('monthly miss', isScheduleDue({publishTime:'10:00',timezone:TZ,lastRunDate:null,scheduleMode:'monthly_days',daysOfMonth:[1,15]},wed), false)
// saat henüz gelmedi → değil
check('time not yet', isScheduleDue({publishTime:'23:00',timezone:TZ,lastRunDate:null,scheduleMode:'daily'},wed), false)
// bugün çalıştı → değil
check('already ran', isScheduleDue({publishTime:'10:00',timezone:TZ,lastRunDate:'2026-06-03',scheduleMode:'daily'},wed), false)
// legacy weekly (mode yok), weekday=3 → due
check('legacy weekly', isScheduleDue({publishTime:'10:00',timezone:TZ,lastRunDate:null,frequency:'weekly',weekday:3},wed), true)
console.log(pass?'✅ isScheduleDue PASS':'❌ FAIL'); process.exit(pass?0:1)
```

Run: `node scripts/verify-schedule-due.mjs`
Expected: `✅ isScheduleDue PASS`

- [ ] **Step 3: Commit**

```bash
git add lib/seo/timezone.ts scripts/verify-schedule-due.mjs
git commit -m "feat(seo): esnek yayın takvimi — isScheduleDue (daily/weekly_days/monthly_days + legacy)"
git push
```

---

## Task 7: `scheduleStore.ts` — yeni alanlar

**Files:**
- Modify: `lib/seo/scheduleStore.ts`

- [ ] **Step 1: Tip + upsert'ü genişlet**

`ArticleScheduleRow`'a ekle (mevcut alanların yanına):

```ts
  target_categories: string[]
  schedule_mode: 'daily' | 'weekly_days' | 'monthly_days'
  days_of_week: number[]
  days_of_month: number[]
```

`UpsertScheduleInput`'a ekle:

```ts
  targetCategories?: string[]
  scheduleMode?: 'daily' | 'weekly_days' | 'monthly_days'
  daysOfWeek?: number[]
  daysOfMonth?: number[]
```

`upsertSchedule` payload eşlemesine ekle (mevcut `if (input.keywordPool !== undefined) ...` satırlarının yanına):

```ts
  if (input.targetCategories !== undefined) payload.target_categories = input.targetCategories
  if (input.scheduleMode !== undefined) payload.schedule_mode = input.scheduleMode
  if (input.daysOfWeek !== undefined) payload.days_of_week = input.daysOfWeek
  if (input.daysOfMonth !== undefined) payload.days_of_month = input.daysOfMonth
```

- [ ] **Step 2: Tip derlemesi**

Run: `npx tsc --noEmit 2>&1 | grep scheduleStore || echo "no type errors"`
Expected: `no type errors`

- [ ] **Step 3: Commit**

```bash
git add lib/seo/scheduleStore.ts
git commit -m "feat(seo): scheduleStore — target_categories + schedule_mode/days alanları"
git push
```

---

## Task 8: Cron `seo-article-run` — yeni `isScheduleDue` çağrısı

**Files:**
- Modify: `app/api/cron/seo-article-run/route.ts:36-38`

- [ ] **Step 1: `due` filtresini obje-girdiye çevir**

`app/api/cron/seo-article-run/route.ts` içindeki `due` filtresini değiştir:

```ts
  const due = schedules.filter((s) =>
    isScheduleDue(
      {
        publishTime: s.publish_time,
        timezone: s.timezone,
        lastRunDate: s.last_run_date,
        scheduleMode: s.schedule_mode,
        daysOfWeek: s.days_of_week,
        daysOfMonth: s.days_of_month,
        frequency: s.frequency,
        weekday: s.weekday,
      },
      now
    )
  )
```

- [ ] **Step 2: Tip derlemesi**

Run: `npx tsc --noEmit 2>&1 | grep seo-article-run || echo "no type errors"`
Expected: `no type errors`

- [ ] **Step 3: Commit**

```bash
git add app/api/cron/seo-article-run/route.ts
git commit -m "feat(seo): cron isScheduleDue çağrısı yeni esnek takvim girdisine geçti"
git push
```

---

## Task 9: API `/api/seo/schedules` — yeni alanları kabul et + validasyon

**Files:**
- Modify: `app/api/seo/schedules/route.ts`

- [ ] **Step 1: Validasyon + payload eşlemesi**

`app/api/seo/schedules/route.ts` POST içinde, `keywordPool` türetiminden sonra ekle:

```ts
  const MODES = ['daily', 'weekly_days', 'monthly_days'] as const
  const scheduleMode = MODES.includes(body.scheduleMode as never)
    ? (body.scheduleMode as 'daily' | 'weekly_days' | 'monthly_days')
    : undefined

  const daysOfWeek = Array.isArray(body.daysOfWeek)
    ? (body.daysOfWeek as unknown[]).map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6)
    : undefined
  const daysOfMonth = Array.isArray(body.daysOfMonth)
    ? (body.daysOfMonth as unknown[]).map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= 31)
    : undefined
  const targetCategories = Array.isArray(body.targetCategories)
    ? (body.targetCategories as unknown[]).map((c) => String(c).trim()).filter(Boolean).slice(0, 50)
    : undefined
```

`upsertSchedule(userId, { ... })` çağrısına ekle:

```ts
    scheduleMode,
    daysOfWeek,
    daysOfMonth,
    targetCategories,
```

> Not: mevcut `frequency` validasyonu ve alanı geriye uyum için kalır.

- [ ] **Step 2: Tip derlemesi**

Run: `npx tsc --noEmit 2>&1 | grep "schedules/route" || echo "no type errors"`
Expected: `no type errors`

- [ ] **Step 3: Commit**

```bash
git add app/api/seo/schedules/route.ts
git commit -m "feat(seo): schedules API — scheduleMode/daysOfWeek/daysOfMonth/targetCategories kabulü"
git push
```

---

## Task 10: `runScheduleArticle.ts` — siteConnectionId + targetCategories geçişi

**Files:**
- Modify: `lib/seo/runScheduleArticle.ts:116-119`

- [ ] **Step 1: `selectDailyTopic` çağrısını güncelle**

```ts
  const topic = await selectDailyTopic(userId, {
    keywordPool: s.keyword_pool ?? [],
    language: lang,
    siteConnectionId: site.id,
    targetCategories: s.target_categories ?? [],
  })
```

- [ ] **Step 2: Tip derlemesi**

Run: `npx tsc --noEmit 2>&1 | grep runScheduleArticle || echo "no type errors"`
Expected: `no type errors`

- [ ] **Step 3: Commit**

```bash
git add lib/seo/runScheduleArticle.ts
git commit -m "feat(seo): makale üretimi konu seçimine site + kategori bağlamını geçirir"
git push
```

---

## Task 11: Aylık brief tazeleme + backfill cron

**Files:**
- Create: `app/api/cron/seo-brief-refresh/route.ts`
- Modify: `vercel.json` (cron kaydı)

- [ ] **Step 1: Cron route'unu yaz**

`app/api/cron/seo-brief-refresh/route.ts`:

```ts
/* ──────────────────────────────────────────────────────────
   GET /api/cron/seo-brief-refresh

   Aylık (0 2 1 * *). İki iş:
   1) BACKFILL: brief'i hiç olmayan aktif site_connections için üret.
   2) REFRESH: scanned_at 30 günden eski (veya failed) brief'leri yeniden üret.
   Vercel 60s için zaman bütçesiyle sırayla; yetişmeyen bir sonraki ayda telafi.
   Auth: CRON_SECRET (Bearer).
   ────────────────────────────────────────────────────────── */
import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { listStaleBriefs } from '@/lib/seo/siteContentBriefStore'
import { runSiteBriefPipeline } from '@/lib/seo/siteBriefPipeline'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  const isProduction = process.env.NODE_ENV === 'production'
  if (!cronSecret && isProduction) {
    return NextResponse.json({ ok: false, error: 'Cron not configured' }, { status: 503 })
  }
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }
  if (!supabase) return NextResponse.json({ ok: false, error: 'db_unavailable' }, { status: 503 })

  const startedAt = Date.now()
  const targets: Array<{ id: string; user_id: string }> = []

  // 1) BACKFILL — brief'i olmayan aktif siteler
  const { data: conns } = await supabase
    .from('site_connections')
    .select('id,user_id,status')
    .eq('status', 'active')
  const { data: briefed } = await supabase.from('site_content_briefs').select('site_connection_id')
  const briefedSet = new Set((briefed ?? []).map((b) => (b as { site_connection_id: string }).site_connection_id))
  for (const c of (conns ?? []) as Array<{ id: string; user_id: string }>) {
    if (!briefedSet.has(c.id)) targets.push({ id: c.id, user_id: c.user_id })
  }

  // 2) REFRESH — 30 günden eski / failed
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const stale = await listStaleBriefs(cutoff)
  for (const b of stale) {
    if (!targets.find((t) => t.id === b.site_connection_id)) {
      targets.push({ id: b.site_connection_id, user_id: b.user_id })
    }
  }

  let ran = 0
  for (const t of targets) {
    await runSiteBriefPipeline(t.id, t.user_id).catch(() => {})
    ran++
    if (Date.now() - startedAt > 45_000) break
  }
  return NextResponse.json({ ok: true, candidates: targets.length, ran })
}
```

- [ ] **Step 2: `vercel.json`'a cron ekle**

`vercel.json` `crons` dizisine ekle:

```json
  {
    "path": "/api/cron/seo-brief-refresh",
    "schedule": "0 2 1 * *"
  }
```

- [ ] **Step 3: Tip derlemesi**

Run: `npx tsc --noEmit 2>&1 | grep seo-brief-refresh || echo "no type errors"`
Expected: `no type errors`

- [ ] **Step 4: Commit**

```bash
git add app/api/cron/seo-brief-refresh/route.ts vercel.json
git commit -m "feat(seo): aylık brief tazeleme + backfill cron (0 2 1 * *)"
git push
```

---

## Task 12: UI — `SeoAutomationPanel` esnek takvim + kategori seçimi + i18n

**Files:**
- Modify: `components/seo/SeoAutomationPanel.tsx`
- Modify: `locales/tr.json`, `locales/en.json`

- [ ] **Step 1: i18n anahtarlarını ekle (tr + en)**

`locales/tr.json` → `seo.automation` (veya panelin kullandığı namespace) altına:

```json
"scheduleMode": "Yayın takvimi",
"modeDaily": "Her gün",
"modeWeeklyDays": "Haftanın günleri",
"modeMonthlyDays": "Ayın günleri",
"selectDaysOfWeek": "Hangi günler yayınlansın?",
"selectDaysOfMonth": "Ayın hangi günleri?",
"targetCategories": "Hedef kategoriler",
"targetCategoriesHint": "Boş bırakırsanız tüm kategoriler arasında dönülür.",
"categoriesScanning": "Kategoriler taranıyor…",
"categoriesNone": "Henüz kategori bulunamadı (site taraması bekleniyor)."
```

`locales/en.json` → aynı key path:

```json
"scheduleMode": "Publishing schedule",
"modeDaily": "Every day",
"modeWeeklyDays": "Days of week",
"modeMonthlyDays": "Days of month",
"selectDaysOfWeek": "Which days to publish?",
"selectDaysOfMonth": "Which days of the month?",
"targetCategories": "Target categories",
"targetCategoriesHint": "Leave empty to rotate across all categories.",
"categoriesScanning": "Scanning categories…",
"categoriesNone": "No categories found yet (waiting for site scan)."
```

> Panelin gerçek namespace'ini doğrula: `SeoAutomationPanel.tsx` başındaki `useTranslations('...')` çağrısına bak; yeni anahtarları O namespace altına ekle.

- [ ] **Step 2: State'i genişlet**

`SeoAutomationPanel.tsx` — mevcut `frequency`/`weekday` state'lerinin yanına:

```ts
  const [scheduleMode, setScheduleMode] = useState<'daily' | 'weekly_days' | 'monthly_days'>('daily')
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([])
  const [daysOfMonth, setDaysOfMonth] = useState<number[]>([])
  const [targetCategories, setTargetCategories] = useState<string[]>([])
  const [briefCategories, setBriefCategories] = useState<string[]>([])
  const [briefStatus, setBriefStatus] = useState<string | null>(null)
```

Yükleme `useEffect`'inde (mevcut `setFrequency(s.frequency)` yakınında) schedule kaydından doldur:

```ts
        if (s.schedule_mode) setScheduleMode(s.schedule_mode)
        if (Array.isArray(s.days_of_week)) setDaysOfWeek(s.days_of_week)
        if (Array.isArray(s.days_of_month)) setDaysOfMonth(s.days_of_month)
        if (Array.isArray(s.target_categories)) setTargetCategories(s.target_categories)
```

Seçili site değişince brief kategorilerini çek (yeni `useEffect`):

```ts
  useEffect(() => {
    if (!siteConnectionId) { setBriefCategories([]); setBriefStatus(null); return }
    let cancelled = false
    fetch(`/api/seo/brief?siteConnectionId=${siteConnectionId}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d.ok) { setBriefCategories(d.brief?.categories ?? []); setBriefStatus(d.brief?.scan_status ?? null) } })
      .catch(() => {})
    return () => { cancelled = true }
  }, [siteConnectionId])
```

- [ ] **Step 3: Brief GET endpoint'i ekle (kategori listesi için)**

Create `app/api/seo/brief/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getBriefByConnection } from '@/lib/seo/siteContentBriefStore'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const cookieStore = await cookies()
  const userId = cookieStore.get('user_id')?.value
  if (!userId) return NextResponse.json({ ok: false, error: 'no_session' }, { status: 401 })
  const siteConnectionId = new URL(request.url).searchParams.get('siteConnectionId')
  if (!siteConnectionId) return NextResponse.json({ ok: false, error: 'missing_param' }, { status: 400 })
  const brief = await getBriefByConnection(siteConnectionId)
  // Yalnız kullanıcının kendi brief'i.
  if (brief && brief.user_id !== userId) return NextResponse.json({ ok: true, brief: null })
  return NextResponse.json({
    ok: true,
    brief: brief ? { scan_status: brief.scan_status, categories: brief.categories } : null,
  })
}
```

- [ ] **Step 4: `handleSave` payload'ına yeni alanları ekle**

`SeoAutomationPanel.tsx` `handleSave` içindeki `payload` objesine ekle (mevcut `weekday` satırının yanına):

```ts
        scheduleMode,
        daysOfWeek: scheduleMode === 'weekly_days' ? daysOfWeek : [],
        daysOfMonth: scheduleMode === 'monthly_days' ? daysOfMonth : [],
        targetCategories,
```

- [ ] **Step 5: JSX — takvim modu + gün seçimleri + kategori chip'leri**

Mevcut `frequency` `WizardSelect` bloğunu (`:240-253` civarı) `scheduleMode` seçicisiyle değiştir ve altına koşullu gün seçicileri ekle. `weekly` weekday bloğunu (`:254-263`) kaldır (artık `weekly_days` çoklu seçim kapsıyor). Kategori bölümü `keywordPool` bloğunun ÜSTÜNE eklenir. Renkler: seçili = `bg-primary/8 text-primary border-primary`, seçilmemiş = `bg-white text-gray-700 border-gray-200`; amber YOK.

```tsx
{/* Yayın takvimi modu */}
<div>
  <label className="block text-xs font-medium text-gray-600 mb-1">{t('scheduleMode')}</label>
  <WizardSelect
    value={scheduleMode}
    onChange={(v) => setScheduleMode(v as 'daily' | 'weekly_days' | 'monthly_days')}
    ariaLabel={t('scheduleMode')}
    options={[
      { value: 'daily', label: t('modeDaily') },
      { value: 'weekly_days', label: t('modeWeeklyDays') },
      { value: 'monthly_days', label: t('modeMonthlyDays') },
    ]}
  />
</div>

{scheduleMode === 'weekly_days' && (
  <div className="md:col-span-2">
    <label className="block text-xs font-medium text-gray-600 mb-1">{t('selectDaysOfWeek')}</label>
    <div className="flex flex-wrap gap-2">
      {weekdays.map((d, i) => {
        const on = daysOfWeek.includes(i)
        return (
          <button
            key={i}
            type="button"
            onClick={() => setDaysOfWeek(on ? daysOfWeek.filter((x) => x !== i) : [...daysOfWeek, i])}
            className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${on ? 'bg-primary/8 text-primary border-primary' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}
          >
            {d}
          </button>
        )
      })}
    </div>
  </div>
)}

{scheduleMode === 'monthly_days' && (
  <div className="md:col-span-2">
    <label className="block text-xs font-medium text-gray-600 mb-1">{t('selectDaysOfMonth')}</label>
    <div className="grid grid-cols-7 gap-1.5">
      {Array.from({ length: 31 }, (_, k) => k + 1).map((day) => {
        const on = daysOfMonth.includes(day)
        return (
          <button
            key={day}
            type="button"
            onClick={() => setDaysOfMonth(on ? daysOfMonth.filter((x) => x !== day) : [...daysOfMonth, day])}
            className={`h-8 rounded-md border text-sm transition-colors ${on ? 'bg-primary/8 text-primary border-primary' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}
          >
            {day}
          </button>
        )
      })}
    </div>
  </div>
)}

{/* Hedef kategoriler (brief'ten) */}
<div className="md:col-span-2">
  <label className="block text-xs font-medium text-gray-600 mb-1">{t('targetCategories')}</label>
  {briefStatus === 'running' || briefStatus === 'pending' ? (
    <p className="text-sm text-gray-500">{t('categoriesScanning')}</p>
  ) : briefCategories.length === 0 ? (
    <p className="text-sm text-gray-500">{t('categoriesNone')}</p>
  ) : (
    <div className="flex flex-wrap gap-2">
      {briefCategories.map((cat) => {
        const on = targetCategories.includes(cat)
        return (
          <button
            key={cat}
            type="button"
            onClick={() => setTargetCategories(on ? targetCategories.filter((c) => c !== cat) : [...targetCategories, cat])}
            className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${on ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}
          >
            {cat}
          </button>
        )
      })}
    </div>
  )}
  <p className="text-xs text-gray-500 mt-1">{t('targetCategoriesHint')}</p>
</div>
```

> `weekdays` dizisi `:181`'de zaten tanımlı (`['Pazar','Pazartesi',...]`). i18n için bunu da çeviriden almak boy-scout iyileştirmesi olur; minimumda mevcut diziyi kullan.

- [ ] **Step 6: Lint + tip derlemesi**

Run: `npx tsc --noEmit 2>&1 | grep -E "SeoAutomationPanel|seo/brief" || echo "no type errors"` ve `npm run lint 2>&1 | tail -5`
Expected: tip hatası yok; lint temiz.

- [ ] **Step 7: i18n bütünlük kontrolü**

Run: `node -e "const tr=require('./locales/tr.json'),en=require('./locales/en.json');const f=(o,p='')=>Object.entries(o).flatMap(([k,v])=>typeof v==='object'&&v?f(v,p+k+'.'):[p+k]);const a=new Set(f(tr)),b=new Set(f(en));const miss=[...a].filter(x=>!b.has(x)).concat([...b].filter(x=>!a.has(x)));console.log(miss.length?'MISSING:'+miss.join(','):'i18n keys aligned')"`
Expected: `i18n keys aligned`

- [ ] **Step 8: Commit**

```bash
git add components/seo/SeoAutomationPanel.tsx app/api/seo/brief/route.ts locales/tr.json locales/en.json
git commit -m "feat(seo): esnek yayın takvimi (haftanın/ayın günleri) + brief kategori seçimi UI + i18n"
git push
```

---

## Task 13: Uçtan uca doğrulama (omddq, gerçek site)

**Files:** yok (doğrulama)

- [ ] **Step 1: Deploy'u bekle (Vercel ~1-2dk)**

`git push` sonrası prod deploy tamamlanmasını bekle (proje notu: CDN/cache; hard refresh).

- [ ] **Step 2: ustasiniyolla.com için brief'i tetikle (backfill cron'u manuel çağır)**

CRON_SECRET ile:

```bash
curl -s -H "Authorization: Bearer $CRON_SECRET" "https://yoai.yodijital.com/api/cron/seo-brief-refresh" | python3 -m json.tool
```
Expected: `{"ok": true, "candidates": >=1, "ran": >=1}`

- [ ] **Step 3: Brief içeriğini doğrula (read-only DB probe)**

Geçici probe (çalıştır, sil): `site_content_briefs`'te ustasiniyolla.com bağlantısının `scan_status='completed'`, `categories` Kombi/Petek/Koltuk/Halı/Klima benzeri hizmetleri içermeli; `company_name` Belgemod **olmamalı**.

```js
// scripts/_probe2.mjs
import { readFileSync } from 'fs'; import { resolve } from 'path'; import { createClient } from '@supabase/supabase-js'
const env=readFileSync(resolve(process.cwd(),'.env.local'),'utf8');for(const l of env.split('\n')){const m=l.match(/^([^#=]+)=(.*)$/);if(m)process.env[m[1].trim()]=m[2].trim().replace(/^["']|["']$/g,'')}
const sb=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}})
const c=await sb.from('site_connections').select('id').eq('id','37e085bc-8c37-4a3d-b662-a3334944ede9').maybeSingle()
const b=await sb.from('site_content_briefs').select('scan_status,company_name,sector,categories').eq('site_connection_id','37e085bc-8c37-4a3d-b662-a3334944ede9').maybeSingle()
console.log(JSON.stringify(b.data,null,2))
```
Run: `node scripts/_probe2.mjs && rm scripts/_probe2.mjs`
Expected: `scan_status: "completed"`, `categories` site hizmetlerini içerir, `company_name` Belgemod değil.

- [ ] **Step 4: Konu seçimini doğrula (havuz boş → site brief)**

UI'da otomasyonu kaydet (Anahtar Kelime Havuzu boş bırak, hedef site ustasiniyolla.com). Bir sonraki üretimde (veya `selectDailyTopic` mantığıyla) konunun site kategorilerinden (örn. "Koltuk Yıkama …") geldiğini, Belgemod/MYK temalı OLMADIĞINI teyit et. Manuel hızlı tetik için cron:

```bash
curl -s -H "Authorization: Bearer $CRON_SECRET" "https://yoai.yodijital.com/api/cron/seo-article-run" | python3 -m json.tool
```
Expected: dönen `keyword` site hizmetiyle ilgili; `yoai_articles` son kaydı site kategorisinde.

- [ ] **Step 5: Havuz override doğrula**

UI'dan havuza "Koltuk Yıkama" ekle (Enter) → DB'de `keyword_pool` dolu → bir sonraki üretimde keyword = "Koltuk Yıkama".

- [ ] **Step 6: CHANGELOG güncelle + commit**

`docs/CHANGELOG.md` en üste yeni giriş (Sorun/Çözüm/Dosyalar). Commit + push.

---

## Self-Review notları (plan yazarı)

- **Spec kapsamı:** brief tablosu (T1-2), pipeline (T3), tetikleyiciler+backfill (T4, T11), konu seçimi+kategori rotasyonu (T5, T10), esnek takvim (T1,T6,T7,T8,T9,T12), UI+i18n (T12), fallback (T5 — brief yoksa profil), backfill (T11), doğrulama (T13) → tüm spec maddeleri karşılandı. Havuz kalıcılığı (spec §5) kod incelendi: değişiklik gerekmiyor, planda görev yok (doğru).
- **Tip tutarlılığı:** `runSiteBriefPipeline(siteConnectionId, userId)`, `getBriefByConnection(siteConnectionId)`, `upsertBrief(userId, siteConnectionId, patch)`, `selectDailyTopic(userId, {keywordPool, language, siteConnectionId, targetCategories})`, `isScheduleDue(ScheduleDueInput, at)` — tüm görevlerde aynı imza kullanıldı.
- **Risk:** `isScheduleDue` imza değişikliği tek çağırıcı (cron) ile sınırlı (T8). Eski `frequency`/`weekday` legacy yolla korunur → mevcut kayıtlar çalışır.
```
