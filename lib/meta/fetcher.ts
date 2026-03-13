import { META_BASE_URL } from "@/lib/metaConfig"

interface FetchOptions extends RequestInit {
  params?: Record<string, string>
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function jitter(base: number): number {
  return base + Math.random() * base * 0.1
}

export async function metaFetch(
  path: string,
  token: string,
  options: FetchOptions = {}
): Promise<Response> {
  const { params, ...fetchOptions } = options

  let url = `${META_BASE_URL}${path}`
  if (params) {
    const searchParams = new URLSearchParams(params)
    url += `?${searchParams.toString()}`
  }

  const headers = new Headers(fetchOptions.headers)
  headers.set('Authorization', `Bearer ${token}`)
  headers.set('Content-Type', 'application/json')

  const maxRetries = 3
  let lastError: Error | null = null

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        ...fetchOptions,
        headers,
      })

      if (response.status === 429 || (response.status >= 500 && response.status < 600)) {
        if (attempt < maxRetries - 1) {
          const retryAfter = response.headers.get('Retry-After')
          const waitTime = retryAfter
            ? parseInt(retryAfter, 10) * 1000
            : jitter(Math.pow(2, attempt) * 1000)
          await sleep(waitTime)
          continue
        }
      }

      return response
    } catch (error) {
      lastError = error as Error
      if (attempt < maxRetries - 1) {
        await sleep(jitter(Math.pow(2, attempt) * 1000))
        continue
      }
    }
  }

  throw lastError || new Error('Request failed after retries')
}

export async function fetchAllPages<T>(
  path: string,
  token: string,
  params?: Record<string, string>
): Promise<T[]> {
  const allData: T[] = []
  let nextUrl: string | null = null

  do {
    if (nextUrl) {
      const url: URL = new URL(nextUrl)
      const response = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`API request failed: ${response.statusText}`)
      }

      const data = await response.json()
      if (data.data) {
        allData.push(...data.data)
      }
      nextUrl = data.paging?.next || null
    } else {
      const response = await metaFetch(path, token, { params })

      if (!response.ok) {
        throw new Error(`API request failed: ${response.statusText}`)
      }

      const data = await response.json()
      if (data.data) {
        allData.push(...data.data)
      }
      nextUrl = data.paging?.next || null
    }
  } while (nextUrl)

  return allData
}

