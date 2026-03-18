import { NextResponse } from 'next/server'
import { getGoogleAdsContext } from '@/lib/googleAdsAuth'
import { listConversionActionsForWizard } from '@/lib/google-ads/conversion-actions'

export async function GET() {
  try {
    const ctx = await getGoogleAdsContext()
    const conversionActions = await listConversionActionsForWizard(ctx)
    return NextResponse.json(
      { conversionActions },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message ?? 'Failed to fetch conversion actions' },
      { status: e.status ?? 500 }
    )
  }
}
