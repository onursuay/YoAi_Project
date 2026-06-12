/* ──────────────────────────────────────────────────────────
   YoAi — Audience Business Context API

   Hedef Kitle UI'sı ve ileride bağlanacak AI persona generator
   için Business Intelligence Memory tabanlı runtime context'i
   döner.

   Bu endpoint cookie-tabanlı kullanıcı ile çağrılır;
   `getAudienceBusinessContext(userId)` business context store
   üzerinden seed hint'leri (sector, location, audience pains,
   motivations, recommended objectives) sağlar.
   ────────────────────────────────────────────────────────── */

import { NextResponse } from 'next/server'
import { readUserId } from '@/lib/auth/userCookie'
import { cookies } from 'next/headers'
import { getAudienceBusinessContext } from '@/lib/yoai/audienceBusinessContext'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const cookieStore = await cookies()
    const userId = readUserId(cookieStore)
    if (!userId) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Oturum gerekli',
          businessContextLoaded: false,
        },
        { status: 401 },
      )
    }

    const ctx = await getAudienceBusinessContext(userId)
    return NextResponse.json({ ok: true, data: ctx })
  } catch (e) {
    console.error('[api/audiences/business-context] error:', e)
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 })
  }
}
