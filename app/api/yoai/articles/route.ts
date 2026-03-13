import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { supabase } from '@/lib/supabase/client'

export const dynamic = 'force-dynamic'

function getUserId(cookieStore: Awaited<ReturnType<typeof cookies>>): string | null {
  return cookieStore.get('session_id')?.value ?? null
}

// GET /api/yoai/articles — List all articles for current user
export async function GET() {
  if (!supabase) {
    return NextResponse.json({ ok: false, error: 'database_unavailable' }, { status: 503 })
  }

  const cookieStore = await cookies()
  const userId = getUserId(cookieStore)
  if (!userId) {
    return NextResponse.json({ ok: false, error: 'no_session' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('yoai_articles')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[yoai/articles/GET]', error)
    return NextResponse.json({ ok: false, error: 'db_error', message: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, articles: data ?? [] })
}

// POST /api/yoai/articles — Create new article
export async function POST(request: Request) {
  if (!supabase) {
    return NextResponse.json({ ok: false, error: 'database_unavailable' }, { status: 503 })
  }

  const cookieStore = await cookies()
  const userId = getUserId(cookieStore)
  if (!userId) {
    return NextResponse.json({ ok: false, error: 'no_session' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })
  }

  const title = (body.title as string)?.trim() || ''
  const content = (body.content as string)?.trim()
  if (!content) {
    return NextResponse.json({ ok: false, error: 'content_required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('yoai_articles')
    .insert({
      user_id: userId,
      category: (body.category as string) || 'seo_article',
      title,
      content,
      params: body.params || {},
      word_count: typeof body.word_count === 'number' ? body.word_count : content.split(/\s+/).length,
      status: 'draft',
    })
    .select()
    .single()

  if (error) {
    console.error('[yoai/articles/POST]', error)
    return NextResponse.json({ ok: false, error: 'db_error', message: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, article: data }, { status: 201 })
}
