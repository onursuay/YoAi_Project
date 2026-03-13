'use client'

import type { SavedAudienceState } from '../types'

interface StepSummaryProps {
  state: SavedAudienceState
  onChange: (updates: Partial<SavedAudienceState>) => void
}

export default function StepSummary({ state, onChange }: StepSummaryProps) {
  const genderLabel =
    state.genders.length === 0
      ? 'Tümü'
      : state.genders.includes(1) && !state.genders.includes(2)
      ? 'Erkek'
      : state.genders.includes(2) && !state.genders.includes(1)
      ? 'Kadın'
      : 'Tümü'

  return (
    <div>
      <h3 className="text-section-title text-gray-900 mb-1">Özet</h3>
      <p className="text-sm text-gray-500 mb-6">Kayıtlı kitle bilgilerini gözden geçirin ve adlandırın.</p>

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
            placeholder="Ör: TR 25-45 Erkek Teknoloji İlgili"
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
            <span className="text-sm font-medium text-gray-900">Kayıtlı Hedef Kitle (Saved Audience)</span>
          </div>
          <div className="flex justify-between px-4 py-3">
            <span className="text-sm text-gray-500">Konum</span>
            <span className="text-sm font-medium text-gray-900">
              {state.locations.length > 0
                ? state.locations.map((l) => l.name).join(', ')
                : 'Türkiye (varsayılan)'}
            </span>
          </div>
          <div className="flex justify-between px-4 py-3">
            <span className="text-sm text-gray-500">Yaş Aralığı</span>
            <span className="text-sm font-medium text-gray-900">
              {state.ageMin} – {state.ageMax === 65 ? '65+' : state.ageMax}
            </span>
          </div>
          <div className="flex justify-between px-4 py-3">
            <span className="text-sm text-gray-500">Cinsiyet</span>
            <span className="text-sm font-medium text-gray-900">{genderLabel}</span>
          </div>
          {state.locales.length > 0 && (
            <div className="flex justify-between px-4 py-3">
              <span className="text-sm text-gray-500">Diller</span>
              <span className="text-sm font-medium text-gray-900">{state.locales.length} dil</span>
            </div>
          )}
          {state.interests.length > 0 && (
            <div className="flex justify-between px-4 py-3">
              <span className="text-sm text-gray-500">İlgi Alanları</span>
              <span className="text-sm font-medium text-gray-900">{state.interests.length} ilgi</span>
            </div>
          )}
          {state.excludeInterests.length > 0 && (
            <div className="flex justify-between px-4 py-3">
              <span className="text-sm text-gray-500">Hariç Tutulan</span>
              <span className="text-sm font-medium text-red-600">{state.excludeInterests.length} ilgi</span>
            </div>
          )}
          <div className="flex justify-between px-4 py-3">
            <span className="text-sm text-gray-500">Advantage+</span>
            <span className={`text-sm font-medium ${state.advantageAudience ? 'text-green-600' : 'text-gray-500'}`}>
              {state.advantageAudience ? 'Açık' : 'Kapalı'}
            </span>
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
