import 'server-only'
import { supabase } from '@/lib/supabase/client'
import { getProfileByUserId, getIntelligenceByUserId } from '@/lib/yoai/businessProfileStore'
import { claudeText } from '@/lib/anthropic/text'
import { getBriefByConnection, type SiteContentBriefRow } from '@/lib/seo/siteContentBriefStore'
import { runSiteBriefPipeline } from '@/lib/seo/siteBriefPipeline'

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

async function getSiteBaseUrl(siteConnectionId: string): Promise<string | null> {
  if (!supabase) return null
  const { data } = await supabase
    .from('site_connections')
    .select('base_url')
    .eq('id', siteConnectionId)
    .maybeSingle()
  return (data as { base_url?: string } | null)?.base_url ?? null
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

function buildContextFromBrief(brief: SiteContentBriefRow): string {
  if (brief.summary_text && brief.summary_text.trim()) return brief.summary_text
  const lines: string[] = []
  if (brief.company_name) lines.push(`İşletme: ${brief.company_name}`)
  if (brief.sector) lines.push(`Sektör: ${brief.sector}`)
  if (brief.products_or_services?.length) lines.push(`Ürün/Hizmetler: ${brief.products_or_services.join(', ')}`)
  if (brief.categories?.length) lines.push(`Kategoriler: ${brief.categories.join(', ')}`)
  if (brief.target_audience) lines.push(`Hedef kitle: ${brief.target_audience}`)
  if (brief.keyword_themes?.length) lines.push(`Anahtar temalar: ${brief.keyword_themes.join(', ')}`)
  return lines.join('\n')
}

/** Son başlıklarda EN AZ kullanılmış kategoriyi seç (round-robin kapsama). */
export function pickRotatingCategory(categories: string[], recentTitles: string[]): string | null {
  const cats = categories.map((c) => c.trim()).filter(Boolean)
  if (!cats.length) return null
  const lowered = recentTitles.map((t) => t.toLowerCase())
  let best = cats[0]
  let bestCount = Infinity
  for (const cat of cats) {
    const c = cat.toLowerCase()
    const count = lowered.filter((t) => t.includes(c)).length
    if (count < bestCount) { bestCount = count; best = cat }
  }
  return best
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
  language: 'tr' | 'en',
  category?: string | null
): Promise<string | null> {
  const langName = language === 'en' ? 'English' : 'Türkçe'
  const year = new Date().getFullYear()
  const recent = recentTitles.length
    ? `\n\nZaten yayınlanmış başlıklar (bunlardan FARKLI, çakışmayan bir konu seç):\n${recentTitles.map((t) => `- ${t}`).join('\n')}`
    : ''
  const catLine = category ? `\n\nBu makale ŞU HİZMET/KATEGORİYE odaklanmalı: ${category}` : ''
  const prompt = `Aşağıdaki işletme için ${langName} dilinde, SEO açısından değerli, arama hacmi olabilecek YENİ bir blog makalesi konusu/anahtar kelimesi öner.
İşletme bağlamı:
${businessContext || '(bağlam yok — sektörel genel bir konu seç)'}${catLine}${recent}

Güncel yıl ${year}. Konu/anahtar kelimede yıl geçecekse MUTLAKA ${year} kullan; geçmiş yılları (örn. ${year - 1}, ${year - 2}) ASLA yazma.

SADECE anahtar kelime/konu ifadesini döndür (3-6 kelime), başka hiçbir şey yazma.`
  const text = await claudeText({ user: prompt, maxTokens: 60, temperature: 0.8 })
  const kw = text?.trim().replace(/^["'•\-\s]+|["'\s]+$/g, '')
  return kw || null
}

export async function selectDailyTopic(
  userId: string,
  opts: { keywordPool?: string[]; language?: 'tr' | 'en'; siteConnectionId?: string; targetCategories?: string[] }
): Promise<TopicResult> {
  const language = opts.language ?? 'tr'
  const recentTitles = await fetchRecentTitles(userId)

  // Bağlam kaynağı KRİTİK (bug fix): bir SİTE bağlıysa (siteConnectionId) bağlam
  // YALNIZ o sitenin brief'inden gelir. Kullanıcının global iş profiline ASLA
  // düşülmez — o profil başka bir firma olabilir (ör. eskiden eklenmiş başka bir
  // işletme); aksi halde bağlı site için yanlış firmanın konulu makalesi üretilir.
  let businessContext = ''
  let briefCategories: string[] = []

  const isUsableBrief = (b: SiteContentBriefRow | null): b is SiteContentBriefRow =>
    !!b && (b.scan_status === 'completed' || b.scan_status === 'partial')

  if (opts.siteConnectionId) {
    let brief = await getBriefByConnection(opts.siteConnectionId)
    if (!isUsableBrief(brief)) {
      // Brief hazır değil (yok / takılı 'running' / 'failed') → ŞİMDİ üret, sonra
      // tekrar oku. Böylece site-özgü bağlam kesinleşir; global profile düşülmez.
      await runSiteBriefPipeline(opts.siteConnectionId, userId).catch(() => {})
      brief = await getBriefByConnection(opts.siteConnectionId)
    }
    if (isUsableBrief(brief)) {
      businessContext = buildContextFromBrief(brief)
      briefCategories = brief.categories ?? []
    } else {
      // Tarama hâlâ başarısız → SİTE URL'inden minimal bağlam (global profile DEĞİL).
      const baseUrl = await getSiteBaseUrl(opts.siteConnectionId)
      businessContext = baseUrl
        ? `Hedef site: ${baseUrl}\n(Site içeriği taranamadı; bu siteye uygun, sektörel genel bir konu seç.)`
        : ''
    }
  } else {
    // Hiç site bağlı değil (legacy yol) → kullanıcının global iş profili + intelligence.
    const [profile, intel] = await Promise.all([getProfileByUserId(userId), getIntelligenceByUserId(userId)])
    businessContext = buildContext(profile, intel)
  }

  // 1) Havuz doluysa → kullanıcı kelimesi HER ZAMAN kazanır.
  const fromPool = pickFromPool(opts.keywordPool ?? [], recentTitles)
  if (fromPool) {
    return { keyword: fromPool, businessContext, recentTitles }
  }

  // 2) Kategori rotasyonu + AI seçimi.
  const cats = (opts.targetCategories && opts.targetCategories.length) ? opts.targetCategories : briefCategories
  const category = pickRotatingCategory(cats, recentTitles)
  const aiKeyword = await aiSelectKeyword(businessContext, recentTitles, language, category)
  if (aiKeyword) {
    return { keyword: aiKeyword, businessContext, recentTitles }
  }

  // 3) Son çare.
  const fallback =
    briefCategories[0] ||
    (language === 'en' ? 'industry tips' : 'sektörel öneriler')
  return { keyword: fallback, businessContext, recentTitles }
}
