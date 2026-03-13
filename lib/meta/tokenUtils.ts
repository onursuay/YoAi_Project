import { cookies } from 'next/headers'
import { META_BASE_URL } from '@/lib/metaConfig'

const DEBUG = process.env.NODE_ENV === 'development'

// Token'ın kaç saniye kala yenilenmeye çalışılacağı (1 gün = 86400 saniye)
const REFRESH_THRESHOLD_SECONDS = 86400 * 7 // 7 gün kala yenilemeye çalış

interface TokenStatus {
  valid: boolean
  token: string | null
  expiresAt: number | null
  needsRefresh: boolean
  needsReauth: boolean
  tokenType: 'long_lived' | 'short_lived' | 'unknown'
}

/**
 * Token durumunu kontrol eder
 */
export async function getTokenStatus(): Promise<TokenStatus> {
  const cookieStore = await cookies()
  
  const tokenCookie = cookieStore.get('meta_access_token')
  const expiresAtCookie = cookieStore.get('meta_access_expires_at')
  const tokenTypeCookie = cookieStore.get('meta_token_type')
  
  if (!tokenCookie?.value) {
    return {
      valid: false,
      token: null,
      expiresAt: null,
      needsRefresh: false,
      needsReauth: true,
      tokenType: 'unknown'
    }
  }
  
  const token = tokenCookie.value
  const expiresAt = expiresAtCookie?.value ? parseInt(expiresAtCookie.value, 10) : null
  const tokenType = (tokenTypeCookie?.value as 'long_lived' | 'short_lived') || 'unknown'
  
  const now = Date.now()
  
  // Token süresi dolmuş mu?
  if (expiresAt && now >= expiresAt) {
    return {
      valid: false,
      token,
      expiresAt,
      needsRefresh: false,
      needsReauth: true,
      tokenType
    }
  }
  
  // Token yakında bitecek mi? (threshold içinde)
  const needsRefresh = expiresAt 
    ? (expiresAt - now) < (REFRESH_THRESHOLD_SECONDS * 1000)
    : false
  
  return {
    valid: true,
    token,
    expiresAt,
    needsRefresh,
    needsReauth: false,
    tokenType
  }
}

/**
 * Token'ı long-lived'a yenilemeyi dener
 * Sadece short-lived token'lar için veya yakında bitecek long-lived token'lar için çağrılmalı
 */
export async function tryRefreshToken(currentToken: string): Promise<{
  success: boolean
  newToken?: string
  expiresIn?: number
  error?: string
}> {
  const appId = process.env.META_APP_ID
  const appSecret = process.env.META_APP_SECRET
  
  if (!appId || !appSecret) {
    return { success: false, error: 'missing_app_config' }
  }
  
  try {
    const longLivedUrl = new URL(`${META_BASE_URL}/oauth/access_token`)
    longLivedUrl.searchParams.set("grant_type", "fb_exchange_token")
    longLivedUrl.searchParams.set("client_id", appId)
    longLivedUrl.searchParams.set("client_secret", appSecret)
    longLivedUrl.searchParams.set("fb_exchange_token", currentToken)
    
    const response = await fetch(longLivedUrl.toString(), {
      method: "GET",
      signal: AbortSignal.timeout(15000)
    })
    
    const data = await response.json()
    
    if (response.ok && data?.access_token) {
      if (DEBUG) console.log('[TokenRefresh] Success, new expires_in:', data.expires_in)
      return {
        success: true,
        newToken: data.access_token,
        expiresIn: data.expires_in || 5184000
      }
    }
    
    // Exchange başarısız - token zaten geçersiz olabilir
    return {
      success: false,
      error: data?.error?.message || 'exchange_failed'
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'network_error'
    }
  }
}

/**
 * Middleware veya API route'larda kullanılabilecek token kontrol wrapper'ı
 * 
 * Kullanım:
 * const tokenCheck = await checkAndRefreshToken()
 * if (!tokenCheck.valid) {
 *   return NextResponse.json({ error: 'token_invalid', requires_reauth: true }, { status: 401 })
 * }
 * // tokenCheck.token ile devam et
 */
export async function checkAndRefreshToken(): Promise<{
  valid: boolean
  token: string | null
  refreshed: boolean
  requiresReauth: boolean
}> {
  const status = await getTokenStatus()
  
  // Token geçersiz veya yok
  if (!status.valid || status.needsReauth) {
    return {
      valid: false,
      token: null,
      refreshed: false,
      requiresReauth: true
    }
  }
  
  // Token geçerli ama yakında bitecek - yenilemeyi dene
  if (status.needsRefresh && status.token) {
    if (DEBUG) console.log('[TokenCheck] Token expiring soon, attempting refresh...')
    
    const refreshResult = await tryRefreshToken(status.token)
    
    if (refreshResult.success && refreshResult.newToken) {
      // Yeni token'ı cookie'ye yaz
      // Not: Bu fonksiyon API route içinde çağrılmalı, cookie set etmek için
      // response döndürülürken cookie set edilmeli
      return {
        valid: true,
        token: refreshResult.newToken,
        refreshed: true,
        requiresReauth: false
      }
    }
    
    // Refresh başarısız ama mevcut token hala geçerli
    if (DEBUG) console.warn('[TokenCheck] Refresh failed but current token still valid')
    return {
      valid: true,
      token: status.token,
      refreshed: false,
      requiresReauth: false
    }
  }
  
  // Token geçerli, refresh gerekmiyor
  return {
    valid: true,
    token: status.token,
    refreshed: false,
    requiresReauth: false
  }
}

/**
 * Cookie'leri güncellemek için helper
 * API route response'unda kullanılmalı
 */
export function getRefreshedTokenCookies(newToken: string, expiresIn: number) {
  const cookieMaxAge = Math.max(expiresIn - 86400, 3600)
  const expiresAt = Date.now() + (expiresIn * 1000)
  
  return {
    meta_access_token: {
      value: newToken,
      options: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax" as const,
        path: "/",
        maxAge: cookieMaxAge,
      }
    },
    meta_access_expires_at: {
      value: expiresAt.toString(),
      options: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax" as const,
        path: "/",
        maxAge: cookieMaxAge,
      }
    },
    meta_token_type: {
      value: "long_lived",
      options: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax" as const,
        path: "/",
        maxAge: cookieMaxAge,
      }
    }
  }
}
