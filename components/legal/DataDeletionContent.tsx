'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useSearchParams } from 'next/navigation'
import LandingHeader from '@/components/landing/LandingHeader'
import trMessages from '@/locales/tr.json'
import enMessages from '@/locales/en.json'

const messages = {
  tr: (trMessages as Record<string, any>).legal.dataDeletion,
  en: (enMessages as Record<string, any>).legal.dataDeletion,
}

function t(locale: 'tr' | 'en', key: string): string {
  const parts = key.split('.')
  let value: any = messages[locale]
  for (const part of parts) value = value?.[part]
  return typeof value === 'string' ? value : key
}

export default function DataDeletionContent({ locale = 'tr' }: { locale?: 'tr' | 'en' }) {
  const g = (key: string) => t(locale, key)
  const isEn = locale === 'en'
  const searchParams = useSearchParams()
  const confirmationCode = searchParams.get('code')

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
          <h1 className="text-3xl font-bold mb-10 text-white">{g('title')}</h1>

          <div className="space-y-8">
            {confirmationCode && (
              <section className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-5">
                <h2 className="text-xl font-semibold mb-2 text-emerald-400">{g('confirmationCode.label')}</h2>
                <p className="text-emerald-300 font-mono text-lg">{confirmationCode}</p>
              </section>
            )}

            <section>
              <h2 className="text-xl font-semibold mb-3 text-white">{g('intro.title')}</h2>
              <p className="text-[14px] text-[#8a8f98] leading-relaxed">{g('intro.content')}</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3 text-white">{g('section1Title')}</h2>
              <p className="text-[14px] text-[#8a8f98] leading-relaxed">
                <strong className="text-gray-300">{g('section1GoogleTitle')}</strong>
                <br />
                {g('section1GoogleContent')}
              </p>
              <p className="text-[14px] text-[#8a8f98] mt-3">
                <strong className="text-gray-300">{g('section1MetaTitle')}</strong>
                <br />
                {g('section1MetaContent')}
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3 text-white">{g('section2Title')}</h2>
              <p className="text-[14px] text-[#8a8f98] leading-relaxed">{g('section2Content')}</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3 text-white">{g('section3Title')}</h2>
              <p className="text-[14px] text-[#8a8f98] leading-relaxed">{g('section3Content')}</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3 text-white">{g('section4Title')}</h2>
              <p className="text-[14px] text-[#8a8f98] leading-relaxed">{g('section4Content')}</p>
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
