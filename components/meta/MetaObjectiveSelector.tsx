'use client'

import { useEffect } from 'react'
import { X, MousePointerClick, Eye, Heart, UserPlus, ShoppingCart, Smartphone } from 'lucide-react'
import { getTrafficI18n, getLocale } from './traffic-wizard/i18n'

interface MetaObjectiveSelectorProps {
  isOpen: boolean
  onClose: () => void
  onSelectObjective: (objective: string) => void
}

const OBJECTIVES = [
  {
    key: 'OUTCOME_TRAFFIC',
    icon: MousePointerClick,
    enabled: true,
    desc: { tr: 'Web sitenize veya uygulamanıza trafik çekin', en: 'Drive traffic to your website or app' },
  },
  {
    key: 'OUTCOME_AWARENESS',
    icon: Eye,
    enabled: true,
    desc: { tr: 'Markanızın bilinirliğini artırın', en: 'Increase your brand awareness' },
  },
  {
    key: 'OUTCOME_ENGAGEMENT',
    icon: Heart,
    enabled: true,
    desc: { tr: 'Gönderilerinizle etkileşimi artırın', en: 'Boost engagement on your posts' },
  },
  {
    key: 'OUTCOME_LEADS',
    icon: UserPlus,
    enabled: true,
    desc: { tr: 'Potansiyel müşteri bilgilerini toplayın', en: 'Collect leads from potential customers' },
  },
  {
    key: 'OUTCOME_SALES',
    icon: ShoppingCart,
    enabled: true,
    desc: { tr: 'Satışlarınızı ve dönüşümlerinizi artırın', en: 'Increase your sales and conversions' },
  },
  {
    key: 'OUTCOME_APP_PROMOTION',
    icon: Smartphone,
    enabled: true,
    desc: { tr: 'Uygulamanızı tanıtın ve yüklemeleri artırın', en: 'Promote your app and drive installs' },
  },
] as const

const OBJECTIVE_LABELS: Record<string, Record<string, string>> = {
  OUTCOME_TRAFFIC: { tr: 'Trafik', en: 'Traffic' },
  OUTCOME_AWARENESS: { tr: 'Bilinirlik', en: 'Bilinirlik' },
  OUTCOME_ENGAGEMENT: { tr: 'Etkileşim', en: 'Engagement' },
  OUTCOME_LEADS: { tr: 'Potansiyel Müşteri', en: 'Leads' },
  OUTCOME_SALES: { tr: 'Satış', en: 'Sales' },
  OUTCOME_APP_PROMOTION: { tr: 'Uygulama Tanıtımı', en: 'App Promotion' },
}

export default function MetaObjectiveSelector({ isOpen, onClose, onSelectObjective }: MetaObjectiveSelectorProps) {
  const t = getTrafficI18n()
  const locale = getLocale()

  // Escape key
  useEffect(() => {
    if (!isOpen) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {t.selectObjective}
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">{t.selectObjectiveDesc}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Grid */}
        <div className="p-6 grid grid-cols-2 gap-4">
          {OBJECTIVES.map(({ key, icon: Icon, enabled, desc }) => (
            <button
              key={key}
              type="button"
              onClick={() => enabled && onSelectObjective(key)}
              disabled={!enabled}
              className={`relative flex items-start gap-4 p-5 rounded-xl border text-left transition-all ${
                enabled
                  ? 'bg-white border-gray-200 hover:border-primary hover:shadow-sm cursor-pointer group'
                  : 'bg-gray-50 border-gray-100 opacity-60 cursor-not-allowed'
              }`}
            >
              {/* Icon */}
              <div
                className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${
                  enabled
                    ? 'bg-primary/10 text-primary group-hover:bg-primary/20'
                    : 'bg-gray-200 text-gray-400'
                }`}
              >
                <Icon className="w-5 h-5" />
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-gray-900">
                  {OBJECTIVE_LABELS[key]?.[locale] ?? key}
                </div>
                <div className="text-xs text-gray-500 mt-1 leading-relaxed">
                  {desc[locale]}
                </div>
              </div>

              {/* Coming Soon badge */}
              {!enabled && (
                <span className="absolute top-3 right-3 px-2 py-0.5 text-[10px] font-medium bg-gray-200 text-gray-500 rounded-full">
                  {t.comingSoonBadge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
