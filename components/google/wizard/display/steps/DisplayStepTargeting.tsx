'use client'

import { Users, Sparkles } from 'lucide-react'
import type { StepProps } from '../../shared/WizardTypes'
import StepAudience from '../../steps/StepAudience'
import { DisplaySection } from '../DisplayWizardUI'

export default function DisplayStepTargeting({ state, update, t }: StepProps) {
  return (
    <div className="space-y-8">
      <DisplaySection
        icon={<Users className="w-[18px] h-[18px]" />}
        title={t('steps.audience')}
      >
        <StepAudience state={state} update={update} t={t} />
      </DisplaySection>

      <DisplaySection
        icon={<Sparkles className="w-[18px] h-[18px]" />}
        title={t('display.optimizedTargetingTitle')}
        description={t('display.optimizedTargetingHint')}
      >
        <label
          className={`flex items-start gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
            state.optimizedTargeting
              ? 'border-primary bg-primary/[0.03] shadow-sm'
              : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <input
            type="checkbox"
            checked={state.optimizedTargeting}
            onChange={e => update({ optimizedTargeting: e.target.checked })}
            className="mt-0.5 w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary/20"
          />
          <div className="flex-1">
            <span className="text-sm font-medium text-gray-900">
              {t('display.optimizedTargetingTitle')}
            </span>
            <p className="text-xs text-gray-500 mt-0.5">{t('display.optimizedTargetingHint')}</p>
          </div>
        </label>
      </DisplaySection>
    </div>
  )
}
