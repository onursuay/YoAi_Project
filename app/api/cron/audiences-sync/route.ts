import { NextResponse } from 'next/server'
import { MetaGraphClient } from '@/lib/meta/client'
import { getMetaConnection } from '@/lib/metaConnectionStore'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/* ────────────────────────────────────────────────────────────
   GET /api/cron/audiences-sync
   Vercel Cron: her saat başı (schedule: "0 * * * *")
   CREATING / POPULATING durumundaki Meta kitlelerini kontrol eder,
   durumlarını READY / ERROR / DELETED'a geçirir.
   Manuel test: GET Authorization: Bearer <CRON_SECRET> veya ?secret=...
   ──────────────────────────────────────────────────────────── */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  const urlSecret = new URL(request.url).searchParams.get('secret')
  const cronSecret = process.env.CRON_SECRET
  const isProduction = process.env.NODE_ENV === 'production'

  if (!cronSecret && isProduction) {
    console.error('[AudiencesSync] CRON_SECRET yapılandırılmamış — production isteği reddedildi')
    return NextResponse.json({ ok: false, error: 'Cron not configured' }, { status: 503 })
  }
  if (cronSecret) {
    const authorized = authHeader === `Bearer ${cronSecret}` || urlSecret === cronSecret
    if (!authorized) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }
  }

  try {
    const { supabase } = await import('@/lib/supabase/client')
    if (!supabase) {
      return NextResponse.json({ ok: false, error: 'Database not configured' }, { status: 500 })
    }

    // Fetch all CREATING/POPULATING audiences with a known Meta ID
    const { data: rows, error: fetchError } = await supabase
      .from('audiences')
      .select('id, user_id, meta_audience_id, type, status, ad_account_id')
      .in('status', ['CREATING', 'POPULATING'])
      .not('meta_audience_id', 'is', null)
      .not('user_id', 'is', null)

    if (fetchError) {
      console.error('[AudiencesSync] DB fetch error:', fetchError.message)
      return NextResponse.json({ ok: false, error: fetchError.message }, { status: 500 })
    }

    if (!rows || rows.length === 0) {
      return NextResponse.json({ ok: true, checked: 0, updated: 0 })
    }

    // Group by user_id — one Meta connection per user
    const byUser = new Map<string, typeof rows>()
    for (const row of rows) {
      const uid = row.user_id as string
      if (!byUser.has(uid)) byUser.set(uid, [])
      byUser.get(uid)!.push(row)
    }

    let checked = 0
    let updated = 0
    const errors: string[] = []

    for (const [userId, audiences] of byUser) {
      const conn = await getMetaConnection(userId)
      if (!conn?.accessToken) {
        console.warn(`[AudiencesSync] No Meta connection for user ${userId.slice(0, 8)}… — skipping ${audiences.length} audience(s)`)
        errors.push(`user ${userId.slice(0, 8)}…: no connection`)
        continue
      }

      const client = new MetaGraphClient({ accessToken: conn.accessToken })

      for (const aud of audiences) {
        checked++
        const metaId = aud.meta_audience_id as string

        const res = await client.get<{
          id: string
          approximate_count_lower_bound?: number
          approximate_count_upper_bound?: number
          operation_status?: { code: number; description: string }
          delivery_status?: { code: number; description: string }
        }>(
          `/${metaId}`,
          { fields: 'id,approximate_count_lower_bound,approximate_count_upper_bound,operation_status,delivery_status' }
        )

        if (!res.ok) {
          const errCode = res.error?.code
          // Meta error 100 → object deleted / not found on Meta side
          if (errCode === 100) {
            await supabase
              .from('audiences')
              .update({
                status: 'DELETED',
                error_code: '100',
                error_message: 'Meta\'da bulunamadı (silinmiş olabilir)',
                updated_at: new Date().toISOString(),
              })
              .eq('id', aud.id)
              .eq('user_id', userId)
            updated++
          } else {
            await supabase
              .from('audiences')
              .update({
                status: 'ERROR',
                error_code: String(errCode ?? res.status ?? 'unknown'),
                error_message: res.error?.message ?? res.error?.error_user_msg as string ?? 'Meta API hatası',
                updated_at: new Date().toISOString(),
              })
              .eq('id', aud.id)
              .eq('user_id', userId)
            updated++
          }
          continue
        }

        const data = res.data!
        const opCode = data.operation_status?.code
        const lowerBound = data.approximate_count_lower_bound ?? 0
        const upperBound = data.approximate_count_upper_bound ?? 0

        // operation_status.code 200 = Normal / ready
        // lowerBound > 0 also indicates audience is populated
        if (opCode === 200 || lowerBound > 0) {
          await supabase
            .from('audiences')
            .update({
              status: 'READY',
              approximate_count: { lower: lowerBound, upper: upperBound },
              error_code: null,
              error_message: null,
              last_synced_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', aud.id)
            .eq('user_id', userId)
          updated++
        } else if (opCode && opCode >= 400) {
          // Audience processing failed on Meta side
          await supabase
            .from('audiences')
            .update({
              status: 'ERROR',
              error_code: String(opCode),
              error_message: data.operation_status?.description ?? 'Meta işlem hatası',
              updated_at: new Date().toISOString(),
            })
            .eq('id', aud.id)
            .eq('user_id', userId)
          updated++
        }
        // else: still populating — no update needed
      }
    }

    console.log(`[AudiencesSync] Tamamlandı — checked:${checked} updated:${updated} errors:${errors.length}`)

    return NextResponse.json({ ok: true, checked, updated, errors })
  } catch (error) {
    console.error('[AudiencesSync] Hata:', error)
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 })
  }
}
