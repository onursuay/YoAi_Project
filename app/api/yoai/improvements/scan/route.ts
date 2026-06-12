import { NextResponse } from 'next/server'
import { readUserId } from '@/lib/auth/userCookie'
import { cookies } from 'next/headers'
import { isAiEngineEnabled } from '@/lib/yoai/featureFlag'
import { isAnthropicReady } from '@/lib/anthropic/client'
import { isInngestReady, inngest } from '@/inngest/client'

export const dynamic = 'force-dynamic'
export const maxDuration = 15

/**
 * POST /api/yoai/improvements/scan
 * On-demand "Şimdi Tara" — tek kullanıcı için per-ad improvement
 * event'i fırlatır (yoalgoritma/improvements.user).
 */
export async function POST() {
  if (!isAiEngineEnabled()) {
    return NextResponse.json({ ok: false, error: 'AI motoru kapalı' }, { status: 503 })
  }
  if (!isAnthropicReady()) {
    return NextResponse.json({ ok: false, error: 'AI servisi yapılandırılmamış' }, { status: 503 })
  }
  if (!isInngestReady()) {
    return NextResponse.json({ ok: false, error: 'Tarama altyapısı yapılandırılmamış' }, { status: 503 })
  }

  const cookieStore = await cookies()
  const userId = readUserId(cookieStore)
  if (!userId) return NextResponse.json({ ok: false, error: 'Oturum gerekli' }, { status: 401 })

  await inngest.send({ name: 'yoalgoritma/improvements.user', data: { userId } })
  return NextResponse.json({ ok: true, message: 'Tarama başlatıldı. Kartlar hazır olunca burada görünecek.' })
}
