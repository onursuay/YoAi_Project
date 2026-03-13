import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available' }, { status: 404 })
  }
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseUrlHost = supabaseUrl ? new URL(supabaseUrl).host : null

    const response = {
      ok: true,
      vercel_env: process.env.VERCEL_ENV ?? null,
      vercel_git_commit_sha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
      vercel_git_commit_ref: process.env.VERCEL_GIT_COMMIT_REF ?? null,
      supabase_url_host: supabaseUrlHost,
      has_SUPABASE_URL: !!process.env.SUPABASE_URL,
      has_SUPABASE_SERVICE_KEY: !!process.env.SUPABASE_SERVICE_KEY,
      ts: new Date().toISOString(),
    }

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Internal server error',
        ts: new Date().toISOString(),
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
