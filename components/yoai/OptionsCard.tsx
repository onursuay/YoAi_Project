'use client'

import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import type { CategoryConfig } from '@/lib/yoai/types'

interface OptionsCardProps {
  config: CategoryConfig
  onSubmit: (params: Record<string, string>) => void
  disabled?: boolean
}

export default function OptionsCard({ config, onSubmit, disabled }: OptionsCardProps) {
  // Initialize state with defaults
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {}
    for (const field of config.fields) {
      initial[field.id] = field.default || ''
    }
    return initial
  })

  const handleChange = (fieldId: string, value: string) => {
    setValues((prev) => ({ ...prev, [fieldId]: value }))
  }

  const handleSubmit = () => {
    // Check required fields
    const allRequiredFilled = config.fields
      .filter((f) => f.required)
      .every((f) => values[f.id]?.trim())
    if (!allRequiredFilled) return

    onSubmit(values)
  }

  const allRequiredFilled = config.fields
    .filter((f) => f.required)
    .every((f) => values[f.id]?.trim())

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 w-full max-w-lg">
      <h3 className="font-semibold text-gray-900 mb-4">{config.label}</h3>

      <div className="space-y-4">
        {config.fields.map((field) => (
          <div key={field.id}>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              {field.label}
              {field.required && <span className="text-red-500 ml-0.5">*</span>}
            </label>

            {field.type === 'text' ? (
              <input
                type="text"
                value={values[field.id] || ''}
                onChange={(e) => handleChange(field.id, e.target.value)}
                placeholder={field.placeholder}
                disabled={disabled}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50"
              />
            ) : (
              <div className="flex flex-wrap gap-2">
                {field.options?.map((option) => {
                  const isSelected = values[field.id] === option
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => handleChange(field.id, option)}
                      disabled={disabled}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                        isSelected
                          ? 'bg-primary text-white border-primary'
                          : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-primary/50 hover:bg-primary/5'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {option}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={handleSubmit}
        disabled={disabled || !allRequiredFilled}
        className="mt-5 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Sparkles className="w-4 h-4" />
        Oluştur
      </button>
    </div>
  )
}
