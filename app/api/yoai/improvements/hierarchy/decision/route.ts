import { NextResponse } from 'next/server'
import { readUserId } from '@/lib/auth/userCookie'
import { cookies } from 'next/headers'
import {
  approveImprovement,
  rejectImprovement,
  unrejectImprovement,
  markImprovementApplied,
  markImprovementPublishError,
  updateAdImprovementSpec,
  getImprovementRow,
  type HierLevel,
  type AdImprovementRow,
} from '@/lib/yoai/ai/hierarchicalStore'
import { improvementToProposal } from '@/lib/yoai/ai/improvementToProposal'

export const dynamic = 'force-dynamic'
export const maxDuration = 15

const LEVELS: HierLevel[] = ['campaign', 'adset', 'ad']
const APPROVABLE = new Set(['pending', 'approved', 'applied'])

/** Yeni hiyerarşik ad satırını mevcut improvementToProposal köprüsüne uyarlar. */
function adRowToProposal(row: AdImprovementRow) {
  const compat = {
    id: row.id,
    source_platform: row.source_platform,
    source_ad_id: row.ad_id,
    source_ad_name: row.ad_name,
    source_campaign_id: row.campaign_id,
    source_campaign_name: null,
    improvement_payload: row.improvement_payload,
    confidence: row.confidence,
  }
  return improvementToProposal(compat as unknown as Parameters<typeof improvementToProposal>[0])
}

/**
 * POST /api/yoai/improvements/hierarchy/decision
 * Body: { level: 'campaign'|'adset'|'ad', id, action: 'approve'|'reject'|'unreject'|'applied', reason?, publishAuditId? }
 *
 * - approve (ad): kartı onaylar + ad_spec'ten yayın sihirbazı proposal'ı döner.
 * - approve (campaign/adset): kartı onaylar.
 * - reject: rejected_by_user (soft-delete). pending/approved/applied'dan reddedilebilir.
 * - unreject: "Geri Al" → pending.
 * - applied: yayın sonrası kartı applied işaretler (wizard onPublished).
 */
export async function POST(request: Request) {
  try {
    const cookieStore = await cookies()
    const userId = readUserId(cookieStore)
    if (!userId) return NextResponse.json({ ok: false, error: 'Oturum gerekli' }, { status: 401 })

    const body = (await request.json().catch(() => ({}))) as {
      level?: string; id?: string; action?: string; reason?: string; publishAuditId?: string; error?: string
      edit?: { headlines?: string[]; descriptions?: string[]; primary_text?: string; cta?: string; daily_budget?: number | null }
    }
    const level = body.level as HierLevel
    const { id, action } = body
    if (!id || !LEVELS.includes(level)) {
      return NextResponse.json({ ok: false, error: 'Geçersiz level/id' }, { status: 400 })
    }

    if (action === 'approve') {
      await approveImprovement(level, userId, id) // pending→approved (idempotent değilse zaten approved kalır)
      if (level === 'ad') {
        const row = (await getImprovementRow('ad', userId, id)) as AdImprovementRow | null
        if (!row || !APPROVABLE.has(row.status)) {
          return NextResponse.json({ ok: false, code: 'NOT_FOUND', message: 'Kart bulunamadı veya yayınlanamaz durumda.' }, { status: 404 })
        }
        const proposal = adRowToProposal(row)
        // finalUrl yoksa işletme web sitesini kullan — aksi halde Google create-ad
        // 'https://example.com'a düşer (bozuk hedef) ve Meta preflight/RSA bloklanır.
        if (proposal && !proposal.finalUrl) {
          try {
            const { getProfileByUserId } = await import('@/lib/yoai/businessProfileStore')
            const profile = await getProfileByUserId(userId)
            const site = profile?.website_url?.trim()
            if (site) proposal.finalUrl = site.startsWith('http') ? site : `https://${site}`
          } catch (e) {
            console.warn('[hierarchy decision] finalUrl resolve skipped:', e instanceof Error ? e.message : e)
          }
        }
        return NextResponse.json({ ok: true, data: { proposal, row } })
      }
      return NextResponse.json({ ok: true })
    }

    if (action === 'reject') {
      const ok = await rejectImprovement(level, userId, id, body.reason)
      return NextResponse.json({ ok })
    }
    if (action === 'unreject') {
      const ok = await unrejectImprovement(level, userId, id)
      return NextResponse.json({ ok })
    }
    if (action === 'applied') {
      await markImprovementApplied(level, userId, id, body.publishAuditId ?? null)
      // Outcome ölçümü (öğrenen beyin): yayın anında kaynak kampanyanın "before"
      // metriklerini kaydet + yeni kampanya ID'sini sakla → after-snapshot cron'u
      // N gün sonra yeni kampanyayı ölçüp gerçek etkiyi (ROAS/CTR/CPC) hesaplar.
      if (level === 'ad' && body.publishAuditId) {
        try {
          const row = (await getImprovementRow('ad', userId, id)) as AdImprovementRow | null
          if (row?.campaign_id) {
            const { fetchCampaignMetricsById } = await import('@/lib/yoai/ai/campaignMetricsById')
            const { recordBeforeSnapshot } = await import('@/lib/yoai/resultTrackingStore')
            const before = await fetchCampaignMetricsById(row.source_platform, row.campaign_id, userId)
            if (before) {
              await recordBeforeSnapshot(userId, {
                proposalId: id,
                sourceCampaignId: row.campaign_id,
                platform: row.source_platform,
                recommendationType: 'optimization',
                beforeSnapshot: before,
                afterWindowDays: 14,
                proposalSnapshot: { publishAuditId: body.publishAuditId, platform: row.source_platform },
              })
            }
          }
        } catch (e) {
          console.warn('[hierarchy decision] before-snapshot kaydı atlandı:', e instanceof Error ? e.message : e)
        }
      }
      return NextResponse.json({ ok: true })
    }
    if (action === 'publish_error') {
      // Yayın başarısız → kart approved'da kalır, hata kaydedilir ("Tekrar Dene" görünür)
      await markImprovementPublishError(level, userId, id, body.error ?? 'Yayın başarısız')
      return NextResponse.json({ ok: true })
    }
    if (action === 'edit') {
      if (level !== 'ad') return NextResponse.json({ ok: false, error: 'Düzenleme yalnız reklam için' }, { status: 400 })
      const ok = await updateAdImprovementSpec(userId, id, body.edit ?? {})
      return NextResponse.json({ ok })
    }

    return NextResponse.json({ ok: false, error: 'Geçersiz action' }, { status: 400 })
  } catch (e) {
    console.error('[hierarchy decision] error:', e)
    return NextResponse.json({ ok: false, error: 'Sunucu hatası' }, { status: 500 })
  }
}
