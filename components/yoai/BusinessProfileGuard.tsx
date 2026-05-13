'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Lock, Sparkles } from 'lucide-react'
import BusinessProfileOnboarding from './BusinessProfileOnboarding'

interface Props {
  children: React.ReactNode
  /**
   * Sayfa adı — engellenirken kullanıcıya gösterilir.
   * Örn: "YoAlgoritma", "Strateji", "Hedef Kitle"
   */
  area: string
  /**
   * Eğer true ise modal görünmez ama içerik kilitli kalır
   * (sadece bilgi banner gösterir). Default: false (modal otomatik açılır).
   */
  silent?: boolean
}

type GuardState = 'loading' | 'completed' | 'incomplete' | 'no_session'

const LOCK_MESSAGE = 'Devam etmek için işletme profilinizi tamamlayın. Bu bilgiler reklam önerileri, strateji ve hedef kitle analizlerinde referans olarak kullanılacaktır.'

export default function BusinessProfileGuard({ children, area, silent = false }: Props) {
  const [state, setState] = useState<GuardState>('loading')
  const [showOnboarding, setShowOnboarding] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/yoai/business-profile')
      if (res.status === 401) {
        setState('no_session')
        return
      }
      const json = await res.json()
      if (json.ok && json.data?.onboarding_completed) {
        setState('completed')
      } else {
        setState('incomplete')
      }
    } catch (e) {
      console.warn('[BusinessProfileGuard] refresh failed:', e)
      setState('incomplete')
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    if (state === 'incomplete' && !silent) {
      setShowOnboarding(true)
    }
  }, [state, silent])

  if (state === 'loading') {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-5 h-5 text-primary animate-spin" />
      </div>
    )
  }

  if (state === 'no_session') {
    return <>{children}</>
  }

  if (state === 'incomplete') {
    return (
      <>
        <div className="max-w-3xl mx-auto p-6 my-6">
          <div className="bg-primary/5 border border-primary/20 rounded-2xl p-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
                <Lock className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <h2 className="text-base font-semibold text-gray-900 mb-1">{area} kilidi açık değil</h2>
                <p className="text-sm text-gray-700 leading-relaxed">{LOCK_MESSAGE}</p>
                <button
                  onClick={() => setShowOnboarding(true)}
                  className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90"
                >
                  <Sparkles className="w-4 h-4" />
                  İşletme Profilini Tamamla
                </button>
              </div>
            </div>
          </div>
        </div>
        {showOnboarding && (
          <BusinessProfileOnboarding
            onComplete={() => {
              setShowOnboarding(false)
              setState('completed')
              refresh()
            }}
            onClose={() => setShowOnboarding(false)}
          />
        )}
      </>
    )
  }

  return <>{children}</>
}
