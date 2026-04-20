'use client'

/* ──────────────────────────────────────────────────────────
   YoAlgoritma — Meta Creative Panel

   Preflight sonrası gelen adım. Akış:
   1) AI görsel üret (tasarim/enhance-prompt + tasarim/generate-image)
   2) Görseli Meta'ya yükle (/api/meta/upload-media) → imageHash
   3) Metin alanlarını kullanıcıya göster (öneriden gelen değerler)
   4) onConfirm(creative) ile parent'a ilet

   Parent (wizard) bu creative'i create-ad'e gönderir;
   orchestrator ad+creative adımını gerçek çalıştırır.
   ────────────────────────────────────────────────────────── */

import { useEffect, useState } from 'react'
import { Loader2, RefreshCcw, CheckCircle2, AlertTriangle } from 'lucide-react'

export interface MetaCreativePayload {
  format: 'single_image'
  primaryText: string
  headline?: string
  description?: string
  callToAction?: string
  websiteUrl?: string
  imageHash: string
  imageUrl: string
}

interface Props {
  /** Öneriden gelen metinler */
  primaryText: string
  headline?: string
  description?: string
  callToAction?: string
  websiteUrl?: string | null
  /** Görsel prompt'u (genelde headline + description) */
  imagePrompt: string
  onBack: () => void
  onConfirm: (creative: MetaCreativePayload) => void
}

type Phase = 'generating' | 'preview' | 'uploading' | 'ready' | 'error'

export default function MetaCreativePanel({
  primaryText: initialPrimaryText,
  headline,
  description,
  callToAction,
  websiteUrl,
  imagePrompt,
  onBack,
  onConfirm,
}: Props) {
  const [phase, setPhase] = useState<Phase>('generating')
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [imageHash, setImageHash] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [primaryText, setPrimaryText] = useState(initialPrimaryText || '')

  async function generate() {
    setPhase('generating')
    setErr(null)
    setImageUrl(null)
    setImageHash(null)
    try {
      // 1) Enhance prompt
      const enhRes = await fetch('/api/tasarim/enhance-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `Dijital reklam görseli: ${imagePrompt}. Profesyonel, modern, temiz arka plan. NO TEXT on image, no words, no letters, no typography, purely visual content only.`,
          locale: 'tr',
        }),
      })
      let enhanced = imagePrompt
      if (enhRes.ok) {
        const d = await enhRes.json()
        if (d.enhanced) enhanced = d.enhanced
      }

      // 2) Generate image
      const genRes = await fetch('/api/tasarim/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: enhanced, aspect_ratio: '1:1' }),
      })
      if (!genRes.ok) throw new Error('Görsel üretilemedi.')
      const genData = await genRes.json()
      const url: string | undefined = genData.url
      if (!url) throw new Error('Görsel URL alınamadı.')
      setImageUrl(url)
      setPhase('preview')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Bilinmeyen hata')
      setPhase('error')
    }
  }

  async function uploadToMeta() {
    if (!imageUrl) return
    setPhase('uploading')
    setErr(null)
    try {
      // Fetch generated image and convert to File
      const imgRes = await fetch(imageUrl)
      if (!imgRes.ok) throw new Error('Görsel indirilemedi.')
      const blob = await imgRes.blob()
      const file = new File([blob], `yoai-ad-${Date.now()}.png`, {
        type: blob.type || 'image/png',
      })

      const fd = new FormData()
      fd.append('file', file)
      fd.append('type', 'image')

      const up = await fetch('/api/meta/upload-media', { method: 'POST', body: fd })
      const upData = await up.json().catch(() => ({}))
      if (!up.ok || !upData.ok || !upData.hash) {
        throw new Error(upData.message || upData.error || 'Meta yüklemesi başarısız.')
      }
      setImageHash(upData.hash)
      setPhase('ready')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Yükleme hatası')
      setPhase('error')
    }
  }

  useEffect(() => {
    generate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imagePrompt])

  const handleConfirm = () => {
    if (!imageHash || !imageUrl) return
    onConfirm({
      format: 'single_image',
      primaryText,
      headline,
      description,
      callToAction,
      websiteUrl: websiteUrl || undefined,
      imageHash,
      imageUrl,
    })
  }

  return (
    <div className="space-y-4">
      {/* Image preview area */}
      <div className="aspect-square w-full max-w-sm mx-auto rounded-xl overflow-hidden border border-gray-200 bg-gray-50 flex items-center justify-center">
        {imageUrl ? (
          <img src={imageUrl} alt="Reklam görseli" className="w-full h-full object-cover" />
        ) : phase === 'generating' ? (
          <div className="flex flex-col items-center gap-2 text-gray-500">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <span className="text-xs">AI görsel üretiliyor…</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-gray-400 text-xs">Görsel yok</div>
        )}
      </div>

      {/* Regenerate */}
      {phase !== 'uploading' && imageUrl && (
        <div className="flex justify-center">
          <button
            onClick={generate}
            className="inline-flex items-center gap-1.5 text-xs text-gray-600 hover:text-primary"
          >
            <RefreshCcw className="w-3 h-3" /> Yeniden üret
          </button>
        </div>
      )}

      {/* Ad text (editable primaryText) */}
      <div className="border border-gray-200 rounded-xl p-4 space-y-3">
        <div>
          <p className="text-xs font-semibold text-gray-700 mb-1">Birincil Metin</p>
          <textarea
            value={primaryText}
            onChange={(e) => setPrimaryText(e.target.value)}
            rows={3}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        {headline && (
          <div>
            <p className="text-xs font-semibold text-gray-700 mb-1">Başlık</p>
            <p className="text-sm text-gray-900">{headline}</p>
          </div>
        )}
        {description && (
          <div>
            <p className="text-xs font-semibold text-gray-700 mb-1">Açıklama</p>
            <p className="text-sm text-gray-600">{description}</p>
          </div>
        )}
        <div className="flex items-center gap-4 text-xs text-gray-500">
          {callToAction && <span>CTA: <strong className="text-gray-800">{callToAction}</strong></span>}
          {websiteUrl && <span className="truncate">URL: {websiteUrl}</span>}
        </div>
      </div>

      {/* Meta upload status */}
      {phase === 'preview' && imageUrl && (
        <button
          onClick={uploadToMeta}
          className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-sm font-medium"
        >
          Görseli Meta'ya Yükle
        </button>
      )}

      {phase === 'uploading' && (
        <div className="flex items-center justify-center gap-2 py-2 text-sm text-gray-600">
          <Loader2 className="w-4 h-4 animate-spin" /> Meta'ya yükleniyor…
        </div>
      )}

      {phase === 'ready' && imageHash && (
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5 text-sm text-emerald-800">
          <CheckCircle2 className="w-4 h-4" />
          Görsel Meta'ya yüklendi (imageHash hazır).
        </div>
      )}

      {phase === 'error' && err && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p>{err}</p>
            <button
              onClick={() => (imageUrl ? uploadToMeta() : generate())}
              className="text-xs underline mt-1"
            >
              Tekrar dene
            </button>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-2">
        <button onClick={onBack} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
          Geri
        </button>
        <button
          onClick={handleConfirm}
          disabled={phase !== 'ready' || !imageHash || !primaryText.trim()}
          className={`px-6 py-2.5 rounded-xl text-sm font-medium transition-colors ${
            phase !== 'ready' || !imageHash || !primaryText.trim()
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
              : 'bg-primary text-white hover:bg-primary/90'
          }`}
        >
          Kampanyayı Oluştur (PAUSED)
        </button>
      </div>
    </div>
  )
}
