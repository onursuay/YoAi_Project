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
    const adId = searchParams.get('adId')

    if (!adId) {
      return NextResponse.json(
        { ok: false, error: 'invalid_input', message: 'adId zorunlu' },
        { status: 400 }
      )
    }

    const result = await metaClient.client.request('GET', `/${adId}`, undefined, {
      fields: 'id,name,status,effective_status,adset_id,campaign_id,creative{id,name,object_story_spec,asset_feed_spec,thumbnail_url}',
    })

    if (!result.ok) {
      const metaError = result.error
      if (DEBUG) console.error('[Ad Details] Meta API Error:', JSON.stringify(metaError, null, 2))
      return NextResponse.json(
        {
          ok: false,
          error: 'meta_api_error',
          message: 'Mevcut reklam bilgileri alınamadı',
          code: metaError?.code ?? 500,
          subcode: metaError?.error_subcode ?? metaError?.subcode,
          fbtrace_id: metaError?.fbtrace_id,
          meta_error: metaError,
        },
        { status: 400 }
      )
    }

    // Normalize creative → UI form fields (object_story_spec + asset_feed_spec)
    const ad = result.data
    const creative = ad?.creative ?? {}
    const oss = creative.object_story_spec ?? {}
    const ld = oss.link_data ?? {}
    const vd = oss.video_data ?? {}
    const td = oss.template_data ?? {}
    const afs = creative.asset_feed_spec

    let primaryText = ld.message || vd.message || td.message || ''
    let headline = ld.name || vd.title || ''
    let description = ld.description || vd.description || td.description || ''
    let websiteUrl = ld.link || vd.call_to_action?.value?.link || ''
    let cta = ld.call_to_action?.type || vd.call_to_action?.type || ''

    // asset_feed_spec fallback (Advantage+ creative vb.)
    if (afs) {
      primaryText = primaryText || afs.bodies?.[0]?.text || ''
      headline = headline || afs.titles?.[0]?.text || ''
      description = description || afs.descriptions?.[0]?.text || ''
      websiteUrl = websiteUrl || afs.link_urls?.[0]?.website_url || ''
      cta = cta || afs.call_to_action_types?.[0] || ''
    }

    const form = {
      adName: ad?.name ?? '',
      primaryText,
      headline,
      description,
      websiteUrl,
      cta,
    }

    const existingLeadGenId =
      ld?.call_to_action?.value?.lead_gen_form_id ||
      vd?.call_to_action?.value?.lead_gen_form_id ||
      afs?.call_to_actions?.[0]?.value?.lead_gen_form_id

    // Düzenlenebilir creative tipleri:
    // 1. asset_feed_spec (Advantage+ Creative) → düzenlenebilir
    // 2. object_story_spec ile link_data veya video_data → düzenlenebilir
    // Düzenlenemez:
    // 1. Lead gen form → karmaşık yapı
    // 2. Boosted post (hiçbir editable spec yok) → organik post içeriği değiştirilemez
    const hasEditableSpec = !!afs || !!ld?.link || !!vd?.video_id
    const canEditCreative = hasEditableSpec && !existingLeadGenId
    const editCapabilities = {
      canEditName: true,
      canEditCreative,
      reason: !canEditCreative
        ? (existingLeadGenId ? 'Lead Gen form' : 'Post promoted reklam — içerik düzenlenemez')
        : undefined,
    }

    return NextResponse.json({
      ok: true,
      ad,
      form,
      editCapabilities,
    }, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' }
    })
  } catch (error) {
    if (DEBUG) console.error('Ad details error:', error)
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
