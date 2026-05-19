/* ──────────────────────────────────────────────────────────
   Inngest Function: yoalgoritma/scan.user

   Tek bir kullanıcı için AI engine taraması — durable execution.
   Event payload: { userId: string }

   Vercel cron 300s sınırına karşı durable çözüm. Inngest tarafı
   retry + concurrency limit yönetir; bizim fonksiyon idempotent
   (ai_engine_runs UNIQUE(user, platform, account, day)).
   ────────────────────────────────────────────────────────── */

import { inngest } from '../client'
import { scanUserWithAiEngine } from '@/lib/yoai/ai/scanUser'

export const yoalgoritmaScanUser = inngest.createFunction(
  {
    id: 'yoalgoritma-scan-user',
    name: 'YoAlgoritma — Per-User AI Scan',
    concurrency: { limit: 5 },  // aynı anda max 5 kullanıcı
    retries: 2,
    triggers: [{ event: 'yoalgoritma/scan.user' }],
  },
  async ({ event, step }) => {
    const userId = String(event.data?.userId ?? '')
    if (!userId) throw new Error('userId zorunlu')

    const result = await step.run('scan-user', async () => {
      return await scanUserWithAiEngine(userId)
    })

    return {
      userId,
      metaRanAi: result.meta.ranAi,
      googleRanAi: result.google.ranAi,
      totalAlerts: result.totalAiAlerts,
      totalOpportunities: result.totalAiOpportunities,
      totalSuggestions: result.totalAiSuggestions,
    }
  },
)
