'use client'

import { AlertCircle } from 'lucide-react'
import type { StepProps, BiddingStrategy } from '../shared/WizardTypes'
import { inputCls, CAMPAIGN_TYPE_BIDDING } from '../shared/WizardTypes'
import { getBudgetRecommendation } from '../shared/WizardValidation'

const BIDDING_LABELS: Record<BiddingStrategy, string> = {
  MAXIMIZE_CLICKS: 'Tıklama Sayısını Artır',
  MAXIMIZE_CONVERSIONS: 'Dönüşümleri Artır',
  TARGET_CPA: 'Hedef EBM (CPA)',
  TARGET_ROAS: 'Hedef ROAS',
  MANUAL_CPC: 'Manuel TBM (CPC)',
  TARGET_IMPRESSION_SHARE: 'Hedef Gösterim Payı',
}

export default function StepCampaignSettings({ state, update, t }: StepProps) {
  const budgetNum = parseFloat(state.dailyBudget) || 0
  const recommended = getBudgetRecommendation(state.biddingStrategy)
  const showBudgetWarning = budgetNum > 0 && budgetNum < recommended

  const availableBidding = CAMPAIGN_TYPE_BIDDING[state.campaignType] ?? ['MAXIMIZE_CLICKS']
  const isSearch = state.campaignType === 'SEARCH'

  return (
    <div className="space-y-4">
      <Field label={t('campaign.name')} required>
        <input className={inputCls} value={state.campaignName} onChange={e => update({ campaignName: e.target.value })} placeholder={t('campaign.namePlaceholder')} />
      </Field>

      <Field label={t('campaign.dailyBudget')} required>
        <input className={inputCls} type="number" min="1" step="1" value={state.dailyBudget} onChange={e => update({ dailyBudget: e.target.value })} placeholder={t('campaign.dailyBudgetPlaceholder')} />
      </Field>

      {showBudgetWarning && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>Google bu strateji için minimum <strong>{recommended} TRY/gün</strong> önermektedir.</span>
        </div>
      )}

      <Field label={t('campaign.biddingStrategy')} required>
        <select
          className={inputCls}
          value={state.biddingStrategy}
          onChange={e => update({ biddingStrategy: e.target.value as BiddingStrategy })}
        >
          {availableBidding.map(bs => (
            <option key={bs} value={bs}>{BIDDING_LABELS[bs] ?? bs}</option>
          ))}
        </select>
      </Field>

      {state.biddingStrategy === 'TARGET_CPA' && (
        <Field label={t('campaign.targetCpa')} required>
          <input className={inputCls} type="number" min="0" step="0.01" value={state.targetCpa} onChange={e => update({ targetCpa: e.target.value })} placeholder={t('campaign.targetCpaPlaceholder')} />
        </Field>
      )}
      {state.biddingStrategy === 'TARGET_ROAS' && (
        <Field label={t('campaign.targetRoas')} required>
          <input className={inputCls} type="number" min="0" step="0.01" value={state.targetRoas} onChange={e => update({ targetRoas: e.target.value })} placeholder={t('campaign.targetRoasPlaceholder')} />
        </Field>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label={t('campaign.startDate')}>
          <input className={inputCls} type="date" value={state.startDate} onChange={e => update({ startDate: e.target.value })} />
        </Field>
        <Field label={t('campaign.endDate')}>
          <input className={inputCls} type="date" value={state.endDate} onChange={e => update({ endDate: e.target.value })} />
        </Field>
      </div>

      {/* Network Settings — only shown for SEARCH campaigns */}
      {isSearch && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Ağ Ayarları</label>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked disabled className="rounded border-gray-300" />
              <span className="text-gray-500">Google Arama <span className="text-xs text-gray-400">(her zaman aktif)</span></span>
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={state.networkSettings.targetSearchNetwork}
                onChange={e => update({ networkSettings: { ...state.networkSettings, targetSearchNetwork: e.target.checked } })}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-gray-700">Arama Ağı Ortakları</span>
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={state.networkSettings.targetContentNetwork}
                onChange={e => update({ networkSettings: { ...state.networkSettings, targetContentNetwork: e.target.checked } })}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-gray-700">Görüntülü Reklam Ağı</span>
            </label>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  )
}
