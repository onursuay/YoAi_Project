import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { metaGraphFetchJSON } from '@/lib/metaGraph'

const DEBUG = process.env.NODE_ENV !== 'production'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { adAccountId } = body

    if (!adAccountId || typeof adAccountId !== 'string') {
      return NextResponse.json(
        { error: 'adAccountId is required' },
        { status: 400 }
      )
    }

    const cookieStore = await cookies()
    const accessToken = cookieStore.get('meta_access_token')

    if (!accessToken || !accessToken.value) {
      return NextResponse.json(
        { error: 'Not connected' },
        { status: 401 }
      )
    }

    // Fetch user's ad accounts to validate
    const { data: accountsData, error: accountsError } = await metaGraphFetchJSON(
      '/me/adaccounts',
      accessToken.value,
      {
        params: {
          fields: 'id',
          limit: '200',
        },
      }
    )

    if (accountsError) {
      return NextResponse.json(
        { error: 'Failed to validate ad account' },
        { status: 502 }
      )
    }

    // Check if adAccountId is in the user's accounts
    const accountIds = (accountsData?.data || []).map((acc: any) => acc.id)
    const normalizedAdAccountId = adAccountId.startsWith('act_') 
      ? adAccountId 
      : `act_${adAccountId.replace('act_', '')}`

    if (!accountIds.includes(normalizedAdAccountId)) {
      return NextResponse.json(
        { error: 'Ad account not found or access denied' },
        { status: 403 }
      )
    }

    // Fetch account name and currency from Meta API
    const { data: accountData } = await metaGraphFetchJSON(
      `/${normalizedAdAccountId}`,
      accessToken.value,
      {
        params: {
          fields: 'name,currency',
        },
      }
    )
    const accountName = accountData?.name || 'Unknown Account'

    const response = NextResponse.json({ 
      ok: true,
      account_id: normalizedAdAccountId,
      account_name: accountName,
    })

    // Set selected account cookie
    response.cookies.set('selected_meta_ad_account', normalizedAdAccountId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    })

    // Keep legacy cookie names for compatibility
    response.cookies.set('meta_selected_ad_account_id', normalizedAdAccountId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    })

    response.cookies.set('meta_selected_ad_account_name', accountName, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    })

    return response
  } catch (error) {
    if (DEBUG) console.error('Select ad account error:', error)
    return NextResponse.json(
      { error: 'Failed to save ad account' },
      { status: 500 }
    )
  }
}
