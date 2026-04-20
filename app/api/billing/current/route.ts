import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/billing/user'
import { getSubscription, getCreditBalance } from '@/lib/billing/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 })
    }

    const [sub, credits] = await Promise.all([
      getSubscription(user.id),
      getCreditBalance(user.id),
    ])

    return NextResponse.json({
      ok: true,
      subscription: sub
        ? {
            planId: sub.plan_id,
            status: sub.status,
            billingCycle: sub.billing_cycle,
            adAccounts: sub.ad_accounts,
            trialEndDate: sub.trial_end_date,
            currentPeriodEnd: sub.current_period_end,
            startDate: sub.started_at,
          }
        : null,
      credits: {
        balance: credits.balance,
        totalEarned: credits.total_earned,
        totalSpent: credits.total_spent,
      },
    })
  } catch (error) {
    console.error('[Billing] current error:', error instanceof Error ? error.message : error)
    return NextResponse.json({ ok: false, error: 'internal_error' }, { status: 500 })
  }
}
