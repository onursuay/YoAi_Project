/* ──────────────────────────────────────────────────────────
   GET /api/cron/yoalgoritma-scan

   Vercel cron tarafından haftalık tetiklenir (Pazar 03:00 UTC).
   Aktif Meta/Google bağlantısı olan her kullanıcı için
   `yoalgoritma/scan.user` Inngest event'i fırlatır. Inngest
   function tarafı durable batch akışını (submit → poll → persist)
   yönetir.

   Feature flag: USE_AI_ENGINE=true olmadıkça hiçbir şey yapmaz.
   Inngest entegrasyonu zorunludur (inline fallback yoktur).
   Auth: CRON_SECRET (Bearer header).
   ────────────────────────────────────────────────────────── */

import { NextResponse } from 'next/server'
import { inngest, isInngestReady } from '@/inngest/client'
import { isAiEngineEnabled } from '@/lib/yoai/featureFlag'
import { isAnthropicReady } from '@/lib/anthropic/client'

export const dynamic = 'force-dynamic'
export const maxDuration = 60  // Sadece event fan-out — saniyeler sürer

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

  if (!isInngestReady()) {
    return NextResponse.json({
      ok: false,
      error: 'Inngest yapılandırılmamış — INNGEST_EVENT_KEY gerekli',
    }, { status: 503 })
  }

  // Aktif bağlantısı olan tüm kullanıcıları topla
  const { supabase } = await import('@/lib/supabase/client')
  if (!supabase) {
    return NextResponse.json({ ok: false, error: 'Database yok' }, { status: 500 })
  }

  // SMOKE TEST: ?onlyUser= ile tek kullanıcı tetiklenebilir (test branch artefaktı)
  const url = new URL(request.url)
  const onlyUser = url.searchParams.get('onlyUser')

  const userIds = new Set<string>()
  if (onlyUser) {
    userIds.add(onlyUser)
  } else {
    const { data: metaConns } = await supabase
      .from('meta_connections').select('user_id').eq('status', 'active')
    const { data: googleConns } = await supabase
      .from('google_ads_connections').select('user_id').eq('status', 'active')

    metaConns?.forEach((c: any) => { if (c.user_id) userIds.add(c.user_id) })
    googleConns?.forEach((c: any) => { if (c.user_id) userIds.add(c.user_id) })
  }

  if (userIds.size === 0) {
    return NextResponse.json({ ok: true, message: 'Aktif kullanıcı yok', users: 0 })
  }

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

/**
 * POST: manual tetikleme (admin tarafından).
 * Cookie'den user_id alır, tek kullanıcı için scan event fırlatır.
 */
export async function POST() {
  if (!isAiEngineEnabled()) {
    return NextResponse.json({ ok: false, error: 'USE_AI_ENGINE=false' }, { status: 503 })
  }
  if (!isAnthropicReady()) {
    return NextResponse.json({ ok: false, error: 'ANTHROPIC_API_KEY tanımlı değil' }, { status: 503 })
  }
  if (!isInngestReady()) {
    return NextResponse.json({ ok: false, error: 'Inngest yapılandırılmamış' }, { status: 503 })
  }

  const { cookies } = await import('next/headers')
  const cookieStore = await cookies()
  const userId = cookieStore.get('user_id')?.value
  if (!userId) {
    return NextResponse.json({ ok: false, error: 'Oturum gerekli' }, { status: 401 })
  }

  await inngest.send({ name: 'yoalgoritma/scan.user', data: { userId } })
  return NextResponse.json({ ok: true, mode: 'inngest', userId })
}
