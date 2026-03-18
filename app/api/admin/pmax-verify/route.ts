/**
 * Admin-only: Post-create parity verification for Performance Max.
 * GET with x-admin-secret header and query params: campaignResourceName, assetGroupResourceName.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getGoogleAdsContextForAdmin } from '@/lib/googleAdsAuth'
import { verifyPmaxCreated } from '@/lib/google-ads/verify-pmax-created'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const adminSecret = process.env.ADMIN_SECRET
  if (!adminSecret?.trim()) {
    return NextResponse.json({ ok: false, code: 'admin_secret_missing' }, { status: 503 })
  }
  const headerSecret = req.headers.get('x-admin-secret')
  if (headerSecret !== adminSecret) {
    return NextResponse.json({ ok: false, code: 'unauthorized' }, { status: 401 })
  }

  const campaignResourceName = req.nextUrl.searchParams.get('campaignResourceName')
  const assetGroupResourceName = req.nextUrl.searchParams.get('assetGroupResourceName')
  if (!campaignResourceName || !assetGroupResourceName) {
    return NextResponse.json(
      { error: 'campaignResourceName and assetGroupResourceName required' },
      { status: 400 }
    )
  }

  try {
    const ctx = await getGoogleAdsContextForAdmin()
    const result = await verifyPmaxCreated(ctx, campaignResourceName, assetGroupResourceName)
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    console.error('[pmax-verify]', e)
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
