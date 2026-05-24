import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getImprovementHierarchy, type HierStatus, type ImprovementHierarchy } from '@/lib/yoai/ai/hierarchicalStore'
import { isPerAccountScopeEnabled } from '@/lib/yoai/featureFlag'
import { resolveYoaiScope } from '@/lib/yoai/businessScope'
import { buildAccountScope, getBestAvailableRun } from '@/lib/yoai/dailyRunStore'
import { normalizeMetaAccountId, normalizeGoogleCustomerId } from '@/lib/yoai/businessKey'

export const dynamic = 'force-dynamic'
export const maxDuration = 15

/**
 * GET /api/yoai/improvements/hierarchy
 * Hiyerarşik geliştirme kartlarını döner:
 *   { accountAlerts[], campaigns[ { ...campaign, adsets[ { ...adset, ads[] } ] } ] }
 * Query: ?status=pending,approved,applied,rejected_by_user (varsayılan görünür statüler)
 *
 * İşletme scope'u (YOAI_PER_ACCOUNT_SCOPE): kartlar `user_id`'ye göre saklanır ve
 * hesap boyutu taşımaz; bu yüzden seçili işletmenin scope'lu günlük analizindeki
 * kampanya kimliklerine göre filtrelenir (başka hesabın — örn. belgemod — kartları
 * görünmez). Eşleşen scope'lu analiz henüz hazır değilse `scopePending` döner.
 */
export async function GET(request: Request) {
  try {
    const cookieStore = await cookies()
    const userId = cookieStore.get('user_id')?.value
    if (!userId) return NextResponse.json({ ok: false, error: 'Oturum gerekli' }, { status: 401 })

    const url = new URL(request.url)
    const statusParam = url.searchParams.get('status')
    const statuses = statusParam
      ? (statusParam.split(',').map((s) => s.trim()).filter(Boolean) as HierStatus[])
      : undefined

    const data = await getImprovementHierarchy(userId, statuses)

    // ── İşletme scope'u: kartları seçili işletmenin kampanyalarına sınırla ──
    if (isPerAccountScopeEnabled()) {
      const scope = await resolveYoaiScope()
      if (scope.scoped) {
        const run = await getBestAvailableRun(userId)
        const currentSig = buildAccountScope(scope.metaId, scope.googleCustomerId)
        const runCampaigns: any[] | null =
          run && run.account_scope === currentSig && run.command_center_data?.campaigns
            ? (run.command_center_data.campaigns as any[])
            : null

        if (!runCampaigns) {
          // Seçili işletmenin scope'lu analizi henüz hazır değil → yanlış kart gösterme.
          // İstemci, Command Center yenilenince kartları yeniden çeker.
          return NextResponse.json(
            { ok: true, data: { accountAlerts: [], campaigns: [] } as ImprovementHierarchy, scopePending: true },
            { headers: { 'Cache-Control': 'no-store' } },
          )
        }

        const allowed = new Set<string>(
          runCampaigns
            .filter((c) => c && c.id != null && c.platform)
            .map((c) => `${String(c.platform).toLowerCase()}:${String(c.id)}`),
        )
        const hasMeta = !!scope.metaId
        const hasGoogle = !!scope.googleCustomerId
        const metaAcc = normalizeMetaAccountId(scope.metaId)
        const googleAcc = normalizeGoogleCustomerId(scope.googleCustomerId)

        const filtered: ImprovementHierarchy = {
          // Hesap uyarıları: hesap boyutlu (account_id dolu) ise O hesaba göre süz
          // (başka işletmenin — örn. Belgemod — uyarısı sızmasın); legacy (account_id
          // NULL) uyarı için platform bazlı geriye uyumlu süzme.
          accountAlerts: data.accountAlerts.filter((a) => {
            if (a.account_id != null) {
              if (a.source_platform === 'meta') return metaAcc != null && normalizeMetaAccountId(a.account_id) === metaAcc
              if (a.source_platform === 'google') return googleAcc != null && normalizeGoogleCustomerId(a.account_id) === googleAcc
              return false
            }
            return (a.source_platform === 'meta' && hasMeta) || (a.source_platform === 'google' && hasGoogle) || a.source_platform == null
          }),
          campaigns: data.campaigns.filter((c) =>
            allowed.has(`${String(c.source_platform)}:${String(c.campaign_id)}`),
          ),
        }
        return NextResponse.json({ ok: true, data: filtered }, { headers: { 'Cache-Control': 'no-store' } })
      }
    }

    return NextResponse.json({ ok: true, data }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error('[improvements hierarchy GET] error:', e)
    return NextResponse.json({ ok: false, error: 'Sunucu hatası' }, { status: 500 })
  }
}
