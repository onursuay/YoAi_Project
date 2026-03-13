'use client'

import { AlertCircle } from 'lucide-react'
import type { StepProps } from '../shared/WizardTypes'
import { LANGUAGE_OPTIONS, DAY_LABELS, GOAL_CAMPAIGN_TYPES } from '../shared/WizardTypes'
import { parseKeywords } from '../shared/WizardHelpers'
import { getBudgetRecommendation } from '../shared/WizardValidation'

const goalLabels: Record<string, string> = {
  SALES: 'Satış',
  LEADS: 'Potansiyel Müşteriler',
  WEBSITE_TRAFFIC: 'Web Sitesi Trafiği',
  APP_PROMOTION: 'Uygulama Tanıtımı',
  BRAND_AWARENESS: 'Bilinirlik ve Markayı Dikkate Alma',
  LOCAL_STORE: 'Yerel Mağaza Ziyaretleri',
  NO_GOAL: 'Kılavuz Olmadan',
}

const biddingLabels: Record<string, string> = {
  MAXIMIZE_CLICKS: 'Tıklama Sayısını Artır',
  MAXIMIZE_CONVERSIONS: 'Dönüşümleri Artır',
  TARGET_CPA: 'Hedef EBM (CPA)',
  TARGET_ROAS: 'Hedef ROAS',
  MANUAL_CPC: 'Manuel TBM (CPC)',
  TARGET_IMPRESSION_SHARE: 'Hedef Gösterim Payı',
}

const modeLabels: Record<string, string> = {
  OBSERVATION: 'Gözlem',
  TARGETING: 'Hedefleme',
}

export default function StepSummary({ state, t }: StepProps) {
  const budgetNum = parseFloat(state.dailyBudget) || 0
  const recommended = getBudgetRecommendation(state.biddingStrategy)
  const showBudgetWarning = budgetNum > 0 && budgetNum < recommended

  const positiveLocations = state.locations.filter(l => !l.isNegative)
  const negativeLocations = state.locations.filter(l => l.isNegative)
  const langNames = state.languageIds.map(id => LANGUAGE_OPTIONS.find(l => l.id === id)?.name ?? id).join(', ')
  const kwCount = parseKeywords(state.keywordsRaw, state.defaultMatchType).length
  const hCount = state.headlines.filter(h => h.trim()).length
  const dCount = state.descriptions.filter(d => d.trim()).length

  // Get campaign type label from GOAL_CAMPAIGN_TYPES
  const campaignTypeLabel = GOAL_CAMPAIGN_TYPES[state.campaignGoal]
    ?.find(ct => ct.type === state.campaignType)?.label ?? state.campaignType

  const networks: string[] = []
  if (state.campaignType === 'SEARCH') {
    if (state.networkSettings.targetGoogleSearch) networks.push('Google Arama')
    if (state.networkSettings.targetSearchNetwork) networks.push('Arama Ağı Ortakları')
    if (state.networkSettings.targetContentNetwork) networks.push('Görüntülü Reklam Ağı')
  }

  return (
    <div className="space-y-4">
      {showBudgetWarning && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>Günlük bütçe ({state.dailyBudget} TRY), önerilen minimumun ({recommended} TRY) altında.</span>
        </div>
      )}

      <Row label="Kampanya Hedefi" value={goalLabels[state.campaignGoal] ?? state.campaignGoal} />
      <Row label="Kampanya Türü" value={campaignTypeLabel} />
      <Row label={t('summary.campaign')} value={state.campaignName} />
      <Row label={t('summary.dailyBudget')} value={`${state.dailyBudget} TRY`} />
      <Row label={t('summary.biddingStrategy')} value={biddingLabels[state.biddingStrategy] ?? state.biddingStrategy} />
      {state.targetCpa && <Row label={t('summary.targetCpa')} value={`${state.targetCpa} TRY`} />}
      {state.targetRoas && <Row label={t('summary.targetRoas')} value={state.targetRoas} />}
      {networks.length > 0 && <Row label="Ağ Ayarları" value={networks.join(', ')} />}
      {state.startDate && <Row label={t('summary.startDate')} value={state.startDate} />}
      {state.endDate && <Row label={t('summary.endDate')} value={state.endDate} />}

      <Row
        label={t('summary.locations')}
        value={positiveLocations.length > 0
          ? positiveLocations.map(l => l.name).join(', ')
          : 'Tüm Dünya'}
      />
      {negativeLocations.length > 0 && (
        <Row label="Hariç Konumlar" value={negativeLocations.map(l => l.name).join(', ')} />
      )}

      <Row label="Diller" value={langNames || '-'} />

      {state.selectedAudienceSegments.length > 0 && (
        <>
          <Row label="Kitle Segmentleri" value={`${state.selectedAudienceSegments.length} segment seçildi`} />
          <Row label="Kitle Modu" value={modeLabels[state.audienceMode] ?? state.audienceMode} />
          <div className="flex flex-wrap gap-1 py-1">
            {state.selectedAudienceSegments.map(seg => (
              <span key={`${seg.category}-${seg.id}`} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                {seg.name}
              </span>
            ))}
          </div>
        </>
      )}

      <Row label={t('summary.adGroup')} value={state.adGroupName || `${state.campaignName} - Reklam Grubu 1`} />
      {kwCount > 0 && <Row label={t('adgroup.keywords')} value={t('summary.keywordCount', { count: kwCount })} />}
      <Row label={t('summary.finalUrl')} value={state.finalUrl} />
      {hCount > 0 && <Row label={t('ad.headlines')} value={t('summary.headlineCount', { count: hCount })} />}
      {dCount > 0 && <Row label={t('ad.descriptions')} value={t('summary.descriptionCount', { count: dCount })} />}

      <Row
        label="Reklam Zamanlaması"
        value={state.adSchedule.length > 0
          ? `${state.adSchedule.length} zaman dilimi`
          : '7/24 - Tüm gün'}
      />
      {state.adSchedule.length > 0 && (
        <div className="flex flex-wrap gap-1 ml-auto max-w-xs">
          {state.adSchedule.map((e, i) => (
            <span key={i} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
              {DAY_LABELS[e.dayOfWeek]?.slice(0, 3)} {String(e.startHour).padStart(2, '0')}:00–{String(e.endHour).padStart(2, '0')}:00
            </span>
          ))}
        </div>
      )}

      <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-800">
        Kampanya oluşturulduğunda otomatik olarak yayına alınacaktır.
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-start py-2 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-900 text-right max-w-xs truncate">{value}</span>
    </div>
  )
}
