'use client'

import { Clock, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import type { SyncJob } from '@/lib/strategy/types'

interface JobPanelProps {
  jobs: SyncJob[]
}

const JOB_TYPE_LABELS: Record<string, string> = {
  analyze: 'Analiz',
  generate_plan: 'Plan Üretimi',
  apply: 'Uygulama',
  pull_metrics: 'Metrik Çekme',
  optimize: 'Optimizasyon',
}

const STATUS_CONFIG: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  queued: { icon: <Clock className="w-3.5 h-3.5" />, color: 'text-gray-500', label: 'Kuyrukta' },
  running: { icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />, color: 'text-blue-600', label: 'Çalışıyor' },
  success: { icon: <CheckCircle className="w-3.5 h-3.5" />, color: 'text-green-600', label: 'Başarılı' },
  failed: { icon: <XCircle className="w-3.5 h-3.5" />, color: 'text-red-600', label: 'Hata' },
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default function JobPanel({ jobs }: JobPanelProps) {
  if (jobs.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-gray-400">
        Henüz iş kaydı yok.
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-gray-700">İş Geçmişi</h4>
      <div className="space-y-1.5">
        {jobs.map((job) => {
          const config = STATUS_CONFIG[job.status] || STATUS_CONFIG.queued
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
                {job.status === 'running' && (
                  <div className="mt-1.5">
                    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all"
                        style={{ width: `${job.progress}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-gray-400 mt-0.5">%{job.progress}</span>
                  </div>
                )}
                {job.last_error && (
                  <p className="text-xs text-red-500 mt-1 truncate">
                    {job.last_error.message || 'Hata detayı mevcut'}
                  </p>
                )}
              </div>
              <div className="text-right flex-shrink-0">
                <span className="text-[10px] text-gray-400">{formatDate(job.created_at)}</span>
                {job.attempts > 1 && (
                  <div className="text-[10px] text-amber-500 mt-0.5">Deneme: {job.attempts}/{job.max_attempts}</div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
