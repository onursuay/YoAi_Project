import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import {
  getProfileByUserId,
  listCompetitors,
  upsertProfile,
  insertSourceScans,
  deleteSourceScansForProfile,
  upsertIntelligence,
  type BusinessProfileRow,
  type BusinessCompetitorRow,
  type BusinessSourceScanRow,
} from '@/lib/yoai/businessProfileStore'
import { scanBusinessSources, type SourceScanInput, type SourceType } from '@/lib/yoai/businessSourceScanner'
import { buildBusinessIntelligenceRow } from '@/lib/yoai/businessIntelligenceBuilder'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * POST /api/yoai/business-profile/scan
 * Triggered automatically by the main business-profile POST route on every save.
 * This endpoint exists as a standalone caller for the same pipeline —
 * it deletes old scan records, re-scans all sources, rebuilds intelligence.
 * Manual "Tara" button does NOT exist in the UI; this is called programmatically only.
 */
export async function POST() {
  try {
    const cookieStore = await cookies()
    const userId = cookieStore.get('user_id')?.value
    if (!userId) {
      return NextResponse.json({ ok: false, error: 'Oturum gerekli' }, { status: 401 })
    }
    const profile = await getProfileByUserId(userId)
    if (!profile || !profile.id) {
      return NextResponse.json({ ok: false, error: 'profile_not_found' }, { status: 404 })
    }
    const competitors = await listCompetitors(userId)

    // Mark as running
    const running = await upsertProfile({
      ...profile,
      scan_status: 'running',
      intelligence_status: 'running',
      last_scan_started_at: new Date().toISOString(),
    })

    // Fire real scan — fire-and-forget so HTTP returns quickly
    runScan(running ?? profile, competitors).catch((e) =>
      console.warn('[scan/route] scan task failed (non-fatal):', e),
    )

    return NextResponse.json({ ok: true, data: { scan_status: 'running' } })
  } catch (e) {
    console.error('[scan/route] error:', e)
    return NextResponse.json({ ok: false, error: 'Sunucu hatası' }, { status: 500 })
  }
}

async function runScan(
  profile: BusinessProfileRow,
  competitors: BusinessCompetitorRow[],
): Promise<void> {
  if (!profile.id) return

  const ownInputs: SourceScanInput[] = []
  const pushOwn = (type: SourceType, url: string | null) => {
    if (url) ownInputs.push({ source_type: type, source_url: url })
  }
  pushOwn('website', profile.website_url)
  pushOwn('instagram', profile.instagram_url)
  pushOwn('facebook', profile.facebook_url)
  pushOwn('linkedin', profile.linkedin_url)
  pushOwn('youtube', profile.youtube_url)
  pushOwn('tiktok', profile.tiktok_url)
  pushOwn('google_business', profile.google_business_profile_url)
  pushOwn('marketplace', profile.marketplace_url)

  // Build competitor input lists synchronously before any await
  const compInputs: SourceScanInput[] = []
  const compIndex: { competitor_id: string }[] = []
  for (const comp of competitors) {
    const sources: { type: SourceType; url: string | null }[] = [
      { type: 'website', url: comp.website_url },
      { type: 'instagram', url: comp.instagram_url },
      { type: 'facebook', url: comp.facebook_url },
      { type: 'linkedin', url: comp.linkedin_url },
      { type: 'youtube', url: comp.youtube_url },
      { type: 'tiktok', url: comp.tiktok_url },
      { type: 'google_business', url: comp.google_business_url },
      { type: 'extra', url: comp.extra_url },
    ]
    for (const s of sources) {
      if (!s.url) continue
      compInputs.push({ source_type: s.type, source_url: s.url })
      compIndex.push({ competitor_id: comp.id || '' })
    }
  }

  // Run own brand + competitor scans in parallel — stays within Vercel 60s maxDuration
  const [ownOutputs, compOutputs] = await Promise.all([
    scanBusinessSources(ownInputs),
    scanBusinessSources(compInputs),
  ])

  const dbRows: Omit<BusinessSourceScanRow, 'id' | 'created_at'>[] = []
  ownOutputs.forEach((out) => {
    dbRows.push({
      user_id: profile.user_id,
      profile_id: profile.id!,
      competitor_id: null,
      source_owner_type: 'own_brand',
      source_type: out.source_type,
      source_url: out.source_url,
      scan_status: out.scan_status,
      raw_excerpt: out.raw_excerpt,
      extracted_title: out.extracted_title,
      extracted_description: out.extracted_description,
      extracted_services: out.extracted_services,
      extracted_products: out.extracted_products,
      extracted_keywords: out.extracted_keywords,
      extracted_audience: out.extracted_audience,
      extracted_locations: out.extracted_locations,
      extracted_ctas: out.extracted_ctas,
      extracted_brand_tone: out.extracted_brand_tone,
      extracted_offers: out.extracted_offers,
      extracted_social_proof: out.extracted_social_proof,
      confidence: out.confidence,
      error_message: out.error_message,
      scanned_at: out.scanned_at,
    })
  })
  compOutputs.forEach((out, idx) => {
    dbRows.push({
      user_id: profile.user_id,
      profile_id: profile.id!,
      competitor_id: compIndex[idx]?.competitor_id || null,
      source_owner_type: 'competitor',
      source_type: out.source_type,
      source_url: out.source_url,
      scan_status: out.scan_status,
      raw_excerpt: out.raw_excerpt,
      extracted_title: out.extracted_title,
      extracted_description: out.extracted_description,
      extracted_services: out.extracted_services,
      extracted_products: out.extracted_products,
      extracted_keywords: out.extracted_keywords,
      extracted_audience: out.extracted_audience,
      extracted_locations: out.extracted_locations,
      extracted_ctas: out.extracted_ctas,
      extracted_brand_tone: out.extracted_brand_tone,
      extracted_offers: out.extracted_offers,
      extracted_social_proof: out.extracted_social_proof,
      confidence: out.confidence,
      error_message: out.error_message,
      scanned_at: out.scanned_at,
    })
  })

  await deleteSourceScansForProfile(profile.id)
  await insertSourceScans(dbRows)

  const intelligence = buildBusinessIntelligenceRow(
    profile,
    competitors,
    dbRows.map((r, i) => ({ ...r, id: `scan_${i}` } as BusinessSourceScanRow)),
  )
  await upsertIntelligence({ ...intelligence, user_id: profile.user_id, profile_id: profile.id! })

  const ownCompleted = ownOutputs.filter((o) => o.scan_status === 'completed').length
  const compCompleted = compOutputs.filter((o) => o.scan_status === 'completed').length
  const totalScans = ownOutputs.length + compOutputs.length
  const completedScans = ownCompleted + compCompleted
  let scan_status: BusinessProfileRow['scan_status'] = 'completed'
  if (totalScans === 0) scan_status = 'failed'
  else if (completedScans === 0) scan_status = 'failed'
  else if (completedScans < totalScans) scan_status = 'partial'

  await upsertProfile({
    ...profile,
    scan_status,
    intelligence_status: 'completed',
    last_scan_completed_at: new Date().toISOString(),
  })
}
