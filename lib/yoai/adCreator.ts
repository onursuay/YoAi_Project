/* ──────────────────────────────────────────────────────────
   AI Ad Creator — Phase 3
   Analyzes winning patterns, identifies gaps,
   generates complete ad proposals via AI.
   ────────────────────────────────────────────────────────── */

import type { DeepCampaignInsight, AdsetInsight, AdInsight, Platform } from './analysisTypes'

/* ── Types ── */
export interface WinningPattern {
  topCampaigns: { name: string; platform: Platform; ctr: number; roas: number | null; spend: number }[]
  topFormats: { format: string; count: number; avgCtr: number }[]
  avgMetrics: { ctr: number; cpc: number; roas: number | null }
}

export interface AdProposal {
  id: string
  platform: Platform
  campaignId?: string
  campaignName?: string
  adsetId?: string
  adGroupId?: string
  // Creative
  primaryText: string
  headline: string
  description: string
  callToAction: string
  // Google RSA specific
  headlines?: string[]       // 3-15 headlines for RSA
  descriptions?: string[]    // 2-4 descriptions for RSA
  finalUrl?: string
  // Meta specific
  format?: 'single_image' | 'single_video' | 'carousel'
  // Context
  targetAudience: string
  reasoning: string
  expectedPerformance: string
  confidence: number
}

export interface CompetitorContext {
  googleCompetitors?: { domain: string; impressionShare: number }[]
  metaAds?: { pageName: string; adCreativeBody?: string; adCreativeLinkTitle?: string }[]
}

export interface AdCreationContext {
  platform: Platform
  campaignId?: string
  campaigns: DeepCampaignInsight[]
  objective?: string
  competitors?: CompetitorContext
}

/* ── Analyze winning patterns ── */
export function analyzeWinningPatterns(campaigns: DeepCampaignInsight[]): WinningPattern {
  // Top campaigns by CTR
  const sorted = [...campaigns]
    .filter(c => c.metrics.impressions > 100)
    .sort((a, b) => (b.metrics.ctr * 100) - (a.metrics.ctr * 100))

  const topCampaigns = sorted.slice(0, 5).map(c => ({
    name: c.campaignName,
    platform: c.platform,
    ctr: c.metrics.ctr * 100,
    roas: c.metrics.roas,
    spend: c.metrics.spend,
  }))

  // Collect ad formats
  const formatMap = new Map<string, { count: number; totalCtr: number }>()
  for (const c of campaigns) {
    for (const as of c.adsets) {
      for (const ad of as.ads) {
        const fmt = ad.format || 'unknown'
        const existing = formatMap.get(fmt) || { count: 0, totalCtr: 0 }
        existing.count++
        existing.totalCtr += ad.metrics.ctr * 100
        formatMap.set(fmt, existing)
      }
    }
  }
  const topFormats = Array.from(formatMap.entries())
    .map(([format, data]) => ({ format, count: data.count, avgCtr: data.count > 0 ? data.totalCtr / data.count : 0 }))
    .sort((a, b) => b.avgCtr - a.avgCtr)

  // Average metrics
  const withData = campaigns.filter(c => c.metrics.impressions > 0)
  const totalSpend = withData.reduce((s, c) => s + c.metrics.spend, 0)
  const totalClicks = withData.reduce((s, c) => s + c.metrics.clicks, 0)
  const totalImpressions = withData.reduce((s, c) => s + c.metrics.impressions, 0)
  let roasSum = 0, roasCount = 0
  for (const c of withData) {
    if (c.metrics.roas != null) { roasSum += c.metrics.roas; roasCount++ }
  }

  return {
    topCampaigns,
    topFormats,
    avgMetrics: {
      ctr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
      cpc: totalClicks > 0 ? totalSpend / totalClicks : 0,
      roas: roasCount > 0 ? roasSum / roasCount : null,
    },
  }
}

/* ── Generate ad proposals via AI ── */
export async function generateAdProposals(context: AdCreationContext): Promise<{
  proposals: AdProposal[]
  patterns: WinningPattern
  aiGenerated: boolean
  error?: string
}> {
  const patterns = analyzeWinningPatterns(context.campaigns)

  // Build context for AI
  const campaignContext = context.campaigns.slice(0, 10).map(c => ({
    platform: c.platform,
    name: c.campaignName,
    objective: c.objective,
    ctr: (c.metrics.ctr * 100).toFixed(2) + '%',
    cpc: '₺' + c.metrics.cpc.toFixed(2),
    roas: c.metrics.roas?.toFixed(2) || 'N/A',
    spend: '₺' + c.metrics.spend.toFixed(0),
    score: c.score,
    topAdsets: c.adsets.slice(0, 3).map(as => ({
      name: as.name,
      ctr: (as.metrics.ctr * 100).toFixed(2) + '%',
      ads: as.ads.slice(0, 3).map(ad => ({
        name: ad.name,
        ctr: (ad.metrics.ctr * 100).toFixed(2) + '%',
        format: ad.format,
      })),
    })),
  }))

  const targetCampaign = context.campaignId
    ? context.campaigns.find(c => c.id === context.campaignId)
    : null

  const isGoogle = context.platform === 'Google'

  const systemPrompt = `Sen YoAi platformunun reklam oluşturma AI'ısın. Kullanıcının mevcut reklam verilerini analiz ederek yeni reklam önerileri oluşturuyorsun.

KURALLAR:
- Mevcut en iyi performans gösteren reklamlardaki kalıpları analiz et
- Kullanıcının sektörüne ve hedefine uygun metin yaz
- Türkçe reklam metinleri oluştur
- ${isGoogle ? 'Google Responsive Search Ad (RSA) formatında: 5-10 başlık (max 30 karakter), 2-4 açıklama (max 90 karakter)' : 'Meta Ads formatında: birincil metin, başlık, açıklama, CTA'}
- Her öneri için neden bu şekilde önerildiğini açıkla
- Beklenen performansı tahmin et
- 2-3 farklı varyasyon oluştur
- Rakip analizi verisi varsa, rakiplerin kullandığı mesaj stratejilerini referans al ve farklılaşma öner
- Rakiplerin güçlü yönlerini not et ama kullanıcıyı farklılaştır

SADECE aşağıdaki JSON formatında yanıt ver:
{
  "proposals": [
    {
      "id": "proposal_1",
      "platform": "${context.platform}",
      ${targetCampaign ? `"campaignId": "${targetCampaign.id}",\n      "campaignName": "${targetCampaign.campaignName}",` : ''}
      "primaryText": "Ana reklam metni (Türkçe, 125 karakter ideal)",
      "headline": "Başlık (Türkçe, 25-30 karakter)",
      "description": "Açıklama (Türkçe, 90 karakter max)",
      "callToAction": "${isGoogle ? 'N/A' : 'LEARN_MORE veya SHOP_NOW veya SIGN_UP vb.'}",
      ${isGoogle ? `"headlines": ["Başlık 1 (max 30)", "Başlık 2", "Başlık 3", "Başlık 4", "Başlık 5"],\n      "descriptions": ["Açıklama 1 (max 90)", "Açıklama 2"],` : `"format": "single_image",`}
      "targetAudience": "Hedef kitle tanımı (Türkçe)",
      "reasoning": "Neden bu reklam önerildi (Türkçe, mevcut verilere dayalı)",
      "expectedPerformance": "Beklenen CTR, CPC tahmini (Türkçe)",
      "confidence": 75
    }
  ]
}`

  const userMessage = `Platform: ${context.platform}
${targetCampaign ? `Hedef Kampanya: ${targetCampaign.campaignName} (${targetCampaign.objective})` : 'Genel öneri — en iyi performans gösteren kampanyalara göre'}

Mevcut kampanya performansları:
${JSON.stringify(campaignContext, null, 2)}

Ortalama metrikler: CTR ${patterns.avgMetrics.ctr.toFixed(2)}%, CPC ₺${patterns.avgMetrics.cpc.toFixed(2)}, ROAS ${patterns.avgMetrics.roas?.toFixed(2) || 'N/A'}

${isGoogle ? '5-10 başlık ve 2-4 açıklama ile Responsive Search Ad (RSA) oluştur.' : 'Meta Ads formatında 2-3 reklam varyasyonu oluştur.'}
${context.competitors?.googleCompetitors?.length ? `\nGoogle Rakipler:\n${context.competitors.googleCompetitors.slice(0, 5).map(c => `- ${c.domain}: %${(c.impressionShare * 100).toFixed(0)} gösterim payı`).join('\n')}` : ''}
${context.competitors?.metaAds?.length ? `\nMeta Rakip Reklamları:\n${context.competitors.metaAds.slice(0, 5).map(a => `- ${a.pageName}: "${a.adCreativeBody?.slice(0, 80) || a.adCreativeLinkTitle || ''}"`).join('\n')}\n\nRakiplerin mesaj stratejilerini analiz et ve farklılaşan öneriler sun.` : ''}
2-3 farklı varyasyon öner.`

  // Call AI
  let aiContent: string | null = null

  const openaiKey = process.env.OPENAI_API_KEY
  if (openaiKey) {
    try {
      const baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'
      const model = process.env.OPENAI_MODEL || 'gpt-4o-mini'
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
        body: JSON.stringify({
          model,
          messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMessage }],
          temperature: 0.7,
          max_tokens: 3000,
          response_format: { type: 'json_object' },
        }),
        signal: AbortSignal.timeout(30000),
      })
      if (res.ok) {
        const data = await res.json()
        aiContent = data.choices?.[0]?.message?.content ?? null
      }
    } catch (e) {
      console.error('[AdCreator] OpenAI error:', e)
    }
  }

  // Claude fallback
  if (!aiContent) {
    const claudeKey = process.env.ANTHROPIC_API_KEY
    if (claudeKey) {
      try {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': claudeKey, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 3000,
            system: systemPrompt,
            messages: [{ role: 'user', content: userMessage }],
          }),
          signal: AbortSignal.timeout(30000),
        })
        if (res.ok) {
          const data = await res.json()
          aiContent = data.content?.[0]?.text ?? null
        }
      } catch (e) {
        console.error('[AdCreator] Claude error:', e)
      }
    }
  }

  if (!aiContent) {
    return { proposals: [], patterns, aiGenerated: false, error: 'AI servisi yanıt vermedi' }
  }

  try {
    const parsed = JSON.parse(aiContent)
    const proposals: AdProposal[] = Array.isArray(parsed.proposals)
      ? parsed.proposals.map((p: AdProposal, i: number) => ({
          ...p,
          id: p.id || `proposal_${i + 1}`,
          platform: context.platform,
        }))
      : []

    return { proposals, patterns, aiGenerated: true }
  } catch (e) {
    console.error('[AdCreator] Parse error:', e)
    return { proposals: [], patterns, aiGenerated: false, error: 'AI yanıtı işlenemedi' }
  }
}
