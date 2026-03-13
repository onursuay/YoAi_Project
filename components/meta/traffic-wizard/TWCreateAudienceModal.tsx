'use client'

import { useState, useEffect, useRef } from 'react'
import {
  X, ArrowLeft, Globe, Upload, Heart, ShoppingCart,
  ChevronRight, Check, AlertCircle, Search,
  MonitorSmartphone, WifiOff, BookOpen, Play, Instagram,
  FileText, CalendarDays, Zap, Facebook, Tag, Info,
} from 'lucide-react'
import { getTrafficI18n } from './i18n'
import type { MetaAudienceResult, MetaAudienceSourceItem } from './useAudienceSearch'
import { useMetaAudienceSources } from './useAudienceSearch'

// ── Types ──

type SourceKey =
  | 'website' | 'customer_list' | 'app_activity' | 'offline_activity' | 'catalog'
  | 'video' | 'instagram_account' | 'lead_form' | 'events'
  | 'instant_experience' | 'facebook_page' | 'shopping' | 'fb_listings'

type ModalMode = 'menu' | 'custom_source' | 'custom_form' | 'lookalike'

interface TWCreateAudienceModalProps {
  isOpen: boolean
  onClose: () => void
  onCreated: (audience: { id: string; name: string }) => void
  initialMode?: 'custom' | 'lookalike'
  audiences: MetaAudienceResult[]
}

type TFn = ReturnType<typeof getTrafficI18n>

// ── Source definitions ──

const YOUR_SOURCES: { key: SourceKey; icon: typeof Globe }[] = [
  { key: 'website', icon: Globe },
  { key: 'customer_list', icon: Upload },
  { key: 'app_activity', icon: MonitorSmartphone },
  { key: 'offline_activity', icon: WifiOff },
  { key: 'catalog', icon: BookOpen },
]

const META_SOURCES: { key: SourceKey; icon: typeof Globe }[] = [
  { key: 'video', icon: Play },
  { key: 'instagram_account', icon: Instagram },
  { key: 'lead_form', icon: FileText },
  { key: 'events', icon: CalendarDays },
  { key: 'instant_experience', icon: Zap },
  { key: 'facebook_page', icon: Facebook },
  { key: 'shopping', icon: ShoppingCart },
  { key: 'fb_listings', icon: Tag },
]

const SOURCE_LABEL_KEYS: Record<string, string> = {
  website: 'createSourceWebsiteFull',
  customer_list: 'createSourceCustomerListFull',
  app_activity: 'createSourceAppActivity',
  offline_activity: 'createSourceOfflineActivity',
  catalog: 'createSourceCatalog',
  video: 'createSourceVideo',
  instagram_account: 'createSourceInstagramAccount',
  lead_form: 'createSourceLeadForm',
  events: 'createSourceEvents',
  instant_experience: 'createSourceInstantExperience',
  facebook_page: 'createSourceFacebookPage',
  shopping: 'createSourceShopping',
  fb_listings: 'createSourceFbListings',
}

// Map source keys to engagement API parameters
const SOURCE_TO_ENGAGEMENT: Record<string, { sourceType: string; events: { value: string; labelKey: string }[] }> = {
  facebook_page: {
    sourceType: 'page',
    events: [
      { value: 'page_engaged', labelKey: 'engPageAll' },
      { value: 'page_visited', labelKey: 'engPageVisited' },
      { value: 'page_post_engaged', labelKey: 'engPageEngaged' },
      { value: 'page_cta_clicked', labelKey: 'engPageCta' },
      { value: 'page_messaged', labelKey: 'engPageMessaged' },
      { value: 'page_saved', labelKey: 'engPageSaved' },
    ],
  },
  instagram_account: {
    sourceType: 'ig_business',
    events: [
      { value: 'ig_business_profile_all', labelKey: 'engIgAll' },
      { value: 'ig_business_profile_visit', labelKey: 'engIgVisit' },
      { value: 'ig_business_profile_engaged', labelKey: 'engIgEngaged' },
      { value: 'ig_business_profile_messaged', labelKey: 'engIgMessaged' },
      { value: 'ig_business_profile_saved', labelKey: 'engIgSavedPost' },
      { value: 'ig_business_profile_ad_interaction', labelKey: 'engIgAdInteraction' },
    ],
  },
  video: {
    sourceType: 'video',
    events: [
      { value: 'video_watched_3s', labelKey: 'engVideoWatched3' },
      { value: 'video_watched_10s', labelKey: 'engVideoWatched10' },
      { value: 'video_watched_25p', labelKey: 'engVideoWatched25' },
      { value: 'video_watched_50p', labelKey: 'engVideoWatched50' },
      { value: 'video_watched_75p', labelKey: 'engVideoWatched75' },
      { value: 'video_watched_95p', labelKey: 'engVideoWatched95' },
    ],
  },
  lead_form: {
    sourceType: 'leadgen',
    events: [
      { value: 'lead_generation_opened', labelKey: 'engLeadOpened' },
      { value: 'lead_generation_not_submitted', labelKey: 'engLeadNotSubmit' },
      { value: 'lead_generation_submitted', labelKey: 'engLeadSubmitted' },
    ],
  },
  events: {
    sourceType: 'event',
    events: [
      { value: 'event_responded', labelKey: 'engEventGoing' },
      { value: 'event_visited', labelKey: 'engEventVisited' },
      { value: 'event_interested', labelKey: 'engEventInterested' },
      { value: 'event_purchased_ticket', labelKey: 'engEventPurchasedTicket' },
    ],
  },
  instant_experience: {
    sourceType: 'canvas',
    events: [
      { value: 'canvas_opened', labelKey: 'engCanvasOpened' },
      { value: 'canvas_clicked', labelKey: 'engCanvasClicked' },
    ],
  },
}

// ── Shared helpers ──

function SuccessView({ t }: { t: TFn }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 gap-3">
      <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
        <Check className="w-6 h-6 text-green-600" />
      </div>
      <p className="text-sm font-medium text-green-700">{t.createSuccess}</p>
    </div>
  )
}

function ErrorBanner({ error }: { error: string }) {
  if (!error) return null
  return (
    <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-lg">
      <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
      <span className="text-xs text-red-600">{error}</span>
    </div>
  )
}

function FormActions({ t, onBack, onCreate, canCreate, creating }: {
  t: TFn; onBack: () => void; onCreate: () => void; canCreate: boolean; creating: boolean
}) {
  return (
    <div className="flex justify-end gap-2 pt-2">
      <button type="button" onClick={onBack}
        className="px-4 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
        {t.createBtnCancel}
      </button>
      <button type="button" onClick={onCreate} disabled={!canCreate}
        className="px-5 py-2.5 text-sm font-medium text-white bg-[#2BB673] rounded-lg hover:bg-[#249E63] disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
        {creating ? t.createBtnCreating : t.createBtnCreate}
      </button>
    </div>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">{children}</label>
}

function RetentionSlider({ value, onChange, max = 365, t }: {
  value: number; onChange: (v: number) => void; max?: number; t: TFn
}) {
  return (
    <div>
      <FieldLabel>{t.engagementRetention}</FieldLabel>
      <div className="flex items-center gap-3">
        <input type="range" min={1} max={max} value={value}
          onChange={e => onChange(Number(e.target.value))} className="flex-1 accent-[#2BB673]" />
        <div className="w-16 text-center">
          <input type="number" min={1} max={max} value={value}
            onChange={e => { const v = Number(e.target.value); if (v >= 1 && v <= max) onChange(v) }}
            className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
        </div>
      </div>
      <p className="mt-1.5 text-xs text-gray-400">{t.engagementRetentionDesc}</p>
    </div>
  )
}

function NameField({ value, onChange, t }: { value: string; onChange: (v: string) => void; t: TFn }) {
  return (
    <div>
      <FieldLabel>{t.engagementAudienceName}</FieldLabel>
      <input type="text" value={value} onChange={e => onChange(e.target.value)}
        placeholder={t.engagementAudienceNamePlaceholder}
        className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
    </div>
  )
}

// ── Sources that support Include/Exclude conditions ──

const SOURCES_WITH_EXCLUDE: SourceKey[] = ['website', 'app_activity', 'catalog', 'facebook_page', 'instagram_account']

// ── IncludeExcludeBuilder ──

function IncludeExcludeBuilder({ t, events, excludeEvent, onExcludeEventChange, showExclude, onToggleExclude }: {
  t: TFn
  events: { value: string; labelKey: string }[]
  excludeEvent: string
  onExcludeEventChange: (v: string) => void
  showExclude: boolean
  onToggleExclude: () => void
}) {
  return (
    <div className="space-y-2">
      <button type="button" onClick={onToggleExclude}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
          showExclude
            ? 'bg-red-50 text-red-600 border border-red-200'
            : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
        }`}>
        {showExclude ? t.removeExcludeCondition : t.addExcludeCondition}
      </button>
      {showExclude && (
        <div className="p-3 bg-red-50/50 border border-red-100 rounded-lg space-y-2">
          <label className="block text-xs font-semibold text-red-600 uppercase tracking-wide">{t.excludeEvent}</label>
          <select value={excludeEvent} onChange={e => onExcludeEventChange(e.target.value)}
            className="w-full px-4 py-2.5 border border-red-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-300">
            <option value="">-- {t.excludeEvent} --</option>
            {events.map(ev => (
              <option key={ev.value} value={ev.value}>
                {(t as Record<string, string>)[ev.labelKey] || ev.value}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  )
}

// ── AudienceSummaryBox ──

function generateSummary(t: TFn, opts: {
  sourceKey: SourceKey
  retentionDays: number
  visitType?: string
  urlContains?: string
  eventName?: string
  appEvent?: string
  offlineEvent?: string
  catalogName?: string
  engagementEvent?: string
  excludeEvent?: string
  recordCount?: number
}): string {
  const prefix = (t.summaryPrefix as string).replace('{days}', String(opts.retentionDays))
  let body = ''

  switch (opts.sourceKey) {
    case 'website':
      if (opts.visitType === 'url' && opts.urlContains) {
        body = (t.summaryWebsiteUrl as string).replace('{url}', opts.urlContains)
      } else if (opts.visitType === 'event' && opts.eventName) {
        body = (t.summaryWebsiteEvent as string).replace('{event}', opts.eventName)
      } else if (opts.visitType === 'time_spent') {
        body = t.summaryWebsiteTime as string
      } else {
        body = t.summaryWebsiteAll as string
      }
      break
    case 'customer_list':
      body = t.summaryCustomerList as string
      if (opts.recordCount) body += ` (${(t.summaryRecordCount as string).replace('{count}', String(opts.recordCount))})`
      break
    case 'app_activity':
      if (opts.appEvent && opts.appEvent !== 'all') {
        body = (t.summaryAppEvent as string).replace('{event}', opts.appEvent)
      } else {
        body = t.summaryAppAll as string
      }
      break
    case 'offline_activity':
      if (opts.offlineEvent && opts.offlineEvent !== 'all') {
        body = (t.summaryOfflineEvent as string).replace('{event}', opts.offlineEvent)
      } else {
        body = t.summaryOfflineAll as string
      }
      break
    case 'catalog':
    case 'shopping':
      body = opts.catalogName
        ? (t.summaryCatalog as string).replace('{catalog}', opts.catalogName)
        : t.summaryOfflineAll as string
      break
    default: {
      const label = (t as Record<string, string>)[SOURCE_LABEL_KEYS[opts.sourceKey]] || opts.sourceKey
      body = (t.summaryEngagement as string).replace('{source}', label)
      break
    }
  }

  let text = `${prefix} ${body}`
  if (opts.excludeEvent) {
    text += (t.summaryExcluding as string).replace('{event}', opts.excludeEvent)
  }
  return text
}

function AudienceSummaryBox({ t, summary }: { t: TFn; summary: string }) {
  if (!summary) return null
  return (
    <div className="p-3 bg-blue-50/60 border border-blue-100 rounded-lg">
      <div className="flex items-center gap-1.5 mb-1">
        <Info className="w-3.5 h-3.5 text-blue-500 shrink-0" />
        <span className="text-xs font-semibold text-blue-700">{t.summaryBoxTitle}</span>
      </div>
      <p className="text-xs text-blue-600 leading-relaxed">{summary}</p>
    </div>
  )
}

// ── CapabilityGate ──

function CapabilityGate({ t, items, loading, children }: {
  t: TFn; items: { id: string; name: string }[]; loading: boolean; children: React.ReactNode
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 p-4 bg-gray-50 rounded-lg">
        <span className="w-4 h-4 border-2 border-gray-300 border-t-primary rounded-full animate-spin" />
        <span className="text-xs text-gray-500">{t.capabilityChecking}</span>
      </div>
    )
  }
  if (items.length === 0) {
    return (
      <div className="p-4 bg-yellow-50 border border-yellow-100 rounded-lg space-y-2">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-yellow-600 shrink-0" />
          <span className="text-sm font-medium text-yellow-700">{t.capabilityMissing}</span>
        </div>
        <p className="text-xs text-yellow-600">{t.capabilitySetupHint}</p>
      </div>
    )
  }
  return <>{children}</>
}

function SelectField({ value, onChange, label, placeholder, items, loading, emptyText }: {
  value: string; onChange: (v: string) => void; label: string; placeholder: string
  items: { id: string; name: string }[]; loading?: boolean; emptyText?: string
}) {
  if (loading) {
    return (
      <div>
        <FieldLabel>{label}</FieldLabel>
        <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
          <span className="w-4 h-4 border-2 border-gray-300 border-t-primary rounded-full animate-spin" />
          <span className="text-xs text-gray-500">...</span>
        </div>
      </div>
    )
  }
  if (items.length === 0 && emptyText) {
    return (
      <div>
        <FieldLabel>{label}</FieldLabel>
        <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-100 rounded-lg">
          <AlertCircle className="w-4 h-4 text-yellow-600 shrink-0" />
          <span className="text-xs text-yellow-700">{emptyText}</span>
        </div>
      </div>
    )
  }
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary">
        <option value="">-- {placeholder} --</option>
        {items.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
      </select>
    </div>
  )
}

// ── Main Component ──

export default function TWCreateAudienceModal({
  isOpen, onClose, onCreated, initialMode, audiences,
}: TWCreateAudienceModalProps) {
  const t = getTrafficI18n()
  const [mode, setMode] = useState<ModalMode>(
    initialMode === 'custom' ? 'custom_source' : initialMode === 'lookalike' ? 'lookalike' : 'menu'
  )
  const [selectedSource, setSelectedSource] = useState<SourceKey>('website')

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode === 'custom' ? 'custom_source' : initialMode === 'lookalike' ? 'lookalike' : 'menu')
      setSelectedSource('website')
    }
  }, [isOpen, initialMode])

  if (!isOpen) return null

  const title =
    mode === 'menu' ? t.createAudienceTitle
    : mode === 'custom_source' ? t.createSourceModalTitle
    : mode === 'custom_form' ? (t as Record<string, string>)[SOURCE_LABEL_KEYS[selectedSource]] || t.createAudienceTitle
    : t.lookalikeTitle

  const showBack = mode !== 'menu'
  const handleBack = () => {
    if (mode === 'custom_form') setMode('custom_source')
    else setMode('menu')
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            {showBack && (
              <button type="button" onClick={handleBack}
                className="p-1 -ml-1 text-gray-400 hover:text-gray-600 transition-colors">
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <h3 className="text-base font-semibold text-gray-900">{title}</h3>
          </div>
          <button type="button" onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {mode === 'menu' && (
            <MenuView t={t}
              onSelectCustom={() => setMode('custom_source')}
              onSelectLookalike={() => setMode('lookalike')} />
          )}
          {mode === 'custom_source' && (
            <CustomSourceGridView t={t} selected={selectedSource}
              onSelect={setSelectedSource}
              onNext={() => setMode('custom_form')}
              onCancel={onClose} />
          )}
          {mode === 'custom_form' && (
            <SourceFormRouter sourceKey={selectedSource} t={t}
              onCreated={onCreated} onClose={onClose}
              onBack={() => setMode('custom_source')} />
          )}
          {mode === 'lookalike' && (
            <LookalikeAudienceView t={t} audiences={audiences}
              onCreated={onCreated} onClose={onClose} />
          )}
        </div>
      </div>
    </div>
  )
}

// ── Menu View ──

function MenuView({ t, onSelectCustom, onSelectLookalike }: {
  t: TFn; onSelectCustom: () => void; onSelectLookalike: () => void
}) {
  return (
    <div className="space-y-3">
      <button type="button" onClick={onSelectCustom}
        className="w-full text-left p-4 rounded-xl border-2 border-gray-200 hover:border-primary/40 hover:bg-primary/[0.02] transition-all group">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Globe className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-sm font-semibold text-gray-900">{t.audienceCreateCustom}</span>
            <p className="text-xs text-gray-500 mt-0.5">{t.audienceCreateCustomDesc2}</p>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-primary transition-colors shrink-0" />
        </div>
      </button>
      <button type="button" onClick={onSelectLookalike}
        className="w-full text-left p-4 rounded-xl border-2 border-gray-200 hover:border-primary/40 hover:bg-primary/[0.02] transition-all group">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-500 flex items-center justify-center shrink-0">
            <Heart className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-sm font-semibold text-gray-900">{t.audienceCreateLookalike}</span>
            <p className="text-xs text-gray-500 mt-0.5">{t.audienceCreateLookalikeDesc2}</p>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-primary transition-colors shrink-0" />
        </div>
      </button>
    </div>
  )
}

// ── Custom Audience Source Grid ──

function CustomSourceGridView({ t, selected, onSelect, onNext, onCancel }: {
  t: TFn; selected: SourceKey; onSelect: (key: SourceKey) => void; onNext: () => void; onCancel: () => void
}) {
  const renderSource = (src: { key: SourceKey; icon: typeof Globe }) => {
    const Icon = src.icon
    const label = (t as Record<string, string>)[SOURCE_LABEL_KEYS[src.key]] || src.key
    const isSelected = selected === src.key

    return (
      <button key={src.key} type="button" onClick={() => onSelect(src.key)}
        className={`flex items-center gap-2.5 p-3 rounded-lg border text-left transition-all ${
          isSelected
            ? 'border-primary bg-primary/[0.03] ring-1 ring-primary/20'
            : 'border-gray-200 bg-white hover:border-gray-300 cursor-pointer'
        }`}>
        <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
          isSelected ? 'border-primary' : 'border-gray-300'
        }`}>
          {isSelected && <span className="w-2 h-2 rounded-full bg-primary" />}
        </span>
        <Icon className="w-4 h-4 shrink-0 text-gray-500" />
        <span className="text-sm text-gray-800">{label}</span>
      </button>
    )
  }

  return (
    <div className="space-y-5">
      <p className="text-xs text-gray-500">{t.createSourceModalDesc}</p>
      <div>
        <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">{t.createSourceYourSources}</h4>
        <div className="grid grid-cols-2 gap-2">{YOUR_SOURCES.map(renderSource)}</div>
      </div>
      <div>
        <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">{t.createSourceMetaSources}</h4>
        <div className="grid grid-cols-2 gap-2">{META_SOURCES.map(renderSource)}</div>
      </div>
      <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
        <button type="button" onClick={onCancel}
          className="px-4 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
          {t.createBtnCancel}
        </button>
        <button type="button" onClick={onNext} disabled={!selected}
          className="px-5 py-2.5 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
          {t.createSourceNext}
        </button>
      </div>
    </div>
  )
}

// ── Source Form Router ──

function SourceFormRouter({ sourceKey, t, onCreated, onClose, onBack }: {
  sourceKey: SourceKey; t: TFn
  onCreated: (aud: { id: string; name: string }) => void
  onClose: () => void; onBack: () => void
}) {
  if (sourceKey === 'website') return <WebsiteAudienceForm t={t} onCreated={onCreated} onClose={onClose} onBack={onBack} />
  if (sourceKey === 'customer_list') return <CustomerListForm t={t} onCreated={onCreated} onClose={onClose} onBack={onBack} />
  if (sourceKey === 'app_activity') return <AppActivityForm t={t} onCreated={onCreated} onClose={onClose} onBack={onBack} />
  if (sourceKey === 'offline_activity') return <OfflineActivityForm t={t} onCreated={onCreated} onClose={onClose} onBack={onBack} />
  if (sourceKey === 'catalog') return <CatalogForm t={t} onCreated={onCreated} onClose={onClose} onBack={onBack} />
  if (sourceKey === 'shopping') return <ShoppingForm t={t} onCreated={onCreated} onClose={onClose} onBack={onBack} />
  if (sourceKey === 'fb_listings') return <FbListingsForm t={t} onCreated={onCreated} onClose={onClose} onBack={onBack} />

  // Engagement-based sources (FB Page, IG, Video, Lead Form, Events, Instant Experience)
  const engConfig = SOURCE_TO_ENGAGEMENT[sourceKey]
  if (engConfig) {
    return (
      <EngagementAudienceForm sourceKey={sourceKey} sourceType={engConfig.sourceType}
        events={engConfig.events} t={t} onCreated={onCreated} onClose={onClose} onBack={onBack} />
    )
  }

  return <div className="text-sm text-gray-500">Unknown source: {sourceKey}</div>
}

// ══════════════════════════════════════════════════════════
// ── WEBSITE AUDIENCE FORM (Enhanced: visit type, URL rules, events) ──
// ══════════════════════════════════════════════════════════

function WebsiteAudienceForm({ t, onCreated, onClose, onBack }: {
  t: TFn; onCreated: (aud: { id: string; name: string }) => void; onClose: () => void; onBack: () => void
}) {
  const [name, setName] = useState('')
  const [retentionDays, setRetentionDays] = useState(30)
  const [pixel, setPixel] = useState<{ id: string; name: string } | null>(null)
  const [pixels, setPixels] = useState<{ id: string; name: string }[]>([])
  const [pixelLoading, setPixelLoading] = useState(true)
  const [pixelError, setPixelError] = useState(false)
  const [visitType, setVisitType] = useState<'all' | 'url' | 'event' | 'time_spent'>('all')
  const [urlContains, setUrlContains] = useState('')
  const [eventName, setEventName] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [showExclude, setShowExclude] = useState(false)
  const [excludeEvent, setExcludeEvent] = useState('')

  const WEBSITE_EVENTS = [
    { value: 'Purchase', labelKey: 'appEventPurchase' as const },
    { value: 'AddToCart', labelKey: 'appEventAddToCart' as const },
    { value: 'Lead', labelKey: 'appEventLead' as const },
    { value: 'CompleteRegistration', labelKey: 'appEventCompleteReg' as const },
    { value: 'ViewContent', labelKey: 'catalogInteractionView' as const },
    { value: 'InitiateCheckout', labelKey: 'appEventPurchase' as const },
  ]

  useEffect(() => {
    fetch('/api/meta/audiences/create?check=pixel')
      .then(r => r.json())
      .then(data => {
        if (data.ok && data.pixels?.length > 0) {
          setPixels(data.pixels)
          setPixel(data.pixels[0])
        } else {
          setPixelError(true)
        }
      })
      .catch(() => setPixelError(true))
      .finally(() => setPixelLoading(false))
  }, [])

  const canCreate = name.trim().length > 0 && retentionDays >= 1 && retentionDays <= 180 && pixel && !creating

  const summary = generateSummary(t, {
    sourceKey: 'website', retentionDays, visitType, urlContains, eventName, excludeEvent: showExclude ? excludeEvent : undefined,
  })

  const handleCreate = async () => {
    if (!canCreate) return
    setCreating(true); setError('')
    try {
      const res = await fetch('/api/meta/audiences/create', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'CUSTOM', name: name.trim(), retentionDays,
          pixelId: pixel!.id, visitType, urlContains, eventName,
        }),
      })
      const data = await res.json()
      if (data.ok && data.audience) {
        setSuccess(true)
        setTimeout(() => { onCreated({ id: data.audience.id, name: data.audience.name }); onClose() }, 800)
      } else { setError(data.message || t.createError) }
    } catch { setError(t.createError) }
    finally { setCreating(false) }
  }

  if (success) return <SuccessView t={t} />

  return (
    <div className="space-y-5">
      {/* Pixel selection */}
      <div>
        <FieldLabel>{t.createWebsitePixelLabel}</FieldLabel>
        {pixelLoading ? (
          <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
            <span className="w-4 h-4 border-2 border-gray-300 border-t-primary rounded-full animate-spin" />
            <span className="text-xs text-gray-500">...</span>
          </div>
        ) : pixelError ? (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-lg">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            <span className="text-xs text-red-600">{t.createWebsitePixelNone}</span>
          </div>
        ) : pixels.length > 1 ? (
          <select value={pixel?.id || ''} onChange={e => setPixel(pixels.find(p => p.id === e.target.value) || null)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary">
            {pixels.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        ) : pixel ? (
          <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-100 rounded-lg">
            <Check className="w-4 h-4 text-green-600 shrink-0" />
            <span className="text-xs text-green-700 font-medium">{pixel.name}</span>
            <span className="px-1.5 py-0.5 bg-green-100 text-green-600 rounded text-[10px] font-medium">{t.createWebsitePixelAuto}</span>
          </div>
        ) : null}
      </div>

      {/* Visit Type */}
      <div>
        <FieldLabel>{t.websiteVisitType}</FieldLabel>
        <select value={visitType} onChange={e => setVisitType(e.target.value as typeof visitType)}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary">
          <option value="all">{t.websiteVisitTypeAll}</option>
          <option value="url">{t.websiteVisitTypeUrl}</option>
          <option value="event">{t.websiteVisitTypeEvent}</option>
          <option value="time_spent">{t.websiteVisitTypeTimeSpent}</option>
        </select>
      </div>

      {/* URL Contains (conditional) */}
      {visitType === 'url' && (
        <div>
          <FieldLabel>{t.websiteUrlContains}</FieldLabel>
          <input type="text" value={urlContains} onChange={e => setUrlContains(e.target.value)}
            placeholder={t.audienceUrlFilterPlaceholder}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
        </div>
      )}

      {/* Event Name (conditional) */}
      {visitType === 'event' && (
        <div>
          <FieldLabel>{t.websiteEventName}</FieldLabel>
          <select value={eventName} onChange={e => setEventName(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary">
            <option value="">-- {t.websiteEventName} --</option>
            <option value="Purchase">Purchase</option>
            <option value="AddToCart">AddToCart</option>
            <option value="Lead">Lead</option>
            <option value="CompleteRegistration">CompleteRegistration</option>
            <option value="ViewContent">ViewContent</option>
            <option value="InitiateCheckout">InitiateCheckout</option>
            <option value="AddPaymentInfo">AddPaymentInfo</option>
            <option value="Search">Search</option>
          </select>
        </div>
      )}

      {/* Name */}
      <div>
        <FieldLabel>{t.createWebsiteName}</FieldLabel>
        <input type="text" value={name} onChange={e => setName(e.target.value)}
          placeholder={t.createWebsiteNamePlaceholder}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
      </div>

      {/* Retention */}
      <RetentionSlider value={retentionDays} onChange={setRetentionDays} max={180} t={t} />

      {/* Include/Exclude */}
      <IncludeExcludeBuilder t={t} events={WEBSITE_EVENTS}
        excludeEvent={excludeEvent} onExcludeEventChange={setExcludeEvent}
        showExclude={showExclude} onToggleExclude={() => setShowExclude(v => !v)} />

      {/* Summary */}
      <AudienceSummaryBox t={t} summary={summary} />

      <ErrorBanner error={error} />
      <FormActions t={t} onBack={onBack} onCreate={handleCreate} canCreate={!!canCreate} creating={creating} />
    </div>
  )
}

// ══════════════════════════════════════════════════════════
// ── CUSTOMER LIST FORM (Enhanced: multi-field schema, file upload, file source) ──
// ══════════════════════════════════════════════════════════

function CustomerListForm({ t, onCreated, onClose, onBack }: {
  t: TFn; onCreated: (aud: { id: string; name: string }) => void; onClose: () => void; onBack: () => void
}) {
  const [name, setName] = useState('')
  const [schemaFields, setSchemaFields] = useState<string[]>(['EMAIL'])
  const [rawData, setRawData] = useState('')
  const [customerFileSource, setCustomerFileSource] = useState('USER_PROVIDED_ONLY')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const SCHEMA_OPTIONS: { key: string; labelKey: string }[] = [
    { key: 'EMAIL', labelKey: 'customerListSchemaEmail' },
    { key: 'PHONE', labelKey: 'customerListSchemaPhone' },
    { key: 'FN', labelKey: 'customerListSchemaFn' },
    { key: 'LN', labelKey: 'customerListSchemaLn' },
    { key: 'DOBY', labelKey: 'customerListSchemaDob' },
    { key: 'COUNTRY', labelKey: 'customerListSchemaCountry' },
    { key: 'CT', labelKey: 'customerListSchemaCity' },
    { key: 'ZIP', labelKey: 'customerListSchemaZip' },
  ]

  const toggleSchema = (key: string) => {
    setSchemaFields(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    )
  }

  const lines = rawData.split('\n').map(l => l.trim()).filter(Boolean)
  const canCreate = name.trim() && lines.length > 0 && schemaFields.length > 0 && !creating

  // Handle CSV file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      if (text) setRawData(text)
    }
    reader.readAsText(file)
  }

  const handleCreate = async () => {
    if (!canCreate) return
    setCreating(true); setError('')
    try {
      // SHA-256 hash each value per row
      const hashedData: string[][] = []
      for (const line of lines) {
        const values = line.split(',').map(v => v.trim())
        const hashedRow: string[] = []
        for (let i = 0; i < schemaFields.length; i++) {
          const val = values[i] || ''
          const normalized = schemaFields[i] === 'EMAIL' ? val.toLowerCase().trim()
            : schemaFields[i] === 'PHONE' ? val.replace(/\D/g, '')
            : val.toLowerCase().trim()
          const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalized))
          hashedRow.push(Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join(''))
        }
        hashedData.push(hashedRow)
      }

      const res = await fetch('/api/meta/audiences/create', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'CUSTOMER_LIST', name: name.trim(),
          schema: schemaFields, data: hashedData, customerFileSource,
        }),
      })
      const data = await res.json()
      if (data.ok && data.audience) {
        setSuccess(true)
        setTimeout(() => { onCreated({ id: data.audience.id, name: data.audience.name }); onClose() }, 800)
      } else { setError(data.message || t.createError) }
    } catch { setError(t.createError) }
    finally { setCreating(false) }
  }

  if (success) return <SuccessView t={t} />

  return (
    <div className="space-y-5">
      <p className="text-xs text-gray-500">{t.customerListDesc}</p>
      <NameField value={name} onChange={setName} t={t} />

      {/* Schema fields multi-select */}
      <div>
        <FieldLabel>{t.customerListSchemaLabel}</FieldLabel>
        <div className="flex flex-wrap gap-2">
          {SCHEMA_OPTIONS.map(opt => (
            <button key={opt.key} type="button" onClick={() => toggleSchema(opt.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                schemaFields.includes(opt.key)
                  ? 'bg-primary/10 text-primary border border-primary/30'
                  : 'bg-white text-gray-500 border border-gray-300 hover:border-gray-400'
              }`}>
              {(t as Record<string, string>)[opt.labelKey] || opt.key}
            </button>
          ))}
        </div>
        <p className="mt-1 text-[11px] text-gray-400">
          {schemaFields.length > 1
            ? `CSV formatı: ${schemaFields.join(', ')} (virgülle ayrılmış)`
            : `Her satıra bir ${(t as Record<string, string>)[SCHEMA_OPTIONS.find(o => o.key === schemaFields[0])?.labelKey || ''] || 'değer'}`
          }
        </p>
      </div>

      {/* Customer file source */}
      <div>
        <FieldLabel>{t.customerListFileSource}</FieldLabel>
        <select value={customerFileSource} onChange={e => setCustomerFileSource(e.target.value)}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary">
          <option value="USER_PROVIDED_ONLY">{t.customerListFileSourceUser}</option>
          <option value="PARTNER_PROVIDED_ONLY">{t.customerListFileSourcePartner}</option>
          <option value="BOTH_USER_AND_PARTNER_PROVIDED">{t.customerListFileSourceBoth}</option>
        </select>
      </div>

      {/* File upload */}
      <div>
        <FieldLabel>{t.customerListFileUpload}</FieldLabel>
        <input type="file" accept=".csv,.txt" onChange={handleFileUpload}
          className="w-full text-sm text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary/10 file:text-primary hover:file:bg-primary/20 transition-all" />
      </div>

      {/* Data input */}
      <div>
        <FieldLabel>
          {t.customerListDataLabel} {t.customerListOrPaste}
          {lines.length > 0 && (
            <span className="ml-2 text-primary font-normal">({lines.length} {t.customerListDataCount})</span>
          )}
        </FieldLabel>
        <textarea value={rawData} onChange={e => setRawData(e.target.value)}
          placeholder={t.customerListDataPlaceholder} rows={6}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none" />
      </div>

      {/* Summary */}
      <AudienceSummaryBox t={t} summary={generateSummary(t, { sourceKey: 'customer_list', retentionDays: 0, recordCount: lines.length })} />

      <ErrorBanner error={error} />
      <FormActions t={t} onBack={onBack} onCreate={handleCreate} canCreate={!!canCreate} creating={creating} />
    </div>
  )
}

// ══════════════════════════════════════════════════════════
// ── APP ACTIVITY FORM ──
// ══════════════════════════════════════════════════════════

function AppActivityForm({ t, onCreated, onClose, onBack }: {
  t: TFn; onCreated: (aud: { id: string; name: string }) => void; onClose: () => void; onBack: () => void
}) {
  const [apps, setApps] = useState<{ id: string; name: string }[]>([])
  const [appsLoading, setAppsLoading] = useState(true)
  const [selectedAppId, setSelectedAppId] = useState('')
  const [appEvent, setAppEvent] = useState('all')
  const [retentionDays, setRetentionDays] = useState(30)
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
  const [showExclude, setShowExclude] = useState(false)
  const [excludeEvent, setExcludeEvent] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    fetch('/api/meta/apps').then(r => r.json())
      .then(data => { if (data.ok && data.data) setApps(data.data) })
      .catch(() => {})
      .finally(() => setAppsLoading(false))
  }, [])

  const APP_EVENTS = [
    { value: 'all', labelKey: 'appEventAll' },
    { value: 'MOBILE_APP_INSTALL', labelKey: 'appEventInstall' },
    { value: 'fb_mobile_purchase', labelKey: 'appEventPurchase' },
    { value: 'fb_mobile_add_to_cart', labelKey: 'appEventAddToCart' },
    { value: 'fb_mobile_lead', labelKey: 'appEventLead' },
    { value: 'fb_mobile_complete_registration', labelKey: 'appEventCompleteReg' },
    { value: 'fb_mobile_level_achieved', labelKey: 'appEventAchieveLevel' },
  ]

  const canCreate = selectedAppId && name.trim() && !creating

  const handleCreate = async () => {
    if (!canCreate) return
    setCreating(true); setError('')
    try {
      const res = await fetch('/api/meta/audiences/create', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'APP', name: name.trim(), appId: selectedAppId,
          appEvent: appEvent === 'all' ? undefined : appEvent, retentionDays,
        }),
      })
      const data = await res.json()
      if (data.ok && data.audience) {
        setSuccess(true)
        setTimeout(() => { onCreated({ id: data.audience.id, name: data.audience.name }); onClose() }, 800)
      } else { setError(data.message || t.createError) }
    } catch { setError(t.createError) }
    finally { setCreating(false) }
  }

  if (success) return <SuccessView t={t} />

  return (
    <div className="space-y-5">
      <p className="text-xs text-gray-500">{t.appActivityDesc}</p>
      <SelectField value={selectedAppId} onChange={setSelectedAppId}
        label={t.appSelectApp} placeholder={t.appSelectApp}
        items={apps} loading={appsLoading} emptyText={t.appNoApps} />

      {selectedAppId && (
        <>
          <div>
            <FieldLabel>{t.appEventLabel}</FieldLabel>
            <select value={appEvent} onChange={e => setAppEvent(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary">
              {APP_EVENTS.map(ev => (
                <option key={ev.value} value={ev.value}>
                  {(t as Record<string, string>)[ev.labelKey] || ev.value}
                </option>
              ))}
            </select>
          </div>
          <RetentionSlider value={retentionDays} onChange={setRetentionDays} max={180} t={t} />
          <NameField value={name} onChange={setName} t={t} />
          {/* Include/Exclude */}
          <IncludeExcludeBuilder t={t} events={APP_EVENTS.filter(e => e.value !== 'all')}
            excludeEvent={excludeEvent} onExcludeEventChange={setExcludeEvent}
            showExclude={showExclude} onToggleExclude={() => setShowExclude(v => !v)} />
        </>
      )}

      {/* Summary */}
      {selectedAppId && (
        <AudienceSummaryBox t={t} summary={generateSummary(t, {
          sourceKey: 'app_activity', retentionDays, appEvent, excludeEvent: showExclude ? excludeEvent : undefined,
        })} />
      )}

      <ErrorBanner error={error} />
      <FormActions t={t} onBack={onBack} onCreate={handleCreate} canCreate={!!canCreate} creating={creating} />
    </div>
  )
}

// ══════════════════════════════════════════════════════════
// ── OFFLINE ACTIVITY FORM ──
// ══════════════════════════════════════════════════════════

function OfflineActivityForm({ t, onCreated, onClose, onBack }: {
  t: TFn; onCreated: (aud: { id: string; name: string }) => void; onClose: () => void; onBack: () => void
}) {
  const [eventSets, setEventSets] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSetId, setSelectedSetId] = useState('')
  const [offlineEvent, setOfflineEvent] = useState('all')
  const [retentionDays, setRetentionDays] = useState(30)
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    fetch('/api/meta/offline-event-sets').then(r => r.json())
      .then(data => { if (data.ok && data.data) setEventSets(data.data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const OFFLINE_EVENTS = [
    { value: 'all', labelKey: 'offlineEventAll' },
    { value: 'Purchase', labelKey: 'offlineEventPurchase' },
    { value: 'Lead', labelKey: 'offlineEventLead' },
    { value: 'Other', labelKey: 'offlineEventOther' },
  ]

  const canCreate = selectedSetId && name.trim() && !creating

  const handleCreate = async () => {
    if (!canCreate) return
    setCreating(true); setError('')
    try {
      const res = await fetch('/api/meta/audiences/create', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'OFFLINE', name: name.trim(), eventSetId: selectedSetId,
          offlineEvent: offlineEvent === 'all' ? undefined : offlineEvent, retentionDays,
        }),
      })
      const data = await res.json()
      if (data.ok && data.audience) {
        setSuccess(true)
        setTimeout(() => { onCreated({ id: data.audience.id, name: data.audience.name }); onClose() }, 800)
      } else { setError(data.message || t.createError) }
    } catch { setError(t.createError) }
    finally { setCreating(false) }
  }

  if (success) return <SuccessView t={t} />

  return (
    <div className="space-y-5">
      <p className="text-xs text-gray-500">{t.offlineActivityDesc}</p>
      <SelectField value={selectedSetId} onChange={setSelectedSetId}
        label={t.offlineSelectEventSet} placeholder={t.offlineSelectEventSet}
        items={eventSets} loading={loading} emptyText={t.offlineNoEventSets} />

      {selectedSetId && (
        <>
          <div>
            <FieldLabel>{t.offlineEventType}</FieldLabel>
            <select value={offlineEvent} onChange={e => setOfflineEvent(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary">
              {OFFLINE_EVENTS.map(ev => (
                <option key={ev.value} value={ev.value}>
                  {(t as Record<string, string>)[ev.labelKey] || ev.value}
                </option>
              ))}
            </select>
          </div>
          <RetentionSlider value={retentionDays} onChange={setRetentionDays} max={180} t={t} />
          <NameField value={name} onChange={setName} t={t} />
        </>
      )}

      {/* Summary */}
      {selectedSetId && (
        <AudienceSummaryBox t={t} summary={generateSummary(t, {
          sourceKey: 'offline_activity', retentionDays, offlineEvent,
        })} />
      )}

      <ErrorBanner error={error} />
      <FormActions t={t} onBack={onBack} onCreate={handleCreate} canCreate={!!canCreate} creating={creating} />
    </div>
  )
}

// ══════════════════════════════════════════════════════════
// ── CATALOG FORM ──
// ══════════════════════════════════════════════════════════

function CatalogForm({ t, onCreated, onClose, onBack }: {
  t: TFn; onCreated: (aud: { id: string; name: string }) => void; onClose: () => void; onBack: () => void
}) {
  const [catalogs, setCatalogs] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCatalogId, setSelectedCatalogId] = useState('')
  const [interaction, setInteraction] = useState('ViewContent')
  const [retentionDays, setRetentionDays] = useState(30)
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [showExclude, setShowExclude] = useState(false)
  const [excludeEvent, setExcludeEvent] = useState('')

  useEffect(() => {
    fetch('/api/meta/audiences/sources').then(r => r.json())
      .then(data => {
        if (data.ok) {
          const cats = [...(data.valueBased || []), ...(data.other || [])]
            .filter((s: { type: string }) => s.type === 'catalog')
            .map((s: { id: string; name: string }) => ({ id: s.id, name: s.name }))
          setCatalogs(cats)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const INTERACTIONS = [
    { value: 'ViewContent', labelKey: 'catalogInteractionView' },
    { value: 'AddToCart', labelKey: 'catalogInteractionAddToCart' },
    { value: 'Purchase', labelKey: 'catalogInteractionPurchase' },
    { value: 'AddToWishlist', labelKey: 'catalogInteractionWishlist' },
  ]

  const canCreate = selectedCatalogId && name.trim() && !creating

  const handleCreate = async () => {
    if (!canCreate) return
    setCreating(true); setError('')
    try {
      const res = await fetch('/api/meta/audiences/create', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'CATALOG', name: name.trim(), catalogId: selectedCatalogId,
          productInteraction: interaction, retentionDays,
        }),
      })
      const data = await res.json()
      if (data.ok && data.audience) {
        setSuccess(true)
        setTimeout(() => { onCreated({ id: data.audience.id, name: data.audience.name }); onClose() }, 800)
      } else { setError(data.message || t.createError) }
    } catch { setError(t.createError) }
    finally { setCreating(false) }
  }

  if (success) return <SuccessView t={t} />

  const selectedCatalogName = catalogs.find(c => c.id === selectedCatalogId)?.name

  return (
    <div className="space-y-5">
      <p className="text-xs text-gray-500">{t.catalogDesc}</p>
      <CapabilityGate t={t} items={catalogs} loading={loading}>
        <SelectField value={selectedCatalogId} onChange={setSelectedCatalogId}
          label={t.catalogSelectCatalog} placeholder={t.catalogSelectCatalog}
          items={catalogs} loading={false} emptyText={t.catalogNoCatalogs} />

        {selectedCatalogId && (
          <>
            <div>
              <FieldLabel>{t.catalogInteraction}</FieldLabel>
              <select value={interaction} onChange={e => setInteraction(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary">
                {INTERACTIONS.map(it => (
                  <option key={it.value} value={it.value}>
                    {(t as Record<string, string>)[it.labelKey] || it.value}
                  </option>
                ))}
              </select>
            </div>
            <RetentionSlider value={retentionDays} onChange={setRetentionDays} max={180} t={t} />
            <NameField value={name} onChange={setName} t={t} />
            {/* Include/Exclude */}
            <IncludeExcludeBuilder t={t} events={INTERACTIONS}
              excludeEvent={excludeEvent} onExcludeEventChange={setExcludeEvent}
              showExclude={showExclude} onToggleExclude={() => setShowExclude(v => !v)} />
          </>
        )}

        {/* Summary */}
        {selectedCatalogId && (
          <AudienceSummaryBox t={t} summary={generateSummary(t, {
            sourceKey: 'catalog', retentionDays, catalogName: selectedCatalogName,
            excludeEvent: showExclude ? excludeEvent : undefined,
          })} />
        )}
      </CapabilityGate>

      <ErrorBanner error={error} />
      <FormActions t={t} onBack={onBack} onCreate={handleCreate} canCreate={!!canCreate} creating={creating} />
    </div>
  )
}

// ══════════════════════════════════════════════════════════
// ── SHOPPING FORM ──
// ══════════════════════════════════════════════════════════

function ShoppingForm({ t, onCreated, onClose, onBack }: {
  t: TFn; onCreated: (aud: { id: string; name: string }) => void; onClose: () => void; onBack: () => void
}) {
  // Shopping uses the same catalog-based infrastructure
  const [catalogs, setCatalogs] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCatalogId, setSelectedCatalogId] = useState('')
  const [interaction, setInteraction] = useState('ViewContent')
  const [retentionDays, setRetentionDays] = useState(30)
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    fetch('/api/meta/audiences/sources').then(r => r.json())
      .then(data => {
        if (data.ok) {
          const cats = [...(data.valueBased || []), ...(data.other || [])]
            .filter((s: { type: string }) => s.type === 'catalog')
            .map((s: { id: string; name: string }) => ({ id: s.id, name: s.name }))
          setCatalogs(cats)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const INTERACTIONS = [
    { value: 'ViewContent', labelKey: 'shoppingInteractionView' },
    { value: 'AddToWishlist', labelKey: 'shoppingInteractionSave' },
    { value: 'AddToCart', labelKey: 'shoppingInteractionAddToCart' },
    { value: 'Purchase', labelKey: 'shoppingInteractionPurchase' },
  ]

  const canCreate = selectedCatalogId && name.trim() && !creating

  const handleCreate = async () => {
    if (!canCreate) return
    setCreating(true); setError('')
    try {
      const res = await fetch('/api/meta/audiences/create', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'CATALOG', name: name.trim(), catalogId: selectedCatalogId,
          productInteraction: interaction, retentionDays,
        }),
      })
      const data = await res.json()
      if (data.ok && data.audience) {
        setSuccess(true)
        setTimeout(() => { onCreated({ id: data.audience.id, name: data.audience.name }); onClose() }, 800)
      } else { setError(data.message || t.createError) }
    } catch { setError(t.createError) }
    finally { setCreating(false) }
  }

  if (success) return <SuccessView t={t} />

  const selectedCatalogName = catalogs.find(c => c.id === selectedCatalogId)?.name

  return (
    <div className="space-y-5">
      <p className="text-xs text-gray-500">{t.shoppingDesc}</p>
      <CapabilityGate t={t} items={catalogs} loading={loading}>
        <SelectField value={selectedCatalogId} onChange={setSelectedCatalogId}
          label={t.shoppingSelectShop} placeholder={t.shoppingSelectShop}
          items={catalogs} loading={false} emptyText={t.shoppingNoShops} />

        {selectedCatalogId && (
          <>
            <div>
              <FieldLabel>{t.shoppingInteraction}</FieldLabel>
              <select value={interaction} onChange={e => setInteraction(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary">
                {INTERACTIONS.map(it => (
                  <option key={it.value} value={it.value}>
                    {(t as Record<string, string>)[it.labelKey] || it.value}
                  </option>
                ))}
              </select>
            </div>
            <RetentionSlider value={retentionDays} onChange={setRetentionDays} max={180} t={t} />
            <NameField value={name} onChange={setName} t={t} />
          </>
        )}

        {/* Summary */}
        {selectedCatalogId && (
          <AudienceSummaryBox t={t} summary={generateSummary(t, {
            sourceKey: 'shopping', retentionDays, catalogName: selectedCatalogName,
          })} />
        )}
      </CapabilityGate>

      <ErrorBanner error={error} />
      <FormActions t={t} onBack={onBack} onCreate={handleCreate} canCreate={!!canCreate} creating={creating} />
    </div>
  )
}

// ══════════════════════════════════════════════════════════
// ── FB LISTINGS FORM ──
// ══════════════════════════════════════════════════════════

function FbListingsForm({ t, onCreated, onClose, onBack }: {
  t: TFn; onCreated: (aud: { id: string; name: string }) => void; onClose: () => void; onBack: () => void
}) {
  const [pages, setPages] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPageId, setSelectedPageId] = useState('')
  const [listingSource, setListingSource] = useState('marketplace')
  const [interaction, setInteraction] = useState('listing_viewed')
  const [retentionDays, setRetentionDays] = useState(30)
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    fetch('/api/meta/pages').then(r => r.json())
      .then(data => { if (data.ok && data.data) setPages(data.data.map((p: { id: string; name: string }) => ({ id: p.id, name: p.name }))) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const canCreate = selectedPageId && name.trim() && !creating

  const handleCreate = async () => {
    if (!canCreate) return
    setCreating(true); setError('')
    try {
      // FB Listings use engagement-type rule with page as source
      const eventValue = listingSource === 'vehicle'
        ? `vehicle_${interaction}` : interaction
      const res = await fetch('/api/meta/audiences/create', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'ENGAGEMENT', name: name.trim(),
          sourceType: 'page', sourceId: selectedPageId,
          event: eventValue, retentionDays,
        }),
      })
      const data = await res.json()
      if (data.ok && data.audience) {
        setSuccess(true)
        setTimeout(() => { onCreated({ id: data.audience.id, name: data.audience.name }); onClose() }, 800)
      } else { setError(data.message || t.createError) }
    } catch { setError(t.createError) }
    finally { setCreating(false) }
  }

  if (success) return <SuccessView t={t} />

  return (
    <div className="space-y-5">
      <p className="text-xs text-gray-500">{t.fbListingsDesc}</p>
      <CapabilityGate t={t} items={pages} loading={loading}>
        <SelectField value={selectedPageId} onChange={setSelectedPageId}
          label={t.engagementSelectAsset} placeholder={t.engagementSelectAsset}
          items={pages} loading={false} emptyText={t.engagementNoAssets} />

        {selectedPageId && (
          <>
            <div>
              <FieldLabel>{t.fbListingsSource}</FieldLabel>
              <div className="flex gap-2">
                {[
                  { value: 'marketplace', label: t.fbListingsSourceMarketplace },
                  { value: 'vehicle', label: t.fbListingsSourceVehicle },
                ].map(opt => (
                  <button key={opt.value} type="button" onClick={() => setListingSource(opt.value)}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      listingSource === opt.value
                        ? 'bg-primary/10 text-primary border border-primary/30'
                        : 'bg-white text-gray-600 border border-gray-300 hover:border-gray-400'
                    }`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <FieldLabel>{t.fbListingsInteraction}</FieldLabel>
              <select value={interaction} onChange={e => setInteraction(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary">
                <option value="listing_viewed">{t.fbListingsInteractionView}</option>
                <option value="listing_messaged">{t.fbListingsInteractionMessage}</option>
                <option value="listing_saved">{t.fbListingsInteractionSave}</option>
              </select>
            </div>
            <RetentionSlider value={retentionDays} onChange={setRetentionDays} max={365} t={t} />
            <NameField value={name} onChange={setName} t={t} />
          </>
        )}

        {/* Summary */}
        {selectedPageId && (
          <AudienceSummaryBox t={t} summary={generateSummary(t, {
            sourceKey: 'fb_listings', retentionDays,
          })} />
        )}
      </CapabilityGate>

      <ErrorBanner error={error} />
      <FormActions t={t} onBack={onBack} onCreate={handleCreate} canCreate={!!canCreate} creating={creating} />
    </div>
  )
}

// ══════════════════════════════════════════════════════════
// ── ENGAGEMENT AUDIENCE FORM (FB Page, IG, Video, Lead Form, Events, Instant Experience) ──
// ══════════════════════════════════════════════════════════

function EngagementAudienceForm({ sourceKey, sourceType, events, t, onCreated, onClose, onBack }: {
  sourceKey: string; sourceType: string; events: { value: string; labelKey: string }[]
  t: TFn; onCreated: (aud: { id: string; name: string }) => void; onClose: () => void; onBack: () => void
}) {
  const [assets, setAssets] = useState<{ id: string; name: string; igId?: string; igUsername?: string }[]>([])
  const [assetsLoading, setAssetsLoading] = useState(true)
  const [selectedAssetId, setSelectedAssetId] = useState('')
  const [selectedEvent, setSelectedEvent] = useState(events[0]?.value || '')
  const [retentionDays, setRetentionDays] = useState(30)
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  // Sub-assets for certain sources
  const [subAssets, setSubAssets] = useState<{ id: string; name: string }[]>([])
  const [subAssetsLoading, setSubAssetsLoading] = useState(false)
  const [selectedSubAssetId, setSelectedSubAssetId] = useState('')

  // Lead form sub-select
  const [leadForms, setLeadForms] = useState<{ id: string; name: string }[]>([])
  const [leadFormsLoading, setLeadFormsLoading] = useState(false)
  const [selectedFormId, setSelectedFormId] = useState('')
  const [showExclude, setShowExclude] = useState(false)
  const [excludeEvent, setExcludeEvent] = useState('')

  const supportsExclude = SOURCES_WITH_EXCLUDE.includes(sourceKey as SourceKey)

  // Fetch assets on mount
  useEffect(() => {
    async function load() {
      setAssetsLoading(true)
      try {
        if (sourceKey === 'instagram_account') {
          const res = await fetch('/api/meta/pages')
          const data = await res.json()
          if (data.ok && data.data) {
            const igAssets: typeof assets = []
            for (const page of data.data) {
              if (page.instagram_business_account) {
                igAssets.push({
                  id: page.id, name: page.instagram_business_account.username || page.name,
                  igId: page.instagram_business_account.id,
                  igUsername: page.instagram_business_account.username,
                })
              }
            }
            setAssets(igAssets)
          }
        } else if (sourceKey === 'video') {
          // First get pages, then load videos from selected page
          const res = await fetch('/api/meta/pages')
          const data = await res.json()
          if (data.ok && data.data) {
            setAssets(data.data.map((p: { id: string; name: string }) => ({ id: p.id, name: p.name })))
          }
        } else if (sourceKey === 'events') {
          // Load pages, then events per page
          const res = await fetch('/api/meta/pages')
          const data = await res.json()
          if (data.ok && data.data) {
            setAssets(data.data.map((p: { id: string; name: string }) => ({ id: p.id, name: p.name })))
          }
        } else if (sourceKey === 'instant_experience') {
          const res = await fetch('/api/meta/pages')
          const data = await res.json()
          if (data.ok && data.data) {
            setAssets(data.data.map((p: { id: string; name: string }) => ({ id: p.id, name: p.name })))
          }
        } else {
          const res = await fetch('/api/meta/pages')
          const data = await res.json()
          if (data.ok && data.data) {
            setAssets(data.data.map((p: { id: string; name: string }) => ({ id: p.id, name: p.name })))
          }
        }
      } catch { /* silent */ }
      finally { setAssetsLoading(false) }
    }
    load()
  }, [sourceKey])

  // Load sub-assets when page is selected (for video, events, instant_experience)
  useEffect(() => {
    if (!selectedAssetId) { setSubAssets([]); return }

    if (sourceKey === 'video') {
      setSubAssetsLoading(true)
      fetch(`/api/meta/videos?pageId=${selectedAssetId}`).then(r => r.json())
        .then(data => { if (data.ok && data.data) setSubAssets(data.data.map((v: { id: string; title: string }) => ({ id: v.id, name: v.title }))) })
        .catch(() => {})
        .finally(() => setSubAssetsLoading(false))
    } else if (sourceKey === 'events') {
      setSubAssetsLoading(true)
      fetch(`/api/meta/fb-events?pageId=${selectedAssetId}`).then(r => r.json())
        .then(data => { if (data.ok && data.data) setSubAssets(data.data.map((e: { id: string; name: string }) => ({ id: e.id, name: e.name }))) })
        .catch(() => {})
        .finally(() => setSubAssetsLoading(false))
    } else if (sourceKey === 'instant_experience') {
      setSubAssetsLoading(true)
      fetch(`/api/meta/instant-experiences?pageId=${selectedAssetId}`).then(r => r.json())
        .then(data => { if (data.ok && data.data) setSubAssets(data.data.map((ie: { id: string; name: string }) => ({ id: ie.id, name: ie.name }))) })
        .catch(() => {})
        .finally(() => setSubAssetsLoading(false))
    }
  }, [sourceKey, selectedAssetId])

  // Lead form sub-select
  useEffect(() => {
    if (sourceKey !== 'lead_form' || !selectedAssetId) return
    setLeadFormsLoading(true)
    fetch(`/api/meta/lead-forms?pageId=${selectedAssetId}`).then(r => r.json())
      .then(data => { if (data.ok && data.data) setLeadForms(data.data.map((f: { id: string; name: string }) => ({ id: f.id, name: f.name }))) })
      .catch(() => {})
      .finally(() => setLeadFormsLoading(false))
  }, [sourceKey, selectedAssetId])

  const getSourceId = () => {
    if (sourceKey === 'instagram_account') {
      const asset = assets.find(a => a.id === selectedAssetId)
      return asset?.igId || selectedAssetId
    }
    // For video/events/instant_experience, use sub-asset ID if selected
    if (['video', 'events', 'instant_experience'].includes(sourceKey) && selectedSubAssetId) {
      return selectedSubAssetId
    }
    return selectedAssetId
  }

  const needsSubAsset = ['video', 'events', 'instant_experience'].includes(sourceKey)
  const subAssetLabel =
    sourceKey === 'video' ? t.videoSelectVideo
    : sourceKey === 'events' ? t.eventsSelectEvent
    : t.ieSelectExperience
  const subAssetEmpty =
    sourceKey === 'video' ? t.videoNoVideos
    : sourceKey === 'events' ? t.eventsNoEvents
    : t.ieNoExperiences

  const canCreate = selectedAssetId && selectedEvent && name.trim() && !creating
    && (sourceKey === 'lead_form' ? !!selectedFormId || true : true)

  const handleCreate = async () => {
    if (!canCreate) return
    setCreating(true); setError('')
    try {
      const res = await fetch('/api/meta/audiences/create', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'ENGAGEMENT', name: name.trim(), sourceType,
          sourceId: getSourceId(), event: selectedEvent, retentionDays,
        }),
      })
      const data = await res.json()
      if (data.ok && data.audience) {
        setSuccess(true)
        setTimeout(() => { onCreated({ id: data.audience.id, name: data.audience.name }); onClose() }, 800)
      } else { setError(data.message || t.createError) }
    } catch { setError(t.createError) }
    finally { setCreating(false) }
  }

  if (success) return <SuccessView t={t} />

  return (
    <div className="space-y-5">
      {/* Asset Selection */}
      <SelectField value={selectedAssetId}
        onChange={v => { setSelectedAssetId(v); setSelectedFormId(''); setSelectedSubAssetId('') }}
        label={t.engagementSelectAsset} placeholder={t.engagementSelectAsset}
        items={assets.map(a => ({ id: a.id, name: a.igUsername ? `@${a.igUsername}` : a.name }))}
        loading={assetsLoading} emptyText={t.engagementNoAssets} />

      {/* Sub-asset selection for video / events / instant_experience */}
      {needsSubAsset && selectedAssetId && (
        <SelectField value={selectedSubAssetId} onChange={setSelectedSubAssetId}
          label={subAssetLabel} placeholder={subAssetLabel}
          items={subAssets} loading={subAssetsLoading} emptyText={subAssetEmpty} />
      )}

      {/* Lead Form sub-select */}
      {sourceKey === 'lead_form' && selectedAssetId && (
        <SelectField value={selectedFormId} onChange={setSelectedFormId}
          label="Form" placeholder="Form"
          items={leadForms} loading={leadFormsLoading} emptyText={t.engagementNoAssets} />
      )}

      {/* Event Selection */}
      <div>
        <FieldLabel>{t.engagementSelectEvent}</FieldLabel>
        <select value={selectedEvent} onChange={e => setSelectedEvent(e.target.value)}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary">
          {events.map(ev => (
            <option key={ev.value} value={ev.value}>
              {(t as Record<string, string>)[ev.labelKey] || ev.value}
            </option>
          ))}
        </select>
      </div>

      {/* Retention */}
      <RetentionSlider value={retentionDays} onChange={setRetentionDays}
        max={sourceKey === 'lead_form' ? 90 : 365} t={t} />

      {/* Name */}
      <NameField value={name} onChange={setName} t={t} />

      {/* Include/Exclude (for FB Page and IG) */}
      {supportsExclude && (
        <IncludeExcludeBuilder t={t} events={events}
          excludeEvent={excludeEvent} onExcludeEventChange={setExcludeEvent}
          showExclude={showExclude} onToggleExclude={() => setShowExclude(v => !v)} />
      )}

      {/* Summary */}
      {selectedAssetId && (
        <AudienceSummaryBox t={t} summary={generateSummary(t, {
          sourceKey: sourceKey as SourceKey, retentionDays,
          engagementEvent: selectedEvent, excludeEvent: showExclude ? excludeEvent : undefined,
        })} />
      )}

      <ErrorBanner error={error} />
      <FormActions t={t} onBack={onBack} onCreate={handleCreate} canCreate={!!canCreate} creating={creating} />
    </div>
  )
}

// ══════════════════════════════════════════════════════════
// ── LOOKALIKE AUDIENCE VIEW ──
// ══════════════════════════════════════════════════════════

function LookalikeAudienceView({ t, audiences, onCreated, onClose }: {
  t: TFn; audiences: MetaAudienceResult[]
  onCreated: (aud: { id: string; name: string }) => void; onClose: () => void
}) {
  const [sourceId, setSourceId] = useState('')
  const [sourceName, setSourceName] = useState('')
  const [sourceSearch, setSourceSearch] = useState('')
  const [sourceDropdownOpen, setSourceDropdownOpen] = useState(false)
  const [sourceTab, setSourceTab] = useState<'value' | 'other'>('value')

  const [countrySearch, setCountrySearch] = useState('')
  const [country, setCountry] = useState<{ code: string; name: string } | null>(null)
  const [countryResults, setCountryResults] = useState<{ code: string; name: string }[]>([])
  const [countryLoading, setCountryLoading] = useState(false)
  const countryAbortRef = useRef<AbortController | null>(null)

  const [sizePercent, setSizePercent] = useState(1)
  const [lookalikeCount, setLookalikeCount] = useState(1)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const sourceRef = useRef<HTMLDivElement>(null)
  const { sources, loading: sourcesLoading, fetchSources } = useMetaAudienceSources()

  useEffect(() => { fetchSources() }, [fetchSources])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (sourceRef.current && !sourceRef.current.contains(e.target as Node)) setSourceDropdownOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Country search
  useEffect(() => {
    if (countrySearch.length < 2) { setCountryResults([]); return }
    setCountryLoading(true)
    const timer = setTimeout(async () => {
      countryAbortRef.current?.abort()
      const controller = new AbortController()
      countryAbortRef.current = controller
      try {
        const params = new URLSearchParams({ q: countrySearch, locale: 'tr_TR' })
        const res = await fetch(`/api/meta/targeting/locations?${params}`, { signal: controller.signal })
        if (!controller.signal.aborted) {
          const data = await res.json()
          if (data.ok && data.data) {
            setCountryResults(
              data.data.filter((l: { type: string }) => l.type === 'country')
                .map((l: { country_code: string; name: string }) => ({ code: l.country_code, name: l.name }))
            )
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') setCountryResults([])
      } finally {
        if (!controller.signal.aborted) setCountryLoading(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [countrySearch])

  const filteredValueBased = sourceSearch.length > 0
    ? sources.valueBased.filter(s => s.name.toLowerCase().includes(sourceSearch.toLowerCase()))
    : sources.valueBased
  const filteredOther = sourceSearch.length > 0
    ? sources.other.filter(s => s.name.toLowerCase().includes(sourceSearch.toLowerCase()))
    : sources.other
  const filteredAudiences = sourceSearch.length >= 2
    ? audiences.filter(a => a.name.toLowerCase().includes(sourceSearch.toLowerCase()))
    : []

  // For multiple lookalikes, create one per segment
  const segments = Array.from({ length: lookalikeCount }, (_, i) => ({
    start: Math.round(i * sizePercent / lookalikeCount) / 100,
    end: Math.round((i + 1) * sizePercent / lookalikeCount) / 100,
  }))

  const autoName = sourceName && country
    ? `Lookalike (${country.code}, ${sizePercent}%) - ${sourceName}` : ''

  const canCreate = sourceId && country && sizePercent >= 1 && sizePercent <= 10 && !creating

  const handleCreate = async () => {
    if (!canCreate) return
    setCreating(true); setError('')
    try {
      // Create each lookalike segment as a separate audience
      let lastAudience: { id: string; name: string } | null = null
      for (let i = 0; i < lookalikeCount; i++) {
        const segName = lookalikeCount > 1
          ? `Lookalike (${country!.code}, ${Math.round(segments[i].start * 100)}%-${Math.round(segments[i].end * 100)}%) - ${sourceName}`
          : autoName
        const res = await fetch('/api/meta/audiences/create', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'LOOKALIKE', name: segName,
            sourceAudienceId: sourceId, country: country!.code,
            sizePercent: Math.round(segments[i].end * 100),
          }),
        })
        const data = await res.json()
        if (data.ok && data.audience) {
          lastAudience = { id: data.audience.id, name: data.audience.name }
        } else {
          setError(data.message || t.createError)
          setCreating(false)
          return
        }
      }
      if (lastAudience) {
        setSuccess(true)
        setTimeout(() => { onCreated(lastAudience!); onClose() }, 800)
      }
    } catch { setError(t.createError) }
    finally { setCreating(false) }
  }

  if (success) return <SuccessView t={t} />

  const typeLabel = (type: MetaAudienceSourceItem['type']) =>
    type === 'catalog' ? t.lookalikeTypeCatalog
    : type === 'pixel' ? t.lookalikeTypePixel
    : t.lookalikeTypePage

  const SEGMENT_COLORS = ['#2BB673', '#3B82F6', '#8B5CF6', '#F59E0B', '#EF4444', '#06B6D4']

  return (
    <div className="space-y-6">
      {/* 1. Source Selection */}
      <div>
        <label className="block text-sm font-semibold text-gray-900 mb-1.5">{t.lookalikeSelectSource}</label>

        {sourceId ? (
          <div className="flex items-center gap-2 p-3 bg-primary/5 border border-primary/20 rounded-lg">
            <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
            <span className="text-sm text-gray-800 font-medium">{sourceName}</span>
            <button type="button" onClick={() => { setSourceId(''); setSourceName(''); setSourceSearch('') }}
              className="ml-auto text-gray-400 hover:text-gray-600"><X className="w-3.5 h-3.5" /></button>
          </div>
        ) : (
          <div ref={sourceRef} className="relative">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" value={sourceSearch}
                onChange={e => { setSourceSearch(e.target.value); setSourceDropdownOpen(true) }}
                onFocus={() => setSourceDropdownOpen(true)}
                placeholder={t.lookalikeSourcePlaceholder}
                className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
            </div>

            {sourceDropdownOpen && (
              <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-hidden flex flex-col">
                <div className="flex border-b border-gray-200">
                  <button type="button" onClick={() => setSourceTab('value')}
                    className={`flex-1 py-2 text-xs font-medium transition-colors ${
                      sourceTab === 'value' ? 'text-gray-900 border-b-2 border-gray-900' : 'text-gray-500 hover:text-gray-700'
                    }`}>{t.lookalikeValueBasedTab}</button>
                  <button type="button" onClick={() => setSourceTab('other')}
                    className={`flex-1 py-2 text-xs font-medium transition-colors ${
                      sourceTab === 'other' ? 'text-gray-900 border-b-2 border-gray-900' : 'text-gray-500 hover:text-gray-700'
                    }`}>{t.lookalikeOtherTab}</button>
                </div>

                <div className="overflow-y-auto max-h-48">
                  {sourcesLoading ? (
                    <div className="px-3 py-4 flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-gray-300 border-t-primary rounded-full animate-spin" />
                    </div>
                  ) : (
                    <>
                      {(sourceTab === 'value' ? filteredValueBased : filteredOther).map(s => (
                        <button key={s.id} type="button"
                          onClick={() => { setSourceId(s.id); setSourceName(s.name); setSourceDropdownOpen(false); setSourceSearch('') }}
                          className="w-full text-left px-3 py-2.5 hover:bg-gray-50 transition-colors flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <span className="text-sm text-gray-800 font-medium block truncate">{s.name}</span>
                            {s.sourceCode && <span className="text-[11px] text-gray-400 block">{s.sourceCode}</span>}
                          </div>
                          <span className="text-[11px] text-gray-400 shrink-0">{typeLabel(s.type)}</span>
                        </button>
                      ))}
                      {(sourceTab === 'value' ? filteredValueBased : filteredOther).length === 0 && (
                        <p className="px-3 py-3 text-xs text-gray-400 italic text-center">{t.audienceCustomNoResults}</p>
                      )}
                    </>
                  )}

                  {filteredAudiences.length > 0 && (
                    <>
                      <div className="border-t border-gray-100 mx-3" />
                      {filteredAudiences.map(a => (
                        <button key={a.id} type="button"
                          onClick={() => { setSourceId(a.id); setSourceName(a.name); setSourceDropdownOpen(false); setSourceSearch('') }}
                          className="w-full text-left px-3 py-2.5 hover:bg-gray-50 transition-colors flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                          <span className="text-sm text-gray-800 flex-1 truncate">{a.name}</span>
                          <span className="text-[11px] text-gray-400">{a.type}</span>
                        </button>
                      ))}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 2. Location */}
      <div>
        <label className="block text-sm font-semibold text-gray-900 mb-1.5">{t.lookalikeSelectLocation}</label>
        {country ? (
          <div className="flex items-center gap-2 p-3 bg-primary/5 border border-primary/20 rounded-lg">
            <Check className="w-4 h-4 text-primary shrink-0" />
            <span className="text-sm text-gray-800 font-medium">{country.name}</span>
            <span className="px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded text-[10px] font-medium">{country.code}</span>
            <button type="button" onClick={() => { setCountry(null); setCountrySearch('') }}
              className="ml-auto text-gray-400 hover:text-gray-600"><X className="w-3.5 h-3.5" /></button>
          </div>
        ) : (
          <SearchableSelect value={countrySearch} onChange={setCountrySearch}
            placeholder={t.lookalikeLocationPlaceholder}
            items={countryResults.map(c => ({ id: c.code, name: c.name }))}
            onSelect={(item) => { setCountry({ code: item.id, name: item.name }); setCountrySearch('') }}
            noResultsText={t.audienceDetailedNoResults} loading={countryLoading} />
        )}
      </div>

      {/* 3. Audience Size */}
      <div>
        <label className="block text-sm font-semibold text-gray-900 mb-1.5">{t.lookalikeSelectSize}</label>

        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs text-gray-600">{t.lookalikeCount}</span>
          <Info className="w-3 h-3 text-gray-400" />
          <select value={lookalikeCount}
            onChange={e => { const c = Number(e.target.value); setLookalikeCount(c); if (sizePercent < c) setSizePercent(c) }}
            className="ml-1 px-2 py-1 border border-gray-300 rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20">
            {[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>

        <div className="px-1">
          {lookalikeCount > 1 ? (
            <>
              <div className="relative h-3 bg-gray-100 rounded-full overflow-hidden mb-1">
                {Array.from({ length: lookalikeCount }, (_, i) => {
                  const segWidth = (sizePercent / lookalikeCount) / 10 * 100
                  const left = (i * sizePercent / lookalikeCount) / 10 * 100
                  return (
                    <div key={i} className="absolute top-0 h-full rounded-sm"
                      style={{ left: `${left}%`, width: `${segWidth}%`, backgroundColor: SEGMENT_COLORS[i % SEGMENT_COLORS.length], opacity: 0.8 }} />
                  )
                })}
              </div>
              <input type="range" min={lookalikeCount} max={10} step={1} value={sizePercent}
                onChange={e => setSizePercent(Number(e.target.value))} className="w-full accent-primary" />
              <div className="flex gap-1 mt-1 flex-wrap">
                {Array.from({ length: lookalikeCount }, (_, i) => {
                  const start = Math.round(i * sizePercent / lookalikeCount)
                  const end = Math.round((i + 1) * sizePercent / lookalikeCount)
                  return (
                    <span key={i} className="px-2 py-0.5 rounded text-[10px] font-medium text-white"
                      style={{ backgroundColor: SEGMENT_COLORS[i % SEGMENT_COLORS.length] }}>
                      {start}% – {end}%
                    </span>
                  )
                })}
              </div>
            </>
          ) : (
            <>
              <input type="range" min={1} max={10} step={1} value={sizePercent}
                onChange={e => setSizePercent(Number(e.target.value))} className="w-full accent-primary" />
              <div className="flex justify-between mt-1">
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                  <span key={n} className="text-[9px] text-gray-400">{n}%</span>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="flex items-start gap-2 mt-3 p-3 bg-gray-50 border border-gray-100 rounded-lg">
          <Info className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
          <p className="text-xs text-gray-500">{t.lookalikeSizeInfo}</p>
        </div>
      </div>

      <ErrorBanner error={error} />

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onClose}
          className="px-4 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
          {t.createBtnCancel}
        </button>
        <button type="button" onClick={handleCreate} disabled={!canCreate}
          className="px-5 py-2.5 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
          {creating ? t.createBtnCreating : t.lookalikeSubmit}
        </button>
      </div>
    </div>
  )
}

// ── Reusable SearchableSelect ──

function SearchableSelect({ value, onChange, placeholder, items, onSelect, noResultsText, loading }: {
  value: string; onChange: (v: string) => void; placeholder: string
  items: { id: string; name: string; subtitle?: string }[]
  onSelect: (item: { id: string; name: string }) => void
  noResultsText: string; loading?: boolean
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input type="text" value={value}
          onChange={e => { onChange(e.target.value); setOpen(true) }}
          onFocus={() => { if (value.length > 0 || items.length > 0) setOpen(true) }}
          placeholder={placeholder}
          className="w-full pl-9 pr-8 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
        {loading && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-gray-300 border-t-primary rounded-full animate-spin" />
        )}
      </div>
      {open && (value.length > 0 || items.length > 0) && (
        <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {loading ? (
            <div className="px-3 py-3 flex items-center gap-2">
              <span className="w-3.5 h-3.5 border-2 border-gray-300 border-t-primary rounded-full animate-spin shrink-0" />
              <span className="text-xs text-gray-400">...</span>
            </div>
          ) : items.length > 0 ? (
            items.map(item => (
              <button key={item.id} type="button"
                onClick={() => { onSelect(item); setOpen(false) }}
                className="w-full text-left px-3 py-2 hover:bg-primary/5 transition-colors">
                <span className="text-sm text-gray-700">{item.name}</span>
                {item.subtitle && <span className="block text-[11px] text-gray-400 mt-0.5">{item.subtitle}</span>}
              </button>
            ))
          ) : value.length > 0 ? (
            <p className="px-3 py-2.5 text-xs text-gray-400 italic">{noResultsText}</p>
          ) : null}
        </div>
      )}
    </div>
  )
}
