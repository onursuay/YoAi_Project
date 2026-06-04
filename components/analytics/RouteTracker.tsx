'use client'

/**
 * Route/sekme değişimlerini izleyen merkezi bileşen.
 *
 * Root layout'a (app/layout.tsx) bir kez mount edilir; ortak tek dashboard
 * layout olmadığı için tüm modülleri buradan kapsar. Her path değişiminde
 * `page_view` + (path bir modül sekmesine karşılık geliyorsa) `tab_view`
 * event'i `window.dataLayer`'a (ve varsa gtag'e) gönderir.
 *
 * Script (GTM/GA4) henüz yüklü değilken bile zararsızdır — dataLayer dizisi
 * dolar, GTM yüklendiğinde kuyruğu tüketir.
 */

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { parseTabPath } from '@/lib/tabRoutes'
import { trackPageView, trackTabView } from '@/lib/analytics/track'

export default function RouteTracker() {
  const pathname = usePathname()
  const lastPath = useRef<string>('')

  useEffect(() => {
    if (!pathname || lastPath.current === pathname) return
    lastPath.current = pathname

    trackPageView(pathname)
    const parsed = parseTabPath(pathname)
    if (parsed) {
      trackTabView({
        module: parsed.module,
        tab: parsed.tabSlug,
        platform: parsed.platform,
        pagePath: pathname,
      })
    }
  }, [pathname])

  return null
}
