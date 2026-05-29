import { NextResponse } from 'next/server'
import { checkMarketingSetupAccess } from '@/lib/marketing-setup/guard'
import { getOrCreateSetup, updateSetup } from '@/lib/marketing-setup/setupStore'
import { scanSite } from '@/lib/marketing-setup/siteScanner'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/marketing-setup/scan
 * Body: { siteUrl: string }
 * Scans the site with Firecrawl, persists the result, and returns it.
 * Never fabricates a scan — a scan failure returns { ok:false, error } (HTTP 200)
 * so the wizard can surface the real reason.
 */
export async function POST(request: Request) {
  const access = await checkMarketingSetupAccess()
  if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: access.status })
  const user = access.user

  let siteUrl = ''
  try {
    const body = (await request.json()) as { siteUrl?: string }
    siteUrl = (body?.siteUrl ?? '').trim()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })
  }

  if (!siteUrl) {
    return NextResponse.json({ ok: false, error: 'missing_site_url' }, { status: 400 })
  }

  // Ensure a setup row exists (also stores the entered site URL early).
  await getOrCreateSetup(user.id, siteUrl)

  try {
    const scan = await scanSite(siteUrl)
    await updateSetup(user.id, { site_scan_result: scan, site_url: siteUrl })
    return NextResponse.json({ ok: true, scan })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'scan_failed'
    console.error('MARKETING_SETUP_SCAN_FAIL', message)
    return NextResponse.json({ ok: false, error: message })
  }
}
