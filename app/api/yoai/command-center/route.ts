import { NextResponse } from 'next/server'
import { resolveMetaContext } from '@/lib/meta/context'
import { metaGraphFetch } from '@/lib/metaGraph'
import type {
  CommandCenterData,
  CampaignInsight,
  RecommendedAction,
  ActionDraft,
  HealthOverview,
  Platform,
} from '@/lib/yoai/commandCenter'

export const dynamic = 'force-dynamic'

/* ────────────────────────────────────────────────────────────
   GET /api/yoai/command-center
   Aggregates campaign data from Meta + Google, sends to AI
   for structured analysis, returns CommandCenterData.
   ──────────────────────────────────────────────────────────── */
export async function GET() {
  const errors: string[] = []
  const platforms: string[] = []

  // ── Collect raw campaign data from both platforms ──
  interface RawCampaign {
    platform: Platform
    id: string
    name: string
    status: string
    objective?: string
    spend: number
    impressions: number
    clicks: number
    ctr: number
    cpc: number
    reach?: number
    roas?: number | null
    conversions?: number
    budget?: number | null
    dailyBudget?: number | null
    frequency?: number
  }

  const rawCampaigns: RawCampaign[] = []

  // ── 1. Fetch Meta campaigns ──
  try {
    const metaCtx = await resolveMetaContext()
    if (metaCtx) {
      platforms.push('Meta')

      const insightsFields = 'spend,impressions,clicks,ctr,cpc,reach,frequency,actions,action_values,purchase_roas'
      const insightsModifier = `insights.date_preset(last_30d){${insightsFields}}`

      const params: Record<string, string> = {
        fields: `id,name,status,effective_status,objective,daily_budget,lifetime_budget,${insightsModifier}`,
        limit: '100',
        effective_status: '["ACTIVE","PAUSED","WITH_ISSUES"]',
      }

      const response = await metaGraphFetch(
        `/${metaCtx.accountId}/campaigns`,
        metaCtx.userAccessToken,
        { params },
      )

      if (response.ok) {
        const data = await response.json().catch(() => ({ data: [] }))
        const campaigns = data.data || []

        for (const c of campaigns) {
          const insight = c.insights?.data?.[0]
          const spend = insight?.spend ? parseFloat(insight.spend) : 0
          const impressions = insight?.impressions ? parseInt(insight.impressions, 10) : 0
          const clicks = insight?.clicks ? parseInt(insight.clicks, 10) : 0
          const ctr = insight?.ctr ? parseFloat(insight.ctr) : 0
          const cpc = insight?.cpc ? parseFloat(insight.cpc) : 0
          const reach = insight?.reach ? parseInt(insight.reach, 10) : 0
          const frequency = insight?.frequency ? parseFloat(insight.frequency) : 0
          const dailyBudget = c.daily_budget != null ? parseFloat(c.daily_budget) / 100 : null
          const lifetimeBudget = c.lifetime_budget != null ? parseFloat(c.lifetime_budget) / 100 : null

          let roas: number | null = null
          if (insight?.purchase_roas) {
            if (Array.isArray(insight.purchase_roas) && insight.purchase_roas[0]?.value) {
              roas = parseFloat(insight.purchase_roas[0].value)
            } else if (typeof insight.purchase_roas === 'number') {
              roas = insight.purchase_roas
            } else if (typeof insight.purchase_roas === 'string') {
              roas = parseFloat(insight.purchase_roas)
            }
          }

          let conversions = 0
          if (insight?.actions) {
            const convAction = insight.actions.find(
              (a: { action_type: string; value?: string }) =>
                a.action_type === 'purchase' ||
                a.action_type === 'lead' ||
                a.action_type === 'offsite_conversion.fb_pixel_purchase',
            )
            if (convAction) conversions = parseInt(convAction.value || '0', 10)
          }

          rawCampaigns.push({
            platform: 'Meta',
            id: c.id,
            name: c.name || 'Unnamed',
            status: c.effective_status || c.status || 'UNKNOWN',
            objective: c.objective || '',
            spend,
            impressions,
            clicks,
            ctr,
            cpc,
            reach,
            roas,
            conversions,
            budget: dailyBudget ?? lifetimeBudget,
            dailyBudget,
            frequency,
          })
        }
      } else {
        errors.push('Meta kampanya verisi alınamadı')
      }
    }
  } catch (e) {
    errors.push('Meta bağlantısı bulunamadı veya hata oluştu')
    console.error('[Command Center] Meta error:', e)
  }

  // ── 2. Fetch Google Ads campaigns ──
  try {
    const { getGoogleAdsContext, searchGAds } = await import('@/lib/googleAdsAuth')
    const { computeDerivedMetrics } = await import('@/lib/google-ads/helpers')

    const googleCtx = await getGoogleAdsContext()
    platforms.push('Google')

    const now = new Date()
    const to = now.toISOString().slice(0, 10)
    const from = new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10)

    const query = `
      SELECT
        campaign.id, campaign.name, campaign.status,
        campaign.optimization_score,
        campaign_budget.amount_micros,
        metrics.impressions, metrics.clicks, metrics.ctr,
        metrics.average_cpc, metrics.cost_micros,
        metrics.conversions, metrics.conversions_value
      FROM campaign
      WHERE segments.date BETWEEN '${from}' AND '${to}'
        AND campaign.status = 'ENABLED'
      ORDER BY metrics.cost_micros DESC
      LIMIT 100
    `.trim()

    type GRow = {
      campaign?: { id?: string; name?: string; status?: string; optimizationScore?: number; optimization_score?: number }
      campaignBudget?: { amountMicros?: string; amount_micros?: string }
      campaign_budget?: { amountMicros?: string; amount_micros?: string }
      metrics?: {
        costMicros?: string | number; cost_micros?: string | number
        impressions?: string | number; clicks?: string | number
        ctr?: number
        averageCpc?: string | number; average_cpc?: string | number
        conversions?: string | number
        conversions_value?: string | number; conversionsValue?: string | number
      }
    }

    const rows = await searchGAds<GRow>(googleCtx, query)

    // Aggregate by campaign ID
    const byId = new Map<string, {
      id: string; name: string; status: string
      impressions: number; clicks: number; costMicros: number
      conversions: number; conversionsValue: number
      budgetMicros: number | null
    }>()

    for (const r of rows) {
      const c = r.campaign
      const m = r.metrics
      const cb = r.campaignBudget ?? r.campaign_budget
      const id = c?.id ?? ''
      if (!id) continue

      const impressions = Number(m?.impressions ?? 0)
      const clicks = Number(m?.clicks ?? 0)
      const costMicros = Number(m?.costMicros ?? m?.cost_micros ?? 0)
      const conversions = Number(m?.conversions ?? 0)
      const conversionsValue = Number(m?.conversions_value ?? m?.conversionsValue ?? 0)
      const budgetMicrosRaw = cb?.amountMicros ?? cb?.amount_micros
      const budgetMicros = budgetMicrosRaw != null ? Number(budgetMicrosRaw) : null

      const existing = byId.get(id)
      if (existing) {
        existing.impressions += impressions
        existing.clicks += clicks
        existing.costMicros += costMicros
        existing.conversions += conversions
        existing.conversionsValue += conversionsValue
      } else {
        byId.set(id, {
          id, name: c?.name ?? '', status: c?.status ?? 'UNKNOWN',
          impressions, clicks, costMicros, conversions, conversionsValue,
          budgetMicros,
        })
      }
    }

    for (const agg of byId.values()) {
      const { amountSpent, cpc, ctr, roas } = computeDerivedMetrics(agg)
      rawCampaigns.push({
        platform: 'Google',
        id: agg.id,
        name: agg.name,
        status: agg.status,
        spend: amountSpent,
        impressions: agg.impressions,
        clicks: agg.clicks,
        ctr,
        cpc,
        roas,
        conversions: agg.conversions,
        budget: agg.budgetMicros != null ? agg.budgetMicros / 1_000_000 : null,
        dailyBudget: agg.budgetMicros != null ? agg.budgetMicros / 1_000_000 : null,
      })
    }
  } catch (e) {
    const err = e as { code?: string }
    if (err?.code !== 'google_ads_not_connected') {
      errors.push('Google Ads verisi alınamadı')
    }
    console.error('[Command Center] Google error:', e)
  }

  // ── 3. If no campaigns at all, return empty state ──
  if (rawCampaigns.length === 0) {
    const emptyResult: CommandCenterData = {
      health: {
        connectedAccounts: { count: platforms.length, platforms },
        activeCampaigns: 0,
        criticalAlerts: 0,
        opportunities: 0,
        pendingApprovals: 0,
        draftActions: 0,
      },
      insights: [],
      actions: [],
      drafts: [],
      lastAnalysis: new Date().toISOString(),
      aiGenerated: false,
      errors: platforms.length === 0
        ? ['Henüz bir reklam platformu bağlanmamış. Meta veya Google Ads hesabınızı bağlayın.']
        : errors,
    }
    return NextResponse.json({ ok: true, data: emptyResult })
  }

  // ── 4. Sort by spend descending, pick top campaigns for AI analysis ──
  rawCampaigns.sort((a, b) => b.spend - a.spend)
  const activeCampaigns = rawCampaigns.filter((c) =>
    c.status === 'ACTIVE' || c.status === 'ENABLED',
  )
  const topCampaigns = rawCampaigns.slice(0, 15) // AI will analyze top 15

  // ── 5. Call AI for analysis ──
  let insights: CampaignInsight[] = []
  let actions: RecommendedAction[] = []
  let drafts: ActionDraft[] = []
  let aiGenerated = false

  const apiKey = process.env.OPENAI_API_KEY
  const baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini'

  if (apiKey && topCampaigns.length > 0) {
    try {
      const campaignSummary = topCampaigns.map((c) => ({
        platform: c.platform,
        name: c.name,
        status: c.status,
        objective: c.objective || 'N/A',
        spend: c.spend.toFixed(2),
        impressions: c.impressions,
        clicks: c.clicks,
        ctr: (c.ctr * 100).toFixed(2) + '%',
        cpc: c.cpc.toFixed(2),
        roas: c.roas != null ? c.roas.toFixed(2) + 'x' : 'N/A',
        conversions: c.conversions || 0,
        budget: c.budget?.toFixed(2) || 'N/A',
        frequency: c.frequency?.toFixed(1) || 'N/A',
      }))

      const systemPrompt = `Sen bir dijital reklam analiz AI'ısın. Verilen kampanya verilerini analiz et ve JSON formatında yanıt ver.

KURALLAR:
- Gerçek verilere dayanarak analiz yap
- Abartma veya uydurma yapma
- Metrikler kötüyse bunu açıkça belirt
- CTR < 1% ise düşük, > 3% ise iyi
- CPC yüksekse uyar
- Frequency > 3 ise kreatif yorgunluğu riski var
- ROAS < 1 ise zarar, > 3 ise iyi
- Her kampanya için durum, risk ve öneri belirle

Yanıtını SADECE aşağıdaki JSON formatında ver, başka bir şey yazma:

{
  "insights": [
    {
      "id": "kampanya_id",
      "platform": "Meta" veya "Google",
      "campaignName": "kampanya adı",
      "objective": "kampanya amacı",
      "summary": "Kısa durum özeti (Türkçe, 1-2 cümle)",
      "riskLevel": "low" | "medium" | "high" | "critical",
      "recommendation": "AI önerisi (Türkçe, spesifik ve uygulanabilir)",
      "confidence": 0-100 arası sayı,
      "status": "monitoring" | "review_needed" | "ready_for_approval"
    }
  ],
  "actions": [
    {
      "id": "action_1",
      "title": "Aksiyon başlığı (Türkçe, kısa)",
      "reason": "Neden önerildiği (Türkçe)",
      "expectedImpact": "Beklenen etki (Türkçe, spesifik)",
      "requiresApproval": true/false,
      "priority": "high" | "medium" | "low",
      "campaignName": "ilgili kampanya adı",
      "platform": "Meta" veya "Google"
    }
  ],
  "drafts": [
    {
      "id": "draft_1",
      "title": "Aksiyon taslak başlığı (Türkçe)",
      "description": "Detaylı açıklama (Türkçe)",
      "platform": "Meta" veya "Google",
      "campaign": "kampanya adı",
      "type": "budget" | "creative" | "targeting" | "bid"
    }
  ]
}`

      const userMessage = `Aşağıdaki kampanya verilerini analiz et:

${JSON.stringify(campaignSummary, null, 2)}

Her kampanya için insight oluştur. En önemli 5-8 aksiyon öner. 3-5 aksiyon taslağı hazırla.`

      const aiResponse = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
          ],
          temperature: 0.3,
          max_tokens: 4000,
          response_format: { type: 'json_object' },
        }),
      })

      if (aiResponse.ok) {
        const aiData = await aiResponse.json()
        const content = aiData.choices?.[0]?.message?.content
        if (content) {
          const parsed = JSON.parse(content)

          if (Array.isArray(parsed.insights)) {
            insights = parsed.insights.map((ins: CampaignInsight) => {
              // Attach real metrics from raw data
              const raw = rawCampaigns.find(
                (c) => c.name === ins.campaignName || c.id === ins.id,
              )
              return {
                ...ins,
                metrics: raw
                  ? {
                      spend: raw.spend,
                      impressions: raw.impressions,
                      clicks: raw.clicks,
                      ctr: raw.ctr,
                      cpc: raw.cpc,
                      roas: raw.roas,
                      conversions: raw.conversions,
                    }
                  : undefined,
              }
            })
          }

          if (Array.isArray(parsed.actions)) {
            actions = parsed.actions
          }

          if (Array.isArray(parsed.drafts)) {
            drafts = parsed.drafts.map((d: ActionDraft) => ({
              ...d,
              createdAt: 'Az önce',
            }))
          }

          aiGenerated = true
        }
      } else {
        const errText = await aiResponse.text()
        console.error('[Command Center] AI error:', aiResponse.status, errText)
        errors.push('AI analizi tamamlanamadı')
      }
    } catch (aiErr) {
      console.error('[Command Center] AI parse error:', aiErr)
      errors.push('AI yanıtı işlenemedi')
    }
  } else if (!apiKey) {
    errors.push('AI servisi yapılandırılmamış (OPENAI_API_KEY)')
  }

  // ── 6. Compute health metrics ──
  const criticalAlerts = insights.filter((i) => i.riskLevel === 'critical' || i.riskLevel === 'high').length
  const opportunities = insights.filter((i) => i.status === 'ready_for_approval').length
  const pendingApprovals = drafts.length
  const draftActions = actions.filter((a) => a.requiresApproval).length

  const health: HealthOverview = {
    connectedAccounts: { count: platforms.length, platforms },
    activeCampaigns: activeCampaigns.length,
    criticalAlerts,
    opportunities,
    pendingApprovals,
    draftActions,
  }

  const result: CommandCenterData = {
    health,
    insights,
    actions,
    drafts,
    lastAnalysis: new Date().toISOString(),
    aiGenerated,
    errors,
  }

  return NextResponse.json(
    { ok: true, data: result },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
