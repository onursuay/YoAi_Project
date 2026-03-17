/**
 * Single source for Google Ads user identity resolution.
 * Project uses session_id (cookie) as the stable identifier. No Supabase Auth.
 * When stronger auth (e.g. Supabase Auth user.id) exists, switch here.
 */

import type { ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies'

const SESSION_COOKIE = 'session_id'

/**
 * Resolve current user ID for Google Ads connection storage/lookup.
 * Returns session_id from cookie; null if no session.
 */
export function getGoogleAdsUserId(cookieStore: ReadonlyRequestCookies): string | null {
  return cookieStore.get(SESSION_COOKIE)?.value ?? null
}
