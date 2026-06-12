'use client'

import { useLocale, useTranslations } from 'next-intl'
import { Clock, CheckCircle, XCircle, Loader2, AlertTriangle } from 'lucide-react'
import type { SyncJob } from '@/lib/strategy/types'
import { STALE_JOB_MS } from '@/lib/strategy/constants'

interface JobPanelProps {
  jobs: SyncJob[]
}

function formatDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleString(locale === 'en' ? 'en-US' : 'tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default function JobPanel({ jobs }: JobPanelProps) {
  const t = useTranslations('dashboard.strateji.job')
  const locale = useLocale()

  const JOB_TYPE_LABELS: Record<string, string> = {
    analyze: t('type.analyze'),
    generate_plan: t('type.generatePlan'),
    apply: t('type.apply'),
    pull_metrics: t('type.pullMetrics'),
    optimize: t('type.optimize'),
  }

  const STATUS_CONFIG: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
    queued: { icon: <Clock className="w-3.5 h-3.5" />, color: 'text-gray-500', label: t('jobStatus.queued') },
    running: { icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />, color: 'text-blue-600', label: t('jobStatus.running') },
    success: { icon: <CheckCircle className="w-3.5 h-3.5" />, color: 'text-emerald-600', label: t('jobStatus.success') },
    failed: { icon: <XCircle className="w-3.5 h-3.5" />, color: 'text-red-600', label: t('jobStatus.failed') },
  }

  if (jobs.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-gray-400">
        {t('empty')}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-gray-700">{t('historyTitle')}</h4>
      <div className="space-y-1.5">
        {jobs.map((job) => {
          // Terk edilmiş job: uzun süredir "running/queued" → gerçekte ölü.
          // "Çalışıyor %40" yerine dürüstçe "Zaman aşımı" göster.
          const isStale =
            (job.status === 'running' || job.status === 'queued') &&
            Date.now() - new Date(job.updated_at || job.created_at).getTime() > STALE_JOB_MS
          const config = isStale
            ? { icon: <AlertTriangle className="w-3.5 h-3.5" />, color: 'text-red-600', label: t('timeout') }
            : STATUS_CONFIG[job.status] || STATUS_CONFIG.queued
          // Optimize işi AI yerine şablon öneriye düştüyse dürüstçe belirt.
          const usedFallback =
            job.job_type === 'optimize' && job.status === 'success' && job.result?.ai_generated === false
          return (
            <div key={job.id} className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200">
              <span className={config.color}>{config.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">
                    {JOB_TYPE_LABELS[job.job_type] || job.job_type}
                  </span>
                  <span className={`text-xs ${config.color}`}>{config.label}</span>
                </div>
                {job.status === 'running' && !isStale && (
                  <div className="mt-1.5">
                    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all"
                        style={{ width: `${job.progress}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-gray-400 mt-0.5">{t('progress', { value: job.progress })}</span>
                  </div>
                )}
                {usedFallback && (
                  <p className="text-[11px] text-gray-500 mt-1">
                    {t('templateFallback')}
                  </p>
                )}
                {job.last_error && (
                  <p className="text-xs text-red-500 mt-1 truncate">
                    {job.last_error.message || t('errorAvailable')}
                  </p>
                )}
              </div>
              <div className="text-right flex-shrink-0">
                <span className="text-[10px] text-gray-400">{formatDate(job.created_at, locale)}</span>
                {job.attempts > 1 && (
                  <div className="text-[10px] text-gray-500 mt-0.5">{t('attempts', { attempts: job.attempts, max: job.max_attempts })}</div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
