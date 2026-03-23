/**
 * Resolves the server-side Meta credential context.
 * Single source of truth for accessToken + adAccountId across all Meta API routes.
 * Resolution order: DB-first → cookie fallback → null.
 * Never reads adAccountId or token from the request body.
 */
import { MetaGraphClient } from './client'
import { getMetaConnection } from '@/lib/metaConnectionStore'

export interface MetaContext {
  client: MetaGraphClient
  accountId: string        // always "act_XXXXXX" normalized
  fingerprintLast4: string // last 4 chars of access token for debug logs
  /** Raw user access token — server-side only, NEVER send to client */
  userAccessToken: string
  /** Where the context was resolved from */
  source: 'db' | 'cookie'
}

export async function resolveMetaContext(): Promise<MetaContext | null> {
  const { cookies } = await import('next/headers')
  const cookieStore = await cookies()

  // ── Tier 1: DB-first ──
  const sessionId = cookieStore.get('session_id')?.value
  if (sessionId) {
    try {
      const dbConn = await getMetaConnection(sessionId)
      if (dbConn?.accessToken && dbConn.selectedAdAccountId) {
        const accountId = normalizeAccountId(dbConn.selectedAdAccountId)
        const fingerprintLast4 = dbConn.accessToken.length >= 4 ? dbConn.accessToken.slice(-4) : '****'
        const client = new MetaGraphClient({ accessToken: dbConn.accessToken })
        return { client, accountId, fingerprintLast4, userAccessToken: dbConn.accessToken, source: 'db' }
      }
    } catch {
      // DB failure → fall through to cookie
    }
  }

  // ── Tier 2: Cookie fallback (backward compatible) ──
  const accessToken = cookieStore.get('meta_access_token')?.value
  const rawAccountId = cookieStore.get('meta_selected_ad_account_id')?.value

  if (!accessToken || !rawAccountId) return null

  const accountId = normalizeAccountId(rawAccountId)
  const fingerprintLast4 = accessToken.length >= 4 ? accessToken.slice(-4) : '****'
  const client = new MetaGraphClient({ accessToken })

  return { client, accountId, fingerprintLast4, userAccessToken: accessToken, source: 'cookie' }
}

function normalizeAccountId(id: string): string {
  return id.startsWith('act_') ? id : `act_${id.replace('act_', '')}`
}

/**
 * If request body contains an adAccountId, verify it matches the resolved context.
 * Returns an error object if mismatch, null if ok.
 */
export function checkAdAccountMismatch(
  ctx: MetaContext,
  bodyAdAccountId: string | undefined | null
): { mismatch: true; resolved: string; received: string } | null {
  if (!bodyAdAccountId) return null

  const normalize = (id: string) =>
    id.startsWith('act_') ? id : `act_${id.replace('act_', '')}`

  const received = normalize(String(bodyAdAccountId))
  if (received !== ctx.accountId) {
    return { mismatch: true, resolved: ctx.accountId, received }
  }
  return null
}
