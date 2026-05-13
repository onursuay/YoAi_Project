/* ──────────────────────────────────────────────────────────
   YoAi — Business Intelligence Builder

   Profile + competitors + scan çıktıları + sektör/lokasyon
   intelligence'ı birleştirip user_business_intelligence row'u
   üretir. Deterministik — LLM'siz çalışır; LLM ileride additive
   olarak bağlanabilir.
   ────────────────────────────────────────────────────────── */

import type {
  BusinessProfileRow,
  BusinessCompetitorRow,
  BusinessSourceScanRow,
  BusinessIntelligenceRow,
} from './businessProfileStore'
import { buildSectorLocationInsight } from './sectorLocationIntelligence'

function uniq(arr: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const v of arr) {
    const key = (v || '').trim()
    if (!key) continue
    if (seen.has(key.toLowerCase())) continue
    seen.add(key.toLowerCase())
    out.push(key)
  }
  return out
}

function summarizeOwnSources(scans: BusinessSourceScanRow[]): {
  services: string[]
  products: string[]
  ctas: string[]
  offers: string[]
  keywords: string[]
  brand_tones: string[]
  proofs: string[]
  locations: string[]
  titles: string[]
} {
  const own = scans.filter((s) => s.source_owner_type === 'own_brand' && s.scan_status === 'completed')
  return {
    services: uniq(own.flatMap((s) => s.extracted_services || [])).slice(0, 12),
    products: uniq(own.flatMap((s) => s.extracted_products || [])).slice(0, 12),
    ctas: uniq(own.flatMap((s) => s.extracted_ctas || [])).slice(0, 8),
    offers: uniq(own.flatMap((s) => s.extracted_offers || [])).slice(0, 8),
    keywords: uniq(own.flatMap((s) => s.extracted_keywords || [])).slice(0, 25),
    brand_tones: uniq(own.map((s) => s.extracted_brand_tone || '').filter(Boolean)).slice(0, 4),
    proofs: uniq(own.map((s) => s.extracted_social_proof || '').filter(Boolean)).slice(0, 4),
    locations: uniq(own.flatMap((s) => s.extracted_locations || [])).slice(0, 8),
    titles: uniq(own.map((s) => s.extracted_title || '').filter(Boolean)).slice(0, 6),
  }
}

function summarizeCompetitorSources(scans: BusinessSourceScanRow[]): {
  competitor_keywords: string[]
  competitor_offers: string[]
  competitor_ctas: string[]
} {
  const comp = scans.filter((s) => s.source_owner_type === 'competitor' && s.scan_status === 'completed')
  return {
    competitor_keywords: uniq(comp.flatMap((s) => s.extracted_keywords || [])).slice(0, 25),
    competitor_offers: uniq(comp.flatMap((s) => s.extracted_offers || [])).slice(0, 10),
    competitor_ctas: uniq(comp.flatMap((s) => s.extracted_ctas || [])).slice(0, 10),
  }
}

function buildCompetitorPositioning(
  competitors: BusinessCompetitorRow[],
  scans: BusinessSourceScanRow[],
): string {
  if (competitors.length === 0) return 'Rakip referansı yok.'
  const lines: string[] = []
  for (const c of competitors.slice(0, 5)) {
    const cScans = scans.filter((s) => s.competitor_id === c.id)
    const completed = cScans.filter((s) => s.scan_status === 'completed').length
    lines.push(
      `${c.competitor_name} (${cScans.length} kaynak; ${completed} taranmış)` +
        (c.website_url ? ` — ${c.website_url}` : ''),
    )
  }
  return lines.join('. ')
}

function computeConfidence(parts: {
  hasProfile: boolean
  competitorCount: number
  ownCompletedScans: number
  competitorCompletedScans: number
  sectorConfidence: number
}): number {
  let conf = 10
  if (parts.hasProfile) conf += 25
  conf += Math.min(20, parts.competitorCount * 5)
  conf += Math.min(20, parts.ownCompletedScans * 5)
  conf += Math.min(15, parts.competitorCompletedScans * 3)
  conf += Math.round((parts.sectorConfidence || 0) * 0.1)
  return Math.min(100, conf)
}

export function buildBusinessIntelligenceRow(
  profile: BusinessProfileRow,
  competitors: BusinessCompetitorRow[],
  scans: BusinessSourceScanRow[],
): Omit<BusinessIntelligenceRow, 'id' | 'created_at' | 'updated_at' | 'last_generated_at'> {
  const sector = buildSectorLocationInsight({
    sector_main_id: profile.sector_main,
    sector_sub_id: profile.sector_sub,
    target_locations: profile.target_locations,
  })

  const own = summarizeOwnSources(scans)
  const comp = summarizeCompetitorSources(scans)
  const positioning = buildCompetitorPositioning(competitors, scans)

  const ownCompletedScans = scans.filter(
    (s) => s.source_owner_type === 'own_brand' && s.scan_status === 'completed',
  ).length
  const competitorCompletedScans = scans.filter(
    (s) => s.source_owner_type === 'competitor' && s.scan_status === 'completed',
  ).length

  const confidence = computeConfidence({
    hasProfile: true,
    competitorCount: competitors.length,
    ownCompletedScans,
    competitorCompletedScans,
    sectorConfidence: sector.confidence,
  })

  const missingData: string[] = []
  if (ownCompletedScans === 0) missingData.push('no_own_brand_scan_completed')
  if (competitorCompletedScans === 0) missingData.push('no_competitor_scan_completed')
  if (!profile.business_description) missingData.push('no_business_description')
  if (!profile.target_audience) missingData.push('no_target_audience')
  if (competitors.length < 3) missingData.push('less_than_3_competitors')
  if (sector.confidence < 50) missingData.push('low_sector_confidence')

  const sourceCoverage: Record<string, unknown> = {
    own_brand: {
      total: scans.filter((s) => s.source_owner_type === 'own_brand').length,
      completed: ownCompletedScans,
    },
    competitor: {
      total: scans.filter((s) => s.source_owner_type === 'competitor').length,
      completed: competitorCompletedScans,
    },
  }

  const companySummary = [
    `${profile.company_name}`,
    profile.business_description ? `— ${profile.business_description}` : '',
    profile.target_audience ? `Hedef kitle: ${profile.target_audience}.` : '',
    profile.target_locations && profile.target_locations.length > 0
      ? `Lokasyon: ${profile.target_locations.join(', ')}.`
      : '',
  ]
    .filter(Boolean)
    .join(' ')
    .trim()

  const businessModel =
    profile.products_or_services && profile.products_or_services.length > 0
      ? `Ürün/Hizmet odaklı: ${profile.products_or_services.slice(0, 5).join(', ')}.`
      : sector.sector_summary

  const localMarketSummary = sector.location_expectations

  const servicesSummary = own.services.length > 0
    ? own.services.slice(0, 6).join(' | ')
    : (profile.products_or_services || []).slice(0, 6).join(' | ') || 'Hizmet detayı tarama bulunamadı.'

  const productsSummary = own.products.length > 0 ? own.products.slice(0, 6).join(' | ') : 'Ürün detayı tarama bulunamadı.'

  const targetAudienceSummary = profile.target_audience
    ? profile.target_audience
    : sector.audience_types.join('; ')

  const conversionGoalSummary = profile.main_conversion_goal
    ? `Ana dönüşüm hedefi: ${profile.main_conversion_goal}.`
    : 'Ana dönüşüm hedefi belirtilmedi.'

  const competitorSummary = competitors.length > 0
    ? `${competitors.length} rakip referansı kayıtlı. Öne çıkan rakip kelimeler: ${comp.competitor_keywords.slice(0, 8).join(', ') || '—'}.`
    : 'Rakip referansı yok.'

  const brandPositioning = own.brand_tones[0]
    ? `Tarama temelli ton: ${own.brand_tones[0]}. ` + (profile.brand_tone ? `Beyan edilen ton: ${profile.brand_tone}.` : '')
    : profile.brand_tone || ''

  return {
    user_id: profile.user_id,
    profile_id: profile.id || '',
    company_summary: companySummary || null,
    business_model: businessModel,
    sector_summary: sector.sector_summary,
    local_market_summary: localMarketSummary,
    services_summary: servicesSummary,
    products_summary: productsSummary,
    target_audience_summary: targetAudienceSummary,
    conversion_goal_summary: conversionGoalSummary,
    competitor_summary: competitorSummary,
    competitor_positioning_summary: positioning,
    keyword_themes: uniq([
      ...sector.keyword_themes,
      ...own.keywords,
      ...(profile.keywords || []),
    ]).slice(0, 30),
    recommended_google_campaign_types: sector.recommended_google_campaign_types,
    recommended_meta_objectives: sector.recommended_meta_objectives,
    recommended_content_angles: uniq([
      ...sector.ad_promises,
      ...own.offers,
    ]).slice(0, 10),
    recommended_offer_angles: uniq([...own.offers, ...comp.competitor_offers]).slice(0, 10),
    risk_claims: sector.risk_claims,
    forbidden_claims: profile.forbidden_claims || [],
    brand_positioning: brandPositioning || null,
    audience_pains: sector.customer_needs,
    audience_motivations: sector.purchase_motivations,
    location_insights: sector.location_expectations,
    source_coverage: sourceCoverage,
    confidence,
    missing_data: missingData,
  }
}
