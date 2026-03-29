/* ──────────────────────────────────────────────────────────
   AI Analysis Summarizer
   Takes deterministic analysis results, sends to AI for
   Turkish summaries, prioritization, and actionable recs.
   Primary: OpenAI, Fallback: Claude API.
   ────────────────────────────────────────────────────────── */

import type { DeepCampaignInsight, AISummary, DeepAction, DeepActionDraft } from './analysisTypes'

/* ── Compact campaign data for AI ── */
function buildCampaignContext(campaigns: DeepCampaignInsight[]): string {
  return campaigns.map((c, i) => {
    const problems = c.problemTags.map(p => `${p.severity}:${p.id}`).join(', ')
    const adsetCount = c.adsets.length
    const adCount = c.adsets.reduce((s, as) => s + as.ads.length, 0)

    return `[${i + 1}] ${c.platform} | ${c.campaignName}
  Amaç: ${c.objective} | Durum: ${c.status} | Skor: ${c.score}/100
  Harcama: ₺${c.metrics.spend.toFixed(0)} | Gösterim: ${c.metrics.impressions} | Tıklama: ${c.metrics.clicks}
  CTR: ${(c.metrics.ctr * 100).toFixed(1)}% | CPC: ₺${c.metrics.cpc.toFixed(2)} | Dönüşüm: ${c.metrics.conversions}
  ROAS: ${c.metrics.roas != null ? c.metrics.roas.toFixed(2) + 'x' : 'N/A'}
  Bütçe: ${c.dailyBudget ? '₺' + c.dailyBudget.toFixed(0) + '/gün' : 'N/A'}
  Adset: ${adsetCount} | Reklam: ${adCount}
  Sorunlar: ${problems || 'Yok'}
  ${c.metrics.frequency ? 'Frequency: ' + c.metrics.frequency.toFixed(1) : ''}`
  }).join('\n\n')
}

const SYSTEM_PROMPT = `Sen YoAi platformunun dijital reklam analiz AI'ısın. Meta Ads ve Google Ads kampanyalarını derinlemesine analiz ediyorsun.

Verilen kampanya verileri ve deterministik sorun tespitleri üzerinden:
1. Her kampanya için Türkçe durum özeti yaz (1-2 cümle)
2. Her kampanya için spesifik, uygulanabilir öneri yaz (Türkçe)
3. Kampanyaları önceliklendirerek aksiyonlar öner
4. Her kampanya için confidence skoru ver (0-100)
5. Her kampanya için durum belirle: monitoring (stabil), review_needed (dikkat gerek), ready_for_approval (aksiyon hazır)

KURALLAR:
- Gerçek verilere dayan, uydurma yapma
- Sorun etiketlerini (HIGH_CPC, LOW_CTR vb.) göz önünde bulundur
- Skor düşükse ciddi uyarılar ver
- Frequency > 3 ise kreatif yorgunluğu riski belirt
- ROAS < 1 ise zarar durumunu açıkla
- Her platform için (Meta/Google) farklı beklentiler kullan
- Aksiyonlarda spesifik entity ID'leri kullan

SADECE aşağıdaki JSON formatında yanıt ver:
{
  "summaries": [
    {
      "campaignId": "id",
      "summary": "Türkçe durum özeti",
      "recommendation": "Türkçe spesifik öneri",
      "confidence": 85,
      "insightStatus": "monitoring|review_needed|ready_for_approval"
    }
  ],
  "actions": [
    {
      "id": "action_1",
      "title": "Aksiyon başlığı (Türkçe)",
      "reason": "Neden (Türkçe)",
      "expectedImpact": "Beklenen etki (Türkçe)",
      "requiresApproval": true,
      "priority": "high|medium|low",
      "campaignName": "kampanya adı",
      "campaignId": "kampanya_id",
      "platform": "Meta|Google",
      "targetEntityType": "campaign|adset|ad_group|ad",
      "targetEntityId": "entity_id",
      "actionType": "pause|increase_budget|decrease_budget|duplicate|refresh_creative"
    }
  ],
  "drafts": [
    {
      "id": "draft_1",
      "title": "Taslak başlığı (Türkçe)",
      "description": "Detay (Türkçe)",
      "platform": "Meta|Google",
      "campaign": "kampanya adı",
      "campaignId": "id",
      "type": "budget|creative|targeting|bid|status",
      "targetEntityType": "campaign|adset|ad",
      "targetEntityId": "entity_id"
    }
  ]
}`

/* ── Call AI (OpenAI primary, Claude fallback) ── */
async function callAI(userMessage: string): Promise<string | null> {
  // 1. Try OpenAI
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
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userMessage },
          ],
          temperature: 0.3,
          max_tokens: 4000,
          response_format: { type: 'json_object' },
        }),
        signal: AbortSignal.timeout(30000),
      })

      if (res.ok) {
        const data = await res.json()
        return data.choices?.[0]?.message?.content ?? null
      }
      console.error('[AISummarizer] OpenAI error:', res.status)
    } catch (e) {
      console.error('[AISummarizer] OpenAI failed:', e)
    }
  }

  // 2. Fallback to Claude
  const claudeKey = process.env.ANTHROPIC_API_KEY
  if (claudeKey) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': claudeKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4000,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: userMessage }],
        }),
        signal: AbortSignal.timeout(30000),
      })

      if (res.ok) {
        const data = await res.json()
        const text = data.content?.[0]?.text
        return text ?? null
      }
      console.error('[AISummarizer] Claude error:', res.status)
    } catch (e) {
      console.error('[AISummarizer] Claude failed:', e)
    }
  }

  return null
}

/* ── Main ── */
export async function summarizeWithAI(campaigns: DeepCampaignInsight[]): Promise<{
  summaries: AISummary[]
  actions: DeepAction[]
  drafts: DeepActionDraft[]
  aiGenerated: boolean
}> {
  if (campaigns.length === 0) {
    return { summaries: [], actions: [], drafts: [], aiGenerated: false }
  }

  const context = buildCampaignContext(campaigns)
  const userMessage = `Aşağıdaki kampanya verilerini analiz et. ${campaigns.length} kampanya var.\n\n${context}`

  const aiContent = await callAI(userMessage)

  if (!aiContent) {
    // Deterministic fallback — generate basic summaries from problem tags
    const summaries: AISummary[] = campaigns.map(c => ({
      campaignId: c.id,
      summary: c.problemTags.length > 0
        ? `${c.problemTags.length} sorun tespit edildi: ${c.problemTags.map(p => p.id).join(', ')}`
        : 'Kampanya stabil görünüyor.',
      recommendation: c.score < 50
        ? 'Kampanya performansı düşük, detaylı inceleme önerilir.'
        : 'Mevcut performans kabul edilebilir seviyede.',
      confidence: c.score,
      insightStatus: c.score < 30 ? 'review_needed' as const
        : c.score >= 70 ? 'monitoring' as const
        : 'review_needed' as const,
    }))

    return { summaries, actions: [], drafts: [], aiGenerated: false }
  }

  try {
    const parsed = JSON.parse(aiContent)

    const summaries: AISummary[] = Array.isArray(parsed.summaries)
      ? parsed.summaries.map((s: AISummary) => ({
          campaignId: s.campaignId,
          summary: s.summary || '',
          recommendation: s.recommendation || '',
          confidence: s.confidence || 50,
          insightStatus: s.insightStatus || 'monitoring',
        }))
      : []

    const actions: DeepAction[] = Array.isArray(parsed.actions)
      ? parsed.actions.map((a: DeepAction) => ({
          ...a,
          id: a.id || `action_${Math.random().toString(36).slice(2, 8)}`,
        }))
      : []

    const drafts: DeepActionDraft[] = Array.isArray(parsed.drafts)
      ? parsed.drafts.map((d: DeepActionDraft) => ({
          ...d,
          id: d.id || `draft_${Math.random().toString(36).slice(2, 8)}`,
          createdAt: 'Az önce',
        }))
      : []

    return { summaries, actions, drafts, aiGenerated: true }
  } catch (e) {
    console.error('[AISummarizer] Parse error:', e)
    return {
      summaries: campaigns.map(c => ({
        campaignId: c.id,
        summary: 'AI yanıtı işlenemedi.',
        recommendation: 'Manuel inceleme önerilir.',
        confidence: 50,
        insightStatus: 'review_needed' as const,
      })),
      actions: [],
      drafts: [],
      aiGenerated: false,
    }
  }
}
