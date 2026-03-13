'use client'

import { useState, useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import Topbar from '@/components/Topbar'
import CircularProgress from '@/components/CircularProgress'
import {
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Globe,
  Type,
  Image as ImageIcon,
  Link2,
  Share2,
  Shield,
  Gauge,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Loader2,
  Zap,
  Eye,
  Award,
  Download,
  History,
  Monitor,
  Smartphone,
  FileText,
  Lock,
  Code2,
  Languages,
  ArrowRight,
  Lightbulb,
  Trash2,
  Clock,
  List,
  BarChart3,
  Users,
  Copy,
  Check as CheckIcon,
  Code,
  Wrench,
} from 'lucide-react'
import SeoToolsTab from '@/components/seo/SeoToolsTab'
import SeoArticlesTab from '@/components/seo/SeoArticlesTab'

// ─── Interfaces ───

interface Check {
  id: string
  title: string
  description: string
  status: 'pass' | 'fail' | 'warning'
  value?: string
}

interface Category {
  score: number
  checks: Check[]
}

interface LighthouseAudit {
  id: string
  title: string
  description: string
  score: number | null
  displayValue?: string
}

interface LighthouseResult {
  performance: number
  accessibility: number
  bestPractices: number
  seo: number
  coreWebVitals: {
    fcp: string
    lcp: string
    tbt: string
    cls: string
    si: string
  }
  audits: LighthouseAudit[]
}

interface KeywordInfo {
  word: string
  count: number
  density: number
  inTitle: boolean
  inH1: boolean
  inMetaDesc: boolean
}

interface BrokenLink {
  url: string
  status: number | string
  anchor: string
}

interface RedirectHop {
  url: string
  status: number
}

interface SeoResult {
  url: string
  analyzedAt: string
  overallScore: number
  lighthouse: LighthouseResult | null
  lighthouseDesktop: LighthouseResult | null
  categories: {
    metaTags: Category
    headings: Category
    images: Category
    links: Category
    social: Category
    technical: Category
    performance: Category
    keywords: Category
    content: Category
    security: Category
    schemaDetail: Category
    hreflang: Category
  }
  topKeywords: KeywordInfo[]
  brokenLinks: BrokenLink[]
  redirectChain: RedirectHop[]
  recommendations: Recommendation[]
}

interface Recommendation {
  id: string
  text: string
  code?: string
  language?: string
  guide?: string
}

interface HistoryItem {
  url: string
  date: string
  score: number
}

// ─── Category Config ───

const categoryConfig: Record<string, { icon: typeof Search; label: string; labelEn: string }> = {
  metaTags: { icon: Type, label: 'Meta Etiketleri', labelEn: 'Meta Tags' },
  headings: { icon: Type, label: 'Başlık Yapısı', labelEn: 'Headings' },
  images: { icon: ImageIcon, label: 'Görseller', labelEn: 'Images' },
  links: { icon: Link2, label: 'Linkler', labelEn: 'Links' },
  social: { icon: Share2, label: 'Sosyal Medya', labelEn: 'Social Media' },
  technical: { icon: Shield, label: 'Teknik SEO', labelEn: 'Technical SEO' },
  performance: { icon: Gauge, label: 'Performans', labelEn: 'Performance' },
  keywords: { icon: Search, label: 'Anahtar Kelimeler', labelEn: 'Keywords' },
  content: { icon: FileText, label: 'İçerik Analizi', labelEn: 'Content Analysis' },
  security: { icon: Lock, label: 'Güvenlik Başlıkları', labelEn: 'Security Headers' },
  schemaDetail: { icon: Code2, label: 'Schema Markup', labelEn: 'Schema Markup' },
  hreflang: { icon: Languages, label: 'Hreflang', labelEn: 'Hreflang' },
}

// ─── Helpers ───

function getScoreColor(score: number): string {
  if (score >= 80) return '#22C55E'
  if (score >= 50) return '#F59E0B'
  return '#EF4444'
}

function getScoreBg(score: number): string {
  if (score >= 80) return 'bg-green-50'
  if (score >= 50) return 'bg-amber-50'
  return 'bg-red-50'
}

function getScoreText(score: number): string {
  if (score >= 80) return 'text-green-700'
  if (score >= 50) return 'text-amber-700'
  return 'text-red-700'
}

function getScoreLabel(score: number): string {
  if (score >= 90) return 'Mükemmel'
  if (score >= 80) return 'İyi'
  if (score >= 60) return 'Orta'
  if (score >= 40) return 'Zayıf'
  return 'Kritik'
}

// ─── Components ───

function BigScoreCircle({ score }: { score: number }) {
  const size = 140
  const strokeWidth = 10
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference - (score / 100) * circumference
  const color = getScoreColor(score)

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="transform -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="#E5E7EB" strokeWidth={strokeWidth} fill="none" />
        <circle
          cx={size / 2} cy={size / 2} r={radius} stroke={color} strokeWidth={strokeWidth} fill="none"
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-3xl font-bold" style={{ color }}>{score}</span>
        <span className="text-caption text-gray-500">/100</span>
      </div>
    </div>
  )
}

function LighthouseScoreCard({ label, score, icon: Icon }: { label: string; score: number; icon: typeof Zap }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col items-center gap-2">
      <Icon className="w-5 h-5 text-gray-400" />
      <CircularProgress percentage={score} size={48} />
      <span className="text-ui font-medium text-gray-600 text-center">{label}</span>
    </div>
  )
}

function CoreWebVitalCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 rounded-lg p-3 text-center">
      <div className="text-sm font-semibold text-gray-900">{value}</div>
      <div className="text-caption text-gray-500 mt-1">{label}</div>
    </div>
  )
}

function CheckItem({ check }: { check: Check }) {
  const statusIcon = {
    pass: <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />,
    fail: <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />,
    warning: <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />,
  }

  return (
    <div className="flex gap-3 py-2">
      {statusIcon[check.status]}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-900">{check.title}</div>
        <div className="text-caption text-gray-500 mt-0.5">{check.description}</div>
        {check.value && (
          <div className="text-caption text-gray-400 mt-1 truncate font-mono bg-gray-50 px-2 py-1 rounded">
            {check.value}
          </div>
        )}
      </div>
    </div>
  )
}

function CategoryCard({ categoryKey, category }: { categoryKey: string; category: Category }) {
  const [expanded, setExpanded] = useState(true)
  const config = categoryConfig[categoryKey]
  if (!config) return null

  const Icon = config.icon
  const passCount = category.checks.filter(c => c.status === 'pass').length
  const failCount = category.checks.filter(c => c.status === 'fail').length
  const warnCount = category.checks.filter(c => c.status === 'warning').length

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${getScoreBg(category.score)}`}>
            <Icon className={`w-5 h-5 ${getScoreText(category.score)}`} />
          </div>
          <div className="text-left">
            <div className="text-sm font-semibold text-gray-900">{config.label}</div>
            <div className="flex items-center gap-3 mt-0.5">
              {passCount > 0 && (
                <span className="flex items-center gap-1 text-caption text-green-600">
                  <CheckCircle2 className="w-3 h-3" /> {passCount}
                </span>
              )}
              {warnCount > 0 && (
                <span className="flex items-center gap-1 text-caption text-amber-600">
                  <AlertTriangle className="w-3 h-3" /> {warnCount}
                </span>
              )}
              {failCount > 0 && (
                <span className="flex items-center gap-1 text-caption text-red-600">
                  <XCircle className="w-3 h-3" /> {failCount}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className={`text-lg font-bold ${getScoreText(category.score)}`}>
            {category.score}
          </div>
          {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </button>
      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-100">
          <div className="divide-y divide-gray-100">
            {category.checks
              .sort((a, b) => {
                const order = { fail: 0, warning: 1, pass: 2 }
                return order[a.status] - order[b.status]
              })
              .map((check) => (
                <CheckItem key={check.id} check={check} />
              ))}
          </div>
        </div>
      )}
    </div>
  )
}

function LighthouseAuditItem({ audit }: { audit: LighthouseAudit }) {
  const score = audit.score
  let statusIcon = <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
  if (score !== null) {
    if (score < 0.5) statusIcon = <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
    else if (score < 0.9) statusIcon = <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
  }

  return (
    <div className="flex gap-3 py-2">
      {statusIcon}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-gray-900">{audit.title}</span>
          {audit.displayValue && (
            <span className="text-caption text-gray-500 font-mono shrink-0">{audit.displayValue}</span>
          )}
        </div>
      </div>
    </div>
  )
}

function RecommendationCard({ rec, index }: { rec: Recommendation; index: number }) {
  const [showCode, setShowCode] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    if (!rec.code) return
    try {
      await navigator.clipboard.writeText(rec.code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* fallback */ }
  }

  return (
    <div className="bg-white/80 rounded-lg overflow-hidden">
      <div className="flex gap-3 p-3">
        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-caption font-bold shrink-0">
          {index + 1}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-700">{rec.text}</p>
          {(rec.code || rec.guide) && (
            <button
              onClick={() => setShowCode(!showCode)}
              className="mt-2 flex items-center gap-1.5 text-caption font-medium text-primary hover:text-primary/80 transition-colors"
            >
              <Code className="w-3.5 h-3.5" />
              {showCode ? 'Gizle' : 'Nasıl Yapılır?'}
            </button>
          )}
        </div>
      </div>
      {showCode && (
        <div className="mx-3 mb-3 space-y-2">
          {rec.guide && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <Lightbulb className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <p className="text-caption text-blue-800 whitespace-pre-line leading-relaxed">{rec.guide}</p>
              </div>
            </div>
          )}
          {rec.code && (
            <div className="relative">
              <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                <button
                  onClick={handleCopy}
                  className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 text-caption transition-colors"
                >
                  {copied ? <><CheckIcon className="w-3 h-3 text-green-400" />Kopyalandı</> : <><Copy className="w-3 h-3" />Kopyala</>}
                </button>
                <pre className="text-caption text-gray-100 whitespace-pre-wrap font-mono leading-relaxed">{rec.code}</pre>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function AnalysisSkeleton() {
  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-pulse">
      <div className="bg-white rounded-2xl border border-gray-200 p-8">
        <div className="flex items-center justify-center gap-8">
          <div className="w-[140px] h-[140px] rounded-full bg-gray-200" />
          <div className="space-y-3">
            <div className="h-6 bg-gray-200 rounded w-48" />
            <div className="h-4 bg-gray-200 rounded w-64" />
            <div className="h-4 bg-gray-200 rounded w-32" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 h-28" />
        ))}
      </div>
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 h-20" />
      ))}
    </div>
  )
}

// ─── Main Page ───

export default function SEOPage() {
  const t = useTranslations('dashboard.seo')
  const [url, setUrl] = useState('')
  const [competitorUrl, setCompetitorUrl] = useState('')
  const [showCompetitor, setShowCompetitor] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<SeoResult | null>(null)
  const [competitorResult, setCompetitorResult] = useState<SeoResult | null>(null)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'analysis' | 'history' | 'bulk' | 'tools' | 'articles'>('analysis')
  const [lighthouseMode, setLighthouseMode] = useState<'mobile' | 'desktop'>('mobile')
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [bulkUrls, setBulkUrls] = useState('')
  const [bulkResults, setBulkResults] = useState<(SeoResult | { url: string; error: string })[]>([])
  const [bulkLoading, setBulkLoading] = useState(false)
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 })
  const printRef = useRef<HTMLDivElement>(null)

  // Restore state from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('seo_last_result')
      if (saved) {
        const parsed = JSON.parse(saved)
        setResult(parsed.result)
        setUrl(parsed.url || '')
      }
      const hist = localStorage.getItem('seo_history')
      if (hist) setHistory(JSON.parse(hist))
    } catch { /* ignore */ }
  }, [])

  const saveToHistory = (data: SeoResult) => {
    const item: HistoryItem = { url: data.url, date: data.analyzedAt, score: data.overallScore }
    const updated = [item, ...history.filter(h => h.url !== data.url)].slice(0, 20)
    setHistory(updated)
    localStorage.setItem('seo_history', JSON.stringify(updated))
  }

  const analyzeUrl = async (targetUrl: string): Promise<SeoResult | null> => {
    const res = await fetch('/api/seo/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: targetUrl }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || t('errors.generic'))
    return data
  }

  const handleAnalyze = async () => {
    if (!url.trim()) return

    setLoading(true)
    setError('')
    setResult(null)
    setCompetitorResult(null)

    try {
      const promises: Promise<SeoResult | null>[] = [analyzeUrl(url.trim())]
      if (showCompetitor && competitorUrl.trim()) {
        promises.push(analyzeUrl(competitorUrl.trim()))
      }

      const results = await Promise.allSettled(promises)

      if (results[0].status === 'rejected') {
        setError(results[0].reason?.message || t('errors.generic'))
        return
      }

      const mainResult = results[0].value
      if (mainResult) {
        setResult(mainResult)
        localStorage.setItem('seo_last_result', JSON.stringify({ result: mainResult, url: url.trim() }))
        saveToHistory(mainResult)
      }

      if (results.length > 1 && results[1].status === 'fulfilled' && results[1].value) {
        setCompetitorResult(results[1].value)
        saveToHistory(results[1].value)
      }
    } catch {
      setError(t('errors.network'))
    } finally {
      setLoading(false)
    }
  }

  const handleBulkScan = async () => {
    const urls = bulkUrls.split('\n').map(u => u.trim()).filter(u => u.length > 0)
    if (urls.length === 0) return

    setBulkLoading(true)
    setBulkResults([])
    setBulkProgress({ current: 0, total: urls.length })

    const results: (SeoResult | { url: string; error: string })[] = []
    for (let i = 0; i < urls.length; i++) {
      setBulkProgress({ current: i + 1, total: urls.length })
      try {
        const data = await analyzeUrl(urls[i])
        if (data) {
          results.push(data)
          saveToHistory(data)
        }
      } catch (err) {
        results.push({ url: urls[i], error: err instanceof Error ? err.message : t('errors.generic') })
      }
      setBulkResults([...results])
    }

    setBulkLoading(false)
  }

  const handleExportPdf = () => {
    window.print()
  }

  const clearHistory = () => {
    setHistory([])
    localStorage.removeItem('seo_history')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading) handleAnalyze()
  }

  const currentLighthouse = lighthouseMode === 'desktop' ? result?.lighthouseDesktop : result?.lighthouse

  return (
    <>
      <Topbar title={t('title')} description={t('description')} />
      <div className="flex-1 overflow-y-auto bg-gray-50 p-6 print:bg-white print:p-0">
        <div className="max-w-5xl mx-auto space-y-6" ref={printRef}>

          {/* Tab Navigation */}
          <div className="flex gap-1 bg-white rounded-xl border border-gray-200 p-1 print:hidden">
            {([
              { key: 'analysis' as const, label: t('tabs.analysis'), icon: Search },
              { key: 'history' as const, label: t('tabs.history'), icon: History },
              { key: 'bulk' as const, label: t('tabs.bulk'), icon: List },
              { key: 'tools' as const, label: t('tabs.tools'), icon: Wrench },
              { key: 'articles' as const, label: t('tabs.articles'), icon: FileText },
            ]).map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab.key
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* ════════════ ANALYSIS TAB ════════════ */}
          {activeTab === 'analysis' && (
            <>
              {/* URL Input */}
              <div className="bg-white rounded-2xl border border-gray-200 p-6 print:hidden">
                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={t('urlPlaceholder')}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                      disabled={loading}
                    />
                  </div>
                  <button
                    onClick={handleAnalyze}
                    disabled={loading || !url.trim()}
                    className="px-6 py-3 bg-primary text-white rounded-xl font-medium text-sm hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 shrink-0"
                  >
                    {loading ? (
                      <><Loader2 className="w-4 h-4 animate-spin" />{t('analyzing')}</>
                    ) : (
                      <><Search className="w-4 h-4" />{t('analyzeButton')}</>
                    )}
                  </button>
                </div>

                {/* Competitor Toggle */}
                <div className="mt-3 flex items-center gap-3">
                  <button
                    onClick={() => setShowCompetitor(!showCompetitor)}
                    className={`flex items-center gap-2 text-caption font-medium px-3 py-1.5 rounded-lg transition-all ${
                      showCompetitor ? 'bg-primary/10 text-primary' : 'text-gray-500 hover:bg-gray-100'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    {t('competitor.toggle')}
                  </button>
                  {result && (
                    <button
                      onClick={handleExportPdf}
                      className="flex items-center gap-2 text-caption font-medium px-3 py-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-all"
                    >
                      <Download className="w-3.5 h-3.5" />
                      {t('exportPdf')}
                    </button>
                  )}
                </div>

                {/* Competitor URL Input */}
                {showCompetitor && (
                  <div className="mt-3 relative">
                    <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      value={competitorUrl}
                      onChange={(e) => setCompetitorUrl(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={t('competitor.placeholder')}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                      disabled={loading}
                    />
                  </div>
                )}

                {error && (
                  <div className="mt-3 flex items-center gap-2 text-sm text-red-600 bg-red-50 px-4 py-2 rounded-lg">
                    <XCircle className="w-4 h-4 shrink-0" />
                    {error}
                  </div>
                )}
              </div>

              {/* Loading State */}
              {loading && <AnalysisSkeleton />}

              {/* Results */}
              {result && !loading && (
                <>
                  {/* Competitor Comparison Header */}
                  {competitorResult && (
                    <div className="bg-white rounded-2xl border border-gray-200 p-6">
                      <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <BarChart3 className="w-4 h-4" />
                        {t('competitor.title')}
                      </h3>
                      <div className="grid grid-cols-2 gap-6">
                        <div className="text-center">
                          <BigScoreCircle score={result.overallScore} />
                          <div className="mt-2 text-sm font-medium text-gray-900 truncate">{result.url}</div>
                        </div>
                        <div className="text-center">
                          <BigScoreCircle score={competitorResult.overallScore} />
                          <div className="mt-2 text-sm font-medium text-gray-900 truncate">{competitorResult.url}</div>
                        </div>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-4">
                        {Object.entries(result.categories).map(([key, cat]) => {
                          const compCat = competitorResult.categories[key as keyof typeof competitorResult.categories]
                          if (!compCat) return null
                          const config = categoryConfig[key]
                          if (!config) return null
                          return (
                            <div key={key} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                              <span className="text-caption text-gray-600">{config.label}</span>
                              <div className="flex items-center gap-2">
                                <span className={`text-sm font-bold ${getScoreText(cat.score)}`}>{cat.score}</span>
                                <span className="text-caption text-gray-400">vs</span>
                                <span className={`text-sm font-bold ${getScoreText(compCat.score)}`}>{compCat.score}</span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Overall Score - hide when competitor comparison is shown */}
                  {!competitorResult && (
                    <div className="bg-white rounded-2xl border border-gray-200 p-8">
                      <div className="flex flex-col sm:flex-row items-center gap-8">
                        <BigScoreCircle score={result.overallScore} />
                        <div className="text-center sm:text-left">
                          <h2 className="text-xl font-bold text-gray-900">{t('overallScore')}</h2>
                          <div className={`inline-block mt-2 px-3 py-1 rounded-full text-sm font-semibold ${getScoreBg(result.overallScore)} ${getScoreText(result.overallScore)}`}>
                            {getScoreLabel(result.overallScore)}
                          </div>
                          <div className="flex items-center gap-2 mt-3 text-sm text-gray-500">
                            <ExternalLink className="w-3.5 h-3.5" />
                            <a href={result.url} target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors truncate max-w-xs">
                              {result.url}
                            </a>
                          </div>
                          <div className="text-caption text-gray-400 mt-1">
                            {new Date(result.analyzedAt).toLocaleString('tr-TR')}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Lighthouse Scores */}
                  {(result.lighthouse || result.lighthouseDesktop) && (
                    <>
                      {/* Mobile/Desktop Toggle */}
                      <div className="flex items-center justify-between print:hidden">
                        <h3 className="text-sm font-semibold text-gray-700">Lighthouse</h3>
                        <div className="flex items-center bg-white border border-gray-200 rounded-lg p-0.5">
                          <button
                            onClick={() => setLighthouseMode('mobile')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-caption font-medium transition-all ${
                              lighthouseMode === 'mobile' ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-100'
                            }`}
                          >
                            <Smartphone className="w-3.5 h-3.5" />
                            {t('lighthouse.mobile')}
                          </button>
                          <button
                            onClick={() => setLighthouseMode('desktop')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-caption font-medium transition-all ${
                              lighthouseMode === 'desktop' ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-100'
                            }`}
                          >
                            <Monitor className="w-3.5 h-3.5" />
                            {t('lighthouse.desktop')}
                          </button>
                        </div>
                      </div>

                      {currentLighthouse ? (
                        <>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            <LighthouseScoreCard label={t('lighthouse.performance')} score={currentLighthouse.performance} icon={Zap} />
                            <LighthouseScoreCard label={t('lighthouse.accessibility')} score={currentLighthouse.accessibility} icon={Eye} />
                            <LighthouseScoreCard label={t('lighthouse.bestPractices')} score={currentLighthouse.bestPractices} icon={Award} />
                            <LighthouseScoreCard label={t('lighthouse.seo')} score={currentLighthouse.seo} icon={Search} />
                          </div>

                          {/* Core Web Vitals */}
                          <div className="bg-white rounded-2xl border border-gray-200 p-6">
                            <h3 className="text-sm font-semibold text-gray-900 mb-4">{t('lighthouse.coreWebVitals')}</h3>
                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                              <CoreWebVitalCard label="FCP" value={currentLighthouse.coreWebVitals.fcp} />
                              <CoreWebVitalCard label="LCP" value={currentLighthouse.coreWebVitals.lcp} />
                              <CoreWebVitalCard label="TBT" value={currentLighthouse.coreWebVitals.tbt} />
                              <CoreWebVitalCard label="CLS" value={currentLighthouse.coreWebVitals.cls} />
                              <CoreWebVitalCard label="Speed Index" value={currentLighthouse.coreWebVitals.si} />
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center text-sm text-gray-500">
                          {t('lighthouse.notAvailable')}
                        </div>
                      )}
                    </>
                  )}

                  {/* Top Keywords */}
                  {result.topKeywords && result.topKeywords.length > 0 && (
                    <div className="bg-white rounded-2xl border border-gray-200 p-6">
                      <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <Search className="w-4 h-4" />
                        {t('keywords.title')}
                      </h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-100">
                              <th className="text-left py-2 text-ui font-medium text-gray-500">{t('keywords.word')}</th>
                              <th className="text-center py-2 text-ui font-medium text-gray-500">{t('keywords.count')}</th>
                              <th className="text-center py-2 text-ui font-medium text-gray-500">{t('keywords.density')}</th>
                              <th className="text-center py-2 text-ui font-medium text-gray-500">Title</th>
                              <th className="text-center py-2 text-ui font-medium text-gray-500">H1</th>
                              <th className="text-center py-2 text-ui font-medium text-gray-500">Meta</th>
                            </tr>
                          </thead>
                          <tbody>
                            {result.topKeywords.map((kw, i) => (
                              <tr key={i} className="border-b border-gray-50">
                                <td className="py-2 font-medium text-gray-900">{kw.word}</td>
                                <td className="py-2 text-center text-gray-600">{kw.count}</td>
                                <td className="py-2 text-center text-gray-600">%{kw.density}</td>
                                <td className="py-2 text-center">
                                  {kw.inTitle ? <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto" /> : <XCircle className="w-4 h-4 text-gray-300 mx-auto" />}
                                </td>
                                <td className="py-2 text-center">
                                  {kw.inH1 ? <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto" /> : <XCircle className="w-4 h-4 text-gray-300 mx-auto" />}
                                </td>
                                <td className="py-2 text-center">
                                  {kw.inMetaDesc ? <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto" /> : <XCircle className="w-4 h-4 text-gray-300 mx-auto" />}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Category Cards */}
                  <div className="space-y-4">
                    {Object.entries(result.categories).map(([key, category]) => (
                      <CategoryCard key={key} categoryKey={key} category={category} />
                    ))}
                  </div>

                  {/* Redirect Chain */}
                  {result.redirectChain && result.redirectChain.length > 1 && (
                    <div className="bg-white rounded-2xl border border-gray-200 p-6">
                      <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <ArrowRight className="w-4 h-4" />
                        {t('redirects.title')}
                      </h3>
                      <div className="space-y-2">
                        {result.redirectChain.map((hop, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <span className={`text-caption font-mono px-2 py-0.5 rounded ${
                              hop.status >= 300 && hop.status < 400 ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700'
                            }`}>
                              {hop.status}
                            </span>
                            <span className="text-sm text-gray-700 truncate">{hop.url}</span>
                            {i < result.redirectChain.length - 1 && (
                              <ArrowRight className="w-3 h-3 text-gray-400 shrink-0" />
                            )}
                          </div>
                        ))}
                      </div>
                      {result.redirectChain.length > 2 && (
                        <div className="mt-3 text-caption text-amber-600 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          {t('redirects.warning')}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Broken Links */}
                  {result.brokenLinks && result.brokenLinks.length > 0 && (
                    <div className="bg-white rounded-2xl border border-gray-200 p-6">
                      <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <Link2 className="w-4 h-4 text-red-500" />
                        {t('brokenLinks.title')}
                        <span className="text-caption bg-red-50 text-red-600 px-2 py-0.5 rounded-full">{result.brokenLinks.length}</span>
                      </h3>
                      <div className="space-y-2">
                        {result.brokenLinks.map((link, i) => (
                          <div key={i} className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
                            <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm text-gray-900 truncate">{link.anchor}</div>
                              <div className="text-caption text-gray-500 truncate font-mono">{link.url}</div>
                            </div>
                            <span className="text-caption font-mono px-2 py-0.5 rounded bg-red-50 text-red-600 shrink-0">
                              {link.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* AI Recommendations */}
                  {result.recommendations && result.recommendations.length > 0 && (
                    <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-2xl border border-primary/20 p-6">
                      <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <Lightbulb className="w-4 h-4 text-primary" />
                        {t('recommendations.title')}
                      </h3>
                      <div className="space-y-3">
                        {result.recommendations.map((rec, i) => (
                          <RecommendationCard key={rec.id || i} rec={rec} index={i} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Lighthouse Audits */}
                  {currentLighthouse && currentLighthouse.audits.length > 0 && (
                    <div className="bg-white rounded-2xl border border-gray-200 p-6">
                      <h3 className="text-sm font-semibold text-gray-900 mb-4">{t('lighthouse.auditsTitle')}</h3>
                      <div className="divide-y divide-gray-100">
                        {currentLighthouse.audits
                          .sort((a, b) => (a.score ?? 1) - (b.score ?? 1))
                          .map((audit) => (
                            <LighthouseAuditItem key={audit.id} audit={audit} />
                          ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Empty State */}
              {!result && !loading && !error && (
                <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
                  <Search className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <h2 className="text-lg font-semibold text-gray-900 mb-2">{t('emptyTitle')}</h2>
                  <p className="text-sm text-gray-500 max-w-md mx-auto">{t('emptyDescription')}</p>
                </div>
              )}
            </>
          )}

          {/* ════════════ HISTORY TAB ════════════ */}
          {activeTab === 'history' && (
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  {t('history.title')}
                </h3>
                {history.length > 0 && (
                  <button onClick={clearHistory} className="flex items-center gap-1.5 text-caption text-red-500 hover:text-red-700 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                    {t('history.clear')}
                  </button>
                )}
              </div>
              {history.length === 0 ? (
                <div className="text-center py-8">
                  <History className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-500">{t('history.empty')}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {history.map((item, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setUrl(item.url)
                        setActiveTab('analysis')
                        // Trigger re-analysis
                      }}
                      className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors text-left border border-gray-100"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white`}
                          style={{ backgroundColor: getScoreColor(item.score) }}
                        >
                          {item.score}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate">{item.url}</div>
                          <div className="text-caption text-gray-500">{new Date(item.date).toLocaleString('tr-TR')}</div>
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-gray-400 shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ════════════ BULK SCAN TAB ════════════ */}
          {activeTab === 'bulk' && (
            <>
              <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <List className="w-4 h-4" />
                  {t('bulk.title')}
                </h3>
                <p className="text-caption text-gray-500 mb-4">{t('bulk.description')}</p>
                <textarea
                  value={bulkUrls}
                  onChange={(e) => setBulkUrls(e.target.value)}
                  placeholder={t('bulk.placeholder')}
                  rows={6}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all resize-none font-mono"
                  disabled={bulkLoading}
                />
                <div className="flex items-center justify-between mt-3">
                  <span className="text-caption text-gray-500">
                    {bulkUrls.split('\n').filter(u => u.trim()).length} URL
                  </span>
                  <button
                    onClick={handleBulkScan}
                    disabled={bulkLoading || !bulkUrls.trim()}
                    className="px-5 py-2.5 bg-primary text-white rounded-xl font-medium text-sm hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                  >
                    {bulkLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {bulkProgress.current}/{bulkProgress.total}
                      </>
                    ) : (
                      <>
                        <Search className="w-4 h-4" />
                        {t('bulk.startScan')}
                      </>
                    )}
                  </button>
                </div>

                {/* Bulk Progress Bar */}
                {bulkLoading && (
                  <div className="mt-4">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full transition-all duration-300"
                        style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Bulk Results */}
              {bulkResults.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-200 p-6">
                  <h3 className="text-sm font-semibold text-gray-900 mb-4">{t('bulk.results')}</h3>
                  <div className="space-y-2">
                    {bulkResults.map((r, i) => {
                      const isError = 'error' in r
                      if (isError) {
                        return (
                          <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-red-200 bg-red-50/50">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-red-100">
                                <XCircle className="w-5 h-5 text-red-500" />
                              </div>
                              <div className="min-w-0">
                                <div className="text-sm font-medium text-gray-900 truncate">{r.url}</div>
                                <div className="text-caption text-red-500 mt-0.5">{r.error}</div>
                              </div>
                            </div>
                          </div>
                        )
                      }
                      return (
                        <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-gray-100">
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                              style={{ backgroundColor: getScoreColor(r.overallScore) }}
                            >
                              {r.overallScore}
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-gray-900 truncate">{r.url}</div>
                              <div className="flex items-center gap-3 mt-0.5 text-caption text-gray-500">
                                {r.lighthouse && (
                                  <>
                                    <span>Perf: {r.lighthouse.performance}</span>
                                    <span>SEO: {r.lighthouse.seo}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              setResult(r)
                              setUrl(r.url)
                              setActiveTab('analysis')
                            }}
                            className="text-caption text-primary font-medium hover:underline shrink-0"
                          >
                            {t('bulk.viewDetails')}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ════════════ TOOLS TAB ════════════ */}
          {activeTab === 'tools' && <SeoToolsTab />}

          {/* ════════════ ARTICLES TAB ════════════ */}
          {activeTab === 'articles' && <SeoArticlesTab />}

        </div>
      </div>

      {/* Print styles */}
      <style jsx global>{`
        @media print {
          nav, header, aside, .print\\:hidden { display: none !important; }
          body { background: white !important; }
          .print\\:bg-white { background: white !important; }
          .print\\:p-0 { padding: 0 !important; }
        }
      `}</style>
    </>
  )
}
