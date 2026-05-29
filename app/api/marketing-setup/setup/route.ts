import { NextResponse } from 'next/server'
import { checkMarketingSetupAccess } from '@/lib/marketing-setup/guard'
import { getSetup, getOrCreateSetup, updateSetup } from '@/lib/marketing-setup/setupStore'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Only these DB columns may be patched from the client. Everything else
// (tokens, ids written by deploy steps, status) is server-managed.
const PATCHABLE_COLUMNS = [
  'site_url',
  'selected_events',
  'gtm_container_id',
  'meta_ad_account_id',
  'google_ads_customer_id',
] as const

/**
 * GET /api/marketing-setup/setup
 * Returns the current user's marketing setup row (or null).
 */
export async function GET() {
  const access = await checkMarketingSetupAccess()
  if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: access.status })
  const setup = await getSetup(access.user.id)
  return NextResponse.json({ ok: true, setup })
}

/**
 * POST /api/marketing-setup/setup
 * Body: { patch: Partial<...whitelisted columns...> }
 * Applies the whitelisted columns and returns the fresh row.
 */
export async function POST(request: Request) {
  const access = await checkMarketingSetupAccess()
  if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: access.status })
  const user = access.user

  let patch: Record<string, unknown> = {}
  try {
    const body = (await request.json()) as { patch?: Record<string, unknown> }
    patch = body?.patch ?? {}
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })
  }

  const safePatch: Record<string, unknown> = {}
  for (const key of PATCHABLE_COLUMNS) {
    if (Object.prototype.hasOwnProperty.call(patch, key)) {
      safePatch[key] = patch[key]
    }
  }

  if (Object.keys(safePatch).length === 0) {
    // Nothing to update — return current row so the client stays in sync.
    const setup = await getSetup(user.id)
    return NextResponse.json({ ok: true, setup })
  }

  // Satırın var olduğunu garanti et — aksi halde updateSetup 0 satır günceller ve
  // patch sessizce kaybolurdu (tarama yapılmadan event/GTM seçimi persist edilirse).
  await getOrCreateSetup(user.id, (safePatch.site_url as string | undefined) ?? '')
  const setup = await updateSetup(user.id, safePatch)
  return NextResponse.json({ ok: true, setup })
}
