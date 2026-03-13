// Rate limit handling for Meta API
// Handles OAuthException code 17 / subcode 2446079 "User request limit reached"

interface MetaError {
  error?: {
    code?: number
    error_subcode?: number
    message?: string
    fbtrace_id?: string
  }
}

export function isRateLimitError(errorData: any): boolean {
  const error = errorData?.error || errorData
  return (
    error?.code === 17 ||
    error?.error_subcode === 2446079 ||
    (typeof error === 'string' && error.includes('request limit'))
  )
}

export function extractFbTraceId(errorData: any): string | undefined {
  const error = errorData?.error || errorData
  return error?.fbtrace_id
}

export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function jitter(base: number): number {
  const jitterAmount = Math.random() * 1000 - 500 // +/- 500ms
  return base + jitterAmount
}

// Rate-limit aware fetch with retry
export async function metaFetchWithRateLimit(
  fetchFn: () => Promise<Response>,
  maxRetries: number = 3
): Promise<{ response: Response; errorData?: any }> {
  let lastErrorData: any = null

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetchFn()

      // If response is OK, return immediately
      if (response.ok) {
        return { response }
      }

      // Read error data safely
      let errorData: any = {}
      try {
        const text = await response.text()
        if (text) {
          try {
            errorData = JSON.parse(text)
          } catch {
            errorData = { error: { message: text.substring(0, 200) } }
          }
        }
      } catch {
        // Ignore read errors
      }

      // Check if it's a rate limit error
      if (isRateLimitError(errorData)) {
        if (attempt < maxRetries - 1) {
          // Exponential backoff: 2s, then 4s (with jitter)
          const waitTime = jitter(attempt === 0 ? 2000 : 4000)
          await sleep(Math.max(0, waitTime))
          lastErrorData = errorData
          continue
        }
      }

      // Not a rate limit error or max retries reached
      return { response, errorData }
    } catch (error) {
      if (attempt < maxRetries - 1) {
        const waitTime = jitter(attempt === 0 ? 2000 : 4000)
        await sleep(Math.max(0, waitTime))
        continue
      }
      throw error
    }
  }

  // All retries exhausted
  return { response: new Response(null, { status: 429 }), errorData: lastErrorData }
}
