/**
 * Gözetim Merkezi konsolide veri endpoint'i.
 *
 * Tek bir çağrıda dashboard için gerekli her şeyi döner:
 *  - KPI sayıları (toplam kullanıcı, onboarding, scan status dağılımı, vb.)
 *  - Kullanıcı + firma + business intelligence detayları
 *  - Her firma için source scan listesi (extracted data + error dahil)
 *
 * Yetkisiz çağrı için 404 döner — admin alanının varlığı sızdırılmaz.
 * Manuel kullanım için ADMIN_SECRET header'ı çalışmaya devam eder.
 */
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { checkAdminAccess } from '@/lib/admin/superAdmin'

export const dynamic = 'force-dynamic'

interface SignupRow {
  id: string
  email: string | null
  name: string | null
  status: string | null
  created_at?: string | null
}

interface ProfileRow {
  id: string
  user_id: string
  business_name?: string | null
  business_description?: string | null
  website?: string | null
  social_handles?: any
  competitor_list?: any
  sector_main?: string | null
  sector_sub?: string | null
  target_location?: string | null
  target_locations?: any
  keywords?: any
  brand_tone?: string | null
  prohibited_claims?: any
  onboarding_completed?: boolean | null
  created_at?: string | null
  updated_at?: string | null
  [key: string]: any
}

function summarizeScans(scans: any[]) {
  return scans.map((s: any) => {
    const err = typeof s.error_message === 'string' ? (s.error_message as string) : null
    let providerUsed: string | null = null
    let errorCore: string | null = err
    if (err && err.includes('|provider:')) {
      const [core, providerPart] = err.split('|provider:')
      errorCore = core
      providerUsed = providerPart || null
    }
    return {
      id: s.id,
      profile_id: s.profile_id,
      source_type: s.source_type,
      source_url: s.source_url,
      source_owner_type: s.source_owner_type,
      competitor_id: s.competitor_id,
      scan_status: s.scan_status,
      provider_used: providerUsed,
      error_message: errorCore,
      raw_error_message: err,
      confidence: s.confidence,
      scanned_at: s.scanned_at,
      extracted_title: s.extracted_title,
      extracted_description: s.extracted_description,
      extracted_keywords: s.extracted_keywords || [],
      extracted_services: s.extracted_services || [],
    }
  })
}

function summarizeIntelligence(intel: any | null) {
  if (!intel) return null
  return {
    company_summary: intel.company_summary ?? null,
    business_model: intel.business_model ?? null,
    sector_summary: intel.sector_summary ?? null,
    local_market_summary: intel.local_market_summary ?? null,
    target_audience_summary: intel.target_audience_summary ?? null,
    competitor_summary: intel.competitor_summary ?? null,
    keyword_themes: intel.keyword_themes ?? [],
    confidence: intel.confidence ?? null,
    missing_data: intel.missing_data ?? [],
    updated_at: intel.updated_at ?? null,
    status: intel.status ?? null,
  }
}

export async function GET(req: NextRequest) {
  const access = await checkAdminAccess(req)
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }
  if (!supabase) {
    return NextResponse.json({ ok: false, error: 'supabase_unavailable' }, { status: 503 })
  }

  const { searchParams } = new URL(req.url)
  const limit = Math.min(parseInt(searchParams.get('limit') || '200', 10) || 200, 500)

  try {
    const [
      { data: signups, error: signupsErr },
      { data: profiles, error: profilesErr },
    ] = await Promise.all([
      supabase
        .from('signups')
        .select('id, email, name, status, created_at')
        .order('created_at', { ascending: false })
        .limit(limit),
      supabase
        .from('user_business_profiles')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(limit),
    ])

    if (signupsErr) {
      return NextResponse.json({ ok: false, error: signupsErr.message }, { status: 500 })
    }
    if (profilesErr) {
      return NextResponse.json({ ok: false, error: profilesErr.message }, { status: 500 })
    }

    const signupRows = (signups || []) as SignupRow[]
    const profileRows = (profiles || []) as ProfileRow[]

    const userIds = Array.from(new Set(profileRows.map((p) => p.user_id).filter(Boolean)))
    const profileIds = profileRows.map((p) => p.id).filter(Boolean)

    const [{ data: competitors }, { data: scans }, { data: intelligence }] = await Promise.all([
      supabase
        .from('user_business_competitors')
        .select('*')
        .in('user_id', userIds.length ? userIds : ['__none__']),
      supabase
        .from('user_business_source_scans')
        .select('*')
        .in('profile_id', profileIds.length ? profileIds : ['__none__']),
      supabase
        .from('user_business_intelligence')
        .select('*')
        .in('user_id', userIds.length ? userIds : ['__none__']),
    ])

    const signupByUser = new Map<string, SignupRow>()
    for (const s of signupRows) signupByUser.set(s.id, s)

    const compByUser = new Map<string, any[]>()
    for (const c of competitors || []) {
      if (!compByUser.has(c.user_id)) compByUser.set(c.user_id, [])
      compByUser.get(c.user_id)!.push(c)
    }
    const scanByProfile = new Map<string, any[]>()
    for (const s of scans || []) {
      if (!scanByProfile.has(s.profile_id)) scanByProfile.set(s.profile_id, [])
      scanByProfile.get(s.profile_id)!.push(s)
    }
    const intelByUser = new Map<string, any>()
    for (const i of intelligence || []) intelByUser.set(i.user_id, i)

    const profileRowsByUser = new Map<string, ProfileRow>()
    for (const p of profileRows) profileRowsByUser.set(p.user_id, p)

    const enriched = profileRows.map((p) => {
      const profileScans = scanByProfile.get(p.id) || []
      const userSignup = signupByUser.get(p.user_id) || null
      const intel = intelByUser.get(p.user_id) || null
      const compList = compByUser.get(p.user_id) || []
      return {
        user: userSignup
          ? {
              id: userSignup.id,
              email: userSignup.email,
              name: userSignup.name,
              status: userSignup.status,
              created_at: userSignup.created_at,
            }
          : null,
        profile: p,
        competitors: compList,
        sourceScans: profileScans,
        sourceScansSummary: summarizeScans(profileScans),
        intelligence: intel,
        intelligenceSummary: summarizeIntelligence(intel),
      }
    })

    // KPI'lar
    const totalUsers = signupRows.length
    const totalProfiles = profileRows.length
    const onboardingCompleted = profileRows.filter((p) => !!p.onboarding_completed).length
    const onboardingPending = profileRows.filter((p) => !p.onboarding_completed).length
    const usersWithoutProfile = signupRows.filter((s) => !profileRowsByUser.has(s.id)).length

    const allScans = scans || []
    const totalScans = allScans.length
    const failedScans = allScans.filter((s: any) => (s.scan_status || '').toLowerCase() === 'failed').length
    const runningScans = allScans.filter((s: any) => {
      const st = (s.scan_status || '').toLowerCase()
      return st === 'running' || st === 'pending' || st === 'queued'
    }).length
    const completedScans = allScans.filter((s: any) => {
      const st = (s.scan_status || '').toLowerCase()
      return st === 'completed' || st === 'success' || st === 'done'
    }).length

    const intelConfidences = (intelligence || [])
      .map((i: any) => Number(i.confidence))
      .filter((n: number) => Number.isFinite(n))
    const avgIntelConfidence = intelConfidences.length
      ? intelConfidences.reduce((a: number, b: number) => a + b, 0) / intelConfidences.length
      : null

    const kpis = {
      totalUsers,
      onboardingCompleted,
      onboardingPending,
      usersWithoutProfile,
      totalProfiles,
      totalScans,
      failedScans,
      runningScans,
      completedScans,
      avgIntelConfidence,
    }

    // Recent signups (henüz profile bağlamadığında bile UI'da görsün)
    const recentSignups = signupRows
      .slice()
      .sort((a, b) => {
        const ta = a.created_at ? Date.parse(a.created_at) : 0
        const tb = b.created_at ? Date.parse(b.created_at) : 0
        return tb - ta
      })
      .slice(0, 25)
      .map((s) => ({
        id: s.id,
        email: s.email,
        name: s.name,
        status: s.status,
        created_at: s.created_at,
        hasProfile: profileRowsByUser.has(s.id),
      }))

    return NextResponse.json({
      ok: true,
      kpis,
      profiles: enriched,
      recentSignups,
      via: access.via,
    })
  } catch (e) {
    console.error('[admin/gozetim-merkezi] error:', e)
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 })
  }
}
