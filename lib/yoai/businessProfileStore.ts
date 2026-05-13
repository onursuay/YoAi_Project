/* ──────────────────────────────────────────────────────────
   YoAi — Business Profile Store

   Supabase üzerindeki user_business_profiles + competitors +
   source_scans + intelligence tablolarına CRUD katmanı.

   Tablolar yoksa (Supabase / migration uygulanmamışsa) tüm
   fonksiyonlar null/false döner; üretim motorları crash etmez.

   Validation helper'ları ayrı bir dosyaya çıkarıldı (./businessProfileValidation)
   böylece test runner'lar 'server-only' supabase client'ını import etmek zorunda
   kalmadan validation'ı doğrulayabilir.
   ────────────────────────────────────────────────────────── */

import { supabase } from '@/lib/supabase/client'

export {
  MIN_COMPETITORS_REQUIRED,
  validateProfileForOnboarding,
  type ProfileValidationResult,
} from './businessProfileValidation'

/* ── Types ─────────────────────────────────────────────────── */

export interface BusinessProfileRow {
  id?: string
  user_id: string
  company_name: string
  sector_main: string | null
  sector_sub: string | null
  specialization: string | null
  business_description: string | null
  main_conversion_goal: string | null
  target_locations: string[]
  target_audience: string | null
  website_url: string | null
  instagram_url: string | null
  facebook_url: string | null
  linkedin_url: string | null
  youtube_url: string | null
  tiktok_url: string | null
  google_business_profile_url: string | null
  marketplace_url: string | null
  keywords: string[]
  products_or_services: string[]
  most_profitable_services: string[]
  monthly_ad_budget_range: string | null
  brand_tone: string | null
  forbidden_claims: string[]
  compliance_notes: string | null
  extra_notes: string | null
  onboarding_completed: boolean
  profile_confidence: number
  scan_status: 'pending' | 'running' | 'completed' | 'failed' | 'partial'
  intelligence_status: 'pending' | 'running' | 'completed' | 'failed' | 'stale'
  last_scan_started_at?: string | null
  last_scan_completed_at?: string | null
  created_at?: string
  updated_at?: string
}

export interface BusinessCompetitorRow {
  id?: string
  user_id: string
  profile_id: string
  competitor_name: string
  website_url: string | null
  instagram_url: string | null
  facebook_url: string | null
  linkedin_url: string | null
  youtube_url: string | null
  tiktok_url: string | null
  google_business_url: string | null
  extra_url: string | null
  scan_status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped'
  scan_error: string | null
  confidence: number
  created_at?: string
  updated_at?: string
}

export interface BusinessSourceScanRow {
  id?: string
  user_id: string
  profile_id: string
  competitor_id: string | null
  source_owner_type: 'own_brand' | 'competitor'
  source_type: 'website' | 'instagram' | 'facebook' | 'linkedin' | 'youtube' | 'tiktok' | 'google_business' | 'marketplace' | 'extra'
  source_url: string | null
  scan_status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped'
  raw_excerpt: string | null
  extracted_title: string | null
  extracted_description: string | null
  extracted_services: string[]
  extracted_products: string[]
  extracted_keywords: string[]
  extracted_audience: string | null
  extracted_locations: string[]
  extracted_ctas: string[]
  extracted_brand_tone: string | null
  extracted_offers: string[]
  extracted_social_proof: string | null
  confidence: number
  error_message: string | null
  scanned_at: string | null
  created_at?: string
}

export interface BusinessIntelligenceRow {
  id?: string
  user_id: string
  profile_id: string
  company_summary: string | null
  business_model: string | null
  sector_summary: string | null
  local_market_summary: string | null
  services_summary: string | null
  products_summary: string | null
  target_audience_summary: string | null
  conversion_goal_summary: string | null
  competitor_summary: string | null
  competitor_positioning_summary: string | null
  keyword_themes: string[]
  recommended_google_campaign_types: string[]
  recommended_meta_objectives: string[]
  recommended_content_angles: string[]
  recommended_offer_angles: string[]
  risk_claims: string[]
  forbidden_claims: string[]
  brand_positioning: string | null
  audience_pains: string[]
  audience_motivations: string[]
  location_insights: string | null
  source_coverage: Record<string, unknown> | null
  confidence: number
  missing_data: string[]
  last_generated_at?: string
  created_at?: string
  updated_at?: string
}

/* ── Profile CRUD ──────────────────────────────────────────── */

export async function getProfileByUserId(userId: string): Promise<BusinessProfileRow | null> {
  if (!supabase || !userId) return null
  try {
    const { data, error } = await supabase
      .from('user_business_profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()
    if (error) {
      if (error.code === '42P01' || error.message?.includes('does not exist')) return null
      console.warn('[businessProfileStore] getProfileByUserId error:', error)
      return null
    }
    return (data as BusinessProfileRow) || null
  } catch (e) {
    console.warn('[businessProfileStore] getProfileByUserId exception:', e)
    return null
  }
}

export async function upsertProfile(profile: BusinessProfileRow): Promise<BusinessProfileRow | null> {
  if (!supabase || !profile.user_id) return null
  try {
    const { data, error } = await supabase
      .from('user_business_profiles')
      .upsert({ ...profile, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
      .select('*')
      .single()
    if (error) {
      console.warn('[businessProfileStore] upsertProfile error:', error)
      return null
    }
    return data as BusinessProfileRow
  } catch (e) {
    console.warn('[businessProfileStore] upsertProfile exception:', e)
    return null
  }
}

export async function markIntelligenceStale(userId: string): Promise<void> {
  if (!supabase || !userId) return
  try {
    await supabase
      .from('user_business_profiles')
      .update({ intelligence_status: 'stale', updated_at: new Date().toISOString() })
      .eq('user_id', userId)
  } catch (e) {
    console.warn('[businessProfileStore] markIntelligenceStale exception:', e)
  }
}

/* ── Competitor CRUD ───────────────────────────────────────── */

export async function listCompetitors(userId: string): Promise<BusinessCompetitorRow[]> {
  if (!supabase || !userId) return []
  try {
    const { data, error } = await supabase
      .from('user_business_competitors')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
    if (error) {
      if (error.code === '42P01') return []
      console.warn('[businessProfileStore] listCompetitors error:', error)
      return []
    }
    return (data as BusinessCompetitorRow[]) || []
  } catch (e) {
    console.warn('[businessProfileStore] listCompetitors exception:', e)
    return []
  }
}

export async function replaceCompetitors(
  userId: string,
  profileId: string,
  competitors: Omit<BusinessCompetitorRow, 'user_id' | 'profile_id' | 'created_at' | 'updated_at'>[],
): Promise<BusinessCompetitorRow[]> {
  if (!supabase || !userId || !profileId) return []
  try {
    // delete existing
    await supabase.from('user_business_competitors').delete().eq('profile_id', profileId)
    if (competitors.length === 0) return []
    const rows = competitors.map((c) => ({
      user_id: userId,
      profile_id: profileId,
      competitor_name: c.competitor_name,
      website_url: c.website_url,
      instagram_url: c.instagram_url,
      facebook_url: c.facebook_url,
      linkedin_url: c.linkedin_url,
      youtube_url: c.youtube_url,
      tiktok_url: c.tiktok_url,
      google_business_url: c.google_business_url,
      extra_url: c.extra_url,
      scan_status: c.scan_status || 'pending',
      scan_error: c.scan_error,
      confidence: c.confidence ?? 0,
    }))
    const { data, error } = await supabase
      .from('user_business_competitors')
      .insert(rows)
      .select('*')
    if (error) {
      console.warn('[businessProfileStore] replaceCompetitors error:', error)
      return []
    }
    return (data as BusinessCompetitorRow[]) || []
  } catch (e) {
    console.warn('[businessProfileStore] replaceCompetitors exception:', e)
    return []
  }
}

/* ── Source scan CRUD ──────────────────────────────────────── */

export async function insertSourceScans(
  scans: Omit<BusinessSourceScanRow, 'id' | 'created_at'>[],
): Promise<void> {
  if (!supabase || scans.length === 0) return
  try {
    const { error } = await supabase.from('user_business_source_scans').insert(scans)
    if (error) console.warn('[businessProfileStore] insertSourceScans error:', error)
  } catch (e) {
    console.warn('[businessProfileStore] insertSourceScans exception:', e)
  }
}

export async function listSourceScansForProfile(profileId: string): Promise<BusinessSourceScanRow[]> {
  if (!supabase || !profileId) return []
  try {
    const { data, error } = await supabase
      .from('user_business_source_scans')
      .select('*')
      .eq('profile_id', profileId)
      .order('created_at', { ascending: false })
    if (error) {
      if (error.code === '42P01') return []
      return []
    }
    return (data as BusinessSourceScanRow[]) || []
  } catch {
    return []
  }
}

/* ── Intelligence CRUD ─────────────────────────────────────── */

export async function getIntelligenceByUserId(userId: string): Promise<BusinessIntelligenceRow | null> {
  if (!supabase || !userId) return null
  try {
    const { data, error } = await supabase
      .from('user_business_intelligence')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()
    if (error) {
      if (error.code === '42P01') return null
      return null
    }
    return (data as BusinessIntelligenceRow) || null
  } catch {
    return null
  }
}

export async function upsertIntelligence(row: BusinessIntelligenceRow): Promise<BusinessIntelligenceRow | null> {
  if (!supabase || !row.user_id) return null
  try {
    const { data, error } = await supabase
      .from('user_business_intelligence')
      .upsert({ ...row, last_generated_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
      .select('*')
      .single()
    if (error) {
      console.warn('[businessProfileStore] upsertIntelligence error:', error)
      return null
    }
    return data as BusinessIntelligenceRow
  } catch (e) {
    console.warn('[businessProfileStore] upsertIntelligence exception:', e)
    return null
  }
}
