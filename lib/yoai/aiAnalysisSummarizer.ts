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

/* ── Deterministic Fallback ── */
const PROBLEM_ACTIONS: Record<string, { title: string; reason: string; impact: string; actionType: string; priority: 'high' | 'medium' | 'low' }> = {
  LOW_CTR: { title: 'Reklam metnini ve kreatifleri yenile', reason: 'CTR düşük — reklam dikkat çekemiyor', impact: 'CTR artışı bekleniyor', actionType: 'refresh_creative', priority: 'high' },
  HIGH_CPC: { title: 'Teklif stratejisini gözden geçir', reason: 'CPC çok yüksek — bütçe verimsiz harcanıyor', impact: 'CPC düşüşü ve daha fazla tıklama', actionType: 'decrease_budget', priority: 'high' },
  HIGH_CPA: { title: 'Dönüşüm maliyetini azalt', reason: 'Dönüşüm başı maliyet çok yüksek', impact: 'CPA düşüşü bekleniyor', actionType: 'decrease_budget', priority: 'high' },
  LOW_ROAS: { title: 'ROAS iyileştirmesi gerekli', reason: 'Reklam harcaması geri dönmüyor', impact: 'ROAS artışı hedefleniyor', actionType: 'decrease_budget', priority: 'high' },
  HIGH_FREQUENCY: { title: 'Kreatif yorgunluğunu gider', reason: 'Frequency yüksek — aynı kişiler tekrar tekrar görüyor', impact: 'Taze kreatifle etkileşim artışı', actionType: 'refresh_creative', priority: 'medium' },
  CRITICAL_FREQUENCY: { title: 'Acil kreatif değişikliği', reason: 'Frequency kritik seviyede — kitlede reklam körlüğü', impact: 'Reklam yorgunluğunun giderilmesi', actionType: 'refresh_creative', priority: 'high' },
  BUDGET_UNDERUTILIZED: { title: 'Bütçeyi artır', reason: 'Mevcut bütçe tam kullanılmıyor', impact: 'Daha fazla gösterim ve tıklama', actionType: 'increase_budget', priority: 'medium' },
  QUALITY_BELOW_AVERAGE: { title: 'Reklam kalitesini iyileştir', reason: 'Meta kalite puanı ortalamanın altında', impact: 'Daha düşük CPC ve daha iyi dağılım', actionType: 'refresh_creative', priority: 'medium' },
  ADSET_IMBALANCE: { title: 'Reklam seti dağılımını dengele', reason: 'Reklam setleri arası performans dengesizliği', impact: 'Bütçe verimliliği artışı', actionType: 'duplicate', priority: 'low' },
  SINGLE_ADSET_RISK: { title: 'Yeni reklam seti oluştur', reason: 'Tek reklam setiyle çalışmak riskli', impact: 'A/B test imkanı ve risk azaltma', actionType: 'duplicate', priority: 'medium' },
  NO_DELIVERY: { title: 'Kampanyayı kontrol et', reason: 'Kampanya teslim yapmıyor — gösterim yok', impact: 'Teslimatın başlaması', actionType: 'pause', priority: 'high' },
  IMPRESSION_SHARE_BUDGET_LOST: { title: 'Bütçeyi artır', reason: 'Bütçe yetersizliğinden gösterim payı kaybediliyor', impact: 'Gösterim payı artışı', actionType: 'increase_budget', priority: 'high' },
  IMPRESSION_SHARE_RANK_LOST: { title: 'Ad Rank iyileştir', reason: 'Reklam sıralaması nedeniyle gösterim kaybı', impact: 'Daha iyi konum ve gösterim payı', actionType: 'increase_budget', priority: 'medium' },
}

function generateDeterministicResults(campaigns: DeepCampaignInsight[]) {
  const summaries: AISummary[] = []
  const actions: DeepAction[] = []
  const drafts: DeepActionDraft[] = []
  let actionIdx = 0

  for (const c of campaigns) {
    // Summary
    const problemNames = c.problemTags.map(p => {
      const labels: Record<string, string> = {
        LOW_CTR: 'düşük CTR', HIGH_CPC: 'yüksek CPC', HIGH_CPA: 'yüksek CPA', LOW_ROAS: 'düşük ROAS',
        HIGH_FREQUENCY: 'yüksek frequency', CRITICAL_FREQUENCY: 'kritik frequency',
        BUDGET_UNDERUTILIZED: 'bütçe düşük kullanım', QUALITY_BELOW_AVERAGE: 'düşük kalite',
        NO_DELIVERY: 'teslimat yok', ADSET_IMBALANCE: 'set dengesizliği', SINGLE_ADSET_RISK: 'tek set riski',
        IMPRESSION_SHARE_BUDGET_LOST: 'bütçe kayıp', IMPRESSION_SHARE_RANK_LOST: 'sıra kayıp',
      }
      return labels[p.id] || p.id
    })

    summaries.push({
      campaignId: c.id,
      summary: c.problemTags.length > 0
        ? `${c.problemTags.length} sorun: ${problemNames.join(', ')}. Harcama ₺${c.metrics.spend.toFixed(0)}, CTR ${(c.metrics.ctr * 100).toFixed(1)}%.`
        : `Kampanya stabil. Harcama ₺${c.metrics.spend.toFixed(0)}, CTR ${(c.metrics.ctr * 100).toFixed(1)}%.`,
      recommendation: c.problemTags.length > 0
        ? PROBLEM_ACTIONS[c.problemTags[0].id]?.reason || 'Detaylı inceleme önerilir.'
        : 'Performans izlenmeye devam edilebilir.',
      confidence: c.score,
      insightStatus: c.score < 30 ? 'review_needed' as const : c.score >= 70 ? 'monitoring' as const : 'review_needed' as const,
    })

    // Actions from problem tags
    for (const tag of c.problemTags) {
      const template = PROBLEM_ACTIONS[tag.id]
      if (!template) continue
      actionIdx++
      actions.push({
        id: `det_action_${actionIdx}`,
        title: template.title,
        reason: template.reason,
        expectedImpact: template.impact,
        requiresApproval: true,
        priority: template.priority,
        campaignName: c.campaignName,
        campaignId: c.id,
        platform: c.platform,
        targetEntityType: 'campaign',
        targetEntityId: c.id,
        actionType: template.actionType,
      })
    }
  }

  // Generate drafts from top actions
  for (const action of actions.slice(0, 5)) {
    drafts.push({
      id: `det_draft_${action.id}`,
      title: action.title,
      description: `${action.campaignName}: ${action.reason}`,
      platform: action.platform,
      campaign: action.campaignName,
      campaignId: action.campaignId,
      createdAt: 'Otomatik',
      type: action.actionType.includes('budget') ? 'budget' as const
        : action.actionType.includes('creative') ? 'creative' as const
        : action.actionType.includes('pause') ? 'status' as const
        : 'targeting' as const,
      targetEntityType: action.targetEntityType,
      targetEntityId: action.targetEntityId,
    })
  }

  // Sort actions by priority
  const priorityOrder = { high: 0, medium: 1, low: 2 }
  actions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])

  return { summaries, actions: actions.slice(0, 10), drafts, aiGenerated: false }
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
    // Deterministic fallback — generate summaries + actions from problem tags
    return generateDeterministicResults(campaigns)
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
