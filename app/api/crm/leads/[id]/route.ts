import { NextResponse } from 'next/server'
import { checkCrmAccess } from '@/lib/crm/guard'
import { getLead, updateLeadStatus, CRM_STAGES, type CrmLeadStatus } from '@/lib/crm/leadStore'
import { syncLeadToMeta } from '@/lib/crm/metaSync'
import { runStageAutomations } from '@/lib/email/automationRunner'

export const dynamic = 'force-dynamic'

const VALID: ReadonlyArray<CrmLeadStatus> = CRM_STAGES

/**
 * GET /api/crm/leads/[id] — tek lead'in tam detayı (kullanıcının KENDİ lead'i;
 * iletişim için e-posta/telefon + tüm field_data MASKESİZ).
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await checkCrmAccess()
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.error }, { status: access.status })
  }
  const { id } = await params
  const lead = await getLead(id, access.user.id)
  if (!lead) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }
  return NextResponse.json({
    ok: true,
    lead: {
      id: lead.id,
      fullName: lead.full_name,
      email: lead.email,
      phone: lead.phone,
      campaignName: lead.campaign_name,
      formName: lead.form_name,
      status: lead.status,
      note: lead.note,
      fieldData: lead.raw_field_data,
      createdAt: lead.created_at,
      leadCreatedTime: lead.lead_created_time,
    },
  })
}

/**
 * PATCH /api/crm/leads/[id]  { status: 'new'|'positive'|'negative', note? }
 * Lead'i olumlu/olumsuz/yeni olarak işaretle.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await checkCrmAccess()
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.error }, { status: access.status })
  }
  const { id } = await params

  let body: { status?: string; note?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })
  }

  const status = String(body.status ?? '') as CrmLeadStatus
  if (!VALID.includes(status)) {
    return NextResponse.json({ ok: false, error: 'invalid_status' }, { status: 400 })
  }

  const note = body.note !== undefined ? String(body.note) : undefined
  const row = await updateLeadStatus(id, access.user.id, status, note)
  if (!row) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  // Faz 2 — Meta senkron + Email otomasyon tetiği (her ikisi de best-effort, paralel).
  // Lead durumu zaten kaydedildi; ikisinin de hatası/timeout'u PATCH'i bozmaz.
  const [metaSync] = await Promise.all([
    Promise.race([
      syncLeadToMeta(access.user.id, row, status).catch((e) => ({
        ok: false as const,
        reason: 'sync_failed' as const,
        error: e instanceof Error ? e.message : String(e),
      })),
      new Promise<{ ok: false; reason: 'sync_timeout' }>((resolve) =>
        setTimeout(() => resolve({ ok: false, reason: 'sync_timeout' }), 9000),
      ),
    ]),
    Promise.race([
      runStageAutomations(access.user.id, row, status).catch(() => {}),
      new Promise<void>((resolve) => setTimeout(resolve, 9000)),
    ]),
  ])

  return NextResponse.json({ ok: true, status: row.status, note: row.note, metaSync })
}
