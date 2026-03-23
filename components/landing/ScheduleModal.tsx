'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'

const CONTACT_EMAIL = 'info@yodijital.com'

interface Props {
  label: string
  locale: string
  variant?: 'nav' | 'hero' | 'bottom'
}

export default function ScheduleModal({ label, locale, variant = 'nav' }: Props) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [step, setStep] = useState<'calendar' | 'form'>('calendar')
  const [viewDate, setViewDate] = useState(() => new Date())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [note, setNote] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [use24h, setUse24h] = useState(true)

  const isEn = locale === 'en'

  useEffect(() => { setMounted(true) }, [])

  /* ───── Translations ───── */
  const t = isEn ? {
    brand: 'YoAi',
    meetingTitle: 'YoAi demo',
    meetingSub: 'Easy advertising with YoAi',
    duration: '30min',
    orgDefault: "Organizer's default...",
    timezone: 'Europe/Istanbul',
    monthNames: ['January','February','March','April','May','June','July','August','September','October','November','December'],
    dayHeaders: ['MON','TUE','WED','THU','FRI','SAT','SUN'],
    dayShort: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],
    confirmBtn: 'Confirm',
    nameLabel: 'Full Name',
    namePlaceholder: 'Your name',
    emailLabel: 'Email',
    emailPlaceholder: 'you@company.com',
    noteLabel: 'Notes (optional)',
    notePlaceholder: 'Anything you want us to know...',
    submitBtn: 'Schedule Meeting',
    back: 'Back',
    successTitle: 'Meeting Scheduled',
    successMsg: 'A calendar invite will be sent to your email shortly.',
    close: 'Close',
    h12: '12h',
    h24: '24h',
  } : {
    brand: 'YoAi',
    meetingTitle: 'YoAi kullanımı',
    meetingSub: 'YoAi ile kolay reklam',
    duration: '30dakika',
    orgDefault: 'Organizatörün varsayılan...',
    timezone: 'Europe/Istanbul',
    monthNames: ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'],
    dayHeaders: ['PZT','SAL','ÇAR','PER','CUM','CMT','PAZ'],
    dayShort: ['Paz','Pzt','Sal','Çar','Per','Cum','Cmt'],
    confirmBtn: 'Onayla',
    nameLabel: 'Ad Soyad',
    namePlaceholder: 'Adınız',
    emailLabel: 'E-posta',
    emailPlaceholder: 'siz@sirket.com',
    noteLabel: 'Not (isteğe bağlı)',
    notePlaceholder: 'Eklemek istediğiniz bir şey...',
    submitBtn: 'Görüşmeyi Planla',
    back: 'Geri',
    successTitle: 'Görüşme Planlandı',
    successMsg: 'Kısa sürede e-postanıza takvim davetiyesi göndereceğiz.',
    close: 'Kapat',
    h12: '12 sa',
    h24: '24 sa',
  }

  /* ───── Calendar helpers ───── */
  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d }, [])

  function toIso(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  const calendarDays = useMemo(() => {
    const year = viewDate.getFullYear()
    const month = viewDate.getMonth()
    const firstDay = new Date(year, month, 1)
    let startDow = firstDay.getDay() - 1
    if (startDow < 0) startDow = 6
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const cells: { day: number; month: number; year: number; iso: string; isCurrentMonth: boolean; isWeekend: boolean; isPast: boolean; monthLabel?: string }[] = []

    // Previous month fill
    const prevMonthDays = new Date(year, month, 0).getDate()
    for (let i = startDow - 1; i >= 0; i--) {
      const d = prevMonthDays - i
      const m = month - 1 < 0 ? 11 : month - 1
      const y = month - 1 < 0 ? year - 1 : year
      const date = new Date(y, m, d)
      const dow = date.getDay()
      cells.push({ day: d, month: m, year: y, iso: toIso(date), isCurrentMonth: false, isWeekend: dow === 0 || dow === 6, isPast: date < today })
    }

    // Current month
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d)
      const dow = date.getDay()
      cells.push({ day: d, month, year, iso: toIso(date), isCurrentMonth: true, isWeekend: dow === 0 || dow === 6, isPast: date < today })
    }

    // Next month fill
    const remaining = 7 - (cells.length % 7)
    if (remaining < 7) {
      const nextMonth = month + 1 > 11 ? 0 : month + 1
      const nextMonthNames = isEn
        ? ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
        : ['OCA','SUB','MAR','NIS','MAY','HAZ','TEM','AGU','EYL','EKI','KAS','ARA']
      for (let d = 1; d <= remaining; d++) {
        const m = nextMonth
        const y = month + 1 > 11 ? year + 1 : year
        const date = new Date(y, m, d)
        const dow = date.getDay()
        cells.push({
          day: d, month: m, year: y, iso: toIso(date), isCurrentMonth: false, isWeekend: dow === 0 || dow === 6, isPast: date < today,
          monthLabel: d === 1 ? nextMonthNames[m] : undefined,
        })
      }
    }
    return cells
  }, [viewDate, today, isEn])

  const timeSlots = useMemo(() => {
    const slots: { value: string; label12: string; label24: string }[] = []
    for (let h = 9; h <= 17; h++) {
      for (const m of [0, 30]) {
        if (h === 17 && m === 30) break
        const v = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
        const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h
        const ampm = h >= 12 ? 'PM' : 'AM'
        slots.push({ value: v, label12: `${h12}:${String(m).padStart(2, '0')} ${ampm}`, label24: v })
      }
    }
    return slots
  }, [])

  // Format selected date header like "Pzt 23"
  const selectedDateHeader = useMemo(() => {
    if (!selectedDate) return ''
    const [y, m, d] = selectedDate.split('-').map(Number)
    const date = new Date(y, m - 1, d)
    const dow = t.dayShort[date.getDay()]
    return `${dow} ${d}`
  }, [selectedDate, t.dayShort])

  const isDayAvailable = useCallback((_iso: string, isWeekend: boolean, isPast: boolean) => !isWeekend && !isPast, [])

  const prevMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))
  const nextMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))
  const canPrev = viewDate.getFullYear() > today.getFullYear() || viewDate.getMonth() > today.getMonth()

  function handleConfirmTime() { if (selectedDate && selectedTime) setStep('form') }

  async function handleSubmit() {
    if (!selectedDate || !selectedTime || !name.trim() || !email.trim()) return
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), date: selectedDate, time: selectedTime, note: note.trim() || undefined }),
      })
      if (!res.ok) throw new Error('Booking failed')
    } catch {
      // Booking API failed — still show success to user, fallback to mailto
      const subject = encodeURIComponent(isEn ? `YoAi Meeting — ${name}` : `YoAi Görüşme Talebi — ${name}`)
      const body = encodeURIComponent(`${isEn ? 'Name' : 'Ad Soyad'}: ${name}\n${isEn ? 'Email' : 'E-posta'}: ${email}\n${isEn ? 'Date' : 'Tarih'}: ${selectedDate}\n${isEn ? 'Time' : 'Saat'}: ${selectedTime}\n` + (note ? `${isEn ? 'Notes' : 'Not'}: ${note}\n` : ''))
      window.open(`mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`, '_self')
    }
    setSubmitted(true)
  }

  function handleOpen() {
    setOpen(true); setStep('calendar'); setSelectedDate(null); setSelectedTime(null)
    setName(''); setEmail(''); setNote(''); setSubmitted(false)
  }

  const btnClass = variant === 'hero'
    ? 'btn-shimmer inline-flex items-center justify-center font-semibold text-base px-10 py-4 rounded-full transition-all cursor-pointer min-w-[220px] bg-gradient-to-r from-emerald-500 to-teal-500 text-black hover:from-emerald-400 hover:to-teal-400 shadow-[0_0_30px_rgba(16,185,129,0.2)] hover:shadow-[0_0_40px_rgba(16,185,129,0.3)]'
    : variant === 'bottom'
    ? 'btn-shimmer inline-flex items-center justify-center text-[14px] font-medium border border-emerald-400/30 text-emerald-400 hover:bg-emerald-400/10 px-6 py-2.5 rounded-full transition-colors cursor-pointer'
    : 'btn-shimmer hidden sm:inline-flex items-center justify-center font-semibold border border-emerald-400/40 text-emerald-400 hover:bg-emerald-400/10 px-6 py-2.5 rounded-full transition-colors cursor-pointer text-[12.75px]'

  const monthLabel = `${t.monthNames[viewDate.getMonth()]} ${viewDate.getFullYear()}`

  /* ───── Modal ───── */
  const modalContent = open ? (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ fontSize: '16px' }} onClick={() => setOpen(false)}>
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" />
      <div className="relative bg-[#111116] border border-white/[0.08] rounded-2xl w-full max-w-[900px] max-h-[90vh] overflow-hidden shadow-2xl shadow-black/60" onClick={e => e.stopPropagation()}>

        {/* Close */}
        <button onClick={() => setOpen(false)} className="absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-gray-400 hover:text-white transition-colors">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>

        {submitted ? (
          <div className="text-center py-16 px-8">
            <div className="w-14 h-14 rounded-full bg-emerald-400/10 border border-emerald-400/20 flex items-center justify-center mx-auto mb-5">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgb(52,211,153)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
            </div>
            <h3 className="text-xl font-bold text-white mb-2">{t.successTitle}</h3>
            <p className="text-sm text-gray-400 mb-8">{t.successMsg}</p>
            <button onClick={() => setOpen(false)} className="text-sm font-semibold text-emerald-400 hover:text-emerald-300 transition-colors">{t.close}</button>
          </div>
        ) : step === 'form' ? (
          <div className="p-6">
            <button onClick={() => setStep('calendar')} className="text-xs text-gray-500 hover:text-white mb-4 transition-colors">&larr; {t.back}</button>
            <h3 className="text-lg font-bold text-white mb-1">{t.meetingTitle}</h3>
            <p className="text-sm text-gray-500 mb-5">{selectedDate} &middot; {selectedTime} &middot; {t.duration}</p>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">{t.nameLabel}</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder={t.namePlaceholder} className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:border-emerald-400/30 outline-none transition-colors" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">{t.emailLabel}</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder={t.emailPlaceholder} className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:border-emerald-400/30 outline-none transition-colors" />
              </div>
            </div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">{t.noteLabel}</label>
            <textarea value={note} onChange={e => setNote(e.target.value)} placeholder={t.notePlaceholder} rows={2} className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:border-emerald-400/30 outline-none transition-colors resize-none mb-5" />
            <button onClick={handleSubmit} disabled={!name.trim() || !email.trim()} className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-gray-700 disabled:text-gray-500 text-black font-semibold py-3 rounded-xl transition-colors text-sm">{t.submitBtn}</button>
          </div>
        ) : (
          /* ── Calendar: exact 3-column layout matching reference ── */
          <div className="flex flex-col md:flex-row">

            {/* ▌LEFT — Meeting info panel */}
            <div className="md:w-[220px] shrink-0 border-b md:border-b-0 md:border-r border-white/[0.06] p-5 flex flex-col">
              <div className="w-9 h-9 rounded-lg bg-emerald-400/10 border border-emerald-400/20 flex items-center justify-center mb-3">
                <span className="text-emerald-400 text-lg">✦</span>
              </div>
              <p className="text-sm text-gray-500 mb-0.5">{t.brand}</p>
              <h3 className="text-base font-semibold text-white mb-0.5">
                {t.meetingTitle} <span className="text-emerald-400">✨</span>
              </h3>
              <p className="text-sm text-gray-500 mb-5">{t.meetingSub}</p>

              <div className="space-y-2.5">
                <div className="flex items-center gap-2.5 text-sm text-gray-400">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                  {t.duration}
                </div>
                <div className="flex items-center gap-2.5 text-sm text-gray-400">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
                  {t.orgDefault}
                </div>
                <div className="flex items-center gap-2.5 text-sm text-gray-400">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10A15.3 15.3 0 0112 2z"/></svg>
                  {t.timezone} <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="ml-0.5"><path d="M6 9l6 6 6-6"/></svg>
                </div>
              </div>
            </div>

            {/* ▌CENTER — Full month calendar grid */}
            <div className="flex-1 p-5">
              {/* Month + nav arrows */}
              <div className="flex items-center justify-between mb-5">
                <h4 className="text-[16px] font-semibold text-white tracking-tight">{monthLabel}</h4>
                <div className="flex items-center gap-1">
                  <button onClick={prevMonth} disabled={!canPrev} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/[0.06] text-gray-400 disabled:text-gray-700 transition-colors">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
                  </button>
                  <button onClick={nextMonth} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/[0.06] text-gray-400 transition-colors">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
                  </button>
                </div>
              </div>

              {/* Day headers */}
              <div className="grid grid-cols-7 mb-2">
                {t.dayHeaders.map(d => (
                  <div key={d} className="text-center text-[12px] font-semibold text-gray-500 py-2 tracking-wide">{d}</div>
                ))}
              </div>

              {/* Days grid */}
              <div className="grid grid-cols-7 gap-y-1">
                {calendarDays.map((cell, i) => {
                  const available = isDayAvailable(cell.iso, cell.isWeekend, cell.isPast)
                  const isSelected = selectedDate === cell.iso
                  const isToday = cell.iso === toIso(today)

                  return (
                    <div key={i} className="flex items-center justify-center">
                      <button
                        disabled={!available}
                        onClick={() => { setSelectedDate(cell.iso); setSelectedTime(null) }}
                        className={`relative w-[44px] h-[44px] flex flex-col items-center justify-center rounded-lg transition-all ${
                          isSelected
                            ? 'bg-emerald-500 text-black font-bold shadow-lg shadow-emerald-500/25'
                            : available && cell.isCurrentMonth
                            ? 'bg-[#2a2a3a] text-white hover:bg-[#343448] font-medium'
                            : available && !cell.isCurrentMonth
                            ? 'bg-[#222232] text-gray-400 hover:bg-[#2a2a3a] font-medium'
                            : cell.isPast
                            ? 'text-gray-700/25 cursor-default'
                            : 'text-gray-700/25 cursor-default'
                        }`}
                      >
                        {cell.monthLabel && (
                          <span className="text-[8px] font-bold leading-none tracking-wider" style={{ color: isSelected ? 'black' : '#6b7280' }}>{cell.monthLabel}</span>
                        )}
                        <span className="text-[15px] leading-none">{cell.day}</span>
                        {isToday && !isSelected && (
                          <span className="absolute bottom-[4px] left-1/2 -translate-x-1/2 w-[5px] h-[5px] rounded-full bg-emerald-400" />
                        )}
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* ▌RIGHT — Time slots panel (always visible) */}
            <div className="md:w-[200px] shrink-0 border-t md:border-t-0 md:border-l border-white/[0.06] p-5 flex flex-col">
              {/* Date header + 12h/24h toggle */}
              <div className="flex items-center justify-between mb-5">
                <p className="text-[15px] font-semibold text-white">{selectedDateHeader || (isEn ? 'Select date' : 'Tarih seçin')}</p>
                <div className="flex bg-[#1a1a22] rounded-md text-[11px] border border-white/[0.06] overflow-hidden">
                  <button onClick={() => setUse24h(false)} className={`px-2.5 py-1 font-medium transition-colors ${!use24h ? 'bg-white/[0.12] text-white' : 'text-gray-500'}`}>{t.h12}</button>
                  <button onClick={() => setUse24h(true)} className={`px-2.5 py-1 font-medium transition-colors ${use24h ? 'bg-white/[0.12] text-white' : 'text-gray-500'}`}>{t.h24}</button>
                </div>
              </div>

              {/* Scrollable time slots */}
              <div className="flex-1 overflow-y-auto space-y-2 max-h-[380px] pr-1">
                {timeSlots.map(s => (
                  <button
                    key={s.value}
                    onClick={() => setSelectedTime(s.value)}
                    disabled={!selectedDate}
                    className={`w-full text-[14px] font-medium py-3 rounded-lg border text-center transition-all ${
                      selectedTime === s.value
                        ? 'bg-emerald-500/15 border-emerald-400/30 text-emerald-300 font-semibold'
                        : selectedDate
                        ? 'bg-[#1a1a22] border-[#2a2a35] text-white hover:border-[#3a3a48] hover:bg-[#222230]'
                        : 'bg-[#1a1a22] border-[#2a2a35] text-gray-500 cursor-default'
                    }`}
                  >
                    {use24h ? s.label24 : s.label12}
                  </button>
                ))}
              </div>

              {/* Confirm button */}
              {selectedDate && selectedTime && (
                <button onClick={handleConfirmTime} className="mt-4 w-full bg-emerald-500 hover:bg-emerald-400 text-black font-semibold py-3 rounded-xl transition-colors text-sm">
                  {t.confirmBtn}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  ) : null

  return (
    <>
      <button onClick={handleOpen} className={btnClass}>{label}</button>
      {mounted && modalContent && createPortal(modalContent, document.body)}
    </>
  )
}
