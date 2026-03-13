import { NextResponse } from 'next/server'
import { resolveMetaContext } from '@/lib/meta/context'

export const dynamic = 'force-dynamic'

/**
 * POST /api/meta/audiences/save
 *
 * Saves current targeting configuration as a Meta Saved Audience.
 *
 * Body: { name: string, targeting: Record<string, unknown> }
 */
export async function POST(request: Request) {
  try {
    const ctx = await resolveMetaContext()
    if (!ctx) {
      return NextResponse.json({ ok: false, error: 'missing_token' }, { status: 401 })
    }

    const body = await request.json()
    const { name, targeting } = body

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json(
        { ok: false, error: 'validation', message: 'Kitle adı zorunludur' },
        { status: 400 }
      )
    }

    if (!targeting || typeof targeting !== 'object') {
      return NextResponse.json(
        { ok: false, error: 'validation', message: 'Hedefleme bilgisi zorunludur' },
        { status: 400 }
      )
    }

    const formData = new URLSearchParams()
    formData.set('name', name.trim())
    formData.set('targeting', JSON.stringify(targeting))

    const result = await ctx.client.postForm<{ id: string }>(
      `/${ctx.accountId}/saved_audiences`,
      formData
    )

    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: 'meta_api_error',
          message: result.error?.error_user_msg || result.error?.message || 'Hedef kitle kaydedilemedi',
          details: result.error,
        },
        { status: result.status || 502 }
      )
    }

    return NextResponse.json({
      ok: true,
      audience: {
        id: result.data?.id,
        name: name.trim(),
        type: 'SAVED' as const,
      },
    })
  } catch {
    return NextResponse.json(
      { ok: false, error: 'server_error', message: 'Sunucu hatası' },
      { status: 500 }
    )
  }
}
