'use client'

import Link from 'next/link'
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

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4">
        <Link href="/" className="text-green-600 hover:underline mb-4 inline-block">
          &larr; {g('backToHome')}
        </Link>
        <h1 className="text-3xl font-bold mb-2">{g('title')}</h1>
        <p className="text-sm text-gray-600 mb-1">{g('lastUpdated')}</p>
        <p className="text-sm text-gray-600 mb-6">{g('company')}</p>

        <div className="bg-white rounded-lg p-8 space-y-6">
          <section>
            <h2 className="text-xl font-semibold mb-3">{g('intro.title')}</h2>
            <p className="text-base text-gray-700 leading-relaxed">{g('intro.content')}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">{g('section1Title')}</h2>
            <p className="text-base text-gray-700 leading-relaxed">{g('section1Content')}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">{g('section2Title')}</h2>
            <div className="space-y-3">
              <p className="text-base text-gray-700 leading-relaxed"><strong>{locale === 'tr' ? 'Zorunlu Çerezler:' : 'Essential Cookies:'}</strong> {g('section2Essential').replace(/^[^:]+:\s*/, '')}</p>
              <p className="text-base text-gray-700 leading-relaxed"><strong>{locale === 'tr' ? 'İşlevsel Çerezler:' : 'Functional Cookies:'}</strong> {g('section2Functional').replace(/^[^:]+:\s*/, '')}</p>
              <p className="text-base text-gray-700 leading-relaxed"><strong>{locale === 'tr' ? 'Analitik Çerezler:' : 'Analytics Cookies:'}</strong> {g('section2Analytics').replace(/^[^:]+:\s*/, '')}</p>
              <p className="text-base text-gray-700 leading-relaxed"><strong>{locale === 'tr' ? 'Üçüncü Taraf Çerezler:' : 'Third-Party Cookies:'}</strong> {g('section2ThirdParty').replace(/^[^:]+:\s*/, '')}</p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">{g('section3Title')}</h2>
            <p className="text-base text-gray-700 leading-relaxed">{g('section3Content')}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">{g('section4Title')}</h2>
            <p className="text-base text-gray-700 leading-relaxed">{g('section4Content')}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">{g('section5Title')}</h2>
            <p className="text-base text-gray-700 leading-relaxed">{g('section5Content')}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">{g('section6Title')}</h2>
            <p className="text-base text-gray-700 leading-relaxed">{g('section6Content')}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">{g('section7Title')}</h2>
            <p className="text-base text-gray-700 leading-relaxed">{g('section7Content')}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">{g('contact.title')}</h2>
            <p className="text-base text-gray-700 leading-relaxed">
              E-posta: <a href={`mailto:${g('contact.email')}`} className="text-green-600 hover:underline">{g('contact.email')}</a>
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
