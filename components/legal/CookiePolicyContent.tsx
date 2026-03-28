import Link from 'next/link'
import Image from 'next/image'
import LandingHeader from '@/components/landing/LandingHeader'
import trMessages from '@/locales/tr.json'
import enMessages from '@/locales/en.json'

const messages = {
  tr: (trMessages as Record<string, any>).legal.cookiePolicy,
  en: (enMessages as Record<string, any>).legal.cookiePolicy,
}

function t(locale: 'tr' | 'en', key: string): string {
  const parts = key.split('.')
  let value: any = messages[locale]
  for (const part of parts) value = value?.[part]
  return typeof value === 'string' ? value : key
}

export default function CookiePolicyContent({ locale = 'tr' }: { locale?: 'tr' | 'en' }) {
  const g = (key: string) => t(locale, key)
  const isEn = locale === 'en'

  return (
    <div className="min-h-screen bg-[#060609] text-white">
      <LandingHeader
        locale={locale}
        ctaSchedule={isEn ? 'Book a Call' : 'Toplantı Planla'}
        ctaTrial={isEn ? '14-Day Free Trial' : '14 Günlük Ücretsiz Deneme'}
      />

      <div className="max-w-5xl mx-auto px-6 py-16">
        <Link href="/" className="text-emerald-400 hover:text-emerald-300 transition-colors mb-6 inline-block text-sm">
          &larr; {g('backToHome')}
        </Link>

        <div className="relative rounded-2xl border border-emerald-400/10 bg-white/[0.02] px-8 py-10 shadow-[0_0_60px_rgba(16,185,129,0.07),inset_0_0_40px_rgba(16,185,129,0.03)]">
        <h1 className="text-3xl font-bold mb-2 text-white">{g('title')}</h1>
        <p className="text-sm text-gray-500 mb-1">{g('lastUpdated')}</p>
        <p className="text-sm text-gray-500 mb-10">{g('company')}</p>
        <div className="space-y-8">
          <section>
            <h2 className="text-xl font-semibold mb-3 text-white">{g('intro.title')}</h2>
            <p className="text-[14px] text-[#8a8f98] leading-relaxed">{g('intro.content')}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-white">{g('section1Title')}</h2>
            <p className="text-[14px] text-[#8a8f98] leading-relaxed">{g('section1Content')}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-white">{g('section2Title')}</h2>
            <div className="space-y-3">
              <p className="text-[14px] text-[#8a8f98] leading-relaxed"><strong className="text-gray-300">{locale === 'tr' ? 'Zorunlu Çerezler:' : 'Essential Cookies:'}</strong> {g('section2Essential').replace(/^[^:]+:\s*/, '')}</p>
              <p className="text-[14px] text-[#8a8f98] leading-relaxed"><strong className="text-gray-300">{locale === 'tr' ? 'İşlevsel Çerezler:' : 'Functional Cookies:'}</strong> {g('section2Functional').replace(/^[^:]+:\s*/, '')}</p>
              <p className="text-[14px] text-[#8a8f98] leading-relaxed"><strong className="text-gray-300">{locale === 'tr' ? 'Analitik Çerezler:' : 'Analytics Cookies:'}</strong> {g('section2Analytics').replace(/^[^:]+:\s*/, '')}</p>
              <p className="text-[14px] text-[#8a8f98] leading-relaxed"><strong className="text-gray-300">{locale === 'tr' ? 'Üçüncü Taraf Çerezler:' : 'Third-Party Cookies:'}</strong> {g('section2ThirdParty').replace(/^[^:]+:\s*/, '')}</p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-white">{g('section3Title')}</h2>
            <p className="text-[14px] text-[#8a8f98] leading-relaxed">{g('section3Content')}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-white">{g('section4Title')}</h2>
            <p className="text-[14px] text-[#8a8f98] leading-relaxed">{g('section4Content')}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-white">{g('section5Title')}</h2>
            <p className="text-[14px] text-[#8a8f98] leading-relaxed">{g('section5Content')}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-white">{g('section6Title')}</h2>
            <p className="text-[14px] text-[#8a8f98] leading-relaxed">{g('section6Content')}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-white">{g('section7Title')}</h2>
            <p className="text-[14px] text-[#8a8f98] leading-relaxed">{g('section7Content')}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-white">{g('contact.title')}</h2>
            <p className="text-[14px] text-[#8a8f98] leading-relaxed">
              E-posta: <a href={`mailto:${g('contact.email')}`} className="text-emerald-400 hover:text-emerald-300 transition-colors">{g('contact.email')}</a>
            </p>
          </section>
        </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="w-full border-t border-white/[0.05] py-6 px-6 bg-[#060609]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
          <div className="flex items-center gap-3 text-gray-500">
            <Image src="/logos/yoai-logo.png" alt="YoAI" width={40} height={16} className="object-contain brightness-0 invert opacity-40" />
            <span>© 2025 YoAI. {isEn ? 'All rights reserved.' : 'Tüm hakları saklıdır.'}</span>
          </div>
          <nav className="flex gap-5 text-gray-500">
            <Link href="/gizlilik-politikasi" className="hover:text-gray-300 transition-colors">{isEn ? 'Privacy Policy' : 'Gizlilik Politikası'}</Link>
            <Link href="/cerez-politikasi" className="hover:text-gray-300 transition-colors">{isEn ? 'Cookie Policy' : 'Çerez Politikası'}</Link>
            <Link href="/kullanim-kosullari" className="hover:text-gray-300 transition-colors">{isEn ? 'Terms of Service' : 'Kullanım Koşulları'}</Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}
