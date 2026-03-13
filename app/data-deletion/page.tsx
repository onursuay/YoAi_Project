'use client'

import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

export default function DataDeletionPage() {
  const t = useTranslations('legal.dataDeletion')
  const searchParams = useSearchParams()
  const confirmationCode = searchParams.get('code')

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4">
        <Link href="/" className="text-green-600 hover:underline mb-4 inline-block">
          ← {t('backToHome')}
        </Link>
        <h1 className="text-3xl font-bold mb-6">{t('title')}</h1>

        <div className="bg-white rounded-lg p-8 space-y-6">
          {confirmationCode && (
            <section className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h2 className="text-xl font-semibold mb-2 text-green-800">{t('confirmationCode.label')}</h2>
              <p className="text-green-900 font-mono text-lg">{confirmationCode}</p>
            </section>
          )}

          <section>
            <h2 className="text-xl font-semibold mb-3">{t('intro.title')}</h2>
            <p className="text-gray-700">{t('intro.content')}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">{t('section1Title')}</h2>
            <p className="text-gray-700">
              <strong>{t('section1GoogleTitle')}</strong>
              <br />
              {t('section1GoogleContent')}
            </p>
            <p className="text-gray-700 mt-3">
              <strong>{t('section1MetaTitle')}</strong>
              <br />
              {t('section1MetaContent')}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">{t('section2Title')}</h2>
            <p className="text-gray-700">{t('section2Content')}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">{t('section3Title')}</h2>
            <p className="text-gray-700">{t('section3Content')}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">{t('section4Title')}</h2>
            <p className="text-gray-700">{t('section4Content')}</p>
          </section>
        </div>
      </div>
    </div>
  )
}
