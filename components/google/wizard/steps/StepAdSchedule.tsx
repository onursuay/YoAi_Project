'use client'

import { useState } from 'react'
import { Plus, X, Clock } from 'lucide-react'
import type { StepProps, ScheduleEntry, DayOfWeek, Minute } from '../shared/WizardTypes'
import { DAYS_OF_WEEK, inputCls } from '../shared/WizardTypes'

const HOURS = Array.from({ length: 24 }, (_, i) => i)
const END_HOURS = Array.from({ length: 25 }, (_, i) => i) // 0-24
const MINUTES: Minute[] = ['ZERO', 'FIFTEEN', 'THIRTY', 'FORTY_FIVE']
const MINUTE_LABELS: Record<Minute, string> = { ZERO: '00', FIFTEEN: '15', THIRTY: '30', FORTY_FIVE: '45' }

export default function StepAdSchedule({ state, update, t }: StepProps) {
  const [addingDay, setAddingDay] = useState<DayOfWeek | null>(null)
  const [newStart, setNewStart] = useState(9)
  const [newStartMin, setNewStartMin] = useState<Minute>('ZERO')
  const [newEnd, setNewEnd] = useState(18)
  const [newEndMin, setNewEndMin] = useState<Minute>('ZERO')

  const addEntry = () => {
    if (!addingDay) return
    const entry: ScheduleEntry = {
      dayOfWeek: addingDay,
      startHour: newStart,
      startMinute: newStartMin,
      endHour: newEnd,
      endMinute: newEndMin,
    }
    update({ adSchedule: [...state.adSchedule, entry] })
    setAddingDay(null)
  }

  const removeEntry = (idx: number) => {
    update({ adSchedule: state.adSchedule.filter((_, i) => i !== idx) })
  }

  const applyBusinessHours = () => {
    const entries: ScheduleEntry[] = (['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'] as DayOfWeek[]).map(day => ({
      dayOfWeek: day,
      startHour: 9,
      startMinute: 'ZERO' as Minute,
      endHour: 18,
      endMinute: 'ZERO' as Minute,
    }))
    update({ adSchedule: entries })
  }

  const clearAll = () => {
    update({ adSchedule: [] })
  }

  const entriesForDay = (day: DayOfWeek) => state.adSchedule.filter(e => e.dayOfWeek === day)

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-1">{t('schedule.title')}</h3>
        <p className="text-xs text-gray-500">{t('schedule.description')}</p>
      </div>

      {/* Presets */}
      <div className="flex gap-2">
        <button type="button" onClick={applyBusinessHours} className="px-3 py-1.5 text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100">
          <Clock className="w-3 h-3 inline mr-1" />{t('schedule.businessHours')}
        </button>
        <button type="button" onClick={clearAll} className="px-3 py-1.5 text-xs font-medium bg-gray-50 text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-100">
          {t('schedule.clearAll')}
        </button>
      </div>

      {/* Day rows */}
      <div className="border border-gray-200 rounded-lg divide-y divide-gray-100">
        {DAYS_OF_WEEK.map(day => {
          const dayEntries = entriesForDay(day)
          return (
            <div key={day} className="px-4 py-2.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700 w-24">{t(`schedule.dayLabels.${day}`)}</span>
                <div className="flex items-center gap-2 flex-1">
                  {dayEntries.length === 0 && <span className="text-xs text-gray-400">{t('schedule.allDay')}</span>}
                  {dayEntries.map((entry, idx) => {
                    const globalIdx = state.adSchedule.indexOf(entry)
                    return (
                      <span key={idx} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-xs font-medium">
                        {String(entry.startHour).padStart(2, '0')}:{MINUTE_LABELS[entry.startMinute]}
                        –
                        {String(entry.endHour).padStart(2, '0')}:{MINUTE_LABELS[entry.endMinute]}
                        <button type="button" onClick={() => removeEntry(globalIdx)} className="hover:text-red-500">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    )
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => { setAddingDay(addingDay === day ? null : day); setNewStart(9); setNewEnd(18); setNewStartMin('ZERO'); setNewEndMin('ZERO') }}
                  className="text-blue-600 hover:text-blue-800"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {addingDay === day && (
                <div className="flex items-center gap-2 mt-2 pl-24">
                  <select className={`${inputCls} w-16 py-1 text-xs`} value={newStart} onChange={e => setNewStart(Number(e.target.value))}>
                    {HOURS.map(h => <option key={h} value={h}>{String(h).padStart(2, '0')}</option>)}
                  </select>
                  <span className="text-gray-400">:</span>
                  <select className={`${inputCls} w-14 py-1 text-xs`} value={newStartMin} onChange={e => setNewStartMin(e.target.value as Minute)}>
                    {MINUTES.map(m => <option key={m} value={m}>{MINUTE_LABELS[m]}</option>)}
                  </select>
                  <span className="text-gray-400 text-xs">–</span>
                  <select className={`${inputCls} w-16 py-1 text-xs`} value={newEnd} onChange={e => setNewEnd(Number(e.target.value))}>
                    {END_HOURS.map(h => <option key={h} value={h}>{String(h).padStart(2, '0')}</option>)}
                  </select>
                  <span className="text-gray-400">:</span>
                  <select className={`${inputCls} w-14 py-1 text-xs`} value={newEndMin} onChange={e => setNewEndMin(e.target.value as Minute)}>
                    {MINUTES.map(m => <option key={m} value={m}>{MINUTE_LABELS[m]}</option>)}
                  </select>
                  <button type="button" onClick={addEntry} className="px-3 py-1 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700">
                    {t('schedule.add')}
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 text-xs text-gray-500">
        {t('schedule.optionalNote')}
      </div>
    </div>
  )
}
