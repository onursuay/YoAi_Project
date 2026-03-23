'use client'

import Link from 'next/link'
import trMessages from '@/locales/tr.json'
import enMessages from '@/locales/en.json'

const messages = {
  tr: (trMessages as Record<string, any>).legal.terms,
  en: (enMessages as Record<string, any>).legal.terms,
}

function t(locale: 'tr' | 'en', key: string): string {
  const parts = key.split('.')
  let value: any = messages[locale]
  for (const part of parts) value = value?.[part]
  return typeof value === 'string' ? value : key
}

export default function TermsContent({ locale = 'tr' }: { locale?: 'tr' | 'en' }) {
  const g = (key: string) => t(locale, key)

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4">
        <Link href="/" className="text-green-600 hover:underline mb-4 inline-block">
          &larr; {g('backToHome')}
        </Link>

        <p className="text-sm text-gray-600 mb-2">{g('lastUpdated')}</p>
        <h1 className="text-3xl font-bold mb-2">{g('title')}</h1>
        <p className="text-gray-600 mb-8">{g('company')}</p>

        <div className="bg-white rounded-lg p-8 space-y-6">
          <section>
            <h2 className="text-xl font-semibold mb-3">{g('section1Title')}</h2>
            <p className="text-base text-gray-700 leading-relaxed">{g('section1Body')}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">{g('section2Title')}</h2>
            <p className="text-base text-gray-700 leading-relaxed">{g('section2Body')}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">{g('section3Title')}</h2>
            <p className="text-base text-gray-700 leading-relaxed">{g('section3Body')}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">{g('section4Title')}</h2>
            <p className="text-base text-gray-700 leading-relaxed">{g('section4Body')}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">{g('section5Title')}</h2>
            <p className="text-base text-gray-700 leading-relaxed">{g('section5Body')}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">{g('section6Title')}</h2>
            <p className="text-base text-gray-700 leading-relaxed">{g('section6Body')}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">{g('section7Title')}</h2>
            <p className="text-base text-gray-700 leading-relaxed">{g('section7Body')}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">{g('section8Title')}</h2>
            <p className="text-base text-gray-700 leading-relaxed">{g('section8Body')}</p>
          </section>
        </div>
      </div>
    </div>
  )
}
