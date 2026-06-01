import { NextResponse } from 'next/server'
import { checkEmailAccess } from '@/lib/email/guard'
import { upsertAutomation, deleteAutomation, type AutomationTrigger } from '@/lib/email/automationStore'

export const dynamic = 'force-dynamic'

/** PATCH /api/email/automations/[id] — alanları güncelle / enabled toggle. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await checkEmailAccess()
  if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: access.status })

  const { id } = await params
  let body: { name?: string; trigger?: AutomationTrigger; subject?: string; html?: string; enabled?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })
  }

  const row = await upsertAutomation(access.user.id, { id, ...body })
  if (!row) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })

  return NextResponse.json({ ok: true })
}

/** DELETE /api/email/automations/[id]. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await checkEmailAccess()
  if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: access.status })

  const { id } = await params
  const ok = await deleteAutomation(id, access.user.id)
  return NextResponse.json({ ok })
}
