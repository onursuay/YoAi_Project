'use client'

import { Plus, Trash2 } from 'lucide-react'
import type { CustomAudienceState, ExcludeRule, AudienceSource } from '../types'
import { SOURCE_LABELS } from '../types'

interface StepExcludeProps {
  state: CustomAudienceState
  onChange: (updates: Partial<CustomAudienceState>) => void
}

const EXCLUDE_SOURCES: AudienceSource[] = ['PIXEL', 'IG', 'PAGE', 'VIDEO', 'LEADFORM']

export default function StepExclude({ state, onChange }: StepExcludeProps) {
  const addExclude = () => {
    const newRule: ExcludeRule = {
      source: 'PIXEL',
      rule: { retention: 30 },
    }
    onChange({ excludeRules: [...state.excludeRules, newRule] })
  }

  const removeExclude = (index: number) => {
    onChange({ excludeRules: state.excludeRules.filter((_, i) => i !== index) })
  }

  const updateExclude = (index: number, patch: Partial<ExcludeRule>) => {
    const updated = state.excludeRules.map((rule, i) =>
      i === index ? { ...rule, ...patch } : rule
    )
    onChange({ excludeRules: updated })
  }

  // Çakışma kontrolü: include kaynağıyla aynı exclude kaynağı seçilmişse uyarı
  const hasConflict = state.excludeRules.some(
    (er) => er.source === state.source
  )

  return (
    <div>
      <h3 className="text-section-title text-gray-900 mb-1">Hariç Tut (Opsiyonel)</h3>
      <p className="text-sm text-gray-500 mb-6">
        Bu kitleden hariç tutmak istediğiniz kullanıcı gruplarını ekleyin.
      </p>

      {hasConflict && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg p-3">
          <p className="text-sm text-amber-800">
            Uyarı: Dahil etme kuralıyla aynı kaynaktan hariç tutma eklediniz. Bu, kitlenizi daraltabilir.
          </p>
        </div>
      )}

      {state.excludeRules.length === 0 ? (
        <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-xl">
          <p className="text-sm text-gray-400 mb-3">Henüz hariç tutma kuralı eklenmedi.</p>
          <button
            type="button"
            onClick={addExclude}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-lg text-sm font-medium hover:bg-primary/20 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Hariç Tut Ekle
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {state.excludeRules.map((rule, idx) => (
            <div key={idx} className="border border-gray-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-700">Hariç Tutma #{idx + 1}</span>
                <button
                  type="button"
                  onClick={() => removeExclude(idx)}
                  className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Kaynak</label>
                  <select
                    value={rule.source}
                    onChange={(e) => updateExclude(idx, { source: e.target.value as AudienceSource })}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    {EXCLUDE_SOURCES.map((s) => (
                      <option key={s} value={s}>{SOURCE_LABELS[s].tr}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Geri Bakış Süresi: <span className="text-primary font-semibold">{rule.rule.retention ?? 30} gün</span>
                  </label>
                  <input
                    type="range"
                    min={1}
                    max={180}
                    value={rule.rule.retention ?? 30}
                    onChange={(e) =>
                      updateExclude(idx, {
                        rule: { ...rule.rule, retention: Number(e.target.value) },
                      })
                    }
                    className="w-full accent-primary"
                  />
                </div>
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={addExclude}
            className="inline-flex items-center gap-2 px-4 py-2 text-primary text-sm font-medium hover:bg-primary/5 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Başka Hariç Tutma Ekle
          </button>
        </div>
      )}
    </div>
  )
}
