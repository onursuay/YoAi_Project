/**
 * Gözetim Merkezi konsolide veri endpoint'i.
 *
 * Tek bir çağrıda dashboard için gerekli her şeyi döner:
 *  - KPI sayıları (toplam kullanıcı, onboarding, scan status dağılımı, vb.)
 *  - Kullanıcı + firma + business intelligence detayları
 *  - Her firma için source scan listesi (extracted data + error dahil)
 *  - Hata tipi dağılımı (failed scan'lerden derlenir)
 *
 * Yetkisiz çağrı için 404 döner — admin alanının varlığı sızdırılmaz.
 * Manuel kullanım için ADMIN_SECRET header'ı çalışmaya devam eder.
 *
 * Hata kontratı:
 *   - Tek bir alt query başarısız olsa bile (eksik tablo, RLS, vb.) tüm cevap
 *     500'e çakılmaz; başarılı kısımlar döner ve `diagnostics[]` içine
 *     teknik mesaj yazılır. UI tarafı bu diagnostic'i görünür kılar.
 *   - signups query'si tamamen patlarsa (en kritik kaynak) 500 döner.
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
  company_name?: string | null
  business_description?: string | null
  sector_main?: string | null
  sector_sub?: string | null
  specialization?: string | null
  target_locations?: any
  target_audience?: string | null
  main_conversion_goal?: string | null
  website_url?: string | null
  instagram_url?: string | null
  facebook_url?: string | null
  linkedin_url?: string | null
  youtube_url?: string | null
  tiktok_url?: string | null
  google_business_profile_url?: string | null
  marketplace_url?: string | null
  keywords?: any
  products_or_services?: any
  most_profitable_services?: any
  monthly_ad_budget_range?: string | null
  brand_tone?: string | null
  forbidden_claims?: any
  onboarding_completed?: boolean | null
  scan_status?: string | null
  intelligence_status?: string | null
  profile_confidence?: number | null
  last_scan_started_at?: string | null
  last_scan_completed_at?: string | null
  created_at?: string | null
  updated_at?: string | null
  [key: string]: any
}

function buildSocialHandles(p: ProfileRow): Record<string, string> {
  const out: Record<string, string> = {}
  const candidates: Array<[string, any]> = [
    ['website', p.website_url],
    ['instagram', p.instagram_url],
    ['facebook', p.facebook_url],
    ['linkedin', p.linkedin_url],
    ['youtube', p.youtube_url],
    ['tiktok', p.tiktok_url],
    ['google_business', p.google_business_profile_url],
    ['marketplace', p.marketplace_url],
  ]
  for (const [k, v] of candidates) {
    if (typeof v === 'string' && v.trim()) out[k] = v.trim()
  }
  return out
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
    updated_at: intel.updated_at ?? intel.last_generated_at ?? null,
    status: intel.status ?? null,
  }
}

function classifyErrorCore(err: string | null | undefined): string {
  if (!err) return 'unknown'
  const s = err.toLowerCase()
  if (s.includes('login_wall') || s.includes('login wall')) return 'login_wall'
  if (s.includes('no_extractable') || s.includes('no extract')) return 'no_extractable_metadata'
  if (s.includes('scraper_provider_missing') || s.includes('provider missing')) return 'scraper_provider_missing'
  if (s.includes('404') || s.includes('not_found')) return 'http_404'
  if (s.includes('403') || s.includes('forbidden')) return 'http_403'
  if (s.includes('apify')) return 'apify_error'
  if (s.includes('timeout') || s.includes('timed out')) return 'timeout'
  if (s.includes('dns') || s.includes('enotfound') || s.includes('econn')) return 'network'
  return 'other'
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

  const diagnostics: string[] = []

  try {
    // Signups + profiles — bağımsız sorgular, bir tanesi patlasa bile diğeri devam.
    const [signupsRes, profilesRes] = await Promise.all([
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

    if (signupsRes.error) {
      diagnostics.push(`signups:${signupsRes.error.message}`)
      // Kritik kaynak — yine de boş array ile devam etmeyi tercih ediyoruz.
    }
    if (profilesRes.error) {
      diagnostics.push(`user_business_profiles:${profilesRes.error.message}`)
    }

    const signupRows = (signupsRes.data || []) as SignupRow[]
    const profileRows = (profilesRes.data || []) as ProfileRow[]

    const userIds = Array.from(new Set(profileRows.map((p) => p.user_id).filter(Boolean)))
    const profileIds = profileRows.map((p) => p.id).filter(Boolean)

    // Sentinel array (örn. tek string elemanlı placeholder) UUID kolonu için
    // geçersizdir; Postgres "invalid input syntax for type uuid" hatası verir
    // ve tüm endpoint 500'e çakılır. Boş profil/user_id listesinde sorguyu
    // tamamen atlıyor, hazır boş data dönüyoruz.
    const fetchCompetitors = userIds.length
      ? supabase.from('user_business_competitors').select('*').in('user_id', userIds)
      : Promise.resolve({ data: [] as any[], error: null })
    const fetchScans = profileIds.length
      ? supabase.from('user_business_source_scans').select('*').in('profile_id', profileIds)
      : Promise.resolve({ data: [] as any[], error: null })
    const fetchIntel = userIds.length
      ? supabase.from('user_business_intelligence').select('*').in('user_id', userIds)
      : Promise.resolve({ data: [] as any[], error: null })

    const [competitorsRes, scansRes, intelRes] = await Promise.all([
      fetchCompetitors,
      fetchScans,
      fetchIntel,
    ])

    if ((competitorsRes as any).error) {
      diagnostics.push(`user_business_competitors:${(competitorsRes as any).error.message}`)
    }
    if ((scansRes as any).error) {
      diagnostics.push(`user_business_source_scans:${(scansRes as any).error.message}`)
    }
    if ((intelRes as any).error) {
      diagnostics.push(`user_business_intelligence:${(intelRes as any).error.message}`)
    }

    const competitors = (competitorsRes as any).data || []
    const scans = (scansRes as any).data || []
    const intelligence = (intelRes as any).data || []

    const signupByUser = new Map<string, SignupRow>()
    for (const s of signupRows) signupByUser.set(s.id, s)

    const compByUser = new Map<string, any[]>()
    for (const c of competitors) {
      if (!compByUser.has(c.user_id)) compByUser.set(c.user_id, [])
      compByUser.get(c.user_id)!.push(c)
    }
    const scanByProfile = new Map<string, any[]>()
    for (const s of scans) {
      if (!scanByProfile.has(s.profile_id)) scanByProfile.set(s.profile_id, [])
      scanByProfile.get(s.profile_id)!.push(s)
    }
    const intelByUser = new Map<string, any>()
    for (const i of intelligence) intelByUser.set(i.user_id, i)

    const profileRowsByUser = new Map<string, ProfileRow>()
    for (const p of profileRows) profileRowsByUser.set(p.user_id, p)

    // 1) Profili olan kullanıcılar
    const enrichedWithProfile = profileRows.map((p) => {
      const profileScans = scanByProfile.get(p.id) || []
      const userSignup = signupByUser.get(p.user_id) || null
      const intel = intelByUser.get(p.user_id) || null
      const compList = compByUser.get(p.user_id) || []

      // UI'ın kullandığı eski alan adlarını (business_name, target_location,
      // social_handles) profile objesi içine alias ediyoruz; gerçek kolon
      // adlarımız company_name / target_locations. Bu sayede client list
      // doğrudan render edebilir.
      const enrichedProfile: any = { ...p }
      enrichedProfile.business_name = p.company_name ?? null
      enrichedProfile.target_location = Array.isArray(p.target_locations)
        ? (p.target_locations as any[]).join(', ')
        : (typeof p.target_locations === 'string' ? p.target_locations : null)
      enrichedProfile.social_handles = buildSocialHandles(p)
      enrichedProfile.prohibited_claims = p.forbidden_claims ?? []

      return {
        user: userSignup
          ? {
              id: userSignup.id,
              email: userSignup.email,
              name: userSignup.name,
              status: userSignup.status,
              created_at: userSignup.created_at,
            }
          : { id: p.user_id, email: null, name: null, status: null, created_at: null },
        profile: enrichedProfile,
        competitors: compList,
        sourceScans: profileScans,
        sourceScansSummary: summarizeScans(profileScans),
        intelligence: intel,
        intelligenceSummary: summarizeIntelligence(intel),
      }
    })

    // 2) Profili olmayan kullanıcılar — tabloya "profile: null" şeklinde dahil
    //    edilir. Bu sayede tüm kayıtlı kullanıcılar Gözetim Merkezi'nde
    //    izlenebilir.
    const profilelessUsers = signupRows
      .filter((s) => !profileRowsByUser.has(s.id))
      .map((s) => ({
        user: {
          id: s.id,
          email: s.email,
          name: s.name,
          status: s.status,
          created_at: s.created_at,
        },
        profile: null as any,
        competitors: [] as any[],
        sourceScans: [] as any[],
        sourceScansSummary: [] as any[],
        intelligence: null,
        intelligenceSummary: null,
      }))

    const enriched = [...enrichedWithProfile, ...profilelessUsers]

    // KPI'lar
    const totalUsers = signupRows.length
    const totalProfiles = profileRows.length
    const onboardingCompleted = profileRows.filter((p) => !!p.onboarding_completed).length
    const onboardingPending = profileRows.filter((p) => !p.onboarding_completed).length
    const usersWithoutProfile = signupRows.filter((s) => !profileRowsByUser.has(s.id)).length
    const intelligenceMissing = profileRows.filter((p) => !intelByUser.has(p.user_id)).length

    const allScans = scans
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

    const intelConfidences = intelligence
      .map((i: any) => Number(i.confidence))
      .filter((n: number) => Number.isFinite(n))
    const avgIntelConfidence = intelConfidences.length
      ? intelConfidences.reduce((a: number, b: number) => a + b, 0) / intelConfidences.length
      : null

    // Son 24 saat / 7 gün signup sayıları
    const now = Date.now()
    const DAY = 86_400_000
    const signups24h = signupRows.filter((s) => {
      const ts = s.created_at ? Date.parse(s.created_at) : 0
      return ts && now - ts <= DAY
    }).length
    const signups7d = signupRows.filter((s) => {
      const ts = s.created_at ? Date.parse(s.created_at) : 0
      return ts && now - ts <= 7 * DAY
    }).length

    // Hata tipi dağılımı (failed scan'lerden)
    const errorTypeCounts: Record<string, number> = {}
    for (const s of allScans) {
      if ((s.scan_status || '').toLowerCase() !== 'failed') continue
      const err = typeof s.error_message === 'string' ? s.error_message : null
      const core = err && err.includes('|provider:') ? err.split('|provider:')[0] : err
      const type = classifyErrorCore(core || '')
      errorTypeCounts[type] = (errorTypeCounts[type] || 0) + 1
    }

    // En son failed scan'ler (UI hata blok'u için)
    const recentFailedScans = allScans
      .filter((s: any) => (s.scan_status || '').toLowerCase() === 'failed')
      .slice()
      .sort((a: any, b: any) => {
        const ta = a.scanned_at ? Date.parse(a.scanned_at) : 0
        const tb = b.scanned_at ? Date.parse(b.scanned_at) : 0
        return tb - ta
      })
      .slice(0, 20)
      .map((s: any) => {
        const err = typeof s.error_message === 'string' ? (s.error_message as string) : null
        const core = err && err.includes('|provider:') ? err.split('|provider:')[0] : err
        return {
          id: s.id,
          profile_id: s.profile_id,
          source_type: s.source_type,
          source_url: s.source_url,
          source_owner_type: s.source_owner_type,
          scanned_at: s.scanned_at,
          error_message: core,
          error_type: classifyErrorCore(core || ''),
        }
      })

    const kpis = {
      totalUsers,
      onboardingCompleted,
      onboardingPending,
      usersWithoutProfile,
      totalProfiles,
      intelligenceMissing,
      totalScans,
      failedScans,
      runningScans,
      completedScans,
      avgIntelConfidence,
      signups24h,
      signups7d,
      totalCompetitors: competitors.length,
      totalSources: allScans.length,
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
      errorTypeCounts,
      recentFailedScans,
      diagnostics,
      via: access.via,
    })
  } catch (e) {
    console.error('[admin/gozetim-merkezi] error:', e)
    const msg = e instanceof Error ? e.message : 'server_error'
    return NextResponse.json(
      { ok: false, error: 'server_error', message: msg, diagnostics },
      { status: 500 },
    )
  }
}
