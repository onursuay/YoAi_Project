import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { recordActionOutcome } from '@/lib/yoai/learningStore'
import type { Decision } from '@/lib/yoai/meta/decision'
import type { RootCauseId } from '@/lib/yoai/meta/diagnosis'

export const dynamic = 'force-dynamic'
export const maxDuration = 15

/* ────────────────────────────────────────────────────────────
   POST /api/yoai/actions/record

   v1 Learning Layer — veri biriktirme.
   Kullanıcı bir öneriyi uyguladığında (veya reddettiğinde) çağrılır.
   Sonuç analizi yapılmaz; sadece kayıt tutulur.

   Body: {
     decision: Decision,
     actionIndex: number,
     applied: boolean,
     metricsBefore?: any
   }
   ──────────────────────────────────────────────────────────── */
export async function POST(request: Request) {
  try {
    const cookieStore = await cookies()
    const userId = cookieStore.get('session_id')?.value
    if (!userId) {
      return NextResponse.json({ ok: false, error: 'Oturum gerekli.' }, { status: 401 })
    }

    const body = await request.json()
    const decision = body.decision as Decision | undefined
    const actionIndex = (body.actionIndex ?? 0) as number
    const applied = !!body.applied
    const metricsBefore = body.metricsBefore ?? null

    if (!decision || !Array.isArray(decision.actions) || !decision.actions[actionIndex]) {
      return NextResponse.json(
        { ok: false, error: 'Geçersiz decision payload\'u.' },
        { status: 400 },
      )
    }

    const action = decision.actions[actionIndex]
    const rec = await recordActionOutcome({
      user_id: userId,
      campaign_id: decision.campaignId,
      campaign_name: decision.campaignName,
      root_cause: (decision.rootCauseId as RootCauseId) || null,
      action_type: action.actionType,
      suggestion_payload: { decision, actionIndex },
      applied,
      metrics_before: metricsBefore,
    })

    return NextResponse.json({
      ok: true,
      recorded: !!rec,
      /** Eğer false dönerse tablo yoktur — uyarı veriyoruz ama endpoint patlamaz */
      note: rec
        ? null
        : 'Kayıt yazılamadı (tablo yok olabilir). docs/sql/yoai_action_outcomes.sql şemasını çalıştırın.',
    })
  } catch (error) {
    console.error('[YoAi Actions Record] Error:', error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Bilinmeyen hata' },
      { status: 500 },
    )
  }
}
