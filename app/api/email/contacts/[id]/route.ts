import { NextResponse } from 'next/server'
import { checkEmailAccess } from '@/lib/email/guard'
import { deleteContact } from '@/lib/email/contactStore'

export const dynamic = 'force-dynamic'

/** DELETE /api/email/contacts/[id] — kişiyi sil. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await checkEmailAccess()
  if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: access.status })
  const { id } = await params
  const ok = await deleteContact(id, access.user.id)
  return NextResponse.json({ ok })
}
