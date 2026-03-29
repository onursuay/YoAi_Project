/* ──────────────────────────────────────────────────────────
   Competitor Analyzer — v2

   Flow:
   1. Analyze user's own ads (texts, CTAs, formats, objectives)
   2. Extract industry/product keywords from ad content
   3. Search Meta Ad Library for competitor ads in same space
   4. Compare user ads vs competitor ads
   5. Identify gaps, opportunities, and competitive advantages
   6. Feed findings into AI ad creator
   ────────────────────────────────────────────────────────── */

import type { DeepCampaignInsight, AdsetInsight, AdInsight, Platform } from './analysisTypes'

/* ── Types ── */
export interface UserAdProfile {
  keywords: string[]              // extracted from ad content
  themes: string[]                // messaging themes (price, quality, urgency etc.)
  ctaTypes: string[]              // CTA types used
  formats: string[]               // ad formats used
  platforms: Platform[]
  topPerformingAds: { name: string; ctr: number; platform: Platform }[]
  weakAds: { name: string; ctr: number; issues: string[] }[]
  avgCtr: number
  avgCpc: number
  totalSpend: number
}

export interface CompetitorAd {
  id: string
  pageName: string
  pageId: string
  body: string
  title: string
  description: string
  startDate: string
  platforms: string[]
  isActive: boolean
}

export interface CompetitorComparison {
  // What competitors do that user doesn't
  competitorThemes: string[]
  competitorCTAs: string[]
  competitorFormats: string[]
  // Gaps and opportunities
  gaps: CompetitorGap[]
  // Summary for AI ad creation
  competitorSummary: string
}

export interface CompetitorGap {
  id: string
  type: 'messaging' | 'format' | 'cta' | 'positioning'
  title: string
  description: string
  priority: 'high' | 'medium' | 'low'
  recommendation: string
}

export interface FullCompetitorAnalysis {
  userProfile: UserAdProfile
  competitorAds: CompetitorAd[]
  comparison: CompetitorComparison
  errors: string[]
}

/* ── Step 1: Analyze user's own ads ── */
export function analyzeUserAds(campaigns: DeepCampaignInsight[]): UserAdProfile {
  const keywords: string[] = []
  const themes = new Set<string>()
  const ctaTypes = new Set<string>()
  const formats = new Set<string>()
  const platforms = new Set<Platform>()
  const allAds: { name: string; ctr: number; platform: Platform; spend: number }[] = []

  const urgencyWords = ['şimdi', 'hemen', 'sınırlı', 'son', 'kaçırma', 'fırsat', 'bugün', 'acele']
  const priceWords = ['indirim', 'kampanya', 'fiyat', 'ücretsiz', 'bedava', 'uygun', 'hesaplı']
  const qualityWords = ['kaliteli', 'profesyonel', 'uzman', 'garanti', 'güvenilir', 'premium']
  const socialProofWords = ['binlerce', 'müşteri', 'yıldız', 'puan', 'değerlendirme', 'tercih']

  // Stop words for keyword extraction
  const stopWords = new Set([
    've', 'ile', 'için', 'bir', 'bu', 'da', 'de', 'den', 'dan', 'olan',
    'gibi', 'daha', 'en', 'çok', 'her', 'tüm', 'biz', 'siz', 'the', 'and',
    'campaign', 'kampanya', 'reklam', 'ads', 'ad', 'set', 'grup', 'group',
    'test', 'v1', 'v2', 'copy', 'kopya', 'yeni', 'search', 'display',
    'yo', '//', '2024', '2025', '2026', 'tr', 'en',
  ])

  let totalSpend = 0
  let totalClicks = 0
  let totalImpressions = 0

  for (const campaign of campaigns) {
    platforms.add(campaign.platform)
    totalSpend += campaign.metrics.spend
    totalClicks += campaign.metrics.clicks
    totalImpressions += campaign.metrics.impressions

    // Extract from campaign name
    extractWords(campaign.campaignName, stopWords).forEach(w => keywords.push(w))

    for (const adset of campaign.adsets) {
      extractWords(adset.name, stopWords).forEach(w => keywords.push(w))

      for (const ad of adset.ads) {
        // Collect ad info
        allAds.push({
          name: ad.name,
          ctr: ad.metrics.ctr,
          platform: campaign.platform,
          spend: ad.metrics.spend,
        })

        if (ad.format) formats.add(ad.format)

        // Analyze ad name for themes
        const lower = ad.name.toLowerCase()
        if (urgencyWords.some(w => lower.includes(w))) themes.add('aciliyet')
        if (priceWords.some(w => lower.includes(w))) themes.add('fiyat_avantaji')
        if (qualityWords.some(w => lower.includes(w))) themes.add('kalite')
        if (socialProofWords.some(w => lower.includes(w))) themes.add('sosyal_kanit')

        extractWords(ad.name, stopWords).forEach(w => keywords.push(w))
      }
    }
  }

  // Deduplicate and rank keywords
  const wordCount = new Map<string, number>()
  for (const w of keywords) {
    wordCount.set(w, (wordCount.get(w) || 0) + 1)
  }
  const topKeywords = Array.from(wordCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([w]) => w)

  // Top/weak performing ads
  const sortedAds = allAds.filter(a => a.spend > 0).sort((a, b) => b.ctr - a.ctr)
  const topPerformingAds = sortedAds.slice(0, 5).map(a => ({ name: a.name, ctr: a.ctr, platform: a.platform }))
  const weakAds = sortedAds.slice(-3).reverse().map(a => ({
    name: a.name,
    ctr: a.ctr,
    issues: [a.ctr < 0.01 ? 'Çok düşük CTR' : 'Düşük performans'],
  }))

  return {
    keywords: topKeywords,
    themes: Array.from(themes),
    ctaTypes: Array.from(ctaTypes),
    formats: Array.from(formats),
    platforms: Array.from(platforms),
    topPerformingAds,
    weakAds,
    avgCtr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
    avgCpc: totalClicks > 0 ? totalSpend / totalClicks : 0,
    totalSpend,
  }
}

/* ── Step 2: Search Meta Ad Library ── */
export async function searchCompetitorAds(
  keywords: string[],
  cookieHeader: string,
  baseUrl: string,
): Promise<{ ads: CompetitorAd[]; errors: string[] }> {
  if (keywords.length === 0) {
    return { ads: [], errors: ['Anahtar kelime bulunamadı'] }
  }

  const searchQuery = keywords.slice(0, 3).join(' ')
  const errors: string[] = []
  const ads: CompetitorAd[] = []

  try {
    const res = await fetch(
      `${baseUrl}/api/yoai/competitors/meta-ad-library?q=${encodeURIComponent(searchQuery)}&country=TR`,
      { headers: { Cookie: cookieHeader } },
    )

    if (res.ok) {
      const data = await res.json()
      if (data.ok && Array.isArray(data.data)) {
        for (const ad of data.data) {
          ads.push({
            id: ad.id,
            pageName: ad.pageName || '',
            pageId: ad.pageId || '',
            body: ad.adCreativeBody || '',
            title: ad.adCreativeLinkTitle || '',
            description: ad.adCreativeDescription || '',
            startDate: ad.adStartDate || '',
            platforms: ad.platforms || [],
            isActive: ad.isActive ?? true,
          })
        }
      }
    } else {
      errors.push('Meta Ad Library erişim hatası')
    }
  } catch (e) {
    console.error('[CompetitorAnalyzer] Meta Ad Library error:', e)
    errors.push('Meta Ad Library bağlantı hatası')
  }

  return { ads, errors }
}

/* ── Step 3: Compare user ads vs competitor ads ── */
export function compareWithCompetitors(
  userProfile: UserAdProfile,
  competitorAds: CompetitorAd[],
): CompetitorComparison {
  const gaps: CompetitorGap[] = []
  const competitorThemes = new Set<string>()
  const competitorCTAs = new Set<string>()
  const competitorFormats = new Set<string>()

  const urgencyWords = ['şimdi', 'hemen', 'sınırlı', 'son', 'kaçırma', 'fırsat']
  const priceWords = ['indirim', 'kampanya', 'fiyat', 'ücretsiz', 'bedava', 'uygun']
  const qualityWords = ['kaliteli', 'profesyonel', 'uzman', 'garanti', 'güvenilir']
  const socialProofWords = ['binlerce', 'müşteri', 'yıldız', 'puan', 'tercih']
  const ctaWords = ['hemen al', 'şimdi başla', 'ücretsiz dene', 'teklif al', 'iletişime geç', 'incele']

  for (const ad of competitorAds) {
    const text = `${ad.body} ${ad.title} ${ad.description}`.toLowerCase()
    if (urgencyWords.some(w => text.includes(w))) competitorThemes.add('aciliyet')
    if (priceWords.some(w => text.includes(w))) competitorThemes.add('fiyat_avantaji')
    if (qualityWords.some(w => text.includes(w))) competitorThemes.add('kalite')
    if (socialProofWords.some(w => text.includes(w))) competitorThemes.add('sosyal_kanit')
    for (const cta of ctaWords) {
      if (text.includes(cta)) competitorCTAs.add(cta)
    }
    for (const p of ad.platforms) competitorFormats.add(p)
  }

  // Find gaps: competitor themes that user doesn't use
  let gapIdx = 0
  const themeLabels: Record<string, string> = {
    aciliyet: 'Aciliyet mesajı',
    fiyat_avantaji: 'Fiyat/indirim vurgusu',
    kalite: 'Kalite vurgusu',
    sosyal_kanit: 'Sosyal kanıt',
  }

  for (const theme of competitorThemes) {
    if (!userProfile.themes.includes(theme)) {
      gapIdx++
      gaps.push({
        id: `gap_${gapIdx}`,
        type: 'messaging',
        title: `Rakipler "${themeLabels[theme] || theme}" kullanıyor`,
        description: `Rakip reklamlarda ${themeLabels[theme] || theme} mesajı tespit edildi ancak sizin reklamlarınızda bu tema bulunmuyor.`,
        priority: 'high',
        recommendation: `Reklam metinlerinize ${themeLabels[theme] || theme} unsuru ekleyin.`,
      })
    }
  }

  // If user uses something competitors don't → competitive advantage
  for (const theme of userProfile.themes) {
    if (!competitorThemes.has(theme)) {
      gapIdx++
      gaps.push({
        id: `advantage_${gapIdx}`,
        type: 'positioning',
        title: `"${themeLabels[theme] || theme}" sizin avantajınız`,
        description: `Bu tema rakiplerde görülmüyor — farklılaşma noktanız olabilir.`,
        priority: 'low',
        recommendation: `Bu mesajı daha güçlü vurgulayarak rekabet avantajı elde edin.`,
      })
    }
  }

  // Active competitor count
  const activeCompetitors = new Set(competitorAds.filter(a => a.isActive).map(a => a.pageName)).size
  if (activeCompetitors > 5) {
    gapIdx++
    gaps.push({
      id: `competition_${gapIdx}`,
      type: 'positioning',
      title: `${activeCompetitors} aktif rakip tespit edildi`,
      description: `Bu alanda yoğun rekabet var. Güçlü farklılaşma stratejisi gerekiyor.`,
      priority: 'medium',
      recommendation: 'Benzersiz değer önerinizi öne çıkarın ve niş hedefleme yapın.',
    })
  }

  // Build summary for AI
  const competitorSummary = competitorAds.length > 0
    ? `${competitorAds.length} rakip reklam analiz edildi. ${activeCompetitors} farklı reklamveren tespit edildi. Rakiplerin kullandığı temalar: ${Array.from(competitorThemes).map(t => themeLabels[t] || t).join(', ')}. Rakiplerin CTA'ları: ${Array.from(competitorCTAs).join(', ') || 'tespit edilemedi'}. Kullanıcının mevcut temaları: ${userProfile.themes.map(t => themeLabels[t] || t).join(', ') || 'belirgin tema yok'}. Tespit edilen boşluklar: ${gaps.filter(g => g.type === 'messaging').map(g => g.title).join('; ') || 'yok'}.`
    : 'Rakip verisi bulunamadı.'

  return {
    competitorThemes: Array.from(competitorThemes),
    competitorCTAs: Array.from(competitorCTAs),
    competitorFormats: Array.from(competitorFormats),
    gaps,
    competitorSummary,
  }
}

/* ── Full Pipeline ── */
export async function runFullCompetitorAnalysis(
  campaigns: DeepCampaignInsight[],
  cookieHeader: string,
  baseUrl: string,
): Promise<FullCompetitorAnalysis> {
  const errors: string[] = []

  // Step 1: Analyze user ads
  const userProfile = analyzeUserAds(campaigns)

  // Step 2: Search competitors
  const { ads: competitorAds, errors: searchErrors } = await searchCompetitorAds(
    userProfile.keywords,
    cookieHeader,
    baseUrl,
  )
  errors.push(...searchErrors)

  // Step 3: Compare
  const comparison = compareWithCompetitors(userProfile, competitorAds)

  return { userProfile, competitorAds, comparison, errors }
}

/* ── Helper ── */
function extractWords(text: string, stopWords: Set<string>): string[] {
  return text
    .replace(/[^a-zA-ZğüşöçıİĞÜŞÖÇ\s]/g, ' ')
    .split(/\s+/)
    .map(w => w.toLowerCase().trim())
    .filter(w => w.length > 2 && !stopWords.has(w))
}
