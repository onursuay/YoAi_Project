import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { randomUUID } from 'node:crypto'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const hasSupabase = !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_KEY

// GET /api/session
export async function GET() {
  try {
    if (hasSupabase) {
      // TODO: Supabase implementation when needed
      // For now, fallback to cookie-based
    }

    // Cookie-based fallback (works without Supabase)
    const cookieStore = await cookies()
    let sessionId = cookieStore.get('session_id')?.value

    if (!sessionId) {
      sessionId = randomUUID()
    }

    const response = NextResponse.json(
      {
        ok: true,
        session_id: sessionId,
      },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    )

    // Set session cookie if not exists
    if (!cookieStore.get('session_id')) {
      response.cookies.set('session_id', sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30, // 30 days
        path: '/',
      })
    }

    return response
  } catch (error) {
    console.error('Get session error:', error)
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
