import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { resolveMetaContext } from '@/lib/meta/context'

export const dynamic = 'force-dynamic'

// GET /api/strategy/metrics?range=7 — Tüm instance'lar için toplam KPI
export async function GET(request: Request) {
  if (!supabase) {
    return NextResponse.json({ ok: false, error: 'database_unavailable' }, { status: 503 })
  }

  const ctx = await resolveMetaContext()
  if (!ctx) {
    return NextResponse.json({ ok: false, error: 'missing_token', message: 'Meta bağlantısı gerekli' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const rangeDays = parseInt(searchParams.get('range') || '7', 10)

  // Tüm instance ID'lerini al
  const { data: instances } = await supabase
    .from('strategy_instances')
    .select('id, monthly_budget_try')
    .eq('ad_account_id', ctx.accountId)

  if (!instances?.length) {
    return NextResponse.json({
      ok: true,
      kpi: { total_budget: 0, remaining_budget: 0, spend: 0, clicks: 0, roas: 0 },
    })
  }

  const instanceIds = instances.map((i) => i.id)
  const totalBudget = instances.reduce((sum, i) => sum + (i.monthly_budget_try || 0), 0)

  // Son snapshot'ları al (her instance için en son)
  const { data: snapshots } = await supabase
    .from('metrics_snapshots')
    .select('*')
    .in('strategy_instance_id', instanceIds)
    .eq('range_days', rangeDays)
    .order('created_at', { ascending: false })

  // Her instance için en son snapshot'ı al (dedupe)
  const seen = new Set<string>()
  const latest: Array<{ spend_try: number; clicks: number; roas: number }> = []
  for (const snap of snapshots ?? []) {
    if (!seen.has(snap.strategy_instance_id)) {
      seen.add(snap.strategy_instance_id)
      latest.push(snap)
    }
  }

  let totalSpend = 0
  let totalClicks = 0
  let totalRoasSum = 0
  let roasCount = 0

  for (const snap of latest) {
    totalSpend += snap.spend_try || 0
    totalClicks += snap.clicks || 0
    if (snap.roas > 0) {
      totalRoasSum += snap.roas
      roasCount++
    }
  }

  const avgRoas = roasCount > 0 ? Math.round((totalRoasSum / roasCount) * 100) / 100 : 0

  return NextResponse.json({
    ok: true,
    kpi: {
      total_budget: totalBudget,
      remaining_budget: totalBudget - totalSpend,
      spend: totalSpend,
      clicks: totalClicks,
      roas: avgRoas,
    },
  })
}
