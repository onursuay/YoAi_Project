/**
 * Lightweight auth helpers for Meta organic publishing.
 * Unlike createMetaClient(), does NOT require an ad account.
 */

import { cookies } from 'next/headers'

/**
 * Returns the user access token from httpOnly cookies.
 * Returns null if missing or expired.
 */
export async function getUserAccessToken(): Promise<string | null> {
  const cookieStore = await cookies()

  const accessToken = cookieStore.get('meta_access_token')?.value
  if (!accessToken) return null

  const expiresAt = cookieStore.get('meta_access_expires_at')?.value
  if (expiresAt && Date.now() >= parseInt(expiresAt, 10)) return null

  return accessToken
}
