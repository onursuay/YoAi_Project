'use client'

/**
 * Sayfa içi sekme durumunu URL path'inden türeten ortak hook.
 *
 * `activeTab` artık `useState` ile değil, URL segmentinden okunur. Sekme
 * tıklamasında `setTab`/`setPlatform` ile `router.push` yapılarak yeni path'e
 * gidilir (örn. `/hedef-kitle/meta/detayli-kitle`). Böylece her sekme kendine
 * özel, paylaşılabilir bir URL'ye sahip olur ve RouteTracker bunu event olarak
 * raporlar.
 *
 * Locale: hedef path TR taban yoludur; mevcut locale'e göre `localePath` ile
 * EN'e çevrilir (cookie'den okunur).
 */

import { useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  buildTabPath,
  slugToTabId,
  isPlatformSlug,
  getModuleConfig,
  type BuildTabPathOpts,
} from '@/lib/tabRoutes'
import { localePath } from '@/lib/routes'

function currentLocale(): string {
  if (typeof document === 'undefined') return 'tr'
  return document.cookie.match(/(?:^|; )NEXT_LOCALE=([^;]+)/)?.[1] || 'tr'
}

interface UsePathTabOptions {
  /** Catch-all segment param adı (default 'segments'). */
  segmentParam?: string
  /** Dinamik modüllerde id param adı (default 'id'). */
  idParam?: string
}

type NavOpts = BuildTabPathOpts & { replace?: boolean }

export function usePathTab(module: string, options: UsePathTabOptions = {}) {
  const { segmentParam = 'segments', idParam = 'id' } = options
  const params = useParams()
  const router = useRouter()
  const cfg = getModuleConfig(module)

  const raw = params?.[segmentParam]
  const segments = Array.isArray(raw) ? raw.map(String) : raw != null ? [String(raw)] : []
  const idRaw = params?.[idParam]
  const id = idRaw != null ? String(idRaw) : undefined

  let platform: string | undefined
  let tabSlug: string | undefined
  if (cfg?.kind === 'platform') {
    platform = segments[0] && isPlatformSlug(module, segments[0]) ? segments[0] : cfg.defaultPlatform
    tabSlug = segments[1]
  } else {
    tabSlug = segments[0]
  }
  const activeTab = slugToTabId(module, tabSlug)

  const navigate = useCallback(
    (tabId: string, opts: NavOpts = {}) => {
      const { replace, ...pathOpts } = opts
      const trPath = buildTabPath(module, tabId, { platform, id, ...pathOpts })
      const href = localePath(trPath, currentLocale())
      if (replace) router.replace(href, { scroll: false })
      else router.push(href, { scroll: false })
    },
    [module, router, platform, id],
  )

  const setTab = useCallback(
    (tabId: string, opts?: NavOpts) => navigate(tabId, opts),
    [navigate],
  )

  const setPlatform = useCallback(
    (nextPlatform: string, tabId?: string) => navigate(tabId ?? activeTab, { platform: nextPlatform }),
    [navigate, activeTab],
  )

  return { activeTab, platform, id, segments, setTab, setPlatform }
}
