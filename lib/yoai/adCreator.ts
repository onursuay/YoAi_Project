/* ──────────────────────────────────────────────────────────
   AI Ad Creator — v2 (Full Auto)

   Input:  User ad analysis + competitor analysis + platform knowledge
   Output: Complete campaign structure (campaign + ad set + ad)
           ready to be published via existing Meta/Google APIs.
   ────────────────────────────────────────────────────────── */

import type { DeepCampaignInsight, Platform } from './analysisTypes'
import type { UserAdProfile, CompetitorComparison, CompetitorAd } from './competitorAnalyzer'

/* ── Types ── */
export interface FullAdProposal {
  id: string
  platform: Platform

  // Campaign level
  campaignName: string
  campaignObjective: string      // Meta: OUTCOME_TRAFFIC etc. Google: SEARCH etc.
  dailyBudget: number            // in currency units (TRY)

  // Ad Set / Ad Group level
  adsetName: string
  targetingDescription: string   // human-readable targeting summary
  optimizationGoal?: string      // Meta only
  biddingStrategy?: string       // Google only

  // Ad level
  adName: string
  primaryText: string            // Meta main text / Google description
  headline: string               // Meta headline
  description: string            // Meta description / Google description 2
  callToAction: string           // Meta CTA type

  // Google RSA specific
  headlines?: string[]           // 5-10 headlines (max 30 chars each)
  descriptions?: string[]        // 2-4 descriptions (max 90 chars each)
  finalUrl?: string
  keywords?: string[]            // suggested keywords

  // Context
  reasoning: string              // why this ad was proposed (competitor gaps + data)
  competitorInsight: string      // what competitors do differently
  expectedPerformance: string
  confidence: number
}

export interface AdCreationResult {
  proposals: FullAdProposal[]
  aiGenerated: boolean
  error?: string
}

/* ── Build AI prompt with all context ── */
function buildFullAutoPrompt(
  platform: Platform,
  userProfile: UserAdProfile,
  comparison: CompetitorComparison,
  competitorAds: CompetitorAd[],
  campaigns: DeepCampaignInsight[],
): { system: string; user: string } {
  const isGoogle = platform === 'Google'

  const system = `Sen YoAi platformunun reklam oluşturma AI'ısın. Görevin:
1. Kullanıcının mevcut reklamlarını analiz etmek
2. Rakip reklamlarını incelemek
3. Kullanıcı reklamları ile rakip reklamlarını kıyaslamak
4. Bu kıyaslamadan çıkan boşlukları ve fırsatları kullanarak TAM BİR REKLAM YAPISI oluşturmak

PLATFORM: ${platform}
${isGoogle ? `
GOOGLE ADS KURALLARI:
- Kampanya tipi: SEARCH (RSA — Responsive Search Ad)
- Başlıklar: minimum 5, maximum 10 adet, her biri max 30 karakter
- Açıklamalar: minimum 2, maximum 4 adet, her biri max 90 karakter
- Final URL gerekli
- Anahtar kelimeler öner
- Teklif stratejisi: MAXIMIZE_CLICKS veya MAXIMIZE_CONVERSIONS
- Bütçe TRY cinsinden (minimum 50 TRY/gün)
` : `
META ADS KURALLARI:
- Kampanya amacı: OUTCOME_TRAFFIC, OUTCOME_ENGAGEMENT, OUTCOME_LEADS, OUTCOME_SALES
- Birincil metin: 125 karakter ideal, max 250
- Başlık: max 40 karakter
- Açıklama: max 30 karakter
- CTA: LEARN_MORE, SHOP_NOW, SIGN_UP, CONTACT_US, GET_OFFER, SEND_MESSAGE
- Optimizasyon hedefi: LINK_CLICKS, LANDING_PAGE_VIEWS, LEAD_GENERATION, OFFSITE_CONVERSIONS
- Bütçe TRY cinsinden (minimum 35 TRY/gün)
`}

ÖNEMLİ KURALLAR:
- Türkçe reklam metinleri yaz
- Rakiplerin güçlü yönlerini analiz et ama kullanıcıyı FARKLILAŞTIR
- Rakiplerin kullanmadığı ama kullanıcının kullanabileceği temaları öne çıkar
- Tespit edilen boşluklara odaklan
- Gerçekçi performans tahmini yap (mevcut CTR ve CPC verilerine dayalı)
- Her öneri için NEDEN bu şekilde önerildiğini detaylı açıkla
- 2-3 farklı varyasyon oluştur (her biri farklı strateji)

SADECE aşağıdaki JSON formatında yanıt ver:
{
  "proposals": [
    {
      "id": "proposal_1",
      "platform": "${platform}",
      "campaignName": "Kampanya adı (Türkçe)",
      "campaignObjective": "${isGoogle ? 'SEARCH' : 'OUTCOME_TRAFFIC veya uygun amaç'}",
      "dailyBudget": ${isGoogle ? '50' : '35'},
      "adsetName": "Reklam seti / Ad group adı",
      "targetingDescription": "Hedefleme açıklaması (Türkçe)",
      ${isGoogle ? `"biddingStrategy": "MAXIMIZE_CLICKS",` : `"optimizationGoal": "LINK_CLICKS",`}
      "adName": "Reklam adı",
      "primaryText": "Ana metin (Türkçe)",
      "headline": "Başlık (Türkçe)",
      "description": "Açıklama (Türkçe)",
      ${isGoogle ? `"headlines": ["Başlık 1", "Başlık 2", "Başlık 3", "Başlık 4", "Başlık 5"],
      "descriptions": ["Açıklama 1", "Açıklama 2"],
      "finalUrl": "https://ornek.com",
      "keywords": ["anahtar kelime 1", "anahtar kelime 2"],` : `"callToAction": "LEARN_MORE",`}
      "reasoning": "Bu reklam neden önerildi — rakip analizi ve veri bazlı gerekçe (Türkçe, detaylı)",
      "competitorInsight": "Rakipler şunu yapıyor ama siz yapmıyorsunuz / Rakiplerden farklılaşma noktanız (Türkçe)",
      "expectedPerformance": "Beklenen CTR ve CPC tahmini (Türkçe)",
      "confidence": 80
    }
  ]
}`

  const topCompetitorTexts = competitorAds
    .slice(0, 8)
    .map((a, i) => `  ${i + 1}. [${a.pageName}] "${a.body?.slice(0, 120) || a.title || 'metin yok'}"`)
    .join('\n')

  const userCampaignSummary = campaigns.slice(0, 8).map((c, i) =>
    `  ${i + 1}. ${c.platform} | ${c.campaignName} | CTR: ${(c.metrics.ctr * 100).toFixed(1)}% | CPC: ₺${c.metrics.cpc.toFixed(2)} | Harcama: ₺${c.metrics.spend.toFixed(0)} | Skor: ${c.score}/100`
  ).join('\n')

  const user = `KULLANICININ MEVCUT REKLAM PROFİLİ:
- Anahtar kelimeler: ${userProfile.keywords.join(', ')}
- Mesaj temaları: ${userProfile.themes.length > 0 ? userProfile.themes.join(', ') : 'belirgin tema yok'}
- Ortalama CTR: %${userProfile.avgCtr.toFixed(2)}
- Ortalama CPC: ₺${userProfile.avgCpc.toFixed(2)}
- Toplam harcama: ₺${userProfile.totalSpend.toFixed(0)}
- En iyi reklamlar: ${userProfile.topPerformingAds.map(a => `${a.name} (CTR: ${(a.ctr * 100).toFixed(1)}%)`).join(', ') || 'yok'}

KAMPANYA DETAYLARI:
${userCampaignSummary}

RAKİP REKLAM ANALİZİ (Meta Ad Library):
${topCompetitorTexts || '  Rakip verisi bulunamadı'}

RAKİP KARŞILAŞTIRMA SONUCU:
${comparison.competitorSummary}

TESPİT EDİLEN BOŞLUKLAR:
${comparison.gaps.map(g => `- [${g.priority}] ${g.title}: ${g.recommendation}`).join('\n') || '- Belirgin boşluk tespit edilemedi'}

GÖREV: ${platform} için 2-3 farklı tam reklam yapısı (kampanya + reklam seti + reklam) oluştur.
Her biri farklı bir strateji kullansın (ör. biri fiyat odaklı, biri kalite odaklı, biri aciliyet odaklı).
Rakiplerin boşluklarından faydalanarak farklılaşan reklamlar öner.`

  return { system, user }
}

/* ── Call AI ── */
async function callAI(system: string, user: string): Promise<string | null> {
  // OpenAI
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
          messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
          temperature: 0.7,
          max_tokens: 4000,
          response_format: { type: 'json_object' },
        }),
        signal: AbortSignal.timeout(30000),
      })
      if (res.ok) {
        const data = await res.json()
        return data.choices?.[0]?.message?.content ?? null
      }
    } catch (e) { console.error('[AdCreator] OpenAI error:', e) }
  }

  // Claude fallback
  const claudeKey = process.env.ANTHROPIC_API_KEY
  if (claudeKey) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': claudeKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 4000, system, messages: [{ role: 'user', content: user }] }),
        signal: AbortSignal.timeout(30000),
      })
      if (res.ok) {
        const data = await res.json()
        return data.content?.[0]?.text ?? null
      }
    } catch (e) { console.error('[AdCreator] Claude error:', e) }
  }

  return null
}

/* ── Main: Generate Full Auto Proposals ── */
export async function generateFullAutoProposals(
  platform: Platform,
  userProfile: UserAdProfile,
  comparison: CompetitorComparison,
  competitorAds: CompetitorAd[],
  campaigns: DeepCampaignInsight[],
): Promise<AdCreationResult> {
  const { system, user } = buildFullAutoPrompt(platform, userProfile, comparison, competitorAds, campaigns)

  const aiContent = await callAI(system, user)

  if (!aiContent) {
    return { proposals: [], aiGenerated: false, error: 'AI servisi yanıt vermedi' }
  }

  try {
    const parsed = JSON.parse(aiContent)
    const proposals: FullAdProposal[] = Array.isArray(parsed.proposals)
      ? parsed.proposals.map((p: FullAdProposal, i: number) => ({
          ...p,
          id: p.id || `proposal_${i + 1}`,
          platform,
        }))
      : []

    return { proposals, aiGenerated: true }
  } catch (e) {
    console.error('[AdCreator] Parse error:', e)
    return { proposals: [], aiGenerated: false, error: 'AI yanıtı işlenemedi' }
  }
}
