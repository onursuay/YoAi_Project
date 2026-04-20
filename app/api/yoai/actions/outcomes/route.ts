import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { listActionOutcomes, listActionOutcomesForCampaign } from '@/lib/yoai/learningStore'

export const dynamic = 'force-dynamic'
export const maxDuration = 15

/* ────────────────────────────────────────────────────────────
   GET /api/yoai/actions/outcomes
   GET /api/yoai/actions/outcomes?campaignId=123

   v1: sadece listeleme. Kayıtlı öneriler + uygulama durumları.
   ──────────────────────────────────────────────────────────── */
export async function GET(request: Request) {
  try {
    const cookieStore = await cookies()
    const userId = cookieStore.get('session_id')?.value
    if (!userId) {
      return NextResponse.json({ ok: false, error: 'Oturum gerekli.' }, { status: 401 })
    }

    const url = new URL(request.url)
    const campaignId = url.searchParams.get('campaignId')

    const items = campaignId
      ? await listActionOutcomesForCampaign(userId, campaignId)
      : await listActionOutcomes(userId, 200)

    return NextResponse.json({ ok: true, items, count: items.length })
  } catch (error) {
    console.error('[YoAi Actions Outcomes] Error:', error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Bilinmeyen hata' },
      { status: 500 },
    )
  }
}
