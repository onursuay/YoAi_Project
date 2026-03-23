/**
 * Connection health endpoint.
 * Returns Google + Meta connection status for the current user.
 * No sensitive data (tokens, secrets) exposed.
 */

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getConnection } from '@/lib/googleAdsConnectionStore'
import { getMetaConnectionForHealth } from '@/lib/metaConnectionStore'

export const dynamic = 'force-dynamic'

export async function GET() {
  const cookieStore = await cookies()
  const sessionId = cookieStore.get('session_id')?.value

  if (!sessionId) {
    return NextResponse.json({
      google: { connected: false, source: 'none' as const },
      meta: { connected: false, source: 'none' as const },
    }, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
    })
  }

  // Resolve Google + Meta in parallel
  const [googleConn, metaHealth] = await Promise.all([
    getConnection(sessionId).catch(() => null),
    getMetaConnectionForHealth(sessionId).catch(() => null),
  ])

  // ── Google ──
  const google = googleConn
    ? {
        connected: true,
        customerId: googleConn.customerId,
        source: 'db' as const,
      }
    : {
        connected: false,
        source: cookieStore.get('google_ads_refresh_token')?.value ? ('cookie' as const) : ('none' as const),
      }

  // ── Meta (DB-first, cookie fallback) ──
  let meta: Record<string, unknown>
  if (metaHealth) {
    meta = {
      connected: metaHealth.connected,
      status: metaHealth.status,
      selectedAdAccountId: metaHealth.selectedAdAccountId,
      tokenType: metaHealth.tokenType,
      needsReconnect: metaHealth.needsReconnect,
      lastError: metaHealth.lastError,
      source: 'db',
    }
  } else {
    // Cookie fallback
    const metaToken = cookieStore.get('meta_access_token')?.value
    const metaExpiresAt = cookieStore.get('meta_access_expires_at')?.value
    const selectedAccount = cookieStore.get('meta_selected_ad_account_id')?.value
    const tokenType = cookieStore.get('meta_token_type')?.value

    const expiresAtMs = metaExpiresAt ? parseInt(metaExpiresAt, 10) : null
    const isExpired = expiresAtMs ? Date.now() >= expiresAtMs : false
    const hasToken = !!metaToken

    meta = {
      connected: hasToken && !isExpired,
      status: hasToken ? (isExpired ? 'expired' : 'active') : null,
      selectedAdAccountId: selectedAccount || null,
      tokenType: tokenType || null,
      needsReconnect: !hasToken || isExpired,
      lastError: null,
      source: hasToken ? 'cookie' : 'none',
    }
  }

  return NextResponse.json({ google, meta }, {
    headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
  })
}
