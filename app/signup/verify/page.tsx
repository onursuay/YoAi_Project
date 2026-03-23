'use client'

import { useSearchParams } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'

function getLocale(): string {
  if (typeof document === 'undefined') return 'tr'
  const match = document.cookie.match(/NEXT_LOCALE=(\w+)/)
  return match?.[1] || 'tr'
}

const content = {
  tr: {
    pending: {
      title: 'E-postanızı Kontrol Edin',
      desc: 'Hesabınızı aktifleştirmek için e-posta adresinize bir doğrulama bağlantısı gönderdik. Lütfen gelen kutunuzu kontrol edin.',
      spam: 'E-posta gelmedi mi? Spam/gereksiz klasörünüzü kontrol edin.',
    },
    invalid: {
      title: 'Geçersiz Bağlantı',
      desc: 'Bu doğrulama bağlantısı geçersiz veya bulunamadı. Lütfen tekrar kayıt olun.',
    },
    expired: {
      title: 'Bağlantı Süresi Dolmuş',
      desc: 'Bu doğrulama bağlantısının süresi dolmuş. Lütfen tekrar kayıt olarak yeni bir bağlantı alın.',
    },
    error: {
      title: 'Bir Hata Oluştu',
      desc: 'Doğrulama sırasında bir sorun oluştu. Lütfen daha sonra tekrar deneyin.',
    },
    backSignup: 'Tekrar Kayıt Ol',
    backHome: 'Ana Sayfaya Dön',
  },
  en: {
    pending: {
      title: 'Check Your Email',
      desc: 'We sent a verification link to your email address to activate your account. Please check your inbox.',
      spam: "Didn't receive the email? Check your spam/junk folder.",
    },
    invalid: {
      title: 'Invalid Link',
      desc: 'This verification link is invalid or not found. Please sign up again.',
    },
    expired: {
      title: 'Link Expired',
      desc: 'This verification link has expired. Please sign up again to get a new link.',
    },
    error: {
      title: 'Something Went Wrong',
      desc: 'An error occurred during verification. Please try again later.',
    },
    backSignup: 'Sign Up Again',
    backHome: 'Back to Homepage',
  },
} as const

export default function VerifyPage() {
  const searchParams = useSearchParams()
  const status = searchParams.get('status') || 'pending'
  const locale = getLocale()
  const isEn = locale === 'en'
  const t = isEn ? content.en : content.tr

  const info = status === 'invalid' ? t.invalid
    : status === 'expired' ? t.expired
    : status === 'error' ? t.error
    : t.pending

  const isPending = status === 'pending' || !status

  return (
    <div className="min-h-screen bg-[#060609] flex items-center justify-center px-4 py-12" style={{ fontSize: '16px' }}>
      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <Link href="/">
            <Image src="/logos/yoai-logo.png" alt="YoAi" width={80} height={28} className="brightness-0 invert" priority />
          </Link>
        </div>

        {/* Card */}
        <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-8 backdrop-blur-sm text-center">
          {/* Icon */}
          <div className="flex justify-center mb-6">
            {isPending ? (
              <div className="w-16 h-16 rounded-2xl bg-emerald-400/10 border border-emerald-400/20 flex items-center justify-center">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgb(52,211,153)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <path d="M22 7l-10 6L2 7" />
                </svg>
              </div>
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-red-400/10 border border-red-400/20 flex items-center justify-center">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgb(248,113,113)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 8v4M12 16h.01" />
                </svg>
              </div>
            )}
          </div>

          <h1 className="text-xl font-bold text-white mb-3">{info.title}</h1>
          <p className="text-base text-gray-400 leading-relaxed mb-4">{info.desc}</p>

          {isPending && 'spam' in info && (
            <p className="text-sm text-gray-500 mb-6">{info.spam}</p>
          )}

          <div className="flex flex-col gap-3 mt-6">
            {!isPending && (
              <Link
                href="/signup"
                className="w-full inline-flex items-center justify-center bg-emerald-500 hover:bg-emerald-400 text-black font-semibold py-3 rounded-xl transition-colors text-base"
              >
                {t.backSignup}
              </Link>
            )}
            <Link
              href="/"
              className="text-sm text-gray-500 hover:text-emerald-400 transition-colors"
            >
              ← {t.backHome}
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
