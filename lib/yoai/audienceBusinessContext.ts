/* ──────────────────────────────────────────────────────────
   YoAi — Audience Business Context

   Hedef Kitle (audience) generator/UI'lar için Business
   Intelligence Memory'yi runtime context'e dönüştürür.

   Şu an Hedef Kitle alanında AI-driven persona generator yok;
   bu nedenle bu modül "AI generator ready" bir context interface
   sağlar. UI/API bu context'i okuyarak:
     • Kullanıcıya hangi business sinyallerinin kullanılabilir
       olduğunu (sector, location, audience pains, motivations)
       gösterir
     • İleride bağlanacak AI persona generator için stabil bir
       input şekli sunar (audienceSeedHints)
   ────────────────────────────────────────────────────────── */

import type { BusinessContext } from './businessContextStore'

export interface AudienceSeedHints {
  sectorMain: string | null
  sectorSub: string | null
  sectorLabel: string | null
  primaryLocations: string[]
  audiencePains: string[]
  audienceMotivations: string[]
  audienceTypes: string[]
  keywordThemes: string[]
  brandTone: string | null
  productsOrServices: string[]
  mainConversionGoal: string | null
  declaredTargetAudience: string | null
  recommendedMetaObjectives: string[]
  recommendedGoogleCampaignTypes: string[]
}

export interface AudienceBusinessContextRuntime {
  businessContextLoaded: boolean
  locked: boolean
  lockedReason: string | null
  businessContextConfidence: number
  sector: string | null
  sectorLabel: string | null
  location: string[]
  sourceCoverage: BusinessContext['diagnostic']['sourceCoverage']
  competitorCount: number
  hasIntelligenceMemory: boolean
  missingData: string[]
  audienceSeedHints: AudienceSeedHints
  /** Insan-okunabilir özet, UI'da banner olarak gösterilebilir. */
  summaryText: string
}

const EMPTY_SEED: AudienceSeedHints = {
  sectorMain: null,
  sectorSub: null,
  sectorLabel: null,
  primaryLocations: [],
  audiencePains: [],
  audienceMotivations: [],
  audienceTypes: [],
  keywordThemes: [],
  brandTone: null,
  productsOrServices: [],
  mainConversionGoal: null,
  declaredTargetAudience: null,
  recommendedMetaObjectives: [],
  recommendedGoogleCampaignTypes: [],
}

function buildSummary(ctx: BusinessContext): string {
  if (ctx.locked) {
    return ctx.lockedReason === 'no_business_profile'
      ? 'Business profili henüz oluşturulmamış. Hedef Kitle önerileri için önce işletme profilini tamamlayın.'
      : 'Onboarding tamamlanmadan Hedef Kitle context yüklenemez.'
  }
  const parts: string[] = []
  if (ctx.sectorLabel) parts.push(`Sektör: ${ctx.sectorLabel}`)
  if (ctx.targetLocations.length > 0) parts.push(`Lokasyon: ${ctx.targetLocations.slice(0, 3).join(', ')}`)
  if (ctx.intelligenceMemory?.target_audience_summary) {
    parts.push(`Hedef kitle özeti: ${ctx.intelligenceMemory.target_audience_summary.slice(0, 160)}`)
  } else if (ctx.profile?.target_audience) {
    parts.push(`Beyan edilen hedef kitle: ${ctx.profile.target_audience.slice(0, 160)}`)
  }
  if (ctx.intelligenceMemory?.audience_motivations && ctx.intelligenceMemory.audience_motivations.length > 0) {
    parts.push(`Motivasyonlar: ${ctx.intelligenceMemory.audience_motivations.slice(0, 4).join(', ')}`)
  }
  if (parts.length === 0) return 'Business intelligence memory yüklendi ancak yeterli sinyal yok.'
  return parts.join(' • ')
}

/**
 * Pure builder — BusinessContext'i runtime audience context'e dönüştürür.
 * Test edilebilir; supabase bağımlılığı yok.
 */
export function buildAudienceContextFromBusiness(
  ctx: BusinessContext,
): AudienceBusinessContextRuntime {
  if (ctx.locked || !ctx.profile) {
    return {
      businessContextLoaded: false,
      locked: true,
      lockedReason: ctx.lockedReason,
      businessContextConfidence: ctx.diagnostic.confidence,
      sector: ctx.profile?.sector_main || null,
      sectorLabel: ctx.sectorLabel,
      location: ctx.targetLocations,
      sourceCoverage: ctx.diagnostic.sourceCoverage,
      competitorCount: ctx.diagnostic.competitorCount,
      hasIntelligenceMemory: ctx.diagnostic.hasIntelligence,
      missingData: ctx.diagnostic.missingData,
      audienceSeedHints: { ...EMPTY_SEED },
      summaryText: buildSummary(ctx),
    }
  }

  const im = ctx.intelligenceMemory
  const sectorInsight = ctx.sectorInsight

  const seed: AudienceSeedHints = {
    sectorMain: ctx.profile.sector_main,
    sectorSub: ctx.profile.sector_sub,
    sectorLabel: ctx.sectorLabel,
    primaryLocations: ctx.targetLocations,
    audiencePains: im?.audience_pains || sectorInsight?.customer_needs || [],
    audienceMotivations: im?.audience_motivations || sectorInsight?.purchase_motivations || [],
    audienceTypes: sectorInsight?.audience_types || [],
    keywordThemes: im?.keyword_themes || ctx.keywords || [],
    brandTone: ctx.brandTone,
    productsOrServices: ctx.productsOrServices,
    mainConversionGoal: ctx.mainConversionGoal,
    declaredTargetAudience: ctx.profile.target_audience,
    recommendedMetaObjectives:
      im?.recommended_meta_objectives || sectorInsight?.recommended_meta_objectives || [],
    recommendedGoogleCampaignTypes:
      im?.recommended_google_campaign_types || sectorInsight?.recommended_google_campaign_types || [],
  }

  return {
    businessContextLoaded: true,
    locked: false,
    lockedReason: null,
    businessContextConfidence: ctx.diagnostic.confidence,
    sector: ctx.profile.sector_main,
    sectorLabel: ctx.sectorLabel,
    location: ctx.targetLocations,
    sourceCoverage: ctx.diagnostic.sourceCoverage,
    competitorCount: ctx.diagnostic.competitorCount,
    hasIntelligenceMemory: ctx.diagnostic.hasIntelligence,
    missingData: ctx.diagnostic.missingData,
    audienceSeedHints: seed,
    summaryText: buildSummary(ctx),
  }
}

/**
 * Runtime wrapper — Supabase üzerinden business context'i çekip
 * runtime audience context'e dönüştürür. API route'ları bunu kullanır.
 * Test ortamında supabase yoksa locked context döner.
 */
export async function getAudienceBusinessContext(
  userId: string | null | undefined,
): Promise<AudienceBusinessContextRuntime> {
  // Dynamic import — supabase ('server-only') sadece runtime'da yüklensin;
  // pure builder testleri bu modülü direkt import edebilsin.
  const { getBusinessContextForUser } = await import('./businessContextStore')
  const ctx = await getBusinessContextForUser(userId)
  return buildAudienceContextFromBusiness(ctx)
}
