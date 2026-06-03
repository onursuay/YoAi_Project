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

  // ── GEÇİCİ TEŞHİS (?diag=1) — prod yazma sorununu izole eder, sonra kaldırılacak.
  if (new URL(request.url).searchParams.get('diag') === '1') {
    const ref = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/https:\/\/([^.]+).*/, '$1')
    const keyInfo = {
      has_SERVICE_ROLE_KEY: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      has_SERVICE_KEY: Boolean(process.env.SUPABASE_SERVICE_KEY),
      has_ANON: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    }
    const stamp = new Date().toISOString()
    const read = await supabase.from('site_content_briefs').select('site_connection_id,scan_status').limit(3)
    const conn = await supabase
      .from('site_connections')
      .select('id,user_id,base_url')
      .eq('status', 'active')
      .limit(1)
      .maybeSingle()

    // Pipeline'ı try/catch ile çalıştır — gerçek hatayı/stack'i yakala.
    let pipelineResult: unknown = null
    let pipelineError: string | null = null
    let rowAfter: unknown = null
    if (conn.data) {
      const c = conn.data as { id: string; user_id: string; base_url: string }
      try {
        pipelineResult = await runSiteBriefPipeline(c.id, c.user_id)
      } catch (e) {
        pipelineError = `${(e as Error).message}\n${(e as Error).stack ?? ''}`.slice(0, 800)
      }
      const after = await supabase
        .from('site_content_briefs')
        .select('scan_status,company_name,categories,last_error')
        .eq('site_connection_id', c.id)
        .maybeSingle()
      rowAfter = after.data
    }
    return NextResponse.json({
      diag: true,
      supabaseRef: ref,
      keyInfo,
      stamp,
      readError: read.error ? `${read.error.code}: ${read.error.message}` : null,
      readRows: read.data?.length ?? 0,
      probedConn: conn.data ?? null,
      pipelineResult,
      pipelineError,
      rowAfter,
    })
  }

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
