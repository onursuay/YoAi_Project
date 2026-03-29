/* ──────────────────────────────────────────────────────────
   Competitor Analyzer — Phase 4
   Meta Ad Library + Google Auction Insights aggregation.
   ────────────────────────────────────────────────────────── */

import type { Platform } from './analysisTypes'

/* ── Types ── */
export interface GoogleCompetitor {
  domain: string
  impressionShare: number
  overlapRate: number
  positionAboveRate: number
  topOfPageRate: number
  outRankingShare: number
}

export interface MetaAdLibraryAd {
  id: string
  pageName: string
  pageId: string
  adCreativeBody?: string
  adCreativeLinkTitle?: string
  adCreativeDescription?: string
  adStartDate?: string
  adEndDate?: string
  platforms: string[]
  isActive: boolean
}

export interface CompetitorInsight {
  id: string
  title: string
  description: string
  platform: Platform
  type: 'opportunity' | 'threat' | 'info'
}

export interface CompetitorData {
  google: GoogleCompetitor[]
  metaAds: MetaAdLibraryAd[]
  aiInsights: CompetitorInsight[]
  errors: string[]
}

/* ── Fetch Google Auction competitors ── */
export async function fetchGoogleCompetitors(cookieHeader: string, baseUrl: string): Promise<{ competitors: GoogleCompetitor[]; errors: string[] }> {
  const errors: string[] = []
  const competitors: GoogleCompetitor[] = []

  try {
    // First get campaigns
    const campaignsRes = await fetch(`${baseUrl}/api/integrations/google-ads/campaigns?showInactive=0`, {
      headers: { Cookie: cookieHeader },
    })

    if (!campaignsRes.ok) {
      return { competitors, errors: ['Google kampanya verisi alınamadı'] }
    }

    const campaignsData = await campaignsRes.json()
    const campaigns = campaignsData.campaigns || []

    // Get top 5 campaigns by spend
    const topCampaigns = campaigns
      .filter((c: any) => c.amountSpent > 0)
      .sort((a: any, b: any) => (b.amountSpent || 0) - (a.amountSpent || 0))
      .slice(0, 5)

    // Fetch auction insights for each
    const domainMap = new Map<string, GoogleCompetitor>()

    for (const campaign of topCampaigns) {
      try {
        const res = await fetch(`${baseUrl}/api/integrations/google-ads/campaigns/${campaign.campaignId}/competitor-auction-insights`, {
          headers: { Cookie: cookieHeader },
        })

        if (res.ok) {
          const data = await res.json()
          const rows = data.competitors || data.data || []

          for (const row of rows) {
            const domain = row.domain || row.displayDomain || ''
            if (!domain) continue

            const existing = domainMap.get(domain)
            if (existing) {
              // Average the metrics
              existing.impressionShare = (existing.impressionShare + (row.impressionShare || 0)) / 2
              existing.overlapRate = (existing.overlapRate + (row.overlapRate || 0)) / 2
              existing.positionAboveRate = (existing.positionAboveRate + (row.positionAboveRate || 0)) / 2
              existing.topOfPageRate = (existing.topOfPageRate + (row.topOfPageRate || 0)) / 2
              existing.outRankingShare = (existing.outRankingShare + (row.outRankingShare || 0)) / 2
            } else {
              domainMap.set(domain, {
                domain,
                impressionShare: row.impressionShare || 0,
                overlapRate: row.overlapRate || 0,
                positionAboveRate: row.positionAboveRate || 0,
                topOfPageRate: row.topOfPageRate || 0,
                outRankingShare: row.outRankingShare || 0,
              })
            }
          }
        }
      } catch {
        // Skip failed campaigns
      }
    }

    competitors.push(...Array.from(domainMap.values()).sort((a, b) => b.impressionShare - a.impressionShare))
  } catch (e) {
    console.error('[CompetitorAnalyzer] Google error:', e)
    errors.push('Google rakip verisi alınamadı')
  }

  return { competitors, errors }
}

/* ── Fetch Meta Ad Library ── */
export async function fetchMetaAdLibrary(
  query: string,
  country: string,
  cookieHeader: string,
  baseUrl: string,
): Promise<{ ads: MetaAdLibraryAd[]; errors: string[] }> {
  const errors: string[] = []
  const ads: MetaAdLibraryAd[] = []

  try {
    // Use resolveMetaContext via internal API
    const res = await fetch(`${baseUrl}/api/yoai/competitors/meta-ad-library?q=${encodeURIComponent(query)}&country=${country}`, {
      headers: { Cookie: cookieHeader },
    })

    if (res.ok) {
      const data = await res.json()
      if (data.ok && Array.isArray(data.data)) {
        ads.push(...data.data)
      }
    } else {
      errors.push('Meta Ad Library verisi alınamadı')
    }
  } catch (e) {
    console.error('[CompetitorAnalyzer] Meta Ad Library error:', e)
    errors.push('Meta Ad Library bağlantı hatası')
  }

  return { ads, errors }
}

/* ── AI Competitor Analysis ── */
export async function analyzeCompetitors(
  googleCompetitors: GoogleCompetitor[],
  metaAds: MetaAdLibraryAd[],
): Promise<CompetitorInsight[]> {
  const insights: CompetitorInsight[] = []

  // Deterministic insights from Google data
  for (const comp of googleCompetitors.slice(0, 5)) {
    if (comp.impressionShare > 0.5) {
      insights.push({
        id: `google_threat_${comp.domain}`,
        title: `${comp.domain} yüksek gösterim payına sahip`,
        description: `Bu rakip %${(comp.impressionShare * 100).toFixed(0)} gösterim payıyla sizi geçiyor. Teklif stratejinizi ve reklam kalitesini gözden geçirin.`,
        platform: 'Google',
        type: 'threat',
      })
    }
    if (comp.positionAboveRate > 0.4) {
      insights.push({
        id: `google_above_${comp.domain}`,
        title: `${comp.domain} sizin üstünüzde konumlanıyor`,
        description: `%${(comp.positionAboveRate * 100).toFixed(0)} oranında sizden üstte görünüyor. Ad Rank artırmak için kalite puanı ve teklifleri iyileştirin.`,
        platform: 'Google',
        type: 'info',
      })
    }
  }

  if (googleCompetitors.length === 0 && metaAds.length === 0) {
    insights.push({
      id: 'no_data',
      title: 'Rakip verisi bulunamadı',
      description: 'Google Auction Insights verisi mevcut değil veya Meta Ad Library araması yapılmadı.',
      platform: 'Google',
      type: 'info',
    })
  }

  return insights
}
