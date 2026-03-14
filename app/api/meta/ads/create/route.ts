import { NextResponse } from 'next/server'
import { createMetaClient } from '@/lib/meta/client'
import { validateAdPayload } from '@/lib/meta/spec/objectiveSpec'
import { resolveInstagramUserId, type IgError } from '@/lib/meta/ig'
import { buildIgDmLink } from '@/lib/meta/igLink'
import { cookies } from 'next/headers'

const DEBUG = process.env.NODE_ENV !== 'production'
export const dynamic = 'force-dynamic'

function appendUtmParams(url: string, utmParams?: { utmSource?: string; utmMedium?: string; utmCampaign?: string; utmContent?: string }): string {
  if (!url || !utmParams) return url
  const params = new URLSearchParams()
  if (utmParams.utmSource) params.set('utm_source', utmParams.utmSource)
  if (utmParams.utmMedium) params.set('utm_medium', utmParams.utmMedium)
  if (utmParams.utmCampaign) params.set('utm_campaign', utmParams.utmCampaign)
  if (utmParams.utmContent) params.set('utm_content', utmParams.utmContent)
  const paramString = params.toString()
  if (!paramString) return url
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}${paramString}`
}

export async function POST(request: Request) {
  try {
    const MOCK_META = process.env.MOCK_META === 'true'
    if (MOCK_META) {
      const mockBody = await request.json().catch(() => ({}))
      const mockUtm = mockBody?.creative?.urlParameters
      const mockLink = mockBody?.creative?.websiteUrl || ''
      const mockFinalLink = mockUtm ? appendUtmParams(mockLink, mockUtm) : mockLink
      const mockPixelId = mockBody?.creative?.pixelId
      console.log('[MOCK META] Ad Create:', JSON.stringify({
        name: mockBody.name,
        adsetId: mockBody.adsetId,
        objective: mockBody.objective,
        conversionLocation: mockBody.conversionLocation,
        optimizationGoal: mockBody.optimizationGoal,
        format: mockBody.creative?.format,
        primaryText: mockBody.creative?.primaryText,
        headline: mockBody.creative?.headline,
        callToAction: mockBody.creative?.callToAction,
        websiteUrl: mockLink,
        finalUrlWithUtm: mockFinalLink,
        pixelId: mockPixelId || null,
        trackingSpecs: mockPixelId ? [{ 'action.type': ['offsite_conversion'], 'fb_pixel': [mockPixelId] }] : null,
      }, null, 2))
      return NextResponse.json({
        ok: true,
        adId: `mock_ad_${Date.now()}`,
        creativeId: `mock_creative_${Date.now()}`,
        _mock: true,
        _debug: {
          finalUrl: mockFinalLink,
          trackingSpecs: mockPixelId ?? null,
        },
      })
    }

    const metaClient = await createMetaClient()
    if (!metaClient) {
      return NextResponse.json(
        { ok: false, error: 'missing_token', message: 'Meta bağlantısı bulunamadı' },
        { status: 401 }
      )
    }

    // User access token — needed for Page Access Token derivation in IG resolver
    const cookieStore = await cookies()
    const userAccessToken = cookieStore.get('meta_access_token')?.value

    const body = await request.json()
    const dd = typeof body.destinationDetails === 'string'
      ? JSON.parse(body.destinationDetails)
      : (body.destinationDetails ?? body.destination_details ?? null)

    // Fallback: doğrudan body'den oku
    const whatsappPhoneNumberIdResolved =
      body.whatsappPhoneNumberId ||
      body.whatsapp_phone_number_id ||
      dd?.messaging?.whatsappPhoneNumberId ||
      undefined

    const whatsappDisplayPhoneResolved =
      body.whatsappDisplayPhone ||
      dd?.messaging?.whatsappDisplayPhone ||
      undefined

    const { adsetId, name, pageId, creative, status = 'PAUSED', objective, conversionLocation, optimizationGoal, existingPostId, callToAction, websiteUrl } = body

    // ── Existing Post (Post Promote) Flow ──
    if (existingPostId) {
      if (DEBUG) console.log('[Ads Create] Using existing post:', existingPostId, { callToAction, websiteUrl })

      // Build creative object
      const creativeObj: Record<string, unknown> = {
        object_story_id: existingPostId,
      }

      // Add CTA and link only if CTA is selected
      if (callToAction && websiteUrl) {
        creativeObj.call_to_action_type = callToAction
        creativeObj.link_url = websiteUrl
      }

      // Create ad using existing post (with optional CTA override)
      const adPayload: Record<string, unknown> = {
        name: name.trim(),
        adset_id: adsetId,
        status,
        creative: creativeObj,
      }

      const adResult = await metaClient.client.request('POST', `/${metaClient.accountId}/ads`, adPayload)

      if (!adResult.ok || !adResult.data?.id) {
        const err = adResult.error || {}
        if (DEBUG) console.error('[Ads Create] Failed:', err)
        return NextResponse.json(
          {
            ok: false,
            error: 'ad_creation_failed',
            message: err.error_user_msg || err.message || 'Reklam oluşturulamadı',
            _debug: err,
          },
          { status: 400 }
        )
      }

      if (DEBUG) console.log('[Ads Create] Success (existing post):', adResult.data.id)
      return NextResponse.json({
        ok: true,
        adId: adResult.data.id,
        creativeId: adResult.data.id, // For existing posts, we don't have a separate creative ID
      })
    }

    // ── New Ad Creation Flow (existing code) ──
    // instagramActorId/instagramAccountId fields from frontend are no longer used —
    // instagram_user_id is resolved server-side via resolveIgUserId()
    // igVerifiedPageId/igVerifiedUserId: sent by frontend when IG verify succeeded — used for mismatch check
    const igVerifiedPageId = typeof body.igVerifiedPageId === 'string' ? body.igVerifiedPageId.trim() : null
    const igVerifiedUserId = typeof body.igVerifiedUserId === 'string' ? body.igVerifiedUserId.trim() : null
    const urlParameters = creative?.urlParameters as { utmSource?: string; utmMedium?: string; utmCampaign?: string; utmContent?: string } | undefined
    const adPixelId = typeof creative?.pixelId === 'string' ? creative.pixelId.trim() : undefined

    const leadFormId = (body.lead_gen_form_id ?? body.leadFormId ?? dd?.leads?.leadFormId ?? dd?.leads?.lead_form_id ?? '').toString().trim() || undefined
    // chatGreeting = message template only. NEVER use websiteUrl — prevents URL-in-greeting corruption
    let chatGreeting = (body.chat_greeting ?? body.chatGreeting ?? dd?.messaging?.messageTemplate ?? dd?.messaging?.message_template ?? '').toString().trim()
    if (chatGreeting.startsWith('http://') || chatGreeting.startsWith('https://')) chatGreeting = ''
    const phoneNumber = (body.phone_number ?? body.phoneNumber ?? dd?.calls?.phoneNumber ?? dd?.calls?.phone_number ?? '').toString().trim()
    const whatsappPhoneNumberId = (body.whatsapp_phone_number_id ?? body.whatsappPhoneNumberId ?? dd?.messaging?.whatsappPhoneNumberId ?? dd?.messaging?.whatsapp_phone_number_id ?? '').toString().trim() || undefined

    // Comprehensive validation
    const validationErrors: Record<string, string> = {}
    
    if (!adsetId) validationErrors.adsetId = 'Ad set ID zorunludur'
    if (!name?.trim()) validationErrors.name = 'Reklam adı zorunludur'
    if (!pageId) validationErrors.pageId = 'Facebook sayfası seçilmedi'
    if (!creative) validationErrors.creative = 'Kreatif (görsel/video) zorunludur'
    
    // Creative format validation
    if (creative) {
      if (!creative.format) validationErrors['creative.format'] = 'Kreatif formatı belirtilmedi'
      if (!creative.primaryText?.trim()) validationErrors['creative.primaryText'] = 'Birincil metin zorunludur'
      
      // Format-specific validation
      if (creative.format === 'single_image') {
        if (!creative.imageHash && !creative.uploadedMediaId) {
          validationErrors['creative.imageHash'] = 'Görsel (imageHash veya uploadedMediaId) zorunludur'
        }
      } else if (creative.format === 'single_video') {
        if (!creative.videoId) validationErrors['creative.videoId'] = 'Video ID zorunludur'
      } else if (creative.format === 'carousel') {
        if (!Array.isArray(creative.carouselCards) || creative.carouselCards.length < 2) {
          validationErrors['creative.carouselCards'] = 'Carousel için en az 2 kart gerekli'
        } else {
          creative.carouselCards.forEach((card: { imageHash?: string }, idx: number) => {
            if (!card.imageHash) {
              validationErrors[`creative.carouselCards[${idx}].imageHash`] = `Kart ${idx + 1} için görsel zorunludur`
            }
          })
        }
      }
      
      // Link validation for destinations requiring URL
      const needsLink = (
        conversionLocation === 'WEBSITE' ||
        conversionLocation === 'APP' ||
        (objective === 'OUTCOME_TRAFFIC' && !['MESSENGER', 'INSTAGRAM_DIRECT', 'CALL'].includes(conversionLocation))
      )
      if (needsLink && !creative.websiteUrl?.trim()) {
        validationErrors['creative.websiteUrl'] = 'Web sitesi URL\'si zorunludur'
      }
    }

    if (Object.keys(validationErrors).length > 0) {
      return NextResponse.json(
        {
          ok: false,
          code: 'VALIDATION_ERROR',
          error: 'VALIDATION_ERROR',
          message: 'Zorunlu alanlar eksik veya hatalı',
          fields: validationErrors,
        },
        { status: 400 }
      )
    }

    if (!adsetId || !name || !pageId || !creative) {
      return NextResponse.json(
        { ok: false, error: 'invalid_input', message: 'adsetId, name, pageId ve creative zorunlu' },
        { status: 400 }
      )
    }

    if (objective && conversionLocation) {
      const adPayload = { name, creative }
      const validation = validateAdPayload(
        adPayload as Record<string, unknown>,
        String(objective),
        String(conversionLocation),
        optimizationGoal != null ? String(optimizationGoal) : undefined
      )
      if (!validation.ok) {
        return NextResponse.json(
          { ok: false, error: 'validation_error', message: validation.message },
          { status: 400 }
        )
      }
    }

    if (conversionLocation === 'WHATSAPP') {
      console.log(`[Ad Create] WHATSAPP_AD_VALIDATION:`, JSON.stringify({
        adsetId,
        pageId,
        whatsappPhoneNumberId: whatsappPhoneNumberIdResolved ?? '(none)',
        whatsappDisplayPhone: whatsappDisplayPhoneResolved ?? '(none)',
        sourceLayer: dd?.messaging?.whatsappSourceLayer ?? '(unknown)',
      }))
    }
    if (((objective === 'OUTCOME_LEADS' || objective === 'OUTCOME_ENGAGEMENT') && conversionLocation === 'CALL') && !phoneNumber) {
      return NextResponse.json(
        { ok: false, error: 'validation_error', message: 'Arama reklamı için telefon numarası zorunludur.', field: 'phone_number' },
        { status: 400 }
      )
    }
    if (objective === 'OUTCOME_LEADS' && conversionLocation === 'ON_AD' && !leadFormId) {
      return NextResponse.json(
        { ok: false, error: 'validation_error', message: 'Potansiyel müşteri formu (leadgen_form_id) zorunludur.', field: 'lead_form' },
        { status: 400 }
      )
    }
    if (objective === 'OUTCOME_SALES' && conversionLocation === 'CATALOG') {
      return NextResponse.json(
        { ok: false, error: 'not_implemented', message: 'Katalog satış reklamı (catalog sales) henüz desteklenmiyor.' },
        { status: 501 }
      )
    }

    // 1. IG User ID resolve
    // Priority: body field → API resolve → fail-closed (INSTAGRAM_DIRECT only)
    // instagram_actor_id is NEVER used.
    const isPageLikesGoal = (optimizationGoal ?? '').toString().toUpperCase() === 'PAGE_LIKES'
    const isIgDirect = conversionLocation === 'INSTAGRAM_DIRECT'

    // page_id_mismatch guard: verify result belongs to a different page than the creative's pageId
    if (isIgDirect && igVerifiedPageId && igVerifiedPageId !== String(pageId)) {
      if (process.env.META_DEBUG === 'true') {
        console.warn('[IG PUBLISH BLOCKED] reason=page_id_mismatch', {
          expectedPageId: igVerifiedPageId,
          gotPageId: String(pageId),
        })
      }
      return NextResponse.json(
        {
          ok: false,
          error: 'page_id_mismatch',
          message: `Instagram Direct doğrulaması farklı bir sayfaya ait (${igVerifiedPageId} ≠ ${String(pageId)}). İlgili sayfayı seçip yeniden doğrulayın.`,
        },
        { status: 400 }
      )
    }

    // Body-provided instagram_user_id (frontend may have pre-resolved via /api/meta/ig/verify)
    const bodyIgUserId = [
      body.instagram_user_id,
      body.instagramUserId,
      igVerifiedUserId,
      creative?.instagram_user_id,
      creative?.instagramUserId,
    ]
      .map((v) => (typeof v === 'string' ? v.trim() : ''))
      .find(Boolean) ?? null

    let igUserId: string | null = bodyIgUserId
    let igUsername: string | null = null
    let igSourceEdge: string | null = bodyIgUserId ? 'body' : null
    const tokenSource = userAccessToken ? 'cookie' : 'none'

    if (!igUserId && !isPageLikesGoal) {
      if (!userAccessToken) {
        if (isIgDirect) {
          return NextResponse.json(
            { ok: false, error: 'missing_token', message: 'Instagram Direct reklamı için oturum token gerekli.' },
            { status: 401 }
          )
        }
        // Non-INSTAGRAM_DIRECT without token: skip IG resolve, continue
      } else {
        try {
          const igResult = await resolveInstagramUserId({
            pageId: String(pageId),
            adAccountId: metaClient.accountId,
            userAccessToken,
          })
          igUserId = igResult.instagramUserId
          igUsername = igResult.username ?? null
          igSourceEdge = igResult.sourceEdge
          if (process.env.META_DEBUG === 'true') {
            console.log('[IG VERIFY OK]', {
              pageId,
              instagram_user_id_last6: igUserId.slice(-6),
              source_edge: igSourceEdge,
            })
          }
        } catch (igErr) {
          const e = igErr as IgError
          if (isIgDirect) {
            // Fail-closed only for INSTAGRAM_DIRECT
            const isNotLinked = e.kind === 'ig_not_linked_to_page'
            const errorCode = isNotLinked ? 'ig_not_linked_or_not_professional' : (e.kind ?? 'ig_resolve_failed')
            const msgMap: Record<string, string> = {
              page_token_not_found: 'Bu sayfa için Page Access Token alınamadı. Kullanıcı sayfada yetkili değil veya pages_* izni yok.',
              ig_not_linked_or_not_professional: 'Bu sayfa profesyonel (Business/Creator) Instagram hesabına bağlı değil. Meta Business Suite > Sayfa > Bağlı Hesaplar > Instagram üzerinden bağla/Profesyonel yap.',
              ig_permission_error: 'Instagram bağlantı izni yetersiz. Meta bağlantısını yeniden yetkilendirin.',
            }
            if (process.env.META_DEBUG === 'true') {
              console.warn('[IG PUBLISH BLOCKED] reason=' + errorCode, { pageId, kind: e.kind })
            }
            return NextResponse.json(
              {
                ok: false,
                error: errorCode,
                message: msgMap[errorCode] ?? 'Instagram hesabı çözümlenemedi.',
                ...(e.meta_error ? { meta_error: e.meta_error } : {}),
              },
              { status: 400 }
            )
          }
          // Other objectives: log and continue without IG user ID
          if (process.env.META_DEBUG === 'true') {
            console.warn('[Ad Create] IG resolve skipped (non-INSTAGRAM_DIRECT)', { kind: e.kind })
          }
        }
      }
    }

    // Explicit fail-closed: INSTAGRAM_DIRECT must have instagram_user_id
    if (isIgDirect && !igUserId) {
      return NextResponse.json(
        {
          ok: false,
          error: 'missing_instagram_user_id',
          message: 'Instagram Direct için instagram_user_id resolve edilemedi. Meta bağlantısını yenileyin.',
        },
        { status: 400 }
      )
    }

    // Build IG DM link for INSTAGRAM_DIRECT (always before creative construction)
    const igDmLink = (isIgDirect && igUserId)
      ? buildIgDmLink({ username: igUsername, instagramUserId: igUserId })
      : null

    if (process.env.META_DEBUG === 'true') {
      console.log('[Creative Create] IG context', {
        pageId,
        ig_user_id: igUserId ?? '(not set)',
        username: igUsername ?? '(not set)',
        link: igDmLink ?? '(not set)',
        tokenSource,
        source_edge: igSourceEdge,
        userTokenLast4: userAccessToken ? userAccessToken.slice(-4) : '(none)',
      })
    }

    // 2. AdCreative oluştur
    const creativeFormData = new URLSearchParams()
    creativeFormData.append('name', `Creative - ${name}`)

    // object_story_spec oluştur
    const objectStorySpec: Record<string, unknown> = {
      page_id: pageId,
      // instagram_user_id: WHATSAPP destination için GÖNDERİLMEZ (Meta PERMISSION_DENIED code 1)
      ...(igUserId && conversionLocation !== 'WHATSAPP' ? { instagram_user_id: igUserId } : {}),
    }

    // Awareness/Engagement: link_url opsiyonel; boşsa CTA NO_BUTTON. Leads: lead_gen_form_id. App Promotion/Traffic+APP: store URL + INSTALL_MOBILE_APP. Traffic+MESSENGER/INSTAGRAM_DIRECT: link yok, SEND_MESSAGE
    const isAwareness = objective === 'OUTCOME_AWARENESS'
    const isEngagement = objective === 'OUTCOME_ENGAGEMENT'
    const isLeads = objective === 'OUTCOME_LEADS'
    const isSales = objective === 'OUTCOME_SALES'
    const isAppPromotion = objective === 'OUTCOME_APP_PROMOTION'
    const isTraffic = objective === 'OUTCOME_TRAFFIC'
    const isTrafficMessaging =
      isTraffic && (conversionLocation === 'MESSENGER' || conversionLocation === 'INSTAGRAM_DIRECT')
    const isEngagementIgDirect = isEngagement && isIgDirect
    const isEngagementMessaging =
      isEngagement && (conversionLocation === 'MESSENGER' || conversionLocation === 'WHATSAPP')
    const isLeadsMessaging =
      isLeads && (conversionLocation === 'MESSENGER' || conversionLocation === 'WHATSAPP')
    const isSalesMessaging =
      isSales && (conversionLocation === 'MESSENGER' || conversionLocation === 'WHATSAPP')
    const isEngagementCall = isEngagement && conversionLocation === 'CALL'
    const isLeadsCall = isLeads && conversionLocation === 'CALL'
    const isLeadsOnAd = isLeads && conversionLocation === 'ON_AD'
    const isTrafficApp = isTraffic && conversionLocation === 'APP'
    const isEngagementApp = isEngagement && conversionLocation === 'APP'
    const isSalesApp = isSales && conversionLocation === 'APP'
    // ON_PAGE (PAGE_LIKES) için link yoksa otomatik olarak Facebook sayfa URL'si ata
    let linkUrl = (creative.websiteUrl || '').trim()
    if (!linkUrl && conversionLocation === 'ON_PAGE' && pageId) {
      linkUrl = `https://www.facebook.com/${pageId}`
    }
    // INSTAGRAM_DIRECT: UI'dan gelen websiteUrl öncelikli; yoksa igDmLink (ig.me) fallback (Meta subcode 2061015 fix)
    if (isIgDirect && igDmLink) {
      linkUrl = creative.websiteUrl?.trim() || igDmLink
    }
    // UTM parametrelerini URL'ye ekle (IG Direct hariç — ig.me linkleri değiştirilmemeli)
    if (!isIgDirect && urlParameters) {
      linkUrl = appendUtmParams(linkUrl, urlParameters)
    }
    const hasLink = linkUrl.length > 0
    let ctaType: string =
      (isAwareness || (isEngagement && !isEngagementMessaging && !isEngagementCall && !isEngagementIgDirect)) && !hasLink
        ? 'NO_BUTTON'
        : isTrafficMessaging
          ? 'SEND_MESSAGE'
          : isEngagementIgDirect
            ? 'SEND_MESSAGE'  // MESSAGE_PAGE rejected by Meta for IG Direct (error 2875003)
            : isEngagementMessaging || isLeadsMessaging || isSalesMessaging
              ? conversionLocation === 'WHATSAPP'
                ? 'WHATSAPP_MESSAGE'
                : 'SEND_MESSAGE'
              : isEngagementCall || isLeadsCall
                ? 'CALL_NOW'
                : (creative.callToAction ||
                  (isLeadsOnAd ? 'SIGN_UP' : isLeads && conversionLocation === 'WEBSITE' ? 'LEARN_MORE' : isAppPromotion || isTrafficApp || isEngagementApp || isSalesApp ? 'INSTALL_MOBILE_APP' : 'LEARN_MORE'))

    // INSTAGRAM_DIRECT RULE: always force INSTAGRAM_MESSAGE.
    // SEND_MESSAGE = Messenger; INSTAGRAM_MESSAGE = Instagram Direct.
    // Any other CTA type causes Meta error_subcode=2875003 "Eylem Çağrısı Desteklenmiyor".
    if (isIgDirect) ctaType = 'INSTAGRAM_MESSAGE'

    // Meta call_to_action.value: link, phone_number, lead_gen_form_id supported. whatsapp_phone_number is INVALID — goes in ad set promoted_object only
    let ctaValue: { link?: string; phone_number?: string } | undefined
    if (isIgDirect) {
      const igLink = igUserId ? `https://ig.me/m/${igUserId}` : igDmLink
      if (!igLink) {
        return NextResponse.json(
          { ok: false, error: 'cta_link_required', message: 'Instagram Direct için ig.me linki oluşturulamadı. instagram_user_id resolve edilemedi.' },
          { status: 400 }
        )
      }
      ctaValue = { link: igLink }
    } else if ((isEngagementCall || isLeadsCall) && phoneNumber) {
      const rawNumber = phoneNumber.replace(/^tel:\s*/i, '').replace(/\s/g, '')
      ctaValue = { phone_number: rawNumber }
    } else if (hasLink) {
      ctaValue = { link: linkUrl }
    } else if (conversionLocation === 'MESSENGER' && pageId) {
      ctaValue = { link: `https://m.me/${pageId}` }
    }
    // WhatsApp: NO value in call_to_action — whatsapp_phone_number belongs in ad set promoted_object
    // Messenger/IG Direct: link in ctaValue when we have one (ig.me or m.me)

    // Link resolution by conversation location. NEVER use chatGreeting as link — it's a message.
    // MESSENGER: m.me/PageID (creative_link_required fix). INSTAGRAM_DIRECT: ig.me. WHATSAPP: facebook.com fallback.
    const messengerLink = pageId ? `https://m.me/${pageId}` : ''
    const resolvedLinkByLocation =
      isIgDirect && igDmLink
        ? igDmLink
        : conversionLocation === 'MESSENGER' || conversionLocation === 'INSTAGRAM_DIRECT'
          ? (isIgDirect ? igDmLink : messengerLink)
          : hasLink
            ? linkUrl
            : isLeadsOnAd
              ? `https://www.facebook.com/${pageId}`
              : (conversionLocation === 'WHATSAPP' ? `https://www.facebook.com/${pageId}` : '')
    const effectiveLinkUrl = (isEngagementMessaging || isLeadsMessaging || isSalesMessaging) ? resolvedLinkByLocation : linkUrl
    const effectiveHasLink = (isEngagementMessaging || isLeadsMessaging || isSalesMessaging) ? resolvedLinkByLocation.length > 0 : hasLink

    if (creative.format === 'single_image' && creative.imageHash) {
      // INSTAGRAM_DIRECT: ig.me link. MESSENGER: m.me link. WhatsApp: facebook.com. NEVER chatGreeting as link.
      const resolvedLink = resolvedLinkByLocation || (effectiveHasLink ? linkUrl : '')
      // name/headline: NEVER use websiteUrl. If headline looks like URL, use empty.
      const safeHeadline = (creative.headline ?? '').trim()
      const headlineIsUrl = safeHeadline.startsWith('http://') || safeHeadline.startsWith('https://')
      const linkData: Record<string, unknown> = {
        image_hash: creative.imageHash,
        ...(resolvedLink ? { link: resolvedLink } : {}),
        message: creative.primaryText,
        name: headlineIsUrl ? '' : safeHeadline,
        description: creative.description,
        call_to_action: ctaValue ? { type: ctaType, value: ctaValue } : { type: ctaType },
      }
      if ((isEngagementMessaging || isLeadsMessaging || isSalesMessaging) && chatGreeting) linkData.page_welcome_message = chatGreeting
      objectStorySpec.link_data = linkData
    } else if (creative.format === 'single_video' && creative.videoId) {
      const resolvedVideoLink = resolvedLinkByLocation || (effectiveHasLink ? linkUrl : (isLeadsOnAd ? 'https://www.facebook.com' : undefined))
      const safeVideoTitle = (creative.headline ?? '').trim()
      const videoTitleIsUrl = safeVideoTitle.startsWith('http://') || safeVideoTitle.startsWith('https://')
      const videoData: Record<string, unknown> = {
        video_id: creative.videoId,
        ...(resolvedVideoLink ? { link: resolvedVideoLink } : {}),
        message: creative.primaryText,
        title: videoTitleIsUrl ? '' : safeVideoTitle,
        link_description: creative.description,
        call_to_action: ctaValue ? { type: ctaType, value: ctaValue } : { type: ctaType },
      }
      if ((isEngagementMessaging || isLeadsMessaging || isSalesMessaging) && chatGreeting) videoData.page_welcome_message = chatGreeting
      objectStorySpec.video_data = videoData
    } else if (creative.format === 'carousel' && creative.carouselCards?.length >= 2) {
      const carouselLink = (isEngagementMessaging || isLeadsMessaging || isSalesMessaging) ? resolvedLinkByLocation : linkUrl
      const childAttachments = creative.carouselCards.map((card: { imageHash: string; headline: string; description: string; link: string }) => {
        const cardHeadline = (card.headline ?? '').trim()
        const cardHeadlineIsUrl = cardHeadline.startsWith('http://') || cardHeadline.startsWith('https://')
        const cardLink = card.link?.trim() || carouselLink
        return {
          image_hash: card.imageHash,
          name: cardHeadlineIsUrl ? '' : cardHeadline,
          description: card.description,
          link: cardLink || '',
          call_to_action: cardLink ? { type: ctaType, value: { link: cardLink } } : { type: ctaType },
        }
      })
      const carouselLinkData: Record<string, unknown> = {
        link: carouselLink || '',
        message: creative.primaryText,
        child_attachments: childAttachments,
      }
      if ((isEngagementMessaging || isLeadsMessaging || isSalesMessaging) && chatGreeting) carouselLinkData.page_welcome_message = chatGreeting
      objectStorySpec.link_data = carouselLinkData
    }

    creativeFormData.append('object_story_spec', JSON.stringify(objectStorySpec))

    if (process.env.META_DEBUG === 'true') {
      const spec = JSON.parse(creativeFormData.get('object_story_spec') ?? '{}')
      console.log('[Ad Create] OUTBOUND CREATIVE OUT:', JSON.stringify({
        pageId,
        instagram_user_id: spec.instagram_user_id ?? '(not set)',
        conversionLocation,
        optimizationGoal,
        cta_type: ctaType,
        igSourceEdge,
        targetUrl: linkUrl || '(not set)',
        hasLinkData: !!spec.link_data,
        hasVideoData: !!spec.video_data,
      }))
    }

    const creativeResult = await metaClient.client.postForm(
      `/${metaClient.accountId}/adcreatives`,
      creativeFormData
    )

    if (!creativeResult.ok) {
      const metaError = creativeResult.error || {}
      const code = metaError.code
      const subcode = metaError.error_subcode ?? metaError.subcode

      // Subcode 2875003 = unsupported CTA for Instagram Direct placement
      const isUnsupportedCta =
        subcode === 2875003 ||
        metaError.error_user_msg?.includes('Eylem Çağrısı Desteklenmiyor') ||
        metaError.error_user_msg?.toLowerCase().includes('call to action not supported')

      if (isUnsupportedCta) {
        return NextResponse.json(
          {
            ok: false,
            error: 'unsupported_cta_for_instagram',
            message: "Seçili eylem çağrısı Instagram Direct yerleşiminde desteklenmiyor. IG Direct için CTA otomatik olarak 'INSTAGRAM_MESSAGE' yapılmalıdır.",
            meta_error: {
              code,
              error_subcode: subcode,
              fbtrace_id: metaError.fbtrace_id,
              message: metaError.message,
            },
          },
          { status: 400 }
        )
      }

      // Subcode 2061015 = link field required for IG Direct creative
      const isLinkRequired =
        subcode === 2061015 ||
        metaError.error_user_msg?.includes('link alanını doldurmak zorunludur') ||
        (typeof metaError.message === 'string' && /link.*required/i.test(metaError.message))

      if (isLinkRequired) {
        return NextResponse.json(
          {
            ok: false,
            error: 'creative_link_required',
            message: 'Instagram Direct için Hedef URL zorunlu.',
            error_subcode: subcode,
            fbtrace_id: metaError.fbtrace_id,
          },
          { status: 400 }
        )
      }

      // Subcode 2534013 = Page-IG professional account link required
      const isIgProfessionalError =
        subcode === 2534013 ||
        (typeof metaError.message === 'string' && (
          metaError.message.includes('Profesyonel') ||
          metaError.message.toLowerCase().includes('professional') ||
          metaError.message.includes('Instagram hesabına bağlı değil')
        ))

      if (isIgProfessionalError) {
        if (process.env.META_DEBUG === 'true') {
          console.warn('[IG PUBLISH BLOCKED] reason=ig_not_linked_or_not_professional', {
            pageId,
            subcode,
            fbtrace_id: metaError.fbtrace_id,
          })
        }
        return NextResponse.json(
          {
            ok: false,
            error: 'ig_not_linked_or_not_professional',
            message: 'Bu sayfa profesyonel (Business/Creator) Instagram hesabına bağlı değil. Meta Business Suite > Sayfa > Bağlı Hesaplar > Instagram üzerinden bağla/Profesyonel yap.',
            meta_error: {
              code,
              error_subcode: subcode,
              fbtrace_id: metaError.fbtrace_id,
              message: metaError.message,
            },
          },
          { status: 400 }
        )
      }

      const isPermissionError = 
        code === 200 || 
        metaError.type === 'OAuthException' ||
        metaError.error_user_title?.toLowerCase().includes('permission') ||
        metaError.message?.toLowerCase().includes('permission')
      
      return NextResponse.json(
        {
          ok: false,
          code: isPermissionError ? 'PERMISSION_DENIED' : 'META_ERROR',
          error: isPermissionError ? 'PERMISSION_DENIED' : 'META_ERROR',
          message: isPermissionError 
            ? `İzin hatası: ${metaError.error_user_msg || metaError.message || 'Bu işlem için gerekli izne sahip değilsiniz.'}`
            : (metaError.error_user_msg || metaError.message || 'Creative oluşturulamadı'),
          error_user_title: metaError.error_user_title,
          error_user_msg: metaError.error_user_msg,
          error_subcode: subcode,
          fbtrace_id: metaError.fbtrace_id,
          meta: {
            type: metaError.type,
            code: metaError.code,
          },
        },
        { status: isPermissionError ? 403 : 400 }
      )
    }

    const creativeId = creativeResult.data?.id

    // 2. Ad oluştur
    const adFormData = new URLSearchParams()
    adFormData.append('name', name.trim())
    adFormData.append('adset_id', adsetId)
    adFormData.append('creative', JSON.stringify({ creative_id: creativeId }))
    adFormData.append('status', status === 'ACTIVE' ? 'ACTIVE' : 'PAUSED')
    // tracking_specs: SALES ve LEADS dışında pixel varsa ad seviyesinde takip
    if (adPixelId && objective !== 'OUTCOME_SALES' && objective !== 'OUTCOME_LEADS') {
      adFormData.append('tracking_specs', JSON.stringify([{ 'action.type': ['offsite_conversion'], 'fb_pixel': [adPixelId] }]))
    }
    if (isLeadsOnAd && leadFormId) adFormData.append('lead_gen_form_id', leadFormId)

    const adResult = await metaClient.client.postForm(`/${metaClient.accountId}/ads`, adFormData)

    if (!adResult.ok) {
      const metaError = adResult.error || {}
      const code = metaError.code

      // Subcode 2534013 = Page-IG professional account link required (ads level)
      const adSubcode = metaError.error_subcode ?? metaError.subcode
      const isAdIgProfessionalError =
        Number(adSubcode) === 2534013 ||
        (typeof metaError.error_user_msg === 'string' && (
          metaError.error_user_msg.includes('Profesyonel') ||
          metaError.error_user_msg.toLowerCase().includes('professional') ||
          metaError.error_user_msg.includes('Instagram hesabına bağlı değil')
        ))

      if (isAdIgProfessionalError) {
        return NextResponse.json(
          {
            ok: false,
            error: 'ig_not_linked_or_not_professional',
            message: 'İzin hatası: Sayfa bir Instagram hesabına bağlı değil veya bağlı IG hesabı, profesyonel hesap değil',
            error_user_title: metaError.error_user_title,
            error_user_msg: metaError.error_user_msg,
            error_subcode: adSubcode,
            fbtrace_id: metaError.fbtrace_id,
          },
          { status: 400 }
        )
      }

      const isPermissionError = 
        code === 200 || 
        metaError.type === 'OAuthException' ||
        metaError.error_user_title?.toLowerCase().includes('permission') ||
        metaError.message?.toLowerCase().includes('permission')
      
      return NextResponse.json(
        {
          ok: false,
          code: isPermissionError ? 'PERMISSION_DENIED' : 'META_ERROR',
          error: isPermissionError ? 'PERMISSION_DENIED' : 'META_ERROR',
          message: isPermissionError 
            ? `İzin hatası: ${metaError.error_user_msg || metaError.message || 'Bu işlem için gerekli izne sahip değilsiniz.'}`
            : (metaError.error_user_msg || metaError.message || 'Reklam oluşturulamadı'),
          error_user_title: metaError.error_user_title,
          error_user_msg: metaError.error_user_msg,
          error_subcode: metaError.error_subcode,
          fbtrace_id: metaError.fbtrace_id,
          meta: {
            type: metaError.type,
            code: metaError.code,
          },
        },
        { status: isPermissionError ? 403 : 400 }
      )
    }

    return NextResponse.json({
      ok: true,
      adId: adResult.data?.id,
      creativeId,
      data: adResult.data
    })
  } catch (error) {
    if (DEBUG) console.error('Ad create error:', error)
    return NextResponse.json(
      { ok: false, error: 'server_error', message: 'Sunucu hatası' },
      { status: 500 }
    )
  }
}
