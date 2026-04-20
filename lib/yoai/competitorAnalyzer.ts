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
  // Structural parameters
  objectives: string[]            // campaign objectives used
  destinations: string[]          // conversion destinations used
  optimizationGoals: string[]     // optimization goals used
  biddingStrategies: string[]     // bidding strategies used
  channelTypes: string[]          // Google channel types
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
  /** Rakiplerin yayınlama platformları (facebook/instagram). Format DEĞİL. Opsiyonel — eski fallback objelerle uyum. */
  competitorPlatforms?: string[]
  /** DEPRECATED: Meta Ad Library reliable media_type dönmüyor; boş kalır. */
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

/* ──────────────────────────────────────────────────────────
   Theme Lexicon (v2) — genişletilmiş
   Creative body'de geçen anlamlı sinyalleri yakalar.
   ────────────────────────────────────────────────────────── */
export const THEME_LEXICON = {
  THEME_KEYWORDS: {
    aciliyet: [
      'şimdi', 'hemen', 'sınırlı', 'son', 'kaçırma', 'fırsat', 'bugün', 'acele',
      'hızlı', 'anında', 'bu hafta', 'son gün', 'son fırsat', 'kaçırmayın',
      'geçmeden', 'tükenmeden', 'stoklar', 'rezervasyon', 'rezerve et',
    ],
    fiyat_avantaji: [
      'indirim', 'kampanya', 'fiyat', 'ücretsiz', 'bedava', 'uygun', 'hesaplı',
      'taksit', 'peşinat', '%', 'tl\'ye', 'den başlayan', 'kadar', 'avantaj',
      'fırsat fiyat', 'özel fiyat', 'iade', 'ödeme', 'kupon', 'promosyon',
    ],
    kalite: [
      'kaliteli', 'profesyonel', 'uzman', 'garanti', 'güvenilir', 'premium',
      'sertifikalı', 'orijinal', 'özgün', 'üstün', 'en iyi', 'lider', 'öncü',
      'deneyimli', 'yılların', 'tecrübeli', 'ödüllü', 'a kalite',
    ],
    sosyal_kanit: [
      'binlerce', 'müşteri', 'yıldız', 'puan', 'değerlendirme', 'tercih',
      'memnun', 'referans', 'yorum', 'değerlendirdi', 'tercih etti', 'seçti',
      'topluluk', '5 yıldız', 'mutlu müşteri', 'kullandı', 'güvendi',
    ],
    sorun_cozum: [
      'sorun', 'problem', 'çözüm', 'çözer', 'kurtar', 'dert', 'zorluk',
      'artık', 'bitir', 'son ver', 'ortadan kaldır', 'çare', 'yardımcı',
    ],
    emosyonel: [
      'hayalinizdeki', 'hayaliniz', 'mutluluk', 'keyif', 'huzur', 'rahatlık',
      'özgürlük', 'sevdikleriniz', 'aile', 'çocuklarınız', 'siz ve', 'özel',
    ],
  } as Record<string, string[]>,
  CTA_PHRASES: [
    'hemen al', 'şimdi al', 'şimdi başla', 'ücretsiz dene', 'teklif al',
    'iletişime geç', 'iletişime geçin', 'incele', 'incelemek için', 'keşfet',
    'sipariş', 'satın al', 'randevu', 'whatsapp', 'arayın', 'bizi arayın',
    'formu doldur', 'kayıt ol', 'üye ol', 'abone ol', 'indir', 'ücretsiz indir',
    'başvur', 'başvuru', 'ziyaret et', 'tıkla', 'daha fazla bilgi',
  ],
  /** Meta CTA button kodlarını Türkçe etikete çevir */
  CTA_BUTTON_LABEL: {
    SHOP_NOW: 'Hemen Al',
    LEARN_MORE: 'Daha Fazla Bilgi',
    SIGN_UP: 'Kayıt Ol',
    SUBSCRIBE: 'Abone Ol',
    CONTACT_US: 'İletişime Geç',
    BOOK_TRAVEL: 'Rezervasyon Yap',
    GET_OFFER: 'Teklif Al',
    APPLY_NOW: 'Başvur',
    DOWNLOAD: 'İndir',
    INSTALL_MOBILE_APP: 'Uygulamayı Yükle',
    WHATSAPP_MESSAGE: 'WhatsApp Mesajı',
    SEND_MESSAGE: 'Mesaj Gönder',
    CALL_NOW: 'Hemen Ara',
    GET_DIRECTIONS: 'Yol Tarifi',
    SEE_MENU: 'Menüyü Gör',
    WATCH_MORE: 'İzlemeye Devam Et',
    PLAY_GAME: 'Oyna',
    DONATE_NOW: 'Bağış Yap',
    REQUEST_TIME: 'Randevu Al',
  } as Record<string, string>,
}

/** Bir metinde hangi temaları bulduğunu döndürür (çoklu etiket) */
export function detectThemesInText(text: string): string[] {
  if (!text) return []
  const lower = text.toLowerCase()
  const hits: string[] = []
  for (const [theme, words] of Object.entries(THEME_LEXICON.THEME_KEYWORDS)) {
    if (words.some((w) => lower.includes(w))) hits.push(theme)
  }
  return hits
}

/* ── Step 1: Analyze user's own ads ── */
export function analyzeUserAds(campaigns: DeepCampaignInsight[]): UserAdProfile {
  const keywords: string[] = []
  const themes = new Set<string>()
  const ctaTypes = new Set<string>()
  const formats = new Set<string>()
  const platforms = new Set<Platform>()
  const objectives = new Set<string>()
  const destinations = new Set<string>()
  const optimizationGoals = new Set<string>()
  const biddingStrategies = new Set<string>()
  const channelTypes = new Set<string>()
  const allAds: { name: string; ctr: number; platform: Platform; spend: number }[] = []

  // Genişletilmiş tema kelime listeleri (v2 — creative body üzerinde daha doğru çalışır)
  const { THEME_KEYWORDS, CTA_PHRASES } = THEME_LEXICON
  const urgencyWords = THEME_KEYWORDS.aciliyet
  const priceWords = THEME_KEYWORDS.fiyat_avantaji
  const qualityWords = THEME_KEYWORDS.kalite
  const socialProofWords = THEME_KEYWORDS.sosyal_kanit

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

    // Capture structural parameters
    if (campaign.objective) objectives.add(campaign.objective)
    if (campaign.triple?.destination) destinations.add(campaign.triple.destination)
    if (campaign.triple?.optimizationGoal) optimizationGoals.add(campaign.triple.optimizationGoal)
    if (campaign.biddingStrategy) biddingStrategies.add(campaign.biddingStrategy)
    if (campaign.channelType) channelTypes.add(campaign.channelType)

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

        // CTA button (gerçek Meta call_to_action_type — SHOP_NOW, LEARN_MORE vs.)
        if (ad.callToActionType) ctaTypes.add(ad.callToActionType)

        // Analyze REAL ad content: creative body + title + name fallback
        const content = [ad.creativeBody, ad.creativeTitle, ad.name].filter(Boolean).join(' ').toLowerCase()
        if (content) {
          if (urgencyWords.some(w => content.includes(w))) themes.add('aciliyet')
          if (priceWords.some(w => content.includes(w))) themes.add('fiyat_avantaji')
          if (qualityWords.some(w => content.includes(w))) themes.add('kalite')
          if (socialProofWords.some(w => content.includes(w))) themes.add('sosyal_kanit')
          if (THEME_LEXICON.THEME_KEYWORDS.sorun_cozum.some(w => content.includes(w))) themes.add('sorun_cozum')
          if (THEME_LEXICON.THEME_KEYWORDS.emosyonel.some(w => content.includes(w))) themes.add('emosyonel')
        }

        // Keyword extraction from creative body + name (daha zengin kaynak)
        extractWords(ad.creativeBody || ad.name, stopWords).forEach(w => keywords.push(w))
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
    objectives: Array.from(objectives),
    destinations: Array.from(destinations),
    optimizationGoals: Array.from(optimizationGoals),
    biddingStrategies: Array.from(biddingStrategies),
    channelTypes: Array.from(channelTypes),
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
  const competitorPlatforms = new Set<string>()
  // Meta Ad Library media_type güvenilir dönmüyor → format boş kalır
  const competitorFormats = new Set<string>()

  const { THEME_KEYWORDS, CTA_PHRASES } = THEME_LEXICON

  for (const ad of competitorAds) {
    const text = `${ad.body} ${ad.title} ${ad.description}`.toLowerCase()
    // Tema tespiti — tüm 6 kategori (detectThemesInText ile aynı mantık, inline)
    for (const [theme, words] of Object.entries(THEME_KEYWORDS)) {
      if (words.some((w) => text.includes(w))) competitorThemes.add(theme)
    }
    // CTA tespiti — body + title + description üzerinde genişletilmiş liste
    for (const cta of CTA_PHRASES) {
      if (text.includes(cta)) competitorCTAs.add(cta)
    }
    // PLATFORMS (facebook/instagram) — format DEĞİL, dürüst isim
    for (const p of ad.platforms) competitorPlatforms.add(p)
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
    competitorPlatforms: Array.from(competitorPlatforms),
    competitorFormats: Array.from(competitorFormats), // her zaman [] (Ad Library güvenilir media_type dönmüyor)
    gaps,
    competitorSummary,
  }
}

/* ── LLM Theme Enhancer ──
   Keyword matching 6 kategoriyle sınırlı. OpenAI'den nüanslı etiketler de al.
   Batch çağrı — bir defa reklam metinleri yollanır, yapısal JSON döner.
   Başarısız olursa sessizce yutulur (fallback keyword-based sonuç yeterli).
*/
async function enhanceThemesWithLLM(
  userBodies: string[],
  competitorBodies: string[],
): Promise<{ userThemes: string[]; competitorThemes: string[] } | null> {
  const openaiKey = process.env.OPENAI_API_KEY
  if (!openaiKey) return null
  if (userBodies.length === 0 && competitorBodies.length === 0) return null

  const trim = (s: string) => (s || '').slice(0, 200)
  const user = {
    user_ads: userBodies.slice(0, 15).map(trim),
    competitor_ads: competitorBodies.slice(0, 20).map(trim),
  }

  const system = `Sen bir reklam analisti. Verilen Türkçe reklam metinlerinde kullanılan mesaj TEMALARINI etiketle. Sadece aşağıdaki etiket setinden seç:
- aciliyet
- fiyat_avantaji
- kalite
- sosyal_kanit
- sorun_cozum
- emosyonel
- risk_azaltma (iade garantisi, denemelik)
- statu (prestij, lüks, sınıfsal)
- topluluk (aidiyet, beraber)
- kisisellestirme (sana özel, kişisel)
- otorite (uzman görüşü, veri, araştırma)
- merak_uyandirma (soru cümlesi, gizem)

JSON döndür:
{"user_themes": ["etiket1", ...], "competitor_themes": ["etiket1", ...]}`

  try {
    const baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini'
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: JSON.stringify(user) },
        ],
        temperature: 0.2,
        max_tokens: 400,
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(30000),
    })
    if (!res.ok) return null
    const data = await res.json()
    const content = data.choices?.[0]?.message?.content
    if (!content) return null
    const parsed = JSON.parse(content)
    return {
      userThemes: Array.isArray(parsed.user_themes) ? parsed.user_themes : [],
      competitorThemes: Array.isArray(parsed.competitor_themes) ? parsed.competitor_themes : [],
    }
  } catch (e) {
    console.warn('[CompetitorAnalyzer] LLM theme enhance failed (non-fatal):', e)
    return null
  }
}

/* ── Full Pipeline ── */
export async function runFullCompetitorAnalysis(
  campaigns: DeepCampaignInsight[],
  cookieHeader: string,
  baseUrl: string,
): Promise<FullCompetitorAnalysis> {
  const errors: string[] = []

  // Step 1: Analyze user ads (keyword-based baseline)
  const userProfile = analyzeUserAds(campaigns)

  // Step 2: Search competitors
  const { ads: competitorAds, errors: searchErrors } = await searchCompetitorAds(
    userProfile.keywords,
    cookieHeader,
    baseUrl,
  )
  errors.push(...searchErrors)

  // Step 3: Compare (keyword-based)
  const comparison = compareWithCompetitors(userProfile, competitorAds)

  // Step 3.5: LLM enhance — keyword'le yakalanamayan nüanslı temalar
  try {
    const userBodies: string[] = []
    for (const c of campaigns) {
      for (const as of c.adsets) {
        for (const ad of as.ads) {
          const body = (ad.creativeBody || ad.creativeTitle || ad.name || '').trim()
          if (body) userBodies.push(body)
        }
      }
    }
    const competitorBodies = competitorAds
      .map((a) => `${a.body || ''} ${a.title || ''}`.trim())
      .filter(Boolean)

    const llm = await enhanceThemesWithLLM(userBodies, competitorBodies)
    if (llm) {
      // Union: mevcut keyword-bazlı + LLM temalarını birleştir
      const userSet = new Set([...userProfile.themes, ...llm.userThemes])
      const compSet = new Set([...comparison.competitorThemes, ...llm.competitorThemes])
      userProfile.themes = Array.from(userSet)
      comparison.competitorThemes = Array.from(compSet)
    }
  } catch (e) {
    console.warn('[CompetitorAnalyzer] enhance step failed (non-fatal):', e)
  }

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
