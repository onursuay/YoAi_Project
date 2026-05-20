/* ──────────────────────────────────────────────────────────
   YoAlgoritma AI Engine — Scan Business Brief (pure builder)

   Kullanıcının KENDİ beyanı (user_business_profiles +
   user_business_competitors) ile sentezlenmiş iş zekasını
   (user_business_intelligence) Claude payload'ına gidecek tek
   bir markdown bloğuna dönüştürür.

   Tasarım kuralı (A1):
     • Kullanıcı beyanı = BİRİNCİL gerçeklik kaynağı, ASLA
       sıkıştırılmaz (özellikle iş tanımı tam metniyle gider).
       "aşçılık sertifikası → aşçı iş ilanı" tipi hatanın panzehri.
     • Sentezlenmiş iş zekası = ikincil enrichment, token baskısı
       altında alan başına / liste başına kapatılabilir.

   Pure builder — supabase bağımlılığı yok (yalnızca TYPE import).
   scanUser.ts içindeki loadBusinessContext bunu çağırır;
   testler doğrudan import edebilir.
   ────────────────────────────────────────────────────────── */

import type { BusinessContext } from '@/lib/yoai/businessContextStore'

// A1.5 — enrichment kapama eşikleri (beyan ASLA kapatılmaz).
const MAX_INTEL_FIELD = 600
const MAX_LIST_ITEMS = 10

export interface ScanBusinessBrief {
  /** systemPrompt buildUserBrief'in `industry` slotu (insan-okunur sektör etiketi). */
  industry?: string
  /** buildUserBrief'e gidecek tam markdown bloğu (beyan + rakipler + enrichment). */
  businessContext?: string
  hasProfile: boolean
}

function cap(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max)}…`
}

/**
 * Pure builder — BusinessContext → scan business brief markdown.
 * Profil yoksa hasProfile=false döner; çağıran tarafı sektör/bağlam eklemez.
 */
export function buildScanBusinessBrief(ctx: BusinessContext): ScanBusinessBrief {
  if (!ctx.profile) return { hasProfile: false }
  const p = ctx.profile
  const lines: string[] = []

  /* ── 1. Kullanıcı beyanı (ZORUNLU — asla sıkıştırılmaz) ── */
  lines.push('## Kullanıcının kendi marka beyanı (ZORUNLU bağlam — birincil gerçeklik kaynağı)')
  lines.push(
    'Aşağıdaki bilgiler kullanıcının kurulum (onboarding) sırasında KENDİSİNİN girdiği beyandır — ' +
      'dolaylı çıkarım değil. TÜM uyarı/fırsat/öneriler bu beyana UYGUN olmak zorundadır. ' +
      'Beyanla çelişen ya da markanın işiyle alakasız jenerik öneri ÜRETME.',
  )
  lines.push('')
  lines.push(`- Marka: ${p.company_name || '—'}`)
  const sectorLabel = ctx.sectorLabel || p.sector_main || null
  if (sectorLabel) lines.push(`- Sektör: ${sectorLabel}`)
  if (p.specialization) lines.push(`- Uzmanlık: ${p.specialization}`)
  // İş tanımı TAM metniyle — kırpma yok (A1 kritik kuralı).
  if (p.business_description) lines.push(`- İş tanımı (tam): ${p.business_description}`)
  if (p.products_or_services?.length) lines.push(`- Ürün/Hizmetler: ${p.products_or_services.join(', ')}`)
  if (p.most_profitable_services?.length) lines.push(`- En kârlı hizmetler: ${p.most_profitable_services.join(', ')}`)
  if (p.main_conversion_goal) lines.push(`- Ana dönüşüm hedefi: ${p.main_conversion_goal}`)
  if (p.target_locations?.length) lines.push(`- Hedef lokasyonlar: ${p.target_locations.join(', ')}`)
  if (p.target_audience) lines.push(`- Hedef kitle: ${p.target_audience}`)
  if (p.keywords?.length) lines.push(`- Anahtar kelimeler: ${p.keywords.join(', ')}`)
  if (p.brand_tone) lines.push(`- Marka tonu: ${p.brand_tone}`)
  if (p.monthly_ad_budget_range) lines.push(`- Aylık reklam bütçe aralığı: ${p.monthly_ad_budget_range}`)
  if (p.forbidden_claims?.length) lines.push(`- Yasaklı iddialar (KESİNLİKLE KULLANMA): ${p.forbidden_claims.join(', ')}`)
  if (p.compliance_notes) lines.push(`- Uyumluluk notları: ${p.compliance_notes}`)

  const ownSrc: string[] = []
  if (p.website_url) ownSrc.push(`web: ${p.website_url}`)
  if (p.instagram_url) ownSrc.push(`instagram: ${p.instagram_url}`)
  if (p.facebook_url) ownSrc.push(`facebook: ${p.facebook_url}`)
  if (p.linkedin_url) ownSrc.push(`linkedin: ${p.linkedin_url}`)
  if (p.youtube_url) ownSrc.push(`youtube: ${p.youtube_url}`)
  if (p.tiktok_url) ownSrc.push(`tiktok: ${p.tiktok_url}`)
  if (p.google_business_profile_url) ownSrc.push(`google business: ${p.google_business_profile_url}`)
  if (p.marketplace_url) ownSrc.push(`pazaryeri: ${p.marketplace_url}`)
  if (ownSrc.length) lines.push(`- Marka kaynakları: ${ownSrc.join(' | ')}`)

  /* ── 2. Kullanıcının belirttiği rakipler (beyan) ── */
  if (ctx.competitors.length) {
    lines.push('')
    lines.push('### Kullanıcının belirttiği rakipler')
    for (const c of ctx.competitors) {
      const refs =
        [c.website_url, c.instagram_url, c.facebook_url, c.linkedin_url, c.youtube_url, c.tiktok_url, c.google_business_url]
          .filter(Boolean)
          .join(' | ') || '—'
      lines.push(`- ${c.competitor_name}: ${refs}`)
    }
  }

  /* ── 3. Sentezlenmiş iş zekası (enrichment — ikincil, kapatılabilir) ── */
  const im = ctx.intelligenceMemory
  if (im) {
    lines.push('')
    lines.push('## Sentezlenmiş iş zekası (otomatik üretilmiş enrichment — ikincil bağlam)')
    const fld = (label: string, v: string | null | undefined) => {
      if (v && v.trim()) lines.push(`- ${label}: ${cap(v.trim(), MAX_INTEL_FIELD)}`)
    }
    const lst = (label: string, v: string[] | null | undefined) => {
      if (v && v.length) lines.push(`- ${label}: ${v.slice(0, MAX_LIST_ITEMS).join(', ')}`)
    }
    fld('Firma özeti', im.company_summary)
    fld('İş modeli', im.business_model)
    fld('Sektör özeti', im.sector_summary)
    fld('Yerel pazar', im.local_market_summary)
    fld('Hizmet özeti', im.services_summary)
    fld('Hedef kitle özeti', im.target_audience_summary)
    fld('Dönüşüm hedefi özeti', im.conversion_goal_summary)
    fld('Rakip özeti', im.competitor_summary)
    fld('Rakip konumlandırma', im.competitor_positioning_summary)
    fld('Marka konumlandırma', im.brand_positioning)
    lst('Hedef kitle acıları', im.audience_pains)
    lst('Hedef kitle motivasyonları', im.audience_motivations)
    lst('Önerilen Google kampanya türleri', im.recommended_google_campaign_types)
    lst('Önerilen Meta hedefleri', im.recommended_meta_objectives)
    lst('Önerilen içerik açıları', im.recommended_content_angles)
    lst('Önerilen teklif açıları', im.recommended_offer_angles)
    lst('Anahtar kelime temaları', im.keyword_themes)
  }

  const industry =
    ctx.sectorLabel ||
    (p.sector_main ? (p.sector_sub ? `${p.sector_main} / ${p.sector_sub}` : p.sector_main) : undefined)

  return {
    industry: industry || undefined,
    businessContext: lines.length ? lines.join('\n') : undefined,
    hasProfile: true,
  }
}
