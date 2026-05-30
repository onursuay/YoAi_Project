import 'server-only'
import { supabase } from '@/lib/supabase/client'
import type { PlanId } from '@/lib/subscription/types'

/**
 * Multi-account slot yönetimi: kullanıcının seçtiği reklam hesaplarını
 * (Meta + Google Ads) plan tier'ına bağlı slot sayısıyla saklar.
 *
 * Mimari sözleşme:
 *  - `user_selected_ad_accounts` tablosu MEVCUT meta_connections / google_ads_connections
 *    tablolarını HİÇ değiştirmez. selected_ad_account_id / customer_id alanları
 *    "aktif (slot 1)" olarak kalır; bu tablo aktif + ek slot'ları takip eder.
 *  - Var olan resolveMetaContext / getGoogleAdsContext kodu dokunulmaz — onlar
 *    aktif hesabı okumaya devam eder. Bu modül üzerinden YALNIZCA seçim listesi
 *    ve tier limit yönetilir.
 *  - Slot 1 her zaman aktif hesap (mirror); slot 2+ ek hesaplar.
 */

export type AdAccountPlatform = 'meta' | 'google_ads'

export interface AdAccountSlot {
  platform: AdAccountPlatform
  account_id: string
  account_name: string | null
  slot_index: number
}

// ─── Tier slot limitleri ─────────────────────────────────────────────────────
// Toplam (Meta + Google birlikte) seçilebilen maksimum hesap sayısı. Owner
// SUPER_ADMIN allowlist'i bu limitten muaftır (enterprise stub).
const SLOT_LIMITS: Record<PlanId, number> = {
  free: 2,
  basic: 2,
  starter: 4,
  premium: 8,
  enterprise: 20,
}

export function getMaxAdAccountsForPlan(planId: PlanId | string | undefined | null): number {
  if (!planId) return 2
  return SLOT_LIMITS[planId as PlanId] ?? 2
}

// ─── DB erişim katmanı ───────────────────────────────────────────────────────

/** Kullanıcının tüm slot'larını (Meta + Google) plat sırasıyla döndürür. */
export async function getSelectedAdAccounts(userId: string): Promise<AdAccountSlot[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('user_selected_ad_accounts')
    .select('platform, account_id, account_name, slot_index')
    .eq('user_id', userId)
    .order('platform', { ascending: true })
    .order('slot_index', { ascending: true })
  if (error || !data) return []
  return data as AdAccountSlot[]
}

/** Toplam seçili hesap sayısı (her iki platformdan). Tier limit kontrolünde kullanılır. */
export async function countSelectedAdAccounts(userId: string): Promise<number> {
  if (!supabase) return 0
  const { count } = await supabase
    .from('user_selected_ad_accounts')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
  return count ?? 0
}

/** Tek bir platform için seçili slot'ları döner. */
export async function getSelectedAdAccountsForPlatform(
  userId: string,
  platform: AdAccountPlatform,
): Promise<AdAccountSlot[]> {
  if (!supabase) return []
  const { data } = await supabase
    .from('user_selected_ad_accounts')
    .select('platform, account_id, account_name, slot_index')
    .eq('user_id', userId)
    .eq('platform', platform)
    .order('slot_index', { ascending: true })
  return (data as AdAccountSlot[]) ?? []
}

/**
 * Bir slot'a hesap yazar (upsert by user_id + platform + slot_index).
 * Çağıran taraf tier limit kontrolünü önceden yapmalı.
 */
export async function setAdAccountSlot(
  userId: string,
  platform: AdAccountPlatform,
  slotIndex: number,
  accountId: string,
  accountName: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!supabase) return { ok: false, error: 'supabase_unavailable' }
  if (slotIndex < 1 || slotIndex > 20) return { ok: false, error: 'invalid_slot_index' }
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('user_selected_ad_accounts')
    .upsert(
      {
        user_id: userId,
        platform,
        slot_index: slotIndex,
        account_id: accountId,
        account_name: accountName,
        selected_at: now,
        updated_at: now,
      },
      { onConflict: 'user_id,platform,slot_index' },
    )
  if (error) {
    console.error('AD_ACCOUNT_SLOT_UPSERT_FAIL', error.message)
    return { ok: false, error: error.message }
  }
  return { ok: true }
}

/** Bir slot'taki seçimi kaldırır. */
export async function removeAdAccountSlot(
  userId: string,
  platform: AdAccountPlatform,
  slotIndex: number,
): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase
    .from('user_selected_ad_accounts')
    .delete()
    .eq('user_id', userId)
    .eq('platform', platform)
    .eq('slot_index', slotIndex)
  if (error) {
    console.error('AD_ACCOUNT_SLOT_DELETE_FAIL', error.message)
    return false
  }
  return true
}

/** Belirli bir hesap zaten kullanıcının seçimlerinde var mı? */
export async function isAdAccountAlreadySelected(
  userId: string,
  platform: AdAccountPlatform,
  accountId: string,
): Promise<boolean> {
  if (!supabase) return false
  const { data } = await supabase
    .from('user_selected_ad_accounts')
    .select('id')
    .eq('user_id', userId)
    .eq('platform', platform)
    .eq('account_id', accountId)
    .maybeSingle()
  return !!data
}
