'use client'

import type { LookalikeState } from '../types'

interface StepSummaryProps {
  state: LookalikeState
  onChange: (updates: Partial<LookalikeState>) => void
}

export default function StepSummary({ state, onChange }: StepSummaryProps) {
  return (
    <div>
      <h3 className="text-section-title text-gray-900 mb-1">Özet</h3>
      <p className="text-sm text-gray-500 mb-6">Lookalike kitle bilgilerini gözden geçirin ve adlandırın.</p>

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
            placeholder="Ör: TR %1 Lookalike - Site Ziyaretçileri"
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
            <span className="text-sm font-medium text-gray-900">Benzer Hedef Kitle (Lookalike)</span>
          </div>
          <div className="flex justify-between px-4 py-3">
            <span className="text-sm text-gray-500">Tohum Kitle</span>
            <span className="text-sm font-medium text-gray-900">{state.seedName || '—'}</span>
          </div>
          <div className="flex justify-between px-4 py-3">
            <span className="text-sm text-gray-500">Ülkeler</span>
            <span className="text-sm font-medium text-gray-900">
              {state.countries.length > 0 ? state.countries.join(', ') : '—'}
            </span>
          </div>
          <div className="flex justify-between px-4 py-3">
            <span className="text-sm text-gray-500">Boyut</span>
            <span className="text-sm font-medium text-primary">%{state.sizePercent}</span>
          </div>
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
