import { NextResponse } from 'next/server'
import { getUsdTryRate } from '@/lib/fx/usdTry'

export const dynamic = 'force-dynamic'

/**
 * GET /api/fx/usdtry
 * Returns USD/TRY rate. Uses centralized lib/fx/usdTry (15 min cache, env fallback).
 */
export async function GET() {
  const result = await getUsdTryRate()
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, message: 'USD/TRY rate could not be resolved' },
      { status: 500 }
    )
  }
  return NextResponse.json({
    rate: result.rate,
    fetchedAt: result.fetchedAt,
    source: result.source,
  })
}
