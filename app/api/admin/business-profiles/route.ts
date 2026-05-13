/**
 * Süper admin — kullanıcıların business intelligence profillerini listeler.
 * Onboarding durumu, scan_status, intelligence summary, source coverage,
 * her kaynağın scan_status / scan_error / extracted alanları döner.
 *
 * Normal kullanıcılar bu endpoint'i göremez. Auth: ADMIN_SECRET header.
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { checkAdminAccess } from '@/lib/admin/superAdmin'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  // Erişim: ADMIN_SECRET header (manuel/internal) VEYA Gözetim Merkezi
  // yetkili oturum cookie'si. Yetkisiz çağrı admin alanının varlığını
  // ele vermeden 404 ile reddedilir.
  const access = await checkAdminAccess(req)
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }
  if (!supabase) {
    return NextResponse.json({ ok: false, error: 'supabase_unavailable' }, { status: 503 })
  }
  const { searchParams } = new URL(req.url)
  const userIdFilter = searchParams.get('user_id')
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10) || 50, 200)

  try {
    let profileQuery = supabase
      .from('user_business_profiles')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(limit)
    if (userIdFilter) {
      profileQuery = profileQuery.eq('user_id', userIdFilter)
    }
    const { data: profiles, error: profileErr } = await profileQuery
    if (profileErr) {
      return NextResponse.json({ ok: false, error: profileErr.message }, { status: 500 })
    }
    const userIds = (profiles || []).map((p: any) => p.user_id)
    const profileIds = (profiles || []).map((p: any) => p.id)

    // UUID kolonlu sorgularda boş array için sentinel ('__none__') Postgres
    // syntax error yapar; o yüzden boşken sorguyu atlıyoruz.
    const fetchCompetitors = userIds.length
      ? supabase.from('user_business_competitors').select('*').in('user_id', userIds)
      : Promise.resolve({ data: [] as any[], error: null })
    const fetchScans = profileIds.length
      ? supabase.from('user_business_source_scans').select('*').in('profile_id', profileIds)
      : Promise.resolve({ data: [] as any[], error: null })
    const fetchIntel = userIds.length
      ? supabase.from('user_business_intelligence').select('*').in('user_id', userIds)
      : Promise.resolve({ data: [] as any[], error: null })

    const [competitorsRes, scansRes, intelRes] = await Promise.all([fetchCompetitors, fetchScans, fetchIntel])
    const competitors = (competitorsRes as any).data || []
    const scans = (scansRes as any).data || []
    const intelligence = (intelRes as any).data || []

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
    for (const i of intelligence) {
      intelByUser.set(i.user_id, i)
    }

    const enriched = (profiles || []).map((p: any) => {
      const profileScans = scanByProfile.get(p.id) || []
      // Süper admin görünürlüğü: her scan'in provider/hata özetini ayrı bir
      // alanda da yaymak — UI ham scan'i de görür, normalize özet de görür.
      const scanSummary = profileScans.map((s: any) => {
        const err = typeof s.error_message === 'string' ? (s.error_message as string) : null
        let providerUsed: string | null = null
        let errorCore: string | null = err
        if (err && err.includes('|provider:')) {
          const [core, providerPart] = err.split('|provider:')
          errorCore = core
          providerUsed = providerPart || null
        }
        return {
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
      return {
        profile: p,
        competitors: compByUser.get(p.user_id) || [],
        sourceScans: profileScans,
        sourceScansSummary: scanSummary,
        intelligence: intelByUser.get(p.user_id) || null,
      }
    })

    return NextResponse.json({ ok: true, count: enriched.length, data: enriched })
  } catch (e) {
    console.error('[admin/business-profiles] error:', e)
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 })
  }
}
