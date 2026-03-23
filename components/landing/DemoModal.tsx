'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'

/**
 * Demo video URL — change this single line when a real demo video is available.
 * Set to null to show "coming soon" state.
 */
const DEMO_VIDEO_URL: string | null = null

interface Props {
  label: string
  locale: string
  variant?: 'nav' | 'hero'
}

export default function DemoModal({ label, locale, variant = 'nav' }: Props) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const isEn = locale === 'en'

  useEffect(() => { setMounted(true) }, [])

  const t = isEn ? {
    title: 'Platform Demo',
    comingSoon: 'Demo video is being prepared.',
    comingSoonSub: 'In the meantime, start your free trial to explore the platform.',
    tryNow: 'Start Free Trial',
    close: 'Close',
  } : {
    title: 'Platform Demosu',
    comingSoon: 'Demo videosu hazırlanıyor.',
    comingSoonSub: 'Bu sırada platformu keşfetmek için ücretsiz denemenizi başlatın.',
    tryNow: 'Ücretsiz Dene',
    close: 'Kapat',
  }

  const btnClass = variant === 'hero'
    ? 'inline-flex items-center justify-center gap-2 border border-white/15 text-gray-300 hover:text-white hover:border-white/30 hover:bg-white/[0.06] font-semibold px-8 py-4 rounded-full transition-all text-base cursor-pointer min-w-[180px]'
    : 'btn-shimmer hidden sm:inline-flex items-center justify-center gap-1.5 font-semibold border border-emerald-400/40 text-emerald-400 hover:bg-emerald-400/10 px-6 py-2.5 rounded-full transition-colors cursor-pointer text-[13px]'

  const modalContent = open ? (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ fontSize: '16px' }} onClick={() => setOpen(false)}>
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" />
      <div className="relative bg-[#0c0c14] border border-white/[0.1] rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl shadow-black/50" onClick={e => e.stopPropagation()}>
        {/* Close */}
        <button onClick={() => setOpen(false)} className="absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-gray-400 hover:text-white transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>

        {DEMO_VIDEO_URL ? (
          <div className="aspect-video">
            <iframe src={DEMO_VIDEO_URL} className="w-full h-full" allow="autoplay; fullscreen" allowFullScreen />
          </div>
        ) : (
          <div className="text-center py-14 px-8">
            <div className="w-16 h-16 rounded-2xl bg-emerald-400/10 border border-emerald-400/20 flex items-center justify-center mx-auto mb-6">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="rgb(52,211,153)" stroke="none"><polygon points="5,3 19,12 5,21"/></svg>
            </div>
            <h3 className="text-xl font-bold text-white mb-3">{t.title}</h3>
            <p className="text-base text-gray-300 mb-1">{t.comingSoon}</p>
            <p className="text-base text-gray-500 mb-8">{t.comingSoonSub}</p>
            <div className="flex justify-center gap-3">
              <a href="/signup" className="text-sm font-semibold bg-emerald-500 hover:bg-emerald-400 text-black px-6 py-3 rounded-xl transition-colors">
                {t.tryNow}
              </a>
              <button onClick={() => setOpen(false)} className="text-sm font-medium text-gray-400 hover:text-white px-5 py-3 rounded-xl border border-white/10 hover:border-white/20 transition-colors">
                {t.close}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  ) : null

  return (
    <>
      <button onClick={() => setOpen(true)} className={btnClass}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5,3 19,12 5,21"/></svg>
        {label}
      </button>
      {mounted && modalContent && createPortal(modalContent, document.body)}
    </>
  )
}
