import 'server-only'
import { supabase } from '@/lib/supabase/client'
import { scanBusinessSource } from '@/lib/yoai/businessSourceScanner'
import { claudeText, isClaudeReady } from '@/lib/anthropic/text'
import { upsertBrief } from '@/lib/seo/siteContentBriefStore'

export interface SiteBriefResult {
  ok: boolean
  status: 'completed' | 'partial' | 'failed'
  error?: string
}

/** Modelden gelen metinden ilk JSON objesini ayıkla (kod bloğu toleranslı). */
function extractJson(text: string): Record<string, unknown> | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fenced ? fenced[1] : text
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start === -1 || end === -1 || end < start) return null
  try { return JSON.parse(candidate.slice(start, end + 1)) } catch { return null }
}

function asArr(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.map((x) => String(x).trim()).filter(Boolean).slice(0, 30)
}

async function getBaseUrl(siteConnectionId: string): Promise<string | null> {
  if (!supabase) return null
  const { data } = await supabase
    .from('site_connections')
    .select('base_url')
    .eq('id', siteConnectionId)
    .maybeSingle()
  return (data as { base_url?: string } | null)?.base_url ?? null
}

/**
 * Hedef siteyi tarar, Claude ile siteye-özgü içerik brief'i sentezler ve
 * site_content_briefs'e yazar. THROW etmez — hata = 'failed' kaydı.
 * Fire-and-forget güvenli; makale akışını asla bloklamaz.
 */
export async function runSiteBriefPipeline(siteConnectionId: string, userId: string): Promise<SiteBriefResult> {
  await upsertBrief(userId, siteConnectionId, { scan_status: 'running', last_error: null })

  const baseUrl = await getBaseUrl(siteConnectionId)
  if (!baseUrl) {
    await upsertBrief(userId, siteConnectionId, { scan_status: 'failed', last_error: 'no_base_url' })
    return { ok: false, status: 'failed', error: 'no_base_url' }
  }

  // 1) Tara (HTTP scrape; LLM yok)
  const scan = await scanBusinessSource({ source_type: 'website', source_url: baseUrl })
  if (scan.scan_status !== 'completed') {
    await upsertBrief(userId, siteConnectionId, {
      scan_status: 'failed',
      last_error: scan.error_message ?? `scan_${scan.scan_status}`,
      scanned_at: new Date().toISOString(),
    })
    return { ok: false, status: 'failed', error: scan.error_message ?? `scan_${scan.scan_status}` }
  }

  // 2) Claude sentezi (yoksa deterministik scrape alanlarıyla 'partial')
  const fallback = {
    company_name: scan.extracted_title,
    sector: null as string | null,
    brand_tone: scan.extracted_brand_tone,
    target_audience: scan.extracted_audience,
    products_or_services: scan.extracted_products,
    categories: scan.extracted_services,
    keyword_themes: scan.extracted_keywords,
    content_angles: [] as string[],
    audience_pains: [] as string[],
  }

  if (!isClaudeReady()) {
    await upsertBrief(userId, siteConnectionId, {
      scan_status: 'partial',
      ...fallback,
      summary_text: buildSummary(fallback),
      scanned_at: new Date().toISOString(),
      last_error: null,
    })
    return { ok: true, status: 'partial' }
  }

  const prompt = `Aşağıda bir işletmenin web sitesinden taranmış içerik var. Bu işletmenin SEO blog içeriği üretimi için kullanılacak yapılandırılmış bir profil çıkar.

SİTE: ${baseUrl}
BAŞLIK: ${scan.extracted_title ?? '-'}
AÇIKLAMA: ${scan.extracted_description ?? '-'}
TESPİT EDİLEN HİZMETLER: ${scan.extracted_services.join(', ') || '-'}
TESPİT EDİLEN ÜRÜNLER: ${scan.extracted_products.join(', ') || '-'}
ANAHTAR KELİMELER: ${scan.extracted_keywords.join(', ') || '-'}
SAYFA METNİ (özet): ${scan.raw_excerpt ?? '-'}

SADECE şu şemada geçerli bir JSON döndür (kod bloğu/açıklama ekleme):
{
  "company_name": "firma adı",
  "sector": "ana sektör (kısa)",
  "brand_tone": "marka tonu (kısa)",
  "target_audience": "hedef kitle (kısa)",
  "products_or_services": ["..."],
  "categories": ["sitedeki ayrı hizmet/kategoriler — her biri bir blog konusu ekseni olabilecek şekilde"],
  "keyword_themes": ["..."],
  "content_angles": ["blog içerik açıları"],
  "audience_pains": ["kitlenin sorunları/ihtiyaçları"]
}`

  const text = await claudeText({ user: prompt, maxTokens: 1500, temperature: 0.4, timeoutMs: 60000 })
  const parsed = text ? extractJson(text) : null

  const merged = parsed
    ? {
        company_name: (parsed.company_name as string) || fallback.company_name,
        sector: (parsed.sector as string) || fallback.sector,
        brand_tone: (parsed.brand_tone as string) || fallback.brand_tone,
        target_audience: (parsed.target_audience as string) || fallback.target_audience,
        products_or_services: asArr(parsed.products_or_services).length ? asArr(parsed.products_or_services) : fallback.products_or_services,
        categories: asArr(parsed.categories).length ? asArr(parsed.categories) : fallback.categories,
        keyword_themes: asArr(parsed.keyword_themes).length ? asArr(parsed.keyword_themes) : fallback.keyword_themes,
        content_angles: asArr(parsed.content_angles),
        audience_pains: asArr(parsed.audience_pains),
      }
    : fallback

  await upsertBrief(userId, siteConnectionId, {
    scan_status: parsed ? 'completed' : 'partial',
    ...merged,
    summary_text: buildSummary(merged),
    scanned_at: new Date().toISOString(),
    last_error: null,
  })
  return { ok: true, status: parsed ? 'completed' : 'partial' }
}

function buildSummary(b: {
  company_name: string | null; sector: string | null; brand_tone: string | null
  target_audience: string | null; products_or_services: string[]; categories: string[]
  keyword_themes: string[]; content_angles: string[]; audience_pains: string[]
}): string {
  const lines: string[] = []
  if (b.company_name) lines.push(`İşletme: ${b.company_name}`)
  if (b.sector) lines.push(`Sektör: ${b.sector}`)
  if (b.products_or_services.length) lines.push(`Ürün/Hizmetler: ${b.products_or_services.join(', ')}`)
  if (b.categories.length) lines.push(`Kategoriler: ${b.categories.join(', ')}`)
  if (b.target_audience) lines.push(`Hedef kitle: ${b.target_audience}`)
  if (b.keyword_themes.length) lines.push(`Anahtar temalar: ${b.keyword_themes.join(', ')}`)
  if (b.content_angles.length) lines.push(`İçerik açıları: ${b.content_angles.join(', ')}`)
  if (b.audience_pains.length) lines.push(`Kitle sorunları: ${b.audience_pains.join(', ')}`)
  if (b.brand_tone) lines.push(`Marka tonu: ${b.brand_tone}`)
  return lines.join('\n')
}
