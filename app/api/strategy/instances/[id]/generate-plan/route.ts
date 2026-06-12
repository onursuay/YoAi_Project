import { NextResponse } from 'next/server'
import { readUserId } from '@/lib/auth/userCookie'
import { cookies } from 'next/headers'
import { supabase } from '@/lib/supabase/client'
import { resolveMetaContext } from '@/lib/meta/context'
import { createJob, runQueuedJobs } from '@/lib/strategy/job-runner'
import { getBusinessContextForUser, buildBusinessContextPromptBlock } from '@/lib/yoai/businessContextStore'
import { isInngestReady, inngest } from '@/inngest/client'

export const dynamic = 'force-dynamic'
// AI blueprint üretimi senkron çalışır (Claude + Meta fetch); platformun
// fonksiyonu erken kesmemesi için süre bütçesi tanı (yoksa şablona düşer).
export const maxDuration = 60

// POST /api/strategy/instances/:id/generate-plan — Plan üretim job'u başlat
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!supabase) {
    return NextResponse.json({ ok: false, error: 'database_unavailable' }, { status: 503 })
  }

  const ctx = await resolveMetaContext()
  if (!ctx) {
    return NextResponse.json({ ok: false, error: 'missing_token', message: 'Meta bağlantısı gerekli' }, { status: 401 })
  }

  const { id } = await params

  const { data: instance } = await supabase
    .from('strategy_instances')
    .select('id, status')
    .eq('id', id)
    .eq('ad_account_id', ctx.accountId)
    .single()

  if (!instance) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  // Business context — kullanıcı işletme bağlamını strateji input payload'una enjekte et
  try {
    const cookieStore = await cookies()
    const userId = readUserId(cookieStore)
    if (userId) {
      const businessContext = await getBusinessContextForUser(userId)
      const block = businessContext ? buildBusinessContextPromptBlock(businessContext) : null
      if (block) {
        const { data: latestInput } = await supabase
          .from('strategy_inputs')
          .select('id, payload')
          .eq('strategy_instance_id', id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()
        if (latestInput?.id) {
          const newPayload = { ...(latestInput.payload as object), _yoai_business_context_prompt: block }
          await supabase.from('strategy_inputs').update({ payload: newPayload }).eq('id', latestInput.id)
        }
      }
    }
  } catch (e) {
    console.warn('[strategy/generate-plan] business context inject failed (non-fatal):', e)
  }

  const jobId = await createJob(id, 'generate_plan')
  if (!jobId) {
    return NextResponse.json({ ok: false, error: 'job_create_failed' }, { status: 500 })
  }

  // Durumu hemen GENERATING_PLAN yap → UI spinner + polling devreye girer
  await supabase
    .from('strategy_instances')
    .update({ status: 'GENERATING_PLAN', updated_at: new Date().toISOString() })
    .eq('id', id)

  // Üretimi ARKA PLANDA çalıştır — Claude blueprint (8000 token) senkron
  // HTTP'de 60s limitini aşıyordu. Inngest hazırsa event; değilse (dev) inline.
  if (isInngestReady()) {
    await inngest.send({ name: 'strategy/run-jobs', data: { instanceId: id } })
    return NextResponse.json({ ok: true, jobId, mode: 'inngest', message: 'Plan üretimi başlatıldı' })
  }

  const result = await runQueuedJobs()
  return NextResponse.json({ ok: true, jobId, mode: 'inline', message: 'Plan üretimi tamamlandı', ...result })
}
