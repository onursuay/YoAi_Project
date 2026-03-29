/* ──────────────────────────────────────────────────────────
   AI Ad Creator — v4 (Objective-Aware Decision Engine)

   Karar motoru mantığı:
   1. Kullanıcının aktif reklamlarını oku
   2. Her reklamın kampanya amacını tespit et
   3. Alt parametreleri analiz et (dönüşüm hedefi, teklif, hedefleme, lokasyon, bütçe, kreatif)
   4. Platform çalışma mantığıyla kıyasla: "Bu amaç için doğru kurulmuş mu?"
   5. Mevcut reklam uygunluk analizi çıkar (güçlü/zayıf alanlar)
   6. Aynı kampanya amacına karşılık gelen daha güçlü AI kampanya yapısı öner
   ────────────────────────────────────────────────────────── */

import type { DeepCampaignInsight, Platform, StructuralIssue } from './analysisTypes'
import type { UserAdProfile, CompetitorComparison, CompetitorAd } from './competitorAnalyzer'

/* ── Types ── */

// Analysis of a single active campaign against its objective
export interface CampaignFitAnalysis {
  campaignId: string
  campaignName: string
  platform: Platform
  objective: string
  objectiveLabel: string
  // Fit assessment
  fitScore: number // 0-100: how well the campaign is set up for its objective
  strengths: string[]
  weaknesses: string[]
  // Current parameters
  currentParams: {
    destination?: string
    optimizationGoal?: string
    biddingStrategy?: string
    dailyBudget: number | null
    adsetCount: number
    adCount: number
    ctr: number
    cpc: number
    conversions: number
    roas: number | null
    spend: number
  }
  // Optimization suggestions for THIS campaign
  optimizationSuggestions: string[]
}

// Full AI campaign proposal (same objective, better structure)
export interface FullAdProposal {
  id: string
  platform: Platform
  // Which existing campaign this improves upon
  sourceCampaignId?: string
  sourceCampaignName?: string
  proposalType: 'optimization' | 'new_campaign' // optimization = same objective improvement, new = new objective suggestion
  // Campaign level
  campaignName: string
  campaignObjective: string
  objectiveLabel: string
  dailyBudget: number
  // Ad Set / Ad Group level
  adsetName: string
  targetingDescription: string
  optimizationGoal?: string
  destinationType?: string
  biddingStrategy?: string
  // Ad level
  adName: string
  primaryText: string
  headline: string
  description: string
  callToAction: string
  // Google RSA
  headlines?: string[]
  descriptions?: string[]
  finalUrl?: string
  keywords?: string[]
  // Decision context
  reasoning: string           // why this structure was chosen
  competitorInsight: string   // what competitors do differently
  expectedPerformance: string // expected CTR, CPC
  confidence: number          // 0-100
  isNewObjective: boolean
  // What was analyzed to produce this
  analyzedParameters: string[] // list of parameters that were considered
  suggestedChanges: string[]   // specific changes vs current setup
}

export interface AdCreationResult {
  fitAnalyses: CampaignFitAnalysis[]
  proposals: FullAdProposal[]
  summary: {
    totalCampaignsAnalyzed: number
    criticalIssues: number
    opportunities: number
    proposalsGenerated: number
    metaCount: number
    googleCount: number
  }
  aiGenerated: boolean
  error?: string
}

/* ── Platform Knowledge (inline — references docs/*.md) ── */

const META_OBJECTIVE_KNOWLEDGE: Record<string, {
  label: string
  purpose: string
  bestDestinations: string[]
  bestOptGoals: string[]
  idealCTAs: string[]
  minBudget: number
  ctrBenchmark: number
  keyMetrics: string[]
}> = {
  OUTCOME_TRAFFIC: {
    label: 'Trafik',
    purpose: 'Web sitesine veya uygulamaya trafik çekmek',
    bestDestinations: ['WEBSITE', 'APP'],
    bestOptGoals: ['LANDING_PAGE_VIEWS', 'LINK_CLICKS'],
    idealCTAs: ['LEARN_MORE', 'SHOP_NOW'],
    minBudget: 35, ctrBenchmark: 1.5,
    keyMetrics: ['CTR', 'CPC', 'Landing Page Views'],
  },
  OUTCOME_AWARENESS: {
    label: 'Bilinirlik',
    purpose: 'Markanızın bilinirliğini artırmak',
    bestDestinations: ['WEBSITE'],
    bestOptGoals: ['REACH', 'IMPRESSIONS', 'AD_RECALL_LIFT'],
    idealCTAs: ['LEARN_MORE'],
    minBudget: 100, ctrBenchmark: 0.5,
    keyMetrics: ['Reach', 'Frequency', 'CPM', 'Ad Recall Lift'],
  },
  OUTCOME_ENGAGEMENT: {
    label: 'Etkileşim',
    purpose: 'Beğeni, yorum, paylaşım veya mesaj etkileşimi',
    bestDestinations: ['ON_AD', 'WHATSAPP', 'MESSENGER', 'INSTAGRAM_DIRECT'],
    bestOptGoals: ['POST_ENGAGEMENT', 'CONVERSATIONS', 'REPLIES', 'THRUPLAY'],
    idealCTAs: ['SEND_MESSAGE', 'LEARN_MORE'],
    minBudget: 35, ctrBenchmark: 1.0,
    keyMetrics: ['Engagement', 'Conversations', 'Replies', 'CTR'],
  },
  OUTCOME_LEADS: {
    label: 'Potansiyel Müşteri',
    purpose: 'Lead form veya mesaj ile potansiyel müşteri toplamak',
    bestDestinations: ['ON_AD', 'WHATSAPP', 'WEBSITE'],
    bestOptGoals: ['LEAD_GENERATION', 'OFFSITE_CONVERSIONS', 'REPLIES'],
    idealCTAs: ['SIGN_UP', 'GET_OFFER', 'CONTACT_US', 'SEND_MESSAGE'],
    minBudget: 50, ctrBenchmark: 1.0,
    keyMetrics: ['Leads', 'CPL', 'Conversion Rate'],
  },
  OUTCOME_SALES: {
    label: 'Satış',
    purpose: 'Online satış ve dönüşüm optimize etmek',
    bestDestinations: ['WEBSITE', 'CATALOG'],
    bestOptGoals: ['OFFSITE_CONVERSIONS', 'VALUE'],
    idealCTAs: ['SHOP_NOW', 'GET_OFFER', 'BOOK_NOW'],
    minBudget: 75, ctrBenchmark: 1.0,
    keyMetrics: ['ROAS', 'Purchases', 'CPA', 'Conversion Value'],
  },
  OUTCOME_APP_PROMOTION: {
    label: 'Uygulama Tanıtımı',
    purpose: 'Uygulama yükleme ve etkileşim',
    bestDestinations: ['APP'],
    bestOptGoals: ['APP_INSTALLS', 'OFFSITE_CONVERSIONS'],
    idealCTAs: ['INSTALL_MOBILE_APP', 'USE_APP'],
    minBudget: 50, ctrBenchmark: 1.0,
    keyMetrics: ['Installs', 'CPI', 'App Events'],
  },
}

const GOOGLE_TYPE_KNOWLEDGE: Record<string, {
  label: string
  purpose: string
  bestBidding: string[]
  biddingUpgradePath: string
  minBudget: number
  ctrBenchmark: number
  keyMetrics: string[]
}> = {
  SEARCH: {
    label: 'Arama',
    purpose: 'Google aramalarında metin reklamları ile aktif niyetli kullanıcılara ulaşmak',
    bestBidding: ['MAXIMIZE_CLICKS', 'MAXIMIZE_CONVERSIONS', 'TARGET_CPA'],
    biddingUpgradePath: 'MAXIMIZE_CLICKS → MAXIMIZE_CONVERSIONS (15+ dönüşüm) → TARGET_CPA (30+ dönüşüm)',
    minBudget: 50, ctrBenchmark: 3.0,
    keyMetrics: ['CTR', 'CPC', 'Quality Score', 'Impression Share', 'Conversions'],
  },
  DISPLAY: {
    label: 'Görüntülü Reklam',
    purpose: 'Web sitelerinde görsel reklamlar ile geniş kitleye ulaşmak veya retargeting',
    bestBidding: ['MAXIMIZE_CLICKS', 'MAXIMIZE_CONVERSIONS', 'TARGET_CPA'],
    biddingUpgradePath: 'MAXIMIZE_CLICKS → MAXIMIZE_CONVERSIONS → TARGET_CPA',
    minBudget: 30, ctrBenchmark: 0.5,
    keyMetrics: ['Impressions', 'CTR', 'Conversions', 'View-through Conversions'],
  },
  VIDEO: {
    label: 'Video',
    purpose: 'YouTube video reklamları ile marka bilinirliği ve etkileşim',
    bestBidding: ['MAXIMIZE_CLICKS', 'TARGET_CPM'],
    biddingUpgradePath: 'TARGET_CPM (bilinirlik) → MAXIMIZE_CONVERSIONS (performans)',
    minBudget: 30, ctrBenchmark: 0.5,
    keyMetrics: ['Views', 'View Rate', 'CPV', 'Watch Time'],
  },
  PERFORMANCE_MAX: {
    label: 'Maksimum Performans',
    purpose: 'Tüm Google kanallarında (Arama, Display, YouTube, Gmail, Maps) otomatik optimizasyon',
    bestBidding: ['MAXIMIZE_CONVERSIONS', 'MAXIMIZE_CONVERSION_VALUE', 'TARGET_ROAS'],
    biddingUpgradePath: 'MAXIMIZE_CONVERSIONS → TARGET_ROAS (50+ dönüşüm)',
    minBudget: 75, ctrBenchmark: 1.0,
    keyMetrics: ['Conversions', 'ROAS', 'Conversion Value', 'CPA'],
  },
  SHOPPING: {
    label: 'Alışveriş',
    purpose: 'Ürün listeleme reklamları ile e-ticaret satışları',
    bestBidding: ['MAXIMIZE_CLICKS', 'TARGET_ROAS'],
    biddingUpgradePath: 'MAXIMIZE_CLICKS → TARGET_ROAS',
    minBudget: 50, ctrBenchmark: 1.0,
    keyMetrics: ['ROAS', 'Clicks', 'Conversions', 'Impression Share'],
  },
  DEMAND_GEN: {
    label: 'Talep Oluşturma',
    purpose: 'YouTube, Gmail ve Discover üzerinden talep oluşturma',
    bestBidding: ['MAXIMIZE_CLICKS', 'MAXIMIZE_CONVERSIONS'],
    biddingUpgradePath: 'MAXIMIZE_CLICKS → MAXIMIZE_CONVERSIONS',
    minBudget: 50, ctrBenchmark: 0.5,
    keyMetrics: ['Clicks', 'Conversions', 'CTR', 'Engagement'],
  },
}

/* ── Fit Analysis (deterministic) ── */
function analyzeCampaignFit(campaign: DeepCampaignInsight): CampaignFitAnalysis {
  const isGoogle = campaign.platform === 'Google'
  const objKey = campaign.objective
  const metaKnowledge = META_OBJECTIVE_KNOWLEDGE[objKey]
  const googleKnowledge = GOOGLE_TYPE_KNOWLEDGE[objKey]
  const knowledge = isGoogle ? googleKnowledge : metaKnowledge

  const label = knowledge?.label || objKey
  const strengths: string[] = []
  const weaknesses: string[] = []
  const suggestions: string[] = []
  let fitScore = 70 // start neutral

  const ctr = campaign.metrics.ctr * 100
  const cpc = campaign.metrics.cpc
  const spend = campaign.metrics.spend
  const conversions = campaign.metrics.conversions
  const adsetCount = campaign.adsets.length
  const adCount = campaign.adsets.reduce((s, as) => s + as.ads.length, 0)

  // CTR analysis
  const ctrBench = knowledge?.ctrBenchmark || 1.0
  if (ctr > ctrBench * 1.5) { strengths.push(`CTR (%${ctr.toFixed(1)}) ortalamanın üzerinde`); fitScore += 10 }
  else if (ctr < ctrBench * 0.5) { weaknesses.push(`CTR (%${ctr.toFixed(1)}) çok düşük`); fitScore -= 15; suggestions.push('Reklam metinlerini ve kreatifleri yenileyin') }

  // Budget analysis
  const minBudget = knowledge?.minBudget || 35
  if (campaign.dailyBudget != null && campaign.dailyBudget < minBudget) {
    weaknesses.push(`Bütçe (₺${campaign.dailyBudget.toFixed(0)}) minimum ₺${minBudget} altında`)
    fitScore -= 10
    suggestions.push(`Günlük bütçeyi en az ₺${minBudget} yapın`)
  }

  // Adset/ad diversity
  if (adsetCount === 1 && spend > 100) { weaknesses.push('Tek reklam seti — A/B test yok'); fitScore -= 5; suggestions.push('2-3 farklı reklam seti oluşturun') }
  if (adsetCount >= 2) { strengths.push(`${adsetCount} reklam seti ile test yapılıyor`); fitScore += 5 }

  // Meta-specific checks
  if (!isGoogle && metaKnowledge) {
    const triple = campaign.triple
    if (triple) {
      // Destination check
      if (metaKnowledge.bestDestinations.length > 0 && !metaKnowledge.bestDestinations.includes(triple.destination)) {
        weaknesses.push(`Dönüşüm hedefi (${triple.destination}) bu amaç için ideal değil`)
        fitScore -= 10
        suggestions.push(`Dönüşüm hedefini ${metaKnowledge.bestDestinations.join(' veya ')} olarak değiştirin`)
      } else if (triple.destination) {
        strengths.push(`Dönüşüm hedefi (${triple.destination}) uygun`)
      }

      // Optimization goal check
      if (metaKnowledge.bestOptGoals.length > 0 && !metaKnowledge.bestOptGoals.includes(triple.optimizationGoal)) {
        weaknesses.push(`Optimizasyon hedefi (${triple.optimizationGoal}) bu amaç için optimal değil`)
        fitScore -= 10
        suggestions.push(`Optimizasyon hedefini ${metaKnowledge.bestOptGoals[0]} olarak değerlendirin`)
      }
    }

    // Frequency check
    const freq = campaign.metrics.frequency || 0
    if (freq > 4) { weaknesses.push(`Frequency (${freq.toFixed(1)}) yüksek — reklam yorgunluğu riski`); fitScore -= 10; suggestions.push('Hedef kitleyi genişletin veya yeni kreatif ekleyin') }
  }

  // Google-specific checks
  if (isGoogle && googleKnowledge) {
    const bidding = campaign.biddingStrategy || ''
    if (bidding.includes('TARGET_SPEND') || bidding.includes('MAXIMIZE_CLICKS')) {
      if (conversions >= 15) {
        weaknesses.push('Yeterli dönüşüm var ama hala tıklama odaklı teklif stratejisi')
        fitScore -= 10
        suggestions.push('MAXIMIZE_CONVERSIONS teklif stratejisine geçin')
      }
    }
    if (bidding.includes('TARGET_CPA') && conversions < 15) {
      weaknesses.push('TARGET_CPA için yeterli dönüşüm verisi yok')
      fitScore -= 10
      suggestions.push('MAXIMIZE_CONVERSIONS stratejisine düşün')
    }

    // Opt score
    if (campaign.optimizationScore != null && campaign.optimizationScore < 50) {
      weaknesses.push(`Google optimizasyon puanı düşük (%${campaign.optimizationScore.toFixed(0)})`)
      suggestions.push('Google önerilerini inceleyin')
    }
  }

  // ROAS check for sales/conversion objectives
  if (['OUTCOME_SALES', 'SHOPPING', 'PERFORMANCE_MAX'].includes(objKey)) {
    if (campaign.metrics.roas != null) {
      if (campaign.metrics.roas < 1) { weaknesses.push(`ROAS (${campaign.metrics.roas.toFixed(1)}x) 1x altında — zarar`); fitScore -= 15 }
      else if (campaign.metrics.roas >= 3) { strengths.push(`ROAS (${campaign.metrics.roas.toFixed(1)}x) güçlü`); fitScore += 10 }
    }
  }

  // Conversions check
  if (spend > 200 && conversions < 1) { weaknesses.push('Yüksek harcama, sıfır dönüşüm'); fitScore -= 20; suggestions.push('Dönüşüm takibini kontrol edin') }

  fitScore = Math.max(0, Math.min(100, fitScore))

  return {
    campaignId: campaign.id,
    campaignName: campaign.campaignName,
    platform: campaign.platform,
    objective: objKey,
    objectiveLabel: label,
    fitScore,
    strengths,
    weaknesses,
    currentParams: {
      destination: campaign.triple?.destination,
      optimizationGoal: campaign.triple?.optimizationGoal,
      biddingStrategy: campaign.biddingStrategy,
      dailyBudget: campaign.dailyBudget,
      adsetCount,
      adCount,
      ctr, cpc, conversions,
      roas: campaign.metrics.roas,
      spend,
    },
    optimizationSuggestions: suggestions,
  }
}

/* ── Build AI Prompt ── */
function buildPrompt(
  platform: Platform,
  fitAnalyses: CampaignFitAnalysis[],
  userProfile: UserAdProfile,
  comparison: CompetitorComparison,
  competitorAds: CompetitorAd[],
  structuralIssues?: StructuralIssue[],
): { system: string; user: string } {
  const isGoogle = platform === 'Google'
  const knowledge = isGoogle ? GOOGLE_TYPE_KNOWLEDGE : META_OBJECTIVE_KNOWLEDGE

  const system = `Sen YoAi karar motorusun. Kullanıcının aktif reklamlarını analiz ettin.
Her kampanyanın AYNI AMACINA karşılık gelen daha güçlü AI kampanya yapısı önereceksin.

KRİTİK KURALLAR:
- Kampanya amacını DEĞİŞTİRME. Etkileşim ise Etkileşim öner, Trafik ise Trafik öner.
- Mevcut kampanyanın zayıf yönlerini düzeltilmiş haliyle öner.
- Platform çalışma mantığını kullan.
- Her öneri tam yapı: kampanya + reklam seti + reklam + dönüşüm hedefi + teklif stratejisi.
- Türkçe reklam metinleri.

PLATFORM BİLGİSİ:
${Object.entries(knowledge).map(([key, k]) => {
  if (isGoogle) {
    const gk = k as typeof GOOGLE_TYPE_KNOWLEDGE[string]
    return `${key} (${gk.label}): ${gk.purpose}. Teklif: ${gk.bestBidding.join(', ')}. Geçiş: ${gk.biddingUpgradePath}. Min bütçe: ₺${gk.minBudget}.`
  } else {
    const mk = k as typeof META_OBJECTIVE_KNOWLEDGE[string]
    return `${key} (${mk.label}): ${mk.purpose}. Destinasyonlar: ${mk.bestDestinations.join(', ')}. Opt hedefler: ${mk.bestOptGoals.join(', ')}. CTA: ${mk.idealCTAs.join(', ')}. Min bütçe: ₺${mk.minBudget}.`
  }
}).join('\n')}

JSON formatında yanıt ver:
{
  "proposals": [
    {
      "id": "proposal_1",
      "platform": "${platform}",
      "sourceCampaignId": "mevcut kampanya id",
      "sourceCampaignName": "mevcut kampanya adı",
      "proposalType": "optimization",
      "campaignName": "Önerilen kampanya adı",
      "campaignObjective": "AYNI_OBJECTIVE",
      "objectiveLabel": "Türkçe etiket",
      "dailyBudget": 50,
      "adsetName": "Reklam seti adı",
      "targetingDescription": "Hedefleme detayı",
      ${isGoogle ? `"biddingStrategy": "UYGUN_STRATEJİ",
      "headlines": ["B1", "B2", "B3", "B4", "B5"],
      "descriptions": ["A1", "A2"],
      "finalUrl": "https://...",
      "keywords": ["k1", "k2"],` : `"optimizationGoal": "UYGUN_HEDEF",
      "destinationType": "UYGUN_DESTINATION",
      "callToAction": "UYGUN_CTA",`}
      "adName": "Reklam adı",
      "primaryText": "Reklam metni",
      "headline": "Başlık",
      "description": "Açıklama",
      "reasoning": "Bu yapı neden daha güçlü — mevcut zayıflıklara göre açıkla",
      "competitorInsight": "Rakip karşılaştırma",
      "expectedPerformance": "Beklenen CTR, CPC",
      "confidence": 80,
      "isNewObjective": false,
      "analyzedParameters": ["dönüşüm hedefi", "teklif stratejisi", "bütçe", "hedefleme", "kreatif"],
      "suggestedChanges": ["Dönüşüm hedefi X→Y", "Teklif stratejisi A→B"]
    }
  ]
}`

  const analysisDetails = fitAnalyses.map(fa => {
    return `[${fa.objectiveLabel}] ${fa.campaignName} (ID: ${fa.campaignId})
  Uygunluk: ${fa.fitScore}/100
  Güçlü: ${fa.strengths.join(', ') || 'yok'}
  Zayıf: ${fa.weaknesses.join(', ') || 'yok'}
  Mevcut: Bütçe ₺${fa.currentParams.dailyBudget?.toFixed(0) || '?'} | ${fa.currentParams.adsetCount} set ${fa.currentParams.adCount} reklam | CTR %${fa.currentParams.ctr.toFixed(1)} | CPC ₺${fa.currentParams.cpc.toFixed(2)} | Dönüşüm ${fa.currentParams.conversions}
  ${fa.currentParams.destination ? `Dönüşüm hedefi: ${fa.currentParams.destination}` : ''}
  ${fa.currentParams.optimizationGoal ? `Opt hedef: ${fa.currentParams.optimizationGoal}` : ''}
  ${fa.currentParams.biddingStrategy ? `Teklif: ${fa.currentParams.biddingStrategy}` : ''}
  Öneriler: ${fa.optimizationSuggestions.join('; ') || 'yok'}`
  }).join('\n\n')

  const compTexts = competitorAds.slice(0, 5).map((a, i) => `${i + 1}. [${a.pageName}] "${a.body?.slice(0, 80) || a.title || ''}"`).join('\n')

  const user = `KAMPANYA ANALİZLERİ:
${analysisDetails}

RAKİP KARŞILAŞTIRMA:
${comparison.competitorSummary || 'Rakip verisi yok'}

RAKİP REKLAMLARI:
${compTexts || 'Yok'}

GÖREV: Her kampanya için AYNI amaca karşılık gelen daha güçlü AI kampanya yapısı öner.
${fitAnalyses.length} öneri bekleniyor.`

  return { system, user }
}

/* ── Call AI ── */
async function callAI(system: string, user: string): Promise<string | null> {
  const openaiKey = process.env.OPENAI_API_KEY
  if (openaiKey) {
    try {
      const baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'
      const model = process.env.OPENAI_MODEL || 'gpt-4o-mini'
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
        body: JSON.stringify({ model, messages: [{ role: 'system', content: system }, { role: 'user', content: user }], temperature: 0.6, max_tokens: 6000, response_format: { type: 'json_object' } }),
        signal: AbortSignal.timeout(45000),
      })
      if (res.ok) { const data = await res.json(); return data.choices?.[0]?.message?.content ?? null }
    } catch (e) { console.error('[AdCreator] OpenAI error:', e) }
  }

  const claudeKey = process.env.ANTHROPIC_API_KEY
  if (claudeKey) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': claudeKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 6000, system, messages: [{ role: 'user', content: user }] }),
        signal: AbortSignal.timeout(45000),
      })
      if (res.ok) { const data = await res.json(); return data.content?.[0]?.text ?? null }
    } catch (e) { console.error('[AdCreator] Claude error:', e) }
  }

  return null
}

/* ── Main Entry ── */
export async function generateFullAutoProposals(
  platform: Platform,
  userProfile: UserAdProfile,
  comparison: CompetitorComparison,
  competitorAds: CompetitorAd[],
  campaigns: DeepCampaignInsight[],
  structuralIssues?: StructuralIssue[],
): Promise<AdCreationResult> {
  // 1. Filter active campaigns for this platform
  const activeCampaigns = campaigns.filter(c =>
    c.platform === platform && (c.status === 'ACTIVE' || c.status === 'ENABLED')
  )

  if (activeCampaigns.length === 0) {
    return {
      fitAnalyses: [], proposals: [],
      summary: { totalCampaignsAnalyzed: 0, criticalIssues: 0, opportunities: 0, proposalsGenerated: 0, metaCount: 0, googleCount: 0 },
      aiGenerated: false, error: `${platform} platformunda aktif kampanya bulunamadı`,
    }
  }

  // 2. Run deterministic fit analysis for each campaign
  const fitAnalyses = activeCampaigns.map(analyzeCampaignFit)

  // 3. Call AI to generate proposals based on fit analyses
  const { system, user } = buildPrompt(platform, fitAnalyses, userProfile, comparison, competitorAds, structuralIssues)
  const aiContent = await callAI(system, user)

  let proposals: FullAdProposal[] = []
  let aiGenerated = false

  if (aiContent) {
    try {
      const parsed = JSON.parse(aiContent)
      proposals = Array.isArray(parsed.proposals)
        ? parsed.proposals.map((p: FullAdProposal, i: number) => ({
            ...p,
            id: p.id || `proposal_${i + 1}`,
            platform,
            proposalType: p.proposalType || 'optimization',
            isNewObjective: p.isNewObjective || false,
            analyzedParameters: p.analyzedParameters || [],
            suggestedChanges: p.suggestedChanges || [],
          }))
        : []
      aiGenerated = true
    } catch (e) {
      console.error('[AdCreator] Parse error:', e)
    }
  }

  // 4. Build summary
  const criticalIssues = fitAnalyses.filter(fa => fa.fitScore < 40).length
  const opportunities = fitAnalyses.filter(fa => fa.weaknesses.length > 0).length

  return {
    fitAnalyses,
    proposals,
    summary: {
      totalCampaignsAnalyzed: fitAnalyses.length,
      criticalIssues,
      opportunities,
      proposalsGenerated: proposals.length,
      metaCount: platform === 'Meta' ? proposals.length : 0,
      googleCount: platform === 'Google' ? proposals.length : 0,
    },
    aiGenerated,
  }
}
