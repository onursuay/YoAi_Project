import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

const DEBUG = process.env.NODE_ENV !== 'production'
export const dynamic = 'force-dynamic'
export const revalidate = 0

const hasSupabase = !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_KEY

// GET /api/active-account?platform=meta
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const platform = searchParams.get('platform') || 'meta'

    if (hasSupabase) {
      // TODO: Supabase implementation when needed
      // For now, fallback to cookie-based
    }

    // Cookie-based fallback (works without Supabase)
    const cookieStore = await cookies()
    
    if (platform === 'meta') {
      const accountId = cookieStore.get('meta_selected_ad_account_id')?.value || null
      const accountName = cookieStore.get('meta_selected_ad_account_name')?.value || null

      return NextResponse.json(
        {
          ok: true,
          platform: 'meta',
          account_id: accountId,
          account_name: accountName,
        },
        {
          headers: {
            'Cache-Control': 'no-store',
          },
        }
      )
    }

    return NextResponse.json(
      {
        ok: false,
        error: 'Unsupported platform',
      },
      {
        status: 400,
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    )
  } catch (error) {
    if (DEBUG) console.error('Get active account error:', error)
    return NextResponse.json(
      {
        ok: false,
        error: 'Internal server error',
      },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    )
  }
}

// POST /api/active-account
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { platform, account_id, account_name } = body

    if (!platform || !account_id) {
      return NextResponse.json(
        {
          ok: false,
          error: 'platform and account_id are required',
        },
        {
          status: 400,
          headers: {
            'Cache-Control': 'no-store',
          },
        }
      )
    }

    if (hasSupabase) {
      // TODO: Supabase implementation when needed
      // For now, fallback to cookie-based
    }

    // Cookie-based fallback (works without Supabase)
    const cookieStore = await cookies()
    const response = NextResponse.json(
      {
        ok: true,
        platform,
        account_id,
        account_name: account_name || null,
      },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    )

    if (platform === 'meta') {
      const normalizedAccountId = account_id.startsWith('act_')
        ? account_id
        : `act_${account_id.replace('act_', '')}`

      // Set cookies
      response.cookies.set('meta_selected_ad_account_id', normalizedAccountId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30, // 30 days
        path: '/',
      })

      response.cookies.set('meta_selected_ad_account_name', account_name || 'Unknown Account', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30, // 30 days
        path: '/',
      })

      // Legacy cookie for compatibility
      response.cookies.set('selected_meta_ad_account', normalizedAccountId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30,
        path: '/',
      })
    }

    return response
  } catch (error) {
    if (DEBUG) console.error('Set active account error:', error)
    return NextResponse.json(
      {
        ok: false,
        error: 'Internal server error',
      },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    )
  }
}
