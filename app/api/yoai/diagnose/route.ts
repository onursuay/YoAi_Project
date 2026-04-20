import { NextResponse } from 'next/server'
import type { DeepCampaignInsight } from '@/lib/yoai/analysisTypes'
import { diagnoseCampaigns } from '@/lib/yoai/meta/diagnosis'
import { decideForDiagnoses } from '@/lib/yoai/meta/decision'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

/* ────────────────────────────────────────────────────────────
   POST /api/yoai/diagnose

   Input: { campaigns: DeepCampaignInsight[] }
   Output: { diagnoses: DiagnosisResult[], decisions: Decision[] }

   Read-only endpoint. Hiçbir Meta kaynağına dokunmaz.
   Mevcut deep analysis çıktısını alır, çok değişkenli teşhis
   ve aksiyon önerileri döner.
   ──────────────────────────────────────────────────────────── */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const campaigns = (body?.campaigns || []) as DeepCampaignInsight[]
    if (!Array.isArray(campaigns)) {
      return NextResponse.json(
        { ok: false, error: 'campaigns alanı array olmalı.' },
        { status: 400 },
      )
    }

    const diagnoses = diagnoseCampaigns(campaigns)
    const decisions = decideForDiagnoses(diagnoses)

    return NextResponse.json({
      ok: true,
      diagnoses,
      decisions,
      summary: {
        total: diagnoses.length,
        byRootCause: diagnoses.reduce<Record<string, number>>((acc, d) => {
          acc[d.primary.id] = (acc[d.primary.id] || 0) + 1
          return acc
        }, {}),
      },
    })
  } catch (error) {
    console.error('[YoAi Diagnose] Error:', error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Bilinmeyen hata' },
      { status: 500 },
    )
  }
}
