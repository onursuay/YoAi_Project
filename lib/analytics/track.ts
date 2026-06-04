/**
 * İzleme (event/analitik) yardımcıları — no-op-safe.
 *
 * YoAi panelinde şu an GTM/GA4 script'i yüklü DEĞİL. Bu katman, route/sekme
 * değişimlerini `window.dataLayer`'a yazar (GTM yüklendiğinde kuyruktaki
 * event'leri tüketir — standart GTM deseni) ve `window.gtag` mevcutsa ona da
 * iletir. Hiçbir script yokken sessizce bekler, asla hata vermez.
 */

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[]
    gtag?: (...args: unknown[]) => void
  }
}

export function pushDataLayer(event: Record<string, unknown>): void {
  if (typeof window === 'undefined') return
  window.dataLayer = window.dataLayer || []
  window.dataLayer.push(event)
}

/** Route/sayfa görüntüleme — her navigasyonda çağrılır. */
export function trackPageView(pagePath: string, meta: Record<string, unknown> = {}): void {
  if (typeof window === 'undefined') return
  const payload = {
    page_path: pagePath,
    page_location: window.location.href,
    page_title: typeof document !== 'undefined' ? document.title : undefined,
    ...meta,
  }
  pushDataLayer({ event: 'page_view', ...payload })
  if (typeof window.gtag === 'function') {
    window.gtag('event', 'page_view', payload)
  }
}

/** Sekme/alt-alan görüntüleme — hangi modülün hangi sekmesinin açıldığını taşır. */
export function trackTabView(params: {
  module: string
  tab: string
  platform?: string
  pagePath: string
}): void {
  if (typeof window === 'undefined') return
  const { module, tab, platform, pagePath } = params
  const payload = {
    module,
    tab,
    ...(platform ? { platform } : {}),
    page_path: pagePath,
  }
  pushDataLayer({ event: 'tab_view', ...payload })
  if (typeof window.gtag === 'function') {
    window.gtag('event', 'tab_view', payload)
  }
}
