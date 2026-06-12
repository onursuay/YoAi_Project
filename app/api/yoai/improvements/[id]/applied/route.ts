import { NextResponse } from 'next/server'
import { readUserId } from '@/lib/auth/userCookie'
import { cookies } from 'next/headers'
import { getImprovementById, markImprovementApplied, markImprovementPublishError } from '@/lib/yoai/ai/improvementStore'

export const dynamic = 'force-dynamic'
export const maxDuration = 15

/**
 * POST /api/yoai/improvements/[id]/applied
 * Body: { success: boolean, error?: string }
 * Yayınlama sihirbazı sonucu: başarı → "Yayında" (applied);
 * başarısız → "Onaylandı"da kalır + hata notu (karar 1).
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const cookieStore = await cookies()
    const userId = readUserId(cookieStore)
    if (!userId) return NextResponse.json({ ok: false, error: 'Oturum gerekli' }, { status: 401 })

    // Sahiplik kontrolü
    const row = await getImprovementById(userId, id)
    if (!row) return NextResponse.json({ ok: false, code: 'NOT_FOUND' }, { status: 404 })

    let success = true
    let errorMsg = ''
    try {
      const body = await request.json()
      success = body?.success !== false
      if (typeof body?.error === 'string') errorMsg = body.error
    } catch { /* default success */ }

    if (success) {
      await markImprovementApplied(id)
    } else {
      await markImprovementPublishError(id, errorMsg || 'Yayınlama başarısız oldu')
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[improvements applied] error:', e)
    return NextResponse.json({ ok: false, error: 'Sunucu hatası' }, { status: 500 })
  }
}
