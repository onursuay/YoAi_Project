import Link from 'next/link'
import Image from 'next/image'
import { cookies } from 'next/headers'
import { getTranslations } from 'next-intl/server'
import LandingHeader from '@/components/landing/LandingHeader'
import ScheduleModal from '@/components/landing/ScheduleModal'
import PricingPlans from '@/components/landing/PricingPlans'

/**
 * Public pricing page (no auth). The header "Fiyatlandırma" link points here so
 * prices are visible without logging in. The authenticated /abonelik page still
 * handles real checkout + current-plan state for signed-in users.
 */
export default async function FiyatlandirmaPage() {
  const cookieStore = await cookies()
  const locale = cookieStore.get('NEXT_LOCALE')?.value || 'tr'
  const isEn = locale === 'en'
  const t = await getTranslations({ locale, namespace: 'pricing' })

  const ctaTrial = isEn ? '7-Day Free Trial' : '7 Gün Ücretsiz Dene'
  const ctaSchedule = isEn ? 'Book a Call' : 'Görüşme Planla'
  const footerText = isEn ? '2025 YO Dijital. All rights reserved.' : '2025 YO Dijital. Tüm hakları saklıdır.'

  // Legal links — locale-aware URLs (EN uses /en/ prefix for compliance), matching the landing footer.
  const legal = {
    privacy: { label: isEn ? 'Privacy Policy' : 'Gizlilik Politikası', href: isEn ? '/en/privacy-policy' : '/gizlilik-politikasi' },
    cookie: { label: isEn ? 'Cookie Policy' : 'Çerez Politikası', href: isEn ? '/en/cookie-policy' : '/cerez-politikasi' },
    terms: { label: isEn ? 'Terms of Service' : 'Kullanım Koşulları', href: isEn ? '/en/terms-of-service' : '/kullanim-kosullari' },
    dataDeletion: { label: isEn ? 'Data Deletion' : 'Veri Silme', href: isEn ? '/en/data-deletion' : '/veri-silme' },
  }

  return (
    <div className="min-h-screen bg-[#060609] text-white flex flex-col overflow-x-hidden" style={{ fontSize: '16px' }}>
      {/* Shimmer animation for header buttons (same as landing) */}
      <style dangerouslySetInnerHTML={{ __html: `
        .btn-shimmer { position: relative; overflow: hidden; }
        .btn-shimmer::after {
          content: '';
          position: absolute;
          top: 0; left: -60%; width: 60%; height: 100%;
          background: linear-gradient(90deg, transparent, rgba(16,185,129,0.18), transparent);
          animation: shimmer-slide 6s ease-in-out infinite;
          opacity: 0;
        }
        @keyframes shimmer-slide {
          0% { left: -60%; opacity: 0; }
          5% { opacity: 1; }
          25% { left: 100%; opacity: 1; }
          30% { opacity: 0; }
          100% { opacity: 0; left: 100%; }
        }
      ` }} />

      {/* ═══════════ HEADER ═══════════ */}
      <LandingHeader locale={locale} ctaSchedule={ctaSchedule} ctaTrial={ctaTrial} />

      {/* ═══════════ HERO ═══════════ */}
      <section className="relative w-full px-6 pt-14 pb-8 md:pt-20 md:pb-10 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div className="absolute top-[10%] left-1/2 -translate-x-1/2 w-[900px] h-[600px] rounded-full blur-[160px]" style={{ background: 'radial-gradient(ellipse, rgba(16,185,129,0.07) 0%, rgba(20,184,166,0.03) 50%, transparent 80%)' }} />
        </div>
        <div className="relative max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2.5 text-[14px] font-medium text-emerald-400/90 border border-emerald-400/20 bg-emerald-400/[0.06] px-5 py-2.5 rounded-full mb-6">
            <Image src="/icons/ai-brain.png" alt="" width={18} height={18} style={{ filter: 'brightness(0) saturate(100%) invert(73%) sepia(52%) saturate(456%) hue-rotate(108deg) brightness(95%) contrast(91%)' }} />
            {t('badge')}
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-[2.5rem] xl:text-5xl 2xl:text-6xl lg:whitespace-nowrap font-black leading-[1.1] tracking-tight text-white mb-5">
            {t('heroTitle')}{' '}
            <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">{t('heroTitleAccent')}</span>
          </h1>
          <div className="text-lg md:text-xl text-gray-300 leading-relaxed space-y-1">
            <p className="lg:whitespace-nowrap">{t('heroSubtitle')}</p>
            <p className="lg:whitespace-nowrap">{t('heroSubtitle2')}</p>
          </div>
        </div>
      </section>

      {/* ═══════════ PLANS ═══════════ */}
      <section className="w-full px-6 pb-4 md:pb-5">
        <PricingPlans />
      </section>

      {/* ═══════════ BOTTOM CTA ═══════════ */}
      <section className="relative w-full px-6 pt-4 pb-14 md:pt-5 md:pb-20">
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full blur-[150px]" style={{ background: 'radial-gradient(ellipse, rgba(16,185,129,0.08), transparent 70%)' }} />
        </div>
        <div className="relative max-w-2xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">{t('ctaTitle')}</h2>
          <p className="text-base text-gray-500 mb-6 max-w-md mx-auto leading-relaxed">{t('ctaSubtitle')}</p>
          <div className="flex flex-wrap justify-center items-center gap-3">
            <Link
              href="/signup"
              className="btn-shimmer inline-flex items-center gap-2 text-[14px] font-semibold bg-gradient-to-r from-emerald-500 to-teal-500 text-black hover:from-emerald-400 hover:to-teal-400 px-7 py-3 rounded-full transition-all shadow-[0_0_30px_rgba(16,185,129,0.2)]"
            >
              {t('ctaButton')}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M12 5l7 7-7 7" /></svg>
            </Link>
            <ScheduleModal label={ctaSchedule} locale={locale} variant="bottom" />
          </div>
        </div>
      </section>

      {/* ═══════════ FOOTER ═══════════ */}
      <footer className="w-full border-t border-white/[0.05] py-6 px-6 bg-[#060609] mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
          <div className="flex items-center gap-3 text-gray-500">
            <Image src="/logos/yoai-logo.png" alt="YoAI" width={40} height={16} className="object-contain brightness-0 invert opacity-40" />
            <span>{footerText}</span>
          </div>
          <nav className="flex gap-5 text-gray-500">
            <a href={legal.privacy.href} className="hover:text-gray-300 transition-colors">{legal.privacy.label}</a>
            <a href={legal.cookie.href} className="hover:text-gray-300 transition-colors">{legal.cookie.label}</a>
            <a href={legal.terms.href} className="hover:text-gray-300 transition-colors">{legal.terms.label}</a>
            <a href={legal.dataDeletion.href} className="hover:text-gray-300 transition-colors">{legal.dataDeletion.label}</a>
          </nav>
        </div>
      </footer>
    </div>
  )
}
