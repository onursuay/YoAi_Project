'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
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
  const searchParams = useSearchParams()
  const confirmationCode = searchParams.get('code')

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4">
        <Link href="/" className="text-green-600 hover:underline mb-4 inline-block">
          &larr; {g('backToHome')}
        </Link>
        <h1 className="text-3xl font-bold mb-6">{g('title')}</h1>

        <div className="bg-white rounded-lg p-8 space-y-6">
          {confirmationCode && (
            <section className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h2 className="text-xl font-semibold mb-2 text-green-800">{g('confirmationCode.label')}</h2>
              <p className="text-green-900 font-mono text-lg">{confirmationCode}</p>
            </section>
          )}

          <section>
            <h2 className="text-xl font-semibold mb-3">{g('intro.title')}</h2>
            <p className="text-gray-700">{g('intro.content')}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">{g('section1Title')}</h2>
            <p className="text-gray-700">
              <strong>{g('section1GoogleTitle')}</strong>
              <br />
              {g('section1GoogleContent')}
            </p>
            <p className="text-gray-700 mt-3">
              <strong>{g('section1MetaTitle')}</strong>
              <br />
              {g('section1MetaContent')}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">{g('section2Title')}</h2>
            <p className="text-gray-700">{g('section2Content')}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">{g('section3Title')}</h2>
            <p className="text-gray-700">{g('section3Content')}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">{g('section4Title')}</h2>
            <p className="text-gray-700">{g('section4Content')}</p>
          </section>
        </div>
      </div>
    </div>
  )
}
