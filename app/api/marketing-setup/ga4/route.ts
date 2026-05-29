import { NextResponse } from 'next/server'
import { checkMarketingSetupAccess } from '@/lib/marketing-setup/guard'
import { getSetup, updateSetup, logStep } from '@/lib/marketing-setup/setupStore'
import { getSetupAccessToken } from '@/lib/marketing-setup/setupGoogleToken'
import { deployGa4 } from '@/lib/marketing-setup/ga4AdminClient'
import type { DeployStepResult } from '@/lib/marketing-setup/types'
import type { StandardEventKey } from '@/lib/marketing-setup/constants'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const STEP = 'ga4' as const

/** Derive a readable property display name from the site host. */
function hostDisplayName(siteUrl: string): string {
  try {
    const u = new URL(siteUrl.includes('://') ? siteUrl : `https://${siteUrl}`)
    return `${u.host} — GA4`
  } catch {
    return 'GA4 Property'
  }
}

export async function POST() {
  // Auth + flag/owner guard.
  const access = await checkMarketingSetupAccess()
  if (!access.ok) {
    return NextResponse.json<DeployStepResult>({ step: STEP, status: 'error', error: access.error }, { status: 200 })
  }
  const user = access.user

  // Load the persisted setup.
  const setup = await getSetup(user.id)
  if (!setup) {
    return NextResponse.json<DeployStepResult>({ step: STEP, status: 'error', error: 'no_setup' })
  }

  // Resolve a fresh Google access token from the saved setup-consent refresh token.
  let accessToken: string | null = null
  try {
    accessToken = await getSetupAccessToken(user.id)
  } catch (e) {
    accessToken = null
    console.warn('GA4_SETUP_TOKEN_FAIL', (e as Error).message)
  }
  if (!accessToken) {
    const error = 'not_connected_google'
    await logStep(setup.id, STEP, 'error', null, error)
    return NextResponse.json<DeployStepResult>({ step: STEP, status: 'error', error })
  }

  const siteUrl = setup.site_url || ''
  const events = (setup.selected_events as StandardEventKey[] | null) || []

  try {
    const result = await deployGa4(accessToken, {
      siteUrl,
      displayName: hostDisplayName(siteUrl),
      events,
      existingPropertyId: setup.ga4_property_id || undefined,
    })

    // Persist the provisioned identifiers.
    await updateSetup(user.id, {
      ga4_property_id: result.propertyId,
      ga4_measurement_id: result.measurementId,
      ga4_data_stream_id: result.dataStreamId,
    })

    await logStep(setup.id, STEP, 'done', result as unknown as Record<string, unknown>)

    return NextResponse.json<DeployStepResult>({
      step: STEP,
      status: 'done',
      result: result as unknown as Record<string, unknown>,
    })
  } catch (e) {
    const error = (e as Error).message || 'deploy_failed'
    await logStep(setup.id, STEP, 'error', null, error)
    // HTTP 200 so the UI can render a per-step error state.
    return NextResponse.json<DeployStepResult>({ step: STEP, status: 'error', error })
  }
}
