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
    const { adSetId, name } = body

    if (!adSetId || !name) {
      return NextResponse.json(
        { ok: false, error: 'invalid_input', message: 'adSetId and name are required' },
        { status: 400 }
      )
    }

    // Validate name
    const trimmedName = name.trim()
    if (trimmedName.length < 1) {
      return NextResponse.json(
        { ok: false, error: 'validation_error', message: 'Ad set name cannot be empty' },
        { status: 400 }
      )
    }

    if (trimmedName.length > 256) {
      return NextResponse.json(
        { ok: false, error: 'validation_error', message: 'Ad set name is too long (max 256 characters)' },
        { status: 400 }
      )
    }

    const formData = new URLSearchParams()
    formData.append('name', trimmedName)

    const result = await metaClient.client.postForm(`/${adSetId}`, formData)

    if (!result.ok) {
      const status = result.error?.code === 403 ? 403 :
                     result.error?.code === 400 ? 400 :
                     result.error?.code === 429 ? 429 : 502

      return NextResponse.json(
        {
          ok: false,
          error: result.error?.type === 'RateLimit' ? 'rate_limit_exceeded' :
                 result.error?.code === 403 ? 'permission_denied' :
                 result.error?.code === 400 ? 'validation_error' :
                 'meta_api_error',
          message: result.error?.message || 'Failed to rename ad set',
          code: result.error?.code,
          subcode: result.error?.subcode,
          fbtrace_id: result.error?.fbtrace_id,
        },
        { status }
      )
    }

    return NextResponse.json({
      ok: true,
      adSetId,
      name: trimmedName,
      data: result.data,
    }, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' }
    })
  } catch (error) {
    console.error('Ad set rename error:', error)
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
