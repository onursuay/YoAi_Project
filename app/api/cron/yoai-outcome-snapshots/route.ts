/* ──────────────────────────────────────────────────────────
   GET /api/cron/yoai-outcome-snapshots

   YoAlgoritma öğrenen beyin — outcome ölçüm döngüsünün AFTER ucu.
   'before_recorded' kayıtlardan penceresi (before_recorded_at + after_window_days)
   dolmuş olanları bulur; yayınlanan YENİ kampanyanın (proposal_snapshot.publishAuditId)
   son 14 günlük gerçek metriklerini çeker → recordAfterSnapshot → delta + outcome.

   Yeni kampanya henüz veri üretmediyse (PAUSED/aktive edilmemiş): grace süresi
   (pencere×2) dolana kadar tekrar denenir; sonra 'insufficient_data' olarak kapatılır.
   SAHTE VERİ ÜRETİLMEZ — veri yoksa boş snapshot → deterministik insufficient_data.

   Auth: CRON_SECRET (Bearer). Günlük tetiklenir.
   ────────────────────────────────────────────────────────── */

import { NextResponse } from 'next/server'
import { listDueBeforeRecorded, recordAfterSnapshot, type RecommendationResultRow } from '@/lib/yoai/resultTrackingStore'
import { fetchCampaignMetricsById } from '@/lib/yoai/ai/campaignMetricsById'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const MAX_PER_RUN = 25
const DAY_MS = 86_400_000

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error('[Cron][yoai-outcome-snapshots] CRON_SECRET tanımlı değil — reddedildi')
    return NextResponse.json({ ok: false, error: 'CRON_SECRET missing' }, { status: 500 })
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const now = Date.now()
  const due = await listDueBeforeRecorded(200)

  let processed = 0, measured = 0, insufficient = 0, retried = 0, skipped = 0
  for (const row of due as RecommendationResultRow[]) {
    if (processed >= MAX_PER_RUN) break
    const recordedAt = row.before_recorded_at ? new Date(row.before_recorded_at).getTime() : 0
    if (!recordedAt) { skipped++; continue }
    const windowMs = (row.after_window_days || 14) * DAY_MS
    if (now < recordedAt + windowMs) { skipped++; continue } // pencere dolmadı

    processed++
    const snap = (row.proposal_snapshot ?? {}) as { publishAuditId?: string; platform?: string }
    const platform = (snap.platform === 'google' ? 'google' : 'meta') as 'meta' | 'google'
    const newCampaignId = snap.publishAuditId

    let after = newCampaignId
      ? await fetchCampaignMetricsById(platform, String(newCampaignId), row.user_id)
      : null

    if (after) {
      await recordAfterSnapshot(row.user_id, row.id, { afterSnapshot: after })
      measured++
      continue
    }

    // Yeni kampanya henüz veri üretmedi. Grace (pencere×2) dolmadıysa sonra tekrar dene.
    if (now < recordedAt + windowMs * 2) { retried++; continue }
    // Grace doldu → insufficient_data olarak kapat (boş snapshot → deterministik insufficient)
    await recordAfterSnapshot(row.user_id, row.id, { afterSnapshot: {} })
    insufficient++
  }

  return NextResponse.json({ ok: true, due: due.length, processed, measured, insufficient, retried, skipped })
}
