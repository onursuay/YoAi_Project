import { NextResponse } from 'next/server'
import { checkMarketingSetupAccess } from '@/lib/marketing-setup/guard'
import { getSetup, updateSetup, logStep } from '@/lib/marketing-setup/setupStore'
import { deployGtm } from '@/lib/marketing-setup/gtmClient'
import { getSetupAccessToken } from '@/lib/marketing-setup/setupGoogleToken'
import type { DeployStepResult } from '@/lib/marketing-setup/types'
import type { StandardEventKey } from '@/lib/marketing-setup/constants'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/marketing-setup/gtm
 *
 * Deploys (creates + publishes) the GTM container for the current user's
 * marketing setup. Always returns HTTP 200 with a DeployStepResult so the UI
 * can render per-step state; step failures are surfaced via status:'error'.
 */
export async function POST(): Promise<NextResponse<DeployStepResult>> {
  const step = 'gtm' as const

  const access = await checkMarketingSetupAccess()
  if (!access.ok) {
    return NextResponse.json<DeployStepResult>(
      { step, status: 'error', error: access.error },
      { status: 200 },
    )
  }
  const user = access.user

  const setup = await getSetup(user.id)
  if (!setup) {
    return NextResponse.json<DeployStepResult>(
      { step, status: 'error', error: 'no setup found' },
      { status: 200 },
    )
  }

  // Obtain a fresh setup access token (refresh-token → access-token).
  const accessToken = await getSetupAccessToken(user.id)
  if (!accessToken) {
    return NextResponse.json<DeployStepResult>(
      { step, status: 'error', error: 'setup consent required' },
      { status: 200 },
    )
  }

  try {
    const result = await deployGtm(accessToken, {
      siteUrl: setup.site_url,
      ga4MeasurementId: setup.ga4_measurement_id ?? undefined,
      metaPixelId: setup.meta_pixel_id ?? undefined,
      events: (setup.selected_events ?? []) as StandardEventKey[],
      mode: setup.gtm_container_id ? 'existing' : 'create',
      containerPublicId: setup.gtm_public_id ?? setup.gtm_container_id ?? undefined,
    })

    await updateSetup(user.id, {
      gtm_container_id: result.containerId,
      gtm_public_id: result.publicId,
      gtm_workspace_id: result.workspaceId,
      gtm_snippet_head: result.snippetHead,
      gtm_snippet_body: result.snippetBody,
    })

    const resultRecord: Record<string, unknown> = {
      containerId: result.containerId,
      publicId: result.publicId,
      workspaceId: result.workspaceId,
      snippetHead: result.snippetHead,
      snippetBody: result.snippetBody,
      tagsCreated: result.tagsCreated,
    }

    await logStep(setup.id, step, 'done', resultRecord)

    return NextResponse.json<DeployStepResult>(
      { step, status: 'done', result: resultRecord },
      { status: 200 },
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'GTM deploy failed'
    await logStep(setup.id, step, 'error', null, msg)
    return NextResponse.json<DeployStepResult>(
      { step, status: 'error', error: msg },
      { status: 200 },
    )
  }
}
