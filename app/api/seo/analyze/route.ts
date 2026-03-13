import { NextRequest, NextResponse } from 'next/server'
import * as cheerio from 'cheerio'

interface Check {
  id: string
  title: string
  description: string
  status: 'pass' | 'fail' | 'warning'
  value?: string
}

interface Category {
  score: number
  checks: Check[]
}

interface LighthouseAudit {
  id: string
  title: string
  description: string
  score: number | null
  displayValue?: string
}

interface LighthouseResult {
  performance: number
  accessibility: number
  bestPractices: number
  seo: number
  coreWebVitals: {
    fcp: string
    lcp: string
    tbt: string
    cls: string
    si: string
  }
  audits: LighthouseAudit[]
}

interface KeywordInfo {
  word: string
  count: number
  density: number
  inTitle: boolean
  inH1: boolean
  inMetaDesc: boolean
}

interface BrokenLink {
  url: string
  status: number | string
  anchor: string
}

interface RedirectHop {
  url: string
  status: number
}

function normalizeUrl(input: string): string {
  let url = input.trim()
  if (!/^https?:\/\//i.test(url)) {
    url = 'https://' + url
  }
  return url
}

function calcCategoryScore(checks: Check[]): number {
  if (checks.length === 0) return 0
  const passed = checks.filter(c => c.status === 'pass').length
  const warned = checks.filter(c => c.status === 'warning').length
  return Math.round(((passed + warned * 0.5) / checks.length) * 100)
}

// ─── STOP WORDS (TR + EN) ───
const stopWords = new Set([
  'bir','ve','de','da','bu','ile','için','den','dan','mi','mı','mu','mü',
  'ne','o','ben','sen','biz','siz','var','yok','ama','veya','ki','gibi',
  'daha','en','çok','her','tüm','olan','olarak','ya','hem','a','the',
  'and','or','is','in','on','at','to','for','of','with','by','from',
  'an','it','be','was','are','were','been','has','have','had','do',
  'does','did','will','would','could','should','may','might','can',
  'this','that','these','those','not','no','but','if','so','as','its',
])

function analyzeMetaTags($: cheerio.CheerioAPI): Category {
  const checks: Check[] = []

  const title = $('title').first().text().trim()
  if (!title) {
    checks.push({ id: 'title-exists', title: 'Title Etiketi', description: 'Sayfa title etiketi bulunamadı. Her sayfada benzersiz bir title etiketi olmalıdır.', status: 'fail' })
  } else if (title.length < 30) {
    checks.push({ id: 'title-length', title: 'Title Etiketi', description: `Title çok kısa (${title.length} karakter). 30-60 karakter önerilir.`, status: 'warning', value: title })
  } else if (title.length > 60) {
    checks.push({ id: 'title-length', title: 'Title Etiketi', description: `Title çok uzun (${title.length} karakter). 30-60 karakter önerilir.`, status: 'warning', value: title })
  } else {
    checks.push({ id: 'title-ok', title: 'Title Etiketi', description: `Title uygun uzunlukta (${title.length} karakter).`, status: 'pass', value: title })
  }

  const metaDesc = $('meta[name="description"]').attr('content')?.trim() || ''
  if (!metaDesc) {
    checks.push({ id: 'meta-desc-exists', title: 'Meta Description', description: 'Meta description bulunamadı. Her sayfada açıklayıcı bir meta description olmalıdır.', status: 'fail' })
  } else if (metaDesc.length < 120) {
    checks.push({ id: 'meta-desc-length', title: 'Meta Description', description: `Meta description kısa (${metaDesc.length} karakter). 120-160 karakter önerilir.`, status: 'warning', value: metaDesc })
  } else if (metaDesc.length > 160) {
    checks.push({ id: 'meta-desc-length', title: 'Meta Description', description: `Meta description uzun (${metaDesc.length} karakter). 120-160 karakter önerilir.`, status: 'warning', value: metaDesc })
  } else {
    checks.push({ id: 'meta-desc-ok', title: 'Meta Description', description: `Meta description uygun uzunlukta (${metaDesc.length} karakter).`, status: 'pass', value: metaDesc })
  }

  const canonical = $('link[rel="canonical"]').attr('href')?.trim() || ''
  if (canonical) {
    checks.push({ id: 'canonical', title: 'Canonical URL', description: 'Canonical URL tanımlı.', status: 'pass', value: canonical })
  } else {
    checks.push({ id: 'canonical', title: 'Canonical URL', description: 'Canonical URL bulunamadı. Duplicate content sorunlarını önlemek için eklenmelidir.', status: 'warning' })
  }

  const viewport = $('meta[name="viewport"]').attr('content')?.trim() || ''
  if (viewport) {
    checks.push({ id: 'viewport', title: 'Viewport Meta', description: 'Viewport meta etiketi tanımlı. Mobil uyumluluk sağlanıyor.', status: 'pass', value: viewport })
  } else {
    checks.push({ id: 'viewport', title: 'Viewport Meta', description: 'Viewport meta etiketi bulunamadı. Mobil uyumluluk için gereklidir.', status: 'fail' })
  }

  const robotsMeta = $('meta[name="robots"]').attr('content')?.trim() || ''
  if (robotsMeta) {
    const isNoindex = robotsMeta.toLowerCase().includes('noindex')
    checks.push({
      id: 'robots-meta', title: 'Robots Meta',
      description: isNoindex ? 'Sayfa noindex olarak işaretli. Arama motorları bu sayfayı indexlemeyecek.' : 'Robots meta etiketi tanımlı.',
      status: isNoindex ? 'warning' : 'pass', value: robotsMeta,
    })
  } else {
    checks.push({ id: 'robots-meta', title: 'Robots Meta', description: 'Robots meta etiketi tanımlı değil. Varsayılan olarak index,follow uygulanır.', status: 'pass' })
  }

  const metaKeywords = $('meta[name="keywords"]').attr('content')?.trim() || ''
  if (metaKeywords) {
    checks.push({ id: 'meta-keywords', title: 'Meta Keywords', description: 'Meta keywords tanımlı. Not: Google bu etiketi ranking faktörü olarak kullanmıyor.', status: 'pass', value: metaKeywords.substring(0, 100) + (metaKeywords.length > 100 ? '...' : '') })
  }

  return { score: calcCategoryScore(checks), checks }
}

function analyzeHeadings($: cheerio.CheerioAPI): Category {
  const checks: Check[] = []
  const h1s = $('h1')
  if (h1s.length === 0) {
    checks.push({ id: 'h1-exists', title: 'H1 Etiketi', description: 'H1 etiketi bulunamadı. Her sayfada bir adet H1 olmalıdır.', status: 'fail' })
  } else if (h1s.length === 1) {
    checks.push({ id: 'h1-unique', title: 'H1 Etiketi', description: 'Sayfada tek bir H1 etiketi var.', status: 'pass', value: h1s.first().text().trim().substring(0, 100) })
  } else {
    checks.push({ id: 'h1-multiple', title: 'H1 Etiketi', description: `Sayfada ${h1s.length} adet H1 etiketi var. Tek bir H1 kullanılması önerilir.`, status: 'warning' })
  }

  const headingCounts: Record<string, number> = {}
  for (let i = 2; i <= 6; i++) headingCounts[`h${i}`] = $(`h${i}`).length

  if (headingCounts.h2 > 0) {
    checks.push({ id: 'h2-exists', title: 'H2 Etiketleri', description: `${headingCounts.h2} adet H2 etiketi bulundu.`, status: 'pass' })
  } else {
    checks.push({ id: 'h2-exists', title: 'H2 Etiketleri', description: 'H2 etiketi bulunamadı. İçerik yapısını düzenlemek için H2 etiketleri kullanın.', status: 'warning' })
  }

  let hierarchyOk = true
  if (headingCounts.h2 === 0 && (headingCounts.h3 > 0 || headingCounts.h4 > 0)) hierarchyOk = false
  if (headingCounts.h3 === 0 && headingCounts.h4 > 0) hierarchyOk = false
  checks.push({
    id: 'heading-hierarchy', title: 'Heading Hiyerarşisi',
    description: hierarchyOk ? 'Heading etiketleri doğru sırayla kullanılmış.' : 'Heading hiyerarşisinde atlama var. H1>H2>H3 sırasını takip edin.',
    status: hierarchyOk ? 'pass' : 'warning',
  })

  const totalHeadings = h1s.length + Object.values(headingCounts).reduce((a, b) => a + b, 0)
  checks.push({
    id: 'heading-count', title: 'Toplam Heading Sayısı',
    description: `Toplam ${totalHeadings} heading etiketi bulundu.`,
    status: totalHeadings > 0 ? 'pass' : 'warning',
    value: `H1:${h1s.length} H2:${headingCounts.h2} H3:${headingCounts.h3} H4:${headingCounts.h4} H5:${headingCounts.h5} H6:${headingCounts.h6}`,
  })

  return { score: calcCategoryScore(checks), checks }
}

function analyzeImages($: cheerio.CheerioAPI): Category {
  const checks: Check[] = []
  const images = $('img')
  const totalImages = images.length
  if (totalImages === 0) {
    checks.push({ id: 'no-images', title: 'Görseller', description: 'Sayfada görsel bulunamadı.', status: 'pass' })
    return { score: 100, checks }
  }

  let missingAlt = 0
  let emptyAlt = 0
  images.each((_, el) => {
    const alt = $(el).attr('alt')
    if (alt === undefined) missingAlt++
    else if (alt.trim() === '') emptyAlt++
  })
  const withAlt = totalImages - missingAlt - emptyAlt

  if (missingAlt === 0 && emptyAlt === 0) {
    checks.push({ id: 'alt-tags', title: 'Alt Etiketleri', description: `Tüm görsellerde (${totalImages}) alt etiketi tanımlı.`, status: 'pass' })
  } else {
    if (missingAlt > 0) checks.push({ id: 'alt-missing', title: 'Eksik Alt Etiketi', description: `${missingAlt}/${totalImages} görselde alt etiketi eksik.`, status: 'fail' })
    if (emptyAlt > 0) checks.push({ id: 'alt-empty', title: 'Boş Alt Etiketi', description: `${emptyAlt}/${totalImages} görselde alt etiketi boş.`, status: 'warning' })
    if (withAlt > 0) checks.push({ id: 'alt-ok', title: 'Alt Etiketi Mevcut', description: `${withAlt}/${totalImages} görselde alt etiketi düzgün tanımlı.`, status: 'pass' })
  }
  checks.push({ id: 'image-count', title: 'Toplam Görsel', description: `Sayfada ${totalImages} adet görsel bulundu.`, status: 'pass', value: `${totalImages} görsel` })

  return { score: calcCategoryScore(checks), checks }
}

function analyzeLinks($: cheerio.CheerioAPI, baseUrl: string): Category {
  const checks: Check[] = []
  const links = $('a[href]')
  let internal = 0, external = 0, nofollow = 0, emptyHref = 0
  let baseHost = ''
  try { baseHost = new URL(baseUrl).hostname } catch { /* */ }

  links.each((_, el) => {
    const href = $(el).attr('href')?.trim() || ''
    const rel = $(el).attr('rel')?.toLowerCase() || ''
    if (!href || href === '#' || href === 'javascript:void(0)') { emptyHref++; return }
    if (rel.includes('nofollow')) nofollow++
    try {
      const linkUrl = new URL(href, baseUrl)
      if (linkUrl.hostname === baseHost) internal++; else external++
    } catch { internal++ }
  })

  checks.push({ id: 'internal-links', title: 'Internal Linkler', description: `${internal} adet internal link bulundu.`, status: internal > 0 ? 'pass' : 'warning', value: `${internal}` })
  checks.push({ id: 'external-links', title: 'External Linkler', description: `${external} adet external link bulundu.`, status: 'pass', value: `${external}` })
  if (nofollow > 0) checks.push({ id: 'nofollow-links', title: 'Nofollow Linkler', description: `${nofollow} adet nofollow link bulundu.`, status: 'pass', value: `${nofollow}` })
  if (emptyHref > 0) checks.push({ id: 'empty-href', title: 'Boş/Geçersiz Linkler', description: `${emptyHref} adet boş veya geçersiz href bulundu.`, status: 'warning' })
  checks.push({ id: 'total-links', title: 'Toplam Link', description: `Sayfada ${internal + external} adet link bulundu.`, status: (internal + external) > 0 ? 'pass' : 'warning', value: `${internal + external}` })

  return { score: calcCategoryScore(checks), checks }
}

function analyzeSocial($: cheerio.CheerioAPI): Category {
  const checks: Check[] = []
  const ogTitle = $('meta[property="og:title"]').attr('content')?.trim() || ''
  const ogDesc = $('meta[property="og:description"]').attr('content')?.trim() || ''
  const ogImage = $('meta[property="og:image"]').attr('content')?.trim() || ''
  const ogUrl = $('meta[property="og:url"]').attr('content')?.trim() || ''

  checks.push(ogTitle ? { id: 'og-title', title: 'OG Title', description: 'Open Graph title tanımlı.', status: 'pass', value: ogTitle } : { id: 'og-title', title: 'OG Title', description: 'Open Graph title bulunamadı.', status: 'fail' })
  checks.push(ogDesc ? { id: 'og-desc', title: 'OG Description', description: 'Open Graph description tanımlı.', status: 'pass', value: ogDesc.substring(0, 100) } : { id: 'og-desc', title: 'OG Description', description: 'Open Graph description bulunamadı.', status: 'fail' })
  checks.push(ogImage ? { id: 'og-image', title: 'OG Image', description: 'Open Graph image tanımlı.', status: 'pass', value: ogImage } : { id: 'og-image', title: 'OG Image', description: 'Open Graph image bulunamadı.', status: 'fail' })
  checks.push(ogUrl ? { id: 'og-url', title: 'OG URL', description: 'Open Graph URL tanımlı.', status: 'pass', value: ogUrl } : { id: 'og-url', title: 'OG URL', description: 'Open Graph URL tanımlı değil.', status: 'warning' })

  const twCard = $('meta[name="twitter:card"]').attr('content')?.trim() || ''
  const twTitle = $('meta[name="twitter:title"]').attr('content')?.trim() || ''
  const twDesc = $('meta[name="twitter:description"]').attr('content')?.trim() || ''
  checks.push(twCard ? { id: 'tw-card', title: 'Twitter Card', description: 'Twitter Card tipi tanımlı.', status: 'pass', value: twCard } : { id: 'tw-card', title: 'Twitter Card', description: 'Twitter Card etiketi bulunamadı.', status: 'warning' })
  checks.push(twTitle ? { id: 'tw-title', title: 'Twitter Title', description: 'Twitter title tanımlı.', status: 'pass', value: twTitle } : { id: 'tw-title', title: 'Twitter Title', description: 'Twitter title tanımlı değil.', status: 'warning' })
  checks.push(twDesc ? { id: 'tw-desc', title: 'Twitter Description', description: 'Twitter description tanımlı.', status: 'pass' } : { id: 'tw-desc', title: 'Twitter Description', description: 'Twitter description tanımlı değil.', status: 'warning' })

  return { score: calcCategoryScore(checks), checks }
}

async function analyzeTechnical($: cheerio.CheerioAPI, url: string): Promise<Category> {
  const checks: Check[] = []
  const isHttps = url.startsWith('https://')
  checks.push({ id: 'https', title: 'HTTPS', description: isHttps ? 'Site HTTPS kullanıyor.' : 'Site HTTPS kullanmıyor. HTTPS\'e geçiş yapılmalıdır.', status: isHttps ? 'pass' : 'fail' })

  const lang = $('html').attr('lang')?.trim() || ''
  checks.push(lang ? { id: 'lang', title: 'Dil Etiketi', description: `HTML lang etiketi tanımlı: "${lang}".`, status: 'pass', value: lang } : { id: 'lang', title: 'Dil Etiketi', description: 'HTML lang etiketi bulunamadı.', status: 'fail' })

  const favicon = $('link[rel="icon"], link[rel="shortcut icon"]').first().attr('href')?.trim() || ''
  checks.push(favicon ? { id: 'favicon', title: 'Favicon', description: 'Favicon tanımlı.', status: 'pass', value: favicon } : { id: 'favicon', title: 'Favicon', description: 'Favicon bulunamadı.', status: 'warning' })

  const jsonLd = $('script[type="application/ld+json"]')
  checks.push(jsonLd.length > 0
    ? { id: 'structured-data', title: 'Yapılandırılmış Veri', description: `${jsonLd.length} adet JSON-LD bulundu.`, status: 'pass' }
    : { id: 'structured-data', title: 'Yapılandırılmış Veri', description: 'JSON-LD yapılandırılmış veri bulunamadı.', status: 'warning' })

  const charset = $('meta[charset]').attr('charset')?.trim() || $('meta[http-equiv="Content-Type"]').attr('content') || ''
  checks.push(charset ? { id: 'charset', title: 'Karakter Seti', description: 'Karakter seti tanımlı.', status: 'pass', value: charset } : { id: 'charset', title: 'Karakter Seti', description: 'Karakter seti meta etiketi bulunamadı.', status: 'warning' })

  // robots.txt
  try {
    const base = new URL(url)
    const res = await fetch(`${base.protocol}//${base.hostname}/robots.txt`, { signal: AbortSignal.timeout(5000), redirect: 'follow' })
    if (res.ok) {
      const txt = await res.text()
      checks.push({ id: 'robots-txt', title: 'robots.txt', description: `robots.txt mevcut.${txt.toLowerCase().includes('disallow') ? ' Disallow kuralları içeriyor.' : ''}`, status: 'pass' })
    } else {
      checks.push({ id: 'robots-txt', title: 'robots.txt', description: 'robots.txt bulunamadı.', status: 'warning' })
    }
  } catch { checks.push({ id: 'robots-txt', title: 'robots.txt', description: 'robots.txt erişilemedi.', status: 'warning' }) }

  // sitemap.xml
  try {
    const base = new URL(url)
    const res = await fetch(`${base.protocol}//${base.hostname}/sitemap.xml`, { signal: AbortSignal.timeout(5000), redirect: 'follow' })
    checks.push(res.ok
      ? { id: 'sitemap', title: 'sitemap.xml', description: 'sitemap.xml mevcut.', status: 'pass' }
      : { id: 'sitemap', title: 'sitemap.xml', description: 'sitemap.xml bulunamadı.', status: 'fail' })
  } catch { checks.push({ id: 'sitemap', title: 'sitemap.xml', description: 'sitemap.xml erişilemedi.', status: 'warning' }) }

  return { score: calcCategoryScore(checks), checks }
}

function analyzePerformance(html: string, responseTime: number): Category {
  const checks: Check[] = []
  if (responseTime < 1000) checks.push({ id: 'response-time', title: 'Sunucu Yanıt Süresi', description: `${responseTime}ms — iyi performans.`, status: 'pass', value: `${responseTime}ms` })
  else if (responseTime < 3000) checks.push({ id: 'response-time', title: 'Sunucu Yanıt Süresi', description: `${responseTime}ms — iyileştirilebilir.`, status: 'warning', value: `${responseTime}ms` })
  else checks.push({ id: 'response-time', title: 'Sunucu Yanıt Süresi', description: `${responseTime}ms — çok yavaş.`, status: 'fail', value: `${responseTime}ms` })

  const htmlSizeKB = Math.round(new TextEncoder().encode(html).length / 1024)
  if (htmlSizeKB < 100) checks.push({ id: 'html-size', title: 'HTML Boyutu', description: `${htmlSizeKB}KB — makul.`, status: 'pass', value: `${htmlSizeKB}KB` })
  else if (htmlSizeKB < 500) checks.push({ id: 'html-size', title: 'HTML Boyutu', description: `${htmlSizeKB}KB — biraz büyük.`, status: 'warning', value: `${htmlSizeKB}KB` })
  else checks.push({ id: 'html-size', title: 'HTML Boyutu', description: `${htmlSizeKB}KB — çok büyük.`, status: 'fail', value: `${htmlSizeKB}KB` })

  const inlineStyles = (html.match(/<style[\s\S]*?<\/style>/gi) || []).length
  checks.push(inlineStyles <= 2
    ? { id: 'inline-css', title: 'Inline CSS', description: `${inlineStyles} inline style bloğu.`, status: 'pass' }
    : { id: 'inline-css', title: 'Inline CSS', description: `${inlineStyles} inline style bloğu — harici CSS tercih edilmeli.`, status: 'warning' })

  const inlineScripts = (html.match(/<script(?![^>]*src)[\s\S]*?<\/script>/gi) || []).length
  checks.push(inlineScripts <= 3
    ? { id: 'inline-js', title: 'Inline JavaScript', description: `${inlineScripts} inline script.`, status: 'pass' }
    : { id: 'inline-js', title: 'Inline JavaScript', description: `${inlineScripts} inline script — harici JS tercih edilmeli.`, status: 'warning' })

  return { score: calcCategoryScore(checks), checks }
}

// ─── NEW: Keyword Analysis ───
function analyzeKeywords($: cheerio.CheerioAPI): { category: Category; topKeywords: KeywordInfo[] } {
  const checks: Check[] = []
  const title = $('title').first().text().trim().toLowerCase()
  const h1Text = $('h1').first().text().trim().toLowerCase()
  const metaDesc = ($('meta[name="description"]').attr('content') || '').toLowerCase()

  // Extract visible text
  $('script, style, noscript').remove()
  const bodyText = $('body').text().replace(/\s+/g, ' ').trim().toLowerCase()
  const words = bodyText.split(/[\s,.\-;:!?()[\]{}'"\/\\|@#$%^&*+=<>~`]+/).filter(w => w.length > 2 && !stopWords.has(w) && !/^\d+$/.test(w))

  const freq: Record<string, number> = {}
  for (const w of words) freq[w] = (freq[w] || 0) + 1

  const totalWords = words.length
  const topKeywords: KeywordInfo[] = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word, count]) => ({
      word,
      count,
      density: Math.round((count / totalWords) * 10000) / 100,
      inTitle: title.includes(word),
      inH1: h1Text.includes(word),
      inMetaDesc: metaDesc.includes(word),
    }))

  if (topKeywords.length > 0) {
    const top = topKeywords[0]
    if (top.inTitle && top.inH1 && top.inMetaDesc) {
      checks.push({ id: 'kw-consistency', title: 'Anahtar Kelime Tutarlılığı', description: `Ana anahtar kelime "${top.word}" title, H1 ve meta description'da mevcut.`, status: 'pass', value: top.word })
    } else if (top.inTitle || top.inH1) {
      checks.push({ id: 'kw-consistency', title: 'Anahtar Kelime Tutarlılığı', description: `"${top.word}" bazı yerlerde eksik. Title, H1 ve meta description'da tutarlı kullanın.`, status: 'warning', value: top.word })
    } else {
      checks.push({ id: 'kw-consistency', title: 'Anahtar Kelime Tutarlılığı', description: `En sık kelime "${top.word}" title veya H1'de yok. Ana anahtar kelimeyi stratejik yerlere ekleyin.`, status: 'fail', value: top.word })
    }

    if (top.density > 5) {
      checks.push({ id: 'kw-stuffing', title: 'Anahtar Kelime Yoğunluğu', description: `"${top.word}" yoğunluğu %${top.density} — keyword stuffing riski. %1-3 aralığı ideal.`, status: 'fail', value: `%${top.density}` })
    } else if (top.density > 3) {
      checks.push({ id: 'kw-density', title: 'Anahtar Kelime Yoğunluğu', description: `"${top.word}" yoğunluğu %${top.density} — biraz yüksek.`, status: 'warning', value: `%${top.density}` })
    } else {
      checks.push({ id: 'kw-density', title: 'Anahtar Kelime Yoğunluğu', description: `"${top.word}" yoğunluğu %${top.density} — iyi aralıkta.`, status: 'pass', value: `%${top.density}` })
    }
  }

  const keywordsInTitle = topKeywords.filter(k => k.inTitle).length
  checks.push(keywordsInTitle >= 2
    ? { id: 'kw-in-title', title: 'Title\'da Anahtar Kelime', description: `Title'da ${keywordsInTitle} önemli anahtar kelime var.`, status: 'pass' }
    : { id: 'kw-in-title', title: 'Title\'da Anahtar Kelime', description: `Title'da yeterli anahtar kelime yok.`, status: 'warning' })

  checks.push({ id: 'kw-count', title: 'Toplam Kelime', description: `Sayfada ${totalWords} kelime bulundu.`, status: totalWords > 300 ? 'pass' : 'warning', value: `${totalWords}` })

  return { category: { score: calcCategoryScore(checks), checks }, topKeywords }
}

// ─── NEW: Content Analysis ───
function analyzeContent($: cheerio.CheerioAPI, html: string): Category {
  const checks: Check[] = []

  $('script, style, noscript').remove()
  const bodyText = $('body').text().replace(/\s+/g, ' ').trim()
  const words = bodyText.split(/\s+/).filter(w => w.length > 0)
  const wordCount = words.length

  // Word count
  if (wordCount >= 1000) checks.push({ id: 'word-count', title: 'Kelime Sayısı', description: `${wordCount} kelime — kapsamlı içerik.`, status: 'pass', value: `${wordCount}` })
  else if (wordCount >= 300) checks.push({ id: 'word-count', title: 'Kelime Sayısı', description: `${wordCount} kelime — yeterli.`, status: 'pass', value: `${wordCount}` })
  else checks.push({ id: 'word-count', title: 'Kelime Sayısı', description: `${wordCount} kelime — thin content riski. 300+ kelime önerilir.`, status: 'fail', value: `${wordCount}` })

  // Paragraph count
  const paragraphs = $('p').filter((_, el) => $(el).text().trim().length > 20)
  checks.push(paragraphs.length >= 3
    ? { id: 'paragraphs', title: 'Paragraf Yapısı', description: `${paragraphs.length} paragraf bulundu — iyi yapılandırılmış.`, status: 'pass', value: `${paragraphs.length}` }
    : { id: 'paragraphs', title: 'Paragraf Yapısı', description: `${paragraphs.length} paragraf — daha fazla içerik paragrafı ekleyin.`, status: 'warning', value: `${paragraphs.length}` })

  // Readability (basic: average sentence length)
  const sentences = bodyText.split(/[.!?]+/).filter(s => s.trim().split(/\s+/).length > 3)
  if (sentences.length > 0) {
    const avgSentenceLen = Math.round(words.length / sentences.length)
    if (avgSentenceLen <= 20) checks.push({ id: 'readability', title: 'Okunabilirlik', description: `Ortalama cümle uzunluğu ${avgSentenceLen} kelime — okunması kolay.`, status: 'pass', value: `${avgSentenceLen} kelime/cümle` })
    else if (avgSentenceLen <= 30) checks.push({ id: 'readability', title: 'Okunabilirlik', description: `Ortalama cümle uzunluğu ${avgSentenceLen} kelime — biraz uzun.`, status: 'warning', value: `${avgSentenceLen} kelime/cümle` })
    else checks.push({ id: 'readability', title: 'Okunabilirlik', description: `Ortalama cümle uzunluğu ${avgSentenceLen} kelime — çok uzun. Kısa cümleler kullanın.`, status: 'fail', value: `${avgSentenceLen} kelime/cümle` })
  }

  // Text to HTML ratio
  const htmlSize = html.length
  const textSize = bodyText.length
  const ratio = Math.round((textSize / htmlSize) * 100)
  if (ratio >= 25) checks.push({ id: 'text-ratio', title: 'Metin/HTML Oranı', description: `%${ratio} — iyi oran.`, status: 'pass', value: `%${ratio}` })
  else if (ratio >= 10) checks.push({ id: 'text-ratio', title: 'Metin/HTML Oranı', description: `%${ratio} — düşük. Daha fazla metin içerik ekleyin.`, status: 'warning', value: `%${ratio}` })
  else checks.push({ id: 'text-ratio', title: 'Metin/HTML Oranı', description: `%${ratio} — çok düşük. Sayfa kodla dolu, metin az.`, status: 'fail', value: `%${ratio}` })

  return { score: calcCategoryScore(checks), checks }
}

// ─── NEW: Security Headers ───
function analyzeSecurityHeaders(headers: Headers): Category {
  const checks: Check[] = []

  const secHeaders: { key: string; title: string; desc: string }[] = [
    { key: 'strict-transport-security', title: 'HSTS', desc: 'HTTP Strict Transport Security — HTTPS zorunlu kılınıyor.' },
    { key: 'x-content-type-options', title: 'X-Content-Type-Options', desc: 'MIME type sniffing koruması.' },
    { key: 'x-frame-options', title: 'X-Frame-Options', desc: 'Clickjacking koruması.' },
    { key: 'x-xss-protection', title: 'X-XSS-Protection', desc: 'XSS filtre koruması.' },
    { key: 'content-security-policy', title: 'Content-Security-Policy', desc: 'İçerik güvenlik politikası tanımlı.' },
    { key: 'referrer-policy', title: 'Referrer-Policy', desc: 'Referrer bilgisi kontrol ediliyor.' },
    { key: 'permissions-policy', title: 'Permissions-Policy', desc: 'Tarayıcı özellik izinleri kontrol ediliyor.' },
  ]

  for (const h of secHeaders) {
    const val = headers.get(h.key)
    if (val) {
      checks.push({ id: h.key, title: h.title, description: `${h.desc}`, status: 'pass', value: val.substring(0, 80) })
    } else {
      checks.push({ id: h.key, title: h.title, description: `${h.title} başlığı eksik. Güvenlik için eklenmeli.`, status: h.key === 'content-security-policy' || h.key === 'permissions-policy' ? 'warning' : 'fail' })
    }
  }

  return { score: calcCategoryScore(checks), checks }
}

// ─── NEW: Schema Markup Detail ───
function analyzeSchemaDetail($: cheerio.CheerioAPI): Category {
  const checks: Check[] = []
  const scripts = $('script[type="application/ld+json"]')

  if (scripts.length === 0) {
    checks.push({ id: 'no-schema', title: 'Schema.org', description: 'JSON-LD yapılandırılmış veri bulunamadı. Arama sonuçlarında zengin sonuçlar için Schema.org ekleyin.', status: 'fail' })
    return { score: 0, checks }
  }

  const types: string[] = []
  scripts.each((_, el) => {
    try {
      const data = JSON.parse($(el).html() || '{}')
      const extractType = (obj: Record<string, unknown>) => {
        if (obj['@type']) {
          const t = Array.isArray(obj['@type']) ? obj['@type'].join(', ') : String(obj['@type'])
          types.push(t)
        }
        if (obj['@graph'] && Array.isArray(obj['@graph'])) {
          for (const item of obj['@graph']) extractType(item as Record<string, unknown>)
        }
      }
      extractType(data)
    } catch { /* invalid JSON-LD */ }
  })

  if (types.length > 0) {
    checks.push({ id: 'schema-types', title: 'Schema Tipleri', description: `Bulunan tipler: ${types.join(', ')}`, status: 'pass', value: types.join(', ') })

    const recommended = ['Organization', 'WebSite', 'WebPage', 'BreadcrumbList', 'Article', 'Product', 'LocalBusiness', 'FAQPage']
    const found = recommended.filter(r => types.some(t => t.includes(r)))
    const missing = recommended.filter(r => !types.some(t => t.includes(r))).slice(0, 3)

    if (found.length > 0) checks.push({ id: 'schema-common', title: 'Yaygın Schema Tipleri', description: `${found.join(', ')} mevcut.`, status: 'pass' })
    if (missing.length > 0) checks.push({ id: 'schema-missing', title: 'Önerilen Schema Tipleri', description: `Şunlar da eklenebilir: ${missing.join(', ')}`, status: 'warning' })
  } else {
    checks.push({ id: 'schema-parse', title: 'Schema Ayrıştırma', description: 'JSON-LD bulundu ama @type ayrıştırılamadı.', status: 'warning' })
  }

  checks.push({ id: 'schema-count', title: 'JSON-LD Blokları', description: `${scripts.length} adet JSON-LD bloğu bulundu.`, status: 'pass', value: `${scripts.length}` })

  return { score: calcCategoryScore(checks), checks }
}

// ─── NEW: Hreflang Analysis ───
function analyzeHreflang($: cheerio.CheerioAPI): Category {
  const checks: Check[] = []
  const hreflangs = $('link[rel="alternate"][hreflang]')

  if (hreflangs.length === 0) {
    checks.push({ id: 'no-hreflang', title: 'Hreflang Etiketleri', description: 'Hreflang etiketi bulunamadı. Tek dilli site ise sorun yok, çok dilli site ise eklenmeli.', status: 'warning' })
    return { score: 50, checks }
  }

  const langs: string[] = []
  let hasXDefault = false
  hreflangs.each((_, el) => {
    const lang = $(el).attr('hreflang') || ''
    if (lang === 'x-default') hasXDefault = true
    else langs.push(lang)
  })

  checks.push({ id: 'hreflang-count', title: 'Hreflang Dilleri', description: `${langs.length} dil tanımlı: ${langs.join(', ')}`, status: 'pass', value: langs.join(', ') })
  checks.push(hasXDefault
    ? { id: 'hreflang-xdefault', title: 'x-default', description: 'x-default hreflang tanımlı.', status: 'pass' }
    : { id: 'hreflang-xdefault', title: 'x-default', description: 'x-default hreflang eksik. Varsayılan dil sayfasını belirtmek için ekleyin.', status: 'warning' })

  return { score: calcCategoryScore(checks), checks }
}

// ─── NEW: Redirect Chain Detection ───
async function detectRedirects(url: string): Promise<RedirectHop[]> {
  const hops: RedirectHop[] = []
  let currentUrl = url
  const maxHops = 10

  for (let i = 0; i < maxHops; i++) {
    try {
      const res = await fetch(currentUrl, {
        redirect: 'manual',
        signal: AbortSignal.timeout(5000),
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; YoAI SEO Analyzer/1.0)' },
      })
      hops.push({ url: currentUrl, status: res.status })
      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get('location')
        if (!location) break
        currentUrl = new URL(location, currentUrl).href
      } else {
        break
      }
    } catch { break }
  }

  return hops
}

// ─── NEW: Broken Link Checker (limited to first 15 external links) ───
async function checkBrokenLinks($: cheerio.CheerioAPI, baseUrl: string): Promise<BrokenLink[]> {
  const broken: BrokenLink[] = []
  let baseHost = ''
  try { baseHost = new URL(baseUrl).hostname } catch { return broken }

  const externalLinks: { href: string; anchor: string }[] = []
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href')?.trim() || ''
    if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) return
    try {
      const linkUrl = new URL(href, baseUrl)
      if (linkUrl.hostname !== baseHost && linkUrl.protocol.startsWith('http')) {
        externalLinks.push({ href: linkUrl.href, anchor: $(el).text().trim().substring(0, 50) || linkUrl.href })
      }
    } catch { /* skip */ }
  })

  const toCheck = externalLinks.slice(0, 15)
  const results = await Promise.allSettled(
    toCheck.map(async (link) => {
      const res = await fetch(link.href, {
        method: 'HEAD',
        signal: AbortSignal.timeout(5000),
        redirect: 'follow',
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; YoAI SEO Analyzer/1.0)' },
      })
      if (res.status >= 400) {
        broken.push({ url: link.href, status: res.status, anchor: link.anchor })
      }
    })
  )

  // Count timeouts/errors
  for (let i = 0; i < results.length; i++) {
    if (results[i].status === 'rejected') {
      broken.push({ url: toCheck[i].href, status: 'timeout', anchor: toCheck[i].anchor })
    }
  }

  return broken
}

// ─── Lighthouse (Mobile + Desktop) ───
async function fetchLighthouse(url: string, strategy: 'mobile' | 'desktop'): Promise<LighthouseResult | null> {
  const apiKey = process.env.GOOGLE_PAGESPEED_API_KEY
  if (!apiKey) return null

  try {
    const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&key=${apiKey}&category=PERFORMANCE&category=ACCESSIBILITY&category=BEST_PRACTICES&category=SEO&strategy=${strategy.toUpperCase()}`
    const res = await fetch(apiUrl, { signal: AbortSignal.timeout(60000) })
    if (!res.ok) return null

    const data = await res.json()
    const categories = data.lighthouseResult?.categories || {}
    const audits = data.lighthouseResult?.audits || {}
    const getMetricValue = (id: string) => audits[id]?.displayValue || 'N/A'

    const relevantAudits: LighthouseAudit[] = []
    const auditIds = [
      'first-contentful-paint', 'largest-contentful-paint', 'total-blocking-time',
      'cumulative-layout-shift', 'speed-index', 'interactive',
      'render-blocking-resources', 'unused-css-rules', 'unused-javascript',
      'modern-image-formats', 'uses-optimized-images', 'uses-text-compression',
      'uses-responsive-images', 'dom-size', 'redirects',
      'meta-description', 'document-title', 'http-status-code',
      'link-text', 'is-crawlable', 'robots-txt', 'hreflang',
      'image-alt', 'color-contrast', 'tap-targets',
    ]
    for (const id of auditIds) {
      const audit = audits[id]
      if (audit && audit.score !== undefined) {
        relevantAudits.push({ id, title: audit.title || id, description: audit.description || '', score: audit.score, displayValue: audit.displayValue })
      }
    }

    return {
      performance: Math.round((categories.performance?.score || 0) * 100),
      accessibility: Math.round((categories.accessibility?.score || 0) * 100),
      bestPractices: Math.round((categories['best-practices']?.score || 0) * 100),
      seo: Math.round((categories.seo?.score || 0) * 100),
      coreWebVitals: {
        fcp: getMetricValue('first-contentful-paint'),
        lcp: getMetricValue('largest-contentful-paint'),
        tbt: getMetricValue('total-blocking-time'),
        cls: getMetricValue('cumulative-layout-shift'),
        si: getMetricValue('speed-index'),
      },
      audits: relevantAudits,
    }
  } catch { return null }
}

// ─── AI-powered Recommendations with Code Snippets ───
interface Recommendation {
  id: string
  text: string
  code?: string
  language?: 'html' | 'json' | 'xml' | 'text'
  guide?: string
}

function generateRecommendations(
  categories: Record<string, Category>,
  topKeywords: KeywordInfo[],
  url: string,
  title: string,
  metaDesc: string,
): Recommendation[] {
  const recs: Recommendation[] = []
  const seen = new Set<string>()
  const topKw = topKeywords[0]?.word || ''
  let hostname = ''
  try { hostname = new URL(url).hostname } catch { /* */ }

  for (const [, cat] of Object.entries(categories)) {
    for (const check of cat.checks) {
      if (check.status === 'fail') {
        if (seen.has(check.id)) continue
        seen.add(check.id)

        switch (check.id) {
          case 'title-exists':
            recs.push({
              id: 'title-exists',
              text: 'Her sayfaya benzersiz, 30-60 karakter arası bir <title> etiketi ekleyin. Ana anahtar kelimenizi başa yakın yerleştirin.',
              guide: '📍 Nereye: HTML dosyanızın <head> bölümüne ekleyin.\n\n🔧 Nasıl:\n• WordPress: Yoast SEO veya Rank Math eklentisi → Sayfa düzenle → "SEO Başlığı" alanına yazın\n• Wix: Sayfalar → SEO Ayarları → Başlık alanı\n• Shopify: Online Mağaza → Sayfalar → SEO düzenle\n• HTML: <head> etiketi içine aşağıdaki kodu yapıştırın',
              code: `<title>${topKw ? `${topKw.charAt(0).toUpperCase() + topKw.slice(1)} - ` : ''}${hostname} | Ana Sayfa</title>`,
              language: 'html',
            })
            break
          case 'meta-desc-exists':
            recs.push({
              id: 'meta-desc',
              text: '120-160 karakter arası açıklayıcı bir meta description yazın. Kullanıcıyı tıklamaya teşvik eden bir CTA ekleyin.',
              guide: '📍 Nereye: HTML dosyanızın <head> bölümüne ekleyin.\n\n🔧 Nasıl:\n• WordPress: Yoast SEO → Sayfa düzenle → "Meta Açıklama" alanı\n• Wix: Sayfalar → SEO Ayarları → Açıklama alanı\n• Shopify: Online Mağaza → Sayfalar → SEO açıklama\n• HTML: <head> etiketi içine aşağıdaki kodu yapıştırın',
              code: `<meta name="description" content="${hostname} - ${topKw ? `${topKw} hakkında ` : ''}en güncel bilgiler ve hizmetler. Hemen keşfedin!">`,
              language: 'html',
            })
            break
          case 'viewport':
            recs.push({
              id: 'viewport',
              text: 'Mobil uyumluluk için viewport meta etiketi ekleyin.',
              guide: '📍 Nereye: HTML dosyanızın <head> bölümünün en üstüne ekleyin.\n\n🔧 Nasıl:\n• WordPress/Wix/Shopify: Bu etiket genellikle tema tarafından otomatik eklenir. Temanızı güncelleyin veya değiştirin.\n• HTML: <head> etiketinin hemen altına yapıştırın. Bu olmadan siteniz mobilde düzgün görünmez.',
              code: '<meta name="viewport" content="width=device-width, initial-scale=1">',
              language: 'html',
            })
            break
          case 'h1-exists':
            recs.push({
              id: 'h1-exists',
              text: 'Her sayfada tek bir H1 etiketi kullanın. Ana anahtar kelimenizi H1 içinde kullanın.',
              guide: '📍 Nereye: Sayfa içeriğinin en üstündeki ana başlık.\n\n🔧 Nasıl:\n• WordPress: Sayfa düzenleyicide en üstteki başlığı "Başlık 1" (H1) olarak ayarlayın\n• Wix: Metin ekle → ilk başlığı "Heading 1" olarak seçin\n• Shopify: Sayfa başlığı otomatik H1 olur\n• HTML: Sayfa içeriğinin başına aşağıdaki kodu ekleyin. Sayfada sadece 1 tane H1 olmalıdır.',
              code: `<h1>${topKw ? topKw.charAt(0).toUpperCase() + topKw.slice(1) : 'Ana Başlık'} - ${hostname}</h1>`,
              language: 'html',
            })
            break
          case 'alt-missing':
            recs.push({
              id: 'alt-missing',
              text: 'Tüm görsellere açıklayıcı alt etiketleri ekleyin. Bu hem erişilebilirlik hem SEO için kritiktir.',
              guide: '📍 Nereye: Sitenizdeki her <img> etiketine.\n\n🔧 Nasıl:\n• WordPress: Medya Kitaplığı → Görsele tıkla → "Alt Metin" alanını doldur\n• Wix: Görsele tıkla → Ayarlar → "Alt metin nedir?" alanı\n• Shopify: Ürünler/Sayfalar → Görsele tıkla → Alt metin ekle\n• HTML: Her img etiketine alt="açıklama" ekleyin. Görselin ne olduğunu kısaca anlatan bir metin yazın.',
              code: '<!-- Her img etiketine açıklayıcı alt ekleyin -->\n<img src="gorsel.jpg" alt="Görseli açıklayan kısa metin" width="800" height="600" loading="lazy">',
              language: 'html',
            })
            break
          case 'og-title':
          case 'og-desc':
          case 'og-image':
            if (!seen.has('og-all')) {
              seen.add('og-all')
              recs.push({
                id: 'og-tags',
                text: 'Open Graph etiketlerini ekleyerek sosyal medya paylaşımlarını iyileştirin.',
                guide: '📍 Nereye: HTML dosyanızın <head> bölümüne ekleyin.\n\n🔧 Nasıl:\n• WordPress: Yoast SEO → Sosyal sekmesi → Facebook/Twitter alanlarını doldurun. Otomatik OG etiketleri ekler.\n• Wix: SEO Ayarları → Sosyal Paylaşım bölümü\n• Shopify: Tema ayarları → Sosyal medya bölümü\n• HTML: <head> bölümüne aşağıdaki tüm meta etiketlerini yapıştırın. og:image için 1200x630px boyutunda bir görsel hazırlayın.',
                code: `<!-- Open Graph Meta Tags -->\n<meta property="og:type" content="website">\n<meta property="og:url" content="${url}">\n<meta property="og:title" content="${title || hostname}">\n<meta property="og:description" content="${metaDesc || `${hostname} - Resmi web sitesi`}">\n<meta property="og:image" content="${url}og-image.jpg">\n<meta property="og:locale" content="tr_TR">\n\n<!-- Twitter Card -->\n<meta name="twitter:card" content="summary_large_image">\n<meta name="twitter:title" content="${title || hostname}">\n<meta name="twitter:description" content="${metaDesc || `${hostname} - Resmi web sitesi`}">\n<meta name="twitter:image" content="${url}og-image.jpg">`,
                language: 'html',
              })
            }
            break
          case 'https':
            recs.push({
              id: 'https',
              text: 'HTTPS\'e geçiş yapın. SSL sertifikası hem güvenlik hem SEO ranking faktörüdür.',
              guide: '📍 Nereye: Web sunucunuzun yapılandırma dosyasına.\n\n🔧 Nasıl:\n• WordPress: Hosting panelinizden "SSL Sertifikası" etkinleştirin → Really Simple SSL eklentisini kurun\n• Wix/Shopify: Otomatik HTTPS sağlar, ayarlardan kontrol edin\n• Hosting Paneli: cPanel → SSL/TLS → Let\'s Encrypt ücretsiz SSL etkinleştirin\n• Sunucu: Aşağıdaki yönlendirme kodunu sunucu yapılandırmanıza ekleyin',
              code: `# Nginx HTTPS yönlendirme\nserver {\n    listen 80;\n    server_name ${hostname};\n    return 301 https://$server_name$request_uri;\n}\n\n# Apache .htaccess\nRewriteEngine On\nRewriteCond %{HTTPS} off\nRewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]`,
              language: 'text',
            })
            break
          case 'lang':
            recs.push({
              id: 'lang',
              text: 'HTML etiketine lang özelliği ekleyin.',
              guide: '📍 Nereye: HTML dosyanızın en başındaki <html> etiketine.\n\n🔧 Nasıl:\n• WordPress: Ayarlar → Genel → Site Dili Türkçe yapın (otomatik eklenir)\n• Wix: Otomatik eklenir, dil ayarlarını kontrol edin\n• HTML: Dosyanızın en başındaki <html> etiketini aşağıdaki gibi değiştirin',
              code: '<html lang="tr">',
              language: 'html',
            })
            break
          case 'sitemap':
            recs.push({
              id: 'sitemap',
              text: 'Sitemap.xml oluşturup root dizine ekleyin ve Google Search Console\'a gönderin.',
              guide: `📍 Nereye: ${url}sitemap.xml adresinde erişilebilir olmalı.\n\n🔧 Nasıl:\n• WordPress: Yoast SEO otomatik oluşturur → ${hostname}/sitemap_index.xml adresinden kontrol edin\n• Wix: Otomatik oluşturur → ${hostname}/sitemap.xml\n• Shopify: Otomatik oluşturur → ${hostname}/sitemap.xml\n• HTML: Aşağıdaki XML dosyasını sitemap.xml olarak kaydedin ve sitenizin ana dizinine yükleyin\n\n📤 Son Adım: Google Search Console → Sitemap\'ler → URL\'yi girin → Gönder`,
              code: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>${url}</loc>\n    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>1.0</priority>\n  </url>\n  <url>\n    <loc>${url}hakkimizda</loc>\n    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.8</priority>\n  </url>\n</urlset>`,
              language: 'xml',
            })
            break
          case 'no-schema':
            recs.push({
              id: 'schema',
              text: 'Schema.org yapılandırılmış veri (JSON-LD) ekleyerek zengin arama sonuçları elde edin.',
              guide: '📍 Nereye: HTML dosyanızın <head> bölümüne veya </body> etiketinden hemen önce.\n\n🔧 Nasıl:\n• WordPress: Rank Math → Yapılandırılmış Veri ayarları veya "Insert Headers and Footers" eklentisi ile ekleyin\n• Wix: Ayarlar → Özel Kod → Head bölümüne yapıştırın\n• Shopify: Tema → Düzenle → theme.liquid → </head> öncesine yapıştırın\n• HTML: Aşağıdaki <script> bloğunu <head> içine yapıştırın\n\n✅ Doğrulama: Google Rich Results Test aracıyla test edin',
              code: `<script type="application/ld+json">\n${JSON.stringify({
                '@context': 'https://schema.org',
                '@type': 'WebSite',
                name: title || hostname,
                url: url,
                description: metaDesc || `${hostname} resmi web sitesi`,
                potentialAction: {
                  '@type': 'SearchAction',
                  target: `${url}search?q={search_term_string}`,
                  'query-input': 'required name=search_term_string',
                },
              }, null, 2)}\n</script>`,
              language: 'html',
            })
            break
          case 'word-count':
            recs.push({
              id: 'word-count',
              text: 'Sayfa içeriğini zenginleştirin. SEO için en az 300 kelime, ideal olarak 1000+ kelime hedefleyin.',
              guide: '📍 Nereye: Sayfanızın ana içerik bölümüne.\n\n🔧 Nasıl:\n• Sayfanın konusuyla ilgili özgün, bilgilendirici paragraflar ekleyin\n• Sık sorulan sorular (SSS) bölümü ekleyin\n• Konu hakkında detaylı açıklamalar, listeler ve alt başlıklar (H2, H3) kullanın\n• Anahtar kelimelerinizi doğal bir şekilde metin içinde kullanın\n• Kopyala-yapıştır içerik kullanmayın, Google bunu tespit eder',
            })
            break
          case 'response-time':
            recs.push({
              id: 'response-time',
              text: 'Sunucu yanıt süresini iyileştirin. CDN kullanın, veritabanı sorgularını optimize edin, caching ekleyin.',
              guide: '📍 Nereye: Web sunucunuzun yapılandırma dosyasına.\n\n🔧 Nasıl:\n• WordPress: WP Rocket veya W3 Total Cache eklentisi kurun → Tarayıcı önbelleği etkinleştirin\n• Cloudflare: Ücretsiz CDN planına kaydolun → DNS ayarlarınızı yönlendirin (en kolay yöntem)\n• Hosting: Daha hızlı bir hosting planına geçin (SSD/VPS önerilir)\n• Görseller: Görselleri WebP formatına çevirin, boyutlarını küçültün\n• Sunucu: Aşağıdaki caching kurallarını sunucu yapılandırmanıza ekleyin',
              code: `# Nginx caching örneği\nlocation ~* \\.(css|js|jpg|jpeg|png|gif|ico|svg|woff2)$ {\n    expires 1y;\n    add_header Cache-Control "public, immutable";\n}\n\n# HTML için kısa cache\nlocation ~* \\.html$ {\n    expires 1h;\n    add_header Cache-Control "public, must-revalidate";\n}`,
              language: 'text',
            })
            break
          case 'kw-consistency': {
            if (topKw) {
              recs.push({
                id: 'kw-consistency',
                text: `Ana anahtar kelime "${topKw}" title, H1 ve meta description'da tutarlı şekilde kullanılmalı.`,
                guide: `📍 Nereye: Sayfanızın 3 kritik noktasına: Title, H1 başlık ve Meta Description.\n\n🔧 Nasıl:\n• Title: "${topKw}" kelimesini sayfa başlığının başına ekleyin\n• H1: Sayfanın ana başlığında "${topKw}" kelimesini kullanın\n• Meta Description: Açıklama metninde "${topKw}" kelimesini doğal şekilde geçirin\n• WordPress: Yoast SEO → Anahtar kelime alanına "${topKw}" yazın, yönlendirmeleri takip edin`,
                code: `<!-- "${topKw}" anahtar kelimesini stratejik yerlere ekleyin -->\n<title>${topKw.charAt(0).toUpperCase() + topKw.slice(1)} - ${hostname}</title>\n<meta name="description" content="${topKw.charAt(0).toUpperCase() + topKw.slice(1)} hakkında detaylı bilgi. ${hostname} ile hemen keşfedin.">\n<h1>${topKw.charAt(0).toUpperCase() + topKw.slice(1)}</h1>`,
                language: 'html',
              })
            }
            break
          }
        }
      }
    }
  }

  return recs.slice(0, 10)
}

// ─── MAIN HANDLER ───
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const rawUrl = body.url
    if (!rawUrl || typeof rawUrl !== 'string') {
      return NextResponse.json({ error: 'URL gereklidir.' }, { status: 400 })
    }

    const url = normalizeUrl(rawUrl)
    try { new URL(url) } catch {
      return NextResponse.json({ error: 'Geçersiz URL formatı.' }, { status: 400 })
    }

    const startTime = Date.now()

    // Fetch HTML, Lighthouse (mobile+desktop), and redirect chain in parallel
    const [htmlResult, lighthouseMobileResult, lighthouseDesktopResult, redirectChain] = await Promise.allSettled([
      fetch(url, {
        signal: AbortSignal.timeout(15000),
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; YoAI SEO Analyzer/1.0)',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'tr,en;q=0.9',
        },
      }),
      fetchLighthouse(url, 'mobile'),
      fetchLighthouse(url, 'desktop'),
      detectRedirects(url),
    ])

    if (htmlResult.status === 'rejected') {
      return NextResponse.json({ error: 'Web sitesine erişilemedi. URL\'yi kontrol edip tekrar deneyin.' }, { status: 502 })
    }

    const htmlResponse = htmlResult.value
    if (!htmlResponse.ok) {
      return NextResponse.json({ error: `Web sitesi ${htmlResponse.status} hatası döndü.` }, { status: 502 })
    }

    const responseHeaders = htmlResponse.headers
    const html = await htmlResponse.text()
    const responseTime = Date.now() - startTime
    const $ = cheerio.load(html)

    // Run all analyses in parallel
    const [metaTags, headings, images, links, social, technical, performance] = await Promise.all([
      analyzeMetaTags($),
      analyzeHeadings($),
      analyzeImages($),
      analyzeLinks($, url),
      analyzeSocial($),
      analyzeTechnical($, url),
      analyzePerformance(html, responseTime),
    ])

    // New analyses (these need a fresh $ since analyzeKeywords/Content removes script/style)
    const $kw = cheerio.load(html)
    const { category: keywords, topKeywords } = analyzeKeywords($kw)
    const $content = cheerio.load(html)
    const content = analyzeContent($content, html)
    const security = analyzeSecurityHeaders(responseHeaders)
    const schemaDetail = analyzeSchemaDetail($)
    const hreflang = analyzeHreflang($)

    // Broken links (run after other analyses)
    const $links = cheerio.load(html)
    const brokenLinks = await checkBrokenLinks($links, url)

    const categories = { metaTags, headings, images, links, social, technical, performance, keywords, content, security, schemaDetail, hreflang }

    // Calculate overall score
    const categoryScores = Object.values(categories).map(c => c.score)
    const htmlOverallScore = Math.round(categoryScores.reduce((a, b) => a + b, 0) / categoryScores.length)

    const lighthouseMobile = lighthouseMobileResult.status === 'fulfilled' ? lighthouseMobileResult.value : null
    const lighthouseDesktop = lighthouseDesktopResult.status === 'fulfilled' ? lighthouseDesktopResult.value : null

    let overallScore = htmlOverallScore
    if (lighthouseMobile) {
      overallScore = Math.round((htmlOverallScore * 0.5) + (lighthouseMobile.seo * 0.3) + (lighthouseMobile.performance * 0.2))
    }

    // Redirect chain
    const redirects = redirectChain.status === 'fulfilled' ? redirectChain.value : []

    // AI recommendations (use original $ for title/desc extraction)
    const pageTitle = $('title').first().text().trim()
    const pageMetaDesc = $('meta[name="description"]').attr('content')?.trim() || ''
    const recommendations = generateRecommendations(categories, topKeywords, url, pageTitle, pageMetaDesc)

    return NextResponse.json({
      url,
      analyzedAt: new Date().toISOString(),
      overallScore,
      lighthouse: lighthouseMobile,
      lighthouseDesktop,
      categories,
      topKeywords,
      brokenLinks,
      redirectChain: redirects,
      recommendations,
    })
  } catch (error) {
    console.error('SEO analysis error:', error)
    return NextResponse.json({ error: 'Analiz sırasında bir hata oluştu.' }, { status: 500 })
  }
}
