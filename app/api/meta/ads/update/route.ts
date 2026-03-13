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
        { status: 401 }
      )
    }

    const body = await request.json()
    const { adId, name, creative } = body

    if (DEBUG) console.log('[Ad Update] Incoming:', JSON.stringify(body, null, 2))

    if (!adId) {
      return NextResponse.json(
        { ok: false, error: 'invalid_input', message: 'adId zorunlu' },
        { status: 400 }
      )
    }

    // 1. Mevcut reklamı al (status, effective_status dahil — güncelleme sırasında korunacak)
    const adResult = await metaClient.client.get(`/${adId}`, {
      fields: 'name,status,effective_status,creative{id,object_story_spec,asset_feed_spec}',
    })

    if (!adResult.ok) {
      const metaError = adResult.error
      if (DEBUG) console.error('[Ad Update] Ad lookup error:', JSON.stringify(metaError, null, 2))
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

    const currentAd = adResult.data
    const currentCreative = currentAd?.creative ?? {}
    const assetFeedSpec = currentCreative.asset_feed_spec
    const objectStorySpec = currentCreative.object_story_spec
    // Status fallback: Meta dönmezse ACTIVE varsay — PAUSED'a düşmeyi engelle
    const preservedStatus = currentAd.status || 'ACTIVE'
    const preservedEffectiveStatus = currentAd.effective_status || preservedStatus

    if (DEBUG) console.log('[Ad Update] Current status:', preservedStatus, '| hasAssetFeed:', !!assetFeedSpec, '| hasObjectStory:', !!objectStorySpec)

    // 2. Mevcut değerleri çıkar
    let currentPrimaryText = ''
    let currentHeadline = ''
    let currentDescription = ''
    let currentWebsiteUrl = ''
    let currentCta = 'LEARN_MORE'

    if (assetFeedSpec) {
      currentPrimaryText = assetFeedSpec.bodies?.[0]?.text || ''
      currentHeadline = assetFeedSpec.titles?.[0]?.text || ''
      currentDescription = assetFeedSpec.descriptions?.[0]?.text || ''
      currentWebsiteUrl = assetFeedSpec.link_urls?.[0]?.website_url || ''
      currentCta = assetFeedSpec.call_to_action_types?.[0] || 'LEARN_MORE'
    } else if (objectStorySpec?.link_data) {
      currentPrimaryText = objectStorySpec.link_data.message || ''
      currentHeadline = objectStorySpec.link_data.name || ''
      currentDescription = objectStorySpec.link_data.description || ''
      currentWebsiteUrl = objectStorySpec.link_data.link || ''
      currentCta = objectStorySpec.link_data.call_to_action?.type || 'LEARN_MORE'
    } else if (objectStorySpec?.video_data) {
      currentPrimaryText = objectStorySpec.video_data.message || ''
      currentHeadline = objectStorySpec.video_data.title || ''
      currentDescription = objectStorySpec.video_data.link_description || ''
      currentWebsiteUrl = objectStorySpec.video_data.call_to_action?.value?.link || ''
      currentCta = objectStorySpec.video_data.call_to_action?.type || 'LEARN_MORE'
    }

    // Lead gen form ID'yi erken tespit et (asset_feed_spec ve lead_gen kontrollerinde kullanılacak)
    const existingLeadGenId =
      objectStorySpec?.link_data?.call_to_action?.value?.lead_gen_form_id ||
      objectStorySpec?.video_data?.call_to_action?.value?.lead_gen_form_id ||
      assetFeedSpec?.call_to_actions?.[0]?.value?.lead_gen_form_id

    // 3. Neyin değiştiğini tespit et
    const nameChanged = name !== undefined && name !== currentAd.name
    const primaryTextChanged = creative?.primaryText !== undefined && creative.primaryText !== currentPrimaryText
    const headlineChanged = creative?.headline !== undefined && creative.headline !== currentHeadline
    const descriptionChanged = creative?.description !== undefined && creative.description !== currentDescription
    const websiteUrlChanged = creative?.websiteUrl !== undefined && creative.websiteUrl !== currentWebsiteUrl
    const ctaChanged = creative?.callToAction !== undefined && creative.callToAction !== currentCta

    const creativeChanged = primaryTextChanged || headlineChanged || descriptionChanged || websiteUrlChanged || ctaChanged

    if (DEBUG) {
      console.log('[Ad Update] Change detection:', { nameChanged, primaryTextChanged, headlineChanged, descriptionChanged, websiteUrlChanged, ctaChanged })
      console.log('[Ad Update] Lead gen:', !!existingLeadGenId, '| assetFeed:', !!assetFeedSpec)
    }

    // 4. Hiçbir şey değişmediyse
    if (!nameChanged && !creativeChanged) {
      return NextResponse.json({
        ok: true,
        adId,
        message: 'Değişiklik yok',
        status: preservedStatus,
        effective_status: preservedEffectiveStatus,
      }, {
        headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' }
      })
    }

    // 5. Sadece name değiştiyse — direkt güncelle (status KESİNLİKLE korunur)
    if (nameChanged && !creativeChanged) {
      const payload = new URLSearchParams()
      payload.append('name', String(name).trim())
      payload.append('status', preservedStatus)

      const result = await metaClient.client.postForm(`/${adId}`, payload)
      if (!result.ok) {
        if (DEBUG) console.error('[Ad Update] Name update error:', JSON.stringify(result.error, null, 2))
        return NextResponse.json(
          {
            ok: false,
            error: 'meta_api_error',
            message: result.error?.message || 'Reklam adı güncellenemedi',
            code: result.error?.code,
            meta_error: result.error,
          },
          { status: 502 }
        )
      }

      return NextResponse.json({
        ok: true,
        adId,
        message: 'Reklam adı güncellendi',
        nameUpdated: true,
        creativeUpdated: false,
        status: preservedStatus,
        effective_status: preservedEffectiveStatus,
        data: result.data,
      }, {
        headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' }
      })
    }

    // 6. Lead gen form varsa → creative düzenlenemez
    if (existingLeadGenId && creativeChanged) {
      if (DEBUG) console.log('[Ad Update] Lead gen form detected — creative update blocked')
      if (nameChanged) {
        const payload = new URLSearchParams()
        payload.append('name', String(name).trim())
        payload.append('status', preservedStatus)
        const result = await metaClient.client.postForm(`/${adId}`, payload)
        if (!result.ok) {
          return NextResponse.json(
            { ok: false, error: 'meta_api_error', message: result.error?.message || 'Reklam güncellenemedi', meta_error: result.error },
            { status: 502 }
          )
        }
        return NextResponse.json({
          ok: true, adId,
          message: 'Lead Gen reklam — sadece ad ismi güncellendi.',
          nameUpdated: true, creativeUpdated: false, warning: 'creative_not_editable',
          status: preservedStatus, effective_status: preservedEffectiveStatus, data: result.data,
        }, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } })
      }
      return NextResponse.json(
        { ok: false, error: 'creative_not_editable', message: 'Lead Gen reklam — içerik düzenlemesi desteklenmiyor.' },
        { status: 400 }
      )
    }

    // 6b. Boosted post kontrolü — ne asset_feed_spec ne de link/video data varsa → düzenlenemez
    const hasEditableSpec = !!assetFeedSpec || !!objectStorySpec?.link_data || !!objectStorySpec?.video_data
    if (!hasEditableSpec && creativeChanged) {
      if (DEBUG) console.log('[Ad Update] Boosted post / unsupported creative — creative update blocked')
      if (nameChanged) {
        const payload = new URLSearchParams()
        payload.append('name', String(name).trim())
        payload.append('status', preservedStatus)
        const result = await metaClient.client.postForm(`/${adId}`, payload)
        if (!result.ok) {
          return NextResponse.json(
            { ok: false, error: 'meta_api_error', message: result.error?.message || 'Reklam güncellenemedi', meta_error: result.error },
            { status: 502 }
          )
        }
        return NextResponse.json({
          ok: true, adId,
          message: 'Post promoted reklam — sadece ad ismi güncellendi.',
          nameUpdated: true, creativeUpdated: false, warning: 'creative_not_editable',
          status: preservedStatus, effective_status: preservedEffectiveStatus, data: result.data,
        }, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } })
      }
      return NextResponse.json(
        { ok: false, error: 'creative_not_editable', message: 'Post promoted reklam — içerik düzenlemesi desteklenmiyor.' },
        { status: 400 }
      )
    }

    // Değişen veya mevcut değerleri birleştir
    const newPrimaryText = creative?.primaryText ?? currentPrimaryText
    const newHeadline = creative?.headline ?? currentHeadline
    const newDescription = creative?.description ?? currentDescription
    const newWebsiteUrl = creative?.websiteUrl ?? currentWebsiteUrl
    const newCta = creative?.callToAction ?? currentCta

    // 7a. asset_feed_spec (Advantage+ Creative) — kopyala, güncelle, yeni creative oluştur
    if (assetFeedSpec && creativeChanged) {
      if (DEBUG) console.log('[Ad Update] Advantage+ Creative (asset_feed_spec) — creating updated creative')

      // Mevcut asset_feed_spec'i deep-clone et
      const newAfs = JSON.parse(JSON.stringify(assetFeedSpec))

      // Sadece değişen alanları güncelle
      if (primaryTextChanged) {
        if (!newAfs.bodies || newAfs.bodies.length === 0) newAfs.bodies = [{}]
        newAfs.bodies[0].text = newPrimaryText
      }
      if (headlineChanged) {
        if (!newAfs.titles || newAfs.titles.length === 0) newAfs.titles = [{}]
        newAfs.titles[0].text = newHeadline
      }
      if (descriptionChanged) {
        if (!newAfs.descriptions || newAfs.descriptions.length === 0) newAfs.descriptions = [{}]
        newAfs.descriptions[0].text = newDescription
      }
      if (websiteUrlChanged) {
        if (!newAfs.link_urls || newAfs.link_urls.length === 0) newAfs.link_urls = [{}]
        newAfs.link_urls[0].website_url = newWebsiteUrl
      }
      if (ctaChanged) {
        newAfs.call_to_action_types = [newCta]
      }

      const creativePayload = new URLSearchParams()
      creativePayload.append('name', `Creative - ${name || currentAd.name} - ${Date.now()}`)
      creativePayload.append('asset_feed_spec', JSON.stringify(newAfs))

      // page_id gerekli — object_story_spec'ten al
      const afsPageId = objectStorySpec?.page_id
      if (afsPageId) {
        const ossForAfs: Record<string, unknown> = { page_id: afsPageId }
        if (objectStorySpec?.instagram_user_id) {
          ossForAfs.instagram_user_id = objectStorySpec.instagram_user_id
        }
        creativePayload.append('object_story_spec', JSON.stringify(ossForAfs))
      }

      if (DEBUG) console.log('[Ad Update] Creating new AFS creative:', JSON.stringify(newAfs, null, 2))

      const creativeResult = await metaClient.client.postForm(
        `/${metaClient.accountId}/adcreatives`,
        creativePayload
      )

      if (!creativeResult.ok) {
        if (DEBUG) console.error('[Ad Update] AFS creative create error:', JSON.stringify(creativeResult.error, null, 2))
        return NextResponse.json(
          {
            ok: false, error: 'creative_create_failed',
            message: creativeResult.error?.message || 'Yeni creative oluşturulamadı',
            code: creativeResult.error?.code, subcode: creativeResult.error?.subcode,
            meta_error: creativeResult.error,
          },
          { status: 502 }
        )
      }

      const newCreativeId = creativeResult.data?.id
      if (!newCreativeId) {
        return NextResponse.json(
          { ok: false, error: 'creative_creation_failed', message: 'Creative oluşturuldu ancak ID alınamadı' },
          { status: 502 }
        )
      }

      // Ad'ı güncelle
      const adPayload = new URLSearchParams()
      adPayload.append('creative', JSON.stringify({ creative_id: newCreativeId }))
      if (nameChanged) adPayload.append('name', String(name).trim())
      adPayload.append('status', preservedStatus)

      const updateResult = await metaClient.client.postForm(`/${adId}`, adPayload)
      if (!updateResult.ok) {
        if (DEBUG) console.error('[Ad Update] Ad update error:', JSON.stringify(updateResult.error, null, 2))
        return NextResponse.json(
          { ok: false, error: 'meta_api_error', message: updateResult.error?.message || 'Reklam güncellenemedi', meta_error: updateResult.error },
          { status: 502 }
        )
      }

      return NextResponse.json({
        ok: true, adId, creativeId: newCreativeId,
        message: 'Reklam güncellendi (Advantage+ Creative)',
        nameUpdated: nameChanged, creativeUpdated: true,
        status: preservedStatus, effective_status: preservedEffectiveStatus, data: updateResult.data,
      }, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } })
    }

    // 7b. Klasik reklam (object_story_spec) — yeni creative oluştur ve ad'a bağla
    const pageId = objectStorySpec?.page_id || objectStorySpec?.link_data?.page_id || objectStorySpec?.video_data?.page_id
    if (!pageId) {
      return NextResponse.json(
        { ok: false, error: 'missing_page_id', message: 'Reklam için page_id bulunamadı. Creative yapısı desteklenmiyor olabilir.' },
        { status: 400 }
      )
    }

    const newObjectStorySpec: Record<string, unknown> = { page_id: pageId }

    // instagram_user_id varsa koru
    if (objectStorySpec?.instagram_user_id) {
      newObjectStorySpec.instagram_user_id = objectStorySpec.instagram_user_id
    }

    // Mevcut creative tipi korunur (video veya link)
    if (objectStorySpec?.video_data) {
      const ctaValue: Record<string, unknown> = { link: newWebsiteUrl || '' }
      if (existingLeadGenId) ctaValue.lead_gen_form_id = existingLeadGenId

      newObjectStorySpec.video_data = {
        video_id: objectStorySpec.video_data.video_id,
        message: newPrimaryText,
        title: newHeadline,
        link_description: newDescription,
        call_to_action: { type: newCta, value: ctaValue },
      }
    } else {
      const ctaValue: Record<string, unknown> = { link: newWebsiteUrl || '' }
      if (existingLeadGenId) ctaValue.lead_gen_form_id = existingLeadGenId

      const linkData: Record<string, unknown> = {
        message: newPrimaryText,
        link: newWebsiteUrl || '',
        name: newHeadline,
        description: newDescription,
        call_to_action: { type: newCta, value: ctaValue },
      }

      // Mevcut image_hash'i koru
      if (objectStorySpec?.link_data?.image_hash) {
        linkData.image_hash = objectStorySpec.link_data.image_hash
      }
      if (creative?.imageHash) {
        linkData.image_hash = creative.imageHash
      }

      newObjectStorySpec.link_data = linkData
    }

    const creativePayload = new URLSearchParams()
    creativePayload.append('name', `Creative - ${name || currentAd.name} - ${Date.now()}`)
    creativePayload.append('object_story_spec', JSON.stringify(newObjectStorySpec))

    if (DEBUG) console.log('[Ad Update] Creating new creative:', JSON.stringify(newObjectStorySpec, null, 2))

    const creativeResult = await metaClient.client.postForm(
      `/${metaClient.accountId}/adcreatives`,
      creativePayload
    )

    if (!creativeResult.ok) {
      if (DEBUG) console.error('[Ad Update] Creative create error:', JSON.stringify(creativeResult.error, null, 2))
      return NextResponse.json(
        {
          ok: false, error: 'creative_create_failed',
          message: creativeResult.error?.message || 'Yeni creative oluşturulamadı',
          code: creativeResult.error?.code, subcode: creativeResult.error?.subcode,
          meta_error: creativeResult.error,
        },
        { status: 502 }
      )
    }

    const newCreativeId = creativeResult.data?.id
    if (!newCreativeId) {
      return NextResponse.json(
        { ok: false, error: 'creative_creation_failed', message: 'Creative oluşturuldu ancak ID alınamadı' },
        { status: 502 }
      )
    }

    // Ad'ı güncelle (status KESİNLİKLE korunur)
    const adPayload = new URLSearchParams()
    adPayload.append('creative', JSON.stringify({ creative_id: newCreativeId }))
    if (nameChanged) {
      adPayload.append('name', String(name).trim())
    }
    adPayload.append('status', preservedStatus)

    const updateResult = await metaClient.client.postForm(`/${adId}`, adPayload)

    if (!updateResult.ok) {
      if (DEBUG) console.error('[Ad Update] Ad update error:', JSON.stringify(updateResult.error, null, 2))
      return NextResponse.json(
        {
          ok: false, error: 'meta_api_error',
          message: updateResult.error?.message || 'Reklam güncellenemedi',
          code: updateResult.error?.code, meta_error: updateResult.error,
        },
        { status: 502 }
      )
    }

    return NextResponse.json({
      ok: true, adId, creativeId: newCreativeId,
      message: 'Reklam güncellendi',
      nameUpdated: nameChanged, creativeUpdated: true,
      status: preservedStatus, effective_status: preservedEffectiveStatus, data: updateResult.data,
    }, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' }
    })
  } catch (error) {
    if (DEBUG) console.error('Ad update error:', error)
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
