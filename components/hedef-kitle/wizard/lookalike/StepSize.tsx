'use client'

import type { LookalikeState } from '../types'

interface StepSizeProps {
  state: LookalikeState
  onChange: (updates: Partial<LookalikeState>) => void
}

const SIZE_DESCRIPTIONS: Record<number, string> = {
  1: 'En benzer %1 — Yüksek kalite, küçük kitle',
  2: 'En benzer %2 — İyi kalite, küçük-orta kitle',
  3: 'En benzer %3 — Kaliteli, orta kitle',
  4: '%4 — Kalite ve ölçek dengesi',
  5: '%5 — Dengeli ölçek',
  6: '%6 — Geniş ölçek, orta benzerlik',
  7: '%7 — Geniş kitle',
  8: '%8 — Çok geniş kitle, düşük benzerlik',
  9: '%9 — Çok geniş kitle',
  10: '%10 — Maksimum erişim, en düşük benzerlik',
}

export default function StepSize({ state, onChange }: StepSizeProps) {
  return (
    <div>
      <h3 className="text-section-title text-gray-900 mb-1">Kitle Boyutu</h3>
      <p className="text-sm text-gray-500 mb-6">
        Seçtiğiniz ülkelerdeki toplam nüfusun yüzde kaçının hedefleneceğini belirleyin.
        Düşük yüzde = daha benzer, yüksek yüzde = daha geniş kitle.
      </p>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        {/* Büyük yüzde gösterimi */}
        <div className="text-center mb-6">
          <span className="text-5xl font-bold text-primary">%{state.sizePercent}</span>
          <p className="text-sm text-gray-500 mt-2">
            {SIZE_DESCRIPTIONS[state.sizePercent] ?? `%${state.sizePercent} benzerlik oranı`}
          </p>
        </div>

        {/* Slider */}
        <div className="px-2">
          <input
            type="range"
            min={1}
            max={10}
            step={1}
            value={state.sizePercent}
            onChange={(e) => onChange({ sizePercent: Number(e.target.value) })}
            className="w-full accent-primary h-2"
          />
          <div className="flex justify-between mt-2">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => onChange({ sizePercent: v })}
                className={`w-8 h-8 rounded-full text-caption font-medium transition-all ${
                  v === state.sizePercent
                    ? 'bg-primary text-white'
                    : v <= state.sizePercent
                    ? 'bg-primary/20 text-primary'
                    : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
          <div className="flex justify-between text-caption text-gray-400 mt-3">
            <span>Daha Benzer</span>
            <span>Daha Geniş</span>
          </div>
        </div>

        {/* Öneri kartları */}
        <div className="grid grid-cols-3 gap-3 mt-6">
          <button
            type="button"
            onClick={() => onChange({ sizePercent: 1 })}
            className={`p-3 rounded-lg border text-center transition-all ${
              state.sizePercent === 1 ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <p className="text-sm font-medium text-gray-900">%1</p>
            <p className="text-caption text-gray-500">Yüksek Kalite</p>
          </button>
          <button
            type="button"
            onClick={() => onChange({ sizePercent: 3 })}
            className={`p-3 rounded-lg border text-center transition-all ${
              state.sizePercent === 3 ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <p className="text-sm font-medium text-gray-900">%3</p>
            <p className="text-caption text-gray-500">Dengeli</p>
          </button>
          <button
            type="button"
            onClick={() => onChange({ sizePercent: 5 })}
            className={`p-3 rounded-lg border text-center transition-all ${
              state.sizePercent === 5 ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <p className="text-sm font-medium text-gray-900">%5</p>
            <p className="text-caption text-gray-500">Geniş Erişim</p>
          </button>
        </div>
      </div>
    </div>
  )
}
