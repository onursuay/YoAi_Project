'use client'

/**
 * Gözetim Merkezi dashboard — yetkili oturum görür.
 * Sadeleştirilmiş görünüm: KPI + Kullanıcı&Firma listesi + Başvurular paneli.
 */
import { useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  ShieldCheck,
  Users,
  CheckCircle2,
  AlertTriangle,
  Activity,
  RefreshCw,
  Database,
  Sparkles,
  X,
  Search,
} from 'lucide-react'
import SignupApprovalsPanel from '@/components/gozetim/SignupApprovalsPanel'
import WizardSelect from '@/components/meta/wizard/WizardSelect'
import OfficialAdsKnowledgePanel from './OfficialAdsKnowledgePanel'

interface ScanSummary {
  id: string
  source_type: string | null
  source_url: string | null
  source_owner_type: string | null
  competitor_id: string | null
  scan_status: string | null
  provider_used: string | null
  error_message: string | null
  raw_error_message: string | null
  confidence: number | null
  scanned_at: string | null
  extracted_title: string | null
  extracted_description: string | null
  extracted_keywords: string[]
  extracted_services: string[]
}

interface IntelligenceSummary {
  company_summary: string | null
  business_model: string | null
  sector_summary: string | null
  local_market_summary: string | null
  target_audience_summary: string | null
  competitor_summary: string | null
  keyword_themes: string[]
  confidence: number | null
  missing_data: string[]
  updated_at: string | null
  status: string | null
}

interface ProfileEntry {
  user: {
    id: string
    email: string | null
    name: string | null
    status: string | null
    created_at: string | null
  } | null
  profile: any
  competitors: any[]
  sourceScans: any[]
  sourceScansSummary: ScanSummary[]
  intelligence: any
  intelligenceSummary: IntelligenceSummary | null
}

interface OverviewPayload {
  ok: boolean
  kpis: {
    totalUsers: number
    onboardingCompleted: number
    onboardingPending: number
    usersWithoutProfile: number
    totalProfiles: number
    intelligenceMissing: number
    totalScans: number
    failedScans: number
    runningScans: number
    completedScans: number
    avgIntelConfidence: number | null
    signups24h: number
    signups7d: number
    totalCompetitors: number
    totalSources: number
  }
  profiles: ProfileEntry[]
  diagnostics: string[]
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  try {
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return '—'
    return d.toLocaleString('tr-TR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return '—'
  }
}

function scanStatusBadgeClass(status: string | null | undefined): string {
  const s = (status || '').toLowerCase()
  if (s === 'completed' || s === 'success' || s === 'done') {
    return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  }
  if (s === 'failed' || s === 'error') {
    return 'bg-red-50 text-red-700 border-red-200'
  }
  if (s === 'running' || s === 'pending' || s === 'queued') {
    return 'bg-primary/5 text-primary border-primary/20'
  }
  return 'bg-gray-50 text-gray-700 border-gray-200'
}

function KpiCard({
  label,
  value,
  icon: Icon,
  tone = 'gray',
  hint,
}: {
  label: string
  value: string | number
  icon: React.ComponentType<{ className?: string }>
  tone?: 'gray' | 'primary' | 'emerald' | 'red'
  hint?: string
}) {
  const tones: Record<string, string> = {
    gray: 'bg-gray-50 text-gray-700 border-gray-200',
    primary: 'bg-primary/5 text-primary border-primary/20',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    red: 'bg-red-50 text-red-700 border-red-200',
  }
  return (
    <div className={`flex flex-col justify-between rounded-xl border p-4 ${tones[tone]}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide opacity-80">{label}</span>
        <Icon className="h-4 w-4 opacity-80" />
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums">{value}</div>
      {hint && <div className="mt-1 text-xs opacity-70">{hint}</div>}
    </div>
  )
}

export default function GozetimMerkeziClient() {
  const t = useTranslations('gozetim.dashboard')
  const tc = useTranslations('common')
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<OverviewPayload | null>(null)
  const [search, setSearch] = useState<string>('')
  const [filterOnboarding, setFilterOnboarding] = useState<'all' | 'complete' | 'incomplete' | 'no_profile'>('all')
  const [filterScan, setFilterScan] = useState<'all' | 'completed' | 'failed' | 'running' | 'none'>('all')
  const [filterIntel, setFilterIntel] = useState<'all' | 'missing' | 'present'>('all')
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState<number>(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch('/api/admin/gozetim-merkezi', { cache: 'no-store' })
      .then(async (r) => {
        const text = await r.text()
        let parsed: any = null
        try { parsed = text ? JSON.parse(text) : null } catch {}
        if (!r.ok) {
          const detail = parsed?.message || parsed?.error || `HTTP ${r.status}`
          const diag = Array.isArray(parsed?.diagnostics) && parsed.diagnostics.length
            ? ` · ${parsed.diagnostics.join(' · ')}`
            : ''
          throw new Error(`${detail}${diag}`)
        }
        return parsed as OverviewPayload
      })
      .then((json: OverviewPayload) => {
        if (cancelled) return
        if (!json.ok) {
          setError(t('errorLoad'))
          return
        }
        setData(json)
      })
      .catch((e) => {
        if (cancelled) return
        setError(e instanceof Error ? e.message : t('errorLoad'))
      })
      .finally(() => {
        if (cancelled) return
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [reloadKey])

  const filteredProfiles = useMemo(() => {
    if (!data) return [] as ProfileEntry[]
    const q = search.trim().toLowerCase()
    return data.profiles.filter((entry) => {
      if (q) {
        const fields: Array<string | null | undefined> = [
          entry.user?.email,
          entry.user?.name,
          entry.profile?.business_name,
          entry.profile?.company_name,
          entry.profile?.sector_main,
          entry.profile?.sector_sub,
          entry.profile?.target_location,
        ]
        if (!fields.some((f) => (f || '').toLowerCase().includes(q))) return false
      }
      if (filterOnboarding !== 'all') {
        const hasProfile = !!entry.profile
        const done = !!entry.profile?.onboarding_completed
        if (filterOnboarding === 'no_profile' && hasProfile) return false
        if (filterOnboarding === 'complete' && (!hasProfile || !done)) return false
        if (filterOnboarding === 'incomplete' && (!hasProfile || done)) return false
      }
      if (filterScan !== 'all') {
        const scans = entry.sourceScansSummary || []
        const has = (st: string) => scans.some((s) => (s.scan_status || '').toLowerCase() === st)
        if (filterScan === 'none' && scans.length > 0) return false
        if (filterScan === 'completed' && !(has('completed') || has('success') || has('done'))) return false
        if (filterScan === 'failed' && !(has('failed') || has('error'))) return false
        if (filterScan === 'running' && !(has('running') || has('pending') || has('queued'))) return false
      }
      if (filterIntel !== 'all') {
        const hasIntel = !!entry.intelligenceSummary
        if (filterIntel === 'missing' && hasIntel) return false
        if (filterIntel === 'present' && !hasIntel) return false
      }
      return true
    })
  }, [data, search, filterOnboarding, filterScan, filterIntel])

  const selectedEntry = useMemo(() => {
    if (!data || !selectedKey) return null
    return (
      data.profiles.find((p) => (p.profile?.id || `signup:${p.user?.id}`) === selectedKey) || null
    )
  }, [data, selectedKey])

  return (
    <div className="px-6 py-6 max-w-[1400px] mx-auto">
      <header className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">{t('title')}</h1>
            <p className="text-sm text-gray-500">
              {t('subtitle')}
            </p>
          </div>
        </div>
        <button
          onClick={() => setReloadKey((k) => k + 1)}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          {tc('refresh')}
        </button>
      </header>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Resmi Döküman Güncellemeleri — onay bekleyen AI taslakları (Alt-Proje B) */}
      <OfficialAdsKnowledgePanel />

      {/* KPI Kartları — Kullanıcı & Firma */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" data-testid="kpi-section">
        <KpiCard
          label={t('kpi.totalUsers')}
          value={data?.kpis.totalUsers ?? (loading ? '…' : 0)}
          icon={Users}
          tone="gray"
        />
        <KpiCard
          label={t('kpi.onboardingDone')}
          value={data?.kpis.onboardingCompleted ?? (loading ? '…' : 0)}
          icon={CheckCircle2}
          tone="emerald"
        />
        <KpiCard
          label={t('kpi.onboardingMissing')}
          value={data?.kpis.onboardingPending ?? (loading ? '…' : 0)}
          icon={AlertTriangle}
          tone="primary"
        />
        <KpiCard
          label={t('kpi.totalProfiles')}
          value={data?.kpis.totalProfiles ?? (loading ? '…' : 0)}
          icon={Database}
          tone="gray"
        />
        <KpiCard
          label={t('kpi.usersWithoutProfile')}
          value={data?.kpis.usersWithoutProfile ?? (loading ? '…' : 0)}
          icon={Users}
          tone="gray"
        />
        <KpiCard
          label={t('kpi.completedScans')}
          value={data?.kpis.completedScans ?? (loading ? '…' : 0)}
          icon={CheckCircle2}
          tone="emerald"
        />
        <KpiCard
          label={t('kpi.runningScans')}
          value={data?.kpis.runningScans ?? (loading ? '…' : 0)}
          icon={Activity}
          tone="primary"
        />
        <KpiCard
          label={t('kpi.intelligenceMissing')}
          value={data?.kpis.intelligenceMissing ?? (loading ? '…' : 0)}
          icon={AlertTriangle}
          tone="primary"
        />
        <KpiCard
          label={t('kpi.avgConfidence')}
          value={
            data?.kpis.avgIntelConfidence == null
              ? loading ? '…' : '—'
              : `${Math.round((data.kpis.avgIntelConfidence as number) * 100)}%`
          }
          icon={Sparkles}
          tone="gray"
        />
        <KpiCard
          label={t('kpi.signups24h')}
          value={data?.kpis.signups24h ?? (loading ? '…' : 0)}
          icon={Users}
          tone="emerald"
        />
      </section>

      {/* Diagnostic banner */}
      {data && data.diagnostics && data.diagnostics.length > 0 && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
          <div className="font-semibold mb-1">{t('partialDataWarning')}</div>
          <ul className="list-disc pl-5 space-y-0.5">
            {data.diagnostics.map((d, i) => (
              <li key={i} className="break-all">{d}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Kullanıcı & Firma Listesi */}
      <section className="mt-8">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-base font-semibold text-gray-900">{t('userCompanyList')}</h2>
          <div className="flex flex-wrap items-center gap-2">
            <WizardSelect
              value={filterOnboarding}
              onChange={(v) => setFilterOnboarding(v as any)}
              options={[
                { value: 'all', label: t('filterOnboarding.all') },
                { value: 'complete', label: t('filterOnboarding.complete') },
                { value: 'incomplete', label: t('filterOnboarding.incomplete') },
                { value: 'no_profile', label: t('filterOnboarding.noProfile') },
              ]}
              className="w-48"
            />
            <WizardSelect
              value={filterScan}
              onChange={(v) => setFilterScan(v as any)}
              options={[
                { value: 'all', label: t('filterScan.all') },
                { value: 'completed', label: t('filterScan.completed') },
                { value: 'failed', label: t('filterScan.failed') },
                { value: 'running', label: t('filterScan.running') },
                { value: 'none', label: t('filterScan.none') },
              ]}
              className="w-48"
            />
            <WizardSelect
              value={filterIntel}
              onChange={(v) => setFilterIntel(v as any)}
              options={[
                { value: 'all', label: t('filterIntel.all') },
                { value: 'present', label: t('filterIntel.present') },
                { value: 'missing', label: t('filterIntel.missing') },
              ]}
              className="w-48"
            />
            <div className="relative w-72 max-w-full">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('searchPlaceholder')}
                className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-2">{t('table.email')}</th>
                <th className="px-3 py-2">{t('table.company')}</th>
                <th className="px-3 py-2">{t('table.sector')}</th>
                <th className="px-3 py-2">{t('table.location')}</th>
                <th className="px-3 py-2">{t('table.onboarding')}</th>
                <th className="px-3 py-2 text-right">{t('table.source')}</th>
                <th className="px-3 py-2 text-right">{t('table.competitor')}</th>
                <th className="px-3 py-2 text-right">{t('table.conf')}</th>
                <th className="px-3 py-2">{t('table.lastScan')}</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && (
                <tr>
                  <td colSpan={10} className="px-3 py-6 text-center text-gray-400">
                    {tc('loading')}
                  </td>
                </tr>
              )}
              {!loading && filteredProfiles.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-3 py-6 text-center text-gray-400">
                    {t('noRecords')}
                  </td>
                </tr>
              )}
              {!loading &&
                filteredProfiles.map((entry) => {
                  const profile = entry.profile || {}
                  const hasProfile = !!entry.profile
                  const sourceCount = Array.isArray(profile.social_handles)
                    ? profile.social_handles.length
                    : Object.keys(profile.social_handles || {}).length
                  const lastScan = entry.sourceScansSummary
                    .map((s) => s.scanned_at)
                    .filter(Boolean)
                    .sort()
                    .pop()
                  const confidence = entry.intelligenceSummary?.confidence
                  const onboardingDone = hasProfile && !!profile.onboarding_completed
                  const key = profile.id || `signup:${entry.user?.id}`
                  return (
                    <tr key={key} className="hover:bg-gray-50">
                      <td className="px-3 py-2 font-medium text-gray-900">
                        {entry.user?.email || '—'}
                      </td>
                      <td className="px-3 py-2 text-gray-700">
                        {hasProfile ? (profile.business_name || profile.company_name || '—') : (
                          <span className="text-gray-400 italic">{t('noProfile')}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-gray-600">
                        {hasProfile ? (
                          <>
                            {profile.sector_main || '—'}
                            {profile.sector_sub ? ` / ${profile.sector_sub}` : ''}
                          </>
                        ) : '—'}
                      </td>
                      <td className="px-3 py-2 text-gray-600">{(hasProfile && profile.target_location) || '—'}</td>
                      <td className="px-3 py-2">
                        {!hasProfile ? (
                          <span className="inline-flex items-center rounded border px-2 py-0.5 text-xs bg-gray-50 text-gray-700 border-gray-200">
                            {t('noProfile')}
                          </span>
                        ) : (
                          <span
                            className={`inline-flex items-center rounded border px-2 py-0.5 text-xs ${
                              onboardingDone
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-primary/5 text-primary border-primary/20'
                            }`}
                          >
                            {onboardingDone ? t('badgeDone') : t('badgeMissing')}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-gray-700">
                        {hasProfile ? sourceCount : 0}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-gray-700">
                        {entry.competitors.length}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-gray-700">
                        {confidence == null ? '—' : `${Math.round(Number(confidence) * 100)}%`}
                      </td>
                      <td className="px-3 py-2 text-gray-500">{formatDate(lastScan)}</td>
                      <td className="px-3 py-2 text-right">
                        <button
                          onClick={() => setSelectedKey(key)}
                          className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                        >
                          {t('detail')}
                        </button>
                      </td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Başvurular — başvuru yönetim paneli */}
      <SignupApprovalsPanel />

      {/* Detay modal (Kullanıcı & Firma Listesi için) */}
      {selectedEntry && (
        <DetailModal entry={selectedEntry} onClose={() => setSelectedKey(null)} />
      )}
    </div>
  )
}

function DetailModal({
  entry,
  onClose,
}: {
  entry: ProfileEntry
  onClose: () => void
}) {
  const t = useTranslations('gozetim.dashboard')
  const tc = useTranslations('common')
  const profile = entry.profile || {}
  const intel = entry.intelligenceSummary
  const scans = entry.sourceScansSummary

  // Body scroll lock
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-md"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
          <div>
            <div className="text-xs uppercase tracking-wide text-gray-500">
              {t('modalEyebrow')}
            </div>
            <div className="text-base font-semibold text-gray-900">
              {profile.business_name || t('companyFallback')}
              <span className="ml-2 text-sm font-normal text-gray-500">
                {entry.user?.email || ''}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100"
            aria-label={tc('close')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-6 px-6 py-5">
          <Section title={t('detailModal.companyInfo')}>
            <KeyValue k={t('detailModal.businessName')} v={profile.business_name} />
            <KeyValue k={t('detailModal.user')} v={entry.user?.email} />
            <KeyValue k={t('detailModal.website')} v={profile.website} />
            <KeyValue k={t('detailModal.sector')} v={[profile.sector_main, profile.sector_sub].filter(Boolean).join(' / ')} />
            <KeyValue k={t('detailModal.location')} v={profile.target_location} />
            <KeyValue k={t('detailModal.onboarding')} v={profile.onboarding_completed ? t('detailModal.completed') : t('badgeMissing')} />
            <KeyValue k={t('detailModal.brandTone')} v={profile.brand_tone} />
            <KeyValue k={t('detailModal.description')} v={profile.business_description} wide />
            <KeyValue k={t('detailModal.keywords')} vList={toArray(profile.keywords)} />
            <KeyValue k={t('detailModal.prohibitedClaims')} vList={toArray(profile.prohibited_claims)} />
            <KeyValue k={t('detailModal.socialAccounts')} vList={socialList(profile.social_handles)} />
          </Section>

          <Section title={t('detailModal.competitorsCount', { count: entry.competitors.length })}>
            {entry.competitors.length === 0 ? (
              <div className="text-sm text-gray-500">{t('detailModal.noRecord')}</div>
            ) : (
              <ul className="space-y-2">
                {entry.competitors.map((c: any) => (
                  <li key={c.id} className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
                    <div className="font-medium text-gray-800">{c.name || c.url || '—'}</div>
                    {c.url && <div className="text-xs text-gray-500">{c.url}</div>}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title={t('detailModal.sourceScanCount', { count: scans.length })}>
            {scans.length === 0 ? (
              <div className="text-sm text-gray-500">{t('detailModal.noScanRecord')}</div>
            ) : (
              <div className="space-y-3">
                {scans.map((s) => (
                  <div key={s.id} className="rounded-lg border border-gray-200 bg-white p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 flex-col">
                        <div className="truncate text-sm font-medium text-gray-900">
                          {s.source_url || s.source_type || '—'}
                        </div>
                        <div className="text-xs text-gray-500">
                          {s.source_type || '—'}
                          {s.source_owner_type ? ` · ${s.source_owner_type}` : ''}
                          {s.provider_used ? ` · provider: ${s.provider_used}` : ''}
                        </div>
                      </div>
                      <span className={`shrink-0 rounded border px-2 py-0.5 text-xs ${scanStatusBadgeClass(s.scan_status)}`}>
                        {s.scan_status || '—'}
                      </span>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-gray-600">
                      <div>{t('detailModal.dateLabel')}: <span className="text-gray-800">{formatDate(s.scanned_at)}</span></div>
                      <div>{t('detailModal.confidenceLabel')}: <span className="text-gray-800">{s.confidence == null ? '—' : `${Math.round(Number(s.confidence) * 100)}%`}</span></div>
                    </div>
                    {s.error_message && (
                      <div className="mt-2 rounded border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-700">
                        {t('detailModal.errorLabel')}: {s.error_message}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section title={t('detailModal.businessIntelligence')}>
            {!intel ? (
              <div className="text-sm text-gray-500">{t('detailModal.notCreatedYet')}</div>
            ) : (
              <div className="space-y-2">
                <KeyValue k={t('detailModal.status')} v={intel.status} />
                <KeyValue k={t('detailModal.confidenceLabel')} v={intel.confidence == null ? '—' : `${Math.round(Number(intel.confidence) * 100)}%`} />
                <KeyValue k={t('detailModal.updated')} v={formatDate(intel.updated_at)} />
                <KeyValue k={t('detailModal.companySummary')} v={intel.company_summary} wide />
                <KeyValue k={t('detailModal.businessModel')} v={intel.business_model} wide />
                <KeyValue k={t('detailModal.sectorSummary')} v={intel.sector_summary} wide />
                <KeyValue k={t('detailModal.localMarket')} v={intel.local_market_summary} wide />
                <KeyValue k={t('detailModal.targetAudience')} v={intel.target_audience_summary} wide />
                <KeyValue k={t('detailModal.competitorSummary')} v={intel.competitor_summary} wide />
                <KeyValue k={t('detailModal.keywordThemes')} vList={toArray(intel.keyword_themes)} />
                <KeyValue k={t('detailModal.missingData')} vList={toArray(intel.missing_data)} />
              </div>
            )}
          </Section>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</div>
      <div className="rounded-lg border border-gray-200 bg-white p-3">{children}</div>
    </div>
  )
}

function KeyValue({
  k, v, vList, wide,
}: {
  k: string
  v?: string | number | null
  vList?: string[]
  wide?: boolean
}) {
  if (vList) {
    return (
      <div className="flex flex-col gap-1 py-1 sm:flex-row sm:items-start sm:gap-3">
        <div className="w-40 shrink-0 text-xs font-medium text-gray-500">{k}</div>
        <div className="flex flex-wrap gap-1">
          {vList.length === 0 ? (
            <span className="text-xs text-gray-400">—</span>
          ) : (
            vList.map((item, idx) => (
              <span key={idx} className="inline-flex items-center rounded border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs text-gray-700">
                {item}
              </span>
            ))
          )}
        </div>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-1 py-1 sm:flex-row sm:items-start sm:gap-3">
      <div className="w-40 shrink-0 text-xs font-medium text-gray-500">{k}</div>
      <div className="text-sm text-gray-800">
        {v == null || v === '' ? <span className="text-gray-400">—</span> : String(v)}
      </div>
    </div>
  )
}

function toArray(v: any): string[] {
  if (Array.isArray(v)) return v.map(String).filter(Boolean)
  if (typeof v === 'string') {
    try {
      const parsed = JSON.parse(v)
      if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean)
    } catch {}
    return v.split(',').map((s: string) => s.trim()).filter(Boolean)
  }
  return []
}

function socialList(handles: any): string[] {
  if (!handles) return []
  if (Array.isArray(handles)) {
    return handles.map((h) => (typeof h === 'string' ? h : h?.url || h?.handle || '')).filter(Boolean)
  }
  if (typeof handles === 'object') {
    return Object.entries(handles).map(([k, v]) => (v ? `${k}: ${String(v)}` : '')).filter(Boolean)
  }
  return []
}
