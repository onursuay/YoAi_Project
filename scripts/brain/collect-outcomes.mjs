#!/usr/bin/env node
/* ──────────────────────────────────────────────────────────
   YoAi Beyin — Yerel Outcome Toplayıcı (Layer 4 — yerel parça)

   Supabase (omddq) üzerinden öneri-sonucu verisini SALT-OKUNUR çeker,
   ANONİM + SIR-OLMAYAN agregalar üretip _learnings/_data/latest.json'a yazar.

   GÜVENLİK:
   - Yalnız .select() — yazma/silme YOK.
   - user_id / kampanya adı-ID'si / proposal_id / snapshot ham detayı / token ÇIKTIYA GİRMEZ.
   - SUPABASE_SERVICE_* anahtarı .env.local'dan okunur, YERELDE kalır, asla yazılmaz/push edilmez.

   Kaynak tablolar: yoai_recommendation_results, yoai_action_outcomes.
   Sözleşme: _learnings/global/outcome-measurement.md
   ────────────────────────────────────────────────────────── */

import { createClient } from '@supabase/supabase-js'
import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = resolve(__dirname, '..', '..')
const DATA_DIR = resolve(PROJECT_ROOT, '_learnings', '_data')
const LATEST_PATH = resolve(DATA_DIR, 'latest.json')

/* ── Env: .env.local'ı yükle (zaten set'liyse dokunma) ── */
try {
  // Node 20.12+/26: process.loadEnvFile. Dosya yoksa fırlatır → yut.
  process.loadEnvFile(resolve(PROJECT_ROOT, '.env.local'))
} catch {
  /* .env.local yoksa veya zaten --env-file ile yüklendiyse sorun değil */
}

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('[brain/collect] HATA: SUPABASE_URL ve SUPABASE_SERVICE_(ROLE_)KEY gerekli (.env.local).')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
})

/* ── Yardımcılar ── */

const PAGE = 1000

/** Bir tablodan seçili (sır-olmayan) kolonları sayfalayarak çeker. Tablo yoksa [] döner. */
async function fetchAll(table, columns) {
  const rows = []
  let from = 0
  for (;;) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .order('created_at', { ascending: false })
      .range(from, from + PAGE - 1)
    if (error) {
      if (error.code === '42P01') {
        console.warn(`[brain/collect] ${table} tablosu yok — atlanıyor (AUDIT: boş).`)
        return []
      }
      console.warn(`[brain/collect] ${table} okuma hatası: ${error.message}`)
      return rows
    }
    if (!data || data.length === 0) break
    rows.push(...data)
    if (data.length < PAGE) break
    from += PAGE
    if (from > 50000) break // güvenlik tavanı
  }
  return rows
}

function median(nums) {
  const xs = nums.filter((n) => typeof n === 'number' && Number.isFinite(n)).sort((a, b) => a - b)
  if (xs.length === 0) return null
  const mid = Math.floor(xs.length / 2)
  const m = xs.length % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2
  return Number(m.toFixed(6))
}

const OUTCOMES = ['improved', 'declined', 'no_change', 'insufficient_data', 'pending']

function emptyBucket() {
  return { improved: 0, declined: 0, no_change: 0, insufficient_data: 0, pending: 0, total: 0 }
}

function addOutcome(bucket, outcome) {
  const key = OUTCOMES.includes(outcome) ? outcome : 'insufficient_data'
  bucket[key] += 1
  bucket.total += 1
}

/* ── Toplama ── */

async function main() {
  const results = await fetchAll(
    'yoai_recommendation_results',
    'platform, recommendation_type, campaign_type, outcome, status, metric_delta, after_window_days, created_at, after_recorded_at',
  )
  const actions = await fetchAll(
    'yoai_action_outcomes',
    'root_cause, action_type, applied, created_at',
  )

  // outcome dağılımı
  const outcome_distribution = { improved: 0, declined: 0, no_change: 0, insufficient_data: 0, pending: 0 }
  const byPlatform = {}
  const byType = {}
  const roasDeltas = []
  const ctrDeltas = []
  const cpcDeltas = []

  for (const r of results) {
    const oc = OUTCOMES.includes(r.outcome) ? r.outcome : 'insufficient_data'
    outcome_distribution[oc] += 1

    const plat = r.platform || 'unknown'
    byPlatform[plat] = byPlatform[plat] || emptyBucket()
    addOutcome(byPlatform[plat], r.outcome)

    const typ = r.recommendation_type || 'unknown'
    byType[typ] = byType[typ] || emptyBucket()
    addOutcome(byType[typ], r.outcome)

    const d = r.metric_delta || {}
    if (typeof d.roas_delta === 'number') roasDeltas.push(d.roas_delta)
    if (typeof d.ctr_delta === 'number') ctrDeltas.push(d.ctr_delta)
    if (typeof d.cpc_delta === 'number') cpcDeltas.push(d.cpc_delta)
  }

  // action_outcomes → kök neden kırılımı (anonim)
  const byRootCause = {}
  for (const a of actions) {
    const rc = a.root_cause || 'unspecified'
    byRootCause[rc] = byRootCause[rc] || { total: 0, applied: 0 }
    byRootCause[rc].total += 1
    if (a.applied) byRootCause[rc].applied += 1
  }

  // pencere (tarih aralığı)
  const allDates = [...results, ...actions]
    .map((x) => x.created_at)
    .filter(Boolean)
    .sort()
  const window = {
    from: allDates.length ? allDates[0] : null,
    to: allDates.length ? allDates[allDates.length - 1] : null,
  }

  const out = {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    generated_by: 'scripts/brain/collect-outcomes.mjs',
    source: 'yoai_recommendation_results + yoai_action_outcomes (omddq, read-only, anonymized)',
    window,
    totals: {
      recommendation_results: results.length,
      action_outcomes: actions.length,
    },
    outcome_distribution,
    by_recommendation_type: Object.entries(byType).map(([recommendation_type, b]) => ({
      recommendation_type,
      ...b,
    })),
    by_platform: Object.entries(byPlatform).map(([platform, b]) => ({ platform, ...b })),
    by_root_cause: Object.entries(byRootCause).map(([root_cause, b]) => ({
      root_cause,
      total: b.total,
      applied: b.applied,
    })),
    median_deltas: {
      roas_delta: median(roasDeltas),
      ctr_delta: median(ctrDeltas),
      cpc_delta: median(cpcDeltas),
    },
    notes:
      results.length === 0
        ? 'Hiç öneri-sonucu kaydı yok. Bu beklenen olabilir (yeni kurulum / after-snapshot olgunlaşmadı). insufficient_data baskın — uydurma rakam üretilmedi.'
        : 'Agregalar gerçek omddq verisinden, anonim (user_id/kampanya/token içermez).',
  }

  mkdirSync(DATA_DIR, { recursive: true })
  writeFileSync(LATEST_PATH, JSON.stringify(out, null, 2) + '\n', 'utf8')

  // Tarihli snapshot (opsiyonel arşiv)
  const day = out.generated_at.slice(0, 10)
  mkdirSync(resolve(DATA_DIR, 'history'), { recursive: true })
  writeFileSync(resolve(DATA_DIR, 'history', `${day}.json`), JSON.stringify(out, null, 2) + '\n', 'utf8')

  console.log('[brain/collect] ✅ latest.json yazıldı.')
  console.log(
    `[brain/collect] results=${results.length} actions=${actions.length} ` +
      `outcome=${JSON.stringify(outcome_distribution)} window=${window.from || '—'}..${window.to || '—'}`,
  )
}

main().catch((e) => {
  console.error('[brain/collect] beklenmeyen hata:', e?.message || e)
  process.exit(1)
})
