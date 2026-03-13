'use client'

import { Lock, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ROUTES } from '@/lib/routes'

interface Props {
  type: 'subscription' | 'aiLimit' | 'strategyLimit'
  onClose?: () => void
}

export default function SubscriptionGateModal({ type, onClose }: Props) {
  const t = useTranslations('subscription.gateModal')
  const router = useRouter()

  const isLimit = type === 'aiLimit'
  const isStrategy = type === 'strategyLimit'

  let title: string, description: string, ctaLabel: string
  if (isStrategy) {
    title = 'Strateji Limiti Doldu'
    description = 'Bu ay için ücretsiz AI strateji hakkınız doldu. Devam etmek için kredi yükleyin veya planınızı yükseltin.'
    ctaLabel = 'Kredi Yükle / Plan Yükselt'
  } else if (isLimit) {
    title = t('aiLimitTitle')
    description = t('aiLimitDesc')
    ctaLabel = t('aiLimitCta')
  } else {
    title = t('title')
    description = t('description')
    ctaLabel = t('cta')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop with blur */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-8 text-center">
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-5">
          <Lock className="w-8 h-8 text-primary" />
        </div>

        <h2 className="text-xl font-bold text-gray-900 mb-3">{title}</h2>
        <p className="text-sm text-gray-500 mb-8 leading-relaxed">{description}</p>

        <button
          onClick={() => router.push(ROUTES.SUBSCRIPTION)}
          className="w-full py-3 bg-primary text-white font-medium rounded-xl hover:bg-primary/90 transition-colors text-sm"
        >
          {ctaLabel}
        </button>
      </div>
    </div>
  )
}
