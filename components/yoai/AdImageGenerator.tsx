'use client'

import { useState, useEffect } from 'react'
import { Image as ImageIcon, Loader2, RefreshCcw } from 'lucide-react'

interface Props {
  prompt: string // Ad primary text or headline used as image prompt
  aspectRatio?: string
  className?: string
}

export default function AdImageGenerator({ prompt, aspectRatio = '1:1', className = '' }: Props) {
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  const generateImage = async () => {
    if (!prompt || loading) return
    setLoading(true)
    setError(false)

    try {
      // First enhance the prompt for better image generation
      const enhanceRes = await fetch('/api/tasarim/enhance-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `Dijital reklam görseli: ${prompt}. Profesyonel, modern, temiz arka plan, ürün/hizmet odaklı.`,
          locale: 'tr',
        }),
      })

      let imagePrompt = prompt
      if (enhanceRes.ok) {
        const enhanceData = await enhanceRes.json()
        if (enhanceData.enhanced) imagePrompt = enhanceData.enhanced
      }

      // Generate image
      const res = await fetch('/api/tasarim/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: imagePrompt,
          aspect_ratio: aspectRatio,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        if (data.url) {
          setImageUrl(data.url)
          // Cache in session
          try {
            const cacheKey = `yoai_adimg_${btoa(prompt).slice(0, 20)}`
            sessionStorage.setItem(cacheKey, data.url)
          } catch { /* ignore */ }
        } else {
          setError(true)
        }
      } else {
        setError(true)
      }
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  // Check cache on mount
  useEffect(() => {
    try {
      const cacheKey = `yoai_adimg_${btoa(prompt).slice(0, 20)}`
      const cached = sessionStorage.getItem(cacheKey)
      if (cached) {
        setImageUrl(cached)
        return
      }
    } catch { /* ignore */ }
  }, [prompt])

  if (imageUrl) {
    return (
      <div className={`relative group ${className}`}>
        <img src={imageUrl} alt="Reklam görseli" className="w-full h-full object-cover" />
        <button
          onClick={(e) => { e.stopPropagation(); setImageUrl(null); generateImage() }}
          className="absolute top-2 right-2 w-6 h-6 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <RefreshCcw className="w-3 h-3 text-white" />
        </button>
      </div>
    )
  }

  return (
    <div className={`flex flex-col items-center justify-center gap-2 ${className}`}>
      {loading ? (
        <>
          <Loader2 className="w-5 h-5 text-primary animate-spin" />
          <span className="text-[10px] text-gray-400">Görsel oluşturuluyor...</span>
        </>
      ) : error ? (
        <>
          <ImageIcon className="w-5 h-5 text-gray-300" />
          <button
            onClick={(e) => { e.stopPropagation(); generateImage() }}
            className="text-[10px] text-primary hover:underline"
          >
            Tekrar dene
          </button>
        </>
      ) : (
        <button
          onClick={(e) => { e.stopPropagation(); generateImage() }}
          className="flex flex-col items-center gap-1.5 hover:opacity-80 transition-opacity"
        >
          <ImageIcon className="w-5 h-5 text-primary/50" />
          <span className="text-[10px] text-primary font-medium">AI Görsel Oluştur</span>
        </button>
      )}
    </div>
  )
}
