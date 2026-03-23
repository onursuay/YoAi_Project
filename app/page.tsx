import Link from 'next/link'
import Image from 'next/image'
import { cookies } from 'next/headers'
import ScheduleModal from '@/components/landing/ScheduleModal'
import DemoModal from '@/components/landing/DemoModal'

export default async function RootPage() {
  const cookieStore = await cookies()
  const locale = cookieStore.get('NEXT_LOCALE')?.value || 'tr'
  const isEn = locale === 'en'

  /* ────────────────────── Content ────────────────────── */

  const c = isEn ? {
    badge: 'AI-Powered All-in-One Marketing',
    heroLine1: 'AI-Powered All-in-One',
    heroLine2: 'Marketing Management',
    heroSub: 'YoAi lets you create ad campaigns, generate creatives and manage SEO processes from a single hub. Built for agencies, brands and digital experts — reduce operational overhead, sharpen your performance focus.',
    ctaTrial: '7-Day Free Trial',
    ctaSchedule: 'Book a Call',
    ctaDemo: 'Watch Demo',
    trustLabel: 'Powering ads across leading platforms',
    capTitle: 'Built for Modern Advertisers',
    capSub: 'Six core modules that replace your entire ad ops stack.',
    caps: [
      { title: 'Campaign Engine', desc: 'Launch and manage campaigns across Google and Meta from a unified interface with AI-guided setup.', svg: 'layers' },
      { title: 'Audience Intelligence', desc: 'Discover high-value segments, build lookalike audiences and refine targeting with machine learning.', svg: 'users' },
      { title: 'Creative Studio', desc: 'Generate ad variations, preview placements across formats and A/B test creatives with AI scoring.', svg: 'palette' },
      { title: 'Performance Engine', desc: 'Real-time anomaly detection, trend analysis and automated alerts before metrics decline.', svg: 'chart' },
      { title: 'Budget Optimizer', desc: 'AI redistributes spend across campaigns in real-time to maximize ROAS and minimize waste.', svg: 'coins' },
      { title: 'Auto Reporting', desc: 'Scheduled reports, custom KPI dashboards and proactive insights delivered automatically.', svg: 'file' },
    ],
    perfTitle: 'Results That Speak',
    perfSub: 'Real metrics. Real impact. Powered by AI that never sleeps.',
    perfs: [
      { metric: '4.2x', label: 'Average ROAS', desc: 'AI-optimized campaigns consistently outperform manual management.' },
      { metric: '+38%', label: 'Conversion Lift', desc: 'Smart audience targeting and bid optimization drive measurable results.' },
      { metric: '60%', label: 'Time Saved', desc: 'Automation handles reporting, alerts and budget reallocation.' },
    ],
    cmdTitle: 'Your Command Center',
    cmdSub: 'One screen. Every platform. Total control.',
    cmds: [
      { title: 'One-Click Actions', desc: 'Pause, activate, scale or reallocate budgets across all campaigns instantly.' },
      { title: 'Predictive Alerts', desc: 'AI detects anomalies and flags risks before they impact your bottom line.' },
      { title: 'Unified Analytics', desc: 'Google Ads and Meta Ads KPIs side by side in a single real-time dashboard.' },
      { title: 'Smart Automation', desc: 'Rules engine that auto-adjusts bids, budgets and schedules based on performance.' },
    ],
    ctaBottom: 'Ready to transform your ad operations?',
    ctaBottomSub: 'Start your 7-day free trial. No credit card required.',
    panelTitle: 'Campaign Command',
    panelPeriod: 'Last 30 days',
    panelStatus: 'All systems operational',
    kpis: [
      { label: 'Ad Spend', value: '$5,840', delta: '+12%' },
      { label: 'ROAS', value: '4.2x', delta: '+0.8x' },
      { label: 'Conversions', value: '1,248', delta: '+18%' },
      { label: 'CTR', value: '3.6%', delta: '+0.4%' },
    ],
    panelAI: 'AI Optimization: Active',
    panelPlatforms: '2 platforms synced',
    footer: '2025 YO Dijital. All rights reserved.',
  } : {
    badge: 'Yapay Zeka Destekli Hepsi Bir Arada Pazarlama',
    heroLine1: 'Yapay Zeka Destekli',
    heroLine2: 'Hepsi Bir Arada Pazarlama Yönetimi',
    heroSub: 'YoAi, reklam kampanyalarınızı oluşturmanızı, kreatiflerinizi üretmenizi ve SEO süreçlerinizi tek merkezden kolayca yönetmenizi sağlar. Ajanslar, markalar ve dijital uzmanlar için geliştirilen bu yapı sayesinde operasyonel yükünüz azalır, performans odağınız güçlenir.',
    ctaTrial: '7 Gün Ücretsiz Dene',
    ctaSchedule: 'Görüşme Planla',
    ctaDemo: 'Demo İzle',
    trustLabel: 'Lider platformlarda reklam yönetimi',
    capTitle: 'Modern Reklamcılar İçin Tasarlandı',
    capSub: 'Tüm reklam operasyonlarınızın yerini alan altı temel modül.',
    caps: [
      { title: 'Kampanya Motoru', desc: 'AI destekli kurulumla Google ve Meta kampanyalarını tek arayüzden başlatıp yönetin.', svg: 'layers' },
      { title: 'Hedef Kitle Zekası', desc: 'Yüksek değerli segmentleri keşfedin, benzer kitleler oluşturun ve hedeflemeyi makine öğrenimi ile iyileştirin.', svg: 'users' },
      { title: 'Kreatif Stüdyo', desc: 'Reklam varyasyonları üretin, formatlarda önizleyin ve AI puanlamasıyla A/B test yapın.', svg: 'palette' },
      { title: 'Performans Motoru', desc: 'Gerçek zamanlı anomali tespiti, trend analizi ve metrikler düşüşmeden otomatik uyarılar.', svg: 'chart' },
      { title: 'Bütçe Optimizasyonu', desc: 'AI, ROAS\'ı maksimize etmek ve israfı minimize etmek için harcamayı gerçek zamanlı yeniden dağıtır.', svg: 'coins' },
      { title: 'Oto Raporlama', desc: 'Zamanlanmış raporlar, özel KPI panoları ve otomatik teslim edilen proaktif içgörüler.', svg: 'file' },
    ],
    perfTitle: 'Sonuçlar Kendini Gösteriyor',
    perfSub: 'Gerçek metrikler. Gerçek etki. Hiç uyumayan yapay zeka ile.',
    perfs: [
      { metric: '4.2x', label: 'Ortalama ROAS', desc: 'AI optimizeli kampanyalar sürekli olarak manuel yönetimi geride bırakır.' },
      { metric: '+%38', label: 'Dönüşüm Artışı', desc: 'Akıllı hedef kitle ve teklif optimizasyonu ölçülebilir sonuçlar üretir.' },
      { metric: '%60', label: 'Zaman Tasarrufu', desc: 'Otomasyon raporlama, uyarı ve bütçe yeniden dağıtımını üstlenir.' },
    ],
    cmdTitle: 'Komuta Merkeziniz',
    cmdSub: 'Tek ekran. Tüm platformlar. Tam kontrol.',
    cmds: [
      { title: 'Tek Tıkla Aksiyon', desc: 'Tüm kampanyalarda bütçeleri anında durdurun, etkinleştirin, ölçeklendirin veya yeniden dağıtın.' },
      { title: 'Tahmine Dayalı Uyarılar', desc: 'AI anomalileri tespit eder ve kâr marjınızı etkilemeden önce riskleri işareler.' },
      { title: 'Birleşik Analitik', desc: 'Google Ads ve Meta Ads KPI\'ları tek bir gerçek zamanlı panoda yan yana.' },
      { title: 'Akıllı Otomasyon', desc: 'Performansa göre teklifleri, bütçeleri ve takvimleri otomatik ayarlayan kural motoru.' },
    ],
    ctaBottom: 'Reklam operasyonlarınızı dönüştürmeye hazır mısınız?',
    ctaBottomSub: '7 günlük ücretsiz denemenizi başlatın. Kredi kartı gerekmez.',
    panelTitle: 'Kampanya Komutası',
    panelPeriod: 'Son 30 gün',
    panelStatus: 'Tüm sistemler aktif',
    kpis: [
      { label: 'Harcama', value: '₺24,850', delta: '+%12' },
      { label: 'ROAS', value: '4.2x', delta: '+0.8x' },
      { label: 'Dönüşüm', value: '1,248', delta: '+%18' },
      { label: 'CTR', value: '%3.6', delta: '+%0.4' },
    ],
    panelAI: 'AI Optimizasyon: Aktif',
    panelPlatforms: '2 platform senkron',
    footer: '2025 YO Dijital. Tüm hakları saklıdır.',
  }

  // Legal links — absolute EN URLs for Google OAuth verification
  const legal = {
    privacy: { label: isEn ? 'Privacy Policy' : 'Gizlilik Politikası', href: 'https://yoai.yodijital.com/privacy-policy' },
    terms: { label: isEn ? 'Terms of Service' : 'Kullanım Koşulları', href: 'https://yoai.yodijital.com/terms' },
    dataDeletion: { label: isEn ? 'Data Deletion' : 'Veri Silme', href: 'https://yoai.yodijital.com/data-deletion' },
  }

  /* ────────────────────── SVG Icons ────────────────────── */

  const icons: Record<string, string> = {
    layers: '<path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>',
    users: '<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>',
    palette: '<circle cx="13.5" cy="6.5" r="2"/><circle cx="17.5" cy="10.5" r="2"/><circle cx="8.5" cy="7.5" r="2"/><circle cx="6.5" cy="12.5" r="2"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.93 0 1.5-.67 1.5-1.5 0-.4-.13-.73-.38-1-.25-.26-.37-.6-.37-1 0-.83.67-1.5 1.5-1.5H16c3.31 0 6-2.69 6-6 0-5.52-4.48-10-10-10z"/>',
    chart: '<path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/>',
    coins: '<circle cx="8" cy="8" r="7"/><path d="M15.36 2.64A9 9 0 1121.36 8.64"/><path d="M12 12l4-4"/>',
    file: '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/>',
    arrow: '<path d="M5 12h14"/><path d="M12 5l7 7-7 7"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    play: '<polygon points="5,3 19,12 5,21"/>',
  }

  function Icon({ name, size = 20 }: { name: string; size?: number }) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: icons[name] || '' }} />
    )
  }

  const bars = [35, 52, 40, 68, 48, 78, 55, 85, 45, 92, 62, 75, 50, 88, 58, 82]

  /* ────────────────────── Render ────────────────────── */

  return (
    <div className="min-h-screen bg-[#060609] text-white flex flex-col overflow-x-hidden" style={{ fontSize: '16px' }}>
      {/* Shimmer animation for header buttons */}
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
        .btn-shimmer:nth-child(1)::after { animation-delay: 0s; }
        .btn-shimmer:nth-child(2)::after { animation-delay: 2s; }
        .btn-shimmer:nth-child(3)::after { animation-delay: 4s; }
        @keyframes shimmer-slide {
          0% { left: -60%; opacity: 0; }
          5% { opacity: 1; }
          25% { left: 100%; opacity: 1; }
          30% { opacity: 0; }
          100% { opacity: 0; left: 100%; }
        }
      ` }} />

      {/* ═══════════ HEADER ═══════════ */}
      <header className="w-full sticky top-0 z-50 bg-[#060609]/80 backdrop-blur-2xl">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-3">
          {/* Left: Logo */}
          <Image src="/logos/yoai-logo.png" alt="YoAi" width={80} height={30} className="object-contain brightness-0 invert" />

          {/* Right: CTA group */}
          <div className="flex items-center gap-3">
            <DemoModal label={c.ctaDemo} locale={locale} />
            <ScheduleModal
              label={c.ctaSchedule}
              locale={locale}
            />
            <Link
              href="/signup"
              className="btn-shimmer text-[12.75px] font-semibold border border-emerald-400/40 text-emerald-400 hover:bg-emerald-400/10 px-6 py-2.5 rounded-full transition-colors"
            >
              {c.ctaTrial}
            </Link>
          </div>
        </div>
        {/* Bottom gradient line */}
        <div className="h-[1px] bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent" />
      </header>

      {/* ═══════════ HERO — Centered layout ═══════════ */}
      <section className="relative w-full px-6 pt-10 pb-8 md:pt-16 md:pb-10 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div className="absolute top-[15%] left-1/2 -translate-x-1/2 w-[1000px] h-[700px] rounded-full blur-[160px]" style={{ background: 'radial-gradient(ellipse, rgba(16,185,129,0.07) 0%, rgba(20,184,166,0.03) 50%, transparent 80%)' }} />
        </div>

        <div className="relative max-w-6xl mx-auto text-center">
          {/* Badge */}
          <div className="btn-shimmer inline-flex items-center gap-2.5 text-[14px] font-medium text-emerald-400/90 border border-emerald-400/20 bg-emerald-400/[0.06] px-5 py-2.5 rounded-full mb-6">
            <Image src="/icons/ai-brain.png" alt="" width={18} height={18} style={{ filter: 'brightness(0) saturate(100%) invert(73%) sepia(52%) saturate(456%) hue-rotate(108deg) brightness(95%) contrast(91%)' }} />
            {c.badge}
          </div>

          {/* Title — single large centered heading */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-[4.5rem] font-black leading-[1.1] tracking-tight text-white mb-5">
            {c.heroLine1}{' '}
            <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">{c.heroLine2}</span>
          </h1>

          {/* Subtitle */}
          <p className="text-lg md:text-xl text-gray-400 leading-relaxed mb-8 max-w-4xl mx-auto">
            {c.heroSub}
          </p>

          {/* CTA Group — 2 equal buttons centered, same size */}
          <div className="flex flex-wrap justify-center items-center gap-5">
            <ScheduleModal label={c.ctaSchedule} locale={locale} variant="hero" />
            <Link
              href="/signup"
              className="inline-flex items-center justify-center font-semibold text-base px-10 py-4 rounded-full transition-all min-w-[220px] bg-[#1e1e2a] border border-white/[0.08] text-gray-200 hover:bg-[#262635] hover:border-white/15"
            >
              {c.ctaTrial}
            </Link>
          </div>
        </div>
      </section>

      {/* ═══════════ MOCK DASHBOARD PANEL ═══════════ */}
      <section className="w-full px-6 pb-8 md:pb-10">
        <div className="max-w-4xl mx-auto relative">
          <div className="absolute -inset-6 rounded-3xl blur-2xl" style={{ background: 'radial-gradient(ellipse at center, rgba(16,185,129,0.06), transparent 70%)' }} />
          <div className="relative bg-white/[0.025] border border-white/[0.08] rounded-2xl backdrop-blur-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                <span className="text-sm font-semibold text-gray-200">{c.panelTitle}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-emerald-400/70 font-medium">{c.panelAI}</span>
                <span className="text-xs text-gray-600">{c.panelPeriod}</span>
              </div>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-4 gap-2">
                {c.kpis.map((kpi, i) => (
                  <div key={i} className="bg-white/[0.03] border border-white/[0.05] rounded-xl p-3">
                    <p className="text-xs text-gray-500 mb-0.5">{kpi.label}</p>
                    <p className="text-xl font-bold text-white leading-tight">{kpi.value}</p>
                    <p className="text-xs text-emerald-400 font-medium">{kpi.delta}</p>
                  </div>
                ))}
              </div>
              <div className="bg-white/[0.02] border border-white/[0.04] rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-500 font-medium">{isEn ? 'Performance Trend' : 'Performans Trendi'}</span>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-emerald-400/60" />
                    <span className="text-xs text-gray-600">ROAS</span>
                  </div>
                </div>
                <div className="h-28 flex items-end gap-[3px]">
                  {bars.map((h, i) => (
                    <div key={i} className="flex-1 rounded-t" style={{ height: `${h}%`, background: `linear-gradient(to top, rgba(16,185,129,0.15), rgba(16,185,129,${0.3 + h * 0.006}))` }} />
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Image src="/platform-icons/google-ads.svg" alt="Google Ads" width={14} height={14} className="brightness-0 invert opacity-40" />
                  <Image src="/platform-icons/meta.svg" alt="Meta" width={14} height={14} className="brightness-0 invert opacity-40" />
                  <span className="text-xs text-gray-600">{c.panelPlatforms}</span>
                </div>
                <span className="text-xs text-emerald-400/50 font-medium">{c.panelStatus}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════ TRUST STRIP ═══════════ */}
      <section className="w-full border-y border-white/[0.04] py-5 px-6 bg-white/[0.01]">
        <div className="max-w-7xl mx-auto">
          <p className="text-[11px] text-gray-600 uppercase tracking-[0.2em] text-center mb-4 font-medium">{c.trustLabel}</p>
          <div className="flex flex-wrap justify-center items-center gap-3">
            {[
              { label: 'Google Ads', icon: '/platform-icons/google-ads.svg' },
              { label: 'Meta Ads', icon: '/platform-icons/meta.svg' },
            ].map((p, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-gray-400 bg-white/[0.03] border border-white/[0.06] px-4 py-1.5 rounded-full">
                <Image src={p.icon} alt={p.label} width={14} height={14} className="brightness-0 invert opacity-50" />
                <span className="font-medium">{p.label}</span>
              </div>
            ))}
            {(isEn ? ['AI Engine', 'Auto Reports', 'Smart Budgets'] : ['AI Motor', 'Oto Raporlama', 'Akıllı Bütçe']).map((label, i) => (
              <span key={i} className="text-sm font-medium text-gray-500 bg-white/[0.03] border border-white/[0.06] px-4 py-1.5 rounded-full">
                {label}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ AI CAPABILITIES ═══════════ */}
      <section className="relative w-full px-6 py-10 md:py-12">
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div className="absolute top-1/2 left-1/4 w-[500px] h-[500px] bg-emerald-500/[0.03] rounded-full blur-[120px]" />
        </div>
        <div className="relative max-w-7xl mx-auto">
          <div className="text-center mb-6">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">{c.capTitle}</h2>
            <p className="text-base text-gray-500 max-w-xl mx-auto leading-relaxed">{c.capSub}</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {c.caps.map((cap, i) => (
              <div key={i} className="group bg-white/[0.025] border border-white/[0.06] rounded-2xl p-6 hover:border-emerald-400/15 hover:bg-white/[0.04] transition-all duration-300">
                <div className="w-10 h-10 rounded-xl bg-emerald-400/[0.08] border border-emerald-400/15 flex items-center justify-center mb-4 text-emerald-400 group-hover:shadow-[0_0_20px_rgba(16,185,129,0.1)] transition-all">
                  <Icon name={cap.svg} size={18} />
                </div>
                <h3 className="font-semibold text-white mb-1.5">{cap.title}</h3>
                <p className="text-base text-gray-400 leading-relaxed">{cap.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ PERFORMANCE ═══════════ */}
      <section className="relative w-full px-6 py-10 md:py-12 bg-white/[0.015]">
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-teal-500/[0.04] rounded-full blur-[120px]" />
        </div>
        <div className="relative max-w-7xl mx-auto">
          <div className="text-center mb-6">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">{c.perfTitle}</h2>
            <p className="text-base text-gray-500 max-w-xl mx-auto leading-relaxed">{c.perfSub}</p>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {c.perfs.map((perf, i) => (
              <div key={i} className="relative bg-white/[0.025] border border-white/[0.06] rounded-2xl p-7 text-center overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-b from-emerald-400/[0.03] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative">
                  <p className="text-4xl md:text-5xl font-black bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent mb-1.5">{perf.metric}</p>
                  <p className="text-base font-semibold text-white mb-2">{perf.label}</p>
                  <p className="text-base text-gray-400 leading-relaxed">{perf.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ COMMAND CENTER ═══════════ */}
      <section className="w-full px-6 py-10 md:py-12">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-6">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">{c.cmdTitle}</h2>
            <p className="text-base text-gray-500 max-w-xl mx-auto leading-relaxed">{c.cmdSub}</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {c.cmds.map((cmd, i) => (
              <div key={i} className="bg-white/[0.025] border border-white/[0.06] rounded-2xl p-5 hover:border-emerald-400/10 transition-all duration-300">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400/10 to-teal-400/[0.06] border border-white/[0.06] flex items-center justify-center mb-3">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.5)]" />
                </div>
                <h4 className="font-semibold text-white text-[0.95rem] mb-1.5">{cmd.title}</h4>
                <p className="text-base text-gray-400 leading-relaxed">{cmd.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ BOTTOM CTA ═══════════ */}
      <section className="relative w-full px-6 py-10 md:py-12">
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full blur-[150px]" style={{ background: 'radial-gradient(ellipse, rgba(16,185,129,0.08), transparent 70%)' }} />
        </div>
        <div className="relative max-w-2xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">{c.ctaBottom}</h2>
          <p className="text-base text-gray-500 mb-5 max-w-md mx-auto leading-relaxed">{c.ctaBottomSub}</p>
          <div className="flex flex-wrap justify-center items-center gap-3">
            <Link
              href="/signup"
              className="group relative inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold px-8 py-3.5 rounded-xl transition-all shadow-[0_0_30px_rgba(16,185,129,0.25)] hover:shadow-[0_0_40px_rgba(16,185,129,0.35)] overflow-hidden"
            >
              <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
              <span className="relative">{c.ctaTrial}</span>
              <Icon name="arrow" size={16} />
            </Link>
            <ScheduleModal label={c.ctaSchedule} locale={locale} variant="hero" />
          </div>
        </div>
      </section>

      {/* ═══════════ FOOTER ═══════════ */}
      <footer className="w-full border-t border-white/[0.05] py-6 px-6 bg-[#060609]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
          <div className="flex items-center gap-3 text-gray-600">
            <Image src="/logos/yoai-logo.png" alt="YoAI" width={40} height={16} className="object-contain brightness-0 invert opacity-25" />
            <span>{c.footer}</span>
          </div>
          <nav className="flex gap-5 text-gray-600">
            <a href={legal.privacy.href} className="hover:text-gray-400 transition-colors">{legal.privacy.label}</a>
            <a href={legal.terms.href} className="hover:text-gray-400 transition-colors">{legal.terms.label}</a>
            <a href={legal.dataDeletion.href} className="hover:text-gray-400 transition-colors">{legal.dataDeletion.label}</a>
          </nav>
        </div>
      </footer>
    </div>
  )
}
