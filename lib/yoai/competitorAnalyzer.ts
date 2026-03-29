/* ──────────────────────────────────────────────────────────
   Competitor Analyzer — Phase 4 Enhanced
   Auto keyword extraction, Meta Ad Library, Google Auction,
   AI creative comparison, competitor-informed ad creation.
   ────────────────────────────────────────────────────────── */

import type { DeepCampaignInsight, Platform } from './analysisTypes'

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
  extractedKeywords: string[]
  errors: string[]
}

/* ── Extract keywords from campaign names ── */
export function extractKeywordsFromCampaigns(campaigns: DeepCampaignInsight[]): string[] {
  const stopWords = new Set([
    'campaign', 'kampanya', 'reklam', 'ads', 'ad', 'set', 'grup', 'group',
    'test', 'v1', 'v2', 'v3', 'copy', 'kopya', 'new', 'yeni', 'old', 'eski',
    'the', 'bir', 've', 'ile', 'için', 'den', 'dan', 'de', 'da',
    'search', 'display', 'video', 'pmax', 'performance', 'max',
    'yo', '//', 'set', 'ekim', 'ocak', 'mart', 'nisan', 'mayıs', 'haziran',
    'temmuz', 'ağustos', 'eylül', 'kasım', 'aralık', 'şubat',
    '2024', '2025', '2026', 'tr', 'en',
  ])

  const wordCount = new Map<string, number>()

  for (const c of campaigns) {
    // Extract words from campaign name
    const words = c.campaignName
      .replace(/[^a-zA-ZğüşöçıİĞÜŞÖÇ\s]/g, ' ')
      .split(/\s+/)
      .map(w => w.toLowerCase().trim())
      .filter(w => w.length > 2 && !stopWords.has(w))

    for (const word of words) {
      wordCount.set(word, (wordCount.get(word) || 0) + 1)
    }

    // Also extract from adset names
    for (const as of c.adsets) {
      const asWords = as.name
        .replace(/[^a-zA-ZğüşöçıİĞÜŞÖÇ\s]/g, ' ')
        .split(/\s+/)
        .map(w => w.toLowerCase().trim())
        .filter(w => w.length > 2 && !stopWords.has(w))
      for (const word of asWords) {
        wordCount.set(word, (wordCount.get(word) || 0) + 1)
      }
    }
  }

  // Return top keywords sorted by frequency
  return Array.from(wordCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word)
}

/* ── Fetch Google Auction competitors ── */
export async function fetchGoogleCompetitors(cookieHeader: string, baseUrl: string): Promise<{ competitors: GoogleCompetitor[]; errors: string[] }> {
  const errors: string[] = []
  const competitors: GoogleCompetitor[] = []

  try {
    const campaignsRes = await fetch(`${baseUrl}/api/integrations/google-ads/campaigns?showInactive=0`, {
      headers: { Cookie: cookieHeader },
    })

    if (!campaignsRes.ok) return { competitors, errors: ['Google kampanya verisi alınamadı'] }

    const campaignsData = await campaignsRes.json()
    const campaigns = campaignsData.campaigns || []

    const topCampaigns = campaigns
      .filter((c: any) => c.amountSpent > 0)
      .sort((a: any, b: any) => (b.amountSpent || 0) - (a.amountSpent || 0))
      .slice(0, 5)

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
              existing.impressionShare = (existing.impressionShare + (row.impressionShare || 0)) / 2
              existing.overlapRate = (existing.overlapRate + (row.overlapRate || 0)) / 2
              existing.positionAboveRate = (existing.positionAboveRate + (row.positionAboveRate || 0)) / 2
              existing.topOfPageRate = (existing.topOfPageRate + (row.topOfPageRate || 0)) / 2
              existing.outRankingShare = (existing.outRankingShare + (row.outRankingShare || 0)) / 2
            } else {
              domainMap.set(domain, { domain, impressionShare: row.impressionShare || 0, overlapRate: row.overlapRate || 0, positionAboveRate: row.positionAboveRate || 0, topOfPageRate: row.topOfPageRate || 0, outRankingShare: row.outRankingShare || 0 })
            }
          }
        }
      } catch { /* skip */ }
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
    const res = await fetch(`${baseUrl}/api/yoai/competitors/meta-ad-library?q=${encodeURIComponent(query)}&country=${country}`, {
      headers: { Cookie: cookieHeader },
    })
    if (res.ok) {
      const data = await res.json()
      if (data.ok && Array.isArray(data.data)) ads.push(...data.data)
    } else {
      errors.push('Meta Ad Library verisi alınamadı')
    }
  } catch (e) {
    console.error('[CompetitorAnalyzer] Meta Ad Library error:', e)
    errors.push('Meta Ad Library bağlantı hatası')
  }

  return { ads, errors }
}

/* ── AI Competitor Creative Comparison ── */
export async function analyzeCompetitorsWithAI(
  googleCompetitors: GoogleCompetitor[],
  metaAds: MetaAdLibraryAd[],
  userCampaigns: DeepCampaignInsight[],
): Promise<CompetitorInsight[]> {
  const insights: CompetitorInsight[] = []

  // Deterministic insights from Google
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
        description: `%${(comp.positionAboveRate * 100).toFixed(0)} oranında üstte. Ad Rank için kalite puanı ve teklifleri iyileştirin.`,
        platform: 'Google',
        type: 'info',
      })
    }
  }

  // AI-powered creative comparison (if Meta ads available)
  if (metaAds.length > 0) {
    // Extract competitor patterns
    const competitorTexts = metaAds.slice(0, 10).map(a => a.adCreativeBody || '').filter(Boolean)
    const competitorTitles = metaAds.slice(0, 10).map(a => a.adCreativeLinkTitle || '').filter(Boolean)
    const competitorPages = [...new Set(metaAds.map(a => a.pageName))].slice(0, 5)

    // CTA patterns from competitors
    const urgencyWords = ['şimdi', 'hemen', 'sınırlı', 'son', 'kaçırma', 'fırsat', 'bugün', 'acele']
    const priceWords = ['indirim', 'kampanya', 'fiyat', 'ücretsiz', 'bedava', '%', 'tl', '₺']
    const socialProof = ['binlerce', 'müşteri', 'yıldız', 'puan', 'değerlendirme', 'tercih']

    let hasUrgency = false, hasPrice = false, hasSocialProof = false
    for (const text of competitorTexts) {
      const lower = text.toLowerCase()
      if (urgencyWords.some(w => lower.includes(w))) hasUrgency = true
      if (priceWords.some(w => lower.includes(w))) hasPrice = true
      if (socialProof.some(w => lower.includes(w))) hasSocialProof = true
    }

    if (hasUrgency) {
      insights.push({
        id: 'meta_urgency',
        title: 'Rakipler aciliyet mesajı kullanıyor',
        description: `${competitorPages.slice(0, 3).join(', ')} gibi rakipler "şimdi", "sınırlı süre" gibi aciliyet ifadeleri kullanıyor. Bu stratejiyi değerlendirin.`,
        platform: 'Meta',
        type: 'opportunity',
      })
    }

    if (hasPrice) {
      insights.push({
        id: 'meta_price',
        title: 'Rakipler fiyat/indirim vurgusu yapıyor',
        description: 'Rakip reklamlarda fiyat avantajı ve indirim mesajları öne çıkıyor. Rekabetçi fiyatlama mesajınızı gözden geçirin.',
        platform: 'Meta',
        type: 'info',
      })
    }

    if (hasSocialProof) {
      insights.push({
        id: 'meta_social_proof',
        title: 'Rakipler sosyal kanıt kullanıyor',
        description: 'Rakipler müşteri sayısı, değerlendirme puanı gibi sosyal kanıtlar kullanıyor. Bu unsuru reklamlarınıza ekleyin.',
        platform: 'Meta',
        type: 'opportunity',
      })
    }

    // Check active competitor count
    const activeCount = metaAds.filter(a => a.isActive).length
    if (activeCount > 10) {
      insights.push({
        id: 'meta_high_competition',
        title: `${activeCount} aktif rakip reklam tespit edildi`,
        description: 'Bu sektörde yoğun rekabet var. Farklılaşma stratejisi ve güçlü değer önerisi ile öne çıkmanız gerekiyor.',
        platform: 'Meta',
        type: 'threat',
      })
    }
  }

  if (googleCompetitors.length === 0 && metaAds.length === 0) {
    insights.push({
      id: 'no_data',
      title: 'Rakip verisi bulunamadı',
      description: 'Rakip analizi için aktif kampanyalarınız gereklidir.',
      platform: 'Google',
      type: 'info',
    })
  }

  return insights
}
