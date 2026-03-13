import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { supabase } from '@/lib/supabase/client'

export const dynamic = 'force-dynamic'

function getUserId(cookieStore: Awaited<ReturnType<typeof cookies>>): string | null {
  return cookieStore.get('session_id')?.value ?? null
}

// GET /api/yoai/articles/[id]
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!supabase) {
    return NextResponse.json({ ok: false, error: 'database_unavailable' }, { status: 503 })
  }

  const cookieStore = await cookies()
  const userId = getUserId(cookieStore)
  if (!userId) {
    return NextResponse.json({ ok: false, error: 'no_session' }, { status: 401 })
  }

  const { id } = await params

  const { data, error } = await supabase
    .from('yoai_articles')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .single()

  if (error || !data) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  return NextResponse.json({ ok: true, article: data })
}

// PATCH /api/yoai/articles/[id]
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!supabase) {
    return NextResponse.json({ ok: false, error: 'database_unavailable' }, { status: 503 })
  }

  const cookieStore = await cookies()
  const userId = getUserId(cookieStore)
  if (!userId) {
    return NextResponse.json({ ok: false, error: 'no_session' }, { status: 401 })
  }

  const { id } = await params

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (typeof body.title === 'string') updates.title = body.title.trim()
  if (typeof body.content === 'string') {
    updates.content = body.content
    updates.word_count = body.content.split(/\s+/).length
  }
  if (body.status === 'draft' || body.status === 'published') updates.status = body.status
  if (typeof body.published_url === 'string') updates.published_url = body.published_url

  const { data, error } = await supabase
    .from('yoai_articles')
    .update(updates)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single()

  if (error || !data) {
    return NextResponse.json({ ok: false, error: 'update_failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, article: data })
}

// DELETE /api/yoai/articles/[id]
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!supabase) {
    return NextResponse.json({ ok: false, error: 'database_unavailable' }, { status: 503 })
  }

  const cookieStore = await cookies()
  const userId = getUserId(cookieStore)
  if (!userId) {
    return NextResponse.json({ ok: false, error: 'no_session' }, { status: 401 })
  }

  const { id } = await params

  const { error } = await supabase
    .from('yoai_articles')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)

  if (error) {
    return NextResponse.json({ ok: false, error: 'delete_failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
