import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { resolveMetaContext } from '@/lib/meta/context'

export const dynamic = 'force-dynamic'

/**
 * POST /api/audiences/sync
 * Syncs audience(s) from Meta → YoAi (meta-wins policy).
 *
 * Body:
 *   { audienceId?: string }  — sync single audience, or omit for all
 *
 * For each audience with a meta_audience_id:
 *   1. Fetch current state from Meta
 *   2. Update name if changed (meta-wins)
 *   3. Transition POPULATING → READY when approximate_count > 0
 *   4. Mark DELETED if Meta returns error 100 (object doesn't exist)
 */
export async function POST(request: Request) {
  const requestId = crypto.randomUUID().slice(0, 8)

  if (!supabase) {
    return NextResponse.json({ ok: false, error: 'database_unavailable' }, { status: 503 })
  }

  const ctx = await resolveMetaContext()
  if (!ctx) {
    return NextResponse.json({ ok: false, error: 'missing_token' }, { status: 401 })
  }

  let body: { audienceId?: string } = {}
  try {
    body = await request.json()
  } catch {
    // Empty body = sync all
  }

  // Fetch audiences to sync
  let query = supabase
    .from('audiences')
    .select('*')
    .eq('ad_account_id', ctx.accountId)
    .not('meta_audience_id', 'is', null)
    .not('status', 'eq', 'DELETED')
    .not('status', 'eq', 'DRAFT')

  if (body.audienceId) {
    query = query.eq('id', body.audienceId)
  }

  const { data: audiences, error: fetchError } = await query

  if (fetchError) {
    console.error(`[${requestId}] Sync fetch error:`, fetchError)
    return NextResponse.json({ ok: false, error: 'db_error', message: fetchError.message }, { status: 500 })
  }

  if (!audiences || audiences.length === 0) {
    return NextResponse.json({ ok: true, synced: 0, message: 'Senkronize edilecek kitle yok' })
  }

  const results: { id: string; status: string; changed: boolean; error?: string }[] = []

  // Sync each audience (with concurrency limit)
  for (const audience of audiences) {
    const metaId = audience.meta_audience_id as string
    const type = audience.type as string

    try {
      // Fetch from Meta
      const fields = type === 'SAVED'
        ? 'id,name,targeting'
        : 'id,name,approximate_count_lower_bound,approximate_count_upper_bound,delivery_status,operation_status,subtype'

      const metaRes = await ctx.client.get(`/${metaId}`, { fields })

      if (!metaRes.ok) {
        const errCode = metaRes.error?.code
        // Error 100 = Object does not exist → mark DELETED
        if (errCode === 100 || metaRes.status === 404) {
          await supabase
            .from('audiences')
            .update({
              status: 'DELETED',
              error_message: 'Meta\'da silinmiş',
              updated_at: new Date().toISOString(),
              last_synced_at: new Date().toISOString(),
            })
            .eq('id', audience.id)
          results.push({ id: audience.id, status: 'DELETED', changed: true })
          continue
        }

        // Other error — skip but log
        console.warn(`[${requestId}] Sync failed for ${metaId}:`, metaRes.error)
        results.push({ id: audience.id, status: audience.status, changed: false, error: metaRes.error?.message })
        continue
      }

      const metaData = metaRes.data as Record<string, unknown>
      const updates: Record<string, unknown> = {
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      let changed = false

      // Meta-wins: name update
      if (metaData.name && metaData.name !== audience.name) {
        updates.name = metaData.name
        changed = true
      }

      // Status transitions for Custom & Lookalike
      if (type !== 'SAVED') {
        const approxCount = (metaData.approximate_count_lower_bound as number) ?? 0
        const operationStatus = metaData.operation_status as Record<string, unknown> | undefined
        const opCode = operationStatus?.code as number | undefined

        if (audience.status === 'POPULATING' || audience.status === 'CREATING') {
          // POPULATING → READY when audience is populated
          if (approxCount > 0 || opCode === 200) {
            updates.status = 'READY'
            updates.error_code = null
            updates.error_message = null
            changed = true
          }
          // Still populating but no error — keep POPULATING
        }

        // If operation has an error
        if (opCode && opCode >= 400) {
          const opDesc = (operationStatus?.description as string) ?? 'Meta operation error'
          updates.status = 'ERROR'
          updates.error_code = String(opCode)
          updates.error_message = opDesc
          changed = true
        }
      } else {
        // Saved audiences are instantly ready after creation
        if (audience.status === 'POPULATING' || audience.status === 'CREATING') {
          updates.status = 'READY'
          updates.error_code = null
          updates.error_message = null
          changed = true
        }
      }

      // Store latest meta response
      updates.meta_payload_json = metaData

      await supabase
        .from('audiences')
        .update(updates)
        .eq('id', audience.id)

      results.push({
        id: audience.id,
        status: (updates.status as string) ?? audience.status,
        changed,
      })

    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown'
      console.error(`[${requestId}] Sync error for ${audience.id}:`, msg)
      results.push({ id: audience.id, status: audience.status, changed: false, error: msg })
    }
  }

  const syncedCount = results.filter((r) => r.changed).length

  return NextResponse.json({
    ok: true,
    synced: syncedCount,
    total: results.length,
    results,
  })
}
