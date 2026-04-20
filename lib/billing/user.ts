import 'server-only'
import { cookies } from 'next/headers'
import { supabase } from '@/lib/supabase/client'

export interface AuthenticatedUser {
  id: string
  email: string
  name: string | null
}

/**
 * Resolve the current request's user from the httpOnly `user_id` cookie.
 * Returns null if unauthenticated or Supabase is unavailable.
 */
export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  const store = cookies()
  const userId = store.get('user_id')?.value
  if (!userId || !supabase) return null

  const { data, error } = await supabase
    .from('signups')
    .select('id, name, email, status')
    .eq('id', userId)
    .maybeSingle()

  if (error || !data || data.status !== 'active') return null
  return { id: data.id, email: data.email, name: data.name }
}
