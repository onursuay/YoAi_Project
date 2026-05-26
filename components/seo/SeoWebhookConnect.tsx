'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  Loader2, Webhook, ChevronDown, ChevronUp, RefreshCw, Copy, Check, Code,
} from 'lucide-react'

interface Props {
  /** Bağlantı başarıyla eklenince listeyi tazelemek için. */
  onConnected: () => void
}

/* Geliştiriciye gösterilen örnek kodlar — API alanı adlarıdır, çeviriye tabi değildir. */
const HEADERS_SAMPLE = `X-YoAi-Event: article.publish
X-YoAi-Timestamp: 1716700000000
X-YoAi-Signature: sha256=<hmac>
Content-Type: application/json`

const PAYLOAD_SAMPLE = `{
  "event": "article.publish",
  "timestamp": 1716700000000,
  "article": {
    "title": "Örnek başlık",
    "html": "<h1>Örnek başlık</h1><p>...</p>",
    "markdown": "# Örnek başlık\\n...",
    "slug": "ornek-baslik",
    "metaDescription": "...",
    "featuredImageUrl": "https://cdn.../gorsel.jpg",
    "featuredImageAlt": "...",
    "tags": [],
    "status": "publish"
  }
}`

const NODE_SAMPLE = `// Node.js / Express
const crypto = require('crypto')

app.post('/api/yoai-webhook', express.raw({ type: '*/*' }), (req, res) => {
  const raw = req.body                 // ham gövde (parse edilmemiş!)
  const expected = 'sha256=' + crypto
    .createHmac('sha256', YOAI_SECRET)
    .update(raw)
    .digest('hex')
  const sig = req.get('X-YoAi-Signature') || ''
  if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) {
    return res.status(401).end()
  }
  const { article } = JSON.parse(raw.toString())
  // ...article ile kendi sisteminizde kayıt oluşturun...
  res.json({ url: 'https://siteniz.com/yazi/' + article.slug })
})`

const PHP_SAMPLE = `<?php // PHP
$raw = file_get_contents('php://input');
$expected = 'sha256=' . hash_hmac('sha256', $raw, $YOAI_SECRET);
$sig = $_SERVER['HTTP_X_YOAI_SIGNATURE'] ?? '';
if (!hash_equals($expected, $sig)) { http_response_code(401); exit; }
$data = json_decode($raw, true);
// ...$data['article'] ile kendi sisteminizde kayıt oluşturun...
http_response_code(200);
echo json_encode(['url' => 'https://siteniz.com/yazi/' . $data['article']['slug']]);`

export default function SeoWebhookConnect({ onConnected }: Props) {
  const t = useTranslations('dashboard.seo.articles.sites.webhook')

  const [open, setOpen] = useState(false)
  const [showDocs, setShowDocs] = useState(false)
  const [url, setUrl] = useState('')
  const [secret, setSecret] = useState('')
  const [label, setLabel] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const genSecret = () => {
    const a = new Uint8Array(24)
    crypto.getRandomValues(a)
    setSecret(Array.from(a, (b) => b.toString(16).padStart(2, '0')).join(''))
  }

  const copySecret = async () => {
    if (!secret) return
    try {
      await navigator.clipboard.writeText(secret)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* ignore */ }
  }

  const errText = (code: string): string => {
    switch (code) {
      case 'invalid_url': return t('errInvalidUrl')
      case 'weak_secret': return t('errWeakSecret')
      default: return t('errSaveFailed')
    }
  }

  const handleConnect = async () => {
    setError(null)
    setBusy(true)
    try {
      const res = await fetch('/api/seo/sites/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, secret, label }),
      })
      const data = await res.json()
      if (data.ok) {
        setUrl(''); setSecret(''); setLabel(''); setOpen(false)
        onConnected()
      } else {
        setError(errText(data.error))
      }
    } catch {
      setError(t('errSaveFailed'))
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-between gap-3 border border-dashed border-gray-300 rounded-xl p-4 text-left hover:border-primary/40 hover:bg-primary/5 transition-colors"
      >
        <span className="flex items-center gap-2.5">
          <Webhook className="w-4 h-4 text-gray-400" />
          <span>
            <span className="block text-sm font-medium text-gray-900">{t('title')}</span>
            <span className="block text-xs text-gray-500">{t('subtitle')}</span>
          </span>
        </span>
        <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
      </button>
    )
  }

  return (
    <div className="border border-primary/20 rounded-xl p-4 bg-primary/5 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <Webhook className="w-4 h-4" /> {t('title')}
        </h4>
        <button onClick={() => setOpen(false)} className="p-1 text-gray-400 hover:text-gray-600">
          <ChevronUp className="w-4 h-4" />
        </button>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">{t('urlLabel')}</label>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={t('urlPlaceholder')}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary/15 focus:border-primary"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">{t('secretLabel')}</label>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder={t('secretPlaceholder')}
            className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono bg-white focus:ring-2 focus:ring-primary/15 focus:border-primary"
          />
          <button
            onClick={genSecret}
            type="button"
            className="shrink-0 inline-flex items-center gap-1 px-2.5 py-2 text-xs text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
            title={t('generate')}
          >
            <RefreshCw className="w-3.5 h-3.5" /> {t('generate')}
          </button>
          <button
            onClick={copySecret}
            type="button"
            disabled={!secret}
            className="shrink-0 inline-flex items-center gap-1 px-2.5 py-2 text-xs text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40"
            title={t('copy')}
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-1">{t('secretHint')}</p>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">{t('labelLabel')}</label>
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={t('labelPlaceholder')}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary/15 focus:border-primary"
        />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-2.5 text-xs text-red-700">{error}</div>
      )}

      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => setShowDocs((v) => !v)}
          className="inline-flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-900"
        >
          <Code className="w-3.5 h-3.5" /> {t('howTitle')}
          {showDocs ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
        <button
          onClick={handleConnect}
          disabled={busy || !url.trim() || secret.trim().length < 8}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50"
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Webhook className="w-3.5 h-3.5" />}
          {busy ? t('connecting') : t('connect')}
        </button>
      </div>

      {showDocs && (
        <div className="border-t border-primary/15 pt-3 space-y-3 text-xs text-gray-600">
          <p className="leading-relaxed">{t('howIntro')}</p>

          <div>
            <p className="font-medium text-gray-700 mb-1">{t('howHeaders')}</p>
            <pre className="bg-white border border-gray-200 rounded-lg p-3 overflow-x-auto text-[11px] leading-relaxed text-gray-700">{HEADERS_SAMPLE}</pre>
          </div>

          <div>
            <p className="font-medium text-gray-700 mb-1">{t('howPayload')}</p>
            <pre className="bg-white border border-gray-200 rounded-lg p-3 overflow-x-auto text-[11px] leading-relaxed text-gray-700">{PAYLOAD_SAMPLE}</pre>
          </div>

          <div>
            <p className="font-medium text-gray-700 mb-1">{t('howVerifyNode')}</p>
            <pre className="bg-white border border-gray-200 rounded-lg p-3 overflow-x-auto text-[11px] leading-relaxed text-gray-700">{NODE_SAMPLE}</pre>
          </div>

          <div>
            <p className="font-medium text-gray-700 mb-1">{t('howVerifyPhp')}</p>
            <pre className="bg-white border border-gray-200 rounded-lg p-3 overflow-x-auto text-[11px] leading-relaxed text-gray-700">{PHP_SAMPLE}</pre>
          </div>

          <p className="leading-relaxed">{t('howResponse')}</p>
        </div>
      )}
    </div>
  )
}
