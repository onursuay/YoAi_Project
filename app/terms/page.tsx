'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'

export default function TermsPage() {
  const t = useTranslations('legal.terms')

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4">
        <Link href="/" className="text-green-600 hover:underline mb-4 inline-block">
          ← {t('backToHome')}
        </Link>

        <p className="text-sm text-gray-500 mb-2">{t('lastUpdated')}</p>
        <h1 className="text-3xl font-bold mb-2">{t('title')}</h1>
        <p className="text-gray-600 mb-8">{t('company')}</p>

        <div className="bg-white rounded-lg p-8 space-y-6">
          <section>
            <h2 className="text-xl font-semibold mb-3">{t('section1Title')}</h2>
            <p className="text-gray-700">{t('section1Body')}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">{t('section2Title')}</h2>
            <p className="text-gray-700">{t('section2Body')}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">{t('section3Title')}</h2>
            <p className="text-gray-700">{t('section3Body')}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">{t('section4Title')}</h2>
            <p className="text-gray-700">{t('section4Body')}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">{t('section5Title')}</h2>
            <p className="text-gray-700">{t('section5Body')}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">{t('section6Title')}</h2>
            <p className="text-gray-700">{t('section6Body')}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">{t('section7Title')}</h2>
            <p className="text-gray-700">{t('section7Body')}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">{t('section8Title')}</h2>
            <p className="text-gray-700">{t('section8Body')}</p>
          </section>
        </div>
      </div>
    </div>
  )
}
