import { NextResponse } from 'next/server'
import { createMetaClient } from '@/lib/meta/client'

export const dynamic = 'force-dynamic'

const CAP_STRATEGIES = ['LOWEST_COST_WITH_BID_CAP', 'COST_CAP'] as const
const ALL_STRATEGIES = ['LOWEST_COST_WITHOUT_CAP', 'LOWEST_COST_WITH_BID_CAP', 'COST_CAP'] as const

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const campaignId = searchParams.get('campaignId')
    const objective = searchParams.get('objective')
    const campaignBudgetOptimization = searchParams.get('campaignBudgetOptimization')

    let requiresBidAmount = false

    if (campaignId) {
      const metaClient = await createMetaClient()
      if (!metaClient) {
        return NextResponse.json(
          { ok: false, error: 'missing_token', message: 'Meta bağlantısı bulunamadı' },
          { status: 401 }
        )
      }
      const res = await metaClient.client.get<{ objective?: string; daily_budget?: string; lifetime_budget?: string }>(
        `/${campaignId}`,
        { fields: 'objective,daily_budget,lifetime_budget' }
      )
      if (res.ok && res.data?.objective) {
        const campaignHasBudget = !!(res.data.daily_budget || res.data.lifetime_budget)
        if (res.data.objective === 'OUTCOME_TRAFFIC' && campaignHasBudget) {
          requiresBidAmount = true
        }
      }
    } else if (objective != null && campaignBudgetOptimization != null) {
      const isCBO = campaignBudgetOptimization === 'true' || campaignBudgetOptimization === '1'
      if (objective.toUpperCase() === 'OUTCOME_TRAFFIC' && isCBO) {
        requiresBidAmount = true
      }
    }

    return NextResponse.json({
      ok: true,
      requiresBidAmount,
      allowedBidStrategies: requiresBidAmount ? [...CAP_STRATEGIES] : [...ALL_STRATEGIES],
    })
  } catch (error) {
    console.error('[bid-requirements]', error)
    return NextResponse.json(
      { ok: false, error: 'server_error', message: 'Sunucu hatası' },
      { status: 500 }
    )
  }
}
