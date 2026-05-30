import { NextResponse } from 'next/server'
import { checkCrmAccess } from '@/lib/crm/guard'
import { listLeads, type CrmLeadStatus } from '@/lib/crm/leadStore'
import { maskEmail, maskPhone } from '@/lib/crm/mask'

export const dynamic = 'force-dynamic'

const VALID_STATUS: ReadonlyArray<CrmLeadStatus | 'all'> = ['all', 'new', 'positive', 'negative']

/**
 * GET /api/crm/leads?status=all|new|positive|negative&limit=&offset=
 * Liste görünümü — e-posta/telefon MASKELİ döner (detay endpoint tam gösterir).
 */
export async function GET(request: Request) {
  const access = await checkCrmAccess()
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.error }, { status: access.status })
  }

  const { searchParams } = new URL(request.url)
  const statusParam = searchParams.get('status') ?? 'all'
  const status = (VALID_STATUS.includes(statusParam as CrmLeadStatus | 'all') ? statusParam : 'all') as
    | CrmLeadStatus
    | 'all'
  const limit = parseInt(searchParams.get('limit') ?? '50', 10)
  const offset = parseInt(searchParams.get('offset') ?? '0', 10)

  const result = await listLeads(access.user.id, { status, limit, offset })

  const leads = result.leads.map((l) => ({
    id: l.id,
    fullName: l.full_name ?? null,
    email: maskEmail(l.email),
    phone: maskPhone(l.phone),
    campaignName: l.campaign_name,
    formName: l.form_name,
    status: l.status,
    note: l.note,
    createdAt: l.created_at,
    leadCreatedTime: l.lead_created_time,
    metaSyncedAt: l.meta_synced_at,
  }))

  return NextResponse.json({ ok: true, leads, total: result.total, counts: result.counts })
}
