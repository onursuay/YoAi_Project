import { NextResponse } from 'next/server'
import { resolveMetaContext } from '@/lib/meta/context'
import { runRuleEngine } from '@/lib/meta/optimization/ruleEngine'
import { generateRecommendations } from '@/lib/meta/optimization/aiRecommender'
import { requireOptimizationAccess } from '@/lib/meta/optimization/serverGuard'
import type { OptimizationCampaign, MagicScanResult } from '@/lib/meta/optimization/types'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    // Subscription gate — must hold a plan that includes optimization
    const gate = await requireOptimizationAccess()
    if (!gate.ok) return gate.response

    // Auth check — ensure user has valid Meta token
    const ctx = await resolveMetaContext()
    if (!ctx) {
      return NextResponse.json(
        { ok: false, error: 'missing_token', message: 'No access token or ad account selected' },
        { status: 401 },
      )
    }

    const body = await request.json()
    const { campaign, locale = 'tr', useAI = false } = body as {
      campaign: OptimizationCampaign
      locale: string
      useAI: boolean
    }

    if (!campaign?.id || !campaign?.insights || !campaign?.kpiTemplate) {
      return NextResponse.json(
        { ok: false, error: 'invalid_payload', message: 'Campaign data is required' },
        { status: 400 },
      )
    }

    // Step 1: Run deterministic rule engine
    const problemTags = runRuleEngine({
      insights: campaign.insights,
      template: campaign.kpiTemplate,
      triple: campaign.triple,
      adsets: campaign.adsets || [],
      dailyBudget: campaign.dailyBudget,
      lifetimeBudget: campaign.lifetimeBudget,
      campaignStatus: campaign.effectiveStatus || campaign.status,
      currency: campaign.currency,
    })

    // Step 2: Generate recommendations (AI or deterministic fallback)
    const { recommendations, aiGenerated } = await generateRecommendations(
      campaign,
      problemTags,
      locale,
      useAI,
    )

    // If the user asked for AI but we fell back to the rule engine, flag it
    // so the UI can be transparent about which path actually produced the output.
    const aiFallbackUsed = Boolean(useAI) && !aiGenerated

    const result: MagicScanResult = {
      campaignId: campaign.id,
      campaignName: campaign.name,
      currency: campaign.currency || 'USD',
      timestamp: Date.now(),
      problemTags,
      recommendations,
      aiGenerated,
      aiRequested: Boolean(useAI),
      aiFallbackUsed,
    }

    return NextResponse.json({ ok: true, data: result })
  } catch (error) {
    console.error('[Magic Scan] Error:', error)
    return NextResponse.json(
      { ok: false, error: 'server_error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
