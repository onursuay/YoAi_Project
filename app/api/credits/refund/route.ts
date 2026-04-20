import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/billing/user'
import { refundCreditsServer } from '@/lib/billing/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const amount = Math.max(1, Math.floor(Number(body?.amount) || 0))
  if (!amount) return NextResponse.json({ ok: false, error: 'invalid_amount' }, { status: 400 })

  const row = await refundCreditsServer(user.id, amount)
  return NextResponse.json({
    ok: true,
    credits: { balance: row.balance, totalEarned: row.total_earned, totalSpent: row.total_spent },
  })
}
