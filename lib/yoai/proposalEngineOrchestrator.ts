/* ──────────────────────────────────────────────────────────
   YoAlgoritma — Proposal Engine Orchestrator

   Intent Engine + Competitor Query Expander çıktılarını
   proposal üretiminden önce tek yapılandırılmış context'e toplar.

   Görev:
   1. Intent profiles — kampanya başına (7 gün cache'li)
   2. Competitor query plans — platform-specific, kampanya başına
   3. Diagnostics — eksik veri sebepleri dahil

   Bağımsız katman: official knowledge, synthesis packages ve
   multi-AI desk adCreator.ts / route.ts içinde yönetilir.

   Hata durumunda sistem kırılmaz; diagnostics.fallbackUsed
   true olur, ilgili map boş döner.
   ────────────────────────────────────────────────────────── */

import type { DeepCampaignInsight, Platform } from './analysisTypes'
import { buildIntentProfilesForCampaigns } from './campaignIntentEngine'
import type { CampaignIntentProfile } from './campaignIntentEngine'
import { expandCompetitorQueries } from './competitorQueryExpander'
import type { CompetitorQueryPlan } from './competitorQueryExpander'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface EngineContextDiagnostics {
  intentProfilesBuilt: number
  lowConfidenceIntentCount: number      // intent confidence < 40
  competitorQueryPlansBuilt: number
  queryPlanConfidenceLow: number        // query plan confidence < 50
  fallbackUsed: boolean                 // true if any step failed gracefully
}

export interface ProposalEngineContext {
  platform: Platform
  intentProfilesByCampaignId: Record<string, CampaignIntentProfile>
  competitorQueryPlansByCampaignId: Record<string, CompetitorQueryPlan>
  diagnostics: EngineContextDiagnostics
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function collectCreativeTexts(campaign: DeepCampaignInsight): string[] {
  return campaign.adsets.flatMap((a) =>
    a.ads.flatMap((ad) =>
      [ad.creativeBody, ad.creativeTitle].filter((t): t is string => Boolean(t)),
    ),
  )
}

// ── Main Entry ────────────────────────────────────────────────────────────────

export async function buildProposalEngineContext(params: {
  userId: string | null
  platform: Platform
  /** All campaigns for the target platform (active + paused — engine filters active internally). */
  platformCampaigns: DeepCampaignInsight[]
  /** Business Intelligence Profile keywords (kullanıcı işletme bağlamı). */
  businessKeywords?: string[]
}): Promise<ProposalEngineContext> {
  const { userId, platform, platformCampaigns, businessKeywords } = params

  const activeCampaigns = platformCampaigns.filter(
    (c) => c.status === 'ACTIVE' || c.status === 'ENABLED',
  )

  const diagnostics: EngineContextDiagnostics = {
    intentProfilesBuilt: 0,
    lowConfidenceIntentCount: 0,
    competitorQueryPlansBuilt: 0,
    queryPlanConfidenceLow: 0,
    fallbackUsed: false,
  }

  // ── 1. Intent profiles ─────────────────────────────────────────────────────
  let intentProfilesByCampaignId: Record<string, CampaignIntentProfile> = {}

  try {
    const intentResult = await buildIntentProfilesForCampaigns(activeCampaigns, { userId })
    intentProfilesByCampaignId = intentResult.profileMap
    diagnostics.intentProfilesBuilt = intentResult.count
    diagnostics.lowConfidenceIntentCount = Object.values(intentResult.profileMap).filter(
      (p) => p.confidence < 40,
    ).length

    if (intentResult.warnings.length > 0) {
      console.warn(
        `[ProposalEngineOrchestrator] ${platform} intent warnings (${intentResult.warnings.length}):`,
        intentResult.warnings.slice(0, 3),
      )
    }
  } catch (e) {
    console.warn('[ProposalEngineOrchestrator] Intent profiles failed (non-fatal):', e)
    diagnostics.fallbackUsed = true
  }

  // ── 2. Competitor query plans (platform-specific, parallel) ────────────────
  // Platform key matches CompetitorQueryPlan.platform type.
  // Google proposal → 'google' queries only.
  // Meta proposal → 'meta' queries only.
  // Platforms never cross.
  const platformKey: 'google' | 'meta' = platform === 'Google' ? 'google' : 'meta'
  const competitorQueryPlansByCampaignId: Record<string, CompetitorQueryPlan> = {}

  if (activeCampaigns.length > 0) {
    const planTasks = activeCampaigns.map(async (campaign) => {
      const plan = await expandCompetitorQueries({
        platform: platformKey,
        intentProfile: intentProfilesByCampaignId[campaign.id] ?? null,
        campaignName: campaign.campaignName,
        adGroupNames: campaign.adsets.map((a) => a.name),
        creativeTexts: collectCreativeTexts(campaign),
        keywordList: Array.isArray(businessKeywords) ? businessKeywords.slice(0, 25) : [],
      })
      return { campaignId: campaign.id, plan }
    })

    const settled = await Promise.allSettled(planTasks)

    for (const res of settled) {
      if (res.status === 'fulfilled') {
        const { campaignId, plan } = res.value
        competitorQueryPlansByCampaignId[campaignId] = plan
        if (plan.confidence < 50) diagnostics.queryPlanConfidenceLow++
      } else {
        console.warn(
          '[ProposalEngineOrchestrator] Query plan task failed (non-fatal):',
          res.reason,
        )
        diagnostics.fallbackUsed = true
      }
    }

    diagnostics.competitorQueryPlansBuilt = Object.keys(competitorQueryPlansByCampaignId).length
  }

  console.log(
    `[ProposalEngineOrchestrator] ${platform}: intent=${diagnostics.intentProfilesBuilt} ` +
      `queryPlans=${diagnostics.competitorQueryPlansBuilt} ` +
      `lowConfidenceIntent=${diagnostics.lowConfidenceIntentCount} ` +
      `queryPlanConfidenceLow=${diagnostics.queryPlanConfidenceLow}`,
  )

  return {
    platform,
    intentProfilesByCampaignId,
    competitorQueryPlansByCampaignId,
    diagnostics,
  }
}
