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
import { readUserId } from '@/lib/auth/userCookie'
import { inngest, isInngestReady } from '@/inngest/client'
import { isAiEngineEnabled, isPerAccountScopeEnabled } from '@/lib/yoai/featureFlag'
import { isAnthropicReady } from '@/lib/anthropic/client'
import { listRegisteredAccounts } from '@/lib/account/registeredAccounts'
import { groupIntoBusinesses } from '@/lib/account/businessGroups'
import type { YoaiScope } from '@/lib/yoai/businessScope'

export const dynamic = 'force-dynamic'
export const maxDuration = 60  // Sadece event fan-out — saniyeler sürer

/**
 * Bir kullanıcı için tarama scope'larını çözer (çoklu işletme — Faz 1).
 *   • Flag KAPALI → [undefined] (tek legacy event, birleşik davranış).
 *   • Flag AÇIK   → kayıtlı hesapları işletmelere grupla; her işletme için 1 scope.
 *     Kayıt yoksa / gruplama boşsa → [undefined] (legacy fallback, sistem çalışır).
 * Headless (cron, cookie yok) bağlamda DB'den çözülür → her işletme ayrı event alır.
 */
async function resolveUserScopesForCron(userId: string): Promise<(YoaiScope | undefined)[]> {
  if (!isPerAccountScopeEnabled()) return [undefined]
  try {
    const regs = await listRegisteredAccounts(userId)
    if (!regs || regs.length === 0) return [undefined]
    const metaAccts = regs
      .filter((r) => r.platform === 'meta')
      .map((r) => ({ accountId: r.account_id, accountName: r.account_name }))
    const googleAccts = regs
      .filter((r) => r.platform === 'google')
      .map((r) => ({ customerId: r.account_id, loginCustomerId: r.login_customer_id, accountName: r.account_name }))
    const businesses = groupIntoBusinesses(metaAccts, googleAccts)
    if (businesses.length === 0) return [undefined]
    return businesses.map((b) => ({
      scoped: true as const,
      metaId: b.meta?.accountId ?? null,
      googleCustomerId: b.google?.customerId ?? null,
      googleLoginCustomerId: b.google?.loginCustomerId ?? null,
      businessId: b.id,
    }))
  } catch (e) {
    console.error('[Cron][yoalgoritma-scan] resolveUserScopes hata, legacy fallback:', e)
    return [undefined]
  }
}

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

  // Admin smoke override: ?onlyUser=<id> + valid CRON_SECRET → USE_AI_ENGINE flag'ini bypass et.
  // Bu yalnızca smoke / kontrollü rollout için. CRON_SECRET zaten gizli, prod'a açılmadan
  // tek user için test imkânı sağlar.
  const incomingUrl = new URL(request.url)
  const adminOverride = Boolean(incomingUrl.searchParams.get('onlyUser')) && Boolean(cronSecret) && authHeader === `Bearer ${cronSecret}`

  if (!isAiEngineEnabled() && !adminOverride) {
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

  // ?onlyUser=<id>: tek kullanıcı için event çıkar (smoke / admin tek-vuruş tarama)
  const url = incomingUrl
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

  const ids = Array.from(userIds)
  // Çoklu işletme (Faz 1): flag açıkken her kullanıcının her işletmesi için ayrı
  // scope'lu event; kapalıyken kullanıcı başına tek legacy event (sıfır regresyon).
  // scan.user → hesap-geneli (ai_suggestions); campaign-improvements.user → hiyerarşik kartlar.
  type ScanData = { userId: string; scope?: YoaiScope }
  const events: Array<{ name: 'yoalgoritma/scan.user' | 'yoalgoritma/campaign-improvements.user'; data: ScanData }> = []
  for (const userId of ids) {
    const scopes = await resolveUserScopesForCron(userId)
    for (const scope of scopes) {
      const data: ScanData = scope ? { userId, scope } : { userId }
      events.push({ name: 'yoalgoritma/scan.user', data })
      events.push({ name: 'yoalgoritma/campaign-improvements.user', data })
    }
  }
  await inngest.send(events)

  return NextResponse.json({
    ok: true,
    mode: 'inngest',
    users: userIds.size,
    events: events.length,
    scoped: isPerAccountScopeEnabled(),
    message: `${userIds.size} kullanıcı için ${events.length} scan/geliştirme event'i gönderildi`,
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
  const userId = readUserId(cookieStore)
  if (!userId) {
    return NextResponse.json({ ok: false, error: 'Oturum gerekli' }, { status: 401 })
  }

  // Manuel tetikleme cookie bağlamında → seçili işletmenin scope'u (flag açıksa).
  // Flag kapalı / scope yok → scoped:false → legacy tek event (sıfır regresyon).
  const { resolveYoaiScope } = await import('@/lib/yoai/businessScope')
  const scope = await resolveYoaiScope()
  const data: { userId: string; scope?: YoaiScope } = scope.scoped ? { userId, scope } : { userId }

  await inngest.send([
    { name: 'yoalgoritma/scan.user', data },
    { name: 'yoalgoritma/campaign-improvements.user', data },
  ])
  return NextResponse.json({ ok: true, mode: 'inngest', userId, scoped: scope.scoped })
}
