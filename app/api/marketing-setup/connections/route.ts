import { NextResponse } from 'next/server'
import { checkMarketingSetupAccess } from '@/lib/marketing-setup/guard'
import { resolveMetaContext } from '@/lib/meta/context'
import { getConnectionStatus as getGoogleAdsConnectionStatus } from '@/lib/googleAdsConnectionStore'
import { getGoogleAdsContext, searchGAds } from '@/lib/googleAdsAuth'
import { getGAConnectionStatus } from '@/lib/google-analytics/connectionStore'
import { getGSCConnectionStatus } from '@/lib/google-search-console/connectionStore'
import { getGoogleSetupToken } from '@/lib/marketing-setup/setupStore'
import type { ConnectionStatus } from '@/lib/marketing-setup/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/marketing-setup/connections
 * Read-only view of the user's existing platform connections, assembled from
 * each integration's own store. We NEVER modify those modules here.
 *
 * Resilience: every sub-lookup is wrapped so a single failing platform yields
 * connected:false for that platform rather than failing the whole route.
 */
export async function GET() {
  const access = await checkMarketingSetupAccess()
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })
  const user = access.user

  const status: ConnectionStatus = {
    meta: { connected: false, adAccountId: null, adAccountName: null, pixelId: null },
    googleAds: { connected: false, customerId: null, customerName: null },
    ga4: { connected: false, propertyId: null },
    gsc: { connected: false, siteUrl: null },
    setupConsent: { connected: false, scopes: [] },
  }

  // ── Meta: ad account (name + id) from resolved context + best-effort pixel ──
  try {
    const ctx = await resolveMetaContext()
    if (ctx) {
      status.meta.connected = true
      status.meta.adAccountId = ctx.accountId
      // Ad account display name.
      try {
        const nameRes = await ctx.client.get<{ name?: string }>(`/${ctx.accountId}`, {
          fields: 'name',
        })
        if (nameRes.ok && nameRes.data?.name) status.meta.adAccountName = nameRes.data.name
      } catch {
        // Name unavailable — UI falls back to the id.
      }
      // Best-effort pixel: read the first pixel on the ad account.
      try {
        const pixelRes = await ctx.client.get<{ data?: { id: string }[] }>(
          `/${ctx.accountId}/adspixels`,
          { fields: 'id', limit: '1' },
        )
        if (pixelRes.ok && pixelRes.data?.data?.[0]?.id) {
          status.meta.pixelId = pixelRes.data.data[0].id
        }
      } catch {
        // Pixel lookup unavailable — leave pixelId null, account still connected.
      }
    }
  } catch {
    // Meta context failed — leave meta disconnected.
  }

  // ── Google Ads: connection store + best-effort descriptive name ────────────
  try {
    const gads = await getGoogleAdsConnectionStatus(user.id)
    status.googleAds.connected = gads.hasToken
    status.googleAds.customerId = gads.customerId
    if (gads.hasToken) {
      try {
        const ctx = await getGoogleAdsContext()
        const rows = await searchGAds<{ customer?: { descriptiveName?: string } }>(
          ctx,
          'SELECT customer.descriptive_name FROM customer LIMIT 1',
        )
        const name = rows?.[0]?.customer?.descriptiveName
        if (name) status.googleAds.customerName = name
      } catch {
        // Name unavailable — UI falls back to the customer id.
      }
    }
  } catch {
    // leave googleAds disconnected
  }

  // ── GA4: analytics connection store ────────────────────────────────────────
  try {
    const ga = await getGAConnectionStatus(user.id)
    status.ga4.connected = ga.connected
    status.ga4.propertyId = ga.propertyId
  } catch {
    // leave ga4 disconnected
  }

  // ── GSC: search console connection store ───────────────────────────────────
  try {
    const gsc = await getGSCConnectionStatus(user.id)
    status.gsc.connected = gsc.connected
    status.gsc.siteUrl = gsc.siteUrl
  } catch {
    // leave gsc disconnected
  }

  // ── Setup consent: dedicated Google write-scope token for the wizard ───────
  try {
    const token = await getGoogleSetupToken(user.id)
    if (token) {
      status.setupConsent.connected = true
      status.setupConsent.scopes = token.scopes
    }
  } catch {
    // leave setupConsent disconnected
  }

  return NextResponse.json(status, { headers: { 'Cache-Control': 'no-store' } })
}
