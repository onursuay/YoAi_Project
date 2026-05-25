import 'server-only'
import { supabase } from '@/lib/supabase/client'
import { getProfileByUserId, getIntelligenceByUserId } from '@/lib/yoai/businessProfileStore'

/**
 * Otomatik makale akışı için günlük SEO konusu/anahtar kelime seçimi.
 *
 * Öncelik:
 *   1) keyword_pool doluysa → son makalelerde kullanılmamış ilk keyword.
 *   2) Aksi halde → işletme profili + intelligence + son başlıklardan AI ile
 *      çakışmayan yeni bir SEO konusu/anahtar kelime üretir.
 *
 * Ayrıca articleGenerator'a verilecek "businessContext" özetini hazırlar.
 */

export interface TopicResult {
  keyword: string
  businessContext: string
  recentTitles: string[]
}

async function fetchRecentTitles(userId: string, limit = 14): Promise<string[]> {
  if (!supabase) return []
  const { data } = await supabase
    .from('yoai_articles')
    .select('title')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  return (data ?? []).map((r) => (r as { title: string }).title).filter(Boolean)
}

function buildContext(
  profile: Awaited<ReturnType<typeof getProfileByUserId>>,
  intel: Awaited<ReturnType<typeof getIntelligenceByUserId>>
): string {
  const lines: string[] = []
  if (profile) {
    if (profile.company_name) lines.push(`İşletme: ${profile.company_name}`)
    const sector = [profile.sector_main, profile.sector_sub].filter(Boolean).join(' / ')
    if (sector) lines.push(`Sektör: ${sector}`)
    if (profile.business_description) lines.push(`Açıklama: ${profile.business_description}`)
    if (profile.target_audience) lines.push(`Hedef kitle: ${profile.target_audience}`)
    if (profile.products_or_services?.length) lines.push(`Ürün/Hizmetler: ${profile.products_or_services.join(', ')}`)
    if (profile.keywords?.length) lines.push(`Anahtar kelimeler: ${profile.keywords.join(', ')}`)
    if (profile.brand_tone) lines.push(`Marka tonu: ${profile.brand_tone}`)
    if (profile.forbidden_claims?.length) lines.push(`Kullanılmayacak iddialar: ${profile.forbidden_claims.join(', ')}`)
  }
  if (intel) {
    if (intel.keyword_themes?.length) lines.push(`Anahtar temalar: ${intel.keyword_themes.join(', ')}`)
    if (intel.recommended_content_angles?.length) lines.push(`İçerik açıları: ${intel.recommended_content_angles.join(', ')}`)
    if (intel.audience_pains?.length) lines.push(`Kitle sorunları: ${intel.audience_pains.join(', ')}`)
  }
  return lines.join('\n')
}

/** keyword_pool'dan son başlıklarda geçmeyen ilkini seç (yoksa ilkini). */
function pickFromPool(pool: string[], recentTitles: string[]): string | null {
  if (!pool.length) return null
  const lowered = recentTitles.map((t) => t.toLowerCase())
  const unused = pool.find((kw) => !lowered.some((t) => t.includes(kw.toLowerCase())))
  return unused || pool[Math.floor(Math.random() * pool.length)]
}

async function aiSelectKeyword(
  businessContext: string,
  recentTitles: string[],
  language: 'tr' | 'en'
): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return null
  const baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini'

  const langName = language === 'en' ? 'English' : 'Türkçe'
  const recent = recentTitles.length
    ? `\n\nZaten yayınlanmış başlıklar (bunlardan FARKLI, çakışmayan bir konu seç):\n${recentTitles.map((t) => `- ${t}`).join('\n')}`
    : ''

  const prompt = `Aşağıdaki işletme için ${langName} dilinde, SEO açısından değerli, arama hacmi olabilecek YENİ bir blog makalesi konusu/anahtar kelimesi öner.
İşletme bağlamı:
${businessContext || '(bağlam yok — sektörel genel bir konu seç)'}${recent}

SADECE anahtar kelime/konu ifadesini döndür (3-6 kelime), başka hiçbir şey yazma.`

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.8,
        max_tokens: 40,
      }),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] }
    const kw = data.choices?.[0]?.message?.content?.trim().replace(/^["'•\-\s]+|["'\s]+$/g, '')
    return kw || null
  } catch {
    return null
  }
}

export async function selectDailyTopic(
  userId: string,
  opts: { keywordPool?: string[]; language?: 'tr' | 'en' }
): Promise<TopicResult> {
  const language = opts.language ?? 'tr'
  const [profile, intel, recentTitles] = await Promise.all([
    getProfileByUserId(userId),
    getIntelligenceByUserId(userId),
    fetchRecentTitles(userId),
  ])
  const businessContext = buildContext(profile, intel)

  // 1) Havuzdan
  const fromPool = pickFromPool(opts.keywordPool ?? [], recentTitles)
  if (fromPool) {
    return { keyword: fromPool, businessContext, recentTitles }
  }

  // 2) AI seçimi
  const aiKeyword = await aiSelectKeyword(businessContext, recentTitles, language)
  if (aiKeyword) {
    return { keyword: aiKeyword, businessContext, recentTitles }
  }

  // 3) Son çare: profil anahtar kelimesi / sektör / genel
  const fallback =
    profile?.keywords?.[0] ||
    profile?.sector_main ||
    (language === 'en' ? 'digital marketing tips' : 'dijital pazarlama önerileri')
  return { keyword: fallback, businessContext, recentTitles }
}
