import { NextResponse } from 'next/server'
import { readUserId } from '@/lib/auth/userCookie'
import { cookies } from 'next/headers'
import { supabase } from '@/lib/supabase/client'
import { updateConnectionMeta, deleteConnection } from '@/lib/seo/siteConnectionStore'

export const dynamic = 'force-dynamic'

function getUserId(cookieStore: Awaited<ReturnType<typeof cookies>>): string | null {
  return readUserId(cookieStore) ?? null
}

// PATCH /api/seo/sites/[id] — etiket / varsayılan / shopBlogId güncelle (gizli bilgiye dokunmaz)
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!supabase) return NextResponse.json({ ok: false, error: 'database_unavailable' }, { status: 503 })
  const cookieStore = await cookies()
  const userId = getUserId(cookieStore)
  if (!userId) return NextResponse.json({ ok: false, error: 'no_session' }, { status: 401 })

  const { id } = await params
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })
  }

  const patch: { label?: string | null; isDefault?: boolean; shopBlogId?: string | null } = {}
  if (typeof body.label === 'string') patch.label = body.label.trim()
  if (typeof body.isDefault === 'boolean') patch.isDefault = body.isDefault
  if (typeof body.shopBlogId === 'string') patch.shopBlogId = body.shopBlogId

  const connection = await updateConnectionMeta(id, userId, patch)
  if (!connection) return NextResponse.json({ ok: false, error: 'update_failed' }, { status: 500 })
  return NextResponse.json({ ok: true, connection })
}

// DELETE /api/seo/sites/[id]
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!supabase) return NextResponse.json({ ok: false, error: 'database_unavailable' }, { status: 503 })
  const cookieStore = await cookies()
  const userId = getUserId(cookieStore)
  if (!userId) return NextResponse.json({ ok: false, error: 'no_session' }, { status: 401 })

  const { id } = await params
  const ok = await deleteConnection(id, userId)
  if (!ok) return NextResponse.json({ ok: false, error: 'delete_failed' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
