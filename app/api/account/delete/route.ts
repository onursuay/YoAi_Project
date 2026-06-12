import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/billing/user'
import { supabase } from '@/lib/supabase/client'
import { isSuperAdminEmail } from '@/lib/admin/superAdmin'
import { revokeMetaConnection } from '@/lib/metaConnectionStore'
import { revokeConnection as revokeGoogleConnection } from '@/lib/googleAdsConnectionStore'
import { revokeConnection as revokeTiktokConnection } from '@/lib/tiktokAdsConnectionStore'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * KVKK/GDPR self-service hesap & veri silme.
 * - Bağlı reklam hesabı token'larını iptal eder (Meta/Google/TikTok).
 * - signups satırındaki kişisel veriyi (PII) anonimleştirir + status='deleted'
 *   (kullanıcı artık giriş yapamaz, kimlik bilgisi geri getirilemez).
 * - Talebi account_deletion_requests'e kaydeder (denetlenebilirlik).
 * - Oturum çerezlerini temizler.
 * Owner bu uçtan silinemez (kaza koruması).
 */
export async function POST() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 })
    }
    if (isSuperAdminEmail(user.email)) {
      return NextResponse.json({ ok: false, error: 'owner_cannot_self_delete' }, { status: 403 })
    }
    if (!supabase) {
      return NextResponse.json({ ok: false, error: 'unavailable' }, { status: 503 })
    }

    // 1) Bağlı reklam hesabı token'larını iptal et (hata olsa da silmeye devam).
    await Promise.allSettled([
      revokeMetaConnection(user.id),
      revokeGoogleConnection(user.id),
      revokeTiktokConnection(user.id),
    ])

    // 2) PII anonimleştir + hesabı kapat.
    const anonEmail = `deleted+${user.id.slice(0, 8)}@deleted.local`
    const { error: anonErr } = await supabase
      .from('signups')
      .update({
        name: 'Silinmiş Kullanıcı',
        email: anonEmail,
        company: null,
        phone: null,
        password_hash: null,
        verification_token: null,
        status: 'deleted',
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)
    if (anonErr) {
      console.error('[account/delete] anonymize failed:', anonErr.message)
      return NextResponse.json({ ok: false, error: 'delete_failed' }, { status: 500 })
    }

    // 3) Talebi kaydet (denetlenebilirlik).
    await supabase.from('account_deletion_requests').insert({
      user_id: user.id, source: 'self', status: 'processed', detail: 'self-service anonymize + revoke',
    })

    // 4) Oturum çerezlerini temizle.
    const res = NextResponse.json({ ok: true })
    for (const name of ['user_id', 'session_id', 'user_email', 'user_name']) {
      res.cookies.set(name, '', { path: '/', maxAge: 0 })
    }
    return res
  } catch (error) {
    console.error('[account/delete] error:', error instanceof Error ? error.message : error)
    return NextResponse.json({ ok: false, error: 'internal_error' }, { status: 500 })
  }
}
