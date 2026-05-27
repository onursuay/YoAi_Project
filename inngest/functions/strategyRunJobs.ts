/* ──────────────────────────────────────────────────────────
   Inngest Function: strategy/run-jobs

   Strateji kuyruğundaki işleri (analyze → generate_plan → apply →
   pull_metrics → optimize) ARKA PLANDA çalıştırır.

   Neden: AI blueprint üretimi (Claude, max_tokens 8000) senkron HTTP
   isteği içinde 60s Vercel fonksiyon limitini aşıp ya şablona düşüyor
   ya da yarıda ölüp instance'ı GENERATING_PLAN'da bırakıyordu. Inngest
   ile istek anında döner, üretim arka planda tamamlanır; UI zaten
   GENERATING_PLAN durumunda polling yapıp sonucu yakalar.

   Concurrency 1: aynı anda tek runner — aynı job'un iki invocation
   tarafından çift işlenmesini önler (strateji düşük hacimli).
   ────────────────────────────────────────────────────────── */

import { inngest } from '../client'
import { runQueuedJobs } from '@/lib/strategy/job-runner'

export const strategyRunJobs = inngest.createFunction(
  {
    id: 'strategy-run-jobs',
    name: 'Strateji — Kuyruktaki işleri çalıştır',
    concurrency: { limit: 1 },
    retries: 1,
    triggers: [{ event: 'strategy/run-jobs' }],
  },
  async ({ step, logger }) => {
    const result = await step.run('run-queued-jobs', async () => runQueuedJobs())
    logger.info(`[strategy/run-jobs] processed=${result.processed} errors=${result.errors}`)
    return result
  },
)
