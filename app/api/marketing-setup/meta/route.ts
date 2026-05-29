import { NextResponse } from 'next/server'
import { checkMarketingSetupAccess } from '@/lib/marketing-setup/guard'
import { resolveMetaContext } from '@/lib/meta/context'
import { META_GRAPH_VERSION } from '@/lib/metaConfig'
import { getSetup, updateSetup, logStep } from '@/lib/marketing-setup/setupStore'
import {
  sendCapiEvent,
  createCustomConversions,
  generateEventId,
  ensureWebsiteAudience,
  ensureLookalikeAudience,
} from '@/lib/marketing-setup/metaCapiClient'
import type { DeployStepResult } from '@/lib/marketing-setup/types'
import type { StandardEventKey } from '@/lib/marketing-setup/constants'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const STEP = 'meta' as const

/**
 * POST /api/marketing-setup/meta — deploy step "meta".
 *
 * 1. Resolve the caller's Meta context (token + ad account) — never trusts body.
 * 2. Resolve the pixel id (setup.meta_pixel_id, else first {adAccount}/adspixels).
 * 3. Verify CAPI by sending one test event (action_source 'website') and read
 *    events_received as the match-quality signal.
 * 4. Create Meta custom conversions for the selected conversion events.
 * 5. Persist meta_pixel_id + logStep('meta','done', result) and return a
 *    DeployStepResult. Always HTTP 200 so the UI renders per-step state; a real
 *    failure is reported as status:'error' (no fabricated success).
 */
export async function POST() {
  const access = await checkMarketingSetupAccess()
  if (!access.ok) {
    return NextResponse.json<DeployStepResult>({ step: STEP, status: 'error', error: access.error }, { status: 200 })
  }
  const user = access.user

  const setup = await getSetup(user.id)
  if (!setup) {
    return NextResponse.json<DeployStepResult>({ step: STEP, status: 'error', error: 'no_setup' }, { status: 200 })
  }

  const ctx = await resolveMetaContext()
  if (!ctx) {
    await logStep(setup.id, STEP, 'error', null, 'meta_not_connected')
    return NextResponse.json<DeployStepResult>({ step: STEP, status: 'error', error: 'meta_not_connected' }, { status: 200 })
  }

  const token = ctx.userAccessToken
  const adAccountId = ctx.accountId
  const graphVersion = META_GRAPH_VERSION

  try {
    // ── Resolve pixel id ──
    let pixelId = setup.meta_pixel_id ?? null
    if (!pixelId) {
      const pixelRes = await ctx.client.get<{ data?: { id: string; name: string }[] }>(
        `/${adAccountId}/adspixels`,
        { fields: 'id,name', limit: '1' },
      )
      pixelId = pixelRes.ok ? pixelRes.data?.data?.[0]?.id ?? null : null
    }

    if (!pixelId) {
      await logStep(setup.id, STEP, 'error', null, 'no_pixel')
      return NextResponse.json<DeployStepResult>({ step: STEP, status: 'error', error: 'no_pixel' }, { status: 200 })
    }

    // ── Verify CAPI with a single REAL event (no test_event_code) ──
    // Kullanıcı isteği: "test" yok. Gerçek bir doğrulama olayı gönderilir;
    // events_received>0 → CAPI fiilen çalışıyor demektir.
    let capiVerified = false
    let matchQuality: number | null = null
    let capiError: string | null = null
    try {
      const verifyEventId = generateEventId('PageView')
      const capi = await sendCapiEvent({
        accessToken: token,
        pixelId,
        graphVersion,
        eventName: 'PageView',
        eventId: verifyEventId,
        eventSourceUrl: setup.site_url || undefined,
        actionSource: 'website',
      })
      capiVerified = capi.eventsReceived > 0
      // events_received, entegrasyon düzeyinde "olay alındı" sinyalidir.
      matchQuality = capi.eventsReceived
    } catch (e) {
      capiError = e instanceof Error ? e.message : 'capi_verify_failed'
    }

    // ── Create custom conversions for selected conversion events ──
    const selectedEvents = (setup.selected_events ?? []) as StandardEventKey[]
    const siteName = deriveSiteName(setup.site_url)
    let customConversions = 0
    let conversionsError: string | null = null
    try {
      const cc = await createCustomConversions({
        accessToken: token,
        adAccountId,
        graphVersion,
        pixelId,
        siteName,
        events: selectedEvents,
      })
      customConversions = cc.created
    } catch (e) {
      conversionsError = e instanceof Error ? e.message : 'custom_conversions_failed'
    }

    // ── Persist pixel id ──
    await updateSetup(user.id, { meta_pixel_id: pixelId })

    // If CAPI verification failed AND no conversions were created, treat as a
    // genuine step error so the UI does not show false success.
    if (!capiVerified && customConversions === 0) {
      const error = capiError || conversionsError || 'meta_step_failed'
      await logStep(setup.id, STEP, 'error', { pixelId }, error)
      return NextResponse.json<DeployStepResult>({ step: STEP, status: 'error', error, result: { pixelId } }, { status: 200 })
    }

    // ── Website yeniden-pazarlama kitlesi + benzer (lookalike) kitle ──
    // GERÇEKTEN oluşturulur (idempotent + additive). Hata olursa NON-FATAL:
    // pixel+CAPI+dönüşümler başarılı kaldığından adım yine "done" döner; mevcut
    // kitle/kampanya altyapısına dokunulmaz.
    let audiencesCreated = 0
    let lookalikesCreated = 0
    let audienceWarning: string | null = null
    try {
      const wa = await ensureWebsiteAudience({
        accessToken: token,
        adAccountId,
        graphVersion,
        pixelId,
        name: `${siteName} — Website Ziyaretçileri`,
        retentionDays: 180,
      })
      if (wa.created) audiencesCreated += 1
      if (wa.audienceId) {
        // Lookalike için reklam hesabının ülkesi zorunlu — hesaptan çöz.
        let country = ''
        try {
          const acc = await ctx.client.get<{ business_country_code?: string }>(
            `/${adAccountId}`,
            { fields: 'business_country_code' },
          )
          country = acc.ok ? (acc.data?.business_country_code ?? '') : ''
        } catch {
          /* ülke çözülemedi → lookalike atlanır (non-fatal) */
        }
        if (country) {
          const la = await ensureLookalikeAudience({
            accessToken: token,
            adAccountId,
            graphVersion,
            sourceAudienceId: wa.audienceId,
            country,
            name: `${siteName} — Benzer Kitle (${country.toUpperCase()})`,
            ratio: 0.01,
          })
          if (la.created) lookalikesCreated += 1
        } else {
          audienceWarning = 'lookalike_no_country'
        }
      }
    } catch (e) {
      audienceWarning = e instanceof Error ? e.message : 'audience_failed'
    }

    const result: Record<string, unknown> = {
      pixelId,
      adAccountId,
      capiVerified,
      customConversions,
      matchQuality,
      audiencesCreated,
      lookalikesCreated,
    }
    if (capiError) result.capiWarning = capiError
    if (conversionsError) result.conversionsWarning = conversionsError
    if (audienceWarning) result.audienceWarning = audienceWarning

    await logStep(setup.id, STEP, 'done', result)
    return NextResponse.json<DeployStepResult>({ step: STEP, status: 'done', result }, { status: 200 })
  } catch (e) {
    const error = e instanceof Error ? e.message : 'meta_step_failed'
    await logStep(setup.id, STEP, 'error', null, error)
    return NextResponse.json<DeployStepResult>({ step: STEP, status: 'error', error }, { status: 200 })
  }
}

/** Derive a human site name from the configured site url (hostname, no www). */
function deriveSiteName(siteUrl: string | null): string {
  if (!siteUrl) return 'YoAi'
  try {
    const host = new URL(siteUrl.startsWith('http') ? siteUrl : `https://${siteUrl}`).hostname
    return host.replace(/^www\./, '') || 'YoAi'
  } catch {
    return 'YoAi'
  }
}
