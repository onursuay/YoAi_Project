import type { CheerioAPI } from 'cheerio'

export interface Check {
  id: string
  title: string
  description: string
  status: 'pass' | 'fail' | 'warning'
  value?: string
}

export interface Category {
  score: number
  checks: Check[]
}

export interface GeoAeoResult {
  score: number
  categories: {
    schema: Category
    contentFormat: Category
    eeat: Category
    aiReadability: Category
    citability: Category
  }
}

function calcCategoryScore(checks: Check[]): number {
  if (checks.length === 0) return 0
  const passed = checks.filter(c => c.status === 'pass').length
  const warned = checks.filter(c => c.status === 'warning').length
  return Math.round(((passed + warned * 0.5) / checks.length) * 100)
}

// ─── 1. SCHEMA — JSON-LD structured data (weight 25%) ───
function analyzeSchema($: CheerioAPI): Category {
  const checks: Check[] = []

  const scripts = $('script[type="application/ld+json"]')

  // json-ld-exists
  if (scripts.length === 0) {
    checks.push({
      id: 'json-ld-exists',
      title: 'JSON-LD Yapılandırılmış Veri',
      description: 'Sayfada JSON-LD yapılandırılmış veri bulunamadı. GEO/AEO sinyalleri için gereklidir.',
      status: 'fail',
    })
    return { score: 0, checks }
  }

  checks.push({
    id: 'json-ld-exists',
    title: 'JSON-LD Yapılandırılmış Veri',
    description: `${scripts.length} adet JSON-LD bloğu bulundu.`,
    status: 'pass',
    value: `${scripts.length} blok`,
  })

  // Parse all schema objects
  const allSchemas: Record<string, unknown>[] = []
  scripts.each((_, el) => {
    try {
      const raw = $(el).html() || '{}'
      const parsed = JSON.parse(raw) as Record<string, unknown>
      const flattenGraph = (obj: Record<string, unknown>, depth = 0) => {
        if (depth > 10) return
        allSchemas.push(obj)
        if (Array.isArray(obj['@graph'])) {
          for (const item of obj['@graph']) {
            flattenGraph(item as Record<string, unknown>, depth + 1)
          }
        }
      }
      flattenGraph(parsed)
    } catch {
      // invalid JSON-LD — skip
    }
  })

  // schema-type
  const highValueTypes = ['Article', 'BlogPosting', 'FAQPage', 'LocalBusiness', 'Product']
  const genericTypes = ['WebSite', 'WebPage']
  const foundTypes = allSchemas.flatMap(s => {
    const t = s['@type']
    if (!t) return []
    return Array.isArray(t) ? (t as string[]) : [String(t)]
  })

  if (foundTypes.length === 0) {
    checks.push({
      id: 'schema-type',
      title: 'Schema Tipi',
      description: 'Hiçbir schema @type ayrıştırılamadı. Geçerli bir @type ekleyin.',
      status: 'warning',
    })
  } else {
    const hasHighValue = foundTypes.some(t => highValueTypes.some(h => t.includes(h)))
    const hasOnlyGeneric = !hasHighValue && foundTypes.every(t => genericTypes.some(g => t.includes(g)))
    checks.push({
      id: 'schema-type',
      title: 'Schema Tipi',
      description: hasHighValue
        ? `Güçlü schema tipleri bulundu: ${foundTypes.join(', ')}.`
        : hasOnlyGeneric
          ? `Yalnızca genel tipler mevcut: ${foundTypes.join(', ')}. Article, FAQPage veya Product gibi zengin tipler ekleyin.`
          : `Schema tipleri: ${foundTypes.join(', ')}.`,
      status: hasHighValue ? 'pass' : 'warning',
      value: foundTypes.join(', '),
    })
  }

  // schema-author
  const hasAuthor = allSchemas.some(s => {
    const a = s['author']
    if (!a) return false
    if (typeof a === 'string') return a.trim().length > 0
    if (typeof a === 'object' && a !== null) {
      const name = (a as Record<string, unknown>)['name']
      return typeof name === 'string' && name.trim().length > 0
    }
    return false
  })
  checks.push({
    id: 'schema-author',
    title: 'Schema Yazar Bilgisi',
    description: hasAuthor
      ? 'Schema içinde yazar bilgisi mevcut. E-E-A-T sinyali olarak güçlü.'
      : 'Herhangi bir schema\'da "author" alanı bulunamadı. Otoriteli içerik için yazar ekleyin.',
    status: hasAuthor ? 'pass' : 'warning',
  })

  // schema-date
  const hasDatePublished = allSchemas.some(s => {
    const d = s['datePublished']
    return typeof d === 'string' && d.trim().length > 0
  })
  checks.push({
    id: 'schema-date',
    title: 'Schema Yayın Tarihi',
    description: hasDatePublished
      ? 'Schema içinde "datePublished" alanı mevcut. İçerik tazeliği sinyali için iyi.'
      : '"datePublished" alanı bulunamadı. İçeriğin güncelliğini AI motorlarına bildirmek için ekleyin.',
    status: hasDatePublished ? 'pass' : 'warning',
  })

  return { score: calcCategoryScore(checks), checks }
}

// ─── 2. CONTENT FORMAT — Structure AI engines prefer (weight 20%) ───
function analyzeContentFormat($: CheerioAPI): Category {
  const checks: Check[] = []

  // has-lists
  let listItemCount = 0
  $('ul, ol').each((_, el) => {
    listItemCount += $(el).children('li').length
  })
  const hasMeaningfulLists = listItemCount >= 2
  checks.push({
    id: 'has-lists',
    title: 'Liste Yapısı',
    description: hasMeaningfulLists
      ? `Sayfada ${listItemCount} liste öğesi bulundu. Yapılandırılmış listeler AI tarafından kolayca ayrıştırılır.`
      : 'Yeterli liste öğesi (ul/ol) bulunamadı. Madde listesi yapısı AI okunabilirliğini artırır.',
    status: hasMeaningfulLists ? 'pass' : 'warning',
    value: `${listItemCount} öğe`,
  })

  // has-headings-structure
  const h2Count = $('h2').length
  const h3Count = $('h3').length
  const subHeadingCount = h2Count + h3Count
  checks.push({
    id: 'has-headings-structure',
    title: 'Alt Başlık Yapısı (H2/H3)',
    description: subHeadingCount >= 2
      ? `${subHeadingCount} adet H2/H3 başlığı bulundu. AI içerik bölümlerini net ayırt edebilir.`
      : `Yalnızca ${subHeadingCount} adet H2/H3 başlığı var. En az 2 alt başlık ile içeriği bölümleyin.`,
    status: subHeadingCount >= 2 ? 'pass' : 'warning',
    value: `H2: ${h2Count}, H3: ${h3Count}`,
  })

  // has-tables-or-definitions
  const tableCount = $('table').length
  const dlCount = $('dl').length
  const hasTablesOrDefs = tableCount > 0 || dlCount > 0
  checks.push({
    id: 'has-tables-or-definitions',
    title: 'Tablo veya Tanım Listesi',
    description: hasTablesOrDefs
      ? `Tablo veya tanım listesi (dl) bulundu (tablo: ${tableCount}, dl: ${dlCount}). Karşılaştırmalı içerik AI atıfını artırır.`
      : 'Tablo veya tanım listesi (dl) bulunamadı. Veriler varsa tablo formatı kullanmak AI atıfını artırır.',
    status: hasTablesOrDefs ? 'pass' : 'warning',
    value: hasTablesOrDefs ? `Tablo: ${tableCount}, DL: ${dlCount}` : undefined,
  })

  // question-headings
  const questionWords = /^(ne|nasıl|neden|nedir|what|how|why|when|which)\b/i
  let questionHeadingCount = 0
  $('h2, h3').each((_, el) => {
    const text = $(el).text().trim()
    if (text.endsWith('?') || questionWords.test(text)) {
      questionHeadingCount++
    }
  })
  checks.push({
    id: 'question-headings',
    title: 'Soru Biçimli Başlıklar',
    description: questionHeadingCount > 0
      ? `${questionHeadingCount} adet soru biçimli başlık bulundu. AEO için güçlü sinyal — AI "öne çıkarılan" cevap arar.`
      : 'Soru biçimli H2/H3 başlığı bulunamadı. "Nasıl?", "Nedir?" biçiminde başlıklar AI\'ın sizi alıntılamasını artırır.',
    status: questionHeadingCount > 0 ? 'pass' : 'warning',
    value: questionHeadingCount > 0 ? `${questionHeadingCount} soru başlığı` : undefined,
  })

  return { score: calcCategoryScore(checks), checks }
}

// ─── 3. E-E-A-T — Experience, Expertise, Authority, Trust (weight 20%) ───
function analyzeEeat($: CheerioAPI, html: string): Category {
  const checks: Check[] = []

  // author-meta
  const metaAuthor = $('meta[name="author"]').attr('content')?.trim() || ''

  // Also check JSON-LD for author
  let jsonLdAuthor = false
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const parsed = JSON.parse($(el).html() || '{}') as Record<string, unknown>
      const checkObj = (obj: Record<string, unknown>): boolean => {
        if (obj['author']) return true
        if (Array.isArray(obj['@graph'])) {
          return (obj['@graph'] as Record<string, unknown>[]).some(checkObj)
        }
        return false
      }
      if (checkObj(parsed)) jsonLdAuthor = true
    } catch {
      // skip invalid
    }
  })

  const hasAuthorSignal = metaAuthor.length > 0 || jsonLdAuthor
  checks.push({
    id: 'author-meta',
    title: 'Yazar Bilgisi',
    description: hasAuthorSignal
      ? `Yazar bilgisi mevcut (${metaAuthor ? `meta: "${metaAuthor}"` : 'JSON-LD'}). E-E-A-T Uzmanlık sinyali güçlü.`
      : 'Yazar bilgisi (meta author veya JSON-LD author) bulunamadı. Uzmanlık sinyali için yazar ekleyin.',
    status: hasAuthorSignal ? 'pass' : 'warning',
    value: metaAuthor || (jsonLdAuthor ? 'JSON-LD\'de mevcut' : undefined),
  })

  // date-published
  const timeEl = $('time[datetime]').first().attr('datetime') || $('time').first().attr('datetime') || ''
  let jsonLdDatePublished = ''
  $('script[type="application/ld+json"]').each((_, el) => {
    if (jsonLdDatePublished) return
    try {
      const parsed = JSON.parse($(el).html() || '{}') as Record<string, unknown>
      const findDate = (obj: Record<string, unknown>): string => {
        if (typeof obj['datePublished'] === 'string') return obj['datePublished']
        if (Array.isArray(obj['@graph'])) {
          for (const item of obj['@graph'] as Record<string, unknown>[]) {
            const d = findDate(item)
            if (d) return d
          }
        }
        return ''
      }
      jsonLdDatePublished = findDate(parsed)
    } catch {
      // skip
    }
  })

  const hasDatePublished = timeEl.length > 0 || jsonLdDatePublished.length > 0
  checks.push({
    id: 'date-published',
    title: 'Yayın Tarihi',
    description: hasDatePublished
      ? `Yayın tarihi bulundu (${jsonLdDatePublished || timeEl}). İçerik tazeliği sinyali AI motorları için önemli.`
      : 'Yayın tarihi (<time> veya JSON-LD datePublished) bulunamadı. İçeriğin güncelliğini belirtmek E-E-A-T açısından kritik.',
    status: hasDatePublished ? 'pass' : 'warning',
    value: jsonLdDatePublished || timeEl || undefined,
  })

  // date-modified
  const ogModifiedTime = $('meta[property="article:modified_time"]').attr('content')?.trim() || ''
  let jsonLdDateModified = ''
  $('script[type="application/ld+json"]').each((_, el) => {
    if (jsonLdDateModified) return
    try {
      const parsed = JSON.parse($(el).html() || '{}') as Record<string, unknown>
      const findMod = (obj: Record<string, unknown>): string => {
        if (typeof obj['dateModified'] === 'string') return obj['dateModified']
        if (Array.isArray(obj['@graph'])) {
          for (const item of obj['@graph'] as Record<string, unknown>[]) {
            const d = findMod(item)
            if (d) return d
          }
        }
        return ''
      }
      jsonLdDateModified = findMod(parsed)
    } catch {
      // skip
    }
  })

  const hasDateModified = ogModifiedTime.length > 0 || jsonLdDateModified.length > 0
  checks.push({
    id: 'date-modified',
    title: 'Son Güncelleme Tarihi',
    description: hasDateModified
      ? `Güncelleme tarihi bulundu (${jsonLdDateModified || ogModifiedTime}). İçeriğin güncel tutulduğunu gösterir.`
      : '"dateModified" veya article:modified_time bulunamadı. Son güncelleme tarihi içerik kalitesi sinyalidir.',
    status: hasDateModified ? 'pass' : 'warning',
    value: jsonLdDateModified || ogModifiedTime || undefined,
  })

  // external-links
  let externalLinkCount = 0
  // Derive base host from og:url or canonical if available
  let baseHost = ''
  const canonical = $('link[rel="canonical"]').attr('href')?.trim() || ''
  const ogUrl = $('meta[property="og:url"]').attr('content')?.trim() || ''
  const baseHref = canonical || ogUrl
  try {
    if (baseHref) baseHost = new URL(baseHref).hostname
  } catch {
    // best-effort
  }

  if (!baseHost) {
    checks.push({
      id: 'external-links',
      title: 'Dış Kaynak Linkleri',
      description: 'Canonical URL bulunamadığı için dış link analizi yapılamadı.',
      status: 'warning',
    })
  } else {
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href')?.trim() || ''
      if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) return
      if (/^https?:\/\//i.test(href)) {
        try {
          const linkHost = new URL(href).hostname
          if (linkHost !== baseHost) {
            externalLinkCount++
          }
        } catch {
          // skip unparseable
        }
      }
    })

    checks.push({
      id: 'external-links',
      title: 'Harici Kaynak Linkleri',
      description: externalLinkCount >= 2
        ? `${externalLinkCount} adet harici link bulundu. Güvenilir kaynaklara bağlantı Trust sinyali verir.`
        : externalLinkCount === 1
          ? '1 adet harici link bulundu. En az 2 güvenilir kaynağa link vermek Trust skorunu artırır.'
          : 'Harici link bulunamadı. Güvenilir kaynaklara (akademik, resmi siteler) link vermek E-E-A-T\'i destekler.',
      status: externalLinkCount >= 2 ? 'pass' : externalLinkCount === 1 ? 'warning' : 'fail',
      value: `${externalLinkCount} harici link`,
    })
  }

  // Suppress unused variable lint warning
  void html

  return { score: calcCategoryScore(checks), checks }
}

// ─── 4. AI READABILITY — How easily AI systems parse this content (weight 20%) ───
function analyzeAiReadability($: CheerioAPI): Category {
  const checks: Check[] = []

  // Remove script/style for text extraction
  const $body = $('body')
  $body.find('script, style, noscript').remove()
  const bodyText = $body.text().replace(/\s+/g, ' ').trim()
  const bodyWords = bodyText.split(/\s+/).filter(w => w.length > 0)
  const wordCount = bodyWords.length

  // word-count
  let wordStatus: 'pass' | 'warning' | 'fail'
  if (wordCount >= 300) wordStatus = 'pass'
  else if (wordCount >= 150) wordStatus = 'warning'
  else wordStatus = 'fail'

  checks.push({
    id: 'word-count',
    title: 'İçerik Kelime Sayısı',
    description: wordCount >= 300
      ? `${wordCount} kelime — AI motorları için yeterli içerik derinliği.`
      : wordCount >= 150
        ? `${wordCount} kelime — orta düzey. 300+ kelime ile AI alıntı olasılığı artar.`
        : `${wordCount} kelime — çok az. AI motorları kısa içerikleri kaynak olarak tercih etmez.`,
    status: wordStatus,
    value: `${wordCount} kelime`,
  })

  // avg-paragraph-length
  const paragraphs = $('p').filter((_, el) => $(el).text().trim().length > 0)
  let avgParaWords = 0
  if (paragraphs.length > 0) {
    const totalParaWords = paragraphs.toArray().reduce((sum, el) => {
      const text = $(el).text().trim()
      return sum + text.split(/\s+/).filter(w => w.length > 0).length
    }, 0)
    avgParaWords = Math.round(totalParaWords / paragraphs.length)
  }

  let paraStatus: 'pass' | 'warning' | 'fail' = 'pass'
  if (paragraphs.length === 0) {
    paraStatus = 'warning'
  } else if (avgParaWords > 200) {
    paraStatus = 'fail'
  } else if (avgParaWords > 120) {
    paraStatus = 'warning'
  }

  checks.push({
    id: 'avg-paragraph-length',
    title: 'Ortalama Paragraf Uzunluğu',
    description: paragraphs.length === 0
      ? 'Paragraf (<p>) bulunamadı. İçeriği paragraflara bölmek AI ayrıştırmasını kolaylaştırır.'
      : avgParaWords <= 120
        ? `Ortalama ${avgParaWords} kelime/paragraf — ideal. AI kısa, odaklı paragrafları tercih eder.`
        : avgParaWords <= 200
          ? `Ortalama ${avgParaWords} kelime/paragraf — biraz uzun. 120 kelime altında tutun.`
          : `Ortalama ${avgParaWords} kelime/paragraf — çok uzun (metin duvarı). Paragrafları bölün.`,
    status: paraStatus,
    value: paragraphs.length > 0 ? `${avgParaWords} kelime/paragraf` : undefined,
  })

  // heading-count (H2 + H3)
  const h2Count = $('h2').length
  const h3Count = $('h3').length
  const headingCount = h2Count + h3Count
  let headingStatus: 'pass' | 'warning' | 'fail'
  if (headingCount >= 3) headingStatus = 'pass'
  else if (headingCount >= 1) headingStatus = 'warning'
  else headingStatus = 'fail'

  checks.push({
    id: 'heading-count',
    title: 'Başlık Sayısı (H2+H3)',
    description: headingCount >= 3
      ? `${headingCount} adet H2/H3 başlığı bulundu. İçerik bölümlere ayrılmış, AI navigasyonu kolay.`
      : headingCount >= 1
        ? `${headingCount} adet H2/H3 — yetersiz. En az 3 alt başlık ile içerik yapılandırın.`
        : 'H2/H3 başlığı bulunamadı. Başlıksız içerik AI için ayrıştırması zor bir metin bloğudur.',
    status: headingStatus,
    value: `H2: ${h2Count}, H3: ${h3Count}`,
  })

  // first-paragraph-length
  const firstPara = $('p').first().text().trim()
  const firstParaWords = firstPara.split(/\s+/).filter(w => w.length > 0).length
  if (firstPara.length > 0) {
    checks.push({
      id: 'first-paragraph-length',
      title: 'Giriş Paragrafı Uzunluğu',
      description: firstParaWords <= 80
        ? `Giriş paragrafı ${firstParaWords} kelime — özlü. AI konuyu hemen kavrar.`
        : `Giriş paragrafı ${firstParaWords} kelime — uzun. İlk paragraf ≤80 kelime olursa AI özeti kolayca çıkarır.`,
      status: firstParaWords <= 80 ? 'pass' : 'warning',
      value: `${firstParaWords} kelime`,
    })
  }

  return { score: calcCategoryScore(checks), checks }
}

// ─── 5. CITABILITY — Likelihood of being cited by AI (weight 15%) ───
function analyzeCitability($: CheerioAPI): Category {
  const checks: Check[] = []

  // script/style already removed by analyzeAiReadability (runs first)
  const bodyText = $('body').text()

  // has-statistics
  const statPattern = /\b\d+(\.\d+)?\s*%|\b\d{2,}\s*(milyon|milyar|bin|million|billion|thousand|users|kullanıcı|müşteri|adet|kişi|yıl|year|saat|hour|gün|day)/i
  const hasStats = statPattern.test(bodyText)
  checks.push({
    id: 'has-statistics',
    title: 'İstatistik ve Sayısal Veri',
    description: hasStats
      ? 'İstatistik veya sayısal veri bulundu. AI motorları rakam içeren içerikleri atıf için tercih eder.'
      : 'İstatistik veya sayısal veri bulunamadı. Yüzde, rakam veya ölçüm eklemek AI atıf olasılığını artırır.',
    status: hasStats ? 'pass' : 'warning',
  })

  // has-definitions
  const definitionPattern = /\b[\w\s]{2,30}\s+(nedir|ne demek|refers? to|is a|is an|anlamına gelir|demektir|şu demektir|olarak tanımlanır|olan [a-zğüşıöçA-ZĞÜŞİÖÇ])/i
  const hasDefinitions = definitionPattern.test(bodyText)
  checks.push({
    id: 'has-definitions',
    title: 'Tanım ve Açıklama Cümleleri',
    description: hasDefinitions
      ? '"X nedir", "X refers to" kalıbında tanım cümleleri bulundu. AEO için ideal — AI yanıt üretiminde bu kalıpları kullanır.'
      : 'Tanım kalıbı (X nedir, X refers to) bulunamadı. Terim tanımları içeren içerikler AI yanıtlarında daha çok alıntılanır.',
    status: hasDefinitions ? 'pass' : 'warning',
  })

  // has-strong-content
  const strongCount = $('strong, b').length
  checks.push({
    id: 'has-strong-content',
    title: 'Vurgulanan Anahtar Terimler',
    description: strongCount >= 2
      ? `${strongCount} adet <strong>/<b> vurgusu bulundu. Önemli terimler öne çıkarılmış, AI skansı kolaylaşır.`
      : strongCount === 1
        ? '1 adet vurgu bulundu. En az 2 anahtar terimi <strong> ile vurgulayın.'
        : '<strong> veya <b> vurgusu bulunamadı. Kritik terimleri vurgulamak AI içerik tarama kalitesini artırır.',
    status: strongCount >= 2 ? 'pass' : 'warning',
    value: strongCount > 0 ? `${strongCount} vurgu` : undefined,
  })

  return { score: calcCategoryScore(checks), checks }
}

// ─── MAIN EXPORT ───
export function analyzeGeoAeo($: CheerioAPI, html: string): GeoAeoResult {
  const schema = analyzeSchema($)
  const contentFormat = analyzeContentFormat($)
  const eeat = analyzeEeat($, html)
  const aiReadability = analyzeAiReadability($)
  const citability = analyzeCitability($)

  const score = Math.round(
    schema.score * 0.25 +
    contentFormat.score * 0.20 +
    eeat.score * 0.20 +
    aiReadability.score * 0.20 +
    citability.score * 0.15
  )

  return {
    score,
    categories: {
      schema,
      contentFormat,
      eeat,
      aiReadability,
      citability,
    },
  }
}
