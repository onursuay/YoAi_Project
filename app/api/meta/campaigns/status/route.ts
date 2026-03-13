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
    const { campaignId, status } = body

    // Debug logging (dev mode)
    if (process.env.NODE_ENV === 'development') {
      console.debug('[Campaign Status Update] Request:', {
        campaignId,
        status,
        adAccountId: metaClient.accountId,
        timestamp: new Date().toISOString(),
      })
    }

    if (!campaignId || !status) {
      return NextResponse.json(
        { ok: false, error: 'invalid_input', message: 'campaignId and status are required' },
        { status: 400 }
      )
    }

    if (status !== 'ACTIVE' && status !== 'PAUSED') {
      return NextResponse.json(
        { ok: false, error: 'validation_error', message: 'status must be "ACTIVE" or "PAUSED"' },
        { status: 400 }
      )
    }

    // Update campaign status via Meta Graph API
    const formData = new URLSearchParams()
    formData.append('status', status)

    const updateResult = await metaClient.client.postForm(`/${campaignId}`, formData)

    if (!updateResult.ok) {
      // Parse Meta error response
      const metaError = updateResult.error
      const statusCode = metaError?.code === 403 ? 403 :
                         metaError?.code === 400 ? 400 :
                         metaError?.code === 429 ? 429 : 502

      return NextResponse.json(
        {
          ok: false,
          error: metaError?.type === 'RateLimit' ? 'rate_limit_exceeded' :
                 metaError?.code === 403 ? 'permission_denied' :
                 metaError?.code === 400 ? 'validation_error' :
                 'meta_api_error',
          code: 'META_API_ERROR',
          meta: {
            code: metaError?.code,
            subcode: metaError?.subcode,
            userMessage: metaError?.message,
            fbtraceId: metaError?.fbtrace_id,
          },
          message: metaError?.message || 'Failed to update campaign status',
        },
        { status: statusCode }
      )
    }

    // Success: Meta accepted the status update
    return NextResponse.json({
      ok: true,
      campaignId,
      status: status,
    }, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' }
    })
  } catch (error) {
    console.error('Campaign status update error:', error)
    return NextResponse.json(
      {
        ok: false,
        error: 'server_error',
        message: 'Server error occurred',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
