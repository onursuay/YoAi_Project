'use client'

import type { StepProps } from '../../shared/WizardTypes'
import StepAudience from '../../steps/StepAudience'

export default function DisplayStepTargeting({ state, update, t }: StepProps) {
  return (
    <div className="space-y-6">
      {/* Audience — mevcut paylaşılan component, dokunulmadı */}
      <StepAudience state={state} update={update} t={t} />

      {/* Optimized targeting — gerçek Google Ads Display akışındaki toggle */}
      <section className="border border-gray-200 rounded-lg bg-white p-4">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={state.optimizedTargeting}
            onChange={e => update({ optimizedTargeting: e.target.checked })}
            className="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <div className="flex-1">
            <div className="text-sm font-medium text-gray-900">
              {t('display.optimizedTargetingTitle')}
            </div>
            <p className="text-[12px] text-gray-500 mt-0.5">
              {t('display.optimizedTargetingHint')}
            </p>
          </div>
        </label>
      </section>
    </div>
  )
}
