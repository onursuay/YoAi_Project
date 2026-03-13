import { NextResponse } from 'next/server'
import { createMetaClient } from '@/lib/meta/client'

const DEBUG = process.env.NODE_ENV !== 'production'
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
    const { adId, status } = body

    if (DEBUG) {
      console.debug('[Ad Status Update] Request:', {
        adId,
        status,
        adAccountId: metaClient.accountId,
        timestamp: new Date().toISOString(),
      })
    }

    if (!adId || !status) {
      return NextResponse.json(
        { ok: false, error: 'invalid_input', message: 'adId and status are required' },
        { status: 400 }
      )
    }

    if (status !== 'ACTIVE' && status !== 'PAUSED') {
      return NextResponse.json(
        { ok: false, error: 'validation_error', message: 'status must be "ACTIVE" or "PAUSED"' },
        { status: 400 }
      )
    }

    const formData = new URLSearchParams()
    formData.append('status', status)

    const updateResult = await metaClient.client.postForm(`/${adId}`, formData)

    if (!updateResult.ok) {
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
          message: metaError?.message || 'Failed to update ad status',
        },
        { status: statusCode }
      )
    }

    const verifyResult = await metaClient.client.get(`/${adId}`, {
      fields: 'effective_status,status',
    })

    if (!verifyResult.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: 'meta_api_error',
          code: 'STATUS_VERIFICATION_FAILED',
          message: 'Status update may have failed - could not verify',
          meta: {
            code: verifyResult.error?.code,
            fbtraceId: verifyResult.error?.fbtrace_id,
          },
        },
        { status: 502 }
      )
    }

    const actualStatus = verifyResult.data?.effective_status ?? verifyResult.data?.status
    if (actualStatus !== status) {
      return NextResponse.json(
        {
          ok: false,
          error: 'validation_error',
          code: 'STATUS_NOT_APPLIED',
          message: `Status update failed: requested ${status}, but ad is ${actualStatus}`,
          details: { requested: status, actual: actualStatus },
        },
        { status: 400 }
      )
    }

    return NextResponse.json({
      ok: true,
      adId,
      status: actualStatus,
      data: verifyResult.data,
    }, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' }
    })
  } catch (error) {
    if (DEBUG) console.error('Ad status update error:', error)
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
