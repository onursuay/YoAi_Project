'use client'

import { useTranslations } from 'next-intl'
import Link from 'next/link'

export default function PrivacyPolicyPage() {
  const t = useTranslations('legal.privacyPolicy')

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4">
        <Link href="/" className="text-green-600 hover:underline mb-4 inline-block">
          ← {t('backToHome')}
        </Link>
        <h1 className="text-3xl font-bold mb-6">{t('title')}</h1>

        <div className="bg-white rounded-lg p-8 space-y-6">
          <section>
            <h2 className="text-xl font-semibold mb-3">{t('intro.title')}</h2>
            <p className="text-gray-700">{t('intro.content')}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">{t('section1Title')}</h2>
            <p className="text-gray-700">{t('section1Content')}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">{t('section2Title')}</h2>
            <p className="text-gray-700">{t('section2Content')}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">{t('section3Title')}</h2>
            <p className="text-gray-700">
              <strong>{t('section3MetaTitle')}</strong>
              <br />
              {t('section3MetaContent')}
            </p>
            <p className="text-gray-700 mt-3">
              <strong>{t('section3GoogleTitle')}</strong>
              <br />
              {t('section3GoogleContent')}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">{t('section4Title')}</h2>
            <p className="text-gray-700">{t('section4Content')}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">{t('section5Title')}</h2>
            <p className="text-gray-700">{t('section5Content')}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">{t('section6Title')}</h2>
            <p className="text-gray-700">{t('section6Content')}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">{t('section7Title')}</h2>
            <p className="text-gray-700">{t('section7Content')}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">{t('section8Title')}</h2>
            <p className="text-gray-700">{t('section8Content')}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">{t('section9Title')}</h2>
            <p className="text-gray-700">{t('section9Content')}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">{t('section10Title')}</h2>
            <p className="text-gray-700">{t('section10Content')}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">{t('contact.title')}</h2>
            <p className="text-gray-700">
              E-posta: <a href={`mailto:${t('contact.email')}`} className="text-green-600 hover:underline">{t('contact.email')}</a>
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
