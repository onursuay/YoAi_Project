/**
 * Subscription + credit + transaction DB helpers (Supabase).
 * Consumed only by billing API routes — never import from client code.
 */

import 'server-only'
import { supabase } from '@/lib/supabase/client'
import type { PricedCreditPack, PricedSubscription } from './catalog'
import { SUBSCRIPTION_PLANS } from '@/lib/subscription/plans'

function requireClient() {
  if (!supabase) throw new Error('SUPABASE_NOT_CONFIGURED')
  return supabase
}

export interface SubscriptionRow {
  user_id: string
  plan_id: string
  status: 'trial' | 'active' | 'cancelled' | 'expired'
  billing_cycle: 'monthly' | 'yearly'
  ad_accounts: number
  trial_end_date: string | null
  current_period_end: string
  cancel_at_period_end: boolean
  started_at: string
  updated_at: string
}

export interface CreditRow {
  user_id: string
  balance: number
  total_earned: number
  total_spent: number
  updated_at: string
}

export async function getSubscription(userId: string): Promise<SubscriptionRow | null> {
  const db = requireClient()
  const { data } = await db.from('subscriptions').select('*').eq('user_id', userId).maybeSingle()
  if (!data) return null
  const sub = data as SubscriptionRow

  // Lazy expiry: süresi/denemesi geçmiş abonelik 'expired'a çevrilir (kalıcı).
  // Tüm okuyucular (billing/current, serverGuard) buradan geçtiği için erişim
  // kontrolü tek noktadan doğru olur. Otomatik yenileme devreye girdiğinde
  // renewal current_period_end'i ileri taşıyacağı için bu tetiklenmez.
  const now = Date.now()
  const periodEnded = !!sub.current_period_end && new Date(sub.current_period_end).getTime() < now
  const trialEnded = !!sub.trial_end_date && new Date(sub.trial_end_date).getTime() < now
  const shouldExpire =
    (sub.status === 'active' && periodEnded) ||
    (sub.status === 'trial' && (trialEnded || periodEnded))

  if (shouldExpire) {
    await db.from('subscriptions')
      .update({ status: 'expired', updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .in('status', ['active', 'trial'])
    return { ...sub, status: 'expired' }
  }
  return sub
}

export async function getCreditBalance(userId: string): Promise<CreditRow> {
  const db = requireClient()
  const { data } = await db.from('credit_balances').select('*').eq('user_id', userId).maybeSingle()
  if (data) return data as CreditRow

  // First-touch: create the default row atomically
  const { data: inserted, error } = await db
    .from('credit_balances')
    .insert({ user_id: userId, balance: 100, total_earned: 100, total_spent: 0 })
    .select('*')
    .single()
  if (error) {
    // Race: another request created it first
    const { data: retry } = await db.from('credit_balances').select('*').eq('user_id', userId).maybeSingle()
    if (retry) return retry as CreditRow
    throw error
  }
  return inserted as CreditRow
}

/**
 * Yeni kullanıcıya 14 günlük Premium DENEME başlatır (kredi kartı GEREKMEZ).
 * Idempotent: kullanıcının zaten bir aboneliği (trial/active/expired/cancelled)
 * varsa hiçbir şey yapmaz — ücretli aboneliği ezmez, biten trial'ı tekrar açmaz.
 * Otomatik tahsilat (yenileme) YOK; trial bitince getSubscription 'expired' yapar
 * ve kullanıcı ödemeye yönlendirilir. (Recurring iyzico kart-saklamaya bağlı, ayrı.)
 */
export async function startTrial(userId: string): Promise<boolean> {
  const db = requireClient()
  const { data: existing } = await db
    .from('subscriptions')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle()
  if (existing) return false

  const plan = SUBSCRIPTION_PLANS.find((p) => p.id === 'premium')
  const trialDays = plan?.trialDays || 14
  const now = new Date()
  const end = new Date(now.getTime() + trialDays * 86_400_000).toISOString()

  const { error } = await db.from('subscriptions').insert({
    user_id: userId,
    plan_id: 'premium',
    status: 'trial',
    billing_cycle: 'monthly',
    ad_accounts: plan?.adAccountLimit ?? 2,
    trial_end_date: end,
    current_period_end: end,
    started_at: now.toISOString(),
    updated_at: now.toISOString(),
  })
  if (error) {
    // Race (eşzamanlı ilk istek): satır oluştuysa sorun değil.
    if (!String(error.message || '').includes('duplicate')) {
      console.error('[startTrial] insert failed:', error.message)
    }
    return false
  }
  return true
}

/**
 * Aboneliği dönem sonunda iptal eder (yenileme yok). Erişim current_period_end'e
 * kadar KORUNUR (ödenen dönem hakkı). Yalnız active/trial aboneliğe uygulanır.
 * Döndürür: iptal başarılıysa erişimin biteceği tarih (ISO) veya null.
 */
export async function cancelSubscription(userId: string): Promise<{ ok: boolean; accessUntil: string | null }> {
  const db = requireClient()
  const { data } = await db
    .from('subscriptions')
    .select('status, current_period_end, trial_end_date')
    .eq('user_id', userId)
    .maybeSingle()
  const sub = data as { status?: string; current_period_end?: string; trial_end_date?: string | null } | null
  if (!sub || (sub.status !== 'active' && sub.status !== 'trial')) {
    return { ok: false, accessUntil: null }
  }
  await db
    .from('subscriptions')
    .update({ cancel_at_period_end: true, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .in('status', ['active', 'trial'])
  const accessUntil = sub.status === 'trial' ? (sub.trial_end_date ?? sub.current_period_end ?? null) : (sub.current_period_end ?? null)
  return { ok: true, accessUntil }
}

export async function applySubscriptionPurchase(userId: string, priced: PricedSubscription): Promise<void> {
  const db = requireClient()
  const now = new Date()

  // Yenilemede kalan günleri kaybetme: hâlâ aktif ve süresi dolmamışsa yeni
  // dönemi mevcut dönem sonundan uzat; aksi halde şimdiden başlat.
  const { data: existing } = await db
    .from('subscriptions')
    .select('status, current_period_end')
    .eq('user_id', userId)
    .maybeSingle()

  let baseMs = now.getTime()
  if (existing?.status === 'active' && existing.current_period_end) {
    const end = new Date(existing.current_period_end).getTime()
    if (end > baseMs) baseMs = end
  }
  const periodEnd = new Date(baseMs + priced.periodDays * 86_400_000).toISOString()

  await db.from('subscriptions').upsert({
    user_id: userId,
    plan_id: priced.planId,
    status: 'active',
    billing_cycle: priced.billingCycle,
    ad_accounts: priced.adAccounts,
    trial_end_date: null,
    current_period_end: periodEnd,
    cancel_at_period_end: false, // yeni satın alma iptal bayrağını sıfırlar
    started_at: now.toISOString(),
    updated_at: now.toISOString(),
  }, { onConflict: 'user_id' })

  if (priced.bundledCredits > 0) {
    await addCreditsServer(userId, priced.bundledCredits, 'bundled')
  }
}

// Kredi mutasyonları DB tarafında ATOMİKtir (RPC). JS'te oku-değiştir-yaz
// YASAK — eşzamanlı işlemde lost update / çift harcamaya yol açar.
// getCreditBalance önce çağrılır: yeni kullanıcı için 100-hoşgeldin satırını
// idempotent garanti eder (RPC'ler satır varlığına güvenir).

export async function addCreditsServer(userId: string, amount: number, reason = 'grant'): Promise<CreditRow> {
  const db = requireClient()
  await getCreditBalance(userId)
  const { data, error } = await db.rpc('add_credits', { p_user_id: userId, p_amount: amount, p_reason: reason })
  if (error) throw error
  const row = (Array.isArray(data) ? data[0] : data) as CreditRow | undefined
  if (!row) throw new Error('ADD_CREDITS_FAILED')
  return row
}

export async function spendCreditsServer(userId: string, amount: number, reason = 'spend'): Promise<CreditRow | null> {
  const db = requireClient()
  await getCreditBalance(userId)
  const { data, error } = await db.rpc('spend_credits', { p_user_id: userId, p_amount: amount, p_reason: reason })
  if (error) throw error
  // 0 satır → yetersiz bakiye (atomik WHERE balance >= amount eşleşmedi)
  const row = (Array.isArray(data) ? data[0] : data) as CreditRow | undefined
  return row ?? null
}

export async function refundCreditsServer(userId: string, amount: number, reason = 'refund'): Promise<CreditRow> {
  const db = requireClient()
  await getCreditBalance(userId)
  const { data, error } = await db.rpc('refund_credits', { p_user_id: userId, p_amount: amount, p_reason: reason })
  if (error) throw error
  const row = (Array.isArray(data) ? data[0] : data) as CreditRow | undefined
  if (!row) throw new Error('REFUND_CREDITS_FAILED')
  return row
}

export interface CreateTxInput {
  userId: string
  conversationId: string
  itemType: 'subscription' | 'credit_pack'
  planId?: string
  packageId?: string
  billingCycle?: 'monthly' | 'yearly'
  adAccounts?: number
  amount: number
  currency: 'TRY'
}

export async function createPendingTransaction(input: CreateTxInput) {
  const db = requireClient()
  const { data, error } = await db.from('payment_transactions').insert({
    user_id: input.userId,
    conversation_id: input.conversationId,
    item_type: input.itemType,
    plan_id: input.planId ?? null,
    package_id: input.packageId ?? null,
    billing_cycle: input.billingCycle ?? null,
    ad_accounts: input.adAccounts ?? null,
    amount: input.amount,
    currency: input.currency,
    status: 'pending',
  }).select('*').single()
  if (error) throw error
  return data
}

export async function attachIyzicoToken(txId: string, token: string, rawInit: unknown) {
  const db = requireClient()
  await db.from('payment_transactions').update({
    iyzico_token: token,
    raw_init: rawInit as any,
  }).eq('id', txId)
}

export async function findTransactionByToken(token: string) {
  const db = requireClient()
  const { data } = await db.from('payment_transactions').select('*').eq('iyzico_token', token).maybeSingle()
  return data
}

/**
 * pending → succeeded geçişini atomik yapar ve BU çağrının geçişi KAZANIP
 * kazanmadığını döner. Eşzamanlı callback'lerde (İyzico server POST + tarayıcı
 * redirect / İyzico retry) yalnız `.eq('status','pending')` filtresine takılan
 * TEK çağrı 1 satır günceller. Çağıran, entitlement'ı yalnız `true` dönerse
 * verir → çift kredi / çift abonelik dönemi engellenir.
 */
export async function markTransactionSucceeded(txId: string, paymentId: string, rawCallback: unknown): Promise<boolean> {
  const db = requireClient()
  const { data, error } = await db.from('payment_transactions').update({
    status: 'succeeded',
    iyzico_payment_id: paymentId,
    raw_callback: rawCallback as any,
    processed_at: new Date().toISOString(),
  }).eq('id', txId).eq('status', 'pending').select('id')
  if (error) throw error
  return (data?.length ?? 0) > 0
}

/**
 * Ödeme sonrası entitlement (grant) durumunu işaretler.
 * 'failed' = ödeme alındı ama abonelik/kredi verilemedi → reconcile gerek.
 */
export async function setGrantStatus(txId: string, status: 'granted' | 'failed') {
  const db = requireClient()
  await db.from('payment_transactions').update({ grant_status: status }).eq('id', txId)
}

export async function markTransactionFailed(txId: string, rawCallback: unknown) {
  const db = requireClient()
  await db.from('payment_transactions').update({
    status: 'failed',
    raw_callback: rawCallback as any,
    processed_at: new Date().toISOString(),
  }).eq('id', txId)
}

export { type PricedSubscription, type PricedCreditPack }
