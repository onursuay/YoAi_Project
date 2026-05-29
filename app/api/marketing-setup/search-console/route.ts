import { NextResponse } from 'next/server'
import { checkMarketingSetupAccess } from '@/lib/marketing-setup/guard'
import { getSetup, updateSetup, logStep } from '@/lib/marketing-setup/setupStore'
import { getSetupAccessToken } from '@/lib/marketing-setup/setupGoogleToken'
import { deploySearchConsole } from '@/lib/marketing-setup/gscClient'
import type { DeployStepResult } from '@/lib/marketing-setup/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const STEP = 'search_console' as const

/** Build a DeployStepResult; HTTP stays 200 so the UI can show per-step state. */
function stepResult(result: DeployStepResult): NextResponse {
  return NextResponse.json(result, { status: 200 })
}

export async function POST(): Promise<NextResponse> {
  const access = await checkMarketingSetupAccess()
  if (!access.ok) return stepResult({ step: STEP, status: 'error', error: access.error })
  const user = access.user

  const setup = await getSetup(user.id)
  if (!setup) {
    return stepResult({ step: STEP, status: 'error', error: 'setup_not_found' })
  }

  const siteUrl = setup.site_url
  if (!siteUrl) {
    return stepResult({ step: STEP, status: 'error', error: 'missing_site_url' })
  }

  // Fresh access token from the dedicated "setup" Google consent.
  let accessToken: string | null = null
  try {
    accessToken = await getSetupAccessToken(user.id)
  } catch {
    accessToken = null
  }
  if (!accessToken) {
    await logStep(setup.id, STEP, 'error', null, 'not_connected_setup')
    return stepResult({ step: STEP, status: 'error', error: 'not_connected_setup' })
  }

  try {
    const result = await deploySearchConsole(accessToken, { siteUrl })

    await updateSetup(user.id, { search_console_property: result.siteUrl })
    await logStep(setup.id, STEP, 'done', result as unknown as Record<string, unknown>)

    return stepResult({
      step: STEP,
      status: 'done',
      result: result as unknown as Record<string, unknown>,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'deploy_failed'
    await logStep(setup.id, STEP, 'error', null, message)
    return stepResult({ step: STEP, status: 'error', error: message })
  }
}
