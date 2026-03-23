'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

function getLocale(): string {
  if (typeof document === 'undefined') return 'tr'
  const match = document.cookie.match(/NEXT_LOCALE=(\w+)/)
  return match?.[1] || 'tr'
}

const content = {
  tr: {
    title: 'Ücretsiz Denemenizi Başlatın',
    subtitle: 'YoAi ile reklam yönetiminizi yapay zekâ ile güçlendirin.',
    nameLabel: 'Ad Soyad',
    namePlaceholder: 'Adınızı ve soyadınızı girin',
    emailLabel: 'E-posta Adresi',
    emailPlaceholder: 'ornek@sirket.com',
    companyLabel: 'Şirket Adı (İsteğe bağlı)',
    companyPlaceholder: 'Şirketinizin adı',
    phoneLabel: 'Telefon (İsteğe bağlı)',
    phonePlaceholder: '+90 5XX XXX XX XX',
    submit: '7 Gün Ücretsiz Denemeyi Başlat',
    submitting: 'Hesabınız oluşturuluyor...',
    noCc: 'Kredi kartı gerekmez. İstediğiniz zaman iptal edin.',
    backHome: 'Ana sayfaya dön',
    errorName: 'Ad soyad alanı zorunludur.',
    errorEmail: 'Geçerli bir e-posta adresi girin.',
    errorGeneric: 'Bir hata oluştu. Lütfen tekrar deneyin.',
  },
  en: {
    title: 'Start Your Free Trial',
    subtitle: 'Supercharge your ad management with AI-powered YoAi.',
    nameLabel: 'Full Name',
    namePlaceholder: 'Enter your full name',
    emailLabel: 'Email Address',
    emailPlaceholder: 'example@company.com',
    companyLabel: 'Company Name (Optional)',
    companyPlaceholder: 'Your company name',
    phoneLabel: 'Phone (Optional)',
    phonePlaceholder: '+1 (555) 000-0000',
    submit: 'Start Your 7-Day Free Trial',
    submitting: 'Creating your account...',
    noCc: 'No credit card required. Cancel anytime.',
    backHome: 'Back to homepage',
    errorName: 'Full name is required.',
    errorEmail: 'Please enter a valid email address.',
    errorGeneric: 'Something went wrong. Please try again.',
  },
} as const

export default function SignupPage() {
  const router = useRouter()
  const locale = getLocale()
  const isEn = locale === 'en'
  const t = isEn ? content.en : content.tr

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [company, setCompany] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    // Validation
    if (!name.trim()) {
      setError(t.errorName)
      return
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError(t.errorEmail)
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          company: company.trim() || undefined,
          phone: phone.trim() || undefined,
          source: 'signup',
        }),
      })

      if (!res.ok) {
        throw new Error('session_error')
      }

      router.push('/dashboard')
    } catch {
      setError(t.errorGeneric)
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen bg-[#060609] flex items-center justify-center px-4 py-12"
      style={{ fontSize: '16px' }}
    >
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Link href="/">
            <Image
              src="/logos/yoai-logo.png"
              alt="YoAi"
              width={120}
              height={40}
              className="brightness-0 invert"
              priority
            />
          </Link>
        </div>

        {/* Card */}
        <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-8 backdrop-blur-sm">
          {/* Header */}
          <h1 className="text-2xl font-bold text-white text-center mb-2">
            {t.title}
          </h1>
          <p className="text-base text-gray-400 text-center mb-8">
            {t.subtitle}
          </p>

          {/* Error */}
          {error && (
            <div className="mb-6 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Full Name */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                {t.nameLabel} <span className="text-emerald-400">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t.namePlaceholder}
                className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3 text-base text-white placeholder-gray-500 outline-none transition focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30"
                autoComplete="name"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                {t.emailLabel} <span className="text-emerald-400">*</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t.emailPlaceholder}
                className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3 text-base text-white placeholder-gray-500 outline-none transition focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30"
                autoComplete="email"
              />
            </div>

            {/* Company */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                {t.companyLabel}
              </label>
              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder={t.companyPlaceholder}
                className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3 text-base text-white placeholder-gray-500 outline-none transition focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30"
                autoComplete="organization"
              />
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                {t.phoneLabel}
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={t.phonePlaceholder}
                className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3 text-base text-white placeholder-gray-500 outline-none transition focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30"
                autoComplete="tel"
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-emerald-500/20 transition hover:from-emerald-600 hover:to-teal-600 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? t.submitting : t.submit}
            </button>
          </form>

          {/* No CC note */}
          <p className="text-base text-gray-500 text-center mt-5">
            {t.noCc}
          </p>
        </div>

        {/* Back link */}
        <div className="mt-6 text-center">
          <Link
            href="/"
            className="text-sm text-gray-500 hover:text-emerald-400 transition"
          >
            ← {t.backHome}
          </Link>
        </div>
      </div>
    </div>
  )
}
