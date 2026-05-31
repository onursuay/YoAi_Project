import { NextResponse } from 'next/server'
import { checkEmailAccess } from '@/lib/email/guard'
import { importFromCrm } from '@/lib/email/contactStore'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** POST /api/email/contacts/import-crm — CRM lead'lerini kişi havuzuna aktar. */
export async function POST() {
  const access = await checkEmailAccess()
  if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: access.status })

  const result = await importFromCrm(access.user.id)
  return NextResponse.json({ ok: true, ...result })
}
