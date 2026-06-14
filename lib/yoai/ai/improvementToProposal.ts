/* ──────────────────────────────────────────────────────────
   YoAlgoritma — ad_spec → FullAdProposal köprüsü (Faz 2)

   Geliştirme Kartı "Onayla" dendiğinde, ai_ad_improvements satırındaki
   ad_spec'i mevcut AdCreationWizard'ın beklediği FullAdProposal'a çevirir.
   Böylece kullanıcı MEVCUT önizleme→yayınlama akışıyla canlıya alır
   (Meta/Google entegrasyonuna dokunulmaz — mevcut create yolu kullanılır).
   ────────────────────────────────────────────────────────── */

import type { FullAdProposal } from '@/lib/yoai/adCreator'
import type { Platform } from '@/lib/yoai/analysisTypes'
import type { AdImprovementRow } from './improvementStore'
import type { AdSpec } from './types'

// ad_spec'in insan etiketli campaign_type'ını ('Engagement') geçerli Meta
// objective enum'una ('OUTCOME_ENGAGEMENT') çevirir — preflight aksi halde
// "uyumlu değil" der (issue 4). Google için campaign_type olduğu gibi kalır.
function toMetaObjective(campaignType: string, conversionGoal: string): string {
  const s = `${campaignType} ${conversionGoal}`.toLowerCase()
  if (/sale|satış|purchase|satın|conversion|dönüşüm/.test(s)) return 'OUTCOME_SALES'
  if (/lead|potansiyel|form/.test(s)) return 'OUTCOME_LEADS'
  if (/engagement|etkileşim|mesaj|messag|whatsapp|conversation|sohbet|instagram direct/.test(s)) return 'OUTCOME_ENGAGEMENT'
  if (/awareness|bilinirlik|reach|erişim/.test(s)) return 'OUTCOME_AWARENESS'
  if (/app|uygulama/.test(s)) return 'OUTCOME_APP_PROMOTION'
  return 'OUTCOME_TRAFFIC'
}

function toMetaDestination(objective: string, conversionGoal: string): string | undefined {
  const s = (conversionGoal || '').toLowerCase()
  if (objective === 'OUTCOME_ENGAGEMENT') {
    if (/whatsapp/.test(s)) return 'WHATSAPP'
    if (/instagram|direct/.test(s)) return 'INSTAGRAM_DIRECT'
    if (/messenger/.test(s)) return 'MESSENGER'
    if (/mesaj|messag|sohbet|conversation/.test(s)) return 'MESSENGER'
    return 'ON_PAGE'
  }
  if (objective === 'OUTCOME_LEADS') return /form/.test(s) ? 'ON_AD' : 'WEBSITE'
  return 'WEBSITE'
}

/** AI'nın Türkçe teklif etiketini Google BiddingStrategy enum'una çevirir (yalnız Google).
 *  Hedef değer gerektiren TARGET_CPA/TARGET_ROAS güvenli değilse (sayı yok) konservatif
 *  MAXIMIZE_CONVERSIONS'a düşer — sahte hedef bid kurmaz. */
function toGoogleBidding(label: string | undefined, conversionGoal: string): string | undefined {
  const s = `${label || ''} ${conversionGoal || ''}`.toLocaleLowerCase('tr')
  if (!label) {
    // Etiket yoksa dönüşüm hedefli kampanyada dönüşüm-maksimize daha doğru
    return /dönüş|satış|lead|potansiyel|conversion|sale/.test(s) ? 'MAXIMIZE_CONVERSIONS' : 'MAXIMIZE_CLICKS'
  }
  if (/tıklama|click|trafik|traffic/.test(s)) return 'MAXIMIZE_CLICKS'
  if (/dönüşüm değeri|roas/.test(s)) return 'MAXIMIZE_CONVERSIONS' // değer-temelli ama hedefsiz → güvenli
  if (/ebm|cpa/.test(s)) return 'MAXIMIZE_CONVERSIONS'            // hedef CPA sayısı yoksa güvenli alternatif
  if (/dönüşüm|conversion|satış|sale|lead|potansiyel/.test(s)) return 'MAXIMIZE_CONVERSIONS'
  if (/gösterim payı|impression share/.test(s)) return 'MAXIMIZE_CLICKS'
  return 'MAXIMIZE_CLICKS'
}

/** AI'nın kampanya türü etiketinden Google kanal türünü türetir. */
function toGoogleChannel(campaignType: string): string {
  const s = (campaignType || '').toLocaleLowerCase('tr')
  if (/performance max|pmax|maksimum performans/.test(s)) return 'PERFORMANCE_MAX'
  if (/görüntülü|display/.test(s)) return 'DISPLAY'
  if (/alışveriş|shopping/.test(s)) return 'SHOPPING'
  if (/video|youtube/.test(s)) return 'VIDEO'
  if (/demand gen|talep/.test(s)) return 'DEMAND_GEN'
  return 'SEARCH'
}

/** ad_spec.targeting → FullAdProposal.targeting (yapısal, yayına taşınır). */
function buildStructuredTargeting(t: AdSpec['targeting'] | undefined): FullAdProposal['targeting'] | undefined {
  if (!t) return undefined
  const out: NonNullable<FullAdProposal['targeting']> = {}
  if (Array.isArray(t.locations) && t.locations.length) out.locations = t.locations.filter(Boolean)
  if (t.demographics) {
    if (typeof t.demographics.age_min === 'number') out.ageMin = t.demographics.age_min
    if (typeof t.demographics.age_max === 'number') out.ageMax = t.demographics.age_max
    if (Array.isArray(t.demographics.genders) && t.demographics.genders.length) out.genders = t.demographics.genders
  }
  if (Array.isArray(t.interests) && t.interests.length) out.interests = t.interests.filter(Boolean)
  return Object.keys(out).length ? out : undefined
}

function buildTargetingDescription(t: AdSpec['targeting'] | undefined): string {
  if (!t) return '—'
  const parts: string[] = []
  if (t.locations?.length) parts.push(t.locations.join(', '))
  if (t.demographics) {
    const d = t.demographics
    parts.push(`${d.age_min}-${d.age_max} yaş`)
    if (d.genders?.length && !d.genders.includes('all')) {
      parts.push(d.genders.map((g) => (g === 'male' ? 'Erkek' : g === 'female' ? 'Kadın' : 'Tümü')).join('/'))
    }
  }
  if (t.interests?.length) parts.push(t.interests.slice(0, 3).join(', '))
  return parts.join(' · ') || '—'
}

export function improvementToProposal(row: AdImprovementRow): FullAdProposal | null {
  const payload = row.improvement_payload as {
    ad_spec?: AdSpec | null
    reasoning?: string
    competitor_comparison?: string | null
    confidence?: number
  }
  const spec = payload?.ad_spec
  if (!spec) return null

  const platform: Platform = spec.platform === 'google' ? 'Google' : 'Meta'
  const headlines = spec.creative?.headlines ?? []
  const descriptions = spec.creative?.descriptions ?? []

  // Meta için geçerli objective+destination enum'una eşle (preflight uyumu).
  // Google için campaign_type olduğu gibi (Google publish yolu farklı).
  const isMeta = platform === 'Meta'
  const campaignObjective = isMeta
    ? toMetaObjective(spec.campaign_type || '', spec.conversion_goal || '')
    : (spec.campaign_type || '')
  const destinationType = isMeta
    ? toMetaDestination(campaignObjective, spec.conversion_goal || '')
    : undefined

  return {
    id: `imp_${row.id}`,
    platform,
    sourceCampaignId: row.source_campaign_id ?? undefined,
    sourceCampaignName: row.source_campaign_name ?? undefined,
    proposalType: 'optimization',
    campaignName: row.source_campaign_name || spec.campaign_type || 'Kampanya',
    campaignObjective,
    objectiveLabel: spec.campaign_type || '',
    dailyBudget: spec.budget?.daily ?? 0,
    adsetName: row.source_ad_name ? `${row.source_ad_name} — iyileştirme` : 'Reklam Seti',
    targetingDescription: buildTargetingDescription(spec.targeting),
    // Yapısal hedefleme yayına taşınır (önizleme = yayın). Meta yaş/cinsiyet/ülke
    // doğrudan; Google lokasyonları create-ad'de geoTargetConstant'a çözülür.
    targeting: buildStructuredTargeting(spec.targeting),
    optimizationGoal: spec.conversion_goal || undefined,
    destinationType,
    // Google: AI teklif önerisi + kanal türü yayına taşınır (eskiden hep MAXIMIZE_CLICKS + SEARCH'e düşüyordu)
    biddingStrategy: !isMeta ? toGoogleBidding(spec.bidding_strategy, spec.conversion_goal || '') : undefined,
    advertisingChannelType: !isMeta ? toGoogleChannel(spec.campaign_type || '') : undefined,
    adName: row.source_ad_name ? `${row.source_ad_name} v2` : 'Yeni Reklam',
    primaryText: spec.creative?.primary_text || descriptions[0] || '',
    headline: headlines[0] || '',
    description: descriptions[0] || '',
    callToAction: spec.cta || '',
    headlines: headlines.length ? headlines : undefined,
    descriptions: descriptions.length ? descriptions : undefined,
    // Google Arama Ağı: AI'nın önerdiği anahtar kelimeler yayına aktarılır
    // (boşsa create-ad keyword'süz kampanya kurar → serve etmez).
    keywords: !isMeta && spec.targeting?.keywords?.length ? spec.targeting.keywords : undefined,
    reasoning: payload?.reasoning || '',
    competitorInsight: payload?.competitor_comparison || '',
    expectedPerformance: '',
    confidence: row.confidence ?? payload?.confidence ?? 0,
    impactLevel: 'high',
    isNewObjective: false,
    analyzedParameters: [],
    suggestedChanges: [],
  }
}
