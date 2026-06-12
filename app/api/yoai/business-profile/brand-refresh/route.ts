import { NextResponse } from 'next/server'
import { readUserId } from '@/lib/auth/userCookie'
import { cookies } from 'next/headers'
import { isInngestReady, inngest } from '@/inngest/client'
import { runBrandProfilePipeline } from '@/lib/yoai/brandProfilePipeline'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * POST /api/yoai/business-profile/brand-refresh
 * Manuel "Marka Bilgilerini Yenile" — kendi website + sosyal kaynakları
 * yeniden tarar, deterministik zekayı üretir ve Claude marka sentezini ekler.
 *
 * Inngest hazırsa durable event (brand/ingest.user); değilse inline
 * fire-and-forget (mevcut profil-kaydet deseni gibi). Soft-fail.
 */
export async function POST() {
  const cookieStore = await cookies()
  const userId = readUserId(cookieStore)
  if (!userId) return NextResponse.json({ ok: false, error: 'Oturum gerekli' }, { status: 401 })

  if (isInngestReady()) {
    await inngest.send({ name: 'brand/ingest.user', data: { userId } })
    return NextResponse.json({ ok: true, mode: 'inngest', message: 'Marka bilgileri yenileniyor. Hazır olunca güncellenecek.' })
  }

  // Inngest yoksa: inline fire-and-forget (yanıtı bekletmeden)
  runBrandProfilePipeline(userId, { withSynthesis: true }).catch((e) =>
    console.warn('[brand-refresh] inline pipeline failed (non-fatal):', e),
  )
  return NextResponse.json({ ok: true, mode: 'inline', message: 'Marka bilgileri yenileniyor.' })
}
