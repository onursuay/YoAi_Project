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
  schedule_mode?: 'daily' | 'weekly_days' | 'monthly_days' | null
  days_of_week?: number[] | null
  days_of_month?: number[] | null
  target_categories?: string[] | null
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
  const [saveError, setSaveError] = useState(false)
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
  const [scheduleMode, setScheduleMode] = useState<'daily' | 'weekly_days' | 'monthly_days'>('daily')
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([])
  const [daysOfMonth, setDaysOfMonth] = useState<number[]>([])
  const [targetCategories, setTargetCategories] = useState<string[]>([])
  const [briefCategories, setBriefCategories] = useState<string[]>([])
  const [briefStatus, setBriefStatus] = useState<string | null>(null)
  const [tone, setTone] = useState('Samimi')
  const [wordCount, setWordCount] = useState(500)
  const [autoPublish, setAutoPublish] = useState(true)
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
        if (s.schedule_mode) {
          setScheduleMode(s.schedule_mode)
          if (Array.isArray(s.days_of_week)) setDaysOfWeek(s.days_of_week)
          if (Array.isArray(s.days_of_month)) setDaysOfMonth(s.days_of_month)
        } else if (s.frequency === 'weekly' && s.weekday != null) {
          setScheduleMode('weekly_days')
          setDaysOfWeek([s.weekday])
        } else if (s.frequency === 'weekdays') {
          setScheduleMode('weekly_days')
          setDaysOfWeek([1, 2, 3, 4, 5])
        }
        if (Array.isArray(s.target_categories)) setTargetCategories(s.target_categories)
        setTone(s.tone)
        setWordCount(s.word_count)
        setAutoPublish(s.auto_publish)
        setKeywords(s.keyword_pool || [])
        setLastStatus(s.last_status)
      }
    } catch { /* ignore */ }
    finally { setLoading(false) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { load() }, [load])

  // Site değişince brief kategorilerini çek
  useEffect(() => {
    if (!siteConnectionId) { setBriefCategories([]); setBriefStatus(null); return }
    let cancelled = false
    fetch(`/api/seo/brief?siteConnectionId=${siteConnectionId}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d.ok) { setBriefCategories(d.brief?.categories ?? []); setBriefStatus(d.brief?.scan_status ?? null) } })
      .catch(() => {})
    return () => { cancelled = true }
  }, [siteConnectionId])

  // function declaration → hoisted; addKeyword/removeKeyword aşağıdan çağırabilir.
  async function handleSave(kwOverride?: string[]) {
    setSaving(true)
    setSaved(false)
    setSaveError(false)
    // "Kaydet"e basıldığında input'ta yazılı ama henüz Enter ile eklenmemiş
    // kelimeyi de dahil et — aksi halde kullanıcının yazdığı kelime kaydedilmez
    // ve sayfa yenilenince kaybolurdu.
    let effectiveKeywords = kwOverride ?? keywords
    if (kwOverride === undefined) {
      const pending = kwInput.trim()
      if (pending && !effectiveKeywords.includes(pending)) {
        effectiveKeywords = [...effectiveKeywords, pending]
        setKeywords(effectiveKeywords)
        setKwInput('')
      }
    }
    try {
      const payload = {
        id: scheduleId,
        enabled,
        siteConnectionId: siteConnectionId || null,
        publishTime,
        timezone,
        frequency,
        weekday: frequency === 'weekly' ? weekday : null,
        scheduleMode,
        daysOfWeek: scheduleMode === 'weekly_days' ? daysOfWeek : [],
        daysOfMonth: scheduleMode === 'monthly_days' ? daysOfMonth : [],
        targetCategories,
        tone,
        wordCount,
        autoPublish,
        generateImage: true, // her makaleye görsel otomatik üretilir — kullanıcıya seçenek sunulmaz
        keywordPool: effectiveKeywords,
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
        if (Array.isArray(data.schedule.keyword_pool)) setKeywords(data.schedule.keyword_pool)
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      } else {
        setSaveError(true)
      }
    } catch {
      setSaveError(true)
    } finally {
      setSaving(false)
    }
  }

  // Anahtar kelime ekle/çıkar → OTOMATİK kaydet ("Kaydet" beklemeden persist;
  // sayfa yenilenince kelimeler korunur).
  const addKeyword = () => {
    const v = kwInput.trim()
    if (v && !keywords.includes(v)) {
      const next = [...keywords, v]
      setKeywords(next)
      void handleSave(next)
    }
    setKwInput('')
  }

  const removeKeyword = (kw: string) => {
    const next = keywords.filter((k) => k !== kw)
    setKeywords(next)
    void handleSave(next)
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

  const weekdays = [0, 1, 2, 3, 4, 5, 6].map((i) => t(`weekday${i}` as Parameters<typeof t>[0]))

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
      {/* Üretim modu — net iki seçenek (segment kontrolü) */}
      <div>
        <div className="inline-flex rounded-xl border border-gray-200 p-1 bg-gray-50 shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)]">
          <button
            type="button"
            onClick={() => setEnabled(true)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${enabled ? 'bg-white text-primary shadow-[0_1px_3px_rgba(0,0,0,0.08)]' : 'text-gray-600 hover:text-gray-900'}`}
          >
            {t('enabled')}
          </button>
          <button
            type="button"
            onClick={() => setEnabled(false)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${!enabled ? 'bg-white text-primary shadow-[0_1px_3px_rgba(0,0,0,0.08)]' : 'text-gray-600 hover:text-gray-900'}`}
          >
            {t('disabled')}
          </button>
        </div>
        {!enabled && <p className="text-xs text-gray-500 leading-relaxed mt-2">{t('manualHint')}</p>}
      </div>

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

        {enabled && (
          <>
        {/* Yayın Saati — Meta tarzı saat:dakika seçici (native saat kutusu yerine) */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">{t('time')}</label>
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <CustomSelect
                value={(publishTime.split(':')[0] || '09').padStart(2, '0')}
                onChange={(v) => setPublishTime(`${String(v).padStart(2, '0')}:${(publishTime.split(':')[1] || '00').padStart(2, '0')}`)}
                ariaLabel={`${t('time')} — saat`}
                options={Array.from({ length: 24 }, (_, h) => ({ value: String(h).padStart(2, '0'), label: String(h).padStart(2, '0') }))}
              />
            </div>
            <span className="text-gray-400 font-semibold">:</span>
            <div className="flex-1">
              <CustomSelect
                value={(publishTime.split(':')[1] || '00').padStart(2, '0')}
                onChange={(v) => setPublishTime(`${(publishTime.split(':')[0] || '09').padStart(2, '0')}:${String(v).padStart(2, '0')}`)}
                ariaLabel={`${t('time')} — dakika`}
                options={(() => {
                  const mins = Array.from({ length: 12 }, (_, k) => String(k * 5).padStart(2, '0'))
                  const cur = (publishTime.split(':')[1] || '00').padStart(2, '0')
                  if (!mins.includes(cur)) mins.push(cur)
                  return mins.sort().map((m) => ({ value: m, label: m }))
                })()}
              />
            </div>
          </div>
        </div>

        {/* Yayın takvimi modu */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">{t('scheduleMode')}</label>
          <CustomSelect
            value={scheduleMode}
            onChange={(v) => setScheduleMode(String(v) as 'daily' | 'weekly_days' | 'monthly_days')}
            ariaLabel={t('scheduleMode')}
            options={[
              { value: 'daily', label: t('modeDaily') },
              { value: 'weekly_days', label: t('modeWeeklyDays') },
            ]}
          />
        </div>

        {scheduleMode === 'weekly_days' && (
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">{t('selectDaysOfWeek')}</label>
            <div className="flex flex-wrap gap-2">
              {weekdays.map((d, i) => {
                const on = daysOfWeek.includes(i)
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setDaysOfWeek(on ? daysOfWeek.filter((x) => x !== i) : [...daysOfWeek, i])}
                    className={`px-3.5 py-2 rounded-xl border text-sm font-medium transition-all ${on ? 'bg-primary/8 text-primary border-primary ring-2 ring-primary/20' : 'bg-white text-gray-700 border-gray-200 shadow-[0_1px_3px_rgba(0,0,0,0.06),inset_0_1px_2px_rgba(0,0,0,0.04)] hover:border-gray-300'}`}
                  >
                    {d}
                  </button>
                )
              })}
            </div>
          </div>
        )}

          </>
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

      {/* Otomatik yayınla — yalnız otomatik modda anlamlı (görsel üretimi otomatik & gizli) */}
      {enabled && (
        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={autoPublish} onChange={(e) => setAutoPublish(e.target.checked)} className="w-4 h-4 rounded accent-primary" />
            <span className="text-sm text-gray-700">{t('autoPublish')}</span>
          </label>
        </div>
      )}

      {/* Hedef kategoriler (brief'ten) */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">{t('targetCategories')}</label>
        {briefStatus === 'running' || briefStatus === 'pending' ? (
          <p className="text-sm text-gray-500">{t('categoriesScanning')}</p>
        ) : briefCategories.length === 0 ? (
          <p className="text-sm text-gray-500">{t('categoriesNone')}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {briefCategories.map((cat) => {
              const on = targetCategories.includes(cat)
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setTargetCategories(on ? targetCategories.filter((c) => c !== cat) : [...targetCategories, cat])}
                  className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${on ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}
                >
                  {cat}
                </button>
              )
            })}
          </div>
        )}
        <p className="text-xs text-gray-500 mt-1">{t('targetCategoriesHint')}</p>
      </div>

      {/* Keyword pool */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">{t('keywordPool')}</label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {keywords.map((kw) => (
            <span key={kw} className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-emerald-50 text-emerald-700">
              {kw}
              <button onClick={() => removeKeyword(kw)} className="hover:text-emerald-900">
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
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
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
          {saveError && (
            <span className="text-xs text-red-600 flex items-center gap-1">
              <X className="w-3.5 h-3.5" /> {t('saveError')}
            </span>
          )}
          <button
            onClick={() => handleSave()}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
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
