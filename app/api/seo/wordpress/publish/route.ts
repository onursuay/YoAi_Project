import { NextResponse } from 'next/server'
import { marked } from 'marked'

export async function POST(request: Request) {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })
  }

  const title = body.title as string
  const content = body.content as string
  const wpUrl = body.wpUrl as string
  const wpUser = body.wpUser as string
  const wpAppPassword = body.wpAppPassword as string
  const status = (body.status as string) || 'draft'

  if (!title || !content || !wpUrl || !wpUser || !wpAppPassword) {
    return NextResponse.json({ ok: false, error: 'Eksik parametreler' }, { status: 400 })
  }

  try {
    // Convert markdown to HTML for WordPress
    const htmlContent = await marked(content)

    const credentials = Buffer.from(`${wpUser}:${wpAppPassword}`).toString('base64')

    const res = await fetch(`${wpUrl}/wp-json/wp/v2/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${credentials}`,
      },
      body: JSON.stringify({
        title,
        content: htmlContent,
        status,
      }),
    })

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}))
      console.error('[WordPress Publish]', res.status, errorData)
      const errorMessage = (errorData as Record<string, unknown>).message || `WordPress API hatası (${res.status})`
      return NextResponse.json({ ok: false, error: errorMessage }, { status: res.status })
    }

    const postData = await res.json() as { link?: string; id?: number }
    return NextResponse.json({
      ok: true,
      postUrl: postData.link || `${wpUrl}/?p=${postData.id}`,
      postId: postData.id,
    })
  } catch (err) {
    console.error('[WordPress Publish] Error:', err)
    return NextResponse.json({ ok: false, error: 'WordPress bağlantı hatası' }, { status: 500 })
  }
}
