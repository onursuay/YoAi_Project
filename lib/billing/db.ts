/**
 * Subscription + credit + transaction DB helpers (Supabase).
 * Consumed only by billing API routes — never import from client code.
 */

import 'server-only'
import { supabase } from '@/lib/supabase/client'
import type { PricedCreditPack, PricedSubscription } from './catalog'

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
  return (data as SubscriptionRow) ?? null
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

export async function applySubscriptionPurchase(userId: string, priced: PricedSubscription): Promise<void> {
  const db = requireClient()
  const now = new Date()
  const periodEnd = new Date(now.getTime() + priced.periodDays * 86_400_000).toISOString()

  await db.from('subscriptions').upsert({
    user_id: userId,
    plan_id: priced.planId,
    status: 'active',
    billing_cycle: priced.billingCycle,
    ad_accounts: priced.adAccounts,
    trial_end_date: null,
    current_period_end: periodEnd,
    started_at: now.toISOString(),
    updated_at: now.toISOString(),
  }, { onConflict: 'user_id' })

  if (priced.bundledCredits > 0) {
    await addCreditsServer(userId, priced.bundledCredits)
  }
}

export async function addCreditsServer(userId: string, amount: number): Promise<CreditRow> {
  const current = await getCreditBalance(userId)
  const db = requireClient()
  const { data, error } = await db
    .from('credit_balances')
    .update({
      balance: current.balance + amount,
      total_earned: current.total_earned + amount,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .select('*')
    .single()
  if (error) throw error
  return data as CreditRow
}

export async function spendCreditsServer(userId: string, amount: number): Promise<CreditRow | null> {
  const current = await getCreditBalance(userId)
  if (current.balance < amount) return null
  const db = requireClient()
  const { data, error } = await db
    .from('credit_balances')
    .update({
      balance: current.balance - amount,
      total_spent: current.total_spent + amount,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .select('*')
    .single()
  if (error) throw error
  return data as CreditRow
}

export async function refundCreditsServer(userId: string, amount: number): Promise<CreditRow> {
  const current = await getCreditBalance(userId)
  const db = requireClient()
  const { data, error } = await db
    .from('credit_balances')
    .update({
      balance: current.balance + amount,
      total_spent: Math.max(0, current.total_spent - amount),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .select('*')
    .single()
  if (error) throw error
  return data as CreditRow
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

export async function markTransactionSucceeded(txId: string, paymentId: string, rawCallback: unknown) {
  const db = requireClient()
  const { error } = await db.from('payment_transactions').update({
    status: 'succeeded',
    iyzico_payment_id: paymentId,
    raw_callback: rawCallback as any,
    processed_at: new Date().toISOString(),
  }).eq('id', txId).eq('status', 'pending')
  if (error) throw error
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
