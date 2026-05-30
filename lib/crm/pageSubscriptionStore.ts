import 'server-only'
import { supabase } from '@/lib/supabase/client'

/**
 * crm_page_subscriptions erişim katmanı.
 *
 * Meta leadgen webhook'ları yalnız `page_id` taşır; gelen lead'i doğru
 * kullanıcıya bağlamak için page_id → user_id eşlemesini burada tutarız.
 * Kullanıcı CRM'i bir Facebook Page'ine bağladığında satır upsert edilir.
 */

export interface CrmPageSubscriptionRow {
  id: string
  user_id: string
  page_id: string
  page_name: string | null
  subscribed_at: string
}

/** Webhook → user çözümü. page_id UNIQUE olduğundan tek satır döner. */
export async function getSubscriptionByPageId(pageId: string): Promise<CrmPageSubscriptionRow | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('crm_page_subscriptions')
    .select('*')
    .eq('page_id', pageId)
    .maybeSingle()
  if (error || !data) return null
  return data as CrmPageSubscriptionRow
}

export async function listSubscriptions(userId: string): Promise<CrmPageSubscriptionRow[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('crm_page_subscriptions')
    .select('*')
    .eq('user_id', userId)
    .order('subscribed_at', { ascending: false })
  if (error) {
    console.error('[CrmPageSubs] LIST_FAIL', error.message)
    return []
  }
  return (data ?? []) as CrmPageSubscriptionRow[]
}

export async function upsertSubscription(
  userId: string,
  pageId: string,
  pageName: string | null,
): Promise<CrmPageSubscriptionRow | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('crm_page_subscriptions')
    .upsert(
      { user_id: userId, page_id: pageId, page_name: pageName },
      { onConflict: 'page_id' },
    )
    .select()
    .single()
  if (error || !data) {
    console.error('[CrmPageSubs] UPSERT_FAIL', error?.message)
    return null
  }
  return data as CrmPageSubscriptionRow
}

export async function deleteSubscription(userId: string, pageId: string): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase
    .from('crm_page_subscriptions')
    .delete()
    .eq('user_id', userId)
    .eq('page_id', pageId)
  if (error) {
    console.error('[CrmPageSubs] DELETE_FAIL', error.message)
    return false
  }
  return true
}
