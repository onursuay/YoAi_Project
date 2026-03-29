'use client'

import { useState, useEffect, useRef } from 'react'
import { Loader2, RefreshCcw } from 'lucide-react'

interface Props {
  prompt: string
  aspectRatio?: string
  className?: string
}

export default function AdImageGenerator({ prompt, aspectRatio = '1:1', className = '' }: Props) {
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const generatedRef = useRef(false)

  const generateImage = async () => {
    if (!prompt || loading) return
    setLoading(true)
    setError(false)

    try {
      // Enhance prompt
      const enhanceRes = await fetch('/api/tasarim/enhance-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: `Dijital reklam görseli: ${prompt}. Profesyonel, modern, temiz.`, locale: 'tr' }),
      })

      let imagePrompt = prompt
      if (enhanceRes.ok) {
        const d = await enhanceRes.json()
        if (d.enhanced) imagePrompt = d.enhanced
      }

      const res = await fetch('/api/tasarim/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: imagePrompt, aspect_ratio: aspectRatio }),
      })

      if (res.ok) {
        const data = await res.json()
        if (data.url) {
          setImageUrl(data.url)
          try { sessionStorage.setItem(`yoai_adimg_${btoa(prompt).slice(0, 20)}`, data.url) } catch {}
        } else { setError(true) }
      } else { setError(true) }
    } catch { setError(true) }
    finally { setLoading(false) }
  }

  // Check cache on mount (don't auto-generate)
  useEffect(() => {
    try {
      const cached = sessionStorage.getItem(`yoai_adimg_${btoa(prompt).slice(0, 20)}`)
      if (cached) setImageUrl(cached)
    } catch {}
  }, [prompt])

  if (imageUrl) {
    return (
      <div className={`relative group ${className}`}>
        <img src={imageUrl} alt="Reklam görseli" className="w-full h-full object-cover" />
        <button
          onClick={(e) => { e.stopPropagation(); setImageUrl(null); generatedRef.current = false; generateImage() }}
          className="absolute top-2 right-2 w-6 h-6 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <RefreshCcw className="w-3 h-3 text-white" />
        </button>
      </div>
    )
  }

  return (
    <div className={`flex flex-col items-center justify-center gap-1.5 ${className}`}>
      {loading ? (
        <>
          <Loader2 className="w-5 h-5 text-primary animate-spin" />
          <span className="text-[10px] text-gray-400">Görsel oluşturuluyor...</span>
        </>
      ) : error ? (
        <button onClick={(e) => { e.stopPropagation(); generateImage() }} className="text-[10px] text-primary hover:underline">
          Tekrar dene
        </button>
      ) : (
        <button onClick={(e) => { e.stopPropagation(); generateImage() }} className="flex flex-col items-center gap-1">
          <span className="text-[10px] text-primary font-medium hover:underline">AI Görsel Oluştur</span>
        </button>
      )}
    </div>
  )
}
