import { NextResponse } from 'next/server'
import { readUserId } from '@/lib/auth/userCookie'
import { cookies } from 'next/headers'
import { approveImprovement, getImprovementById } from '@/lib/yoai/ai/improvementStore'
import { improvementToProposal } from '@/lib/yoai/ai/improvementToProposal'

export const dynamic = 'force-dynamic'
export const maxDuration = 15

/**
 * POST /api/yoai/improvements/[id]/approve
 * Kartı "Onaylandı" yapar ve önizleme→yayınlama sihirbazı için
 * ad_spec'ten üretilmiş proposal'ı döner. Gerçek yayın MEVCUT
 * AdCreationWizard akışıyla (önizleme→yayınla) yapılır.
 */
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const cookieStore = await cookies()
    const userId = readUserId(cookieStore)
    if (!userId) return NextResponse.json({ ok: false, error: 'Oturum gerekli' }, { status: 401 })

    // pending → approved geçişi
    let row = await approveImprovement(userId, id)
    // Zaten approved ise (kullanıcı "Yayınla"ya tekrar bastı) idempotent davran:
    // yayın sihirbazını yeniden açabilmek için proposal'ı yine döndür.
    if (!row) {
      const existing = await getImprovementById(userId, id)
      if (existing && (existing.status === 'approved' || existing.status === 'pending')) {
        row = existing
      }
    }
    if (!row) {
      return NextResponse.json({ ok: false, code: 'NOT_FOUND', message: 'Kart bulunamadı veya yayınlanamaz durumda.' }, { status: 404 })
    }
    const proposal = improvementToProposal(row)
    return NextResponse.json({ ok: true, data: { improvement: row, proposal } })
  } catch (e) {
    console.error('[improvements approve] error:', e)
    return NextResponse.json({ ok: false, error: 'Sunucu hatası' }, { status: 500 })
  }
}
