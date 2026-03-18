'use client'

import { useState } from 'react'
import { Globe, Shield, Calendar, Link2, Plus, X, Clock } from 'lucide-react'
import type { PMaxStepProps, PMaxScheduleEntry, PMaxDayOfWeek, PMaxMinute } from '../shared/PMaxWizardTypes'
import { inputCls, PMaxLanguageOptions, PMaxCountryOptions, PMaxDaysOfWeek } from '../shared/PMaxWizardTypes'

const EU_POLICY_URL = 'https://support.google.com/adspolicy/answer/6014595'
const HOURS = Array.from({ length: 24 }, (_, i) => i)
const END_HOURS = Array.from({ length: 25 }, (_, i) => i)
const MINUTES: PMaxMinute[] = ['ZERO', 'FIFTEEN', 'THIRTY', 'FORTY_FIVE']
const MINUTE_LABELS: Record<PMaxMinute, string> = { ZERO: '00', FIFTEEN: '15', THIRTY: '30', FORTY_FIVE: '45' }

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  )
}

export default function PMaxStepCampaignSettings({ state, update, t }: PMaxStepProps) {
  const [geoQuery, setGeoQuery] = useState('')
  const [geoLoading, setGeoLoading] = useState(false)
  const [addingDay, setAddingDay] = useState<PMaxDayOfWeek | null>(null)
  const [newStart, setNewStart] = useState(9)
  const [newStartMin, setNewStartMin] = useState<PMaxMinute>('ZERO')
  const [newEnd, setNewEnd] = useState(18)
  const [newEndMin, setNewEndMin] = useState<PMaxMinute>('ZERO')

  const searchGeo = async () => {
    if (geoQuery.trim().length < 2) return
    setGeoLoading(true)
    try {
      const params = new URLSearchParams({ q: geoQuery })
      if (state.geoSearchCountry) params.set('country', state.geoSearchCountry)
      const res = await fetch(`/api/integrations/google-ads/geo-targets?${params}`)
      const data = await res.json()
      const results = data.results ?? []
      results.slice(0, 5).forEach((r: { id: string; name: string; countryCode: string; targetType: string }) => {
        if (!state.locations.some(l => l.id === r.id)) {
          update({ locations: [...state.locations, { ...r, isNegative: false }] })
        }
      })
    } catch {
      // ignore
    } finally {
      setGeoLoading(false)
    }
  }

  const removeLocation = (id: string) => {
    update({ locations: state.locations.filter(l => l.id !== id) })
  }

  const toggleLanguage = (langId: string) => {
    const has = state.languageIds.includes(langId)
    update({ languageIds: has ? state.languageIds.filter(id => id !== langId) : [...state.languageIds, langId] })
  }

  const addScheduleEntry = () => {
    if (!addingDay) return
    const entry: PMaxScheduleEntry = {
      dayOfWeek: addingDay,
      startHour: newStart,
      startMinute: newStartMin,
      endHour: newEnd,
      endMinute: newEndMin,
    }
    update({ adSchedule: [...state.adSchedule, entry] })
    setAddingDay(null)
  }

  const removeScheduleEntry = (idx: number) => {
    update({ adSchedule: state.adSchedule.filter((_, i) => i !== idx) })
  }

  const applyBusinessHours = () => {
    const entries: PMaxScheduleEntry[] = (['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'] as PMaxDayOfWeek[]).map(day => ({
      dayOfWeek: day,
      startHour: 9,
      startMinute: 'ZERO' as PMaxMinute,
      endHour: 18,
      endMinute: 'ZERO' as PMaxMinute,
    }))
    update({ adSchedule: entries })
  }

  const clearSchedule = () => {
    update({ adSchedule: [] })
  }

  const entriesForDay = (day: PMaxDayOfWeek) => state.adSchedule.filter(e => e.dayOfWeek === day)

  return (
    <div className="space-y-6">
      <section>
        <div className="flex items-center gap-2 mb-2">
          <Calendar className="w-4 h-4 text-blue-600" />
          <h4 className="text-sm font-semibold text-gray-900">{t('settings.datesTitle')}</h4>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label={t('settings.startDate')}>
            <input
              type="date"
              className={inputCls}
              value={state.startDate}
              onChange={e => update({ startDate: e.target.value })}
            />
          </Field>
          <Field label={t('settings.endDate')}>
            <input
              type="date"
              className={inputCls}
              value={state.endDate}
              onChange={e => update({ endDate: e.target.value })}
              min={state.startDate || undefined}
            />
          </Field>
        </div>
      </section>

      <section>
        <div className="flex items-center gap-2 mb-2">
          <Link2 className="w-4 h-4 text-blue-600" />
          <h4 className="text-sm font-semibold text-gray-900">{t('settings.finalUrlExpansionTitle')}</h4>
        </div>
        <label className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50">
          <input
            type="checkbox"
            checked={state.finalUrlExpansionEnabled}
            onChange={e => update({ finalUrlExpansionEnabled: e.target.checked })}
            className="rounded border-gray-300 text-blue-600"
          />
          <span className="text-sm text-gray-700">{t('settings.finalUrlExpansionLabel')}</span>
        </label>
        <p className="text-xs text-gray-500 mt-2">{t('settings.finalUrlExpansionNote')}</p>
      </section>

      <section>
        <div className="flex items-center gap-2 mb-2">
          <Globe className="w-4 h-4 text-blue-600" />
          <h4 className="text-sm font-semibold text-gray-900">{t('settings.locationModeTitle')}</h4>
        </div>
        <div className="space-y-2">
          <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${state.locationTargetingMode === 'PRESENCE_OR_INTEREST' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300 bg-white'}`}>
            <input type="radio" name="pmaxLocationMode" checked={state.locationTargetingMode === 'PRESENCE_OR_INTEREST'} onChange={() => update({ locationTargetingMode: 'PRESENCE_OR_INTEREST' })} className="mt-1 text-blue-600" />
            <span className="text-sm text-gray-900">{t('settings.locationModePresenceInterest')}</span>
          </label>
          <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${state.locationTargetingMode === 'PRESENCE_ONLY' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300 bg-white'}`}>
            <input type="radio" name="pmaxLocationMode" checked={state.locationTargetingMode === 'PRESENCE_ONLY'} onChange={() => update({ locationTargetingMode: 'PRESENCE_ONLY' })} className="mt-1 text-blue-600" />
            <span className="text-sm text-gray-900">{t('settings.locationModePresenceOnly')}</span>
          </label>
        </div>
      </section>

      <section>
        <h4 className="text-sm font-semibold text-gray-900 mb-2">{t('settings.locationsTitle')}</h4>
        <div className="flex gap-2 mb-2">
          <select className={`${inputCls} w-32`} value={state.geoSearchCountry} onChange={e => update({ geoSearchCountry: e.target.value })}>
            {PMaxCountryOptions.map(c => (
              <option key={c.code} value={c.code}>{t(c.labelKey)}</option>
            ))}
          </select>
          <input className={`${inputCls} flex-1`} value={geoQuery} onChange={e => setGeoQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && searchGeo()} placeholder={t('settings.locationSearchPlaceholder')} />
          <button type="button" onClick={searchGeo} disabled={geoLoading || geoQuery.trim().length < 2} className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {geoLoading ? '...' : t('settings.locationSearch')}
          </button>
        </div>
        {state.locations.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {state.locations.map(l => (
              <span key={l.id} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-gray-100 text-sm">
                {l.name}
                <button type="button" onClick={() => removeLocation(l.id)} className="text-gray-500 hover:text-red-600">×</button>
              </span>
            ))}
          </div>
        )}
        <p className="text-xs text-gray-500 mt-1">{t('settings.locationsHint')}</p>
      </section>

      <section>
        <h4 className="text-sm font-semibold text-gray-900 mb-2">{t('settings.languagesTitle')}</h4>
        <div className="flex flex-wrap gap-2">
          {PMaxLanguageOptions.map(lang => {
            const selected = state.languageIds.includes(lang.id)
            return (
              <button key={lang.id} type="button" onClick={() => toggleLanguage(lang.id)} className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${selected ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 hover:border-gray-300'}`}>
                {lang.name}
              </button>
            )
          })}
        </div>
      </section>

      <section>
        <h4 className="text-sm font-semibold text-gray-900 mb-1">{t('settings.scheduleTitle')}</h4>
        <p className="text-xs text-gray-500 mb-2">{t('settings.scheduleDescription')}</p>
        <div className="flex gap-2 mb-2">
          <button type="button" onClick={applyBusinessHours} className="px-3 py-1.5 text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100">
            <Clock className="w-3 h-3 inline mr-1" />{t('settings.scheduleBusinessHours')}
          </button>
          <button type="button" onClick={clearSchedule} className="px-3 py-1.5 text-xs font-medium bg-gray-50 text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-100">
            {t('settings.scheduleClearAll')}
          </button>
        </div>
        <div className="border border-gray-200 rounded-lg divide-y divide-gray-100">
          {PMaxDaysOfWeek.map(day => {
            const dayEntries = entriesForDay(day)
            return (
              <div key={day} className="px-4 py-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700 w-24">{t(`settings.scheduleDayLabels.${day}`)}</span>
                  <div className="flex items-center gap-2 flex-1 flex-wrap">
                    {dayEntries.length === 0 && <span className="text-xs text-gray-400">{t('settings.scheduleAllDay')}</span>}
                    {dayEntries.map((entry, idx) => {
                      const globalIdx = state.adSchedule.indexOf(entry)
                      return (
                        <span key={idx} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-xs font-medium">
                          {String(entry.startHour).padStart(2, '0')}:{MINUTE_LABELS[entry.startMinute]}–{String(entry.endHour).padStart(2, '0')}:{MINUTE_LABELS[entry.endMinute]}
                          <button type="button" onClick={() => removeScheduleEntry(globalIdx)} className="hover:text-red-500"><X className="w-3 h-3" /></button>
                        </span>
                      )
                    })}
                  </div>
                  <button type="button" onClick={() => { setAddingDay(addingDay === day ? null : day); setNewStart(9); setNewEnd(18); setNewStartMin('ZERO'); setNewEndMin('ZERO') }} className="text-blue-600 hover:text-blue-800">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                {addingDay === day && (
                  <div className="flex items-center gap-2 mt-2 pl-24 flex-wrap">
                    <select className={`${inputCls} w-16 py-1 text-xs`} value={newStart} onChange={e => setNewStart(Number(e.target.value))}>
                      {HOURS.map(h => <option key={h} value={h}>{String(h).padStart(2, '0')}</option>)}
                    </select>
                    <span className="text-gray-400">:</span>
                    <select className={`${inputCls} w-14 py-1 text-xs`} value={newStartMin} onChange={e => setNewStartMin(e.target.value as PMaxMinute)}>
                      {MINUTES.map(m => <option key={m} value={m}>{MINUTE_LABELS[m]}</option>)}
                    </select>
                    <span className="text-gray-400 text-xs">–</span>
                    <select className={`${inputCls} w-16 py-1 text-xs`} value={newEnd} onChange={e => setNewEnd(Number(e.target.value))}>
                      {END_HOURS.map(h => <option key={h} value={h}>{String(h).padStart(2, '0')}</option>)}
                    </select>
                    <span className="text-gray-400">:</span>
                    <select className={`${inputCls} w-14 py-1 text-xs`} value={newEndMin} onChange={e => setNewEndMin(e.target.value as PMaxMinute)}>
                      {MINUTES.map(m => <option key={m} value={m}>{MINUTE_LABELS[m]}</option>)}
                    </select>
                    <button type="button" onClick={addScheduleEntry} className="px-3 py-1 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700">{t('settings.scheduleAdd')}</button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <p className="text-xs text-gray-500 mt-2">{t('settings.scheduleOptionalNote')}</p>
      </section>

      <section className="border border-gray-100 rounded-lg p-4 bg-white">
        <div className="flex items-center gap-2 mb-2">
          <Shield className="w-4 h-4 text-gray-600" />
          <h4 className="text-sm font-semibold text-gray-900">{t('settings.euPoliticalTitle')}</h4>
        </div>
        <a href={EU_POLICY_URL} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline mb-2 block">{t('settings.euPoliticalLearnMore')}</a>
        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="pmaxEuPolitical" checked={state.euPoliticalAdsDeclaration === 'NOT_POLITICAL'} onChange={() => update({ euPoliticalAdsDeclaration: 'NOT_POLITICAL' })} className="text-blue-600" />
            <span className="text-sm">{t('settings.euPoliticalNotPolitical')}</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="pmaxEuPolitical" checked={state.euPoliticalAdsDeclaration === 'POLITICAL'} onChange={() => update({ euPoliticalAdsDeclaration: 'POLITICAL' })} className="text-blue-600" />
            <span className="text-sm">{t('settings.euPoliticalPolitical')}</span>
          </label>
        </div>
      </section>
    </div>
  )
}
