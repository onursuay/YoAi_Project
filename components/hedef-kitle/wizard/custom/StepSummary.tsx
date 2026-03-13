'use client'

import type { CustomAudienceState } from '../types'
import { SOURCE_LABELS } from '../types'

interface StepSummaryProps {
  state: CustomAudienceState
  onChange: (updates: Partial<CustomAudienceState>) => void
}

export default function StepSummary({ state, onChange }: StepSummaryProps) {
  const source = state.source

  return (
    <div>
      <h3 className="text-section-title text-gray-900 mb-1">Özet</h3>
      <p className="text-sm text-gray-500 mb-6">Kitle bilgilerini gözden geçirin ve adlandırın.</p>

      <div className="space-y-5">
        {/* Ad */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Kitle Adı <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={state.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="Ör: Son 30 gün site ziyaretçileri"
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>

        {/* Açıklama */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Açıklama (Opsiyonel)</label>
          <textarea
            value={state.description}
            onChange={(e) => onChange({ description: e.target.value })}
            placeholder="Kitle hakkında kısa bir not..."
            rows={2}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
          />
        </div>

        {/* Özet kartı */}
        <div className="bg-gray-50 rounded-xl border border-gray-200 divide-y divide-gray-200">
          <div className="flex justify-between px-4 py-3">
            <span className="text-sm text-gray-500">Tip</span>
            <span className="text-sm font-medium text-gray-900">Özel Hedef Kitle (Custom Audience)</span>
          </div>
          {source && (
            <div className="flex justify-between px-4 py-3">
              <span className="text-sm text-gray-500">Kaynak</span>
              <span className="text-sm font-medium text-gray-900">{SOURCE_LABELS[source].tr}</span>
            </div>
          )}
          <div className="flex justify-between px-4 py-3">
            <span className="text-sm text-gray-500">Geri Bakış Süresi</span>
            <span className="text-sm font-medium text-gray-900">{state.rule.retention} gün</span>
          </div>
          {state.rule.ruleType && (
            <div className="flex justify-between px-4 py-3">
              <span className="text-sm text-gray-500">Kural Tipi</span>
              <span className="text-sm font-medium text-gray-900">{state.rule.ruleType}</span>
            </div>
          )}
          {state.rule.igEngagementType && (
            <div className="flex justify-between px-4 py-3">
              <span className="text-sm text-gray-500">IG Etkileşim</span>
              <span className="text-sm font-medium text-gray-900">{state.rule.igEngagementType}</span>
            </div>
          )}
          {state.excludeRules.length > 0 && (
            <div className="flex justify-between px-4 py-3">
              <span className="text-sm text-gray-500">Hariç Tutma</span>
              <span className="text-sm font-medium text-gray-900">{state.excludeRules.length} kural</span>
            </div>
          )}
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-sm text-blue-800">
            Kaydedildiğinde DRAFT olarak oluşturulacak. Meta&apos;ya gönderim Faz 2&apos;de aktif edilecek.
          </p>
        </div>
      </div>
    </div>
  )
}
