/* ──────────────────────────────────────────────────────────
   Competitor Query Expander

   Campaign Intent Engine çıktısından bağlamsal rakip arama
   sorguları üretir. Her platform için ayrı query plan döner.

   Strateji:
   1. Deterministic: intent profile + kampanya sinyalleri → sorgu
   2. LLM: confidence < 50 ise OpenAI ile genişlet (opsiyonel)
   3. Fallback: en az 1 primary query garantisi

   Kural: LLM başarısız olursa sistem kırılmaz, deterministic plan döner.
   Kural: Platformlar karışmaz — google ve meta query planları ayrı.
   ────────────────────────────────────────────────────────── */

import type { CampaignIntentProfile } from './campaignIntentEngine'

// ── Types ──────────────────────────────────────────────────────────────────────

export type CompetitorQueryPlan = {
  platform: 'google' | 'meta'
  primary_queries: string[]
  secondary_queries: string[]
  negative_queries: string[]
  brand_queries: string[]
  local_queries: string[]
  confidence: number
  reason: string
  evidence?: Record<string, unknown>
}

export interface QueryExpanderInput {
  platform: 'google' | 'meta'
  intentProfile?: CampaignIntentProfile | null
  campaignName?: string
  adGroupNames?: string[]
  creativeTexts?: string[]
  keywordList?: string[]
}

// ── Platform-aware offer type modifiers ────────────────────────────────────────

const GOOGLE_OFFER_MODIFIERS: Record<string, string[]> = {
  'sınav ve belgelendirme hizmeti': ['belgesi', 'sertifikası', 'mesleki yeterlilik', 'sınavı', 'akreditasyon'],
  'eğitim programı': ['kursu', 'eğitimi', 'online kursu', 'sertifikası', 'okulu'],
  'hizmet başvurusu': ['hizmeti', 'danışmanlık', 'firması', 'başvuru', 'teklif'],
  'ürün satışı': ['satın al', 'fiyat', 'sipariş', 'mağaza', 'fiyatları'],
  'üyelik ve abonelik': ['üyelik', 'abonelik', 'kayıt ol', 'premium', 'planları'],
  'rezervasyon': ['rezervasyon', 'yer ayırt', 'bilet', 'randevu', 'fiyat'],
  'lead / iletişim': ['iletişim', 'teklif al', 'bilgi al', 'danışma', 'telefon'],
  'uygulama indirme': ['uygulama', 'indir', 'mobil', 'app'],
  'genel hizmet': ['hizmeti', 'firması', 'fiyatı', 'teklif'],
}

const META_OFFER_MODIFIERS: Record<string, string[]> = {
  'sınav ve belgelendirme hizmeti': ['belgesi nasıl alınır', 'sertifika fiyatı', 'belge başvurusu', 'sınav tarihleri'],
  'eğitim programı': ['kurs kayıt', 'eğitim başvuru', 'online kurs fiyat', 'kurs programı'],
  'hizmet başvurusu': ['hizmet başvuru', 'ücretsiz danışma', 'teklif al', 'bilgi formunu doldur'],
  'ürün satışı': ['ürün incele', 'fiyat öğren', 'indirimli satın al', 'kampanya ürünleri'],
  'üyelik ve abonelik': ['üye ol', 'kayıt ol', 'ücretsiz dene', 'deneme süresi'],
  'rezervasyon': ['hemen rezervasyon', 'yer ayırt', 'erken kayıt', 'kontenjan dolmadan'],
  'lead / iletişim': ['bilgi al', 'ücretsiz danışma', 'iletişime geç', 'hemen ara'],
  'uygulama indirme': ['uygulamayı indir', 'ücretsiz dene', 'hemen başla', 'mobil uygulama'],
  'genel hizmet': ['hakkında bilgi al', 'hizmet incele', 'teklif iste'],
}

// ── Domain secondary keyword expansion ─────────────────────────────────────────

const DOMAIN_SECONDARY_KEYWORDS: Record<string, string[]> = {
  'mesleki belgelendirme': ['mesleki yeterlilik', 'mesleki sertifika', 'belgelendirme merkezi', 'MYK sınavı', 'mesleki onay'],
  'eğitim ve kurs': ['eğitim merkezi', 'online eğitim', 'sertifika programı', 'uzaktan eğitim', 'kurs merkezi'],
  'sağlık hizmetleri': ['sağlık merkezi', 'özel klinik', 'sağlık hizmeti', 'muayene fiyatları', 'doktor randevusu'],
  'e-ticaret / perakende': ['online alışveriş', 'ürün kataloğu', 'indirimli ürün', 'en ucuz', 'kampanyalı'],
  'gayrimenkul': ['emlak ilanı', 'satılık daire', 'kiralık konut', 'emlak firması', 'konut projeleri'],
  'finans ve sigortacılık': ['finansal hizmet', 'sigorta teklifi', 'yatırım danışmanlığı', 'kredi hesaplama'],
  'turizm ve seyahat': ['tatil paketi', 'otel rezervasyon', 'tur fiyatları', 'uçak bileti'],
  'yazılım ve teknoloji': ['dijital çözüm', 'yazılım hizmeti', 'bulut sistemleri', 'saas platformu'],
  'güzellik ve kişisel bakım': ['güzellik merkezi', 'cilt bakımı', 'güzellik salonu', 'bakım fiyatları'],
  'restoran ve gıda': ['yemek siparişi', 'restoran menüsü', 'catering hizmeti', 'yemek teslimatı'],
  'hukuk ve danışmanlık': ['hukuki danışma', 'avukat hizmeti', 'muhasebe hizmeti', 'vergi danışmanlığı'],
  'inşaat ve yapı': ['inşaat firması', 'tadilat hizmeti', 'yapı malzemeleri', 'müteahhit'],
  'otomotiv': ['araç satışı', 'oto servis', 'ikinci el araç', 'araç bakımı'],
  'lojistik ve taşımacılık': ['nakliye hizmeti', 'kargo firması', 'taşımacılık fiyatları'],
  'medya ve içerik': ['dijital medya', 'içerik üretimi', 'reklam ajansı'],
}

// ── Turkish city list for local query extraction ────────────────────────────────

const TURKISH_CITIES = [
  'istanbul', 'ankara', 'izmir', 'bursa', 'antalya', 'adana', 'konya', 'gaziantep',
  'mersin', 'kayseri', 'eskişehir', 'diyarbakır', 'trabzon', 'samsun', 'malatya',
  'kocaeli', 'gebze', 'denizli', 'şanlıurfa', 'hatay',
]

// ── Utility helpers ─────────────────────────────────────────────────────────────

function dedup(items: string[]): string[] {
  const seen = new Set<string>()
  return items.filter(s => {
    const k = (s || '').trim().toLowerCase()
    if (!k || seen.has(k)) return false
    seen.add(k)
    return true
  })
}

const FILLER_WORDS = new Set([
  'için', 'ile', 've', 'veya', 'da', 'de', 'den', 'dan', 'bir', 'bu', 'şu', 'o',
  'reklam', 'kampanya', 'arama', 'google', 'meta', 'facebook', 'instagram', 'ads',
  'display', 'search', 'video', 'performance', 'max', 'pmax', 'shopping',
  'türkiye', 'genel', 'test', 'yeni', 'aktif',
])

function extractMeaningfulWords(text: string, minLen = 4): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\sığüşöçİĞÜŞÖÇ]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length >= minLen && !FILLER_WORDS.has(t))
    .slice(0, 6)
}

function extractBrandNames(summary: string): string[] {
  if (!summary) return []
  // Capitalized words (≥3 chars) that look like proper nouns / brand names
  const matches = summary.match(/\b[A-ZÇĞİÖŞÜ][a-zçğışöüA-ZÇĞİÖŞÜ]{2,}(?:\s+[A-ZÇĞİÖŞÜ][a-zçğışöü]{2,})?\b/g) || []
  const COMMON_WORDS = new Set([
    'Bu', 'Bir', 'Ve', 'İle', 'Da', 'De', 'İçin', 'Olan', 'Olan', 'Web', 'Sayfa',
    'Site', 'Online', 'Türk', 'Türkiye', 'Hizmet', 'Ürün', 'Bilgi',
  ])
  return dedup(matches.filter(m => !COMMON_WORDS.has(m) && m.length >= 3)).slice(0, 3)
}

function extractLocations(audience: string): string[] {
  if (!audience) return []
  const lower = audience.toLowerCase()
  return TURKISH_CITIES.filter(c => lower.includes(c)).slice(0, 3)
}

function getGoogleModifiers(offerType: string): string[] {
  for (const [key, mods] of Object.entries(GOOGLE_OFFER_MODIFIERS)) {
    if (offerType.includes(key) || key.includes(offerType)) return mods
  }
  return GOOGLE_OFFER_MODIFIERS['genel hizmet']
}

function getMetaModifiers(offerType: string): string[] {
  for (const [key, mods] of Object.entries(META_OFFER_MODIFIERS)) {
    if (offerType.includes(key) || key.includes(offerType)) return mods
  }
  return META_OFFER_MODIFIERS['genel hizmet']
}

function getDomainSecondary(domain: string): string[] {
  for (const [key, kws] of Object.entries(DOMAIN_SECONDARY_KEYWORDS)) {
    if (domain.includes(key) || key.includes(domain)) return kws
  }
  return []
}

// ── Confidence score ───────────────────────────────────────────────────────────

function calculateConfidence(input: QueryExpanderInput, primaryCount: number): number {
  let score = 15
  const ip = input.intentProfile

  if (ip) {
    score += 20
    if (ip.confidence > 70) score += 20
    else if (ip.confidence > 40) score += 10
    if (ip.service_or_product && ip.service_or_product !== 'belirtilmemiş') score += 15
    if (ip.detected_keywords.length >= 3) score += 10
    else if (ip.detected_keywords.length >= 1) score += 5
    if (ip.landing_page_summary) score += 5
  }

  if ((input.keywordList?.length ?? 0) > 0) score += 8
  if ((input.adGroupNames?.length ?? 0) > 0) score += 4
  if (primaryCount >= 3) score += 5
  else if (primaryCount >= 1) score += 2

  return Math.min(90, score)
}

// ── Deterministic query builder ─────────────────────────────────────────────────

function buildDeterministicPlan(input: QueryExpanderInput): CompetitorQueryPlan {
  const { platform, intentProfile, campaignName, adGroupNames, keywordList } = input

  const primary: string[] = []
  const secondary: string[] = []
  const brand: string[] = []
  const local: string[] = []
  const negative: string[] = []

  const service = intentProfile?.service_or_product ?? ''
  const domain = intentProfile?.business_domain ?? ''
  const offerType = intentProfile?.offer_type ?? ''
  const audience = intentProfile?.target_audience ?? ''
  const ipKeywords = intentProfile?.detected_keywords ?? []
  const landingSummary = intentProfile?.landing_page_summary ?? ''

  const isGoogle = platform === 'google'
  const modifiers = isGoogle ? getGoogleModifiers(offerType) : getMetaModifiers(offerType)

  // 1. Service + platform modifiers → primary queries
  if (service && service !== 'belirtilmemiş' && service.length >= 3) {
    primary.push(service)
    for (const mod of modifiers.slice(0, 2)) {
      const q = `${service} ${mod}`.trim()
      if (q !== service) primary.push(q)
    }
  }

  // 2. Intent profile detected keywords
  for (const kw of ipKeywords) {
    const k = kw.trim()
    if (k.length < 3) continue
    const kLower = k.toLowerCase()
    const inPrimary = primary.some(p => p.toLowerCase() === kLower)
    if (primary.length < 5 && !inPrimary) {
      primary.push(k)
    } else if (
      !inPrimary &&
      secondary.length < 10 &&
      !secondary.some(s => s.toLowerCase() === kLower)
    ) {
      secondary.push(k)
    }
  }

  // 3. Explicit keyword list from ad account
  for (const kw of (keywordList ?? []).slice(0, 10)) {
    const k = kw.trim()
    if (k.length < 3) continue
    const inPrimary = primary.some(p => p.toLowerCase().includes(k.toLowerCase()))
    const inSecondary = secondary.some(s => s.toLowerCase().includes(k.toLowerCase()))
    if (!inPrimary && !inSecondary && secondary.length < 10) {
      secondary.push(k)
    }
  }

  // 4. Campaign name → secondary (meaningful words only)
  if (campaignName) {
    for (const p of extractMeaningfulWords(campaignName)) {
      if (!primary.some(x => x.toLowerCase().includes(p)) &&
          !secondary.some(x => x.toLowerCase().includes(p))) {
        secondary.push(p)
      }
    }
  }

  // 5. Ad group names → secondary
  for (const agName of (adGroupNames ?? []).slice(0, 3)) {
    for (const p of extractMeaningfulWords(agName).slice(0, 2)) {
      if (!secondary.some(x => x.toLowerCase().includes(p))) {
        secondary.push(p)
      }
    }
  }

  // 6. Domain-based secondary expansion
  for (const dk of getDomainSecondary(domain)) {
    if (!primary.includes(dk) && !secondary.includes(dk)) secondary.push(dk)
  }

  // 7. Service + remaining modifiers → secondary
  if (service && service !== 'belirtilmemiş') {
    for (const mod of modifiers.slice(2)) {
      const q = `${service} ${mod}`
      if (!primary.includes(q) && !secondary.includes(q)) secondary.push(q)
    }
  }

  // 8. Brand extraction from landing page summary
  const extractedBrands = extractBrandNames(landingSummary)
  brand.push(...extractedBrands)

  // 9. Local queries (audience-based city detection)
  for (const loc of extractLocations(audience)) {
    const base = service || primary[0] || ''
    if (base) local.push(`${base} ${loc}`)
  }

  // 10. Negative: detected brand names (likely own brand)
  negative.push(...extractedBrands.slice(0, 2))

  // ── Fallback: guarantee at least one primary query ──
  if (primary.length === 0) {
    if (campaignName) {
      const parts = extractMeaningfulWords(campaignName, 3)
      primary.push(...parts.slice(0, 3))
    }
    if (primary.length === 0 && domain && domain !== 'genel') {
      primary.push(domain)
    }
  }

  const dedupedPrimary = dedup(primary).slice(0, 5)
  const confidence = calculateConfidence(input, dedupedPrimary.length)

  const reason =
    confidence >= 70
      ? 'Intent profili ve kampanya verilerinden güçlü query plan üretildi'
      : confidence >= 40
        ? 'Kısmi sinyal — bazı alan/hizmet bilgileri eksik veya genel'
        : 'Zayıf sinyal — intent profili yok veya çok genel; fallback sorgular kullanıldı'

  return {
    platform,
    primary_queries: dedupedPrimary,
    secondary_queries: dedup(secondary).slice(0, 10),
    negative_queries: dedup(negative).slice(0, 5),
    brand_queries: dedup(brand).slice(0, 5),
    local_queries: dedup(local).slice(0, 5),
    confidence,
    reason,
    evidence: {
      service_or_product: service || null,
      business_domain: domain || null,
      offer_type: offerType || null,
      ip_keyword_count: ipKeywords.length,
      keyword_list_count: keywordList?.length ?? 0,
      has_landing_summary: !!landingSummary,
      platform_modifiers_used: modifiers.slice(0, 3),
    },
  }
}

// ── LLM enhancement (OpenAI, optional) ──────────────────────────────────────────

async function enhanceWithLLM(
  plan: CompetitorQueryPlan,
  input: QueryExpanderInput,
): Promise<CompetitorQueryPlan> {
  const openaiKey = process.env.OPENAI_API_KEY
  if (!openaiKey) return plan

  const { intentProfile, campaignName, platform } = input
  const platformLabel =
    platform === 'google'
      ? 'Google Ads Transparency (niyet odaklı arama sorguları)'
      : 'Meta Ad Library (sosyal reklam dili, keşif odaklı)'

  const system = `Sen bir rakip reklam analiz uzmanısın.
Platform: ${platformLabel}
Kampanya bağlamından en etkili rakip arama sorgularını üret.
JSON çıktısı üret. Türkçe sorgular öncelikli.
Kural: Kampanya verilerinden çıkar — marka/ürün adlarını varsayma.`

  const user = `Kampanya Adı: ${campaignName || '(yok)'}
İş Alanı: ${intentProfile?.business_domain || '(yok)'}
Hizmet/Ürün: ${intentProfile?.service_or_product || '(yok)'}
Teklif Tipi: ${intentProfile?.offer_type || '(yok)'}
Hedef Kitle: ${intentProfile?.target_audience || '(yok)'}
Anahtar Kelimeler: ${(intentProfile?.detected_keywords || []).join(', ') || '(yok)'}

Mevcut sorgular:
Primary: ${plan.primary_queries.join(' | ')}
Secondary: ${plan.secondary_queries.slice(0, 5).join(' | ')}

Ek bağlamsal sorgular öner:
{
  "additional_primary": ["sorgu1", "sorgu2"],
  "additional_secondary": ["sorgu3", "sorgu4", "sorgu5"],
  "reason": "neden bu sorgular seçildi"
}`

  try {
    const baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini'

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
      body: JSON.stringify({
        model,
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
        temperature: 0.4,
        max_tokens: 500,
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(20_000),
    })

    if (!res.ok) return plan

    const data = await res.json()
    const raw = data.choices?.[0]?.message?.content
    if (!raw) return plan

    const parsed: Record<string, unknown> = JSON.parse(raw)

    const addPrimary = Array.isArray(parsed.additional_primary)
      ? (parsed.additional_primary as unknown[])
          .filter((s): s is string => typeof s === 'string')
          .map(s => s.trim())
          .filter(Boolean)
      : []

    const addSecondary = Array.isArray(parsed.additional_secondary)
      ? (parsed.additional_secondary as unknown[])
          .filter((s): s is string => typeof s === 'string')
          .map(s => s.trim())
          .filter(Boolean)
      : []

    const llmReason = typeof parsed.reason === 'string' ? parsed.reason : ''

    return {
      ...plan,
      primary_queries: dedup([...plan.primary_queries, ...addPrimary]).slice(0, 5),
      secondary_queries: dedup([...plan.secondary_queries, ...addSecondary]).slice(0, 10),
      confidence: Math.min(90, plan.confidence + 15),
      reason: llmReason
        ? `${plan.reason} · LLM: ${llmReason}`
        : `${plan.reason} · LLM ile genişletildi`,
    }
  } catch {
    // LLM başarısız → deterministic plan korunur, sistem çalışmaya devam eder
    return plan
  }
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Deterministic (sync) query plan üretir. LLM çağrısı yapmaz.
 * Test ve hızlı çalışma için kullanılır.
 */
export function buildDeterministicQueryPlan(input: QueryExpanderInput): CompetitorQueryPlan {
  return buildDeterministicPlan(input)
}

/**
 * Bağlamsal rakip arama query planı üretir.
 * Önce deterministic heuristic çalışır.
 * Confidence < 50 ise OpenAI ile genişletilir (OPENAI_API_KEY gerekli).
 * LLM başarısız olsa bile sistem çalışır — deterministic fallback döner.
 */
export async function expandCompetitorQueries(input: QueryExpanderInput): Promise<CompetitorQueryPlan> {
  const plan = buildDeterministicPlan(input)

  if (plan.confidence >= 50) return plan

  return enhanceWithLLM(plan, input)
}
