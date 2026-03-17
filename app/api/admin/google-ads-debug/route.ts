/**
 * Temporary diagnostic endpoint for Google Ads persistence debugging.
 * Protected by x-admin-secret. Never returns token values.
 * Remove after production debugging is complete.
 */

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { supabase } from '@/lib/supabase/client'
import { COOKIE } from '@/lib/google-ads/constants'

export async function GET(req: NextRequest) {
  const adminSecret = process.env.ADMIN_SECRET
  if (!adminSecret?.trim()) {
    return NextResponse.json({ error: 'ADMIN_SECRET not configured' }, { status: 503 })
  }
  const headerSecret = req.headers.get('x-admin-secret')
  if (headerSecret !== adminSecret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const cookieStore = await cookies()
  const sessionCookiePresent = !!cookieStore.get('session_id')?.value
  const googleRefreshCookiePresent = !!cookieStore.get(COOKIE.REFRESH_TOKEN)?.value
  const googleCustomerCookiePresent = !!cookieStore.get(COOKIE.CUSTOMER_ID)?.value

  let dbRowCount = 0
  let latestConnectionStatus: string | null = null
  if (supabase) {
    const { count, error } = await supabase
      .from('google_ads_connections')
      .select('*', { count: 'exact', head: true })
    if (!error) {
      dbRowCount = count ?? 0
    }
    const { data: latest } = await supabase
      .from('google_ads_connections')
      .select('status, updated_at')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    latestConnectionStatus = latest?.status ?? null
  }

  return NextResponse.json({
    sessionCookiePresent,
    googleRefreshCookiePresent,
    googleCustomerCookiePresent,
    dbRowCount,
    latestConnectionStatus,
  })
}
