import { NextResponse } from 'next/server'
import { createMetaClient } from '@/lib/meta/client'

const DEBUG = process.env.NODE_ENV !== 'production'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const metaClient = await createMetaClient()
    if (!metaClient) {
      return NextResponse.json(
        { ok: false, error: 'missing_token', message: 'Meta bağlantısı bulunamadı' },
        { status: 401 },
      )
    }

    const body = await request.json()
    const { adId } = body as { adId: string }

    if (!adId) {
      return NextResponse.json(
        { ok: false, error: 'invalid_input', message: 'adId zorunlu' },
        { status: 400 },
      )
    }

    const formData = new URLSearchParams()
    formData.append('status_option', 'PAUSED')
    formData.append('rename_options', JSON.stringify({ rename_suffix: ' (Kopya)' }))

    if (DEBUG) console.log('[Ad Duplicate] Sending:', Object.fromEntries(formData))

    const result = await metaClient.client.postForm<{
      copied_ad_id?: string
    }>(`/${adId}/copies`, formData)

    if (!result.ok) {
      if (DEBUG) console.error('[Ad Duplicate] Meta API Error:', JSON.stringify(result.error, null, 2))
      return NextResponse.json(
        {
          ok: false,
          error: 'meta_api_error',
          message: result.error?.error_user_msg || result.error?.message || 'Reklam kopyalanamadı',
          code: result.error?.code,
          subcode: result.error?.subcode,
        },
        { status: result.error?.code === 100 ? 400 : 502 },
      )
    }

    return NextResponse.json({
      ok: true,
      copiedAdId: result.data?.copied_ad_id,
    })
  } catch (error) {
    if (DEBUG) console.error('[Ad Duplicate] Error:', error)
    return NextResponse.json(
      { ok: false, error: 'server_error', message: error instanceof Error ? error.message : 'Sunucu hatası' },
      { status: 500 },
    )
  }
}
