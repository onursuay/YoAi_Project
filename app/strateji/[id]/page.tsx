'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import Topbar from '@/components/Topbar'
import Tabs from '@/components/Tabs'
import { ToastContainer } from '@/components/Toast'
import type { Toast } from '@/components/Toast'
import type { StrategyInstance, StrategyOutput, StrategyTask, SyncJob, InputPayload, TaskStatus, MetricsSnapshot } from '@/lib/strategy/types'
import { POLL_INTERVAL } from '@/lib/strategy/constants'
import StatusBadge from '@/components/strateji/StatusBadge'
import PhaseIndicator from '@/components/strateji/PhaseIndicator'
import WizardPhase1 from '@/components/strateji/WizardPhase1'
import BlueprintView from '@/components/strateji/BlueprintView'
import TaskPanel from '@/components/strateji/TaskPanel'
import JobPanel from '@/components/strateji/JobPanel'
import ErrorPanel from '@/components/strateji/ErrorPanel'

const TABS = [
  { id: 'wizard', label: 'Keşif' },
  { id: 'plan', label: 'Strateji Planı' },
  { id: 'tasks', label: 'Görevler' },
  { id: 'jobs', label: 'İş Geçmişi' },
]

export default function StratejiDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialTab = searchParams.get('tab') || 'wizard'

  const [instance, setInstance] = useState<StrategyInstance | null>(null)
  const [input, setInput] = useState<{ payload: InputPayload } | null>(null)
  const [output, setOutput] = useState<StrategyOutput | null>(null)
  const [tasks, setTasks] = useState<StrategyTask[]>([])
  const [jobs, setJobs] = useState<SyncJob[]>([])
  const [metrics, setMetrics] = useState<MetricsSnapshot[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState(initialTab)
  const [saving, setSaving] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [approving, setApproving] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const [refreshingMetrics, setRefreshingMetrics] = useState(false)
  const [aiGenerated, setAiGenerated] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const addToast = useCallback((message: string, type: 'success' | 'error' | 'info') => {
    const tid = crypto.randomUUID()
    setToasts((prev) => [...prev, { id: tid, message, type }])
  }, [])

  const removeToast = useCallback((tid: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== tid))
  }, [])

  const fetchDetail = useCallback(async () => {
    try {
      const res = await fetch(`/api/strategy/instances/${id}`)
      if (!res.ok) { router.push('/strateji'); return }
      const json = await res.json()
      if (!json.ok) { router.push('/strateji'); return }

      setInstance(json.instance)
      setInput(json.input)
      setOutput(json.output)
      setTasks(json.tasks ?? [])
      setJobs(json.jobs ?? [])
      setMetrics(json.metrics ?? [])
      setAiGenerated(!!json.aiGenerated)

      // Auto-tab based on phase
      const status = json.instance?.status
      if (status && !searchParams.get('tab')) {
        if (['DRAFT', 'COLLECTING'].includes(status)) setActiveTab('wizard')
        else if (['ANALYZING', 'GENERATING_PLAN', 'READY_FOR_REVIEW'].includes(status)) setActiveTab('plan')
        else if (['APPLYING', 'RUNNING', 'NEEDS_ACTION'].includes(status)) setActiveTab('tasks')
        else if (status === 'FAILED') setActiveTab('jobs')
      }
    } catch {
      router.push('/strateji')
    } finally {
      setLoading(false)
    }
  }, [id, router, searchParams])

  // İlk yükleme
  useEffect(() => { fetchDetail() }, [fetchDetail])

  // Polling: aktif job varsa düzenli güncelle
  useEffect(() => {
    const hasActiveJob = jobs.some((j) => j.status === 'queued' || j.status === 'running')
    const isProcessing = instance && ['ANALYZING', 'GENERATING_PLAN', 'APPLYING', 'COLLECTING'].includes(instance.status)

    if (hasActiveJob || isProcessing) {
      pollRef.current = setInterval(fetchDetail, POLL_INTERVAL)
    }

    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [jobs, instance, fetchDetail])

  // ── Handlers ──

  const handleSaveInputs = async (payload: InputPayload) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/strategy/instances/${id}/inputs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload }),
      })
      const json = await res.json()
      if (json.ok) {
        addToast('Veriler kaydedildi', 'success')
        fetchDetail()
      } else {
        addToast(json.message || 'Kaydetme hatası', 'error')
      }
    } catch {
      addToast('Bir hata oluştu', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveAndAnalyze = async (payload: InputPayload) => {
    setSaving(true)
    try {
      // Önce kaydet
      const saveRes = await fetch(`/api/strategy/instances/${id}/inputs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload }),
      })
      const saveJson = await saveRes.json()
      if (!saveJson.ok) {
        addToast(saveJson.message || 'Kaydetme hatası', 'error')
        return
      }

      // Sonra analiz başlat
      const analyzeRes = await fetch(`/api/strategy/instances/${id}/analyze`, { method: 'POST' })
      const analyzeJson = await analyzeRes.json()
      if (analyzeJson.ok) {
        addToast('Analiz başlatıldı', 'success')
        setActiveTab('plan')
        fetchDetail()
      } else {
        addToast(analyzeJson.message || 'Analiz başlatılamadı', 'error')
      }
    } catch {
      addToast('Bir hata oluştu', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleRegenerate = async () => {
    setRegenerating(true)
    try {
      const res = await fetch(`/api/strategy/instances/${id}/generate-plan`, { method: 'POST' })
      const json = await res.json()
      if (json.ok) {
        addToast('Plan yeniden üretiliyor', 'info')
        fetchDetail()
      } else {
        addToast(json.message || 'Yeniden üretim hatası', 'error')
      }
    } catch {
      addToast('Bir hata oluştu', 'error')
    } finally {
      setRegenerating(false)
    }
  }

  const handleApprove = async (mode: 'apply' | 'suggest_only') => {
    setApproving(true)
    try {
      const res = await fetch(`/api/strategy/instances/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      })
      const json = await res.json()
      if (json.ok) {
        addToast(mode === 'apply' ? 'Uygulama başlatıldı' : 'Öneri modu aktif', 'success')
        setActiveTab('tasks')
        fetchDetail()
      } else {
        addToast(json.message || 'Onay hatası', 'error')
      }
    } catch {
      addToast('Bir hata oluştu', 'error')
    } finally {
      setApproving(false)
    }
  }

  const handleRetry = async () => {
    setRetrying(true)
    try {
      const res = await fetch(`/api/strategy/instances/${id}/retry`, { method: 'POST' })
      const json = await res.json()
      if (json.ok) {
        addToast('Tekrar deneniyor', 'info')
        fetchDetail()
      } else {
        addToast(json.message || 'Tekrar denenemedi', 'error')
      }
    } catch {
      addToast('Bir hata oluştu', 'error')
    } finally {
      setRetrying(false)
    }
  }

  const handleRefreshMetrics = async () => {
    setRefreshingMetrics(true)
    try {
      const res = await fetch(`/api/strategy/instances/${id}/metrics`, { method: 'POST' })
      const json = await res.json()
      if (json.ok) {
        addToast('Metrikler güncelleniyor, optimizasyon önerileri hazırlanıyor...', 'info')
        // Kısa gecikme sonrası veriyi yeniden çek (job çalışması için)
        setTimeout(fetchDetail, 2000)
      } else {
        addToast(json.message || 'Metrik güncelleme hatası', 'error')
      }
    } catch {
      addToast('Bir hata oluştu', 'error')
    } finally {
      setRefreshingMetrics(false)
    }
  }

  const handleUpdateTaskStatus = async (taskId: string, newStatus: TaskStatus) => {
    // Optimistic update
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: newStatus } : t))

    try {
      const res = await fetch(`/api/strategy/instances/${id}/tasks`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, status: newStatus }),
      })
      const json = await res.json()
      if (!json.ok) {
        addToast('Görev güncellenemedi', 'error')
        fetchDetail() // Geri al
      }
    } catch {
      addToast('Bir hata oluştu', 'error')
      fetchDetail() // Geri al
    }
  }

  if (loading) {
    return (
      <>
        <Topbar title="Yükleniyor..." description="" />
        <div className="flex-1 overflow-y-auto bg-gray-50 p-6">
          <div className="max-w-5xl mx-auto">
            <div className="bg-white rounded-xl border border-gray-200 p-8 animate-pulse">
              <div className="h-6 bg-gray-100 rounded w-48 mb-4" />
              <div className="h-4 bg-gray-100 rounded w-32" />
            </div>
          </div>
        </div>
      </>
    )
  }

  if (!instance) return null

  return (
    <>
      <Topbar
        title={instance.title}
        description="Strateji detayı"
      />
      <div className="flex-1 overflow-y-auto bg-gray-50 p-6">
        <div className="max-w-5xl mx-auto space-y-4">
          {/* Geri + Durum */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => router.push('/strateji')}
              className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Geri
            </button>
            <div className="flex items-center gap-3">
              <PhaseIndicator status={instance.status} />
              <StatusBadge status={instance.status} />
            </div>
          </div>

          {/* Hata Paneli */}
          {(instance.status === 'FAILED' || instance.status === 'NEEDS_ACTION') && (
            <ErrorPanel
              error={instance.last_error}
              onRetry={handleRetry}
              retrying={retrying}
            />
          )}

          {/* Metrics Summary — RUNNING durumda göster */}
          {instance.status === 'RUNNING' && (
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-900">Performans Özeti</h3>
                <button
                  onClick={handleRefreshMetrics}
                  disabled={refreshingMetrics}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-700 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${refreshingMetrics ? 'animate-spin' : ''}`} />
                  {refreshingMetrics ? 'Güncelleniyor...' : 'Metrikleri Güncelle & Optimize Et'}
                </button>
              </div>
              {metrics.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider">Harcama</p>
                    <p className="text-lg font-bold text-gray-900">{metrics[0].spend_try.toLocaleString('tr-TR')}₺</p>
                    <p className="text-[10px] text-gray-400">Son {metrics[0].range_days} gün</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider">ROAS</p>
                    <p className={`text-lg font-bold ${(metrics[0].roas ?? 0) >= 2 ? 'text-green-600' : 'text-amber-600'}`}>{metrics[0].roas}x</p>
                    <p className="text-[10px] text-gray-400">Reklam getirisi</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider">CPA</p>
                    <p className="text-lg font-bold text-gray-900">{metrics[0].cpa_try}₺</p>
                    <p className="text-[10px] text-gray-400">Dönüşüm başı maliyet</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider">Dönüşüm</p>
                    <p className="text-lg font-bold text-gray-900">{metrics[0].conversions}</p>
                    <p className="text-[10px] text-gray-400">{metrics[0].clicks?.toLocaleString('tr-TR')} tıklama</p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-gray-400 text-center py-4">
                  Henüz metrik verisi yok. &quot;Metrikleri Güncelle&quot; butonuna tıklayarak ilk verileri çekin.
                </p>
              )}
            </div>
          )}

          {/* Processing indicator */}
          {['ANALYZING', 'GENERATING_PLAN', 'APPLYING'].includes(instance.status) && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center gap-3">
              <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
              <div>
                <p className="text-sm font-medium text-blue-800">
                  {instance.status === 'ANALYZING' && 'Veriler analiz ediliyor...'}
                  {instance.status === 'GENERATING_PLAN' && 'Strateji planı üretiliyor...'}
                  {instance.status === 'APPLYING' && 'Plan uygulanıyor...'}
                </p>
                <p className="text-xs text-blue-600 mt-0.5">Bu işlem birkaç saniye sürebilir. Sayfa otomatik güncellenecek.</p>
              </div>
            </div>
          )}

          {/* Tabs */}
          <Tabs tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />

          {/* Tab İçerikleri */}
          <div className="bg-white rounded-b-xl border border-t-0 border-gray-200 p-5">
            {activeTab === 'wizard' && (
              <WizardPhase1
                instanceId={id}
                initialData={input?.payload}
                onSave={handleSaveInputs}
                onSaveAndAnalyze={handleSaveAndAnalyze}
                saving={saving}
              />
            )}

            {activeTab === 'plan' && (
              output?.blueprint ? (
                <BlueprintView
                  blueprint={output.blueprint}
                  onRegenerate={handleRegenerate}
                  onApprove={handleApprove}
                  regenerating={regenerating}
                  approving={approving}
                  aiGenerated={aiGenerated}
                />
              ) : (
                <div className="text-center py-12 text-sm text-gray-400">
                  {['ANALYZING', 'GENERATING_PLAN'].includes(instance.status)
                    ? 'Plan üretiliyor... Lütfen bekleyin.'
                    : 'Henüz plan üretilmedi. Önce Aşama 1 verilerini tamamlayıp analiz başlatın.'}
                </div>
              )
            )}

            {activeTab === 'tasks' && (
              <TaskPanel
                tasks={tasks}
                onUpdateStatus={handleUpdateTaskStatus}
              />
            )}

            {activeTab === 'jobs' && (
              <JobPanel jobs={jobs} />
            )}
          </div>
        </div>
      </div>
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </>
  )
}
