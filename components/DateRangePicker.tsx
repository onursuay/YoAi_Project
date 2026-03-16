'use client'

import { useState, useRef, useEffect } from 'react'
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react'

interface DateRangePickerProps {
  onDateChange: (startDate: string, endDate: string, preset?: string) => void
  locale?: string
}

const PRESETS_TR = [
  { key: 'all_time', label: 'Tüm Zamanlar' },
  { key: 'last_7d', label: 'Son 7 Gün' },
  { key: 'last_30d', label: 'Son 30 Gün' },
  { key: 'this_month', label: 'Bu Ay' },
  { key: 'last_month', label: 'Geçen Ay' },
]

const PRESETS_EN = [
  { key: 'all_time', label: 'All Time' },
  { key: 'last_7d', label: 'Last 7 Days' },
  { key: 'last_30d', label: 'Last 30 Days' },
  { key: 'this_month', label: 'This Month' },
  { key: 'last_month', label: 'Last Month' },
]

function formatISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getPresetRange(key: string): { start: Date; end: Date } {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  switch (key) {
    case 'all_time': {
      return { start: new Date(2020, 0, 1), end: today }
    }
    case 'last_7d': {
      const s = new Date(today)
      s.setDate(s.getDate() - 7)
      return { start: s, end: today }
    }
    case 'last_30d': {
      const s = new Date(today)
      s.setDate(s.getDate() - 30)
      return { start: s, end: today }
    }
    case 'this_month':
      return { start: new Date(today.getFullYear(), today.getMonth(), 1), end: today }
    case 'last_month': {
      const s = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      const e = new Date(today.getFullYear(), today.getMonth(), 0)
      return { start: s, end: e }
    }
    default: {
      return { start: new Date(2020, 0, 1), end: today }
    }
  }
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function isBetween(d: Date, start: Date, end: Date) {
  return d >= start && d <= end
}

const DAY_NAMES_TR = ['Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct', 'Pz']
const DAY_NAMES_EN = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
const MONTH_NAMES_TR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']
const MONTH_NAMES_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

function MonthGrid({ year, month, rangeStart, rangeEnd, onDayClick, isEn }: {
  year: number
  month: number
  rangeStart: Date | null
  rangeEnd: Date | null
  onDayClick: (d: Date) => void
  isEn?: boolean
}) {
  const DAY_NAMES = isEn ? DAY_NAMES_EN : DAY_NAMES_TR
  const MONTH_NAMES = isEn ? MONTH_NAMES_EN : MONTH_NAMES_TR
  const firstDay = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  // Monday = 0
  let startDow = firstDay.getDay() - 1
  if (startDow < 0) startDow = 6

  const cells: (Date | null)[] = []
  for (let i = 0; i < startDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d))

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return (
    <div className="w-[220px]">
      <div className="text-center text-sm font-semibold text-gray-700 mb-2">
        {MONTH_NAMES[month]} {year}
      </div>
      <div className="grid grid-cols-7 gap-0">
        {DAY_NAMES.map(d => (
          <div key={d} className="text-[10px] text-gray-400 text-center py-1 font-medium">{d}</div>
        ))}
        {cells.map((date, i) => {
          if (!date) return <div key={`e-${i}`} className="h-7" />
          const isToday = isSameDay(date, today)
          const isStart = rangeStart && isSameDay(date, rangeStart)
          const isEnd = rangeEnd && isSameDay(date, rangeEnd)
          const inRange = rangeStart && rangeEnd && isBetween(date, rangeStart, rangeEnd)
          const isFuture = date > today

          return (
            <button
              key={date.getDate()}
              disabled={isFuture}
              onClick={() => onDayClick(date)}
              className={`h-7 text-xs rounded transition-colors ${
                isFuture ? 'text-gray-300 cursor-not-allowed' :
                isStart || isEnd ? 'bg-green-500 text-white font-semibold' :
                inRange ? 'bg-green-100 text-green-800' :
                isToday ? 'ring-1 ring-green-400 text-green-600 font-semibold' :
                'text-gray-700 hover:bg-gray-100'
              }`}
            >
              {date.getDate()}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function DateRangePicker({ onDateChange, locale }: DateRangePickerProps) {
  const isEn = locale === 'en'
  const PRESETS = isEn ? PRESETS_EN : PRESETS_TR
  const [open, setOpen] = useState(false)
  const [preset, setPreset] = useState('last_30d')
  const initialRange = getPresetRange('last_30d')
  const [rangeStart, setRangeStart] = useState<Date>(initialRange.start)
  const [rangeEnd, setRangeEnd] = useState<Date>(initialRange.end)
  const [picking, setPicking] = useState<'start' | 'end' | null>(null)
  const [tempStart, setTempStart] = useState<Date | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  // Current view months
  const today = new Date()
  const [viewMonth1, setViewMonth1] = useState(today.getMonth() === 0 ? 11 : today.getMonth() - 1)
  const [viewYear1, setViewYear1] = useState(today.getMonth() === 0 ? today.getFullYear() - 1 : today.getFullYear())

  const viewMonth2 = viewMonth1 === 11 ? 0 : viewMonth1 + 1
  const viewYear2 = viewMonth1 === 11 ? viewYear1 + 1 : viewYear1

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const goBack = () => {
    if (viewMonth1 === 0) { setViewMonth1(11); setViewYear1(viewYear1 - 1) }
    else setViewMonth1(viewMonth1 - 1)
  }
  const goForward = () => {
    if (viewMonth1 === 11) { setViewMonth1(0); setViewYear1(viewYear1 + 1) }
    else setViewMonth1(viewMonth1 + 1)
  }

  const handleDayClick = (d: Date) => {
    if (!picking || picking === 'start') {
      setTempStart(d)
      setPicking('end')
    } else {
      let start: Date, end: Date
      if (tempStart && d >= tempStart) {
        start = tempStart
        end = d
      } else if (tempStart) {
        start = d
        end = tempStart
      } else {
        return
      }
      setRangeStart(start)
      setRangeEnd(end)
      setPreset('custom')
      setTempStart(null)
      setPicking(null)
      // Auto-apply custom range immediately
      onDateChange(formatISO(start), formatISO(end), 'custom')
      setOpen(false)
    }
  }

  const handlePreset = (key: string) => {
    const r = getPresetRange(key)
    setRangeStart(r.start)
    setRangeEnd(r.end)
    setPreset(key)
    setTempStart(null)
    setPicking(null)
    // Auto-apply preset selection immediately
    onDateChange(formatISO(r.start), formatISO(r.end), key)
    setOpen(false)
  }

  const displayStart = picking === 'end' && tempStart ? tempStart : rangeStart
  const displayEnd = picking === 'end' ? null : rangeEnd

  const localeStr = isEn ? 'en-US' : 'tr-TR'
  const formatShort = (d: Date) => d.toLocaleDateString(localeStr, { day: '2-digit', month: 'short' })

  // Show preset label on button instead of date range for named presets
  const presetLabel = preset !== 'custom' ? PRESETS.find(p => p.key === preset)?.label : null

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => { setOpen(!open); setPicking('start'); setTempStart(null) }}
        className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
      >
        <Calendar className="w-4 h-4 text-gray-500" />
        <span className="text-gray-700">
          {presetLabel || `${formatShort(rangeStart)} - ${formatShort(rangeEnd)}`}
        </span>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 bg-white rounded-xl shadow-xl border border-gray-200 p-4">
          <div className="flex gap-4">
            {/* Presets */}
            <div className="flex flex-col gap-1 border-r border-gray-100 pr-4 min-w-[120px]">
              {PRESETS.map(p => (
                <button
                  key={p.key}
                  onClick={() => handlePreset(p.key)}
                  className={`text-left text-sm px-3 py-1.5 rounded transition-colors ${
                    preset === p.key ? 'bg-green-50 text-green-700 font-medium' : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {/* Calendars */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <button onClick={goBack} className="p-1 hover:bg-gray-100 rounded transition-colors">
                  <ChevronLeft className="w-4 h-4 text-gray-500" />
                </button>
                <button onClick={goForward} className="p-1 hover:bg-gray-100 rounded transition-colors">
                  <ChevronRight className="w-4 h-4 text-gray-500" />
                </button>
              </div>
              <div className="flex gap-6">
                <MonthGrid year={viewYear1} month={viewMonth1} rangeStart={displayStart} rangeEnd={displayEnd} onDayClick={handleDayClick} isEn={isEn} />
                <MonthGrid year={viewYear2} month={viewMonth2} rangeStart={displayStart} rangeEnd={displayEnd} onDayClick={handleDayClick} isEn={isEn} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
