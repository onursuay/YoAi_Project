/* ──────────────────────────────────────────────────────────
   Inngest Serve Endpoint
   Vercel'de /api/inngest üzerinden Inngest function'ları
   sunar. Inngest Cloud bu endpoint'i polled.
   ────────────────────────────────────────────────────────── */

import { serve } from 'inngest/next'
import { inngest } from '@/inngest/client'
import { yoalgoritmaScanUser } from '@/inngest/functions/yoalgoritmaScan'

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [yoalgoritmaScanUser],
})
