'use client'

/* Meta Ads tarzı tek-seçimli dropdown — native <select> yerine tutarlı görünüm.
   - Temiz beyaz, ince border, hafif gölge; tutarlı tipografi (text-sm)
   - Chevron rotasyonu + açılışta fade + scale animasyonu (origin-top)
   - Dış tıklama kapatır; klavye: Esc kapatır
   - Renk: yalnız primary/emerald/gray (amber YASAK) */

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check } from 'lucide-react'

export interface SelectOption {
  value: string | number
  label: string
}

interface CustomSelectProps {
  value: string | number
  options: SelectOption[]
  onChange: (value: string | number) => void
  className?: string
  ariaLabel?: string
  placeholder?: string
}

export default function CustomSelect({
  value,
  options,
  onChange,
  className = '',
  ariaLabel,
  placeholder = 'Seçin',
}: CustomSelectProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const selected = options.find((o) => o.value === value)

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`w-full px-3 py-2.5 bg-white border rounded-lg text-sm text-gray-800 flex items-center justify-between gap-2 transition-colors ${
          open ? 'border-primary ring-2 ring-primary/15' : 'border-gray-300 hover:border-gray-400'
        }`}
      >
        <span className="truncate">{selected?.label ?? placeholder}</span>
        <ChevronDown className={`w-4 h-4 text-gray-400 shrink-0 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
      </button>

      <div
        role="listbox"
        className={`absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto py-1 origin-top transition-all duration-150 ${
          open
            ? 'opacity-100 visible scale-100 translate-y-0'
            : 'opacity-0 invisible scale-95 -translate-y-1 pointer-events-none'
        }`}
      >
        {options.map((o) => {
          const isSel = o.value === value
          return (
            <button
              key={String(o.value)}
              type="button"
              role="option"
              aria-selected={isSel}
              onClick={() => { onChange(o.value); setOpen(false) }}
              className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-left transition-colors ${
                isSel ? 'bg-emerald-50 text-primary font-medium' : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span className="truncate">{o.label}</span>
              {isSel && <Check className="w-4 h-4 text-primary shrink-0" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}
