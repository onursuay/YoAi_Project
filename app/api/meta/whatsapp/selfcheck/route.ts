import { NextResponse } from 'next/server'
import { createMetaClient } from '@/lib/meta/client'
import { runWhatsappSelfcheck } from '@/lib/meta/whatsappSelfcheck'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const requestId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Date.now().toString(36)
  try {
    const body = await request.json().catch(() => ({})) as { page_id?: string }
    const pageId = typeof body.page_id === 'string' ? body.page_id.trim() : ''

    if (!pageId) {
      return NextResponse.json({ ok: false, error: 'invalid_input', message: 'page_id zorunludur.' }, { status: 400 })
    }

    const metaClient = await createMetaClient()
    if (!metaClient) {
      return NextResponse.json({ ok: false, error: 'missing_token', message: 'Meta bağlantısı bulunamadı.' }, { status: 401 })
    }

    const result = await runWhatsappSelfcheck(metaClient.client, pageId)

    if (!result.ok) {
      return NextResponse.json({
        ok: false,
        error: 'server_error',
        message: result.error ?? 'Unknown error',
        request_id: requestId,
      }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      request_id: requestId,
      input: { page_id: pageId },
      steps: result.steps,
      note: 'Token/PII loglanmaz. Destek için request_id ile paylaşın.',
    }, { headers: { 'Cache-Control': 'no-store, private' } })
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: 'server_error',
      message: error instanceof Error ? error.message : 'Unknown error',
      request_id: requestId,
    }, { status: 500 })
  }
}
