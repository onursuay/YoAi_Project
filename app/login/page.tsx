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
    title: 'Giriş Yap',
    subtitle: 'Hesabınıza giriş yapın.',
    emailLabel: 'E-posta Adresi',
    emailPlaceholder: 'ornek@sirket.com',
    passwordLabel: 'Şifre',
    passwordPlaceholder: 'Şifrenizi girin',
    submit: 'Giriş Yap',
    submitting: 'Giriş yapılıyor...',
    noAccount: 'Hesabınız yok mu?',
    signup: 'Ücretsiz Kayıt Ol',
    backHome: 'Ana sayfaya dön',
    errorMissing: 'E-posta ve şifre gereklidir.',
    errorInvalid: 'E-posta veya şifre hatalı.',
    errorNotVerified: 'Hesabınız henüz doğrulanmamış. E-postanızı kontrol edin.',
    errorGeneric: 'Bir hata oluştu. Lütfen tekrar deneyin.',
  },
  en: {
    title: 'Log In',
    subtitle: 'Sign in to your account.',
    emailLabel: 'Email Address',
    emailPlaceholder: 'example@company.com',
    passwordLabel: 'Password',
    passwordPlaceholder: 'Enter your password',
    submit: 'Log In',
    submitting: 'Signing in...',
    noAccount: "Don't have an account?",
    signup: 'Sign Up Free',
    backHome: 'Back to homepage',
    errorMissing: 'Email and password are required.',
    errorInvalid: 'Invalid email or password.',
    errorNotVerified: 'Your account is not verified yet. Please check your email.',
    errorGeneric: 'Something went wrong. Please try again.',
  },
} as const

export default function LoginPage() {
  const router = useRouter()
  const locale = getLocale()
  const isEn = locale === 'en'
  const t = isEn ? content.en : content.tr

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!email.trim() || !password) {
      setError(t.errorMissing)
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      })

      const data = await res.json()

      if (!res.ok) {
        if (data.error === 'not_verified') {
          setError(t.errorNotVerified)
        } else if (data.error === 'invalid_credentials') {
          setError(t.errorInvalid)
        } else {
          setError(t.errorGeneric)
        }
        setLoading(false)
        return
      }

      router.push('/dashboard')
    } catch {
      setError(t.errorGeneric)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#060609] flex items-center justify-center px-4 py-6 relative overflow-hidden" style={{ fontSize: '16px' }}>
      {/* Neural network canvas */}
      <canvas id="neural-canvas-login" className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden="true" />
      <script dangerouslySetInnerHTML={{ __html: `
        (function() {
          var c = document.getElementById('neural-canvas-login');
          if (!c) return;
          var ctx = c.getContext('2d');
          var w, h, nodes = [], pulses = [];
          function resize() { w = c.width = c.offsetWidth; h = c.height = c.offsetHeight; }
          resize(); window.addEventListener('resize', resize);
          for (var i = 0; i < 35; i++) nodes.push({ x: Math.random()*w, y: Math.random()*h, vx: (Math.random()-0.5)*0.3, vy: (Math.random()-0.5)*0.3, r: Math.random()*2+1.5 });
          function draw() {
            ctx.clearRect(0,0,w,h);
            for (var i=0;i<nodes.length;i++) { var n=nodes[i]; n.x+=n.vx; n.y+=n.vy; if(n.x<0||n.x>w)n.vx*=-1; if(n.y<0||n.y>h)n.vy*=-1; }
            for (var i=0;i<nodes.length;i++) for (var j=i+1;j<nodes.length;j++) {
              var dx=nodes[i].x-nodes[j].x,dy=nodes[i].y-nodes[j].y,dist=Math.sqrt(dx*dx+dy*dy);
              if (dist<180) { ctx.beginPath(); ctx.moveTo(nodes[i].x,nodes[i].y); ctx.lineTo(nodes[j].x,nodes[j].y); ctx.strokeStyle='rgba(255,255,255,'+(1-dist/180)*0.35+')'; ctx.lineWidth=0.8; ctx.stroke();
                if(Math.random()<0.008&&pulses.length<15) pulses.push({from:i,to:j,t:0,speed:0.008+Math.random()*0.008});
              }
            }
            for (var p=pulses.length-1;p>=0;p--) { var pulse=pulses[p]; pulse.t+=pulse.speed; if(pulse.t>1){pulses.splice(p,1);continue;}
              var f=nodes[pulse.from],t2=nodes[pulse.to],px=f.x+(t2.x-f.x)*pulse.t,py=f.y+(t2.y-f.y)*pulse.t,glow=Math.sin(pulse.t*Math.PI);
              ctx.beginPath();ctx.arc(px,py,2,0,Math.PI*2);ctx.fillStyle='rgba(16,185,129,'+(glow*0.8)+')';ctx.fill();
            }
            for (var i=0;i<nodes.length;i++) { ctx.beginPath();ctx.arc(nodes[i].x,nodes[i].y,nodes[i].r,0,Math.PI*2);ctx.fillStyle='rgba(255,255,255,0.25)';ctx.fill(); }
            requestAnimationFrame(draw);
          }
          draw();
        })();
      ` }} />

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="flex justify-center mb-5">
          <Link href="/">
            <Image src="/logos/yoai-logo.png" alt="YoAi" width={80} height={28} className="brightness-0 invert" priority />
          </Link>
        </div>

        {/* Card */}
        <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-8 backdrop-blur-sm">
          <h1 className="text-2xl font-bold text-white text-center mb-2">{t.title}</h1>
          <p className="text-base text-gray-400 text-center mb-8">{t.subtitle}</p>

          {error && (
            <div className="mb-6 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">{t.emailLabel}</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder={t.emailPlaceholder}
                className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3 text-base text-white placeholder-gray-500 outline-none transition focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30"
                autoComplete="email"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">{t.passwordLabel}</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={t.passwordPlaceholder}
                className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3 text-base text-white placeholder-gray-500 outline-none transition focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30"
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-emerald-500/20 transition hover:from-emerald-600 hover:to-teal-600 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? t.submitting : t.submit}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-500">
              {t.noAccount}{' '}
              <Link href="/signup" className="text-emerald-400 hover:text-emerald-300 font-medium transition">{t.signup}</Link>
            </p>
          </div>
        </div>

        <div className="mt-6 text-center">
          <Link href="/" className="text-sm text-gray-500 hover:text-emerald-400 transition">← {t.backHome}</Link>
        </div>
      </div>
    </div>
  )
}
