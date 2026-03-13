import { NextResponse } from 'next/server'
import { createMetaClient } from '@/lib/meta/client'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const metaClient = await createMetaClient()
    if (!metaClient) {
      return NextResponse.json(
        { ok: false, error: 'missing_token', message: 'No access token or ad account selected' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { adId } = body

    if (!adId || typeof adId !== 'string') {
      return NextResponse.json(
        { ok: false, error: 'invalid_input', message: 'adId is required' },
        { status: 400 }
      )
    }

    const result = await metaClient.client.delete(`/${adId}`)

    if (!result.ok) {
      const metaError = result.error
      const statusCode =
        metaError?.code === 403 ? 403 :
        metaError?.code === 400 ? 400 :
        metaError?.code === 429 ? 429 : 502

      return NextResponse.json(
        {
          ok: false,
          error: metaError?.type === 'RateLimit' ? 'rate_limit_exceeded' :
                 metaError?.code === 403 ? 'permission_denied' :
                 'meta_api_error',
          message: metaError?.message || 'Failed to delete ad',
          meta: { code: metaError?.code, subcode: metaError?.subcode, fbtraceId: metaError?.fbtrace_id },
        },
        { status: statusCode }
      )
    }

    return NextResponse.json({ ok: true, adId }, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
    })
  } catch (error) {
    console.error('Ad delete error:', error)
    return NextResponse.json(
      { ok: false, error: 'server_error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
