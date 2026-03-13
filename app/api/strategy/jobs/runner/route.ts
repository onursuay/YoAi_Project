import { NextResponse } from 'next/server'
import { runQueuedJobs } from '@/lib/strategy/job-runner'

export const dynamic = 'force-dynamic'

// POST /api/strategy/jobs/runner — Job runner'ı tetikle (cron veya manuel)
export async function POST(request: Request) {
  // Basit secret kontrolü (cron güvenliği)
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const result = await runQueuedJobs()

  return NextResponse.json({
    ok: true,
    processed: result.processed,
    errors: result.errors,
  })
}
