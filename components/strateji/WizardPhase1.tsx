'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Save, Zap, CheckCircle, AlertCircle, XCircle } from 'lucide-react'
import type { InputPayload, GoalType } from '@/lib/strategy/types'
import { GOAL_TYPES, INDUSTRIES, TIME_HORIZONS, GEOGRAPHIES } from '@/lib/strategy/constants'
import WizardSelect from '@/components/meta/wizard/WizardSelect'

interface WizardPhase1Props {
  instanceId: string
  initialData?: Partial<InputPayload>
  onSave: (payload: InputPayload) => Promise<void>
  onSaveAndAnalyze: (payload: InputPayload) => Promise<void>
  saving: boolean
}

const DEFAULT_INTEGRATIONS = { pixel: 'yellow' as const, analytics: 'yellow' as const, crm: 'red' as const }

// Sektör değeri (veri olarak Türkçe sabit) -> i18n alt-anahtarı eşlemesi.
// Değer KORUNUR (API/form datası), yalnız gösterilen etiket çeviriden gelir.
const INDUSTRY_KEY: Record<string, string> = {
  'E-Ticaret': 'ecommerce',
  'SaaS / Yazılım': 'saas',
  'Eğitim': 'education',
  'Sağlık': 'health',
  'Finans': 'finance',
  'Gayrimenkul': 'realEstate',
  'Restoran / Yeme-İçme': 'restaurant',
  'Moda / Giyim': 'fashion',
  'Otomotiv': 'automotive',
  'Turizm / Otelcilik': 'tourism',
  'Spor / Fitness': 'fitness',
  'Güzellik / Kozmetik': 'beauty',
  'Hukuk': 'law',
  'Danışmanlık': 'consulting',
  'Diğer': 'other',
}

// Coğrafya değeri (veri olarak Türkçe sabit) -> i18n alt-anahtarı eşlemesi.
const GEOGRAPHY_KEY: Record<string, string> = {
  'Türkiye': 'turkey',
  'ABD': 'usa',
  'Avrupa': 'europe',
  'İngiltere': 'uk',
  'Almanya': 'germany',
  'Fransa': 'france',
  'Hollanda': 'netherlands',
  'BAE': 'uae',
  'Suudi Arabistan': 'saudiArabia',
  'Küresel': 'global',
}

export default function WizardPhase1({ instanceId, initialData, onSave, onSaveAndAnalyze, saving }: WizardPhase1Props) {
  const locale = useLocale() as 'tr' | 'en'
  const t = useTranslations('dashboard.strateji.wizard')
  const tc = useTranslations('common')
  const [form, setForm] = useState<InputPayload>({
    goal_type: initialData?.goal_type || 'sales',
    product: initialData?.product || '',
    industry: initialData?.industry || '',
    industry_custom: initialData?.industry_custom || '',
    avg_basket: initialData?.avg_basket || undefined,
    margin_pct: initialData?.margin_pct || undefined,
    ltv: initialData?.ltv || undefined,
    geographies: initialData?.geographies || ['Türkiye'],
    language: initialData?.language || 'TR',
    monthly_budget_try: initialData?.monthly_budget_try || 0,
    currency: initialData?.currency || 'TRY',
    time_horizon_days: initialData?.time_horizon_days || 30,
    channels: initialData?.channels || { meta: true, google: false, tiktok: false },
    integrations: initialData?.integrations || DEFAULT_INTEGRATIONS,
  })

  const update = <K extends keyof InputPayload>(key: K, value: InputPayload[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const IntegrationDot = ({ status }: { status: 'green' | 'yellow' | 'red' }) => {
    const icons = {
      green: <CheckCircle className="w-4 h-4 text-emerald-500" />,
      yellow: <AlertCircle className="w-4 h-4 text-gray-400" />,
      red: <XCircle className="w-4 h-4 text-red-500" />,
    }
    const labels = { green: t('integration.connected'), yellow: t('integration.partial'), red: t('integration.notConnected') }
    return (
      <span className="flex items-center gap-1 text-xs">
        {icons[status]} {labels[status]}
      </span>
    )
  }

  return (
    <div className="space-y-6">
      <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-primary mb-1">{t('phaseTitle')}</h3>
        <p className="text-xs text-gray-600">{t('phaseDesc')}</p>
      </div>

      {/* İş Hedefi — Meta Kampanya Hedefleri */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('goalLabel')}</label>
        <p className="text-xs text-gray-500 mb-2">{t('goalHint')}</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {GOAL_TYPES.map((g) => (
            <button
              key={g.value}
              type="button"
              onClick={() => update('goal_type', g.value as GoalType)}
              className={`px-3 py-2.5 rounded-lg text-left border transition-colors ${
                form.goal_type === g.value
                  ? 'bg-primary/10 border-primary text-primary'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              <span className="block text-sm font-medium">{g.label[locale]}</span>
              <span className="block text-[10px] mt-0.5 opacity-70">{g.description[locale]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Ürün / Hizmet */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('productLabel')}</label>
        <input
          type="text"
          value={form.product}
          onChange={(e) => update('product', e.target.value)}
          placeholder={t('productPlaceholder')}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
        />
      </div>

      {/* Sektör */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('industryLabel')}</label>
        <WizardSelect
          value={form.industry}
          onChange={(v) => update('industry', v)}
          options={INDUSTRIES.map((ind) => ({ value: ind, label: t(`industries.${INDUSTRY_KEY[ind] ?? 'other'}`) }))}
          placeholder={t('industryPlaceholder')}
        />
        {form.industry === 'Diğer' && (
          <input
            type="text"
            value={form.industry_custom || ''}
            onChange={(e) => update('industry_custom', e.target.value)}
            placeholder={t('industryCustomPlaceholder')}
            className="w-full mt-2 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        )}
      </div>

      {/* Opsiyonel metrikler */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">{t('avgBasketLabel')}</label>
          <input
            type="number"
            value={form.avg_basket || ''}
            onChange={(e) => update('avg_basket', e.target.value ? Number(e.target.value) : undefined)}
            placeholder={t('optional')}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">{t('marginLabel')}</label>
          <input
            type="number"
            value={form.margin_pct || ''}
            onChange={(e) => update('margin_pct', e.target.value ? Number(e.target.value) : undefined)}
            placeholder={t('optional')}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">{t('ltvLabel')}</label>
          <input
            type="number"
            value={form.ltv || ''}
            onChange={(e) => update('ltv', e.target.value ? Number(e.target.value) : undefined)}
            placeholder={t('optional')}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>
      </div>

      {/* Coğrafya */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('geographyLabel')}</label>
        <div className="flex flex-wrap gap-2">
          {GEOGRAPHIES.map((geo) => (
            <button
              key={geo}
              type="button"
              onClick={() => {
                const current = form.geographies
                if (current.includes(geo)) {
                  update('geographies', current.filter((g) => g !== geo))
                } else {
                  update('geographies', [...current, geo])
                }
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                form.geographies.includes(geo)
                  ? 'bg-primary/10 border-primary text-primary'
                  : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
              }`}
            >
              {t(`geographies.${GEOGRAPHY_KEY[geo] ?? 'global'}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Bütçe + Zaman Ufku */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('budgetLabel')}</label>
          <input
            type="number"
            value={form.monthly_budget_try || ''}
            onChange={(e) => update('monthly_budget_try', Number(e.target.value))}
            placeholder={t('budgetPlaceholder')}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('timeHorizonLabel')}</label>
          <div className="flex gap-2">
            {TIME_HORIZONS.map((th) => (
              <button
                key={th.value}
                type="button"
                onClick={() => update('time_horizon_days', th.value)}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  form.time_horizon_days === th.value
                    ? 'bg-primary/10 border-primary text-primary'
                    : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                {t('days', { count: th.value })}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Kanal Seçimi */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('channelLabel')}</label>
        <div className="flex gap-3">
          {[
            { key: 'meta' as const, label: 'Meta', enabled: true },
            { key: 'google' as const, label: 'Google', enabled: true },
            { key: 'tiktok' as const, label: 'TikTok', enabled: false },
          ].map((ch) => (
            <button
              key={ch.key}
              type="button"
              disabled={!ch.enabled}
              onClick={() => {
                if (!ch.enabled) return
                update('channels', { ...form.channels, [ch.key]: !form.channels[ch.key] })
              }}
              className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                !ch.enabled
                  ? 'bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed'
                  : form.channels[ch.key]
                    ? 'bg-primary/10 border-primary text-primary'
                    : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              {ch.label}
              {!ch.enabled && <span className="ml-1 text-[10px]">{t('comingSoon')}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Entegrasyon Kontrolleri */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">{t('integrationStatusLabel')}</label>
        <div className="grid grid-cols-3 gap-3">
          {[
            { key: 'pixel' as const, label: t('integration.pixelTag'), suggestion: form.integrations.pixel === 'red' ? t('integration.installPixel') : form.integrations.pixel === 'yellow' ? t('integration.verifyEvents') : '' },
            { key: 'analytics' as const, label: t('integration.analytics'), suggestion: form.integrations.analytics === 'red' ? t('integration.installGa4') : form.integrations.analytics === 'yellow' ? t('integration.setGoals') : '' },
            { key: 'crm' as const, label: t('integration.crm'), suggestion: form.integrations.crm === 'red' ? t('integration.addCrm') : form.integrations.crm === 'yellow' ? t('integration.checkDataFlow') : '' },
          ].map((intg) => (
            <div key={intg.key} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-gray-700">{intg.label}</span>
                <IntegrationDot status={form.integrations[intg.key]} />
              </div>
              {intg.suggestion && (
                <p className="text-[10px] text-gray-500">{intg.suggestion}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Butonlar */}
      <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
        <button
          onClick={() => onSave(form)}
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {tc('save')}
        </button>
        <button
          onClick={() => onSaveAndAnalyze(form)}
          disabled={saving}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          <Zap className="w-4 h-4" />
          {saving ? t('processing') : t('saveAndAnalyze')}
        </button>
      </div>
    </div>
  )
}
