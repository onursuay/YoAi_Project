'use client'

import { useEffect } from 'react'
import type { AdScheduleEntry } from '@/lib/google-ads/adschedule'

const dayLabels: Record<string, string> = {
  MONDAY: 'Pazartesi',
  TUESDAY: 'Salı',
  WEDNESDAY: 'Çarşamba',
  THURSDAY: 'Perşembe',
  FRIDAY: 'Cuma',
  SATURDAY: 'Cumartesi',
  SUNDAY: 'Pazar',
}

const dayOrder = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']

const minuteLabels: Record<string, string> = {
  ZERO: '00',
  FIFTEEN: '15',
  THIRTY: '30',
  FORTY_FIVE: '45',
}

function formatTime(hour: number, minute: string): string {
  return `${String(hour).padStart(2, '0')}:${minuteLabels[minute] || '00'}`
}

interface Props {
  schedule: AdScheduleEntry[]
  isLoading: boolean
  error: string | null
  onFetch: () => void
}

export default function CampaignAdScheduleTab({ schedule, isLoading, error, onFetch }: Props) {
  useEffect(() => { onFetch() }, [onFetch])

  if (isLoading) {
    return <div className="p-6 text-center text-gray-500">Reklam zamanlaması yükleniyor...</div>
  }

  if (error) {
    return <div className="p-6 text-center text-red-500">{error}</div>
  }

  if (schedule.length === 0) {
    return (
      <div className="p-6 text-center text-gray-400">
        Özel reklam zamanlaması ayarlanmamış — reklamlar 7/24 yayında.
      </div>
    )
  }

  // Group by day
  const byDay = new Map<string, AdScheduleEntry[]>()
  for (const entry of schedule) {
    const arr = byDay.get(entry.dayOfWeek) || []
    arr.push(entry)
    byDay.set(entry.dayOfWeek, arr)
  }

  return (
    <div className="p-6">
      <div className="space-y-3">
        {dayOrder.map((day) => {
          const entries = byDay.get(day)
          if (!entries || entries.length === 0) return null
          return (
            <div key={day} className="flex items-start gap-4">
              <span className="w-24 shrink-0 text-sm font-medium text-gray-700 pt-1">
                {dayLabels[day]}
              </span>
              <div className="flex flex-wrap gap-2">
                {entries.map((e, i) => (
                  <span
                    key={`${day}-${i}`}
                    className="inline-flex items-center px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-sm border border-blue-200"
                  >
                    {formatTime(e.startHour, e.startMinute)} — {formatTime(e.endHour, e.endMinute)}
                    {e.bidModifier != null && e.bidModifier !== 1 && (
                      <span className="ml-1.5 text-xs opacity-70">
                        ({e.bidModifier > 1 ? '+' : ''}{((e.bidModifier - 1) * 100).toFixed(0)}%)
                      </span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
