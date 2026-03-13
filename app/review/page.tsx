'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface CapabilitiesSnapshot {
  ok?: boolean
  connected?: boolean
  grantedScopes?: string[]
  adAccountId?: string | null
  assets?: {
    pages?: { id: string; name: string }[]
    pixels?: { id: string; name: string }[]
    leadForms?: { id: string; name: string; page_id: string }[]
    whatsapp?: { available: boolean; reason?: string }
  }
  features?: {
    canCTWA: boolean
    canLeadFormsCreate: boolean
    canLeadRetrieval: boolean
    canWebsite: boolean
    canSalesWithPixel: boolean
  }
  reasons?: Record<string, string>
}

interface LogEntry {
  requestId?: string
  fbtrace_id?: string
  endpoint: string
  status: number | string
}

export default function ReviewPage() {
  const [mounted, setMounted] = useState(false)
  const [capabilities, setCapabilities] = useState<CapabilitiesSnapshot | null>(null)
  const [capLoading, setCapLoading] = useState(false)
  const [hasLeadAccess, setHasLeadAccess] = useState<{ formId: string; hasAccess: boolean } | null>(null)
  const [leadFormId, setLeadFormId] = useState('')
  const [leadsResult, setLeadsResult] = useState<{ data?: unknown[]; error?: string } | null>(null)
  const [logEntries, setLogEntries] = useState<LogEntry[]>([])
  const [step, setStep] = useState(1)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Guard is in app/review/layout.tsx (server-side redirect when REVIEW_MODE !== 'true')

  const addLog = (entry: LogEntry) => {
    setLogEntries((prev) => [...prev.slice(-49), entry])
  }

  const handleConnect = () => {
    window.location.href = '/api/meta/login'
  }

  const handleFetchCapabilities = async () => {
    setCapLoading(true)
    setCapabilities(null)
    addLog({ endpoint: 'GET /api/meta/capabilities', status: '...' })
    try {
      const res = await fetch('/api/meta/capabilities', { cache: 'no-store' })
      const data = await res.json()
      addLog({
        endpoint: 'GET /api/meta/capabilities',
        status: res.status,
        requestId: data.request_id,
        fbtrace_id: data.fbtrace_id,
      })
      setCapabilities(data)
      if (data.ok) setStep(3)
    } finally {
      setCapLoading(false)
    }
  }

  const handleHasLeadAccess = async () => {
    if (!leadFormId.trim()) return
    addLog({ endpoint: `GET /api/meta/has-lead-access?formId=${leadFormId}`, status: '...' })
    const res = await fetch(`/api/meta/has-lead-access?formId=${encodeURIComponent(leadFormId)}`)
    const data = await res.json()
    addLog({
      endpoint: 'GET /api/meta/has-lead-access',
      status: res.status,
      requestId: data.request_id,
      fbtrace_id: data.fbtrace_id,
    })
    setHasLeadAccess({ formId: leadFormId, hasAccess: data.hasAccess === true })
  }

  const handleFetchLeads = async () => {
    if (!leadFormId.trim()) return
    setLeadsResult(null)
    addLog({ endpoint: `GET /api/meta/leads?formId=${leadFormId}`, status: '...' })
    const res = await fetch(`/api/meta/leads?formId=${encodeURIComponent(leadFormId)}&limit=10`)
    const data = await res.json()
    addLog({
      endpoint: 'GET /api/meta/leads',
      status: res.status,
      requestId: data.request_id,
      fbtrace_id: data.fbtrace_id,
    })
    setLeadsResult(data.ok ? { data: data.data } : { error: data.error || data.message })
  }

  if (!mounted) return null

  return (
    <div className="min-h-screen bg-gray-50 p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Meta App Review — Video Senaryosu</h1>
      <p className="text-sm text-gray-600 mb-6">
        Adımları sırayla tamamlayarak ekran kaydı alabilirsiniz.
      </p>

      {/* Step 1: Connect */}
      <section className="mb-8 p-4 bg-white rounded-lg border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">
          Adım 1: Meta&apos;ya Bağlan
        </h2>
        <p className="text-sm text-gray-600 mb-3">
          Aşağıdaki düğmeyle Meta OAuth akışını başlatın ve gerekli izinleri verin.
        </p>
        <button
          type="button"
          onClick={handleConnect}
          className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700"
        >
          Meta ile Bağlan
        </button>
      </section>

      {/* Step 2: Capabilities */}
      <section className="mb-8 p-4 bg-white rounded-lg border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">
          Adım 2: Capabilities Snapshot
        </h2>
        <p className="text-sm text-gray-600 mb-3">
          Bağlandıktan ve reklam hesabı seçildikten sonra capabilities sonucunu alın.
        </p>
        <button
          type="button"
          onClick={handleFetchCapabilities}
          disabled={capLoading}
          className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 disabled:opacity-50 mb-3"
        >
          {capLoading ? 'Yükleniyor…' : 'Capabilities Al'}
        </button>
        {capabilities && (
          <pre className="mt-2 p-3 bg-gray-100 rounded text-caption overflow-auto max-h-64">
            {JSON.stringify(
              {
                ok: capabilities.ok,
                connected: capabilities.connected,
                grantedScopes: capabilities.grantedScopes,
                adAccountId: capabilities.adAccountId,
                features: capabilities.features,
                reasons: capabilities.reasons,
                assetsCount: {
                  pages: capabilities.assets?.pages?.length ?? 0,
                  pixels: capabilities.assets?.pixels?.length ?? 0,
                  leadForms: capabilities.assets?.leadForms?.length ?? 0,
                },
              },
              null,
              2
            )}
          </pre>
        )}
      </section>

      {/* Step 3: CTWA demo */}
      <section className="mb-8 p-4 bg-white rounded-lg border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">
          Adım 3: CTWA (Click-to-WhatsApp) Demo
        </h2>
        <p className="text-sm text-gray-600 mb-3">
          Kampanya sihirbazını açıp Traffic + WhatsApp hedefi ile minimal bir kampanya oluşturun.
        </p>
        <Link
          href="/dashboard/reklam/meta?tab=kampanyalar"
          className="inline-block px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700"
        >
          Meta Reklam Sayfasına Git → Yeni Kampanya
        </Link>
      </section>

      {/* Step 4: Lead demo */}
      <section className="mb-8 p-4 bg-white rounded-lg border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">
          Adım 4: Lead Form + Lead Retrieval
        </h2>
        <p className="text-sm text-gray-600 mb-3">
          Form ID girin (capabilities sonucundaki leadForms[].id), has-lead-access ve lead listesini çekin.
        </p>
        <div className="flex flex-wrap gap-2 items-center mb-3">
          <input
            type="text"
            value={leadFormId}
            onChange={(e) => setLeadFormId(e.target.value)}
            placeholder="Form ID"
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-64"
          />
          <button
            type="button"
            onClick={handleHasLeadAccess}
            className="px-4 py-2 bg-gray-700 text-white rounded-lg text-sm font-medium hover:bg-gray-800"
          >
            has-lead-access
          </button>
          <button
            type="button"
            onClick={handleFetchLeads}
            className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700"
          >
            Lead&apos;leri Çek
          </button>
        </div>
        {hasLeadAccess !== null && (
          <p className="text-sm text-gray-700 mb-2">
            Form <code className="bg-gray-100 px-1">{hasLeadAccess.formId}</code>: hasAccess ={' '}
            {String(hasLeadAccess.hasAccess)}
          </p>
        )}
        {leadsResult && (
          <pre className="p-3 bg-gray-100 rounded text-caption overflow-auto max-h-48">
            {leadsResult.error
              ? JSON.stringify({ error: leadsResult.error }, null, 2)
              : JSON.stringify({ count: (leadsResult.data ?? []).length, data: leadsResult.data }, null, 2)}
          </pre>
        )}
      </section>

      {/* Step 5: Log panel */}
      <section className="mb-8 p-4 bg-white rounded-lg border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">
          Adım 5: İstek Günlüğü (requestId, fbtrace_id, endpoint, status — token/PII yok)
        </h2>
        <div className="space-y-1 max-h-48 overflow-auto font-mono text-caption">
          {logEntries.length === 0 && <p className="text-gray-500">Henüz istek yok.</p>}
          {logEntries.map((e, i) => (
            <div key={i} className="flex gap-2 text-gray-700">
              <span>{e.endpoint}</span>
              <span>status: {e.status}</span>
              {e.requestId && <span>requestId: {e.requestId}</span>}
              {e.fbtrace_id && <span>fbtrace_id: {e.fbtrace_id}</span>}
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
