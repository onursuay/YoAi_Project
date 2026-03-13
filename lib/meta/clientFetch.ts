/**
 * Client-side fetch wrapper for /api/meta/* routes.
 * Intercepts 401 / token_expired and fires a global event.
 * Distinguishes between "disconnected" (no token) and "expired" (token exists but invalid).
 */

export const TOKEN_EXPIRED_EVENT = 'meta:token-expired'
export const TOKEN_MISSING_EVENT = 'meta:token-missing'

let dispatchedExpired = false
let dispatchedMissing = false

function dispatchTokenExpired() {
  if (dispatchedExpired) return
  dispatchedExpired = true
  window.dispatchEvent(new CustomEvent(TOKEN_EXPIRED_EVENT))
}

function dispatchTokenMissing() {
  if (dispatchedMissing) return
  dispatchedMissing = true
  window.dispatchEvent(new CustomEvent(TOKEN_MISSING_EVENT))
}

/** Call after successful reconnect to reset */
export function resetTokenExpiredFlag() {
  dispatchedExpired = false
  dispatchedMissing = false
}

/**
 * Drop-in replacement for fetch() for Meta API calls.
 * Returns the original Response — callers don't need to change their logic.
 */
export async function metaFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const response = await fetch(input, init)

  if (response.status === 401) {
    const clone = response.clone()
    try {
      const body = await clone.json()
      if (body?.error === 'missing_token') {
        // No token at all — user is disconnected, not expired
        dispatchTokenMissing()
      } else if (
        body?.error === 'token_expired' ||
        body?.requires_reauth === true
      ) {
        dispatchTokenExpired()
      }
    } catch {
      // Can't parse body — assume expired
      dispatchTokenExpired()
    }
  }

  return response
}
