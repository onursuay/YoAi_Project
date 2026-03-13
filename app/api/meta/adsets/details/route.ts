import { NextResponse } from 'next/server'
import { createMetaClient } from '@/lib/meta/client'

const DEBUG = process.env.NODE_ENV !== 'production'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const metaClient = await createMetaClient()
    if (!metaClient) {
      return NextResponse.json(
        { ok: false, error: 'missing_token', message: 'Meta bağlantısı bulunamadı' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const adsetId = searchParams.get('adsetId')

    if (!adsetId) {
      return NextResponse.json(
        { ok: false, error: 'invalid_input', message: 'adsetId zorunlu' },
        { status: 400 }
      )
    }

    const result = await metaClient.client.request('GET', `/${adsetId}`, undefined, {
      fields: 'name,targeting,daily_budget,lifetime_budget,start_time,end_time,optimization_goal,billing_event,status',
    })

    if (!result.ok) {
      if (DEBUG) console.error('[AdSet Details] Meta API Error:', JSON.stringify(result.error, null, 2))
      return NextResponse.json(
        {
          ok: false,
          error: 'meta_api_error',
          message: result.error?.message || 'Reklam seti bilgileri alınamadı',
          code: result.error?.code,
        },
        { status: 502 }
      )
    }

    return NextResponse.json({
      ok: true,
      data: result.data,
    }, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' }
    })
  } catch (error) {
    if (DEBUG) console.error('AdSet details error:', error)
    return NextResponse.json(
      {
        ok: false,
        error: 'server_error',
        message: 'Sunucu hatası',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
