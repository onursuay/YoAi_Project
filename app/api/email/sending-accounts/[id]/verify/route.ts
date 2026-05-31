import { NextResponse } from 'next/server'
import { checkEmailAccess } from '@/lib/email/guard'
import { getAccount } from '@/lib/email/sendingAccountStore'
import { verifyDomainAccount } from '@/lib/email/domainStore'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

/** POST /api/email/sending-accounts/[id]/verify — domain DNS doğrulamasını kontrol et. */
export async function POST(_r: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await checkEmailAccess()
  if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: access.status })
  const { id } = await params
  const account = await getAccount(id, access.user.id)
  if (!account || account.type !== 'domain') return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  const r = await verifyDomainAccount(account)
  return NextResponse.json({ ok: r.ok, status: r.status, records: r.records })
}
