/* ──────────────────────────────────────────────────────────
   POST /api/cron/yoalgoritma-scan-cached  (SMOKE TEST ONLY)

   AI engine'i yoai_daily_runs.command_center_data.campaigns
   verisiyle çalıştırır. Meta/Google fetcher'larını bypass eder
   (fetch süresi nedeniyle inline 300s'i aşıyordu).

   ?mode=agentic   → mevcut tool use'lu agentic loop
   ?mode=singlepass → yeni single-pass mode (Batch API uyumlu)

   Bu route SADECE Preview smoke test için. Production'da
   USE_AI_ENGINE=false olduğu için 503 döner. Test branch'ında
   yaşar; main'e merge edilmemeli.
   ────────────────────────────────────────────────────────── */

import { NextResponse } from 'next/server'
import { isAiEngineEnabled } from '@/lib/yoai/featureFlag'
import { isAnthropicReady } from '@/lib/anthropic/client'
import { runAiEngineForAccount, runAiEngineSinglePass } from '@/lib/yoai/ai/agent'
import type { DeepCampaignInsight } from '@/lib/yoai/analysisTypes'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  if (!isAiEngineEnabled()) {
    return NextResponse.json({ ok: false, error: 'USE_AI_ENGINE=false' }, { status: 503 })
  }
  if (!isAnthropicReady()) {
    return NextResponse.json({ ok: false, error: 'ANTHROPIC_API_KEY tanımlı değil' }, { status: 503 })
  }

  const url = new URL(request.url)
  const userId = url.searchParams.get('userId')
  const mode = (url.searchParams.get('mode') ?? 'singlepass').toLowerCase()
  if (!userId) {
    return NextResponse.json({ ok: false, error: 'userId gerekli' }, { status: 400 })
  }
  if (mode !== 'agentic' && mode !== 'singlepass') {
    return NextResponse.json({ ok: false, error: 'mode=agentic veya singlepass olmalı' }, { status: 400 })
  }

  const { supabase } = await import('@/lib/supabase/client')
  if (!supabase) {
    return NextResponse.json({ ok: false, error: 'Database yok' }, { status: 500 })
  }

  const { data: lastRun, error: lastErr } = await supabase
    .from('yoai_daily_runs')
    .select('user_id, run_date, command_center_data')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (lastErr || !lastRun) {
    return NextResponse.json({ ok: false, error: 'Cached daily run bulunamadı', detail: lastErr?.message }, { status: 404 })
  }

  const cc: any = lastRun.command_center_data || {}
  const allCampaigns: DeepCampaignInsight[] = Array.isArray(cc.campaigns) ? cc.campaigns : []
  if (allCampaigns.length === 0) {
    return NextResponse.json({ ok: false, error: 'Cached run\'da kampanya yok' }, { status: 404 })
  }

  const metaCampaigns = allCampaigns.filter(c => c.platform === 'Meta')
  const googleCampaigns = allCampaigns.filter(c => c.platform === 'Google')

  const out: any = { ok: true, userId, mode, runs: [] as any[] }

  const runner = mode === 'agentic' ? runAiEngineForAccount : runAiEngineSinglePass

  for (const [platform, camps] of [['Meta', metaCampaigns], ['Google', googleCampaigns]] as const) {
    if (camps.length === 0) continue
    const accountId = camps[0]?.id ?? 'unknown'
    try {
      const aiResult = await runner({
        ctx: { platform, accountId, campaigns: camps, industry: undefined },
      })
      out.runs.push({
        platform,
        accountId,
        campaignCount: camps.length,
        iterations: aiResult.meta.iterations,
        toolCalls: aiResult.meta.tool_calls_count,
        durationMs: aiResult.meta.duration_ms,
        tokens: {
          input: aiResult.meta.input_tokens,
          output: aiResult.meta.output_tokens,
          cacheRead: aiResult.meta.cache_read_tokens,
          cacheCreate: aiResult.meta.cache_creation_tokens,
        },
        output: aiResult.output,
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      out.runs.push({ platform, error: msg })
    }
  }

  return NextResponse.json(out)
}
