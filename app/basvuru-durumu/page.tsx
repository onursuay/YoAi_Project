'use client'

/**
 * Başvuru Durumu — onaylanmamış kullanıcının göreceği tek ekran.
 *
 * Akış:
 *   1) /api/signup/approval-status ile durumu çek.
 *   2) Oturum yoksa /login'e gönder.
 *   3) Onaylı (veya owner) ise /dashboard'a yönlendir.
 *   4) Aksi halde başvuru özetini göster + ön görüşme popup'larını yönet.
 */
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { Loader2, CalendarClock, CheckCircle2, ShieldCheck, XCircle } from 'lucide-react'
import PreMeetingApprovalModal from '@/components/signup/PreMeetingApprovalModal'
import PreMeetingScheduleModal from '@/components/signup/PreMeetingScheduleModal'

type ApprovalStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'call_scheduled'
  | 'call_declined'
  | 'needs_call'

type PremeetingStatus = 'pending' | 'scheduled' | 'declined'

interface ApprovalPayload {
  ok: boolean
  authenticated: boolean
  isOwner?: boolean
  email?: string | null
  name?: string | null
  approvalStatus?: ApprovalStatus
  premeetingStatus?: PremeetingStatus
  premeetingScheduledAt?: string | null
  premeetingDeclinedAt?: string | null
  approvedAt?: string | null
  rejectedAt?: string | null
  approvalNote?: string | null
}

function fmtIstanbul(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return '—'
    return d.toLocaleString('tr-TR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Istanbul',
    })
  } catch {
    return '—'
  }
}

export default function BasvuruDurumuPage() {
  const router = useRouter()
  const [data, setData] = useState<ApprovalPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [showApprovalPopup, setShowApprovalPopup] = useState(false)
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [declining, setDeclining] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/signup/approval-status', { cache: 'no-store' })
      if (res.status === 401) {
        router.replace('/login')
        return
      }
      const json = (await res.json()) as ApprovalPayload
      setData(json)
      // Owner veya onaylı kullanıcı bu sayfada bekletilmez.
      if (json?.isOwner || json?.approvalStatus === 'approved') {
        router.replace('/dashboard')
        return
      }
      // Premeeting kararı verilmemişse popup'ı otomatik aç.
      if (json?.premeetingStatus === 'pending' && !showScheduleModal) {
        setShowApprovalPopup(true)
      } else {
        setShowApprovalPopup(false)
      }
    } catch (e) {
      console.warn('[basvuru-durumu] refresh failed:', e)
    } finally {
      setLoading(false)
    }
  }, [router, showScheduleModal])

  useEffect(() => {
    refresh()
  }, [refresh])

  async function handleDecline() {
    if (declining) return
    setDeclining(true)
    try {
      const res = await fetch('/api/signup/premeeting/decline', { method: 'POST' })
      if (!res.ok) throw new Error('decline_failed')
    } catch (e) {
      console.warn('[basvuru-durumu] decline error', e)
    } finally {
      setDeclining(false)
      setShowApprovalPopup(false)
      refresh()
    }
  }

  async function handleScheduled() {
    setShowScheduleModal(false)
    setShowApprovalPopup(false)
    refresh()
  }

  const status: ApprovalStatus = data?.approvalStatus || 'pending'
  const premeeting: PremeetingStatus = data?.premeetingStatus || 'pending'
  const name = data?.name || ''
  const email = data?.email || ''

  let icon = <CalendarClock className="h-8 w-8 text-emerald-300" />
  let title = 'Başvurunuz değerlendirme aşamasında'
  let description =
    'Hesabınızı incelemeye aldık. Ön görüşme tamamlandıktan sonra ekibimiz başvurunuzu nihai olarak onaylayacaktır.'
  let badgeText = 'BAŞVURU ALINDI'

  if (status === 'rejected') {
    icon = <XCircle className="h-8 w-8 text-red-300" />
    title = 'Başvurunuz şu anda onaylanmadı'
    description =
      'Başvurunuzu inceledik ve şu anda onaylayamadık. Sorularınız için destek ekibimizle iletişime geçebilirsiniz.'
    badgeText = 'BAŞVURU REDDEDİLDİ'
  } else if (premeeting === 'scheduled') {
    icon = <CheckCircle2 className="h-8 w-8 text-emerald-300" />
    title = 'Ön görüşmeniz planlandı'
    description = `Ön görüşmeniz ${fmtIstanbul(
      data?.premeetingScheduledAt,
    )} (Europe/Istanbul) olarak planlandı. Görüşme sonrası ekibimiz başvurunuzu nihai olarak değerlendirecek.`
    badgeText = 'GÖRÜŞME PLANLANDI'
  } else if (premeeting === 'declined') {
    icon = <ShieldCheck className="h-8 w-8 text-emerald-300" />
    title = 'Geri bildiriminiz iletildi'
    description =
      'Geri bildiriminiz destek ekibimize iletildi. Sizinle en kısa sürede iletişime geçeceğiz.'
    badgeText = 'TAKİP'
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#060609]">
        <Loader2 className="h-6 w-6 text-emerald-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 bg-[#060609] text-white">
      <div className="w-full max-w-xl relative z-10">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <Link href="/">
            <Image
              src="/logos/yoai-logo.png"
              alt="YoAi"
              width={88}
              height={30}
              className="brightness-0 invert"
              priority
            />
          </Link>
        </div>

        <div className="bg-white/[0.04] border border-white/10 rounded-3xl p-8 backdrop-blur-sm">
          {/* Icon */}
          <div className="flex justify-center mb-5">
            <div className="w-16 h-16 rounded-2xl bg-emerald-400/10 border border-emerald-400/20 flex items-center justify-center">
              {icon}
            </div>
          </div>

          <div className="text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-emerald-300 ring-1 ring-emerald-400/20">
              {badgeText}
            </span>
            <h1 className="mt-3 text-2xl font-bold tracking-tight">{title}</h1>
            <p className="mt-3 text-base text-gray-400 leading-relaxed">{description}</p>
          </div>

          {/* Account summary */}
          <div className="mt-7 rounded-2xl border border-white/10 bg-white/[0.03] divide-y divide-white/[0.06]">
            <div className="grid grid-cols-3 gap-4 px-4 py-3 text-sm">
              <div className="text-gray-400">Ad Soyad</div>
              <div className="col-span-2 text-white">{name || '—'}</div>
            </div>
            <div className="grid grid-cols-3 gap-4 px-4 py-3 text-sm">
              <div className="text-gray-400">E-posta</div>
              <div className="col-span-2 text-white break-all">{email || '—'}</div>
            </div>
            <div className="grid grid-cols-3 gap-4 px-4 py-3 text-sm">
              <div className="text-gray-400">Durum</div>
              <div className="col-span-2 text-white">
                {status === 'approved'
                  ? 'Onaylandı'
                  : status === 'rejected'
                  ? 'Reddedildi'
                  : premeeting === 'scheduled'
                  ? 'Görüşme planlandı'
                  : premeeting === 'declined'
                  ? 'Manuel takip'
                  : 'Değerlendirme bekleniyor'}
              </div>
            </div>
            {premeeting === 'scheduled' && data?.premeetingScheduledAt && (
              <div className="grid grid-cols-3 gap-4 px-4 py-3 text-sm">
                <div className="text-gray-400">Görüşme Saati</div>
                <div className="col-span-2 text-white">
                  {fmtIstanbul(data.premeetingScheduledAt)}
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            {premeeting === 'pending' && status !== 'rejected' && (
              <button
                type="button"
                onClick={() => setShowScheduleModal(true)}
                className="inline-flex items-center justify-center rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-black hover:bg-emerald-400 transition"
              >
                Görüşme Planla
              </button>
            )}
            {premeeting === 'scheduled' && status !== 'rejected' && (
              <button
                type="button"
                onClick={() => setShowScheduleModal(true)}
                className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-white hover:bg-white/[0.08] transition"
              >
                Saati Değiştir
              </button>
            )}
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-xl border border-white/10 px-5 py-3 text-sm font-semibold text-gray-300 hover:bg-white/[0.04] transition"
            >
              Ana Sayfaya Dön
            </Link>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-gray-500">
          Sorularınız için <a className="text-emerald-400 hover:underline" href="mailto:info@yodijital.com">info@yodijital.com</a>
        </p>
      </div>

      {showApprovalPopup && !showScheduleModal && (
        <PreMeetingApprovalModal
          busy={declining}
          onSchedule={() => {
            setShowApprovalPopup(false)
            setShowScheduleModal(true)
          }}
          onDecline={handleDecline}
        />
      )}

      {showScheduleModal && (
        <PreMeetingScheduleModal
          onClose={() => {
            setShowScheduleModal(false)
            refresh()
          }}
          onScheduled={() => handleScheduled()}
        />
      )}
    </div>
  )
}
