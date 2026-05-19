/* ──────────────────────────────────────────────────────────
   Inngest Client (singleton)

   Faz 2: YoAlgoritma AI Engine için durable agentic loop.
   Vercel cron 300s sınırına takılmamak için fan-out + per-account
   Inngest event'leri kullanılır.

   Inngest opsiyoneldir: INNGEST_EVENT_KEY tanımlı değilse cron
   endpoint inline mod'a düşer (test/dev için).
   ────────────────────────────────────────────────────────── */

import { Inngest } from 'inngest'

export const inngest = new Inngest({
  id: 'yoai-ai-engine',
  name: 'YoAi AI Engine',
})

export function isInngestReady(): boolean {
  return Boolean(process.env.INNGEST_EVENT_KEY || process.env.INNGEST_DEV)
}
