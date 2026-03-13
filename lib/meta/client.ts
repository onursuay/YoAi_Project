/**
 * Unified Meta Graph API Client
 * Server-side only - tokens never exposed to client
 */

import { META_BASE_URL } from "@/lib/metaConfig"

const DEFAULT_TIMEOUT = 15000 // 15 seconds

interface MetaClientOptions {
  accessToken: string
  timeout?: number
  maxRetries?: number
}

interface MetaError {
  error: {
    message: string
    type: string
    code: number
    error_subcode?: number
    fbtrace_id?: string
  }
}

/** Meta Graph API error shape; includes all fields Meta may return (error_user_msg, error_data, etc.) */
export interface MetaApiError {
  code?: number
  subcode?: number
  message?: string
  type?: string
  error_subcode?: number
  error_user_title?: string
  error_user_msg?: string
  error_data?: unknown
  fbtrace_id?: string
  is_transient?: boolean
  [key: string]: unknown
}

interface MetaClientResponse<T = any> {
  ok: boolean
  data?: T
  error?: MetaApiError
  status?: number
  requestId?: string
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function jitter(base: number): number {
  return base + (Math.random() * 1000 - 500) // +/- 500ms
}

function isRateLimitError(error: MetaError['error']): boolean {
  return error.code === 17 || error.error_subcode === 2446079
}

export class MetaGraphClient {
  private accessToken: string
  private timeout: number
  private maxRetries: number

  constructor(options: MetaClientOptions) {
    this.accessToken = options.accessToken
    this.timeout = options.timeout || DEFAULT_TIMEOUT
    this.maxRetries = options.maxRetries || 3
  }

  /**
   * Execute a Meta Graph API request with retry/backoff
   */
  async request<T = any>(
    method: 'GET' | 'POST' | 'DELETE',
    path: string,
    body?: URLSearchParams | Record<string, any>,
    params?: Record<string, string>
  ): Promise<MetaClientResponse<T>> {
    let url = `${META_BASE_URL}${path}`
    if (params) {
      const searchParams = new URLSearchParams(params)
      url += `?${searchParams.toString()}`
    }

    const headers = new Headers({
      Authorization: `Bearer ${this.accessToken}`,
    })

    let requestBody: string | undefined
    if (body) {
      if (body instanceof URLSearchParams) {
        requestBody = body.toString()
        headers.set('Content-Type', 'application/x-www-form-urlencoded')
      } else {
        requestBody = JSON.stringify(body)
        headers.set('Content-Type', 'application/json')
      }
    }

    let lastError: MetaError['error'] | null = null

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), this.timeout)

        const response = await fetch(url, {
          method,
          headers,
          body: requestBody,
          signal: controller.signal,
        })

        clearTimeout(timeoutId)
        const requestId = response.headers.get('x-fb-trace-id')
          || response.headers.get('x-fb-request-id')
          || undefined

        // Read response body safely
        const responseText = await response.text()
        let parsedData: any = {}

        if (responseText) {
          try {
            parsedData = JSON.parse(responseText)
          } catch {
            // Not JSON, treat as error
            parsedData = { error: { message: responseText.substring(0, 200) } }
          }
        }

        if (response.ok) {
          return { ok: true, data: parsedData, status: response.status, requestId }
        }

        // Parse error
        const error = parsedData.error || {
          message: `HTTP ${response.status}`,
          type: 'Unknown',
          code: response.status,
        }

        // Check for rate limit
        if (isRateLimitError(error)) {
          if (attempt < this.maxRetries - 1) {
            const waitTime = jitter(attempt === 0 ? 2000 : 4000)
            await sleep(Math.max(0, waitTime))
            lastError = error
            continue
          }
        }

        // Return full Meta error so UI gets error_user_msg, error_data, etc.
        const fullError: MetaApiError = {
          ...error,
          code: error.code ?? response.status,
          subcode: error.subcode ?? error.error_subcode,
          message: error.message ?? `HTTP ${response.status}`,
          fbtrace_id: error.fbtrace_id ?? requestId,
        }
        return { ok: false, error: fullError, status: response.status, requestId }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          return {
            ok: false,
            error: {
              code: 504,
              message: 'Request timeout',
              type: 'Timeout',
            },
            status: 504,
          }
        }

        if (attempt < this.maxRetries - 1) {
          const waitTime = jitter(attempt === 0 ? 2000 : 4000)
          await sleep(Math.max(0, waitTime))
          continue
        }

        return {
          ok: false,
          error: {
            code: 500,
            message: error instanceof Error ? error.message : 'Unknown error',
            type: 'NetworkError',
          },
          status: 500,
        }
      }
    }

    // All retries exhausted — pass through full error
    const rateLimitError: MetaApiError = {
      ...lastError,
      code: lastError?.code ?? 429,
      subcode: lastError?.error_subcode,
      message: lastError?.message ?? 'Rate limit exceeded',
      type: lastError?.type ?? 'RateLimit',
    }
    return { ok: false, error: rateLimitError }
  }

  /**
   * GET request
   */
  async get<T = any>(path: string, params?: Record<string, string>): Promise<MetaClientResponse<T>> {
    return this.request<T>('GET', path, undefined, params)
  }

  /**
   * POST request with form data
   */
  async postForm<T = any>(
    path: string,
    formData: URLSearchParams,
    params?: Record<string, string>
  ): Promise<MetaClientResponse<T>> {
    return this.request<T>('POST', path, formData, params)
  }

  /**
   * POST request with JSON
   */
  async postJSON<T = any>(
    path: string,
    data: Record<string, any>,
    params?: Record<string, string>
  ): Promise<MetaClientResponse<T>> {
    return this.request<T>('POST', path, data, params)
  }

  /**
   * DELETE request
   */
  async delete<T = any>(path: string, params?: Record<string, string>): Promise<MetaClientResponse<T>> {
    return this.request<T>('DELETE', path, undefined, params)
  }
}

/**
 * Create a Meta client instance from cookies
 */
export async function createMetaClient(): Promise<{ client: MetaGraphClient; accountId: string } | null> {
  const { cookies } = await import('next/headers')
  const cookieStore = await cookies()

  const accessToken = cookieStore.get('meta_access_token')?.value
  const selectedAdAccountId = cookieStore.get('meta_selected_ad_account_id')?.value

  if (!accessToken) {
    return null
  }

  if (!selectedAdAccountId) {
    return null
  }

  // Normalize account ID
  const accountId = selectedAdAccountId.startsWith('act_')
    ? selectedAdAccountId
    : `act_${selectedAdAccountId.replace('act_', '')}`

  const client = new MetaGraphClient({ accessToken })
  return { client, accountId }
}
