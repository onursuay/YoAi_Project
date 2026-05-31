'use client'

import { useTranslations } from 'next-intl'
import { Users, Send, Workflow, ShieldCheck } from 'lucide-react'

/**
 * Email Marketing — modül kabuğu (Faz 3.1 temel). Kişiler/Kampanyalar/Otomasyon
 * bölümleri sonraki fazlarda işlevsel hale gelir. Burada sahte veri/dead buton
 * yok; yalnız modül yapısı + kurulum yönlendirmesi gösterilir.
 */
export default function EmailDashboard() {
  const t = useTranslations('email')

  const sections = [
    { key: 'contacts', icon: Users },
    { key: 'campaigns', icon: Send },
    { key: 'automation', icon: Workflow },
  ] as const

  return (
    <div className="w-full px-6 lg:px-8 py-8">
      {/* Kurulum yönlendirmesi — gönderim domaini */}
      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 flex items-start gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <ShieldCheck className="w-5 h-5 text-primary" />
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900">{t('setup.title')}</p>
          <p className="text-sm text-gray-600 mt-0.5">{t('setup.desc')}</p>
        </div>
      </div>

      {/* Bölümler */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {sections.map(({ key, icon: Icon }) => (
          <div key={key} className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5">
            <div className="w-11 h-11 rounded-xl bg-gray-50 flex items-center justify-center mb-3">
              <Icon className="w-5 h-5 text-primary" />
            </div>
            <h3 className="text-base font-semibold text-gray-900">{t(`sections.${key}.title`)}</h3>
            <p className="text-sm text-gray-600 mt-1">{t(`sections.${key}.desc`)}</p>
            <span className="inline-flex items-center mt-3 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
              {t('soon')}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
