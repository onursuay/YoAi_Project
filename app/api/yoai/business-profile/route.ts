import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import {
  getProfileByUserId,
  upsertProfile,
  listCompetitors,
  replaceCompetitors,
  validateProfileForOnboarding,
  insertSourceScans,
  upsertIntelligence,
  type BusinessProfileRow,
  type BusinessCompetitorRow,
  type BusinessSourceScanRow,
} from '@/lib/yoai/businessProfileStore'
import { scanBusinessSources, type SourceScanInput, type SourceType } from '@/lib/yoai/businessSourceScanner'
import { buildBusinessIntelligenceRow } from '@/lib/yoai/businessIntelligenceBuilder'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

type ProfileFormBody = {
  company_name: string
  sector_main?: string | null
  sector_sub?: string | null
  specialization?: string | null
  business_description?: string | null
  main_conversion_goal?: string | null
  target_locations?: string[]
  target_audience?: string | null
  website_url?: string | null
  instagram_url?: string | null
  facebook_url?: string | null
  linkedin_url?: string | null
  youtube_url?: string | null
  tiktok_url?: string | null
  google_business_profile_url?: string | null
  marketplace_url?: string | null
  keywords?: string[]
  products_or_services?: string[]
  most_profitable_services?: string[]
  monthly_ad_budget_range?: string | null
  brand_tone?: string | null
  forbidden_claims?: string[]
  compliance_notes?: string | null
  extra_notes?: string | null
  competitors?: Array<{
    competitor_name?: string
    name?: string | null
    website_url?: string | null
    competitor_website_url?: string | null
    instagram_url?: string | null
    facebook_url?: string | null
    linkedin_url?: string | null
    youtube_url?: string | null
    tiktok_url?: string | null
    google_business_url?: string | null
    google_business?: string | null
    google_business_profile_url?: string | null
    extra_url?: string | null
  }>
}

function emptyToNull(v: string | null | undefined): string | null {
  if (v === null || v === undefined) return null
  const t = v.trim()
  return t.length > 0 ? t : null
}

function arr(v: string[] | undefined | null): string[] {
  if (!Array.isArray(v)) return []
  return v.map((s) => (typeof s === 'string' ? s.trim() : '')).filter(Boolean)
}

export async function GET() {
  try {
    const cookieStore = await cookies()
    const userId = cookieStore.get('user_id')?.value
    if (!userId) {
      return NextResponse.json({ ok: false, error: 'Oturum gerekli' }, { status: 401 })
    }
    const profile = await getProfileByUserId(userId)
    const competitors = profile ? await listCompetitors(userId) : []
    return NextResponse.json({
      ok: true,
      data: {
        profile,
        competitors,
        onboarding_completed: !!profile?.onboarding_completed,
      },
    })
  } catch (e) {
    console.error('[business-profile GET] error:', e)
    return NextResponse.json({ ok: false, error: 'Sunucu hatası' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies()
    const userId = cookieStore.get('user_id')?.value
    if (!userId) {
      return NextResponse.json({ ok: false, error: 'Oturum gerekli' }, { status: 401 })
    }
    const body = (await request.json()) as ProfileFormBody

    const competitorsInput = (body.competitors || []).map((c) => ({
      competitor_name: (c.competitor_name || c.name || '').trim(),
      website_url: emptyToNull(c.website_url ?? c.competitor_website_url),
      instagram_url: emptyToNull(c.instagram_url),
      facebook_url: emptyToNull(c.facebook_url),
      linkedin_url: emptyToNull(c.linkedin_url),
      youtube_url: emptyToNull(c.youtube_url),
      tiktok_url: emptyToNull(c.tiktok_url),
      google_business_url: emptyToNull(c.google_business_url ?? c.google_business ?? c.google_business_profile_url),
      extra_url: emptyToNull(c.extra_url),
    }))

    const profilePayload: BusinessProfileRow = {
      user_id: userId,
      company_name: (body.company_name || '').trim(),
      sector_main: emptyToNull(body.sector_main),
      sector_sub: emptyToNull(body.sector_sub),
      specialization: emptyToNull(body.specialization),
      business_description: emptyToNull(body.business_description),
      main_conversion_goal: emptyToNull(body.main_conversion_goal),
      target_locations: arr(body.target_locations),
      target_audience: emptyToNull(body.target_audience),
      website_url: emptyToNull(body.website_url),
      instagram_url: emptyToNull(body.instagram_url),
      facebook_url: emptyToNull(body.facebook_url),
      linkedin_url: emptyToNull(body.linkedin_url),
      youtube_url: emptyToNull(body.youtube_url),
      tiktok_url: emptyToNull(body.tiktok_url),
      google_business_profile_url: emptyToNull(body.google_business_profile_url),
      marketplace_url: emptyToNull(body.marketplace_url),
      keywords: arr(body.keywords),
      products_or_services: arr(body.products_or_services),
      most_profitable_services: arr(body.most_profitable_services),
      monthly_ad_budget_range: emptyToNull(body.monthly_ad_budget_range),
      brand_tone: emptyToNull(body.brand_tone),
      forbidden_claims: arr(body.forbidden_claims),
      compliance_notes: emptyToNull(body.compliance_notes),
      extra_notes: emptyToNull(body.extra_notes),
      onboarding_completed: false,
      profile_confidence: 0,
      scan_status: 'pending',
      intelligence_status: 'pending',
    }

    const validation = validateProfileForOnboarding(profilePayload, competitorsInput)
    if (!validation.ok) {
      return NextResponse.json(
        { ok: false, error: 'validation_failed', errors: validation.errors },
        { status: 400 },
      )
    }

    // Confidence: filled fields + competitor count
    const filled = [
      profilePayload.company_name,
      profilePayload.sector_main,
      profilePayload.business_description,
      profilePayload.main_conversion_goal,
      profilePayload.target_audience,
      profilePayload.website_url,
      profilePayload.brand_tone,
    ].filter((v) => typeof v === 'string' && v.trim().length > 0).length
    const competitorBonus = Math.min(20, competitorsInput.length * 5)
    profilePayload.profile_confidence = Math.min(100, 30 + filled * 5 + competitorBonus)
    profilePayload.onboarding_completed = true
    profilePayload.scan_status = 'running'
    profilePayload.intelligence_status = 'running'
    profilePayload.last_scan_started_at = new Date().toISOString()

    let upserted: Awaited<ReturnType<typeof upsertProfile>>
    try {
      upserted = await upsertProfile(profilePayload)
    } catch (dbErr) {
      const msg = dbErr instanceof Error ? dbErr.message : String(dbErr)
      console.error('[business-profile POST] upsertProfile threw:', msg)
      return NextResponse.json({ ok: false, error: 'profile_save_failed', detail: msg }, { status: 500 })
    }
    if (!upserted || !upserted.id) {
      return NextResponse.json({ ok: false, error: 'profile_save_failed', detail: 'no_id_returned' }, { status: 500 })
    }

    const competitors = await replaceCompetitors(userId, upserted.id, competitorsInput.map((c) => ({
      ...c,
      scan_status: 'pending' as const,
      scan_error: null,
      confidence: 0,
    })))

    // Schedule scans synchronously (fire-and-forget for HTTP timing)
    runProfileScansAndIntelligence(upserted, competitors).catch((e) =>
      console.warn('[business-profile POST] scan task failed (non-fatal):', e),
    )

    return NextResponse.json({
      ok: true,
      data: {
        profile: upserted,
        competitors,
      },
    })
  } catch (e) {
    console.error('[business-profile POST] error:', e)
    return NextResponse.json({ ok: false, error: 'Sunucu hatası' }, { status: 500 })
  }
}

async function runProfileScansAndIntelligence(
  profile: BusinessProfileRow,
  competitors: BusinessCompetitorRow[],
): Promise<void> {
  if (!profile.id) return

  const ownInputs: { input: SourceScanInput; type: SourceType }[] = []
  const pushOwn = (type: SourceType, url: string | null) => {
    if (!url) return
    ownInputs.push({ input: { source_type: type, source_url: url }, type })
  }
  pushOwn('website', profile.website_url)
  pushOwn('instagram', profile.instagram_url)
  pushOwn('facebook', profile.facebook_url)
  pushOwn('linkedin', profile.linkedin_url)
  pushOwn('youtube', profile.youtube_url)
  pushOwn('tiktok', profile.tiktok_url)
  pushOwn('google_business', profile.google_business_profile_url)
  pushOwn('marketplace', profile.marketplace_url)

  const ownOutputs = await scanBusinessSources(ownInputs.map((o) => o.input))

  const competitorScanRows: SourceScanInput[] = []
  const competitorScanIndex: { competitor_id: string }[] = []
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
      competitorScanRows.push({ source_type: s.type, source_url: s.url })
      competitorScanIndex.push({ competitor_id: comp.id || '' })
    }
  }
  const competitorOutputs = await scanBusinessSources(competitorScanRows)

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
  competitorOutputs.forEach((out, idx) => {
    dbRows.push({
      user_id: profile.user_id,
      profile_id: profile.id!,
      competitor_id: competitorScanIndex[idx]?.competitor_id || null,
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

  await insertSourceScans(dbRows)

  // Intelligence build & save
  const intelligence = buildBusinessIntelligenceRow(
    profile,
    competitors,
    dbRows.map((r, i) => ({ ...r, id: `scan_${i}` } as BusinessSourceScanRow)),
  )
  await upsertIntelligence({
    ...intelligence,
    user_id: profile.user_id,
    profile_id: profile.id!,
  })

  // Update profile scan/intelligence status
  const ownCompleted = ownOutputs.filter((o) => o.scan_status === 'completed').length
  const competitorCompleted = competitorOutputs.filter((o) => o.scan_status === 'completed').length
  const totalScans = ownOutputs.length + competitorOutputs.length
  const completedScans = ownCompleted + competitorCompleted
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
