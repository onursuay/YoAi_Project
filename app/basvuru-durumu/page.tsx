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
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
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
  | 'blocked'
  | 'manual_review'

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

function fmtIstanbul(iso: string | null | undefined, locale: string): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return '—'
    return d.toLocaleString(locale === 'en' ? 'en-US' : 'tr-TR', {
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
  const t = useTranslations('approvalStatus')
  const tc = useTranslations('common')
  const locale = useLocale()
  const [data, setData] = useState<ApprovalPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [showApprovalPopup, setShowApprovalPopup] = useState(false)
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [declining, setDeclining] = useState(false)
  const [cardVisible, setCardVisible] = useState(false)
  const cardTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  useEffect(() => {
    if (!loading) {
      cardTimerRef.current = setTimeout(() => setCardVisible(true), 40)
      return () => {
        if (cardTimerRef.current) clearTimeout(cardTimerRef.current)
      }
    }
  }, [loading])

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

  let icon = <CalendarClock className="h-10 w-10 text-emerald-300" />
  let iconBg = 'bg-emerald-400/10 border-emerald-400/20'
  let iconGlow = 'shadow-[0_0_28px_0px_rgba(52,211,153,0.25)]'
  let title = t('pending.title')
  let description = t('pending.description')
  let badgeText = t('pending.badge')

  if (status === 'blocked') {
    icon = <ShieldCheck className="h-10 w-10 text-gray-400" />
    iconBg = 'bg-gray-500/10 border-gray-500/20'
    iconGlow = 'shadow-[0_0_28px_0px_rgba(156,163,175,0.2)]'
    title = t('blocked.title')
    description = t('blocked.description')
    badgeText = t('blocked.badge')
  } else if (status === 'manual_review') {
    icon = <CalendarClock className="h-10 w-10 text-emerald-300" />
    iconBg = 'bg-emerald-400/10 border-emerald-400/20'
    iconGlow = 'shadow-[0_0_28px_0px_rgba(52,211,153,0.25)]'
    title = t('manualReview.title')
    description = t('manualReview.description')
    badgeText = t('manualReview.badge')
  } else if (status === 'rejected') {
    icon = <XCircle className="h-10 w-10 text-red-400" />
    iconBg = 'bg-red-500/10 border-red-500/20'
    iconGlow = 'shadow-[0_0_28px_0px_rgba(248,113,113,0.2)]'
    title = t('rejected.title')
    description = t('rejected.description')
    badgeText = t('rejected.badge')
  } else if (premeeting === 'scheduled') {
    icon = <CheckCircle2 className="h-10 w-10 text-emerald-300" />
    iconBg = 'bg-emerald-400/10 border-emerald-400/20'
    iconGlow = 'shadow-[0_0_28px_0px_rgba(52,211,153,0.25)]'
    title = t('premeetingScheduled.title')
    description = t('premeetingScheduled.description', {
      datetime: fmtIstanbul(data?.premeetingScheduledAt, locale),
    })
    badgeText = t('premeetingScheduled.badge')
  } else if (premeeting === 'declined') {
    icon = <ShieldCheck className="h-10 w-10 text-emerald-300" />
    iconBg = 'bg-emerald-400/10 border-emerald-400/20'
    iconGlow = 'shadow-[0_0_28px_0px_rgba(52,211,153,0.25)]'
    title = t('premeetingDeclined.title')
    description = t('premeetingDeclined.description')
    badgeText = t('premeetingDeclined.badge')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#060609]">
        <Loader2 className="h-6 w-6 text-emerald-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-[#060609] text-white">
      <div className="w-full max-w-2xl relative z-10">
        {/* Logo */}
        <div
          className={[
            'flex justify-center mb-8 transition-all duration-500 ease-out',
            cardVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2',
          ].join(' ')}
        >
          <Link href="/">
            <Image
              src="/logos/yoai-logo.png"
              alt="YoAi"
              width={96}
              height={32}
              className="brightness-0 invert"
              priority
            />
          </Link>
        </div>

        <div
          className={[
            'bg-white/[0.04] border border-white/10 rounded-3xl p-10 backdrop-blur-sm',
            'transition-all duration-500 ease-out',
            cardVisible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-[0.97] translate-y-4',
          ].join(' ')}
        >
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className={`relative w-20 h-20 rounded-2xl border flex items-center justify-center ${iconBg} ${iconGlow}`}>
              <div className={`absolute inset-0 rounded-2xl ${iconBg} animate-pulse opacity-50`} />
              <span className="relative">{icon}</span>
            </div>
          </div>

          <div className="text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-emerald-300 ring-1 ring-emerald-400/20">
              {badgeText}
            </span>
            <h1 className="mt-4 text-3xl font-bold tracking-tight">{title}</h1>
            <p className="mt-4 text-[16px] text-gray-400 leading-relaxed max-w-lg mx-auto">{description}</p>
          </div>

          {/* Account summary */}
          <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] divide-y divide-white/[0.06]">
            <div className="grid grid-cols-3 gap-4 px-5 py-4 text-sm">
              <div className="text-gray-400 font-medium">{t('summary.fullName')}</div>
              <div className="col-span-2 text-white">{name || '—'}</div>
            </div>
            <div className="grid grid-cols-3 gap-4 px-5 py-4 text-sm">
              <div className="text-gray-400 font-medium">{t('summary.email')}</div>
              <div className="col-span-2 text-white break-all">{email || '—'}</div>
            </div>
            <div className="grid grid-cols-3 gap-4 px-5 py-4 text-sm">
              <div className="text-gray-400 font-medium">{t('summary.status')}</div>
              <div className="col-span-2 text-white">
                {status === 'approved'
                  ? t('summary.statusApproved')
                  : status === 'rejected'
                  ? t('summary.statusRejected')
                  : premeeting === 'scheduled'
                  ? t('summary.statusScheduled')
                  : premeeting === 'declined'
                  ? t('summary.statusManualFollow')
                  : t('summary.statusPending')}
              </div>
            </div>
            {premeeting === 'scheduled' && data?.premeetingScheduledAt && (
              <div className="grid grid-cols-3 gap-4 px-5 py-4 text-sm">
                <div className="text-gray-400 font-medium">{t('summary.meetingTime')}</div>
                <div className="col-span-2 text-white">
                  {fmtIstanbul(data.premeetingScheduledAt, locale)}
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
            {premeeting === 'pending' && status !== 'rejected' && status !== 'blocked' && status !== 'manual_review' && (
              <button
                type="button"
                onClick={() => setShowScheduleModal(true)}
                className="inline-flex items-center justify-center rounded-xl bg-emerald-500 px-7 py-3.5 text-[15px] font-semibold text-black shadow-md shadow-emerald-500/20 hover:bg-emerald-400 hover:shadow-lg hover:shadow-emerald-400/25 transition"
              >
                {t('actions.schedule')}
              </button>
            )}
            {premeeting === 'scheduled' && status !== 'rejected' && status !== 'blocked' && status !== 'manual_review' && (
              <button
                type="button"
                onClick={() => setShowScheduleModal(true)}
                className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-7 py-3.5 text-[15px] font-semibold text-white hover:bg-white/[0.08] transition"
              >
                {t('actions.reschedule')}
              </button>
            )}
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-xl border border-white/10 px-7 py-3.5 text-[15px] font-semibold text-gray-300 hover:bg-white/[0.04] transition"
            >
              {tc('backToHome')}
            </Link>
          </div>
        </div>

        <p
          className={[
            'mt-6 text-center text-xs text-gray-500 transition-all duration-700 delay-300',
            cardVisible ? 'opacity-100' : 'opacity-0',
          ].join(' ')}
        >
          {t('supportPrefix')} <a className="text-emerald-400 hover:underline" href="mailto:info@yodijital.com">info@yodijital.com</a>
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
