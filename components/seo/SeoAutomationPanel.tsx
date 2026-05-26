'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Loader2, Zap, Save, X, CheckCircle2, Clock } from 'lucide-react'
import CustomSelect from '@/components/ui/CustomSelect'

/* ═══════ Types ═══════ */

interface SiteOption {
  id: string
  label: string | null
  baseUrl: string
}

interface Schedule {
  id: string
  site_connection_id: string | null
  enabled: boolean
  frequency: 'daily' | 'weekdays' | 'weekly'
  publish_time: string
  timezone: string
  weekday: number | null
  tone: string
  word_count: number
  keyword_pool: string[]
  auto_publish: boolean
  generate_image: boolean
  last_status: string | null
}

/* ═══════ Component ═══════ */

export default function SeoAutomationPanel() {
  const tArt = useTranslations('dashboard.seo.articles')
  const t = useTranslations('dashboard.seo.articles.automation')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [sites, setSites] = useState<SiteOption[]>([])
  const [scheduleId, setScheduleId] = useState<string | undefined>()

  // form state
  const browserTz = typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'Europe/Istanbul'
  const [enabled, setEnabled] = useState(true)
  const [siteConnectionId, setSiteConnectionId] = useState<string>('')
  const [publishTime, setPublishTime] = useState('09:00')
  const [timezone, setTimezone] = useState(browserTz || 'Europe/Istanbul')
  const [frequency, setFrequency] = useState<'daily' | 'weekdays' | 'weekly'>('daily')
  const [weekday, setWeekday] = useState(1)
  const [tone, setTone] = useState('Samimi')
  const [wordCount, setWordCount] = useState(500)
  const [autoPublish, setAutoPublish] = useState(true)
  const [generateImage, setGenerateImage] = useState(true)
  const [keywords, setKeywords] = useState<string[]>([])
  const [kwInput, setKwInput] = useState('')
  const [lastStatus, setLastStatus] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [sitesRes, schedRes] = await Promise.all([
        fetch('/api/seo/sites', { cache: 'no-store' }),
        fetch('/api/seo/schedules', { cache: 'no-store' }),
      ])
      const sitesData = await sitesRes.json()
      const schedData = await schedRes.json()

      if (sitesData.ok) {
        setSites(sitesData.connections)
        if (sitesData.connections.length && !siteConnectionId) {
          const def = sitesData.connections.find((c: { isDefault: boolean }) => c.isDefault) || sitesData.connections[0]
          setSiteConnectionId(def.id)
        }
      }
      if (schedData.ok && schedData.schedules.length) {
        const s: Schedule = schedData.schedules[0]
        setScheduleId(s.id)
        setEnabled(s.enabled)
        if (s.site_connection_id) setSiteConnectionId(s.site_connection_id)
        setPublishTime(s.publish_time)
        setTimezone(s.timezone)
        setFrequency(s.frequency)
        if (s.weekday != null) setWeekday(s.weekday)
        setTone(s.tone)
        setWordCount(s.word_count)
        setAutoPublish(s.auto_publish)
        setGenerateImage(s.generate_image)
        setKeywords(s.keyword_pool || [])
        setLastStatus(s.last_status)
      }
    } catch { /* ignore */ }
    finally { setLoading(false) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { load() }, [load])

  const addKeyword = () => {
    const v = kwInput.trim()
    if (v && !keywords.includes(v)) setKeywords((p) => [...p, v])
    setKwInput('')
  }

  const handleSave = async () => {
    setSaving(true)
    setSaved(false)
    try {
      const payload = {
        id: scheduleId,
        enabled,
        siteConnectionId: siteConnectionId || null,
        publishTime,
        timezone,
        frequency,
        weekday: frequency === 'weekly' ? weekday : null,
        tone,
        wordCount,
        autoPublish,
        generateImage,
        keywordPool: keywords,
      }
      const res = await fetch(scheduleId ? `/api/seo/schedules/${scheduleId}` : '/api/seo/schedules', {
        method: scheduleId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (data.ok) {
        setScheduleId(data.schedule.id)
        setLastStatus(data.schedule.last_status)
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      }
    } catch { /* ignore */ }
    finally { setSaving(false) }
  }

  const lastStatusText = (): string | null => {
    switch (lastStatus) {
      case 'success': return t('lastStatusSuccess')
      case 'error': return t('lastStatusError')
      case 'skipped_credits': return t('lastStatusSkippedCredits')
      case 'skipped_no_site': return t('lastStatusSkippedNoSite')
      default: return null
    }
  }

  const weekdays = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi']

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-5 flex justify-center py-8 text-gray-400">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    )
  }

  const noSites = sites.length === 0

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <Zap className="w-4 h-4 text-purple-600" /> {t('title')}
        </h3>
        <p className="text-xs text-gray-500 mt-0.5">{t('description')}</p>
      </div>

      {noSites ? (
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 text-sm text-primary leading-relaxed">
          {t('noSiteWarning')}
        </div>
      ) : (
        <>
      {/* Enabled toggle */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="w-4 h-4 rounded accent-purple-600" />
        <span className="text-sm font-medium text-gray-900">{enabled ? t('enabled') : t('disabled')}</span>
      </label>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Site */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">{t('site')}</label>
          <CustomSelect
            value={siteConnectionId}
            onChange={(v) => setSiteConnectionId(String(v))}
            ariaLabel={t('site')}
            placeholder="—"
            options={sites.map((s) => ({ value: s.id, label: s.label || s.baseUrl }))}
          />
        </div>

        {/* Time */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">{t('time')}</label>
          <input
            type="time"
            value={publishTime}
            onChange={(e) => setPublishTime(e.target.value)}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/15 focus:border-primary"
          />
        </div>

        {/* Frequency */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">{t('frequency')}</label>
          <CustomSelect
            value={frequency}
            onChange={(v) => setFrequency(v as 'daily' | 'weekdays' | 'weekly')}
            ariaLabel={t('frequency')}
            options={[
              { value: 'daily', label: t('freqDaily') },
              { value: 'weekdays', label: t('freqWeekdays') },
              { value: 'weekly', label: t('freqWeekly') },
            ]}
          />
        </div>

        {/* Weekday (weekly) */}
        {frequency === 'weekly' && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">{t('weekday')}</label>
            <CustomSelect
              value={weekday}
              onChange={(v) => setWeekday(Number(v))}
              ariaLabel={t('weekday')}
              options={weekdays.map((d, i) => ({ value: i, label: d }))}
            />
          </div>
        )}

        {/* Tone */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">{tArt('tone')}</label>
          <CustomSelect
            value={tone}
            onChange={(v) => setTone(String(v))}
            ariaLabel={tArt('tone')}
            options={[
              { value: 'Resmi', label: tArt('toneFormal') },
              { value: 'Samimi', label: tArt('toneFriendly') },
              { value: 'Teknik', label: tArt('toneTechnical') },
              { value: 'Eğitici', label: tArt('toneEducational') },
            ]}
          />
        </div>

        {/* Word count */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">{tArt('wordCount')}</label>
          <CustomSelect
            value={wordCount}
            onChange={(v) => setWordCount(Number(v))}
            ariaLabel={tArt('wordCount')}
            options={[300, 400, 500, 600, 800].map((w) => ({ value: w, label: String(w) }))}
          />
        </div>
      </div>

      {/* Toggles */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={autoPublish} onChange={(e) => setAutoPublish(e.target.checked)} className="w-4 h-4 rounded accent-purple-600" />
          <span className="text-sm text-gray-700">{t('autoPublish')}</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={generateImage} onChange={(e) => setGenerateImage(e.target.checked)} className="w-4 h-4 rounded accent-purple-600" />
          <span className="text-sm text-gray-700">{t('generateImage')}</span>
        </label>
      </div>

      {/* Keyword pool */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">{t('keywordPool')}</label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {keywords.map((kw) => (
            <span key={kw} className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-emerald-50 text-emerald-700">
              {kw}
              <button onClick={() => setKeywords((p) => p.filter((k) => k !== kw))} className="hover:text-emerald-900">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
        <input
          type="text"
          value={kwInput}
          onChange={(e) => setKwInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addKeyword() } }}
          placeholder={t('keywordPoolPlaceholder')}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
        />
        <p className="text-xs text-gray-500 mt-1">{t('keywordPoolHint')}</p>
      </div>

      {/* Last status + save */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
        <div className="text-xs text-gray-500 flex items-center gap-1.5">
          {lastStatusText() && (
            <>
              <Clock className="w-3.5 h-3.5" />
              {lastStatusText()}
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {saved && (
            <span className="text-xs text-emerald-600 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> {t('saved')}
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {t('save')}
          </button>
        </div>
      </div>
        </>
      )}
    </div>
  )
}
