import { NextResponse } from 'next/server'
import { checkEmailAccess } from '@/lib/email/guard'
import { listContacts, countContacts, upsertContacts, type ContactInput } from '@/lib/email/contactStore'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** GET /api/email/contacts?limit=&offset= — kişi listesi + sayaçlar. */
export async function GET(request: Request) {
  const access = await checkEmailAccess()
  if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: access.status })

  const { searchParams } = new URL(request.url)
  const limit = parseInt(searchParams.get('limit') ?? '50', 10)
  const offset = parseInt(searchParams.get('offset') ?? '0', 10)

  const [{ contacts, total }, counts] = await Promise.all([
    listContacts(access.user.id, { limit, offset }),
    countContacts(access.user.id),
  ])

  return NextResponse.json({
    ok: true,
    contacts: contacts.map((c) => ({
      id: c.id,
      email: c.email,
      fullName: c.full_name,
      phone: c.phone,
      source: c.source,
      optOut: c.opt_out,
      createdAt: c.created_at,
    })),
    total,
    counts,
  })
}

/** POST /api/email/contacts — toplu kişi ekleme (CSV/Excel parse edilmiş satırlar). */
export async function POST(request: Request) {
  const access = await checkEmailAccess()
  if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: access.status })

  let body: { rows?: ContactInput[]; source?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })
  }
  const rows = Array.isArray(body.rows) ? body.rows : []
  if (rows.length === 0) return NextResponse.json({ ok: false, error: 'no_rows' }, { status: 400 })
  if (rows.length > 50000) return NextResponse.json({ ok: false, error: 'too_many' }, { status: 413 })

  const result = await upsertContacts(access.user.id, rows, body.source ?? 'csv')
  return NextResponse.json({ ok: true, ...result })
}
