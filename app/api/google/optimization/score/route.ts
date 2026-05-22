/* ──────────────────────────────────────────────────────────
   GET /api/google/optimization/score

   Optimizasyon modülü — Google Ads kanadı (Faz 1). Bağlı Google Ads
   hesabının aktif kampanyalarını googleDeepFetcher ile çeker (gerçek
   GAQL insights) ve hâlihazırda üretilmiş skor + Meta-format ProblemTag
   + riskLevel ile döner. Sahte veri YOK — bağlantı yoksa 401.

   Meta tarafı (/api/meta/optimization/score) ETKİLENMEZ.
   ────────────────────────────────────────────────────────── */

import { NextResponse } from 'next/server'
import { requireOptimizationAccess } from '@/lib/meta/optimization/serverGuard'
import { fetchGoogleDeep } from '@/lib/yoai/googleDeepFetcher'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET() {
  // Subscription gate (Meta ile aynı kapı — optimization modül erişimi)
  const gate = await requireOptimizationAccess()
  if (!gate.ok) return gate.response

  const { campaigns, connected, errors } = await fetchGoogleDeep(gate.user.id)

  if (!connected) {
    return NextResponse.json(
      { ok: false, error: 'google_not_connected', message: 'Google Ads bağlantısı bulunamadı.' },
      { status: 401 },
    )
  }

  const data = campaigns.map((c) => ({
    id: c.id,
    name: c.campaignName,
    status: c.status,
    effectiveStatus: c.effectiveStatus ?? c.status,
    channelType: c.channelType ?? null,
    biddingStrategy: c.biddingStrategy ?? null,
    optimizationScore: c.optimizationScore ?? null,
    currency: c.currency,
    dailyBudget: c.dailyBudget,
    metrics: c.metrics,
    score: c.score,
    riskLevel: c.riskLevel,
    problemTags: c.problemTags,
    adsets: c.adsets.map((a) => ({
      id: a.id,
      name: a.name,
      status: a.status,
      dailyBudget: a.dailyBudget,
      metrics: a.metrics,
    })),
  }))

  return NextResponse.json({ ok: true, data: { campaigns: data, errors } })
}
