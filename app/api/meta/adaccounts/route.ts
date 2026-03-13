import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { metaGraphFetchJSON } from '@/lib/metaGraph'

const DEBUG = process.env.NODE_ENV !== 'production'

export async function GET() {
  const cookieStore = await cookies()
  const accessToken = cookieStore.get('meta_access_token')

  if (!accessToken || !accessToken.value) {
    return NextResponse.json(
      { error: 'Not connected' },
      { status: 401 }
    )
  }

  // Check token expiration if available
  const expiresAtCookie = cookieStore.get('meta_access_expires_at')
  if (expiresAtCookie) {
    const expiresAt = parseInt(expiresAtCookie.value, 10)
    if (Date.now() >= expiresAt) {
      return NextResponse.json(
        { error: 'Token expired' },
        { status: 401 }
      )
    }
  }

  try {
    // Fetch ad accounts from Meta Graph API using metaGraphFetch
    const { data, error } = await metaGraphFetchJSON(
      '/me/adaccounts',
      accessToken.value,
      {
        params: {
          fields: 'id,name,account_status,currency,timezone_name,opportunity_score',
          limit: '50',
        },
      }
    )

    if (error) {
      const metaError = error.details || {}
      const isAuthError = metaError.code === 190 || [463, 467].includes(metaError.error_subcode)
      return NextResponse.json(
        {
          error: isAuthError ? 'token_expired' : 'Failed to fetch ad accounts',
          details: metaError.message || 'Unknown error',
        },
        { status: isAuthError ? 401 : 502 }
      )
    }
    
    // Normalize accounts data - map fields to UI expected format
    const accounts = (data?.data || []).map((account: any) => ({
      id: account.id,
      name: account.name || 'Unnamed Account',
      account_id: account.id, // Add account_id alias for compatibility
      status: account.account_status || 0,
      account_status: account.account_status || 0,
      currency: account.currency || '',
      timezone: account.timezone_name || '',
      timezone_name: account.timezone_name || '',
      opportunity_score: account.opportunity_score?.score ?? account.opportunity_score ?? null,
    }))

    const response = NextResponse.json({ accounts })
    response.headers.set('Cache-Control', 'no-store')
    return response
  } catch (error) {
    if (DEBUG) console.error('Ad accounts fetch error:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch ad accounts',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 502 }
    )
  }
}

