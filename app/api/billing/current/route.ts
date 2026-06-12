import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/billing/user'
import { getSubscription, getCreditBalance } from '@/lib/billing/db'
import { isSuperAdminEmail } from '@/lib/admin/superAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 })
    }

    // Super-admin / owner override — allowlisted accounts always see an
    // active enterprise plan so client-side gating (sidebar label, AI scan
    // buttons, optimization access) treats them as fully-entitled users.
    // Backend feature guards still re-check independently.
    if (isSuperAdminEmail(user.email)) {
      const credits = await getCreditBalance(user.id)
      return NextResponse.json({
        ok: true,
        isOwner: true,
        subscription: {
          planId: 'enterprise',
          status: 'active',
          billingCycle: 'yearly',
          adAccounts: 6,
          trialEndDate: null,
          currentPeriodEnd: new Date(Date.now() + 365 * 86_400_000).toISOString(),
          startDate: new Date().toISOString(),
        },
        credits: {
          balance: credits.balance,
          totalEarned: credits.total_earned,
          totalSpent: credits.total_spent,
        },
      })
    }

    const [sub, credits] = await Promise.all([
      getSubscription(user.id),
      getCreditBalance(user.id),
    ])

    return NextResponse.json({
      ok: true,
      isOwner: false,
      subscription: sub
        ? {
            planId: sub.plan_id,
            status: sub.status,
            billingCycle: sub.billing_cycle,
            adAccounts: sub.ad_accounts,
            trialEndDate: sub.trial_end_date,
            currentPeriodEnd: sub.current_period_end,
            cancelAtPeriodEnd: sub.cancel_at_period_end,
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
