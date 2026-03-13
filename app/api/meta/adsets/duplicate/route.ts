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
    const { adsetId, renameSuffix } = body as { adsetId: string; renameSuffix?: string }

    if (!adsetId) {
      return NextResponse.json(
        { ok: false, error: 'invalid_input', message: 'adsetId zorunlu' },
        { status: 400 },
      )
    }

    const formData = new URLSearchParams()
    formData.append('deep_copy', 'true')
    formData.append('status_option', 'PAUSED')
    formData.append('rename_options', JSON.stringify({ rename_suffix: renameSuffix ? ` ${renameSuffix}` : ' (Kopya)' }))

    if (DEBUG) console.log('[AdSet Duplicate] Sending:', Object.fromEntries(formData))

    let result = await metaClient.client.postForm<{
      copied_adset_id?: string
      ad_object_ids?: Array<{ source_id: string; copied_id: string }>
    }>(`/${adsetId}/copies`, formData)

    // If deep_copy fails, retry without it
    if (!result.ok) {
      if (DEBUG) console.error('[AdSet Duplicate] Deep copy failed:', JSON.stringify(result.error, null, 2))
      const shallowData = new URLSearchParams()
      shallowData.append('status_option', 'PAUSED')
      shallowData.append('rename_options', JSON.stringify({ rename_suffix: renameSuffix ? ` ${renameSuffix}` : ' (Kopya)' }))
      result = await metaClient.client.postForm(`/${adsetId}/copies`, shallowData)
    }

    if (!result.ok) {
      if (DEBUG) console.error('[AdSet Duplicate] Meta API Error:', JSON.stringify(result.error, null, 2))
      return NextResponse.json(
        {
          ok: false,
          error: 'meta_api_error',
          message: result.error?.error_user_msg || result.error?.message || 'Reklam seti kopyalanamadı',
          code: result.error?.code,
          subcode: result.error?.subcode,
        },
        { status: result.error?.code === 100 ? 400 : 502 },
      )
    }

    return NextResponse.json({
      ok: true,
      copiedAdsetId: result.data?.copied_adset_id,
      adObjectIds: result.data?.ad_object_ids,
    })
  } catch (error) {
    if (DEBUG) console.error('[AdSet Duplicate] Error:', error)
    return NextResponse.json(
      { ok: false, error: 'server_error', message: error instanceof Error ? error.message : 'Sunucu hatası' },
      { status: 500 },
    )
  }
}
