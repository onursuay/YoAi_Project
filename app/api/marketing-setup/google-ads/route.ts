import { NextResponse } from 'next/server'
import { checkMarketingSetupAccess } from '@/lib/marketing-setup/guard'
import { getGoogleAdsContext, buildGoogleAdsHeaders } from '@/lib/googleAdsAuth'
import { GOOGLE_ADS_BASE } from '@/lib/google-ads/constants'
import { getSetup, updateSetup, logStep } from '@/lib/marketing-setup/setupStore'
import { deployGoogleAdsConversions } from '@/lib/marketing-setup/googleAdsConversionsClient'
import type { StandardEventKey } from '@/lib/marketing-setup/constants'
import type { DeployStepResult } from '@/lib/marketing-setup/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const STEP = 'google_ads' as const

/** Always HTTP 200 — the per-step status lives inside the DeployStepResult body. */
function step(body: Omit<DeployStepResult, 'step'>): NextResponse {
  return NextResponse.json<DeployStepResult>({ step: STEP, ...body }, { status: 200 })
}

/**
 * POST /api/marketing-setup/google-ads
 * Deploy step 'google_ads': create conversion actions + remarketing lists for
 * the selected events on the user's connected Google Ads account.
 */
export async function POST() {
  const access = await checkMarketingSetupAccess()
  if (!access.ok) return step({ status: 'error', error: access.error })
  const user = access.user

  // Resolve the EXISTING Google Ads context (cookie/DB). Throws with { code } when not connected.
  let ctxHeaders: Record<string, string>
  let customerId: string
  let loginCustomerId: string | undefined
  try {
    const adsCtx = await getGoogleAdsContext()
    ctxHeaders = buildGoogleAdsHeaders(adsCtx)
    customerId = adsCtx.customerId
    loginCustomerId = adsCtx.loginCustomerId
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'errors.notConnectedGoogle'
    return step({ status: 'error', error: msg })
  }

  // Selected events come from the persisted setup row.
  const setup = await getSetup(user.id)
  const events = (setup?.selected_events ?? []) as StandardEventKey[]
  const siteName = deriveSiteName(setup?.site_url ?? '')

  try {
    const result = await deployGoogleAdsConversions(
      { headers: ctxHeaders, apiBase: GOOGLE_ADS_BASE, customerId, loginCustomerId },
      { events, siteName },
    )

    // Best-effort: link GA4 → Google Ads conversion import. Real linking requires
    // the GA4 Admin googleAdsLinks resource (separate consent/property) and is not
    // available from the Google Ads write context here — report it without faking.
    const ga4ImportLinked = false

    const resultBody: Record<string, unknown> = {
      customerId,
      conversionActionsCreated: result.conversionActionsCreated,
      remarketingListsCreated: result.remarketingListsCreated,
      resourceNames: result.resourceNames,
      ga4ImportLinked,
      ga4ImportNote: 'ga4ImportManual',
    }

    await updateSetup(user.id, { google_ads_customer_id: customerId })
    if (setup?.id) await logStep(setup.id, STEP, 'done', resultBody)

    return step({ status: 'done', result: resultBody })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'errors.deployFailed'
    if (setup?.id) await logStep(setup.id, STEP, 'error', null, msg)
    return step({ status: 'error', error: msg })
  }
}

/** Human-friendly site label from the configured URL (for conversion/list names). */
function deriveSiteName(siteUrl: string): string {
  if (!siteUrl) return 'Site'
  try {
    const host = new URL(siteUrl.startsWith('http') ? siteUrl : `https://${siteUrl}`).hostname
    return host.replace(/^www\./, '') || 'Site'
  } catch {
    return siteUrl.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0] || 'Site'
  }
}
