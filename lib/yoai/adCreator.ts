/* ──────────────────────────────────────────────────────────
   AI Ad Creator — v3 (Multi-Objective Full Auto)

   Logic:
   1. Detect which campaign objectives user is CURRENTLY using
   2. For each active objective: analyze performance + compare with competitors
   3. Detect which objectives user is NOT using but SHOULD
   4. Generate one proposal per objective (used + suggested)
   5. Each proposal = complete campaign + ad set + ad structure
   ────────────────────────────────────────────────────────── */

import type { DeepCampaignInsight, Platform, StructuralIssue } from './analysisTypes'
import type { UserAdProfile, CompetitorComparison, CompetitorAd } from './competitorAnalyzer'

/* ── Types ── */
export interface FullAdProposal {
  id: string
  platform: Platform
  campaignName: string
  campaignObjective: string
  objectiveLabel: string // Turkish label
  dailyBudget: number
  adsetName: string
  targetingDescription: string
  optimizationGoal?: string
  biddingStrategy?: string
  adName: string
  primaryText: string
  headline: string
  description: string
  callToAction: string
  headlines?: string[]
  descriptions?: string[]
  finalUrl?: string
  keywords?: string[]
  reasoning: string
  competitorInsight: string
  expectedPerformance: string
  confidence: number
  isNewObjective: boolean // true = user doesn't have this type yet
}

export interface AdCreationResult {
  proposals: FullAdProposal[]
  aiGenerated: boolean
  error?: string
}

/* ── Objective labels ── */
const META_OBJECTIVES: Record<string, string> = {
  OUTCOME_TRAFFIC: 'Trafik',
  OUTCOME_AWARENESS: 'Bilinirlik',
  OUTCOME_ENGAGEMENT: 'Etkileşim',
  OUTCOME_LEADS: 'Potansiyel Müşteri',
  OUTCOME_SALES: 'Satış',
  OUTCOME_APP_PROMOTION: 'Uygulama Tanıtımı',
}

const GOOGLE_TYPES: Record<string, string> = {
  SEARCH: 'Arama',
  DISPLAY: 'Görüntülü Reklam',
  VIDEO: 'Video',
  PERFORMANCE_MAX: 'Maksimum Performans',
  SHOPPING: 'Alışveriş',
  DEMAND_GEN: 'Talep Oluşturma',
}

/* ── Detect active objectives + missing ones ── */
function detectObjectives(campaigns: DeepCampaignInsight[], platform: Platform): {
  activeObjectives: { objective: string; label: string; campaigns: DeepCampaignInsight[] }[]
  missingObjectives: { objective: string; label: string; reason: string }[]
} {
  const activeCampaigns = campaigns.filter(c => c.platform === platform && (c.status === 'ACTIVE' || c.status === 'ENABLED'))
  const allObjectives = platform === 'Meta' ? META_OBJECTIVES : GOOGLE_TYPES
  const usedObjectives = new Set(activeCampaigns.map(c => c.objective))

  const activeObjectives = Array.from(usedObjectives).map(obj => ({
    objective: obj,
    label: allObjectives[obj] || obj,
    campaigns: activeCampaigns.filter(c => c.objective === obj),
  }))

  const missingObjectives: { objective: string; label: string; reason: string }[] = []

  if (platform === 'Meta') {
    if (!usedObjectives.has('OUTCOME_LEADS')) {
      missingObjectives.push({ objective: 'OUTCOME_LEADS', label: 'Potansiyel Müşteri', reason: 'Lead form veya WhatsApp ile potansiyel müşteri toplayabilirsiniz.' })
    }
    if (!usedObjectives.has('OUTCOME_SALES') && activeCampaigns.some(c => c.metrics.conversions > 0)) {
      missingObjectives.push({ objective: 'OUTCOME_SALES', label: 'Satış', reason: 'Dönüşüm veriniz var — satış kampanyası ile ROAS optimize edebilirsiniz.' })
    }
    if (!usedObjectives.has('OUTCOME_AWARENESS') && activeCampaigns.length >= 3) {
      missingObjectives.push({ objective: 'OUTCOME_AWARENESS', label: 'Bilinirlik', reason: 'Marka bilinirliği artırmak funnel stratejinizi güçlendirir.' })
    }
  } else {
    if (!usedObjectives.has('PERFORMANCE_MAX') && activeCampaigns.length >= 2) {
      missingObjectives.push({ objective: 'PERFORMANCE_MAX', label: 'Maksimum Performans', reason: 'PMax tüm Google kanallarında otomatik optimizasyon sağlar.' })
    }
    if (!usedObjectives.has('DISPLAY') && usedObjectives.has('SEARCH')) {
      missingObjectives.push({ objective: 'DISPLAY', label: 'Görüntülü Reklam', reason: 'Search ile yakaladığınız kitleye Display ile yeniden ulaşabilirsiniz.' })
    }
    if (!usedObjectives.has('VIDEO')) {
      missingObjectives.push({ objective: 'VIDEO', label: 'Video', reason: 'YouTube video reklamları ile marka bilinirliği artırabilirsiniz.' })
    }
  }

  return { activeObjectives, missingObjectives: missingObjectives.slice(0, 2) }
}

/* ── Build AI prompt ── */
function buildPrompt(
  platform: Platform,
  activeObjectives: { objective: string; label: string; campaigns: DeepCampaignInsight[] }[],
  missingObjectives: { objective: string; label: string; reason: string }[],
  userProfile: UserAdProfile,
  comparison: CompetitorComparison,
  competitorAds: CompetitorAd[],
  structuralIssues?: StructuralIssue[],
): { system: string; user: string } {
  const isGoogle = platform === 'Google'
  const allObjectives = isGoogle ? GOOGLE_TYPES : META_OBJECTIVES

  const system = `Sen YoAi platformunun reklam oluşturma AI'ısın.

GÖREV: ${platform} için her kampanya amacı bazında ayrı ayrı tam reklam yapısı oluştur.

KULLANICININ AKTİF KAMPANYA AMAÇLARI:
${activeObjectives.map(o => `- ${o.label} (${o.objective}): ${o.campaigns.length} kampanya`).join('\n')}

ÖNERİLEN YENİ KAMPANYA AMAÇLARI:
${missingObjectives.map(o => `- ${o.label} (${o.objective}): ${o.reason}`).join('\n') || '- Yok'}

PLATFORM: ${platform}
MEVCUT KAMPANYA AMAÇLARI: ${Object.entries(allObjectives).map(([k, v]) => `${k}=${v}`).join(', ')}

${isGoogle ? `GOOGLE KURALLARI:
- SEARCH: RSA formatı, 5-10 başlık (max 30 kar), 2-4 açıklama (max 90 kar), keywords
- PERFORMANCE_MAX: Tüm kanallar, asset grupları
- DISPLAY: Görsel reklam
- VIDEO: YouTube reklam
- Teklif: MAXIMIZE_CLICKS (yeni), MAXIMIZE_CONVERSIONS (15+ dönüşüm), TARGET_CPA (30+)
- Min bütçe: ₺50/gün` : `META KURALLARI:
- TRAFFIC: LINK_CLICKS veya LANDING_PAGE_VIEWS, Website/WhatsApp
- ENGAGEMENT: POST_ENGAGEMENT, CONVERSATIONS, REPLIES
- LEADS: LEAD_GENERATION (form), WHATSAPP (mesaj)
- SALES: OFFSITE_CONVERSIONS, VALUE
- AWARENESS: REACH, IMPRESSIONS
- CTA: LEARN_MORE, SHOP_NOW, SIGN_UP, CONTACT_US, SEND_MESSAGE, GET_OFFER
- Min bütçe: ₺35/gün`}

KURALLAR:
- Her aktif kampanya amacı için 1 öneri oluştur (mevcut performansı iyileştiren)
- Her önerilen yeni kampanya amacı için 1 öneri oluştur (isNewObjective: true)
- Türkçe reklam metinleri
- Rakip analizini referans al, farklılaş
- Yapısal sorunları düzeltilmiş haliyle öner
- Her öneri tam yapı: kampanya adı + reklam seti adı + reklam metinleri + bütçe + hedefleme

JSON formatında yanıt ver:
{
  "proposals": [
    {
      "id": "proposal_1",
      "platform": "${platform}",
      "campaignName": "Kampanya adı",
      "campaignObjective": "OBJECTIVE_ID",
      "objectiveLabel": "Türkçe etiket",
      "dailyBudget": 50,
      "adsetName": "Reklam seti adı",
      "targetingDescription": "Hedefleme açıklaması",
      ${isGoogle ? `"biddingStrategy": "MAXIMIZE_CLICKS",
      "headlines": ["B1 max30", "B2", "B3", "B4", "B5"],
      "descriptions": ["A1 max90", "A2"],
      "finalUrl": "https://ornek.com",
      "keywords": ["kelime1", "kelime2"],` : `"optimizationGoal": "LINK_CLICKS",
      "callToAction": "LEARN_MORE",`}
      "adName": "Reklam adı",
      "primaryText": "Ana metin",
      "headline": "Başlık",
      "description": "Açıklama",
      "reasoning": "Neden bu amaç+yapı önerildi (rakip + veri bazlı, Türkçe)",
      "competitorInsight": "Rakiplerle karşılaştırma (Türkçe)",
      "expectedPerformance": "Beklenen CTR, CPC tahmini",
      "confidence": 80,
      "isNewObjective": false
    }
  ]
}`

  // Build user message with campaign details per objective
  const objectiveDetails = activeObjectives.map(o => {
    const bestCampaign = o.campaigns.sort((a, b) => b.score - a.score)[0]
    const avgCtr = o.campaigns.reduce((s, c) => s + c.metrics.ctr, 0) / o.campaigns.length * 100
    const totalSpend = o.campaigns.reduce((s, c) => s + c.metrics.spend, 0)
    const problems = o.campaigns.flatMap(c => c.problemTags.map(p => p.id))
    const uniqueProblems = [...new Set(problems)]
    return `[${o.label}] ${o.campaigns.length} kampanya | Harcama: ₺${totalSpend.toFixed(0)} | Ort CTR: %${avgCtr.toFixed(1)} | Sorunlar: ${uniqueProblems.join(', ') || 'yok'} | En iyi: ${bestCampaign?.campaignName || 'N/A'} (puan: ${bestCampaign?.score || 0})`
  }).join('\n')

  const competitorTexts = competitorAds.slice(0, 5).map((a, i) =>
    `${i + 1}. [${a.pageName}] "${a.body?.slice(0, 80) || a.title || ''}"`
  ).join('\n')

  const structuralText = structuralIssues && structuralIssues.length > 0
    ? structuralIssues.filter(i => i.platform === platform).slice(0, 5).map(i => `- ${i.title}: ${i.currentValue} → ${i.recommendedValue}`).join('\n')
    : 'Yok'

  const user = `KULLANICI PROFİLİ:
Anahtar kelimeler: ${userProfile.keywords.join(', ')}
Ort CTR: %${userProfile.avgCtr.toFixed(2)} | Ort CPC: ₺${userProfile.avgCpc.toFixed(2)}
Toplam harcama: ₺${userProfile.totalSpend.toFixed(0)}

AKTİF KAMPANYA DETAYLARI:
${objectiveDetails}

RAKİP REKLAMLARI:
${competitorTexts || 'Rakip verisi yok'}

RAKİP KARŞILAŞTIRMA:
${comparison.competitorSummary}

YAPISAL SORUNLAR:
${structuralText}

GÖREV: Her aktif kampanya amacı için 1 iyileştirme önerisi + önerilen yeni amaçlar için 1'er öneri oluştur.
Toplam ${activeObjectives.length + missingObjectives.length} öneri bekleniyor.`

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
        body: JSON.stringify({ model, messages: [{ role: 'system', content: system }, { role: 'user', content: user }], temperature: 0.7, max_tokens: 6000, response_format: { type: 'json_object' } }),
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

/* ── Main ── */
export async function generateFullAutoProposals(
  platform: Platform,
  userProfile: UserAdProfile,
  comparison: CompetitorComparison,
  competitorAds: CompetitorAd[],
  campaigns: DeepCampaignInsight[],
  structuralIssues?: StructuralIssue[],
): Promise<AdCreationResult> {
  const { activeObjectives, missingObjectives } = detectObjectives(campaigns, platform)

  if (activeObjectives.length === 0) {
    return { proposals: [], aiGenerated: false, error: `${platform} platformunda aktif kampanya bulunamadı` }
  }

  const { system, user } = buildPrompt(platform, activeObjectives, missingObjectives, userProfile, comparison, competitorAds, structuralIssues)

  const aiContent = await callAI(system, user)
  if (!aiContent) {
    return { proposals: [], aiGenerated: false, error: 'AI servisi yanıt vermedi' }
  }

  try {
    const parsed = JSON.parse(aiContent)
    const proposals: FullAdProposal[] = Array.isArray(parsed.proposals)
      ? parsed.proposals.map((p: FullAdProposal, i: number) => ({ ...p, id: p.id || `proposal_${i + 1}`, platform }))
      : []

    return { proposals, aiGenerated: true }
  } catch (e) {
    console.error('[AdCreator] Parse error:', e)
    return { proposals: [], aiGenerated: false, error: 'AI yanıtı işlenemedi' }
  }
}
