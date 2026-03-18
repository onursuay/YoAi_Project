'use client'

import { Zap, Sparkles, Info } from 'lucide-react'
import type { StepProps } from '../shared/WizardTypes'

export default function StepAIMax({ state, update, t }: StepProps) {
  const aiMax = state.aiMax

  const setAiMax = (partial: Partial<typeof aiMax>) => {
    update({ aiMax: { ...aiMax, ...partial } })
  }

  return (
    <div className="space-y-5">
      {/* Master toggle */}
      <section>
        <div className="flex items-center gap-2 mb-2">
          <Zap className="w-5 h-5 text-amber-500" />
          <h4 className="text-sm font-semibold text-gray-900">{t('aiMax.title')}</h4>
        </div>
        <label
          className={`flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
            aiMax.enabled ? 'border-amber-300 bg-amber-50' : 'border-gray-200 hover:border-gray-300 bg-white'
          }`}
        >
          <input
            type="checkbox"
            checked={aiMax.enabled}
            onChange={e => setAiMax({ enabled: e.target.checked })}
            className="rounded border-gray-300 text-amber-600 focus:ring-amber-500 w-5 h-5"
          />
          <span className="text-sm font-medium text-gray-900">
            {aiMax.enabled ? t('aiMax.enabled') : t('aiMax.disabled')}
          </span>
        </label>
      </section>

      {/* Explanatory section */}
      <section>
        <div className="rounded-lg bg-gray-50 border border-gray-200 p-4">
          <p className="text-sm text-gray-600">
            {t('aiMax.description')}
          </p>
          <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-700/90">
            <Info className="w-3.5 h-3.5 shrink-0" />
            {t('aiMax.uiOnlyNote')}
          </p>
        </div>
      </section>

      {/* Sub-options — visible only when AI Max enabled */}
      {aiMax.enabled && (
        <section className="space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <h5 className="text-sm font-semibold text-gray-900">{t('aiMax.summaryOptions')}</h5>
          </div>

          <label
            className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
              aiMax.broadMatchWithAI ? 'border-amber-200 bg-amber-50/50' : 'border-gray-200 hover:border-gray-300 bg-white'
            }`}
          >
            <input
              type="checkbox"
              checked={aiMax.broadMatchWithAI}
              onChange={e => setAiMax({ broadMatchWithAI: e.target.checked })}
              className="mt-1 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
            />
            <div>
              <span className="text-sm font-medium text-gray-900">{t('aiMax.broadMatchWithAI')}</span>
              <p className="text-xs text-gray-500 mt-0.5">{t('aiMax.broadMatchWithAIHint')}</p>
            </div>
          </label>

          <label
            className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
              aiMax.targetingExpansion ? 'border-amber-200 bg-amber-50/50' : 'border-gray-200 hover:border-gray-300 bg-white'
            }`}
          >
            <input
              type="checkbox"
              checked={aiMax.targetingExpansion}
              onChange={e => setAiMax({ targetingExpansion: e.target.checked })}
              className="mt-1 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
            />
            <div>
              <span className="text-sm font-medium text-gray-900">{t('aiMax.targetingExpansion')}</span>
              <p className="text-xs text-gray-500 mt-0.5">{t('aiMax.targetingExpansionHint')}</p>
            </div>
          </label>

          <label
            className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
              aiMax.creativeOptimization ? 'border-amber-200 bg-amber-50/50' : 'border-gray-200 hover:border-gray-300 bg-white'
            }`}
          >
            <input
              type="checkbox"
              checked={aiMax.creativeOptimization}
              onChange={e => setAiMax({ creativeOptimization: e.target.checked })}
              className="mt-1 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
            />
            <div>
              <span className="text-sm font-medium text-gray-900">{t('aiMax.creativeOptimization')}</span>
              <p className="text-xs text-gray-500 mt-0.5">{t('aiMax.creativeOptimizationHint')}</p>
            </div>
          </label>
        </section>
      )}
    </div>
  )
}
