'use client'

/**
 * KVKK / ePrivacy çerez onay banner'ı.
 *
 * - `cookie_consent` çerezi yoksa görünür (accepted | rejected değerleri).
 * - "Kabul Et" → analytics_storage granted; "Reddet" → denied (Consent Mode v2).
 * - Analitik zaten default-off + yalnız first-party; banner şeffaflık + reddetme
 *   hakkı içindir. Zorunlu/teknik çerezler her hâlükârda çalışır.
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'

const CONSENT_COOKIE = 'cookie_consent'
const ONE_YEAR = 60 * 60 * 24 * 365

function getConsent(): string | null {
  if (typeof document === 'undefined') return null
  const m = document.cookie.match(/(?:^|;\s*)cookie_consent=([^;]+)/)
  return m ? decodeURIComponent(m[1]) : null
}

function setConsent(value: 'accepted' | 'rejected') {
  document.cookie = `${CONSENT_COOKIE}=${value}; path=/; max-age=${ONE_YEAR}; SameSite=Lax`
  // Consent Mode v2 güncelle (gtag varsa)
  const w = window as unknown as { gtag?: (...args: unknown[]) => void; dataLayer?: unknown[] }
  if (typeof w.gtag === 'function') {
    w.gtag('consent', 'update', {
      analytics_storage: value === 'accepted' ? 'granted' : 'denied',
    })
  }
}

export default function CookieConsent() {
  const t = useTranslations('cookieConsent')
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!getConsent()) setVisible(true)
  }, [])

  if (!visible) return null

  const choose = (value: 'accepted' | 'rejected') => {
    setConsent(value)
    setVisible(false)
  }

  return (
    <div
      role="dialog"
      aria-label={t('title')}
      className="fixed bottom-0 inset-x-0 z-[100] p-4 sm:p-5 animate-card-enter"
    >
      <div className="max-w-3xl mx-auto rounded-2xl border border-gray-200 bg-white/95 backdrop-blur-md shadow-[0_8px_30px_rgba(0,0,0,0.12)] p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1">
            <h2 className="text-base font-semibold text-gray-900 mb-1">{t('title')}</h2>
            <p className="text-sm leading-relaxed text-gray-600">
              {t('description')}{' '}
              <Link href="/cerez-politikasi" className="text-primary font-medium hover:underline">
                {t('policyLink')}
              </Link>
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => choose('rejected')}
              className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors active:scale-[0.97]"
            >
              {t('reject')}
            </button>
            <button
              type="button"
              onClick={() => choose('accepted')}
              className="px-5 py-2 rounded-lg text-sm font-semibold text-white bg-primary hover:bg-primary/90 transition-all active:scale-[0.97]"
            >
              {t('accept')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
