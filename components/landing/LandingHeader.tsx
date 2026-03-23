'use client'

import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import ScheduleModal from './ScheduleModal'

interface Props {
  locale: string
  ctaSchedule: string
  ctaTrial: string
  ctaDemo: string
}

const productItems = [
  { icon: 'target', label: { tr: 'Strateji', en: 'Strategy' }, desc: { tr: 'Yapay zeka destekli reklam stratejileriyle tek tıkla reklamlarınızı otomatikleştirin', en: 'Automate your ads with AI-powered strategies' }, href: '/strateji' },
  { icon: 'trending', label: { tr: 'Optimizasyon', en: 'Optimization' }, desc: { tr: 'Optimizasyon kurallarıyla reklamlarınızı optimize et', en: 'Optimize your ads with smart rules' }, href: '/optimizasyon' },
  { icon: 'users', label: { tr: 'Hedef Kitle', en: 'Audience' }, desc: { tr: 'Yapay zeka algoritmaları ile en doğru hedef kitlelere ulaş', en: 'Reach the right audiences with AI' }, href: '/hedef-kitle' },
  { icon: 'search', label: { tr: 'SEO', en: 'SEO' }, desc: { tr: 'SEO analizini saniyeler içinde gerçekleştir, ekstra araçlara gerek kalmadan öne çık', en: 'Run SEO analysis in seconds' }, href: '/seo' },
  { icon: 'image', label: { tr: 'Tasarım', en: 'Design' }, desc: { tr: 'Reklam tasarımlarını kolayca hazırla', en: 'Easily prepare ad designs' }, href: '/tasarim' },
  { icon: 'sparkle', label: { tr: 'YoAi', en: 'YoAi' }, desc: { tr: 'Blog ve görsel içeriklerinizi anında üret', en: 'Generate content instantly' }, href: '/yoai' },
]

const integrationItems = [
  { icon: 'meta', label: { tr: 'Meta', en: 'Meta' }, desc: { tr: 'Facebook, Instagram, WhatsApp reklamlarını kolayca yönet', en: 'Manage Facebook, Instagram, WhatsApp ads' }, href: '/meta-ads' },
  { icon: 'google', label: { tr: 'Google', en: 'Google' }, desc: { tr: 'Google Ads ve YouTube reklamları ile potansiyel müşterilere ulaş', en: 'Reach customers with Google Ads' }, href: '/google-ads' },
  { icon: 'analytics', label: { tr: 'Google Analytics', en: 'Google Analytics' }, desc: { tr: 'İstediğin metriklere kolayca ulaş', en: 'Access the metrics you need' }, href: '/dashboard/entegrasyon' },
  { icon: 'console', label: { tr: 'Search Console', en: 'Search Console' }, desc: { tr: 'Site analizi, anahtar kelime takibi ve sıralama optimizasyonu', en: 'Site analysis and keyword tracking' }, href: '/seo' },
]

const menuIcons: Record<string, string> = {
  target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  trending: '<polyline points="23,6 13.5,15.5 8.5,10.5 1,18"/><polyline points="17,6 23,6 23,12"/>',
  users: '<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21,15 16,10 5,21"/>',
  sparkle: '<path d="M12 2L9 12l-7 0 5.5 4.5L5 22l7-5 7 5-2.5-5.5L22 12h-7z"/>',
  meta: '<path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z"/>',
  google: '<text x="4" y="18" font-size="20" font-weight="bold" font-family="Arial,sans-serif" fill="currentColor" stroke="none">G</text>',
  analytics: '<path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/>',
  console: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/><path d="M7 10l3 2-3 2"/><path d="M13 14h4"/>',
}

function MIcon({ name }: { name: string }) {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: menuIcons[name] || '' }} />
}

/* Shared pill style — same as "7 Gün Ücretsiz Dene" */
const pillBase = 'btn-shimmer text-[14px] font-medium border border-emerald-400/30 text-emerald-400 px-5 py-2 rounded-full transition-colors cursor-pointer'

export default function LandingHeader({ locale, ctaSchedule, ctaTrial }: Props) {
  const isEn = locale === 'en'
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>()
  const headerRef = useRef<HTMLDivElement>(null)

  const handleEnter = (menu: string) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setOpenMenu(menu)
  }
  const handleLeave = () => {
    timeoutRef.current = setTimeout(() => setOpenMenu(null), 200)
  }

  useEffect(() => {
    const fn = (e: MouseEvent) => { if (headerRef.current && !headerRef.current.contains(e.target as Node)) setOpenMenu(null) }
    document.addEventListener('click', fn)
    return () => document.removeEventListener('click', fn)
  }, [])

  return (
    <header className="w-full sticky top-0 z-50 bg-[#060609]/80 backdrop-blur-2xl" ref={headerRef}>
      <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-3">

        {/* Logo — smaller */}
        <Link href="/" className="shrink-0">
          <Image src="/logos/yoai-logo.png" alt="YoAi" width={56} height={22} className="object-contain brightness-0 invert" />
        </Link>

        {/* Center nav — all pills */}
        <nav className="hidden lg:flex items-center gap-2">
          {/* Ürün */}
          <div className="relative" onMouseEnter={() => handleEnter('product')} onMouseLeave={handleLeave}>
            <button className={`${pillBase} flex items-center gap-1.5 hover:bg-emerald-400/10`}>
              {isEn ? 'Product' : 'Ürün'}
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 9l6 6 6-6"/></svg>
            </button>
            {openMenu === 'product' && (
              <div className="absolute top-full left-0 mt-2 w-[560px] bg-[#1a1d21] border border-white/[0.06] rounded-2xl p-4 shadow-2xl shadow-black/50" onMouseEnter={() => handleEnter('product')} onMouseLeave={handleLeave}>
                <div className="grid grid-cols-3 gap-2">
                  {productItems.map((item, i) => (
                    <Link key={i} href={item.href} className="flex flex-col gap-1 p-3 rounded-xl hover:bg-white/[0.04] transition-colors group" onClick={() => setOpenMenu(null)}>
                      <div className="flex items-center gap-2 text-gray-200 group-hover:text-emerald-400 transition-colors">
                        <MIcon name={item.icon} />
                        <span className="text-[13px] font-semibold">{isEn ? item.label.en : item.label.tr}</span>
                      </div>
                      <p className="text-[11px] text-[#8a8f98] leading-relaxed">{isEn ? item.desc.en : item.desc.tr}</p>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Entegrasyonlar */}
          <div className="relative" onMouseEnter={() => handleEnter('integrations')} onMouseLeave={handleLeave}>
            <button className={`${pillBase} flex items-center gap-1.5 hover:bg-emerald-400/10`}>
              {isEn ? 'Integrations' : 'Entegrasyonlar'}
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 9l6 6 6-6"/></svg>
            </button>
            {openMenu === 'integrations' && (
              <div className="absolute top-full left-0 mt-2 w-[480px] bg-[#1a1d21] border border-white/[0.06] rounded-2xl p-4 shadow-2xl shadow-black/50" onMouseEnter={() => handleEnter('integrations')} onMouseLeave={handleLeave}>
                <div className="grid grid-cols-2 gap-2">
                  {integrationItems.map((item, i) => (
                    <Link key={i} href={item.href} className="flex flex-col gap-1 p-3 rounded-xl hover:bg-white/[0.04] transition-colors group" onClick={() => setOpenMenu(null)}>
                      <div className="flex items-center gap-2 text-gray-200 group-hover:text-emerald-400 transition-colors">
                        <MIcon name={item.icon} />
                        <span className="text-[13px] font-semibold">{isEn ? item.label.en : item.label.tr}</span>
                      </div>
                      <p className="text-[11px] text-[#8a8f98] leading-relaxed">{isEn ? item.desc.en : item.desc.tr}</p>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Fiyatlandırma */}
          <Link href="/abonelik" className={`${pillBase} hover:bg-emerald-400/10`}>
            {isEn ? 'Pricing' : 'Fiyatlandırma'}
          </Link>
        </nav>

        {/* Right CTAs */}
        <div className="flex items-center gap-2.5">
          <Link href="/login" className="hidden lg:inline-flex text-[14px] font-medium text-gray-400 hover:text-white px-3 py-2 transition-colors">
            {isEn ? 'Log In' : 'Giriş Yap'}
          </Link>
          <ScheduleModal label={ctaSchedule} locale={locale} />
          <Link href="/signup" className={`${pillBase} hover:bg-emerald-400/10`}>
            {ctaTrial}
          </Link>
        </div>

      </div>
      <div className="h-[1px] bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent" />
    </header>
  )
}
