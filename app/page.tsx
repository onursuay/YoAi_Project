import Link from 'next/link'
import { cookies } from 'next/headers'

export default async function RootPage() {
  const cookieStore = await cookies()
  const locale = cookieStore.get('NEXT_LOCALE')?.value || 'tr'

  const content = locale === 'en' ? {
    title: 'YoAI – AI-Powered Ad Management Platform',
    subtitle: 'Manage your Google Ads and Meta Ads campaigns with AI-driven insights, optimization, and automation.',
    cta: 'Go to Dashboard',
    features: [
      { title: 'Google Ads Management', desc: 'Create, manage and optimize your Google Ads campaigns with AI recommendations.' },
      { title: 'Meta Ads Management', desc: 'Run Facebook and Instagram ad campaigns with smart targeting and budgeting.' },
      { title: 'AI Optimization', desc: 'Get AI-powered insights and automatic optimization suggestions for better ROAS.' },
    ],
    legal: {
      privacy: { label: 'Privacy Policy', href: '/privacy-policy' },
      terms: { label: 'Terms of Service', href: '/terms' },
      dataDeletion: { label: 'Data Deletion', href: '/data-deletion' },
    },
    footer: '© 2025 YO Dijital. All rights reserved.',
  } : {
    title: 'YoAI – Yapay Zeka Destekli Reklam Yönetim Platformu',
    subtitle: 'Google Ads ve Meta Ads kampanyalarınızı yapay zeka destekli içgörüler, optimizasyon ve otomasyon ile yönetin.',
    cta: 'Dashboard\'a Git',
    features: [
      { title: 'Google Ads Yönetimi', desc: 'Google Ads kampanyalarınızı yapay zeka önerileriyle oluşturun, yönetin ve optimize edin.' },
      { title: 'Meta Ads Yönetimi', desc: 'Facebook ve Instagram reklam kampanyalarınızı akıllı hedefleme ve bütçeleme ile yürütün.' },
      { title: 'Yapay Zeka Optimizasyonu', desc: 'Daha iyi ROAS için yapay zeka destekli içgörüler ve otomatik optimizasyon önerileri alın.' },
    ],
    legal: {
      privacy: { label: 'Gizlilik Politikası', href: '/gizlilik-politikasi' },
      terms: { label: 'Kullanım Koşulları', href: '/kullanim-kosullari' },
      dataDeletion: { label: 'Veri Silme', href: '/veri-silme' },
    },
    footer: '© 2025 YO Dijital. Tüm hakları saklıdır.',
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Hero */}
      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="max-w-3xl text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">{content.title}</h1>
          <p className="text-lg text-gray-600 mb-8">{content.subtitle}</p>
          <Link
            href="/dashboard"
            className="inline-block bg-green-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors"
          >
            {content.cta}
          </Link>

          {/* Features */}
          <div className="grid md:grid-cols-3 gap-6 mt-16">
            {content.features.map((f, i) => (
              <div key={i} className="bg-white rounded-lg p-6 shadow-sm">
                <h3 className="font-semibold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-sm text-gray-600">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 py-6 px-4">
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-500">
          <span>{content.footer}</span>
          <nav className="flex gap-4">
            <Link href={content.legal.privacy.href} className="hover:text-gray-700">{content.legal.privacy.label}</Link>
            <Link href={content.legal.terms.href} className="hover:text-gray-700">{content.legal.terms.label}</Link>
            <Link href={content.legal.dataDeletion.href} className="hover:text-gray-700">{content.legal.dataDeletion.label}</Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}
