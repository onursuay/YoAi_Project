import { NextResponse } from 'next/server'
import { retrieveCheckoutForm } from '@/lib/billing/iyzico'
import {
  findTransactionByToken,
  markTransactionSucceeded,
  markTransactionFailed,
  applySubscriptionPurchase,
  addCreditsServer,
} from '@/lib/billing/db'
import { priceSubscription, priceCreditPack } from '@/lib/billing/catalog'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function redirect(base: string, status: 'success' | 'failed', reason?: string) {
  const params = new URLSearchParams({ payment: status })
  if (reason) params.set('reason', reason)
  return NextResponse.redirect(`${base}/abonelik?${params.toString()}`, { status: 303 })
}

async function handle(request: Request): Promise<Response> {
  const base = (process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin).replace(/\/$/, '')

  try {
    // Iyzico POSTs application/x-www-form-urlencoded with `token`
    let token: string | null = null
    const ctype = request.headers.get('content-type') || ''
    if (ctype.includes('application/x-www-form-urlencoded') || ctype.includes('multipart/form-data')) {
      const form = await request.formData()
      token = String(form.get('token') ?? '')
    } else if (ctype.includes('application/json')) {
      const body = await request.json().catch(() => ({}))
      token = body?.token ?? null
    } else {
      const url = new URL(request.url)
      token = url.searchParams.get('token')
    }

    if (!token) return redirect(base, 'failed', 'missing_token')

    const tx = await findTransactionByToken(token)
    if (!tx) return redirect(base, 'failed', 'unknown_transaction')

    // Idempotent: if already processed, just redirect with the final state
    if (tx.status === 'succeeded' || tx.status === 'processed') {
      return redirect(base, 'success')
    }
    if (tx.status === 'failed') {
      return redirect(base, 'failed', 'already_failed')
    }

    const retrieved = await retrieveCheckoutForm(token)

    const isSuccess =
      retrieved.status === 'success' &&
      retrieved.paymentStatus === 'SUCCESS' &&
      retrieved.conversationId === tx.conversation_id &&
      retrieved.paymentId

    if (!isSuccess) {
      await markTransactionFailed(tx.id, retrieved.raw)
      return redirect(base, 'failed', 'not_verified')
    }

    // Re-derive the expected amount server-side from the stored plan/package
    // and compare against what Iyzico reports. This rejects any tampering.
    let expectedAmount: number | null = null
    if (tx.item_type === 'subscription') {
      const priced = priceSubscription(tx.plan_id ?? '', tx.billing_cycle ?? '', tx.ad_accounts ?? undefined)
      expectedAmount = priced?.amount ?? null
    } else if (tx.item_type === 'credit_pack') {
      const priced = priceCreditPack(tx.package_id ?? '')
      expectedAmount = priced?.amount ?? null
    }

    if (expectedAmount == null || Number(retrieved.paidPrice) !== expectedAmount) {
      await markTransactionFailed(tx.id, retrieved.raw)
      return redirect(base, 'failed', 'amount_mismatch')
    }

    // Mark succeeded first (atomic: only one caller wins the pending→succeeded
    // transition because of the `.eq('status', 'pending')` guard).
    await markTransactionSucceeded(tx.id, String(retrieved.paymentId), retrieved.raw)

    // Grant entitlements
    if (tx.item_type === 'subscription') {
      const priced = priceSubscription(tx.plan_id ?? '', tx.billing_cycle ?? '', tx.ad_accounts ?? undefined)
      if (priced) await applySubscriptionPurchase(tx.user_id, priced)
    } else if (tx.item_type === 'credit_pack') {
      const priced = priceCreditPack(tx.package_id ?? '')
      if (priced) await addCreditsServer(tx.user_id, priced.credits)
    }

    return redirect(base, 'success')
  } catch (error) {
    console.error('[Billing] callback error:', error instanceof Error ? error.message : error)
    return redirect(base, 'failed', 'server_error')
  }
}

export async function POST(request: Request) { return handle(request) }
export async function GET(request: Request)  { return handle(request) }
