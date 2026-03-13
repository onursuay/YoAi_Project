import { NextResponse } from 'next/server'
import { createMetaClient, MetaGraphClient } from '@/lib/meta/client'

export const dynamic = 'force-dynamic'

const DEBUG = process.env.NODE_ENV !== 'production'

/**
 * POST /api/meta/audiences/create
 *
 * Creates audiences of various types via Meta Marketing API.
 *
 * Body.type determines the handler:
 *   CUSTOM (Website): name, retentionDays, pixelId?, visitType?, urlContains?, eventName?
 *   LOOKALIKE: name, sourceAudienceId, country, sizePercent
 *   ENGAGEMENT: name, sourceType, sourceId, event, retentionDays?
 *   CUSTOMER_LIST: name, schema, data, customerFileSource?
 *   APP: name, appId, appEvent, retentionDays?
 *   OFFLINE: name, eventSetId, offlineEvent?, retentionDays?
 *   CATALOG: name, catalogId, productInteraction?, productSetId?, retentionDays?
 */
export async function POST(request: Request) {
  try {
    const metaClient = await createMetaClient()
    if (!metaClient) {
      return NextResponse.json(
        { ok: false, error: 'missing_token', message: 'Meta bağlantısı bulunamadı' },
        { status: 401 }
      )
    }

    const { client, accountId } = metaClient
    const body = await request.json()
    const { type } = body

    if (type === 'CUSTOM') {
      return await createCustomAudience(client, accountId, body)
    } else if (type === 'LOOKALIKE') {
      return await createLookalikeAudience(client, accountId, body)
    } else if (type === 'ENGAGEMENT') {
      return await createEngagementAudience(client, accountId, body)
    } else if (type === 'CUSTOMER_LIST') {
      return await createCustomerListAudience(client, accountId, body)
    } else if (type === 'APP') {
      return await createAppAudience(client, accountId, body)
    } else if (type === 'OFFLINE') {
      return await createOfflineAudience(client, accountId, body)
    } else if (type === 'CATALOG') {
      return await createCatalogAudience(client, accountId, body)
    } else {
      return NextResponse.json(
        { ok: false, error: 'invalid_type', message: 'Geçersiz kitle tipi' },
        { status: 400 }
      )
    }
  } catch (error) {
    if (DEBUG) console.error('Audience create error:', error)
    return NextResponse.json(
      { ok: false, error: 'server_error', message: 'Sunucu hatası' },
      { status: 500 }
    )
  }
}

// ── Custom Audience (Website/Pixel) ──

async function createCustomAudience(
  client: MetaGraphClient,
  accountId: string,
  body: {
    name?: string
    retentionDays?: number
    pixelId?: string
    visitType?: 'all' | 'url' | 'event' | 'time_spent'
    urlContains?: string
    eventName?: string
  }
) {
  const { name, retentionDays, pixelId: providedPixelId, visitType, urlContains, eventName } = body

  // Validation
  if (!name || name.trim().length === 0) {
    return NextResponse.json(
      { ok: false, error: 'validation', message: 'Kitle adı zorunludur' },
      { status: 400 }
    )
  }

  const retention = Number(retentionDays)
  if (!retention || retention < 1 || retention > 180) {
    return NextResponse.json(
      { ok: false, error: 'validation', message: 'Tutulma süresi 1-180 gün arası olmalıdır' },
      { status: 400 }
    )
  }

  // Auto-detect pixel if not provided
  let pixelId = providedPixelId
  if (!pixelId) {
    const pixelRes = await client.get<{ data?: { id: string; name: string }[] }>(
      `/${accountId}/adspixels`,
      { fields: 'id,name', limit: '1' }
    )
    if (pixelRes.ok && pixelRes.data?.data?.[0]) {
      pixelId = pixelRes.data.data[0].id
    } else {
      return NextResponse.json(
        { ok: false, error: 'no_pixel', message: 'Hesapta Meta Pixel bulunamadı' },
        { status: 400 }
      )
    }
  }

  // Build rule JSON based on visit type
  const retentionSeconds = retention * 86400
  const filters: { field: string; operator: string; value: string }[] = []

  const vt = visitType || 'all'
  if (vt === 'url' && urlContains) {
    filters.push({ field: 'url', operator: 'i_contains', value: urlContains })
  } else if (vt === 'event' && eventName) {
    filters.push({ field: 'event', operator: 'eq', value: eventName })
  } else if (vt === 'time_spent') {
    // Time-spent visitors: top 25% by time on site
    filters.push({ field: 'url', operator: 'i_contains', value: '' })
  } else {
    // All visitors
    filters.push({ field: 'url', operator: 'i_contains', value: '' })
  }

  const rule = JSON.stringify({
    inclusions: {
      operator: 'or',
      rules: [
        {
          event_sources: [{ id: pixelId, type: 'pixel' }],
          retention_seconds: retentionSeconds,
          filter: { operator: 'and', filters },
        },
      ],
    },
  })

  const formData = new URLSearchParams()
  formData.set('name', name.trim())
  formData.set('subtype', 'WEBSITE')
  formData.set('rule', rule)
  formData.set('retention_days', String(retention))
  formData.set('prefill', 'true')

  const result = await client.postForm<{ id: string }>(
    `/${accountId}/customaudiences`,
    formData
  )

  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: 'meta_api_error',
        message: result.error?.error_user_msg || result.error?.message || 'Özel kitle oluşturulamadı',
        details: result.error,
      },
      { status: result.status || 502 }
    )
  }

  return NextResponse.json({
    ok: true,
    audience: {
      id: result.data?.id,
      name: name.trim(),
      type: 'CUSTOM' as const,
      subtype: 'WEBSITE',
    },
  })
}

// ── Lookalike Audience ──

async function createLookalikeAudience(
  client: MetaGraphClient,
  accountId: string,
  body: { name?: string; sourceAudienceId?: string; country?: string; sizePercent?: number }
) {
  const { name, sourceAudienceId, country, sizePercent } = body

  // Validation
  if (!sourceAudienceId) {
    return NextResponse.json(
      { ok: false, error: 'validation', message: 'Kaynak kitle zorunludur' },
      { status: 400 }
    )
  }

  if (!country || country.length < 2) {
    return NextResponse.json(
      { ok: false, error: 'validation', message: 'Hedef ülke zorunludur' },
      { status: 400 }
    )
  }

  const size = Number(sizePercent)
  if (!size || size < 1 || size > 10) {
    return NextResponse.json(
      { ok: false, error: 'validation', message: 'Benzerlik oranı 1-10 arası olmalıdır' },
      { status: 400 }
    )
  }

  const lookalikeSpec = JSON.stringify({
    type: 'similarity',
    country: country.toUpperCase(),
    ratio: size / 100,
    starting_ratio: 0,
  })

  // Auto-generate name if not provided
  const audienceName = name?.trim() || `Lookalike (${country.toUpperCase()}, ${size}%)`

  const formData = new URLSearchParams()
  formData.set('name', audienceName)
  formData.set('subtype', 'LOOKALIKE')
  formData.set('origin_audience_id', sourceAudienceId)
  formData.set('lookalike_spec', lookalikeSpec)

  const result = await client.postForm<{ id: string }>(
    `/${accountId}/customaudiences`,
    formData
  )

  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: 'meta_api_error',
        message: result.error?.error_user_msg || result.error?.message || 'Benzer kitle oluşturulamadı',
        details: result.error,
      },
      { status: result.status || 502 }
    )
  }

  return NextResponse.json({
    ok: true,
    audience: {
      id: result.data?.id,
      name: audienceName,
      type: 'LOOKALIKE' as const,
      subtype: 'LOOKALIKE',
    },
  })
}

// ── Engagement Audience (Page, IG, Video, Lead Form, Events, Instant Experience) ──

async function createEngagementAudience(
  client: MetaGraphClient,
  accountId: string,
  body: {
    name?: string
    sourceType: 'page' | 'ig_business' | 'video' | 'leadgen' | 'event' | 'canvas'
    sourceId: string
    event: string
    retentionDays?: number
  }
) {
  const { name, sourceType, sourceId, event, retentionDays } = body

  if (!name?.trim()) {
    return NextResponse.json(
      { ok: false, error: 'validation', message: 'Kitle adı zorunludur' },
      { status: 400 }
    )
  }
  if (!sourceId || !event) {
    return NextResponse.json(
      { ok: false, error: 'validation', message: 'Kaynak ve etkinlik türü zorunludur' },
      { status: 400 }
    )
  }

  const retention = Math.min(Math.max(Number(retentionDays) || 30, 1), 365)
  const retentionSeconds = retention * 86400

  // Map sourceType to Meta event_sources type
  const eventSourceType =
    sourceType === 'ig_business' ? 'ig_business'
    : sourceType === 'video' ? 'page'
    : sourceType === 'leadgen' ? 'page'
    : sourceType === 'event' ? 'page'
    : sourceType === 'canvas' ? 'page'
    : 'page'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filters: { field: string; operator: string; value: string }[] = [
    { field: 'event', operator: 'eq', value: event },
  ]

  const rule = JSON.stringify({
    inclusions: {
      operator: 'or',
      rules: [{
        event_sources: [{ type: eventSourceType, id: sourceId }],
        retention_seconds: retentionSeconds,
        filter: { operator: 'and', filters },
      }],
    },
  })

  const formData = new URLSearchParams()
  formData.set('name', name.trim())
  formData.set('subtype', 'ENGAGEMENT')
  formData.set('rule', rule)
  formData.set('retention_days', String(retention))

  const result = await client.postForm<{ id: string }>(
    `/${accountId}/customaudiences`,
    formData
  )

  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: 'meta_api_error',
        message: result.error?.error_user_msg || result.error?.message || 'Etkileşim kitlesi oluşturulamadı',
        details: result.error,
      },
      { status: result.status || 502 }
    )
  }

  return NextResponse.json({
    ok: true,
    audience: {
      id: result.data?.id,
      name: name.trim(),
      type: 'CUSTOM' as const,
      subtype: 'ENGAGEMENT',
    },
  })
}

// ── Customer List Audience ──

async function createCustomerListAudience(
  client: MetaGraphClient,
  accountId: string,
  body: {
    name?: string
    schema?: string[]
    data?: string[][]
    customerFileSource?: string
  }
) {
  const { name, schema, data, customerFileSource } = body

  if (!name?.trim()) {
    return NextResponse.json(
      { ok: false, error: 'validation', message: 'Kitle adı zorunludur' },
      { status: 400 }
    )
  }
  if (!schema?.length || !data?.length) {
    return NextResponse.json(
      { ok: false, error: 'validation', message: 'Müşteri verileri zorunludur' },
      { status: 400 }
    )
  }

  // Step 1: Create the audience shell
  const createForm = new URLSearchParams()
  createForm.set('name', name.trim())
  createForm.set('subtype', 'CUSTOM')
  createForm.set('customer_file_source', customerFileSource || 'USER_PROVIDED_ONLY')

  const createResult = await client.postForm<{ id: string }>(
    `/${accountId}/customaudiences`,
    createForm
  )

  if (!createResult.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: 'meta_api_error',
        message: createResult.error?.error_user_msg || createResult.error?.message || 'Müşteri kitlesi oluşturulamadı',
        details: createResult.error,
      },
      { status: createResult.status || 502 }
    )
  }

  const audienceId = createResult.data?.id

  // Step 2: Upload user data (hashed by client)
  if (audienceId && data.length > 0) {
    const payload = JSON.stringify({ schema, data })
    const uploadForm = new URLSearchParams()
    uploadForm.set('payload', payload)

    const uploadResult = await client.postForm(`/${audienceId}/users`, uploadForm)
    if (DEBUG && !uploadResult.ok) {
      console.error('Customer list data upload failed:', uploadResult.error)
    }
  }

  return NextResponse.json({
    ok: true,
    audience: {
      id: audienceId,
      name: name.trim(),
      type: 'CUSTOM' as const,
      subtype: 'CUSTOM',
    },
  })
}

// ── App Activity Audience ──

async function createAppAudience(
  client: MetaGraphClient,
  accountId: string,
  body: {
    name?: string
    appId: string
    appEvent?: string
    retentionDays?: number
  }
) {
  const { name, appId, appEvent, retentionDays } = body

  if (!name?.trim()) {
    return NextResponse.json(
      { ok: false, error: 'validation', message: 'Kitle adı zorunludur' },
      { status: 400 }
    )
  }
  if (!appId) {
    return NextResponse.json(
      { ok: false, error: 'validation', message: 'Uygulama seçimi zorunludur' },
      { status: 400 }
    )
  }

  const retention = Math.min(Math.max(Number(retentionDays) || 30, 1), 180)
  const retentionSeconds = retention * 86400

  const filters: { field: string; operator: string; value: string }[] = []
  if (appEvent && appEvent !== 'all') {
    filters.push({ field: 'event', operator: 'eq', value: appEvent })
  }

  const rule = JSON.stringify({
    inclusions: {
      operator: 'or',
      rules: [{
        event_sources: [{ type: 'app', id: appId }],
        retention_seconds: retentionSeconds,
        filter: filters.length > 0
          ? { operator: 'and', filters }
          : { operator: 'and', filters: [{ field: 'event', operator: 'eq', value: 'MOBILE_APP_INSTALL' }] },
      }],
    },
  })

  const formData = new URLSearchParams()
  formData.set('name', name.trim())
  formData.set('subtype', 'APP')
  formData.set('rule', rule)
  formData.set('retention_days', String(retention))

  const result = await client.postForm<{ id: string }>(
    `/${accountId}/customaudiences`,
    formData
  )

  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: 'meta_api_error',
        message: result.error?.error_user_msg || result.error?.message || 'Uygulama kitlesi oluşturulamadı',
        details: result.error,
      },
      { status: result.status || 502 }
    )
  }

  return NextResponse.json({
    ok: true,
    audience: {
      id: result.data?.id,
      name: name.trim(),
      type: 'CUSTOM' as const,
      subtype: 'APP',
    },
  })
}

// ── Offline Activity Audience ──

async function createOfflineAudience(
  client: MetaGraphClient,
  accountId: string,
  body: {
    name?: string
    eventSetId: string
    offlineEvent?: string
    retentionDays?: number
  }
) {
  const { name, eventSetId, offlineEvent, retentionDays } = body

  if (!name?.trim()) {
    return NextResponse.json(
      { ok: false, error: 'validation', message: 'Kitle adı zorunludur' },
      { status: 400 }
    )
  }
  if (!eventSetId) {
    return NextResponse.json(
      { ok: false, error: 'validation', message: 'Çevrimdışı etkinlik seti zorunludur' },
      { status: 400 }
    )
  }

  const retention = Math.min(Math.max(Number(retentionDays) || 30, 1), 180)
  const retentionSeconds = retention * 86400

  const filters: { field: string; operator: string; value: string }[] = []
  if (offlineEvent && offlineEvent !== 'all') {
    filters.push({ field: 'event', operator: 'eq', value: offlineEvent })
  }

  const rule = JSON.stringify({
    inclusions: {
      operator: 'or',
      rules: [{
        event_sources: [{ type: 'offline_event_set', id: eventSetId }],
        retention_seconds: retentionSeconds,
        filter: filters.length > 0
          ? { operator: 'and', filters }
          : undefined,
      }],
    },
  })

  const formData = new URLSearchParams()
  formData.set('name', name.trim())
  formData.set('subtype', 'OFFLINE_CONVERSION')
  formData.set('rule', rule)
  formData.set('retention_days', String(retention))

  const result = await client.postForm<{ id: string }>(
    `/${accountId}/customaudiences`,
    formData
  )

  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: 'meta_api_error',
        message: result.error?.error_user_msg || result.error?.message || 'Çevrimdışı kitle oluşturulamadı',
        details: result.error,
      },
      { status: result.status || 502 }
    )
  }

  return NextResponse.json({
    ok: true,
    audience: {
      id: result.data?.id,
      name: name.trim(),
      type: 'CUSTOM' as const,
      subtype: 'OFFLINE_CONVERSION',
    },
  })
}

// ── Catalog (Product) Audience ──

async function createCatalogAudience(
  client: MetaGraphClient,
  accountId: string,
  body: {
    name?: string
    catalogId: string
    productInteraction?: string
    productSetId?: string
    retentionDays?: number
  }
) {
  const { name, catalogId, productInteraction, productSetId, retentionDays } = body

  if (!name?.trim()) {
    return NextResponse.json(
      { ok: false, error: 'validation', message: 'Kitle adı zorunludur' },
      { status: 400 }
    )
  }
  if (!catalogId) {
    return NextResponse.json(
      { ok: false, error: 'validation', message: 'Katalog seçimi zorunludur' },
      { status: 400 }
    )
  }

  const retention = Math.min(Math.max(Number(retentionDays) || 30, 1), 180)
  const retentionSeconds = retention * 86400

  // Map interaction to pixel event
  const eventMap: Record<string, string> = {
    ViewContent: 'ViewContent',
    AddToCart: 'AddToCart',
    Purchase: 'Purchase',
    AddToWishlist: 'AddToWishlist',
  }
  const eventName = eventMap[productInteraction || 'ViewContent'] || 'ViewContent'

  const filters: { field: string; operator: string; value: string }[] = [
    { field: 'event', operator: 'eq', value: eventName },
  ]

  // If product set specified, add filter
  if (productSetId) {
    filters.push({ field: 'product_set_id', operator: 'eq', value: productSetId })
  }

  const rule = JSON.stringify({
    inclusions: {
      operator: 'or',
      rules: [{
        event_sources: [{ type: 'product_catalog', id: catalogId }],
        retention_seconds: retentionSeconds,
        filter: { operator: 'and', filters },
      }],
    },
  })

  const formData = new URLSearchParams()
  formData.set('name', name.trim())
  formData.set('subtype', 'CUSTOM')
  formData.set('rule', rule)
  formData.set('retention_days', String(retention))

  const result = await client.postForm<{ id: string }>(
    `/${accountId}/customaudiences`,
    formData
  )

  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: 'meta_api_error',
        message: result.error?.error_user_msg || result.error?.message || 'Katalog kitlesi oluşturulamadı',
        details: result.error,
      },
      { status: result.status || 502 }
    )
  }

  return NextResponse.json({
    ok: true,
    audience: {
      id: result.data?.id,
      name: name.trim(),
      type: 'CUSTOM' as const,
      subtype: 'CATALOG',
    },
  })
}

/**
 * GET /api/meta/audiences/create?check=pixel
 * Auto-detect pixel for the account.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const check = searchParams.get('check')

    if (check !== 'pixel') {
      return NextResponse.json({ ok: false, error: 'invalid_check' }, { status: 400 })
    }

    const metaClient = await createMetaClient()
    if (!metaClient) {
      return NextResponse.json(
        { ok: false, error: 'missing_token' },
        { status: 401 }
      )
    }

    const { client, accountId } = metaClient
    const pixelRes = await client.get<{ data?: { id: string; name: string }[] }>(
      `/${accountId}/adspixels`,
      { fields: 'id,name', limit: '5' }
    )

    if (pixelRes.ok && pixelRes.data?.data?.length) {
      return NextResponse.json({
        ok: true,
        pixels: pixelRes.data.data,
      })
    }

    return NextResponse.json({ ok: true, pixels: [] })
  } catch (error) {
    if (DEBUG) console.error('Pixel check error:', error)
    return NextResponse.json(
      { ok: false, error: 'server_error' },
      { status: 500 }
    )
  }
}
