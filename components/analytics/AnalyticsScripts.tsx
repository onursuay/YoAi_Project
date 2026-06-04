'use client'

/**
 * Panel-içi analitik script yükleyici (Google Tag Manager ve/veya GA4).
 *
 * Bu, YoAi PANELİNİN KENDİSİ için birinci-taraf ürün analitiğidir — RouteTracker
 * + lib/analytics/track.ts'in window.dataLayer'a pushladığı `page_view` ve
 * `tab_view` event'lerini tüketen tag yöneticisi/ölçüm script'ini yükler.
 *
 * NOT: lib/marketing-setup/* ile KARIŞTIRMA — o akış KULLANICININ KENDİ siteleri
 * için GTM/GA4 snippet'i üretir; bu bileşen panelin kendi ölçümü içindir.
 *
 * Davranış:
 * - DEFAULT-OFF: env değişkenleri set değilse hiçbir script yüklenmez (null döner).
 * - NEXT_PUBLIC_GTM_CONTAINER_ID set ise GTM (gtm.js) yüklenir.
 * - NEXT_PUBLIC_GA4_MEASUREMENT_ID set ise GA4 (gtag.js) doğrudan yüklenir.
 *   İKİSİNİ AYNI ANDA set ETME (çift kurulum riski — bkz. .env.example K bölümü).
 * - GA4 config'de send_page_view:false → tek page_view kaynağı RouteTracker olur
 *   (SPA için GA4'ün önerdiği manuel-pageview deseni; çift sayım engellenir).
 * - Consent Mode v2 default: reklam depolaması (ad_*) baştan 'denied'; yalnız
 *   first-party analytics_storage 'granted'. Reklam/retargeting çerezi yüklenmez.
 *
 * TODO (ileride): EU son-kullanıcıya açık genel pazara çıkıldığında veya pazarlama
 * çerezi eklendiğinde bir CMP (consent banner) eklenip analytics_storage ona bağlanır.
 */

import Script from 'next/script'

export default function AnalyticsScripts() {
  // Dinamik anahtar Next'te inline edilmez — tam literal okunmalı.
  const gtmId = process.env.NEXT_PUBLIC_GTM_CONTAINER_ID
  const ga4Id = process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID

  if (!gtmId && !ga4Id) return null

  return (
    <>
      {gtmId && (
        <Script id="gtm-loader" strategy="afterInteractive">
          {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtmId}');`}
        </Script>
      )}

      {ga4Id && (
        <>
          <Script
            id="ga4-loader"
            src={`https://www.googletagmanager.com/gtag/js?id=${ga4Id}`}
            strategy="afterInteractive"
          />
          <Script id="ga4-init" strategy="afterInteractive">
            {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'granted'});
gtag('js', new Date());
gtag('config','${ga4Id}',{send_page_view:false});`}
          </Script>
        </>
      )}
    </>
  )
}
