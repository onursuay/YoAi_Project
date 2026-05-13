/* ──────────────────────────────────────────────────────────
   YoAi — Social Profile Normalizer

   Converts diverse Apify actor outputs to a common shape.
   Defensive parsing — no fake data. If a field is missing,
   it stays null/empty. Confidence reflects data richness.
   ────────────────────────────────────────────────────────── */

export interface NormalizedSocialProfile {
  platform: string
  sourceUrl: string
  profileName: string | null
  username: string | null
  bio: string | null
  description: string | null
  website: string | null
  location: string | null
  followersCount: number | null
  followingCount: number | null
  postsCount: number | null
  recentPostTexts: string[]
  hashtags: string[]
  externalLinks: string[]
  category: string | null
  extractedServices: string[]
  extractedKeywords: string[]
  extractedAudience: string | null
  extractedLocations: string[]
  extractedCtas: string[]
  extractedBrandTone: string | null
  extractedOffers: string[]
  confidence: number
}

/* ── Primitive helpers ─────────────────────────────────── */

function s(v: unknown, max = 500): string | null {
  if (typeof v !== 'string' || !v.trim()) return null
  return v.trim().slice(0, max)
}

function n(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.round(v)
  if (typeof v === 'string') {
    const parsed = parseFloat(v.replace(/[^\d.]/g, ''))
    return Number.isFinite(parsed) ? Math.round(parsed) : null
  }
  return null
}

function pick(obj: Record<string, unknown>, ...keys: string[]): unknown {
  for (const k of keys) {
    const v = obj[k]
    if (v !== undefined && v !== null && v !== '') return v
  }
  return null
}

function safeArr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : []
}

function extractHashtags(text: string): string[] {
  const out: string[] = []
  const re = /#([\wÀ-ɏ]+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    out.push(m[1])
    if (out.length >= 20) break
  }
  return out
}

/* ── Signal extraction ────────────────────────────────── */

const SERVICE_HINTS = [
  'eğitim', 'kurs', 'hizmet', 'paket', 'menü', 'tedavi', 'ders', 'danışmanlık',
  'uygulama', 'çözüm', 'klinik', 'akademi', 'okul', 'kamp', 'atölye',
]
const CTA_HINTS = [
  'iletişim', 'whatsapp', 'randevu', 'sipariş', 'teklif', 'dm', 'mesaj',
  'kayıt', 'link', 'bio link', 'contact', 'order', 'book',
]
const OFFER_HINTS = [
  'kampanya', 'indirim', 'ücretsiz', 'fırsat', 'taksit', 'erken',
  'discount', 'free', 'sale', 'promo',
]
const BRAND_TONE_PATTERNS: Array<[RegExp, string]> = [
  [/(kanka|reyiz|coşkulu|heyecan)/i, 'samimi/heyecanlı'],
  [/(profesyonel|kurumsal|standart)/i, 'profesyonel/kurumsal'],
  [/(uzman|akademik|bilimsel|kanıt)/i, 'uzman/teknik'],
  [/(sıcak|aile|sevgi|samimi)/i, 'sıcak/aile dostu'],
  [/(lüks|premium|özel|exclusive)/i, 'lüks/premium'],
]
const TR_CITIES = [
  'istanbul', 'ankara', 'izmir', 'bursa', 'antalya', 'adana', 'konya',
  'gaziantep', 'mersin', 'kayseri', 'eskişehir', 'trabzon', 'samsun',
  'diyarbakır', 'kocaeli', 'denizli', 'malatya', 'muğla', 'aydın',
]

function extractSignals(text: string): {
  services: string[]
  ctas: string[]
  offers: string[]
  keywords: string[]
  locations: string[]
  brandTone: string | null
} {
  const lower = text.toLowerCase()

  function firstWindow(hints: string[], limit: number): string[] {
    const out: string[] = []
    for (const h of hints) {
      const idx = lower.indexOf(h)
      if (idx >= 0) {
        const win = text.substring(Math.max(0, idx - 10), idx + 60).trim().slice(0, 80)
        if (win) out.push(win)
        if (out.length >= limit) break
      }
    }
    return out
  }

  const tokens = lower.replace(/[^\w\sığüşöçıİĞÜŞÖÇ]/g, ' ').split(/\s+/).filter((t) => t.length >= 5)
  const freq = new Map<string, number>()
  for (const t of tokens) freq.set(t, (freq.get(t) || 0) + 1)
  const keywords = Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([k]) => k)

  const locations: string[] = []
  for (const city of TR_CITIES) {
    if (lower.includes(city)) {
      locations.push(city.charAt(0).toUpperCase() + city.slice(1))
      if (locations.length >= 5) break
    }
  }

  let brandTone: string | null = null
  for (const [re, tone] of BRAND_TONE_PATTERNS) {
    if (re.test(lower)) { brandTone = tone; break }
  }

  return {
    services: firstWindow(SERVICE_HINTS, 5),
    ctas: firstWindow(CTA_HINTS, 5),
    offers: firstWindow(OFFER_HINTS, 5),
    keywords,
    locations,
    brandTone,
  }
}

function confidence(fields: {
  hasName: boolean
  hasBio: boolean
  followersCount: number | null
  postsCount: number | null
  recentPostsCount: number
}): number {
  let c = 10
  if (fields.hasName) c += 20
  if (fields.hasBio) c += 20
  if (fields.followersCount !== null) c += 20
  if (fields.postsCount !== null) c += 10
  if (fields.recentPostsCount > 0) c += 10
  if (fields.recentPostsCount >= 5) c += 10
  return Math.min(90, c)
}

function postsToTexts(rawPosts: unknown[]): string[] {
  return rawPosts
    .slice(0, 10)
    .map((p: any) => s(p?.caption ?? p?.text ?? p?.description ?? p?.body) || '')
    .filter(Boolean) as string[]
}

/* ── Platform normalizers ─────────────────────────────── */

export function normalizeInstagramProfile(raw: Record<string, unknown>, sourceUrl: string): NormalizedSocialProfile {
  const profileName = s(pick(raw, 'fullName', 'full_name', 'name'))
  const username = s(pick(raw, 'username', 'handle', 'userName'))
  const bio = s(pick(raw, 'biography', 'bio', 'description'), 1000)
  const website = s(pick(raw, 'externalUrl', 'external_url', 'website', 'websiteUrl'))
  const location = s(pick(raw, 'businessAddress', 'city', 'location', 'cityName'))
  const followersCount = n(pick(raw, 'followersCount', 'followers', 'followedByCount'))
  const followingCount = n(pick(raw, 'followsCount', 'following', 'followingCount'))
  const postsCount = n(pick(raw, 'postsCount', 'mediaCount', 'postsNum', 'igtvVideoCount'))
  const posts = postsToTexts(safeArr(raw.latestPosts ?? raw.posts ?? raw.topPosts))
  const hashtags = posts.flatMap(extractHashtags).slice(0, 20)
  const corpus = [bio, ...posts].filter(Boolean).join(' ')
  const signals = extractSignals(corpus)

  return {
    platform: 'instagram',
    sourceUrl,
    profileName: profileName ?? username,
    username,
    bio,
    description: bio,
    website,
    location,
    followersCount,
    followingCount,
    postsCount,
    recentPostTexts: posts,
    hashtags,
    externalLinks: website ? [website] : [],
    category: s(pick(raw, 'category', 'businessCategoryName', 'businessCategory')),
    extractedServices: signals.services,
    extractedKeywords: [...signals.keywords, ...hashtags.slice(0, 5)].slice(0, 15),
    extractedAudience: null,
    extractedLocations: signals.locations,
    extractedCtas: signals.ctas,
    extractedBrandTone: signals.brandTone,
    extractedOffers: signals.offers,
    confidence: confidence({ hasName: !!(profileName ?? username), hasBio: !!bio, followersCount, postsCount, recentPostsCount: posts.length }),
  }
}

export function normalizeFacebookProfile(raw: Record<string, unknown>, sourceUrl: string): NormalizedSocialProfile {
  const profileName = s(pick(raw, 'title', 'name', 'pageName', 'pageTitle'))
  const username = s(pick(raw, 'username', 'handle', 'pageUsername'))
  const bio = s(pick(raw, 'description', 'about', 'bio', 'shortDescription'), 1000)
  const website = s(pick(raw, 'website', 'websiteUrl', 'externalUrl'))
  const location = s(pick(raw, 'city', 'location', 'address', 'pageLocation'))
  const followersCount = n(pick(raw, 'followers', 'followersCount', 'likes', 'pageFollowers'))
  const postsCount = n(pick(raw, 'postsCount', 'totalPosts'))
  const posts = postsToTexts(safeArr(raw.posts ?? raw.latestPosts))
  const hashtags = posts.flatMap(extractHashtags).slice(0, 20)
  const corpus = [bio, ...posts].filter(Boolean).join(' ')
  const signals = extractSignals(corpus)

  return {
    platform: 'facebook',
    sourceUrl,
    profileName,
    username,
    bio,
    description: bio,
    website,
    location,
    followersCount,
    followingCount: null,
    postsCount,
    recentPostTexts: posts,
    hashtags,
    externalLinks: website ? [website] : [],
    category: s(pick(raw, 'category', 'pageCategory', 'categories')),
    extractedServices: signals.services,
    extractedKeywords: [...signals.keywords, ...hashtags.slice(0, 5)].slice(0, 15),
    extractedAudience: null,
    extractedLocations: signals.locations,
    extractedCtas: signals.ctas,
    extractedBrandTone: signals.brandTone,
    extractedOffers: signals.offers,
    confidence: confidence({ hasName: !!profileName, hasBio: !!bio, followersCount, postsCount, recentPostsCount: posts.length }),
  }
}

export function normalizeLinkedInProfile(raw: Record<string, unknown>, sourceUrl: string): NormalizedSocialProfile {
  const profileName = s(pick(raw, 'name', 'companyName', 'organizationName', 'title'))
  const username = s(pick(raw, 'universalName', 'vanityName', 'handle'))
  const bio = s(pick(raw, 'description', 'tagline', 'about', 'summary'), 1000)
  const website = s(pick(raw, 'website', 'websiteUrl', 'companyWebsite'))
  const location = s(pick(raw, 'headquarter', 'city', 'location', 'hqCity'))
  const followersCount = n(pick(raw, 'followersCount', 'followers', 'numFollowers'))
  const postsCount = n(pick(raw, 'postsCount', 'totalUpdates'))
  const posts = postsToTexts(safeArr(raw.posts ?? raw.updates ?? raw.recentPosts))
  const corpus = [bio, ...posts].filter(Boolean).join(' ')
  const signals = extractSignals(corpus)

  return {
    platform: 'linkedin',
    sourceUrl,
    profileName,
    username,
    bio,
    description: bio,
    website,
    location,
    followersCount,
    followingCount: null,
    postsCount,
    recentPostTexts: posts,
    hashtags: [],
    externalLinks: website ? [website] : [],
    category: s(pick(raw, 'industries', 'industry', 'specialties')),
    extractedServices: signals.services,
    extractedKeywords: signals.keywords.slice(0, 15),
    extractedAudience: null,
    extractedLocations: signals.locations,
    extractedCtas: signals.ctas,
    extractedBrandTone: signals.brandTone,
    extractedOffers: signals.offers,
    confidence: confidence({ hasName: !!profileName, hasBio: !!bio, followersCount, postsCount, recentPostsCount: posts.length }),
  }
}

export function normalizeYouTubeProfile(raw: Record<string, unknown>, sourceUrl: string): NormalizedSocialProfile {
  const profileName = s(pick(raw, 'channelName', 'name', 'title', 'authorName'))
  const username = s(pick(raw, 'channelId', 'handle', 'customUrl', 'vanityUrl'))
  const bio = s(pick(raw, 'description', 'about', 'channelDescription'), 1000)
  const website = s(pick(raw, 'website', 'websiteUrl', 'externalUrl'))
  const location = s(pick(raw, 'country', 'location'))
  const followersCount = n(pick(raw, 'numberOfSubscribers', 'subscriberCount', 'subscribers'))
  const postsCount = n(pick(raw, 'numberOfVideos', 'videoCount', 'videosCount'))
  const posts = postsToTexts(safeArr(raw.videos ?? raw.recentVideos ?? raw.posts))
  const hashtags = posts.flatMap(extractHashtags).slice(0, 20)
  const corpus = [bio, ...posts].filter(Boolean).join(' ')
  const signals = extractSignals(corpus)

  return {
    platform: 'youtube',
    sourceUrl,
    profileName,
    username,
    bio,
    description: bio,
    website,
    location,
    followersCount,
    followingCount: null,
    postsCount,
    recentPostTexts: posts,
    hashtags,
    externalLinks: website ? [website] : [],
    category: s(pick(raw, 'category', 'channelType')),
    extractedServices: signals.services,
    extractedKeywords: [...signals.keywords, ...hashtags.slice(0, 5)].slice(0, 15),
    extractedAudience: null,
    extractedLocations: signals.locations,
    extractedCtas: signals.ctas,
    extractedBrandTone: signals.brandTone,
    extractedOffers: signals.offers,
    confidence: confidence({ hasName: !!profileName, hasBio: !!bio, followersCount, postsCount, recentPostsCount: posts.length }),
  }
}

export function normalizeTikTokProfile(raw: Record<string, unknown>, sourceUrl: string): NormalizedSocialProfile {
  const meta = (raw.authorMeta && typeof raw.authorMeta === 'object' ? raw.authorMeta : {}) as Record<string, unknown>
  const profileName = s(pick(meta, 'name', 'nickname') ?? pick(raw, 'name', 'nickname', 'displayName'))
  const username = s(pick(meta, 'id', 'uniqueId') ?? pick(raw, 'uniqueId', 'username', 'handle'))
  const bio = s(pick(meta, 'signature', 'bio') ?? pick(raw, 'bio', 'signature', 'description'), 1000)
  const website = s(pick(meta, 'bioLink', 'website') ?? pick(raw, 'website', 'bioLink'))
  const location = s(pick(meta, 'region', 'country') ?? pick(raw, 'region', 'country', 'location'))
  const followersCount = n(pick(meta, 'fans', 'followers') ?? pick(raw, 'fans', 'followersCount', 'heartCount'))
  const followingCount = n(pick(meta, 'following') ?? pick(raw, 'following', 'followingCount'))
  const postsCount = n(pick(meta, 'video', 'videoCount') ?? pick(raw, 'videoCount', 'postsCount'))
  const posts = postsToTexts(safeArr(raw.videos ?? raw.posts ?? raw.recentPosts))
  const hashtags = posts.flatMap(extractHashtags).slice(0, 20)
  const corpus = [bio, ...posts].filter(Boolean).join(' ')
  const signals = extractSignals(corpus)

  return {
    platform: 'tiktok',
    sourceUrl,
    profileName,
    username,
    bio,
    description: bio,
    website,
    location,
    followersCount,
    followingCount,
    postsCount,
    recentPostTexts: posts,
    hashtags,
    externalLinks: website ? [website] : [],
    category: null,
    extractedServices: signals.services,
    extractedKeywords: [...signals.keywords, ...hashtags.slice(0, 5)].slice(0, 15),
    extractedAudience: null,
    extractedLocations: signals.locations,
    extractedCtas: signals.ctas,
    extractedBrandTone: signals.brandTone,
    extractedOffers: signals.offers,
    confidence: confidence({ hasName: !!profileName, hasBio: !!bio, followersCount, postsCount, recentPostsCount: posts.length }),
  }
}

export function normalizeSocialProfile(
  platform: string,
  raw: unknown,
  sourceUrl: string,
): NormalizedSocialProfile {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  switch (platform) {
    case 'instagram': return normalizeInstagramProfile(obj, sourceUrl)
    case 'facebook':  return normalizeFacebookProfile(obj, sourceUrl)
    case 'linkedin':  return normalizeLinkedInProfile(obj, sourceUrl)
    case 'youtube':   return normalizeYouTubeProfile(obj, sourceUrl)
    case 'tiktok':    return normalizeTikTokProfile(obj, sourceUrl)
    default:
      return {
        platform,
        sourceUrl,
        profileName: null,
        username: null,
        bio: null,
        description: null,
        website: null,
        location: null,
        followersCount: null,
        followingCount: null,
        postsCount: null,
        recentPostTexts: [],
        hashtags: [],
        externalLinks: [],
        category: null,
        extractedServices: [],
        extractedKeywords: [],
        extractedAudience: null,
        extractedLocations: [],
        extractedCtas: [],
        extractedBrandTone: null,
        extractedOffers: [],
        confidence: 0,
      }
  }
}
