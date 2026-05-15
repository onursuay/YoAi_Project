'use client'

/**
 * Onaylanmamış kullanıcı iç paneli göremesin diye sidebar dahil tüm layout
 * içeriğini bu guard sarar.
 *
 * Akış:
 *   - /api/signup/approval-status çağrılır.
 *   - 401 → kullanıcı yok, /login'e gönder.
 *   - approvalStatus !== 'approved' ve owner değilse → /basvuru-durumu'na yönlendir.
 *   - Aksi halde children render edilir.
 *
 * Loading ve redirect durumlarında SIDEBAR DAHİL HİÇBİR şey gösterilmez —
 * kullanıcıya "sisteme giriş yaptı" hissi verilmez.
 */
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

type State = 'loading' | 'allow' | 'redirect'

export default function AccountApprovalGuard({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const [state, setState] = useState<State>('loading')

  useEffect(() => {
    let cancelled = false
    async function check() {
      try {
        const res = await fetch('/api/signup/approval-status', { cache: 'no-store' })
        if (cancelled) return
        if (res.status === 401) {
          setState('redirect')
          router.replace('/login')
          return
        }
        const data = await res.json()
        if (cancelled) return
        const ok = data?.isOwner === true || data?.approvalStatus === 'approved'
        if (ok) {
          setState('allow')
        } else {
          setState('redirect')
          router.replace('/basvuru-durumu')
        }
      } catch {
        if (cancelled) return
        // Servis erişimi başarısızsa kullanıcıyı dışarıda tutmak güvenli taraf.
        setState('redirect')
        router.replace('/basvuru-durumu')
      }
    }
    check()
    return () => {
      cancelled = true
    }
  }, [router])

  if (state === 'allow') return <>{children}</>

  // Loading veya redirect — sidebar dahil hiçbir iç panel görseli render edilmez.
  return (
    <div className="min-h-screen w-full bg-gray-50 flex items-center justify-center">
      <Loader2 className="h-5 w-5 text-primary animate-spin" aria-hidden="true" />
    </div>
  )
}
