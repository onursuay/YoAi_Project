import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { supabase } from '@/lib/supabase/client'
import { signUserId } from '@/lib/auth/userCookie'
import bcrypt from 'bcryptjs'
import { isSuperAdminEmail } from '@/lib/admin/superAdmin'
import { checkBlocklist, extractDomain } from '@/lib/admin/blocklist'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password } = body

    if (!email?.trim() || !password) {
      return NextResponse.json({ ok: false, error: 'missing_fields' }, { status: 400 })
    }

    const cleanEmail = email.trim().toLowerCase()

    if (!supabase) {
      return NextResponse.json({ ok: false, error: 'service_unavailable' }, { status: 503 })
    }

    // Brute-force throttle: 15 dk içinde 8 başarısız deneme → 15 dk kilit (DB-backed).
    // bcrypt'ten ÖNCE kontrol edilir; e-posta var/yok ayrımı yapmaz (enumeration sızdırmaz).
    const LOGIN_MAX = 8, LOGIN_WINDOW = 900, LOGIN_LOCK = 900
    {
      const { data: lockRow } = await supabase
        .from('login_attempts')
        .select('locked_until')
        .eq('identifier', cleanEmail)
        .maybeSingle()
      if (lockRow?.locked_until && new Date(lockRow.locked_until).getTime() > Date.now()) {
        return NextResponse.json({ ok: false, error: 'too_many_attempts' }, { status: 429 })
      }
    }

    const registerFailure = async () => {
      await supabase!.rpc('register_login_failure', {
        p_identifier: cleanEmail, p_max: LOGIN_MAX, p_window_secs: LOGIN_WINDOW, p_lock_secs: LOGIN_LOCK,
      })
    }

    // Find active user
    const { data: user, error } = await supabase
      .from('signups')
      .select('id, name, email, password_hash, status, approval_status')
      .eq('email', cleanEmail)
      .maybeSingle()

    if (error || !user) {
      await registerFailure()
      return NextResponse.json({ ok: false, error: 'invalid_credentials' }, { status: 401 })
    }

    if (user.status !== 'active') {
      return NextResponse.json({ ok: false, error: 'not_verified' }, { status: 403 })
    }

    if (!user.password_hash) {
      await registerFailure()
      return NextResponse.json({ ok: false, error: 'invalid_credentials' }, { status: 401 })
    }

    // Verify password
    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) {
      await registerFailure()
      return NextResponse.json({ ok: false, error: 'invalid_credentials' }, { status: 401 })
    }

    // Başarılı giriş → throttle sayacını sıfırla
    await supabase.rpc('clear_login_attempts', { p_identifier: cleanEmail })

    // Blocklist kontrolü — user ID, email, domain, IP (owner bypass)
    const isOwner = isSuperAdminEmail(user.email as string | null)
    if (!isOwner) {
      const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
        || request.headers.get('x-real-ip')
        || null
      const domain = extractDomain(cleanEmail)
      const blockChecks: Array<{ type: 'user' | 'email' | 'domain' | 'ip'; value: string }> = [
        { type: 'user', value: user.id },
        { type: 'email', value: cleanEmail },
      ]
      if (domain) blockChecks.push({ type: 'domain', value: domain })
      if (clientIp) blockChecks.push({ type: 'ip', value: clientIp })

      const blockResult = await checkBlocklist(blockChecks)
      if (blockResult.blocked) {
        return NextResponse.json({ ok: false, error: 'access_not_available' }, { status: 403 })
      }
    }

    // Manuel onay akışı: owner allowlist'i değilse, approval_status='approved'
    // değilse istemciye 'pending_approval' sinyali ver → client `/basvuru-durumu`'na
    // yönlendirsin. Backend yine de oturumu açıyor ki kullanıcı başvuru
    // durumunu görebilsin ve ön görüşmesini planlayabilsin.
    const approvalStatus = ((user as any).approval_status as string | null) ?? 'pending'
    const isApprovedForPanel = isOwner || approvalStatus === 'approved'

    // Blocked/manual_review kullanıcı oturum açabilir ama panele gidemez
    if (!isOwner && (approvalStatus === 'blocked' || approvalStatus === 'manual_review')) {
      // Oturum cookie'si KURULUR ama /basvuru-durumu'na yönlendirilir
    }

    // Create session
    const sessionId = randomUUID()
    const response = NextResponse.json({
      ok: true,
      name: user.name,
      approvalStatus,
      isOwner,
      redirectTo: isApprovedForPanel ? '/dashboard' : '/basvuru-durumu',
    })

    response.cookies.set('session_id', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    })

    // Permanent user id — used as the stable key for all DB connections (Meta, Google Ads).
    // httpOnly so JS cannot read it; used server-side only for DB lookups.
    response.cookies.set('user_id', signUserId(user.id), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    })

    // Display-only cookies (not sensitive)
    response.cookies.set('user_email', cleanEmail, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    })
    response.cookies.set('user_name', user.name ?? '', {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    })

    console.log('[Auth] Login success:', cleanEmail.slice(0, 3) + '***')
    return response
  } catch (error) {
    console.error('[Auth] Login error:', error instanceof Error ? error.message : 'unknown')
    return NextResponse.json({ ok: false, error: 'internal_error' }, { status: 500 })
  }
}
