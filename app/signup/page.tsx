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
    errorPasswordShort: 'Şifre en az 8 karakter olmalıdır.',
    errorPasswordMismatch: 'Şifreler eşleşmiyor.',
    errorPhone: 'Geçerli bir telefon numarası girin.',
    errorAlreadyVerified: 'Bu e-posta adresi zaten doğrulanmış. Giriş yapabilirsiniz.',
    errorGeneric: 'Bir hata oluştu. Lütfen tekrar deneyin.',
    passwordLabel: 'Şifre',
    passwordPlaceholder: 'En az 8 karakter',
    passwordConfirmLabel: 'Şifre Tekrar',
    passwordConfirmPlaceholder: 'Şifrenizi tekrar girin',
    hasAccount: 'Zaten hesabınız var mı?',
    login: 'Giriş Yap',
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
    errorPasswordShort: 'Password must be at least 8 characters.',
    errorPasswordMismatch: 'Passwords do not match.',
    errorPhone: 'Please enter a valid phone number.',
    errorAlreadyVerified: 'This email is already verified. You can log in.',
    errorGeneric: 'Something went wrong. Please try again.',
    passwordLabel: 'Password',
    passwordPlaceholder: 'At least 8 characters',
    passwordConfirmLabel: 'Confirm Password',
    passwordConfirmPlaceholder: 'Re-enter your password',
    hasAccount: 'Already have an account?',
    login: 'Log In',
  },
} as const

export default function SignupPage() {
  const router = useRouter()
  const locale = getLocale()
  const isEn = locale === 'en'
  const t = isEn ? content.en : content.tr

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [company, setCompany] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Phone input: only allow digits, +, spaces, parens, dashes
  function handlePhoneChange(val: string) {
    const clean = val.replace(/[^0-9+\s()-]/g, '')
    setPhone(clean)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    // Validation
    if (!name.trim()) {
      setError(t.errorName)
      return
    }
    if (!email.trim() || !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email.trim())) {
      setError(t.errorEmail)
      return
    }
    if (!password || password.length < 8) {
      setError(t.errorPasswordShort)
      return
    }
    if (password !== passwordConfirm) {
      setError(t.errorPasswordMismatch)
      return
    }
    if (phone.trim() && !/^[+]?[0-9\s()-]{7,20}$/.test(phone.trim())) {
      setError(t.errorPhone)
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password,
          company: company.trim() || undefined,
          phone: phone.trim() || undefined,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        if (data.error === 'already_verified') {
          setError(t.errorAlreadyVerified)
        } else {
          throw new Error(data.error || 'signup_error')
        }
        setLoading(false)
        return
      }

      router.push('/signup/verify')
    } catch {
      setError(t.errorGeneric)
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen bg-[#060609] flex items-center justify-center px-4 py-6 relative overflow-hidden"
      style={{ fontSize: '16px' }}
    >
      {/* Neural Network Canvas Animation */}
      <canvas id="neural-canvas" className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden="true" />
      <script dangerouslySetInnerHTML={{ __html: `
        (function() {
          var c = document.getElementById('neural-canvas');
          if (!c) return;
          var ctx = c.getContext('2d');
          var w, h, nodes = [], pulses = [];
          var NODE_COUNT = 40;
          var CONNECT_DIST = 180;
          var PULSE_CHANCE = 0.008;

          function resize() {
            w = c.width = c.offsetWidth;
            h = c.height = c.offsetHeight;
          }
          resize();
          window.addEventListener('resize', resize);

          // Create nodes
          for (var i = 0; i < NODE_COUNT; i++) {
            nodes.push({
              x: Math.random() * w,
              y: Math.random() * h,
              vx: (Math.random() - 0.5) * 0.3,
              vy: (Math.random() - 0.5) * 0.3,
              r: Math.random() * 2 + 1.5
            });
          }

          function addPulse(fromIdx, toIdx) {
            pulses.push({ from: fromIdx, to: toIdx, t: 0, speed: 0.008 + Math.random() * 0.008 });
          }

          function draw() {
            ctx.clearRect(0, 0, w, h);

            // Move nodes
            for (var i = 0; i < nodes.length; i++) {
              var n = nodes[i];
              n.x += n.vx;
              n.y += n.vy;
              if (n.x < 0 || n.x > w) n.vx *= -1;
              if (n.y < 0 || n.y > h) n.vy *= -1;
              n.x = Math.max(0, Math.min(w, n.x));
              n.y = Math.max(0, Math.min(h, n.y));
            }

            // Draw connections
            for (var i = 0; i < nodes.length; i++) {
              for (var j = i + 1; j < nodes.length; j++) {
                var dx = nodes[i].x - nodes[j].x;
                var dy = nodes[i].y - nodes[j].y;
                var dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < CONNECT_DIST) {
                  var alpha = (1 - dist / CONNECT_DIST) * 0.35;
                  ctx.beginPath();
                  ctx.moveTo(nodes[i].x, nodes[i].y);
                  ctx.lineTo(nodes[j].x, nodes[j].y);
                  ctx.strokeStyle = 'rgba(255,255,255,' + alpha + ')';
                  ctx.lineWidth = 0.8;
                  ctx.stroke();

                  // Random pulse
                  if (Math.random() < PULSE_CHANCE && pulses.length < 15) {
                    addPulse(i, j);
                  }
                }
              }
            }

            // Draw pulses (data flowing between nodes)
            for (var p = pulses.length - 1; p >= 0; p--) {
              var pulse = pulses[p];
              pulse.t += pulse.speed;
              if (pulse.t > 1) { pulses.splice(p, 1); continue; }
              var from = nodes[pulse.from];
              var to = nodes[pulse.to];
              var px = from.x + (to.x - from.x) * pulse.t;
              var py = from.y + (to.y - from.y) * pulse.t;
              var glow = Math.sin(pulse.t * Math.PI);
              ctx.beginPath();
              ctx.arc(px, py, 2, 0, Math.PI * 2);
              ctx.fillStyle = 'rgba(16,185,129,' + (glow * 0.8) + ')';
              ctx.fill();
              ctx.beginPath();
              ctx.arc(px, py, 5, 0, Math.PI * 2);
              ctx.fillStyle = 'rgba(16,185,129,' + (glow * 0.2) + ')';
              ctx.fill();
            }

            // Draw nodes
            for (var i = 0; i < nodes.length; i++) {
              var n = nodes[i];
              ctx.beginPath();
              ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
              ctx.fillStyle = 'rgba(255,255,255,0.25)';
              ctx.fill();
              // Subtle glow
              ctx.beginPath();
              ctx.arc(n.x, n.y, n.r + 3, 0, Math.PI * 2);
              ctx.fillStyle = 'rgba(255,255,255,0.03)';
              ctx.fill();
            }

            requestAnimationFrame(draw);
          }
          draw();
        })();
      ` }} />

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="flex justify-center mb-5">
          <Link href="/">
            <Image
              src="/logos/yoai-logo.png"
              alt="YoAi"
              width={80}
              height={28}
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
                onChange={(e) => handlePhoneChange(e.target.value)}
                placeholder={t.phonePlaceholder}
                className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3 text-base text-white placeholder-gray-500 outline-none transition focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30"
                autoComplete="tel"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                {t.passwordLabel} <span className="text-emerald-400">*</span>
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t.passwordPlaceholder}
                className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3 text-base text-white placeholder-gray-500 outline-none transition focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30"
                autoComplete="new-password"
              />
            </div>

            {/* Password Confirm */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                {t.passwordConfirmLabel} <span className="text-emerald-400">*</span>
              </label>
              <input
                type="password"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                placeholder={t.passwordConfirmPlaceholder}
                className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3 text-base text-white placeholder-gray-500 outline-none transition focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30"
                autoComplete="new-password"
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

          {/* Login link */}
          <div className="mt-4 text-center">
            <p className="text-sm text-gray-500">
              {t.hasAccount}{' '}
              <Link href="/login" className="text-emerald-400 hover:text-emerald-300 font-medium transition">{t.login}</Link>
            </p>
          </div>
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
