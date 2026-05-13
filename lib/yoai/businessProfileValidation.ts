/* ──────────────────────────────────────────────────────────
   YoAi — Business Profile Validation (pure)

   Hiçbir DB / supabase / 'server-only' bağımlılığı yoktur.
   Bu modül onboarding form validasyonunu sağlar ve hem
   API route'ları hem testler tarafından doğrudan kullanılır.
   ────────────────────────────────────────────────────────── */

import { isValidSectorMain, isValidSectorSub } from './sectorCatalog'

export const MIN_COMPETITORS_REQUIRED = 3

const BRAND_SOURCE_FIELDS = [
  'website_url',
  'instagram_url',
  'facebook_url',
  'linkedin_url',
  'youtube_url',
  'tiktok_url',
  'google_business_profile_url',
  'marketplace_url',
] as const

interface ProfileShape {
  company_name?: string
  sector_main?: string | null
  sector_sub?: string | null
  business_description?: string | null
  main_conversion_goal?: string | null
  target_locations?: string[]
  website_url?: string | null
  instagram_url?: string | null
  facebook_url?: string | null
  linkedin_url?: string | null
  youtube_url?: string | null
  tiktok_url?: string | null
  google_business_profile_url?: string | null
  marketplace_url?: string | null
}

interface CompetitorShape {
  competitor_name: string
  website_url: string | null
  instagram_url: string | null
  facebook_url: string | null
  linkedin_url: string | null
  youtube_url: string | null
  tiktok_url: string | null
  google_business_url: string | null
  extra_url: string | null
}

export interface ProfileValidationResult {
  ok: boolean
  errors: string[]
}

export function validateProfileForOnboarding(
  profile: ProfileShape,
  competitors: CompetitorShape[],
): ProfileValidationResult {
  const errors: string[] = []
  if (!profile.company_name || !profile.company_name.trim()) {
    errors.push('Firma adı zorunludur.')
  }
  if (!profile.sector_main || !isValidSectorMain(profile.sector_main)) {
    errors.push('Geçerli bir ana sektör seçilmelidir.')
  }
  if (profile.sector_sub && profile.sector_main && !isValidSectorSub(profile.sector_main, profile.sector_sub)) {
    errors.push('Alt sektör seçimi ana sektörle uyumlu değil.')
  }
  if (!profile.business_description || profile.business_description.trim().length < 10) {
    errors.push('İşletme açıklaması zorunludur (en az 10 karakter).')
  }
  if (!profile.main_conversion_goal || !profile.main_conversion_goal.trim()) {
    errors.push('Ana dönüşüm hedefi zorunludur.')
  }
  if (!profile.target_locations || profile.target_locations.length === 0) {
    errors.push('En az bir hedef lokasyon belirtilmelidir.')
  }
  // En az 1 marka kaynağı
  const hasAnyBrandSource = BRAND_SOURCE_FIELDS.some((field) => {
    const val = (profile as Record<string, unknown>)[field]
    return typeof val === 'string' && val.trim().length > 0
  })
  if (!hasAnyBrandSource) {
    errors.push('En az 1 marka kaynağı (website, sosyal medya, Google Business veya marketplace) zorunludur.')
  }
  // En az 3 rakip
  const validCompetitors = competitors.filter((c) => {
    const hasName = c.competitor_name && c.competitor_name.trim().length > 0
    const hasAnySource =
      (c.website_url || '').trim() ||
      (c.instagram_url || '').trim() ||
      (c.facebook_url || '').trim() ||
      (c.linkedin_url || '').trim() ||
      (c.youtube_url || '').trim() ||
      (c.tiktok_url || '').trim() ||
      (c.google_business_url || '').trim() ||
      (c.extra_url || '').trim()
    return hasName || hasAnySource
  })
  if (validCompetitors.length < MIN_COMPETITORS_REQUIRED) {
    errors.push(`En az ${MIN_COMPETITORS_REQUIRED} rakip referansı zorunludur (girilen: ${validCompetitors.length}).`)
  }
  return { ok: errors.length === 0, errors }
}
