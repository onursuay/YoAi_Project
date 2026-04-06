/**
 * Single source for user identity resolution across all integrations.
 * Uses the permanent `user_id` cookie set at login (= signups.id in DB).
 * This ensures connections persist across logout/re-login and are fully user-isolated.
 */

import type { ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies'

/**
 * Resolve current user ID for DB connection storage/lookup.
 * Returns the permanent user_id (signups.id); null if no session.
 */
export function getGoogleAdsUserId(cookieStore: ReadonlyRequestCookies): string | null {
  return cookieStore.get('user_id')?.value ?? null
}
