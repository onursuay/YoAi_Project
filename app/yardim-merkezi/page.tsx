'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { ChevronDown, Mail } from 'lucide-react'

const SUPPORT_EMAIL = 'info@yodijital.com'

const FAQ_KEYS = [
  'platform',
  'connectAccounts',
  'recommendations',
  'creditsVsSubscription',
  'language',
  'dataSecurity',
  'subscriptionManage',
] as const

export default function HelpCenterPage() {
  const t = useTranslations('helpCenter')
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  return (
    <div className="flex flex-col h-full">
      {/* Başlık */}
      <div className="bg-white border-b border-gray-200 px-6 py-5">
        <h1 className="text-xl font-bold text-gray-900">{t('title')}</h1>
        <p className="text-sm text-gray-500 mt-0.5">{t('subtitle')}</p>
      </div>

      <div className="flex-1 overflow-y-auto app-content-surface p-6">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Sık Sorulan Sorular */}
          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-3">{t('faqTitle')}</h2>
            <div className="space-y-3">
              {FAQ_KEYS.map((key, index) => {
                const isOpen = openIndex === index
                return (
                  <div
                    key={key}
                    className="bg-white rounded-xl border border-gray-200 overflow-hidden animate-card-enter hover:shadow-md transition-all duration-300"
                    style={{ ['--card-index' as string]: Math.min(index, 10) }}
                  >
                    <button
                      type="button"
                      onClick={() => setOpenIndex(isOpen ? null : index)}
                      aria-expanded={isOpen}
                      className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-gray-50/60 active:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-inset transition-colors"
                    >
                      <span className="text-sm font-medium text-gray-900">{t(`faq.${key}.q`)}</span>
                      <ChevronDown
                        className={`w-4 h-4 shrink-0 transition-transform duration-300 ${
                          isOpen ? 'rotate-180 text-primary' : 'text-gray-400'
                        }`}
                      />
                    </button>
                    {isOpen && (
                      <div className="px-5 pb-4 pt-3 text-sm leading-relaxed text-gray-600 border-t border-gray-100">
                        {t(`faq.${key}.a`)}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>

          {/* İletişim */}
          <section
            className="bg-white rounded-xl border border-gray-200 p-6 animate-card-enter"
            style={{ ['--card-index' as string]: FAQ_KEYS.length }}
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-gray-900">{t('contactTitle')}</h2>
                <p className="text-sm leading-relaxed text-gray-600 mt-1">{t('contactDesc')}</p>
                <p className="text-sm text-gray-500 mt-1">{SUPPORT_EMAIL}</p>
              </div>
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="inline-flex items-center justify-center gap-2 shrink-0 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-primary/90 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 transition-all"
              >
                <Mail className="w-4 h-4" />
                {t('contactCta')}
              </a>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
