import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { supabase } from '@/lib/supabase/client'
import { Resend } from 'resend'
import bcrypt from 'bcryptjs'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://yoai.yodijital.com'
const FROM_EMAIL = process.env.FROM_EMAIL || 'YO Dijital Medya Anonim Şirketi <info@yodijital.com>'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, email, company, phone, password } = body

    // Validation
    if (!name?.trim()) {
      return NextResponse.json({ ok: false, error: 'name_required' }, { status: 400 })
    }
    if (!email?.trim() || !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email.trim())) {
      return NextResponse.json({ ok: false, error: 'invalid_email' }, { status: 400 })
    }
    if (!password || password.length < 8) {
      return NextResponse.json({ ok: false, error: 'password_too_short' }, { status: 400 })
    }
    if (phone?.trim() && !/^[+]?[0-9\s()-]{7,20}$/.test(phone.trim())) {
      return NextResponse.json({ ok: false, error: 'invalid_phone' }, { status: 400 })
    }

    const cleanEmail = email.trim().toLowerCase()
    const cleanName = name.trim()
    const token = randomUUID()
    const passwordHash = await bcrypt.hash(password, 12)

    if (!supabase) {
      console.error('[Signup] Supabase client not available')
      return NextResponse.json({ ok: false, error: 'service_unavailable' }, { status: 503 })
    }

    // Check if email already registered
    const { data: existing } = await supabase
      .from('signups')
      .select('id, status')
      .eq('email', cleanEmail)
      .maybeSingle()

    if (existing?.status === 'active') {
      return NextResponse.json({ ok: false, error: 'already_verified' }, { status: 409 })
    }

    // Upsert signup record
    if (existing) {
      // Re-send verification for pending signup
      await supabase
        .from('signups')
        .update({
          name: cleanName,
          company: company?.trim() || null,
          phone: phone?.trim() || null,
          password_hash: passwordHash,
          verification_token: token,
          status: 'pending',
          created_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
    } else {
      await supabase.from('signups').insert({
        name: cleanName,
        email: cleanEmail,
        company: company?.trim() || null,
        phone: phone?.trim() || null,
        password_hash: passwordHash,
        verification_token: token,
        status: 'pending',
      })
    }

    // Send verification email
    const verifyUrl = `${APP_URL}/api/signup/verify?token=${token}`

    if (resend) {
      try {
        await resend.emails.send({
          from: FROM_EMAIL,
          to: cleanEmail,
          subject: 'YoAi — E-posta Doğrulama',
          html: `
            <div style="font-family: 'Inter', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 24px; background: #060609; color: #ffffff; border-radius: 16px;">
              <div style="text-align: center; margin-bottom: 32px;">
                <h1 style="font-size: 24px; font-weight: 700; margin: 0 0 8px;">Hoş geldiniz, ${cleanName}!</h1>
                <p style="font-size: 15px; color: #9ca3af; margin: 0;">YoAi hesabınızı aktifleştirmek için aşağıdaki butona tıklayın.</p>
              </div>
              <div style="text-align: center; margin: 32px 0;">
                <a href="${verifyUrl}" style="display: inline-block; background: linear-gradient(135deg, #10b981, #14b8a6); color: #000; font-weight: 600; font-size: 15px; padding: 14px 32px; border-radius: 12px; text-decoration: none;">
                  Hesabımı Doğrula
                </a>
              </div>
              <p style="font-size: 13px; color: #6b7280; text-align: center;">
                Bu bağlantı 24 saat geçerlidir.<br/>
                Bu işlemi siz yapmadıysanız bu e-postayı görmezden gelebilirsiniz.
              </p>
              <hr style="border: none; border-top: 1px solid #1f2937; margin: 24px 0;" />
              <p style="font-size: 12px; color: #4b5563; text-align: center;">YoAi — Yapay Zeka Destekli Pazarlama Yönetimi</p>
            </div>
          `,
        })
        console.log('[Signup] Verification email sent to', cleanEmail.slice(0, 3) + '***')
      } catch (emailErr) {
        console.error('[Signup] Email send failed:', emailErr instanceof Error ? emailErr.message : 'unknown')
        // Don't fail the signup if email fails — user can request resend
      }
    } else {
      console.warn('[Signup] RESEND_API_KEY not set — verification email skipped')
      console.log('[Signup] Verify URL (dev):', verifyUrl)
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[Signup] Error:', error instanceof Error ? error.message : 'unknown')
    return NextResponse.json({ ok: false, error: 'internal_error' }, { status: 500 })
  }
}
