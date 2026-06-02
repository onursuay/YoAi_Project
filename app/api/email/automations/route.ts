import { NextResponse } from 'next/server'
import { checkEmailAccess } from '@/lib/email/guard'
import { listAutomations, upsertAutomation, type AutomationTrigger } from '@/lib/email/automationStore'
import { listSteps, replaceSteps, type StepInput } from '@/lib/email/automationStepsStore'

export const dynamic = 'force-dynamic'

/** GET /api/email/automations — kullanıcının tüm otomasyonları. */
export async function GET() {
  const access = await checkEmailAccess()
  if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: access.status })

  const automations = await listAutomations(access.user.id)
  const withSteps = await Promise.all(
    automations.map(async (a) => ({
      id: a.id,
      name: a.name,
      trigger: a.trigger,
      subject: a.subject,
      html: a.html,
      enabled: a.enabled,
      createdAt: a.created_at,
      steps: await listSteps(a.id),
    }))
  )
  return NextResponse.json({ ok: true, automations: withSteps })
}

/** POST /api/email/automations — yeni otomasyon. */
export async function POST(request: Request) {
  const access = await checkEmailAccess()
  if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: access.status })

  let body: { name?: string; trigger?: AutomationTrigger; subject?: string; html?: string; enabled?: boolean; steps?: StepInput[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })
  }

  const row = await upsertAutomation(access.user.id, {
    name: body.name ?? '',
    trigger: body.trigger,
    subject: body.subject ?? '',
    html: body.html ?? '',
    enabled: body.enabled ?? true,
  })
  if (!row) return NextResponse.json({ ok: false, error: 'save_failed' }, { status: 500 })

  const steps = Array.isArray(body.steps) ? (body.steps as StepInput[]) : []
  if (steps.length > 0 && row) {
    await replaceSteps(row.id, steps)
  }

  return NextResponse.json({ ok: true, id: row.id })
}
