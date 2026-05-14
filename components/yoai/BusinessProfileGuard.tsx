'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Lock, Sparkles, Building2, Target, Globe } from 'lucide-react'
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
        <div className="flex items-center justify-center min-h-[calc(100vh-120px)] px-6 py-12">
          <div className="w-full max-w-lg text-center space-y-8">
            {/* Icon */}
            <div className="flex justify-center">
              <div className="relative">
                <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center shadow-[0_0_0_8px_rgba(var(--color-primary-rgb),0.06)]">
                  <Lock className="w-9 h-9 text-primary" />
                </div>
              </div>
            </div>

            {/* Text */}
            <div className="space-y-3">
              <h2 className="text-2xl font-bold text-gray-900">{area} kilitli</h2>
              <p className="text-base text-gray-500 leading-relaxed max-w-sm mx-auto">
                Devam etmek için işletme profilinizi tamamlayın. Reklam önerileri, strateji ve hedef kitle analizleri bu bilgilere dayanır.
              </p>
            </div>

            {/* Steps */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { icon: Building2, label: 'Firma & Sektör' },
                { icon: Target, label: 'Hedef & Rakipler' },
                { icon: Globe, label: 'Marka Kaynakları' },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-4 flex flex-col items-center gap-2">
                  <Icon className="w-5 h-5 text-primary" />
                  <span className="text-xs font-medium text-gray-600 text-center leading-tight">{label}</span>
                </div>
              ))}
            </div>

            {/* CTA */}
            <button
              onClick={() => setShowOnboarding(true)}
              className="inline-flex items-center gap-2 px-7 py-3 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 shadow-[0_4px_14px_rgba(var(--color-primary-rgb),0.35)] transition-all hover:shadow-[0_6px_20px_rgba(var(--color-primary-rgb),0.45)] hover:-translate-y-0.5"
            >
              <Sparkles className="w-4 h-4" />
              İşletme Profilini Tamamla
            </button>
            <p className="text-xs text-gray-400">Yaklaşık 3-5 dakika sürer · Tek seferlik kurulum</p>
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
