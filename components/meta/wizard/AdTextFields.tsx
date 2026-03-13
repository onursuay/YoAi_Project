'use client'

import { useEffect, useState } from 'react'
import type { WizardState } from './types'
import { getAllowedCTAs, getDefaultCTA, requiresWebsiteUrl } from '@/lib/meta/spec/objectiveSpec'
import { getWizardTranslations, getLocaleFromCookie } from '@/lib/i18n/wizardTranslations'
import { CTA_LABEL_TR } from '@/lib/meta/ctaLabels'

interface AdTextFieldsProps {
  state: WizardState['ad']
  campaignObjective?: string
  conversionLocation?: string
  optimizationGoal?: string
  onChange: (updates: Partial<WizardState['ad']>) => void
  errors?: Record<string, string>
  isMessaging?: boolean
  isCall?: boolean
  isOnPage?: boolean
  isOnAd?: boolean
  isAppPromotion?: boolean
  isCatalog?: boolean
  isLeadsOnAd?: boolean
  activeLeadForms?: Array<{ form_id: string; name: string }>
}

export default function AdTextFields({ state, campaignObjective = 'OUTCOME_TRAFFIC', conversionLocation = 'WEBSITE', optimizationGoal = 'LINK_CLICKS', onChange, errors = {}, isMessaging = false, isCall = false, isOnPage = false, isOnAd = false, isAppPromotion = false, isCatalog = false, isLeadsOnAd = false, activeLeadForms = [] }: AdTextFieldsProps) {
  const locale = getLocaleFromCookie()
  const t = getWizardTranslations(locale)

  const allowedCTAs = getAllowedCTAs(campaignObjective, conversionLocation, optimizationGoal)
  const ctaOptions = allowedCTAs.map((value) => ({
    value,
    label: locale === 'en' ? ((t[value as keyof typeof t] as string) ?? CTA_LABEL_TR[value] ?? value) : (CTA_LABEL_TR[value] ?? value),
  }))
  const [ctaAutoUpdated, setCtaAutoUpdated] = useState(false)

  // Destination veya objective değişince websiteUrl kontrolü
  const showWebsiteUrl = requiresWebsiteUrl(campaignObjective, conversionLocation, optimizationGoal) && !isMessaging && !isCall && !isOnAd && !isOnPage && !isAppPromotion && !isCatalog

  // Geçersiz CTA'yı sadece objective veya destination değiştiğinde defaultCTA'ya resetle
  useEffect(() => {
    if (!allowedCTAs.length) return
    const currentIncluded = allowedCTAs.includes(state.callToAction)
    if (!currentIncluded) {
      const defaultCTA = getDefaultCTA(campaignObjective, conversionLocation, optimizationGoal)
      onChange({ callToAction: defaultCTA })
      setCtaAutoUpdated(true)
    } else {
      setCtaAutoUpdated(false)
    }
  }, [campaignObjective, conversionLocation])

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">
          {t.primaryText} <span className="text-red-500">*</span>
        </label>
        <textarea
          value={state.primaryText}
          onChange={(e) => onChange({ primaryText: e.target.value })}
          placeholder={isCatalog ? '{{product.name}} - {{product.description}}' : t.primaryTextPlaceholder}
          rows={4}
          maxLength={3000}
          className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
        />
        <p className="mt-1 text-caption text-gray-500">{state.primaryText.length} / 3000 ({t.primaryTextHint})</p>
        {isCatalog && (
          <p className="mt-1 text-caption text-blue-600">Katalog alanlarını kullanabilirsiniz: {'{{product.name}}'}, {'{{product.price}}'}, {'{{product.description}}'}</p>
        )}
        {errors.primaryText && <p className="mt-1 text-sm text-red-600">{errors.primaryText}</p>}
      </div>

      {!isMessaging && !isCall && !isOnPage && (
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">{t.headline}</label>
          <input
            type="text"
            value={state.headline}
            onChange={(e) => onChange({ headline: e.target.value })}
            placeholder={t.headlinePlaceholder}
            maxLength={40}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
          />
          <p className="mt-1 text-caption text-gray-500">{state.headline.length} / 40</p>
        </div>
      )}

      {!isMessaging && !isCall && !isOnPage && !isOnAd && (
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">{t.description}</label>
          <input
            type="text"
            value={state.description}
            onChange={(e) => onChange({ description: e.target.value })}
            placeholder={t.descriptionPlaceholder}
            maxLength={30}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
          />
          <p className="mt-1 text-caption text-gray-500">{state.description.length} / 30</p>
        </div>
      )}

      {/* Website URL — sadece destination gerektiriyorsa göster */}
      {showWebsiteUrl && (
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            {t.websiteUrl} <span className="text-red-500">*</span>
          </label>
          <input
            type="url"
            value={state.websiteUrl}
            onChange={(e) => onChange({ websiteUrl: e.target.value })}
            placeholder="https://..."
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
          />
          {errors.websiteUrl && <p className="mt-1 text-sm text-red-600">{errors.websiteUrl}</p>}
        </div>
      )}

      {/* Display URL — sadece websiteUrl gösteriliyorsa anlamlı */}
      {showWebsiteUrl && (
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">{t.displayUrl}</label>
          <input
            type="text"
            value={state.displayUrl}
            onChange={(e) => onChange({ displayUrl: e.target.value })}
            placeholder={t.displayUrlPlaceholder}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
          />
        </div>
      )}

      {/* Leads + ON_AD: Potansiyel Müşteri Formu — CTA'dan önce */}
      {isLeadsOnAd && (
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            {t.leadFormLabel} <span className="text-red-500">*</span>
          </label>
          {activeLeadForms.length > 0 ? (
            <select
              value={state.leadFormId ?? ''}
              onChange={(e) => onChange({ leadFormId: e.target.value || undefined })}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
            >
              <option value="">{t.selectForm}</option>
              {activeLeadForms.map((f) => (
                <option key={f.form_id} value={f.form_id}>
                  {f.name}
                </option>
              ))}
            </select>
          ) : (
            <p className="text-sm text-amber-600">
              {t.leadFormNotFound}
            </p>
          )}
          {errors.lead_form && <p className="mt-1 text-sm text-red-600">{errors.lead_form}</p>}
        </div>
      )}

      {!isCall && !isOnPage && (
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">{t.ctaButton}</label>
        {conversionLocation === 'INSTAGRAM_DIRECT' ? (
          <div className="flex items-center gap-2 px-3 py-2.5 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
            <svg className="h-4 w-4 shrink-0 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
            </svg>
            <span className="font-medium">{t.sendMessage}</span>
            <span className="text-caption text-blue-400 ml-auto">{t.instagramDirectFixed}</span>
          </div>
        ) : (
          <>
            <select
              value={state.callToAction}
              onChange={(e) => {
                onChange({ callToAction: e.target.value })
                setCtaAutoUpdated(false)
              }}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
            >
              {ctaOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            {ctaAutoUpdated && (
              <p className="mt-1 text-caption text-amber-600">{t.ctaAutoUpdated}</p>
            )}
          </>
        )}
      </div>
      )}

    </div>
  )
}
