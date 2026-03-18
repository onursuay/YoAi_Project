'use client'

import { ShoppingCart, Users, Globe, Eye, MapPin, Compass, Zap } from 'lucide-react'
import type { PMaxStepProps, PMaxCampaignGoal } from '../shared/PMaxWizardTypes'
import { PMaxGoalsWithPMax } from '../shared/PMaxWizardTypes'

const GOAL_ICONS: Record<PMaxCampaignGoal, typeof ShoppingCart> = {
  SALES: ShoppingCart,
  LEADS: Users,
  WEBSITE_TRAFFIC: Globe,
  BRAND_AWARENESS: Eye,
  LOCAL_STORE: MapPin,
  NO_GOAL: Compass,
}

export default function PMaxStepGoalType({ state, update, t }: PMaxStepProps) {
  const handleGoalChange = (goal: PMaxCampaignGoal) => {
    update({ campaignGoal: goal })
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-1">{t('goal.selectTitle')}</h3>
        <p className="text-sm text-gray-500">{t('goal.selectDesc')}</p>
      </div>

      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">
          {t('goal.pmaxTypeNote')}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {PMaxGoalsWithPMax.map(id => {
          const active = state.campaignGoal === id
          const Icon = GOAL_ICONS[id]
          return (
            <button
              key={id}
              type="button"
              onClick={() => handleGoalChange(id)}
              className={`flex flex-col items-start gap-2 p-4 rounded-xl border-2 text-left transition-all ${
                active
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300 bg-white'
              } ${id === 'NO_GOAL' ? 'col-span-2' : ''}`}
            >
              <Icon className={`w-5 h-5 ${active ? 'text-blue-600' : 'text-gray-400'}`} />
              <div>
                <p className={`text-sm font-semibold ${active ? 'text-blue-700' : 'text-gray-800'}`}>
                  {t(`goal.labels.${id}`)}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">{t(`goal.descs.${id}`)}</p>
              </div>
            </button>
          )
        })}
      </div>

      <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-50 border border-blue-200">
        <Zap className="w-5 h-5 text-blue-600 shrink-0" />
        <p className="text-sm text-blue-800">{t('goal.pmaxDescription')}</p>
      </div>
    </div>
  )
}
