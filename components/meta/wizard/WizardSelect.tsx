'use client'

import * as React from 'react'
import { ChevronDown, Check } from 'lucide-react'

export interface WizardSelectOption {
  value: string
  label: string
  disabled?: boolean
}

interface WizardSelectProps {
  value: string
  onChange: (v: string) => void
  options: WizardSelectOption[]
  disabled?: boolean
  error?: boolean
  className?: string
  placeholder?: string
}

/** Kampanya Hedefi referanslı custom dropdown — tüm wizard select'leri için standart */
export default function WizardSelect({
  value,
  onChange,
  options,
  disabled = false,
  error = false,
  className = '',
  placeholder,
}: WizardSelectProps) {
  const [open, setOpen] = React.useState(false)
  const ref = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const selected = options.find((o) => o.value === value)

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        className={`
          w-full flex items-center justify-between px-3.5 py-2.5 border rounded-xl text-sm text-left transition-all
          shadow-[0_1px_3px_rgba(0,0,0,0.06),inset_0_1px_2px_rgba(0,0,0,0.04)]
          ${open ? 'border-primary ring-2 ring-primary/20' : error ? 'border-red-400 ring-1 ring-red-300' : 'border-gray-200 hover:border-gray-300'}
          ${disabled ? 'bg-gray-50 opacity-60 cursor-not-allowed' : 'bg-white cursor-pointer'}
        `}
      >
        <span className={selected && !placeholder ? 'text-gray-800 font-medium' : 'text-gray-400'}>
          {selected?.label ?? placeholder ?? ''}
        </span>
        <ChevronDown
          className={`w-4 h-4 flex-shrink-0 transition-transform duration-200 mr-0.5 ${open ? 'rotate-180 text-primary' : 'text-gray-400'}`}
        />
      </button>

      {open && (
        <div className="absolute z-50 w-full mt-1.5 bg-white border border-gray-200 rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.08)] overflow-hidden">
          {options.map((o) => {
            const isSel = o.value === value
            return (
              <button
                key={o.value}
                type="button"
                disabled={o.disabled}
                onClick={() => {
                  if (o.disabled) return
                  onChange(o.value)
                  setOpen(false)
                }}
                className={`
                  w-full flex items-center justify-between px-4 py-2.5 text-sm text-left transition-colors
                  ${o.disabled ? 'opacity-40 cursor-not-allowed' : ''}
                  ${isSel ? 'bg-primary/8 text-primary font-semibold' : 'text-gray-700 hover:bg-gray-50'}
                `}
              >
                <span>{o.label}</span>
                {isSel && <Check className="w-4 h-4 text-primary flex-shrink-0" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
