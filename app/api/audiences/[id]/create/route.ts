import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { resolveMetaContext } from '@/lib/meta/context'
import {
  buildCustomAudiencePayload,
  buildLookalikePayload,
  buildSavedAudiencePayload,
} from '@/lib/meta/audiences/payloadBuilder'

export const dynamic = 'force-dynamic'

/**
 * POST /api/audiences/[id]/create
 * Sends the audience to Meta Graph API and updates Supabase with meta_audience_id.
 * Status transitions: DRAFT → CREATING → POPULATING (or ERROR)
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = crypto.randomUUID().slice(0, 8)

  if (!supabase) {
    return NextResponse.json({ ok: false, error: 'database_unavailable' }, { status: 503 })
  }

  const ctx = await resolveMetaContext()
  if (!ctx) {
    return NextResponse.json({ ok: false, error: 'missing_token', message: 'Meta bağlantısı gerekli' }, { status: 401 })
  }

  const { id } = await params

  // Fetch audience from DB
  const { data: audience, error: fetchError } = await supabase
    .from('audiences')
    .select('*')
    .eq('id', id)
    .eq('ad_account_id', ctx.accountId)
    .single()

  if (fetchError || !audience) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  if (audience.status !== 'DRAFT' && audience.status !== 'ERROR') {
    return NextResponse.json(
      { ok: false, error: 'invalid_status', message: `Audience status "${audience.status}" — sadece DRAFT veya ERROR gönderilebilir` },
      { status: 409 }
    )
  }

  // Mark as CREATING
  await supabase
    .from('audiences')
    .update({ status: 'CREATING', updated_at: new Date().toISOString() })
    .eq('id', id)

  try {
    const spec = audience.yoai_spec_json as Record<string, unknown>
    const type = audience.type as string
    let metaResponse: { ok: boolean; data?: Record<string, unknown>; error?: Record<string, unknown>; status?: number }

    if (type === 'CUSTOM') {
      const payload = buildCustomAudiencePayload(
        audience.name,
        audience.description,
        { ...spec, source: audience.source }
      )

      console.log(`[${requestId}] Creating Custom Audience:`, JSON.stringify(payload, null, 2))

      // Meta API: POST /{ad_account_id}/customaudiences
      const form = new URLSearchParams()
      form.set('name', payload.name)
      if (payload.description) form.set('description', payload.description)
      form.set('subtype', payload.subtype)
      if (payload.rule) form.set('rule', payload.rule)
      if (payload.pixel_id) form.set('pixel_id', payload.pixel_id)
      if (payload.object_id) form.set('object_id', payload.object_id)
      if (payload.prefill !== undefined) form.set('prefill', String(payload.prefill))

      metaResponse = await ctx.client.postForm(`/${ctx.accountId}/customaudiences`, form)

    } else if (type === 'LOOKALIKE') {
      const payload = buildLookalikePayload(
        audience.name,
        audience.description,
        spec
      )

      console.log(`[${requestId}] Creating Lookalike Audience:`, JSON.stringify(payload, null, 2))

      // Lookalike'ta seed meta_audience_id gerekli — DB'deki seedAudienceId'yi çöz
      let originAudienceId = payload.origin_audience_id
      // Eğer seedAudienceId bir YoAi UUID ise, meta_audience_id'yi bul
      if (originAudienceId && !originAudienceId.match(/^\d+$/)) {
        const { data: seedRow } = await supabase
          .from('audiences')
          .select('meta_audience_id')
          .eq('id', originAudienceId)
          .single()
        if (seedRow?.meta_audience_id) {
          originAudienceId = seedRow.meta_audience_id
        } else {
          throw new Error('Tohum kitle henüz Meta\'ya gönderilmemiş (meta_audience_id yok)')
        }
      }

      const form = new URLSearchParams()
      form.set('name', payload.name)
      if (payload.description) form.set('description', payload.description)
      form.set('subtype', 'LOOKALIKE')
      form.set('origin_audience_id', originAudienceId)
      form.set('lookalike_spec', payload.lookalike_spec)

      metaResponse = await ctx.client.postForm(`/${ctx.accountId}/customaudiences`, form)

    } else if (type === 'SAVED') {
      const payload = buildSavedAudiencePayload(
        audience.name,
        audience.description,
        spec
      )

      console.log(`[${requestId}] Creating Saved Audience:`, JSON.stringify(payload, null, 2))

      const form = new URLSearchParams()
      form.set('name', payload.name)
      if (payload.description) form.set('description', payload.description)
      form.set('targeting', JSON.stringify(payload.targeting))

      metaResponse = await ctx.client.postForm(`/${ctx.accountId}/saved_audiences`, form)

    } else {
      throw new Error(`Unsupported audience type: ${type}`)
    }

    if (!metaResponse.ok) {
      const err = metaResponse.error ?? {}
      console.error(`[${requestId}] Meta API error:`, err)

      // Mark as ERROR
      await supabase
        .from('audiences')
        .update({
          status: 'ERROR',
          error_code: String(err.code ?? metaResponse.status ?? 'unknown'),
          error_message: (err.message as string) ?? (err.error_user_msg as string) ?? 'Meta API hatası',
          meta_payload_json: metaResponse,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)

      return NextResponse.json({
        ok: false,
        error: 'meta_api_error',
        message: (err.error_user_msg as string) ?? (err.message as string) ?? 'Meta API hatası',
        meta_error: err,
      }, { status: metaResponse.status ?? 500 })
    }

    // Success — extract meta_audience_id
    const metaData = metaResponse.data as Record<string, unknown>
    const metaAudienceId = (metaData.id as string) ?? null

    console.log(`[${requestId}] Meta audience created: ${metaAudienceId}`)

    // Update DB: CREATING → POPULATING
    await supabase
      .from('audiences')
      .update({
        meta_audience_id: metaAudienceId,
        meta_payload_json: metaData,
        status: 'POPULATING',
        error_code: null,
        error_message: null,
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    return NextResponse.json({
      ok: true,
      meta_audience_id: metaAudienceId,
      status: 'POPULATING',
    })

  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Beklenmeyen hata'
    console.error(`[${requestId}] Create audience error:`, msg)

    await supabase
      .from('audiences')
      .update({
        status: 'ERROR',
        error_code: 'internal',
        error_message: msg,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    return NextResponse.json({ ok: false, error: 'internal', message: msg }, { status: 500 })
  }
}
