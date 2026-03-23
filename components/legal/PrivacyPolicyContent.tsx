'use client'

import Link from 'next/link'
import trMessages from '@/locales/tr.json'
import enMessages from '@/locales/en.json'

const messages = {
  tr: (trMessages as Record<string, any>).legal.privacyPolicy,
  en: (enMessages as Record<string, any>).legal.privacyPolicy,
}

function t(locale: 'tr' | 'en', key: string): string {
  const parts = key.split('.')
  let value: any = messages[locale]
  for (const part of parts) value = value?.[part]
  return typeof value === 'string' ? value : key
}

export default function PrivacyPolicyContent({ locale = 'tr' }: { locale?: 'tr' | 'en' }) {
  const g = (key: string) => t(locale, key)

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4">
        <Link href="/" className="text-green-600 hover:underline mb-4 inline-block">
          &larr; {g('backToHome')}
        </Link>
        <h1 className="text-3xl font-bold mb-6">{g('title')}</h1>

        <div className="bg-white rounded-lg p-8 space-y-6">
          <section>
            <h2 className="text-xl font-semibold mb-3">{g('intro.title')}</h2>
            <p className="text-gray-700">{g('intro.content')}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">{g('section1Title')}</h2>
            <p className="text-gray-700">{g('section1Content')}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">{g('section2Title')}</h2>
            <p className="text-gray-700">{g('section2Content')}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">{g('section3Title')}</h2>
            <p className="text-gray-700">
              <strong>{g('section3MetaTitle')}</strong>
              <br />
              {g('section3MetaContent')}
            </p>
            <p className="text-gray-700 mt-3">
              <strong>{g('section3GoogleTitle')}</strong>
              <br />
              {g('section3GoogleContent')}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">{g('section4Title')}</h2>
            <p className="text-gray-700">{g('section4Content')}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">{g('section5Title')}</h2>
            <p className="text-gray-700">{g('section5Content')}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">{g('section6Title')}</h2>
            <p className="text-gray-700">{g('section6Content')}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">{g('section7Title')}</h2>
            <p className="text-gray-700">{g('section7Content')}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">{g('section8Title')}</h2>
            <p className="text-gray-700">{g('section8Content')}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">{g('section9Title')}</h2>
            <p className="text-gray-700">{g('section9Content')}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">{g('section10Title')}</h2>
            <p className="text-gray-700">{g('section10Content')}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">{g('contact.title')}</h2>
            <p className="text-gray-700">
              E-posta: <a href={`mailto:${g('contact.email')}`} className="text-green-600 hover:underline">{g('contact.email')}</a>
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
