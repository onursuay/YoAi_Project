/* ──────────────────────────────────────────────────────────
   YoAlgoritma — Tek Kampanya Metrik Çekici (ID ile, durum bağımsız)

   Outcome ölçümü için: belirli bir kampanyanın (PAUSED dahil) son N günlük
   gerçek metriklerini ID ile çeker. Deep fetcher SADECE aktif kampanyaları
   döndürdüğü için yeni yayınlanan (PAUSED) kampanya onunla ölçülemez — bu
   helper doğrudan insights/GAQL ile çeker.

   Cron bağlamı (cookie yok) için DB connection store'larından kimlik çözer.
   Hata/yetki yoksa null döner — SAHTE VERİ ÜRETİLMEZ.
   ────────────────────────────────────────────────────────── */

import { metaGraphFetch } from '@/lib/metaGraph'
import { normalizeInsights } from '@/lib/meta/optimization/insightsNormalizer'
import { getGoogleAdsAccessToken, searchGAds } from '@/lib/googleAdsAuth'
import type { MetricSnapshot } from '@/lib/yoai/resultTrackingStore'

type AiPlatformLower = 'meta' | 'google'

function num(v: unknown): number {
  const n = Number(v ?? 0)
  return Number.isFinite(n) ? n : 0
}

/** Meta kampanya metrikleri (ID ile, son `days` gün). */
async function fetchMetaCampaignMetrics(campaignId: string, userId: string): Promise<MetricSnapshot | null> {
  try {
    const { getMetaConnection } = await import('@/lib/metaConnectionStore')
    const conn = await getMetaConnection(userId)
    if (!conn?.accessToken) return null
    const fields = 'spend,impressions,clicks,ctr,cpc,reach,frequency,cpm,actions,action_values,purchase_roas'
    const res = await metaGraphFetch(
      `/${campaignId}/insights`,
      conn.accessToken,
      { params: { date_preset: 'last_14d', fields } },
    )
    if (!res.ok) return null
    const data = await res.json().catch(() => ({ data: [] }))
    const raw = data?.data?.[0]
    if (!raw) return null
    const n = normalizeInsights(raw)
    const { countMetaConversions } = await import('@/lib/yoai/metaConversions')
    const conversions = countMetaConversions(n.actions)
    return {
      ctr: n.ctr,
      cpc: n.cpc,
      spend: n.spend,
      impressions: n.impressions,
      clicks: n.clicks,
      conversions,
      roas: n.websitePurchaseRoas > 0 ? n.websitePurchaseRoas : null,
      reach: n.reach,
      frequency: n.frequency,
    }
  } catch (e) {
    console.warn('[campaignMetricsById] Meta fetch error:', e instanceof Error ? e.message : e)
    return null
  }
}

/** Google kampanya metrikleri (ID ile, son 14 gün). */
async function fetchGoogleCampaignMetrics(campaignId: string, userId: string): Promise<MetricSnapshot | null> {
  try {
    const { getConnection } = await import('@/lib/googleAdsConnectionStore')
    const conn = await getConnection(userId)
    if (!conn?.refreshToken || !conn?.customerId) return null
    const accessToken = await getGoogleAdsAccessToken(conn.refreshToken)
    const ctx = {
      accessToken,
      customerId: conn.customerId.replace(/-/g, ''),
      loginCustomerId: (conn.loginCustomerId || conn.customerId).replace(/-/g, ''),
      locale: 'tr',
    }
    const now = new Date()
    const to = now.toISOString().slice(0, 10)
    const from = new Date(now.getTime() - 14 * 86400000).toISOString().slice(0, 10)
    const query = `
      SELECT metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.ctr,
        metrics.average_cpc, metrics.conversions, metrics.conversions_value
      FROM campaign
      WHERE campaign.id = ${Number(campaignId)}
        AND segments.date BETWEEN '${from}' AND '${to}'
    `.trim()
    const rows = await searchGAds<{ metrics?: Record<string, unknown> }>(ctx, query)
    if (!rows.length) return null
    let spend = 0, impressions = 0, clicks = 0, conversions = 0, convValue = 0
    for (const r of rows) {
      const m = r.metrics ?? {}
      spend += num(m.cost_micros ?? (m as any).costMicros) / 1_000_000
      impressions += num(m.impressions)
      clicks += num(m.clicks)
      conversions += num(m.conversions)
      convValue += num(m.conversions_value ?? (m as any).conversionsValue)
    }
    return {
      ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
      cpc: clicks > 0 ? spend / clicks : 0,
      spend,
      impressions,
      clicks,
      conversions,
      roas: spend > 0 && convValue > 0 ? convValue / spend : null,
    }
  } catch (e) {
    console.warn('[campaignMetricsById] Google fetch error:', e instanceof Error ? e.message : e)
    return null
  }
}

/** Platforma göre tek kampanya metriklerini ID ile çeker. Yetki/veri yoksa null. */
export async function fetchCampaignMetricsById(
  platform: AiPlatformLower,
  campaignId: string,
  userId: string,
): Promise<MetricSnapshot | null> {
  if (!campaignId || !userId) return null
  return platform === 'google'
    ? fetchGoogleCampaignMetrics(campaignId, userId)
    : fetchMetaCampaignMetrics(campaignId, userId)
}
