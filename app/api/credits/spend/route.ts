import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/billing/user'
import { spendCreditsServer } from '@/lib/billing/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const amount = Math.max(1, Math.floor(Number(body?.amount) || 0))
  if (!amount) return NextResponse.json({ ok: false, error: 'invalid_amount' }, { status: 400 })

  const row = await spendCreditsServer(user.id, amount)
  if (!row) return NextResponse.json({ ok: false, error: 'insufficient_credits' }, { status: 402 })

  return NextResponse.json({
    ok: true,
    credits: { balance: row.balance, totalEarned: row.total_earned, totalSpent: row.total_spent },
  })
}
