import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, email, date, time, note } = body

    // Validate required fields
    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json(
        { error: 'İsim alanı zorunludur. / Name is required.' },
        { status: 400 },
      )
    }

    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: 'Geçerli bir e-posta adresi girin. / Valid email is required.' },
        { status: 400 },
      )
    }

    if (!date || typeof date !== 'string' || !date.trim()) {
      return NextResponse.json(
        { error: 'Tarih alanı zorunludur. / Date is required.' },
        { status: 400 },
      )
    }

    if (!time || typeof time !== 'string' || !time.trim()) {
      return NextResponse.json(
        { error: 'Saat alanı zorunludur. / Time is required.' },
        { status: 400 },
      )
    }

    const booking = {
      name: name.trim(),
      email: email.trim(),
      booking_date: date.trim(),
      booking_time: time.trim(),
      note: note?.trim() || null,
      status: 'pending',
    }

    // If Supabase is available, insert the booking
    if (supabase) {
      const { error: dbError } = await supabase
        .from('bookings')
        .insert(booking)

      if (dbError) {
        console.error('[Bookings] Supabase insert error:', dbError.message)
        // Do not expose internal error details to client
        return NextResponse.json(
          { error: 'Rezervasyon kaydedilemedi. Lütfen tekrar deneyin. / Could not save booking. Please try again.' },
          { status: 500 },
        )
      }
    } else {
      // Supabase unavailable — log and return success
      console.warn('[Bookings] Supabase not configured. Logging booking:', {
        name: booking.name,
        email: booking.email,
        booking_date: booking.booking_date,
        booking_time: booking.booking_time,
      })
    }

    return NextResponse.json({ ok: true })
  } catch {
    console.error('[Bookings] Unexpected error processing booking request')
    return NextResponse.json(
      { error: 'Beklenmeyen bir hata oluştu. / An unexpected error occurred.' },
      { status: 500 },
    )
  }
}
