import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/billing/user'
import { cancelSubscription } from '@/lib/billing/db'
import { isSuperAdminEmail } from '@/lib/admin/superAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Aboneliği dönem sonunda iptal eder (yenileme yok). Erişim ödenen dönem
 * sonuna kadar korunur. Backend otoriter — UI sadece tetikler.
 */
export async function POST() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 })
    }
    // Owner enterprise-stub kullanır; iptal edilecek gerçek aboneliği yok.
    if (isSuperAdminEmail(user.email)) {
      return NextResponse.json({ ok: true, accessUntil: null, owner: true })
    }
    const result = await cancelSubscription(user.id)
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: 'no_active_subscription' }, { status: 400 })
    }
    return NextResponse.json({ ok: true, accessUntil: result.accessUntil })
  } catch (error) {
    console.error('[Billing] cancel error:', error instanceof Error ? error.message : error)
    return NextResponse.json({ ok: false, error: 'internal_error' }, { status: 500 })
  }
}
