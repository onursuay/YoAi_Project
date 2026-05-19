/* ──────────────────────────────────────────────────────────
   POST /api/cron/yoalgoritma-scan

   Vercel cron tarafından günlük tetiklenir. Bağlı her kullanıcı için
   yoalgoritma/scan.user Inngest event'i fırlatır.

   Inngest yoksa (INNGEST_EVENT_KEY tanımlı değil) inline mod'a düşer
   ve Vercel max 300s içinde olabildiği kadar kullanıcıyı tarar.

   Feature flag: USE_AI_ENGINE=true olmadıkça hiçbir şey yapmaz —
   eski /api/yoai/daily-run flow'u çalışmaya devam eder.

   Auth: CRON_SECRET (Vercel cron için) veya cookie-based admin.
   ────────────────────────────────────────────────────────── */

import { NextResponse } from 'next/server'
import { inngest, isInngestReady } from '@/inngest/client'
import { isAiEngineEnabled } from '@/lib/yoai/featureFlag'
import { isAnthropicReady } from '@/lib/anthropic/client'
import { scanUserWithAiEngine } from '@/lib/yoai/ai/scanUser'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  const isProduction = process.env.NODE_ENV === 'production'

  if (!cronSecret && isProduction) {
    console.error('[Cron][yoalgoritma-scan] CRON_SECRET tanımlı değil — prod\'da reddedildi')
    return NextResponse.json({ ok: false, error: 'Cron not configured' }, { status: 503 })
  }
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  if (!isAiEngineEnabled()) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: 'USE_AI_ENGINE=false — eski rule-engine flow çalışıyor (/api/yoai/daily-run)',
    })
  }

  if (!isAnthropicReady()) {
    return NextResponse.json({
      ok: false,
      error: 'ANTHROPIC_API_KEY tanımlı değil — AI engine devre dışı',
    }, { status: 503 })
  }

  // Aktif bağlantısı olan tüm kullanıcıları topla
  const { supabase } = await import('@/lib/supabase/client')
  if (!supabase) {
    return NextResponse.json({ ok: false, error: 'Database yok' }, { status: 500 })
  }

  const userIds = new Set<string>()
  const { data: metaConns } = await supabase
    .from('meta_connections').select('user_id').eq('status', 'active')
  const { data: googleConns } = await supabase
    .from('google_ads_connections').select('user_id').eq('status', 'active')

  metaConns?.forEach((c: any) => { if (c.user_id) userIds.add(c.user_id) })
  googleConns?.forEach((c: any) => { if (c.user_id) userIds.add(c.user_id) })

  if (userIds.size === 0) {
    return NextResponse.json({ ok: true, message: 'Aktif kullanıcı yok', users: 0 })
  }

  // Inngest varsa fan-out — durable, paralel, retry'lı
  if (isInngestReady()) {
    const events = Array.from(userIds).map(userId => ({
      name: 'yoalgoritma/scan.user' as const,
      data: { userId },
    }))
    await inngest.send(events)
    return NextResponse.json({
      ok: true,
      mode: 'inngest',
      users: userIds.size,
      message: `${userIds.size} kullanıcı için scan event'i gönderildi`,
    })
  }

  // Inline mode — Vercel 300s içinde sıralı tara (dev/staging için yeterli)
  console.warn('[Cron][yoalgoritma-scan] Inngest yok — inline mod')
  let completed = 0, failed = 0
  const errors: string[] = []
  for (const userId of userIds) {
    try {
      await scanUserWithAiEngine(userId)
      completed++
    } catch (e) {
      failed++
      const msg = e instanceof Error ? e.message : String(e)
      console.error(`[Cron][inline] User ${userId} failed:`, msg)
      errors.push(`User ${userId}: ${msg}`)
    }
  }
  return NextResponse.json({
    ok: true,
    mode: 'inline',
    users: userIds.size,
    completed,
    failed,
    errors: errors.slice(0, 10),
  })
}

/**
 * POST: manual tetikleme (UI veya admin için).
 * Cookie'den user_id alır, tek kullanıcı için scan başlatır.
 */
export async function POST(request: Request) {
  if (!isAiEngineEnabled()) {
    return NextResponse.json({ ok: false, error: 'USE_AI_ENGINE=false' }, { status: 503 })
  }
  if (!isAnthropicReady()) {
    return NextResponse.json({ ok: false, error: 'ANTHROPIC_API_KEY tanımlı değil' }, { status: 503 })
  }

  const { cookies } = await import('next/headers')
  const cookieStore = await cookies()
  const userId = cookieStore.get('user_id')?.value
  if (!userId) {
    return NextResponse.json({ ok: false, error: 'Oturum gerekli' }, { status: 401 })
  }

  if (isInngestReady()) {
    await inngest.send({ name: 'yoalgoritma/scan.user', data: { userId } })
    return NextResponse.json({ ok: true, mode: 'inngest', userId })
  }

  try {
    const result = await scanUserWithAiEngine(userId)
    return NextResponse.json({ ok: true, mode: 'inline', result })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    )
  }
}
