'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'

/**
 * Public abonelikten-çık sayfası (auth gerektirmez). E-postadaki linkten gelinir:
 * /unsubscribe?c={campaignId}&e={email}&s={sig}
 */
export default function UnsubscribePage() {
  const t = useTranslations('unsubscribe')
  const params = useSearchParams()
  const c = params.get('c') || ''
  const e = params.get('e') || ''
  const s = params.get('s') || ''

  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')

  const handleUnsub = async () => {
    setStatus('loading')
    try {
      const res = await fetch('/api/email/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ c, e, s }),
      })
      const data = await res.json()
      setStatus(data.ok ? 'done' : 'error')
    } catch {
      setStatus('error')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 max-w-md w-full text-center">
        {status === 'done' ? (
          <>
            <h1 className="text-lg font-semibold text-gray-900">{t('doneTitle')}</h1>
            <p className="text-sm text-gray-600 mt-2">
              {t.rich('doneDesc', {
                email: () => <span className="font-medium">{e}</span>,
              })}
            </p>
          </>
        ) : status === 'error' ? (
          <>
            <h1 className="text-lg font-semibold text-gray-900">{t('errorTitle')}</h1>
            <p className="text-sm text-gray-600 mt-2">{t('errorDesc')}</p>
          </>
        ) : (
          <>
            <h1 className="text-lg font-semibold text-gray-900">{t('title')}</h1>
            <p className="text-sm text-gray-600 mt-2">
              {t.rich('prompt', {
                email: () => <span className="font-medium">{e || t('fallbackEmail')}</span>,
              })}
            </p>
            <button
              onClick={handleUnsub}
              disabled={status === 'loading' || !c || !e || !s}
              className="mt-5 inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition"
            >
              {status === 'loading' ? t('processing') : t('button')}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
