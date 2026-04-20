import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { getCurrentUser } from '@/lib/billing/user'
import { priceSubscription, priceCreditPack } from '@/lib/billing/catalog'
import { createPendingTransaction, attachIyzicoToken } from '@/lib/billing/db'
import { initCheckoutForm } from '@/lib/billing/iyzico'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function getBaseUrl(req: Request): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL
  if (configured) return configured.replace(/\/$/, '')
  const origin = new URL(req.url).origin
  return origin
}

function splitName(full: string | null): { name: string; surname: string } {
  const parts = (full ?? '').trim().split(/\s+/)
  if (parts.length === 0 || !parts[0]) return { name: 'Musteri', surname: '-' }
  if (parts.length === 1) return { name: parts[0], surname: '-' }
  return { name: parts.slice(0, -1).join(' '), surname: parts.slice(-1)[0] }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const { type, planId, packageId, billingCycle, adAccounts } = body as {
      type?: string
      planId?: string
      packageId?: string
      billingCycle?: string
      adAccounts?: number
    }

    let itemType: 'subscription' | 'credit_pack'
    let amount: number
    let itemName: string
    let txInput: Parameters<typeof createPendingTransaction>[0]

    if (type === 'subscription') {
      const priced = priceSubscription(planId ?? '', billingCycle ?? '', adAccounts)
      if (!priced) {
        return NextResponse.json({ ok: false, error: 'invalid_plan' }, { status: 400 })
      }
      itemType = 'subscription'
      amount = priced.amount
      itemName = `YoAi ${priced.planId} (${priced.billingCycle}, ${priced.adAccounts} reklam hesabı)`
      txInput = {
        userId: user.id,
        conversationId: '',
        itemType,
        planId: priced.planId,
        billingCycle: priced.billingCycle,
        adAccounts: priced.adAccounts,
        amount,
        currency: 'TRY',
      }
    } else if (type === 'credit_pack') {
      const priced = priceCreditPack(packageId ?? '')
      if (!priced) {
        return NextResponse.json({ ok: false, error: 'invalid_package' }, { status: 400 })
      }
      itemType = 'credit_pack'
      amount = priced.amount
      itemName = `YoAi ${priced.credits} Kredi Paketi`
      txInput = {
        userId: user.id,
        conversationId: '',
        itemType,
        packageId: priced.packageId,
        amount,
        currency: 'TRY',
      }
    } else {
      return NextResponse.json({ ok: false, error: 'invalid_type' }, { status: 400 })
    }

    const conversationId = `${user.id}:${randomUUID()}`
    txInput.conversationId = conversationId

    const tx = await createPendingTransaction(txInput)

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || '127.0.0.1'

    const { name, surname } = splitName(user.name)
    const base = getBaseUrl(request)

    const result = await initCheckoutForm({
      conversationId,
      price: amount,
      paidPrice: amount,
      currency: 'TRY',
      callbackUrl: `${base}/api/billing/iyzico/callback`,
      basketId: tx.id,
      itemName,
      itemCategory: itemType,
      buyer: { id: user.id, name, surname, email: user.email, ip },
    })

    await attachIyzicoToken(tx.id, result.token, result.raw)

    return NextResponse.json({ ok: true, paymentPageUrl: result.paymentPageUrl, token: result.token })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'unknown'
    console.error('[Billing] start error:', msg)
    if (msg === 'IYZICO_NOT_CONFIGURED') {
      return NextResponse.json({ ok: false, error: 'iyzico_not_configured' }, { status: 503 })
    }
    return NextResponse.json({ ok: false, error: 'internal_error' }, { status: 500 })
  }
}
