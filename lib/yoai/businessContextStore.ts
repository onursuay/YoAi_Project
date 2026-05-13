/* ──────────────────────────────────────────────────────────
   YoAi — Business Context Store

   Tüm üretim motorları (YoAlgoritma, Strateji, Hedef Kitle,
   Competitor Query Expander, Campaign Intent Engine) için tek
   giriş noktası. Profil + competitors + scan kayıtları + sektör
   intelligence + intelligence memory'yi birleştirir.

   Kural:
     • Business context yoksa lock context döner (locked=true)
     • Düşük confidence olsa bile üretim devam edebilir
     • Diagnostic alan her zaman doldurulur
   ────────────────────────────────────────────────────────── */

import {
  getProfileByUserId,
  listCompetitors,
  listSourceScansForProfile,
  getIntelligenceByUserId,
  type BusinessProfileRow,
  type BusinessCompetitorRow,
  type BusinessSourceScanRow,
  type BusinessIntelligenceRow,
} from './businessProfileStore'
import {
  buildSectorLocationInsight,
  type SectorLocationInsight,
} from './sectorLocationIntelligence'
import { getSectorLabel } from './sectorCatalog'

export interface BusinessContextDiagnostic {
  hasProfile: boolean
  onboardingCompleted: boolean
  hasIntelligence: boolean
  intelligenceStale: boolean
  sourceCoverage: {
    own_brand_total: number
    own_brand_completed: number
    competitor_total: number
    competitor_completed: number
  }
  competitorCount: number
  missingData: string[]
  confidence: number
  source: 'profile_only' | 'profile_with_intelligence' | 'no_profile'
}

export interface BusinessContext {
  userId: string
  locked: boolean
  lockedReason: string | null

  profile: BusinessProfileRow | null
  competitors: BusinessCompetitorRow[]
  sourceScans: BusinessSourceScanRow[]
  intelligenceMemory: BusinessIntelligenceRow | null
  sectorInsight: SectorLocationInsight | null

  // Promoted convenience fields (for prompt-time injection)
  companyName: string | null
  sectorLabel: string | null
  targetLocations: string[]
  brandTone: string | null
  forbiddenClaims: string[]
  keywords: string[]
  productsOrServices: string[]
  mainConversionGoal: string | null

  diagnostic: BusinessContextDiagnostic
}

const EMPTY_DIAG: BusinessContextDiagnostic = {
  hasProfile: false,
  onboardingCompleted: false,
  hasIntelligence: false,
  intelligenceStale: false,
  sourceCoverage: {
    own_brand_total: 0,
    own_brand_completed: 0,
    competitor_total: 0,
    competitor_completed: 0,
  },
  competitorCount: 0,
  missingData: ['no_business_profile'],
  confidence: 0,
  source: 'no_profile',
}

function computeSourceCoverage(scans: BusinessSourceScanRow[]) {
  const own = scans.filter((s) => s.source_owner_type === 'own_brand')
  const comp = scans.filter((s) => s.source_owner_type === 'competitor')
  return {
    own_brand_total: own.length,
    own_brand_completed: own.filter((s) => s.scan_status === 'completed').length,
    competitor_total: comp.length,
    competitor_completed: comp.filter((s) => s.scan_status === 'completed').length,
  }
}

function buildMissingData(
  profile: BusinessProfileRow | null,
  competitors: BusinessCompetitorRow[],
  intelligence: BusinessIntelligenceRow | null,
): string[] {
  const missing: string[] = []
  if (!profile) {
    missing.push('no_business_profile')
    return missing
  }
  if (!profile.onboarding_completed) missing.push('onboarding_incomplete')
  if (!profile.business_description) missing.push('no_business_description')
  if (!profile.main_conversion_goal) missing.push('no_main_conversion_goal')
  if (!profile.target_locations || profile.target_locations.length === 0) missing.push('no_target_locations')
  if (competitors.length < 3) missing.push('less_than_3_competitors')
  if (!intelligence) missing.push('no_intelligence_memory')
  if (intelligence && intelligence.confidence < 40) missing.push('low_intelligence_confidence')
  return missing
}

export async function getBusinessContextForUser(
  userId: string | null | undefined,
): Promise<BusinessContext> {
  if (!userId) {
    return {
      userId: '',
      locked: true,
      lockedReason: 'no_user',
      profile: null,
      competitors: [],
      sourceScans: [],
      intelligenceMemory: null,
      sectorInsight: null,
      companyName: null,
      sectorLabel: null,
      targetLocations: [],
      brandTone: null,
      forbiddenClaims: [],
      keywords: [],
      productsOrServices: [],
      mainConversionGoal: null,
      diagnostic: { ...EMPTY_DIAG, missingData: ['no_user'] },
    }
  }

  const profile = await getProfileByUserId(userId)

  if (!profile) {
    return {
      userId,
      locked: true,
      lockedReason: 'no_business_profile',
      profile: null,
      competitors: [],
      sourceScans: [],
      intelligenceMemory: null,
      sectorInsight: null,
      companyName: null,
      sectorLabel: null,
      targetLocations: [],
      brandTone: null,
      forbiddenClaims: [],
      keywords: [],
      productsOrServices: [],
      mainConversionGoal: null,
      diagnostic: { ...EMPTY_DIAG },
    }
  }

  const [competitors, sourceScans, intelligence] = await Promise.all([
    listCompetitors(userId),
    profile.id ? listSourceScansForProfile(profile.id) : Promise.resolve<BusinessSourceScanRow[]>([]),
    getIntelligenceByUserId(userId),
  ])

  const sectorInsight = buildSectorLocationInsight({
    sector_main_id: profile.sector_main,
    sector_sub_id: profile.sector_sub,
    target_locations: profile.target_locations,
  })

  const sourceCoverage = computeSourceCoverage(sourceScans)
  const missingData = buildMissingData(profile, competitors, intelligence)

  const baseConfidence = profile.profile_confidence || 0
  const intelConfidence = intelligence?.confidence || 0
  const confidence = Math.min(100, Math.max(baseConfidence, Math.round((baseConfidence + intelConfidence) / 2)))

  const locked = !profile.onboarding_completed
  const lockedReason = locked ? 'onboarding_incomplete' : null

  return {
    userId,
    locked,
    lockedReason,
    profile,
    competitors,
    sourceScans,
    intelligenceMemory: intelligence,
    sectorInsight,
    companyName: profile.company_name,
    sectorLabel: profile.sector_main ? getSectorLabel(profile.sector_main, profile.sector_sub) : null,
    targetLocations: profile.target_locations || [],
    brandTone: profile.brand_tone,
    forbiddenClaims: profile.forbidden_claims || [],
    keywords: profile.keywords || [],
    productsOrServices: profile.products_or_services || [],
    mainConversionGoal: profile.main_conversion_goal,
    diagnostic: {
      hasProfile: true,
      onboardingCompleted: profile.onboarding_completed,
      hasIntelligence: !!intelligence,
      intelligenceStale: profile.intelligence_status === 'stale',
      sourceCoverage,
      competitorCount: competitors.length,
      missingData,
      confidence,
      source: intelligence ? 'profile_with_intelligence' : 'profile_only',
    },
  }
}

/**
 * Prompt time inline summary for AI generators.
 * Returns null if context is locked / no profile.
 */
export function buildBusinessContextPromptBlock(ctx: BusinessContext): string | null {
  if (!ctx.profile) return null
  const lines: string[] = []
  lines.push('## İşletme Bağlamı (YoAi Business Memory)')
  lines.push(`- Firma: ${ctx.companyName || '—'}`)
  if (ctx.sectorLabel) lines.push(`- Sektör: ${ctx.sectorLabel}`)
  if (ctx.profile.business_description) lines.push(`- Faaliyet: ${ctx.profile.business_description}`)
  if (ctx.targetLocations.length > 0) lines.push(`- Hedef Lokasyon: ${ctx.targetLocations.join(', ')}`)
  if (ctx.mainConversionGoal) lines.push(`- Ana Dönüşüm Hedefi: ${ctx.mainConversionGoal}`)
  if (ctx.profile.target_audience) lines.push(`- Hedef Kitle: ${ctx.profile.target_audience}`)
  if (ctx.brandTone) lines.push(`- Marka Dili: ${ctx.brandTone}`)
  if (ctx.keywords.length > 0) lines.push(`- Anahtar Kelimeler: ${ctx.keywords.slice(0, 12).join(', ')}`)
  if (ctx.productsOrServices.length > 0) lines.push(`- Ürün/Hizmet: ${ctx.productsOrServices.slice(0, 8).join(', ')}`)
  if (ctx.forbiddenClaims.length > 0) lines.push(`- Yasak İddialar: ${ctx.forbiddenClaims.slice(0, 6).join(', ')}`)

  if (ctx.sectorInsight) {
    lines.push('')
    lines.push('### Sektör/Lokasyon Çıkarımı')
    lines.push(`- Sektör Özet: ${ctx.sectorInsight.sector_summary}`)
    lines.push(`- Müşteri İhtiyaçları: ${ctx.sectorInsight.customer_needs.join(', ')}`)
    lines.push(`- Satın Alma Motivasyonları: ${ctx.sectorInsight.purchase_motivations.join(', ')}`)
    lines.push(`- Lokasyon Beklentisi: ${ctx.sectorInsight.location_expectations}`)
    lines.push(`- Önerilen Google Kampanya: ${ctx.sectorInsight.recommended_google_campaign_types.join(', ')}`)
    lines.push(`- Önerilen Meta Objective: ${ctx.sectorInsight.recommended_meta_objectives.join(', ')}`)
  }

  if (ctx.intelligenceMemory) {
    const im = ctx.intelligenceMemory
    lines.push('')
    lines.push('### YoAi Intelligence Memory')
    if (im.company_summary) lines.push(`- Firma Özet: ${im.company_summary}`)
    if (im.target_audience_summary) lines.push(`- Hedef Kitle Özet: ${im.target_audience_summary}`)
    if (im.competitor_summary) lines.push(`- Rakip Özet: ${im.competitor_summary}`)
    if (im.brand_positioning) lines.push(`- Marka Konumlandırma: ${im.brand_positioning}`)
    if (im.recommended_content_angles.length > 0) {
      lines.push(`- İçerik Açıları: ${im.recommended_content_angles.slice(0, 5).join(', ')}`)
    }
  }

  if (ctx.competitors.length > 0) {
    lines.push('')
    lines.push('### Bilinen Rakipler')
    for (const c of ctx.competitors.slice(0, 5)) {
      const refs = [c.website_url, c.instagram_url, c.facebook_url].filter(Boolean).join(' | ') || '—'
      lines.push(`- ${c.competitor_name}: ${refs}`)
    }
  }

  return lines.join('\n')
}
