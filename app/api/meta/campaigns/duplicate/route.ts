import { NextResponse } from 'next/server'
import { createMetaClient } from '@/lib/meta/client'

const DEBUG = process.env.NODE_ENV !== 'production'
export const dynamic = 'force-dynamic'

/**
 * POST /api/meta/campaigns/duplicate
 * Duplicates a campaign using Meta's /{campaign_id}/copies endpoint.
 * deep_copy=true also copies all child ad sets and ads.
 * The new campaign is created in PAUSED status.
 */
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
    const { campaignId } = body as { campaignId: string }

    if (!campaignId) {
      return NextResponse.json(
        { ok: false, error: 'invalid_input', message: 'campaignId zorunlu' },
        { status: 400 },
      )
    }

    // Try deep copy first (copies child adsets + ads too)
    const formData = new URLSearchParams()
    formData.append('deep_copy', 'true')
    formData.append('status_option', 'PAUSED')

    if (DEBUG) console.log('[Campaign Duplicate] Sending:', Object.fromEntries(formData))

    let result = await metaClient.client.postForm<{
      copied_campaign_id?: string
      ad_object_ids?: Array<{ source_id: string; copied_id: string }>
    }>(`/${campaignId}/copies`, formData)

    // If deep_copy fails, retry without it (shallow copy)
    if (!result.ok) {
      if (DEBUG) console.error('[Campaign Duplicate] Deep copy failed:', JSON.stringify(result.error, null, 2))

      const shallowData = new URLSearchParams()
      shallowData.append('status_option', 'PAUSED')

      if (DEBUG) console.log('[Campaign Duplicate] Retrying shallow copy...')
      result = await metaClient.client.postForm(`/${campaignId}/copies`, shallowData)
    }

    if (!result.ok) {
      if (DEBUG) console.error('[Campaign Duplicate] Meta API Error:', JSON.stringify(result.error, null, 2))
      return NextResponse.json(
        {
          ok: false,
          error: 'meta_api_error',
          message: result.error?.error_user_msg || result.error?.message || 'Kampanya kopyalanamadı',
          code: result.error?.code,
          subcode: result.error?.subcode,
        },
        { status: result.error?.code === 100 ? 400 : 502 },
      )
    }

    return NextResponse.json({
      ok: true,
      copiedCampaignId: result.data?.copied_campaign_id,
      adObjectIds: result.data?.ad_object_ids,
    })
  } catch (error) {
    if (DEBUG) console.error('[Campaign Duplicate] Error:', error)
    return NextResponse.json(
      { ok: false, error: 'server_error', message: error instanceof Error ? error.message : 'Sunucu hatası' },
      { status: 500 },
    )
  }
}
