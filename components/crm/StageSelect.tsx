'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Check } from 'lucide-react'
import { STAGES, STAGE_STYLE, type Stage } from './stageMeta'

const MENU_W = 176

/**
 * Lead aşaması seçici — Meta tarzı dropdown (ham <select> YASAK). Menü, Kanban
 * sütununun `overflow` konteynerı tarafından KESİLMEMESİ için portal ile body'ye
 * `fixed` konumda render edilir. Dış tıklama + scroll kapatır.
 */
export default function StageSelect({
  value,
  onChange,
  labelFor,
}: {
  value: Stage
  onChange: (s: Stage) => void
  labelFor: (s: Stage) => string
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const place = useCallback(() => {
    const r = triggerRef.current?.getBoundingClientRect()
    if (!r) return
    // Sağa doğru aç: trigger'ın sol kenarına hizala; ekran sağına taşarsa içeri al.
    let left = r.left
    if (left + MENU_W > window.innerWidth - 8) left = window.innerWidth - MENU_W - 8
    if (left < 8) left = 8
    setPos({ top: r.bottom + 4, left })
  }, [])

  const toggle = () => {
    if (!open) place()
    setOpen((v) => !v)
  }

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (triggerRef.current?.contains(t) || menuRef.current?.contains(t)) return
      setOpen(false)
    }
    const close = () => setOpen(false)
    document.addEventListener('mousedown', onDown)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  const style = STAGE_STYLE[value]

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        className={`inline-flex items-center gap-1.5 pl-2 pr-1.5 py-1 rounded-full text-xs font-medium border ${style.chip} hover:brightness-95 transition`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
        {labelFor(value)}
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && pos && createPortal(
        <div
          ref={menuRef}
          style={{ position: 'fixed', top: pos.top, left: pos.left, width: MENU_W }}
          className="z-[60] bg-white rounded-xl border border-gray-200 shadow-xl py-1"
        >
          {STAGES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setOpen(false)
                if (s !== value) onChange(s)
              }}
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left hover:bg-gray-50 ${s === value ? 'text-primary font-medium' : 'text-gray-700'}`}
            >
              <span className={`w-2 h-2 rounded-full ${STAGE_STYLE[s].dot}`} />
              <span className="flex-1">{labelFor(s)}</span>
              {s === value && <Check className="w-3.5 h-3.5 text-primary" />}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </>
  )
}
