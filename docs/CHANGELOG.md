# YoAi Project — Değişiklik Günlüğü

---

## 2026-06-12 — Güvenlik: oturum kimliği taklidini (impersonation) kapat — imzalı user_id çerezi
- **Sorun:** Kimlik `user_id` çerezi = düz `signups.id` idi; sunucu tarafı doğrulama yoktu. Bir kullanıcının UUID'sini ele geçiren saldırgan çerezini değiştirip o kullanıcı olarak işlem yapabilirdi (impersonation). 70 ayrı yer çerezi ham okuyordu.
- **Çözüm:** `lib/auth/userCookie.ts` — `user_id` çerez değeri artık HMAC-SHA256 ile imzalı (`${id}.${hmac}`, SESSION_SECRET). Tek `readUserId()` helper'ı imzayı sabit-zamanlı doğrular; geçersiz/imzasız/taklit değerleri reddeder (null → yeniden login). Login + signup/verify `signUserId()` ile yazar. **62 okuma noktası** ham `cookieStore.get('user_id')?.value` → `readUserId(cookieStore)` olarak dönüştürüldü (script + tsc + grep ile sıfır ham okuma doğrulandı). Forgery testi: imzalı kabul, taklit reddedildi.
- **Deploy-güvenli:** SESSION_SECRET yoksa eski davranışa düşer (kilitleme yok); secret eklenince tam koruma + eski oturumlar yeniden login. Edge-runtime çakışması yok (node:crypto kullanan helper'ı hiçbir Edge route import etmiyor).
- **Gerekli (sen):** `SESSION_SECRET` değerini Vercel env'e ekle (bir kez set edince değiştirme → tüm oturumlar geçersiz olur).
- **Kalan (ayrı):** sunucu-taraflı oturum iptali (revocation list) — imzalama forgery'yi kapattı; uzaktan oturum sonlandırma ileride.
- **Dosyalar:** `lib/auth/userCookie.ts` (yeni), `app/api/auth/login/route.ts`, `app/api/signup/verify/route.ts`, + 62 okuyucu route/lib, `.env.example`

## 2026-06-12 — Güvenlik: Meta/Google OAuth token'ları at-rest şifreleme (AES-256-GCM)
- **Sorun:** Meta access_token ve Google refresh_token DB'de düz metin saklanıyordu (googleAdsConnectionStore'da TODO ile itiraf edilmişti). RLS açığı kapandı ama DB-dump senaryosuna karşı şifreleme yoktu.
- **Çözüm:** Mevcut `lib/meta/crypto.ts` (AES-256-GCM, META_TOKEN_SECRET) connection store'a bağlandı + Google için `lib/google-ads/crypto.ts` (GOOGLE_ADS_TOKEN_SECRET) oluşturuldu. **Encrypt-on-write + decrypt-on-read, geriye uyumlu:** eski düz-metin token'lar (decrypt null döner) olduğu gibi okunmaya devam eder — mevcut bağlantılar bozulmaz. Token yalnızca kendi store'larından okunduğu için (diğer okuyucular token kolonunu select etmiyor — doğrulandı) **API/fetcher/publish akışlarına dokunulmadı** ([feedback_no_touch_meta_google](memory)). Secret yoksa düz-metne düşer (kırılmaz). Round-trip + legacy-plaintext testi + tsc geçti. TikTok zaten şifreliydi (TIKTOK_TOKEN_SECRET set).
- **Rotasyon:** Mevcut (açıkta kalmış) token'lar reconnect ile yenilenince şifreli yazılır; in-place migration yapılmadı (risk minimizasyonu).
- **Gerekli (sen):** META_TOKEN_SECRET ve GOOGLE_ADS_TOKEN_SECRET değerlerini **Vercel env'e aynen** ekle (bir kez set edilince DEĞİŞTİRME — şifreli token'lar okunamaz hale gelir).
- **Dosyalar:** `lib/google-ads/crypto.ts` (yeni), `lib/metaConnectionStore.ts`, `lib/googleAdsConnectionStore.ts`, `.env.example`

## 2026-06-12 — Sahte veri: dashboard'daki uydurma TikTok kartı kaldırıldı (lansmanda TikTok gizli)
- **Sorun:** Dashboard, her kullanıcıya TikTok'u `tiktokConnected || true` ile "bağlı" gösteriyor ve hardcoded sahte KPI'lar basıyordu (₺18.420,50 harcama, 6.284 tık, 142.680 gösterim + uydurma 30 günlük grafik). Ücretli üründe kullanıcı bunu gerçek sanıyordu — "sahte veri yasak" ilkesi ihlali. (Lansman kararı: TikTok gizlenecek.)
- **Çözüm:** Dashboard TikTok Ads kartı tamamen kaldırıldı; sahte `tiktokPlaceholder` KPI bloğu silindi; `tiktokConnected || true` sahte-bağlı mantığı gerçek duruma (`tiktokConnected`) dürüstleştirildi. TikTok entegrasyon onayı sonrası gerçek veriyle geri eklenecek.
- **Dosyalar:** `app/dashboard/HomePage.tsx`
- **Kalan (TikTok gizleme tamamlama):** `/tiktok-ads` sayfası ve `app/entegrasyon` TikTok bağlama kartı da kapatılacak (sonraki geçiş).

## 2026-06-12 — Güvenlik: login brute-force throttle + tarayıcı SSRF koruması
- **Sorun:** (1) Login endpoint'inde hiç rate-limit/brute-force koruması yoktu — sınırsız parola denemesi mümkündü. (2) İşletme/sosyal kaynak tarayıcıları kullanıcının verdiği URL'i iç-ağ/özel-IP koruması olmadan fetch ediyordu (SSRF — iç servis/cloud metadata 169.254.x'e istek atılabilirdi).
- **Çözüm:** (1) DB-backed throttle: yeni `login_attempts` tablosu (RLS açık, service-role) + atomik `register_login_failure`/`clear_login_attempts` RPC'leri; 15 dk içinde 8 başarısız deneme → 15 dk kilit (429). bcrypt'ten önce kontrol, e-posta enumeration sızdırmaz, başarıda sıfırlanır. Canlı omddq'ya kontrollü uygulandı + RPC fonksiyonel test edildi. UI'da `too_many_attempts` mesajı (TR+EN). (2) `businessSourceScanner`/`socialSourceScanner` artık mevcut `lib/seo/assertSafeUrl` (DNS çözer, özel aralık reddeder, fail-closed) ile korunuyor; throw mevcut catch ile `failed()` olarak yutuluyor.
- **Dosyalar:** `supabase/migrations/20260612000000_login_attempts.sql` (yeni), `scripts/db-apply-migration.mjs` (yeni), `app/api/auth/login/route.ts`, `app/login/page.tsx`, `lib/yoai/businessSourceScanner.ts`, `lib/yoai/socialSourceScanner.ts`

## 2026-06-12 — KRİTİK para açığı: auth'suz AI üretim endpoint'leri + sınırsız kredi iadesi
- **Sorun:** AI üretim endpoint'leri (`tasarim/generate-image`, `generate-video`, `enhance-prompt`, `upload`, `yoai/chat`, `seo/analyze`) ne kimlik ne kredi/abonelik kontrolü yapıyordu; kredi düşümü yalnız istemci JS'inde olduğundan (1) login olmadan internetten herkes FAL/Anthropic/PageSpeed faturası yaktırabiliyor, (2) abone doğrudan endpoint çağırıp kredi sistemini atlayabiliyordu. Ayrıca `POST /api/credits/refund` keyfi `amount` ile sınırsız bedava kredi bastırıyordu.
- **Çözüm:** Yeni `lib/billing/featureGuard.ts` (`chargeFeature`): sunucu-taraflı kimlik + (gerekirse) aktif abonelik + atomik kredi düşümü + başarısızlıkta otomatik iade; owner bypass. Endpoint'lere uygulandı: tasarım görsel/video (design_generation, 20 kredi, hata→iade), enhance-prompt/upload (kimlik), yoai/chat (abonelik + yoalgoritma_chat 5 kredi, nodejs runtime'a alındı), seo/analyze (abonelik). İstemci çift-düşümü kaldırıldı (tasarım/yoalgoritma/SEO sayfaları artık sunucu bakiyesini yeniden çeker). Tehlikeli `/api/credits/refund` route'u **silindi**; iade artık yalnız sunucu içinde guard tarafından yapılır. İç akışlar (SEO cron) lib fonksiyonlarını doğrudan çağırdığı için etkilenmez. `tsc --noEmit` 0 hata.
- **Davranış değişikliği (gözden geçir):** YoAlgoritma/Tasarım içindeki ad-creative görsel üretimi (MetaCreativePanel/AdImageGenerator) ve manuel SEO makale içeriği artık kredi tüketir (önceden bedavaydı) — "bedava AI yok" ilkesi gereği bilinçli.
- **Dosyalar:** `lib/billing/featureGuard.ts` (yeni), `app/api/tasarim/{generate-image,generate-video,enhance-prompt,upload}/route.ts`, `app/api/yoai/chat/route.ts`, `app/api/seo/analyze/route.ts`, `app/api/credits/refund/route.ts` (silindi), `components/providers/CreditProvider.tsx`, `app/tasarim/[[...segments]]/page.tsx`, `app/yoalgoritma/page.tsx`, `components/seo/SeoArticlesTab.tsx`

## 2026-06-12 — KRİTİK güvenlik: canlı DB'de müşteri token'ları + parola hash'leri internete açıktı (RLS)
- **Sorun:** Halka açılış denetiminde, canlı omddq veritabanında 7 tabloda Row Level Security (RLS) hiç açılmamıştı. Supabase'in varsayılan grant'ları yüzünden bu tablolar, sitenin istemci paketine gömülü **herkese açık** `sb_publishable_…` (anon) anahtarıyla internetten okunabiliyordu. Canlı test (anon anahtarla `/rest/v1/...`) ile kanıtlandı: `meta_connections` (müşteri Meta access_token'ları, düz metin `EAA2…`), `google_ads_connections` (Google refresh_token), `signups` (ad/e-posta/`password_hash`) HTTP 200 ile sızıyordu. Sıfır bilgiyle sömürülebilir (DevTools'tan anahtarı al + tek curl).
- **Çözüm:** Etkilenen 7 tabloda `ENABLE ROW LEVEL SECURITY` (kontrollü/teyitli: önce kanarya `report_cache` → service-role hâlâ okuyor + anon engellendi doğrulandı, sonra kalan 6). Uygulamayı bozmaz çünkü tüm DB erişimi `lib/supabase/client.ts` (`server-only` + service-role) üzerinden ve service-role RLS'i baypas eder; tarayıcıda anon Supabase client'ı yok (grep ile doğrulandı). Politika yok = anon'a deny-all (zaten çalışan 57 tablonun deseni). Son durum: 71/71 tablo RLS açık, anon'a sızıntı 0.
- **Takip (açık):** (a) düz metin OAuth token'larını at-rest şifrele, (b) açıkta kaldıkları için mevcut Meta/Google token'larını yenile/iptal et. Tablolar: `meta_connections`, `google_ads_connections`, `google_analytics_connections`, `google_search_console_connections`, `signups`, `report_cache`, `strategy_templates`.
- **Dosyalar:** `scripts/db-audit.mjs` (yeni, salt-okuma RLS denetimi), `scripts/db-fix-rls.mjs` (yeni, kanaryalı RLS düzeltme), `scripts/supabase-ca.pem` (doğrulanmış Supabase CA, sabitlenmiş TLS); DB değişikliği (kodda değil): 7 tabloda RLS.

## 2026-06-10 — Email Marketing: "Gönderildi" diyor ama mail gitmiyor (sessiz hata + Vercel SMTP)
- **Sorun:** Gmail hesabı bağlanıp kampanya gönderilince UI "Gönderildi" gösteriyor ama ne gönderene ne alıcıya mail ulaşmıyordu (sayaç "0/1 gönderildi"). İki kök neden: (1) `buildDispatch` içindeki tüm dispatch'ler boş `catch { return null }` ile gerçek gönderim hatasını sessizce yutuyordu; (2) `sendCampaign` 0 mail gitse bile kampanya status'unu koşulsuz `'sent'` yapıyordu. Asıl başarısızlık: Gmail yolu nodemailer ile `smtp.gmail.com:465` (SMTP) kullanıyordu — Vercel serverless giden SMTP portlarını engeller/timeout eder, bu yüzden kodun geri kalanı zaten HTTP tabanlı Resend kullanıyor.
- **Çözüm:** (1) Gmail gönderimi SMTP yerine **Gmail API (HTTPS `messages/send`)** ile yapılıyor — aynı `gmail.send` scope'u + saklı refresh_token, Vercel-güvenli (`lib/email/gmailApiSender.ts`, `refreshAccessToken` ile access token alıp RFC822 mesajı base64url POST eder). (2) Tüm boş catch'ler kaldırıldı; gerçek hata `getLastError()` yan-kanalıyla yüzeye çıkıyor + `console.error` loglanıyor. (3) `sent === 0` ise kampanya artık `'failed'` işaretleniyor ve API `reason: 'send_failed'` + gerçek hata mesajı dönüyor; UI bunu toast'ta gösteriyor (artık sahte "Gönderildi" yok). Resend yolları da `r.error` fırlatacak şekilde sağlamlaştırıldı. Migration yok (status constraint zaten `'failed'` içeriyor).
- **Dosyalar:** `lib/email/gmailApiSender.ts` (yeni), `lib/email/sender.ts`, `components/email/CampaignsTab.tsx`, `locales/tr.json`, `locales/en.json`

## 2026-06-10 — Rezervasyon/randevu tespitini derinleştirme (eklenti listesine bağımlı değil)
- **Sorun:** Rezervasyon tespiti yüzeysel görünüyordu — yalnız birkaç tanıdık eklenti (HotelRunner/Booking/OpenTable/Calendly). Onlarca 2. parti randevu sistemi + sitelerin kendi özel rezervasyon formları var; gerçekçi sonuç için site taranarak genel algılama şart.
- **Çözüm:** Tespit 3 katmanlı ve içerik-güdümlü: (1) Genişletilmiş deterministik kural — CTA metinleri (TR+EN: Randevu Al/Oluştur, Rezervasyon Yap, Müsaitlik Sorgula, Online Randevu, Book Now/Make an Appointment…), URL hedefleri (/rezervasyon /randevu /booking…) ve **yapısal booking widget imzaları** (check-in/check-out, giriş/çıkış tarihi, date-range alanları) — sitenin KENDİ özel formunu da yakalar. (2) ~30 2. parti sistem: randevu (Setmore/SimplyBook/Acuity/Fresha/Booksy/Mindbody/Cal.com/Amelia/Bookly) + restoran (TheFork/Resy/SevenRooms/Quandoo) + otel motorları (SiteMinder/SynXis/Cloudbeds/TravelClick/Lodgify) + TR otel motorları (HotelRunner/Elektra Web/Sejour/Odamax/Hotech/**Reseliva/Protel-Barboon/HMS Otel/Sistem Otel/Exely/BookLogic/Webius Digital**). (3) Claude AI prompt'u: "tanıdık eklenti olmasa bile içerik/butonlardan rezervasyon mekanizmasını algıla" direktifi → uzun kuyruğu (özel/bilinmeyen sistemler) yakalar. Tüm regex'ler gerçek örneklerle test edildi (yanlış-pozitif yok).
- **Dosyalar:** `lib/marketing-setup/siteScanner.ts`

## 2026-06-10 — Dönüşüm Sihirbazı: "Neler Kurulacak"ta gerçek mevcut-kaynak tespiti (Group C-2)
- **Sorun:** Önizleme adımında her kaynak statik olarak "Oluşturulacak" gösteriliyordu — hâlihazırda var olan pixel/dönüşüm/kitle olup olmadığı belli değildi (default, dinamik değil).
- **Çözüm:** Yeni salt-okunur `/api/marketing-setup/preview-status` endpoint'i bağlı platformlarda DEPLOY'un oluşturacağı isimli kaynakların canlı API ile var olup olmadığını yoklar (Meta custom conversions + website/benzer kitle, Google Ads conversion actions + remarketing — isim kalıpları deploy ile birebir). Çekirdek altyapı (Meta Pixel, GSC doğrulama) `connections`'tan okunur. ConfigPreview artık her öğeyi "Mevcut" (gri) veya "Oluşturulacak" (yeşil) olarak dinamik işaretler; kartın tüm öğeleri varsa rozet "Mevcut" olur. Deploy zaten idempotent — bu yalnız dürüst önizleme; probe best-effort (tespit edilemezse "Oluşturulacak").
- **Dosyalar:** `app/api/marketing-setup/preview-status/route.ts`, `components/marketing-setup/steps/ConfigPreview.tsx`, `lib/marketing-setup/types.ts`, `locales/{tr,en}.json`

## 2026-06-10 — Dönüşüm Sihirbazı: 'Rezervasyon Yap' event'i + video önerisini kaldırma (Group C-1)
- **Sorun:** Otel/randevu/booking işlerinde site taraması rezervasyon aksiyonunu yalnız `begin_checkout` olarak yakalıyordu; "Rezervasyon Yap" diye bir event yoktu. Ayrıca düşük değerli `video_play` (yalnız sitede video olması) önerilenlere düşebiliyordu.
- **Çözüm:** Yeni `reservation` standart event'i — Meta `Schedule` (standart) + GA4 `reservation`, dönüşüm olarak işaretlenir (`metaCustomEventType` zaten `Schedule`'ı tanıyor → deploy tam uyumlu). siteScanner'a rezervasyon/randevu CTA tespit kuralı (book now / rezervasyon yap / müsaitlik sorgula / randevu al / `/rezervasyon` linki) + HotelRunner/Booking/OpenTable/Calendly eklentilerine `reservation` eklendi. AI prompt'u rezervasyon=Schedule vs purchase ayrımını ve online ödeme varsa ikisini birlikte önermeyi öğrendi; `video_play` artık otomatik önerilmez (deterministik `buildRecommended`'tan çıkarıldı + AI'a "merkezde video yoksa önerme" direktifi). Manuel seçim hâlâ mümkün.
- **Dosyalar:** `lib/marketing-setup/constants.ts`, `lib/marketing-setup/siteScanner.ts`, `locales/{tr,en}.json`

## 2026-06-10 — Email Marketing: hesap filtresi + reklamdan otomatik kişi + Başvuru tarihi (Group B)
- **Sorun:** (1) Kişiler tüm kullanıcı geneli gösteriliyordu — hesap (Meta sayfa) bazlı filtre yoktu. (2) Reklamdan (Meta Lead Ads) düşen lead'ler yalnız elle "CRM'den Aktar" ile email'e geliyordu, otomatik akış yoktu. (3) Tabloda yalnız "Eklendi" (kişi havuzuna ekleme) tarihi vardı; reklam formuna gerçek "Başvuru" tarihi (`crm_leads.lead_created_time`) email tarafına taşınmıyordu.
- **Çözüm:** `email_contacts`'a additive `submitted_at` (başvuru) + `page_id` (hesap) kolonları (migration + omddq apply script). (2) Webhook (`metaLeadIngest`) ve cron/manuel pull (`metaLeadPull`) artık her lead'i otomatik `email_contacts`'a senkronlar (e-postası varsa, idempotent, non-fatal). (1) Yeni `/api/email/accounts` + Kişiler sekmesinde "Tüm Hesaplar" dropdown'u (Meta tarzı WizardSelect); `?pageId` filtresi liste+sayaç. (3) "Başvuru" sütunu eklendi; `importFromCrm` artık page_id + lead_created_time taşır. Migration uygulanmamışsa `upsertContacts` bu alanlar olmadan tekrar dener (geriye dönük uyumlu). Meta/Google API ve publish akışına dokunulmadı.
- **Dosyalar:** `supabase/migrations/20260610000000_email_contacts_submitted_at_page.sql`, `scripts/apply-email-contacts-submitted-page-migration.mjs`, `lib/email/contactStore.ts`, `lib/crm/{metaLeadIngest,metaLeadPull}.ts`, `app/api/email/{contacts,accounts}/route.ts`, `components/email/EmailDashboard.tsx`, `locales/{tr,en}.json`

## 2026-06-10 — Dönüşüm Sihirbazı: tek-tık kurulum + MCC alt hesap + gerçek hata mesajları (Group A)
- **Sorun:** (5) Adım 3'te "Onayla ve Kuruluma Başla" sadece adım 4'e geçiriyor, orada ikinci bir "Başlat" butonuna basmak gerekiyordu (çift buton). (3) Google Ads dropdown'unda MCC (manager) hesabı seçilince altındaki müşteri hesapları açılmıyordu ve "Hesap Seçilmedi" seçeneği yoktu — opsiyonel olmasına rağmen bir hesap zorla seçili kalıyordu. (6) Kurulum adımı hata verince "Bu adım tamamlanamadı, tekrar deneyin" diyordu — nedeni/çözümü söylemiyordu.
- **Çözüm:** (5) Adım 4'e girince kurulum **otomatik başlar**, ayrı "Başlat" butonu kaldırıldı (deploy route'ları kendi ön koşullarını ayrıca doğruladığı için güvenli). (3) Yeni salt-okunur wizard endpoint'i `google-ads-accounts` MCC'leri `customer_client` ile alt hesaplarına genişletir; dropdown'a "Hesap Seçilmedi" (opt-out) + manager başlığı + alt hesaplar eklendi. Opt-out global Google Ads seçimine (Reklam Yöneticisi) **dokunmaz**; yeni `skipped` adım durumu ile Google Ads adımı dürüstçe "Atlandı" gösterilir. (6) `stepError` gerçek sağlayıcı hatalarını (developer token, süresi dolmuş oturum, yetki, kota, pixel yok…) sade TR/EN mesaja + aksiyon ipucuna çevirir.
- **Dosyalar:** `components/marketing-setup/steps/{Deployment,PlatformConnect,ConfigPreview,ResultDashboard}.tsx`, `components/marketing-setup/{stepError.ts,wizardTypes.ts,MarketingSetupWizard.tsx}`, `app/api/marketing-setup/google-ads-accounts/route.ts`, `app/api/marketing-setup/google-ads/route.ts`, `lib/marketing-setup/types.ts`, `locales/{tr,en}.json`

## 2026-06-10 — Resmi doküman tarama 504 timeout fix (Inngest arka plan + tek-sayfa Firecrawl)
- **Sorun:** Manuel/cron tarama `504 GATEWAY_TIMEOUT` (FUNCTION_INVOCATION_TIMEOUT) veriyordu. İki kök neden: (1) resmi doküman çekerken `scrapeSite` tüm domaini (developers.google.com vb.) map+crawl ediyordu — yavaş + yanlış; (2) 10 kaynak × (Firecrawl + AI parser) senkron HTTP'de serverless süre limitini aşıyordu.
- **Çözüm:** (1) `fetchOfficialAdsSource` artık tek-sayfa `firecrawlScrape(url)` kullanıyor (doküman tek sayfa — map yok, çok daha hızlı/doğru). (2) Tarama Inngest'e taşındı (`official-ads/refresh`): her KAYNAK ayrı `step.run` (ayrı invocation → timeout yok), Inngest durability + retry. Cron route artık event fire edip anında döner; Inngest yoksa (dev) inline fallback. Loop gövdesi `refreshSingleSource` + `resolveRefreshDeps` + `loadRefreshSources` + `applySourceOutcome`'a çıkarıldı (davranış birebir korunur, 12+3 test yeşil).
- **Dosyalar:** `lib/yoai/officialAdsDocsRefresh.ts`, `lib/yoai/officialAdsRefreshRunner.ts`, `inngest/functions/officialAdsRefresh.ts`, `app/api/inngest/route.ts`, `app/api/cron/official-ads-refresh/route.ts`

## 2026-06-10 — Optimizasyon Sihirli Tarama AI fallback'i: timeout + sebep teşhisi
- **Sorun:** "AI ile Tara" sık sık "AI talep edildi ancak yanıt alınamadı — sonuçlar kural tabanlı analizden üretildi" gösterip kural motoruna düşüyordu. Kök neden: senkron Claude çağrısının **10s timeout'u** çok agresifti (Strateji aynı tür çağrıda 30s kullanıyor) ve gerçek hata `catch` içinde sessizce yutuluyordu (sebebi görmek imkânsızdı).
- **Çözüm:** (1) AI timeout 10s → **30s** (Meta + Google/TikTok), route'lara `maxDuration = 60`. (2) Yeni paylaşılan `describeAiFallback(err)` ([lib/anthropic/client.ts]) fallback sebebini kısa koda indirger (`timeout` / `api_4xx` / `parse_error` / `rate_limit`…); recommender'lar `fallbackReason` döndürür, route'lar response'a `aiFallbackReason` olarak ekler (UI'da ham gösterilmez — Network/log üzerinden teşhis). Meta/Google publish & API akışına dokunulmadı; yalnız advisory AI katmanı.
- **Dosyalar:** `lib/anthropic/client.ts`, `lib/google/optimization/recommender.ts`, `lib/meta/optimization/aiRecommender.ts`, `lib/meta/optimization/types.ts`, `app/api/{google,meta,tiktok}/optimization/magic-scan/route.ts`

## 2026-06-10 — Resmi doküman tarama prod TypeError fix + migration apply script
- **Sorun:** Aylık resmi doküman tarama cron'u canlıda `TypeError: e.from(...).insert(...).catch is not a function` ile patlıyordu. Supabase PostgrestBuilder PromiseLike ama `.catch()` metodu yok; testlerde mock `.catch` taşıdığı için yakalanmamıştı (tablolar omddq'da oluşunca ilk kez tetiklendi).
- **Çözüm:** `officialAdsDocsRefresh`'teki 4 best-effort `.insert/.update(...).catch(() => {})` → `try/await/catch`'e taşındı (non-fatal davranış korunur). Ayrıca `official_ads_*` 4 tablo için tek-komutluk migration apply script eklendi (`npm run db:migrate:official-ads`, omddq guard + doğrulama). Migration omddq'ya uygulandı (10 kaynak + 12 onaylı bilgi seed doğrulandı).
- **Dosyalar:** `lib/yoai/officialAdsDocsRefresh.ts`, `scripts/apply-official-ads-migration.mjs`, `package.json`

## 2026-06-10 — Uzman metin kalitesi YoAlgoritma'ya taşındı (alt-proje A, faz A2)
- **Sorun:** A1'in ikna edici metin/CTA kalitesi yalnız Strateji'deydi; YoAlgoritma'nın ad_spec önerileri aynı uzman kaliteden faydalanmıyordu.
- **Çözüm:** İkna edici metin ilkeleri TEK paylaşılan rehbere çıkarıldı (`lib/yoai/ai/docs/copyQualityGuide.ts`). Strateji (expertPlan) bu rehberi her zaman kullanır (DRY tek kaynak); YoAlgoritma (perCampaignPrompt) rehberi system bloğu olarak enjekte eder — flag `YOALGORITHM_EXPERT_COPY_ENABLED` default-off (kapalıyken prompt birebir aynı, sıfır regresyon). ad_spec şeması/validator, batch yapısı, AdCreationWizard, publish dokunulmadı; migration yok.
- **Dosyalar:** `lib/yoai/ai/docs/copyQualityGuide.ts`, `lib/yoai/ai/perCampaignPrompt.ts`, `lib/strategy/expertPlan.ts`, `.env.example`, `src/tests/copyQualityGuide.test.ts`

## 2026-06-10 — Uzman Kampanya Planı (alt-proje A, faz A1)
- **Sorun:** Strateji yapısal blueprint üretiyordu ama "uzman reklamcı" katmanı eksikti: lokasyon akıl yürütme, demografi çıkarımı, günlük bütçe önerisi, amaç→CTA eşleme, ikna edici çoklu-varyant metin ve her kararın gerekçesi yoktu. Ayrıca `extractLocations` büyük "İstanbul"u (toLowerCase İ tuzağı) yakalamıyordu.
- **Çözüm:** (1) `lib/strategy/expertPlan.ts` — markadan gerekçeli `ExpertCampaignPlan` (hedef kitle/lokasyon/demografi/amaç/bütçe/CTA/metin) üretir: AI (Claude) + deterministik korkuluklar (amaç deterministik, bütçe min'in altına inmez, CTA `allowed_values`'a göre doğrulanır, AI hazır değilse sahte veri yok). (2) `lib/yoai/turkishText.ts` Türkçe-bilinçli şehir eşleme → İstanbul bug fix. (3) `POST /api/strategy/instances/[id]/expert-plan` (flag `EXPERT_PLAN_ENABLED` default-off, platform başına paralel). (4) Strateji'ye "Uzman Plan" sekmesi (gerekçe kartları + metin varyantları). Advisory — publish/wizard/Apify dokunulmadı.
- **Dosyalar:** `lib/strategy/expertPlan.ts`, `lib/yoai/turkishText.ts`, `lib/yoai/businessSourceScanner.ts`, `app/api/strategy/instances/[id]/expert-plan/route.ts`, `components/strateji/ExpertPlanView.tsx`, `app/strateji/[id]/[[...tab]]/page.tsx`, `.env.example`, ilgili testler

## 2026-06-10 — Google Sihirli Tara: outcome persist + account_id atfı (hesap-scope Google)
- **Sorun:** Google Sihirli Tara sonuçları `yoai_recommendation_results`'a **hiç kaydedilmiyordu** (yalnız Meta kaydediyordu) → Google öğrenmesi ve hesap-scope atfı yoktu. Persist route da `platform:'meta'` sabitti.
- **Çözüm:** `GoogleScanResults` artık Meta'daki `MagicScanResults` ile aynı fire-and-forget persist'i yapar; `accountId` (Google müşteri kimliği, `/api/integrations/google-ads/selected`'den optimizasyon sayfasında yakalanır) + `platform:'google'` taşır. Persist route `platform`'ı parametreledi (meta|google|tiktok; bilinmeyen→meta). Gate platform-agnostik. Google apply/fetcher (`app/api/google/*`) ve canlı uygulama akışı **dokunulmadı** — yalnız outcome snapshot persist'i eklendi.
- **Dosyalar:** `components/optimization/GoogleScanResults.tsx`, `app/api/yoai/optimization/recommendations/route.ts`, `app/optimizasyon/[[...segments]]/page.tsx`, `_learnings/global/account-scope.md` (yoai-brain)

## 2026-06-10 — Optimizasyon: "Sihirli Tara" dropdown'u alt kartın altında kalıyordu (fix)
- **Sorun:** Optimizasyon listesinde "Sihirli Tara" açılır menüsü, bir alttaki kampanya kartının altında kalıyordu (görünmez/tıklanamaz).
- **Çözüm:** Kök neden — `.animate-card-enter` `forwards` ile her karta kalıcı `transform` bırakıp ayrı stacking context yaratıyor; iç `z-30` dropdown o context'te hapsoluyor, sonraki kardeş kart üstüne boyanıyor. Global mandated animasyona dokunmadan yerel fix: liste kapsayıcılarına `isolate` + kartlara azalan `z-index` (üst kart üstte). Hem Meta hem Google listesi. Mantık/veri akışı değişmedi, yalnız stacking.
- **Dosyalar:** `app/optimizasyon/[[...segments]]/page.tsx`, `_learnings/global/engineering-guardrails.md` (yoai-brain)

## 2026-06-10 — Öğrenen Beyin hesap-scope: öneri-sonucu kayıtlarına account_id atfı
- **Sorun:** Öğrenme aktif/seçili reklam hesabına göre gelişmeli; ama `yoai_recommendation_results`'ta `account_id` kolonu yok ve `metadata.account_id` boştu → beyin outcome'ları hesaba atfedemiyordu (ilk veride 4/4 unattributed). Cross-account/cross-business ders sızıntısı riski.
- **Çözüm:** (1) Beyin hesap-farkında: `collect-outcomes.mjs` artık `by_account` + `account_attribution` üretir; `_learnings/global/account-scope.md` zorunlu ilke + doktrin. (2) Atıf akışı (client+server, Meta entegrasyonuna dokunmadan): `/api/meta/status` zaten dönen `adAccountId` → optimizasyon sayfasında yakalanır → `MagicScanResults` persist POST'una `accountId` eklenir → `/api/yoai/optimization/recommendations` okur → `recordBeforeSnapshot` `metadata.account_id`'ye yazar. Meta fetcher/publish/magic-scan route **değişmedi**; yalnız sunum+persist. 2026-06-10 öncesi kayıtlar unattributed kalır (backfill yok, prod-risk).
- **Dosyalar:** `lib/yoai/resultTrackingStore.ts`, `app/api/yoai/optimization/recommendations/route.ts`, `components/optimization/MagicScanResults.tsx`, `app/optimizasyon/[[...segments]]/page.tsx`, `scripts/brain/collect-outcomes.mjs`, `_learnings/{global/account-scope.md,outcome-measurement.md,doctrine/cloud-analysis.md,INDEX.md}` (yoai-brain)

## 2026-06-10 — "YoAi Sağlık Merkezi" otomatik izleme + günlük e-posta
- **Sorun:** Projedeki tüm otomasyon parçalarının (prod, cron'lar, yerel Beyin job'ı, yedekler, token'lar) çalışıp çalışmadığı tek bakışta görülemiyordu; manuel kontrol gerekiyordu.
- **Çözüm:** 10 parçayı kontrol eden `saglik_kontrol.py` kuruldu → her gün 09:00 (launchd `com.yoai.saglik`) tek özet e-postası (`onursuay@hotmail.com`). Kontroller: prod `/api/health`, ana sayfa, Supabase (omddq), Vercel deploy+9 cron, yerel Beyin job (`com.yoai.brain.collect`), Beyin verisi tazeliği, GitHub yedek (ana repo + `yoai-brain`), kritik `.env.local` anahtarları, self-report. Konu sabit "YoAi Sağlık Merkezi"; durum gövdede ✓ / nabız atışı ECG çizgisi (inline SVG, sarı/amber yok) / 🔴 ile gösterilir. SMTP kimliği yerelde (`~/.yoai-saglik-automation/smtp_config.json`, gitignore). Bulut sessizlik koruması: sır-olmayan durum özeti `yoai-brain`'e push edilir; haftalık bulut routine (Pazartesi 10:00) tazeliğe bakıp bilgisayar günlerce kapalıysa uyarı maili gönderir.
- **Dosyalar:** `_automation/{saglik_kontrol.py,com.yoai.saglik.plist,README.md,smtp_config.example.json}`, `docs/CHANGELOG.md`, `.gitignore`, `~/.yoai-saglik-automation/**` (runtime, gitsiz), `~/Library/LaunchAgents/com.yoai.saglik.plist`

## 2026-06-09 — Kendi kendine öğrenen + otomatik yedeklenen "Öğrenen Beyin" (4 katman)
- **Sorun:** YoAi'nin dağınık dersleri (CLAUDE.md + memory) yapılandırılmamıştı; AI önerilerinin gerçek ürün-sonucu (ROAS/CTR etkisi) ölçülüp derse dönüşmüyordu; geliştirme bilgisi otomatik yedeklenmiyordu.
- **Çözüm:** 4 katmanlı sistem kuruldu. (1) `_learnings/` öğrenen beyin (README/INDEX/_TEMPLATE/global/units/doctrine, tohumlanmış gerçek derslerle). (2) CLAUDE.md'ye bağlayıcı döngü kuralı: ÖNCE OKU / SONRA YAZ (sormadan) / SONUCU YAZ (✅/❌/⚠️ + KÖK NEDEN, uydurma rakam yasak). (3) Ayrı **private** `yoai-brain` repo'su yedeği — push öncesi genişletilmiş secret-scan, git check-ignore ile hariç tutma (NFC/NFD-safe). (4) Güvenli hibrit periyodik öğrenme: yerel `collect-outcomes.mjs` (Supabase omddq SALT-OKUNUR → anonim agrega `_data/latest.json` → launchd günlük 08:00 → push; token yerelde) + haftalık bulut routine (Pazar 23:00 İstanbul, yalnız repo JSON'ını okuyup kök-neden analizi yazar, hassas kaynağa bağlanmaz). Öğrenme kapsamı = ürün sonucu (`yoai_recommendation_results` + `yoai_action_outcomes`); AI engine/publish'e **dokunulmadı** (closed-loop default-OFF).
- **Dosyalar:** `_learnings/**` (ayrı yoai-brain repo'su), `scripts/brain/{collect-outcomes.mjs,secret-scan.sh,run-collect.sh,install-launchd.sh}`, `CLAUDE.md` (Öğrenen Beyin bölümü), `.gitignore` (`_learnings/`)

## 2026-06-09 — Kendini güncelleyen resmi reklam bilgi tabanı (alt-proje B)
- **Sorun:** Aylık doküman taraması (officialAdsDocsRefresh) değişiklikleri yalnız snapshot'a yazıyordu; AI'nin kullandığı bilgiye dönüşmüyordu (kopuk köprü). Ayrıca düz fetch JS-render resmi dokümanlarda zayıftı; onay/bildirim yoktu.
- **Çözüm:** (1) AI parser köprüsü (`officialAdsKnowledgeParser`) değişen snapshot'ı review_required taslaklara çevirir (versiyonlu + idempotent, flag `OFFICIAL_ADS_AI_PARSER`, default-off). (2) Resmi doküman çekme Firecrawl (html/markdown) + düz fetch fallback. (3) Best-effort owner e-posta (`officialAdsChangeNotifier`). (4) Gözetim Merkezi'nde onay paneli + super-admin endpoint'leri (`approve` önceki versiyonu emekliye ayırır → canlı). (5) Onaylı bilgi analiz prompt'larına da enjekte (`officialKnowledgeBlock`, empty-safe) — reklam üretimi+politika+analiz birleşti. Meta/Google publish, Apify, sosyal dokunulmadı.
- **Dosyalar:** `lib/yoai/officialAdsKnowledgeParser.ts`, `officialAdsChangeNotifier.ts`, `officialAdsKnowledgeDecision.ts`, `officialAdsDocsRefresh.ts`, `lib/yoai/ai/docs/officialKnowledgeBlock.ts`, `lib/yoai/ai/{systemPrompt,perCampaignPrompt,agent,perCampaignAgent}.ts`, `inngest/functions/{yoalgoritmaScan,perCampaignImprovements}.ts`, `app/api/cron/official-ads-refresh/route.ts`, `app/api/admin/gozetim-merkezi/official-ads/{pending,decision}/route.ts`, `app/gozetim-merkezi/OfficialAdsKnowledgePanel.tsx`, `.env.example`, ilgili testler

## 2026-06-09 — Firecrawl web tarama entegrasyonu (alt-proje C)
- **Sorun:** Marka/rakip web siteleri yalnız basit HTTP fetch + regex ile taranıyordu; JS-render içerik ve çok sayfalı bilgi (hizmetler/lokasyon/USP) kaçıyordu.
- **Çözüm:** Yeni `lib/firecrawl/` katmanı (map → kilit sayfa seç → scrape → birleşik markdown). `businessSourceScanner` web kaynaklarında Firecrawl hazırsa derin tarar, değilse HTTP fetch'e düşer (default-off `FIRECRAWL_ENABLED` flag, sıfır regresyon). Ortak `analyzeContent` yardımcısı her iki içerik kaynağında aynı sinyal çıkarımını çalıştırır. Sosyal profiller + Meta/Google rakip reklamları (Apify) **değişmedi**.
- **Dosyalar:** `lib/firecrawl/{types,client,pageSelector,scrapeSite}.ts`, `lib/yoai/businessSourceScanner.ts`, `src/tests/firecrawl{Client,PageSelector,ScrapeSite}.test.ts`, `src/tests/businessSourceScannerFirecrawl.test.ts`, `.env.example`

## 2026-06-09 — Reklam metni dil & imla kuralı (Meta + Google) CLAUDE.md'ye eklendi
- **Sorun:** Sıfırdan üretilen reklam başlık/açıklamaları için kalıcı bir dil standardı yoktu; ayrıca Google Ads'in noktalama politikası (yalnız nokta) proje kurallarında belgelenmemişti.
- **Çözüm:** CLAUDE.md'ye "Reklam Metni Dil & İmla Kuralı" bölümü eklendi: (1) Meta + Google tüm sıfırdan reklamlar Türkçe imla/dilbilgisine uygun yazılır (Türkçe karakter zorunlu, ASCII eşdeğeri yasak); (2) Google Ads'te yalnız nokta serbest, ünlem/tire/soru işareti politika gereği yasak; (3) kural üretim katmanına (AI prompt/şablon) uygulanır, Meta/Google API ve publish akışı korunur.
- **Dosyalar:** `CLAUDE.md`, `docs/CHANGELOG.md`

## 2026-06-08 — Meta Ads analiz bilgisi 4 AI motoruna entegre edildi
- **Sorun:** YoAlgoritma / Optimizasyon / Strateji / sohbet, Meta'nın sistem mekaniğini (Breakdown Effect, learning phase, marjinal vs. ortalama CPA, auction overlap, pacing, ad relevance) bilmeden öneri/kopya üretiyordu — "yüksek ortalama CPA'lı segmenti durdur" gibi klasik hatalara açıktı.
- **Çözüm:** `meta-ads-analyzer` reposunun (MIT) 9 referans dokümanı tek Türkçe küratörlü dosyaya damıtıldı (`meta_analysis_knowledge.ts`). 3 analiz motoruna **tam doküman** Meta-only cached system block olarak, sohbetin **kreatif kategorilerine** (reklam metni / sosyal medya / landing) kreatif alt-küme (`META_CREATIVE_PRINCIPLES`) enjekte edildi. Google yolları ve SEO/e-posta/slogan kategorileri etkilenmez. Meta/Google API, veri çekme, change-set ve **publish** akışlarına dokunulmadı — yalnız prompt katmanı zenginleşti (cached → token maliyeti artmaz). Reponun MCP server + token script'leri (dev aracı) kapsam dışı bırakıldı. 9/9 birim testi geçer; `tsc --noEmit` temiz.
- **Dosyalar:** `lib/yoai/ai/docs/meta_analysis_knowledge.ts` (yeni), `lib/yoai/ai/perCampaignPrompt.ts`, `lib/yoai/ai/perAdPrompt.ts`, `lib/yoai/ai/systemPrompt.ts`, `lib/meta/optimization/aiRecommender.ts`, `lib/strategy/ai-generator.ts`, `lib/yoai/prompts.ts`, `src/tests/metaAnalysisKnowledge.test.ts`

## 2026-06-07 — SEO makale yılı GÜNCEL YIL'a sabitlendi (eski yıl "2025" başlık fix)
- **Sorun:** 2026 yılındayken otomatik üretilen makale başlığı eski yılı içeriyordu ("Koltuk Yıkama Fiyatları Ankara **2025** Rehberi"). Kök neden: anahtar kelime seçimi (`aiSelectKeyword`) ve makale üretim prompt'ları (otomatik + manuel) Claude'a **güncel tarih/yıl bilgisini hiç geçirmiyordu**; model kendi bilgi kesim yılına (2025) düşüp başlık/içerikte eski yılı yazıyordu. "2025"in asıl kaynağı, başlığa giren anahtar kelimenin kendisiydi.
- **Çözüm:** Üç prompt noktasına da `new Date().getFullYear()` ile dinamik güncel yıl + "yıl geçecekse MUTLAKA güncel yılı kullan; geçmiş yılları ASLA yazma" direktifi eklendi. Hardcoded yıl yok — her yıl otomatik doğru. Hem otomatik hem manuel üretim kapsanır.
- **Dosyalar:** `lib/seo/topicSelector.ts`, `lib/yoai/prompts.ts`

## 2026-06-05 — SEO makale üretimi YANLIŞ FİRMA bağlamı düzeltildi (site brief'ine sıkı kapsam)
- **Sorun:** Kullanıcı `ustasiniyolla.com`'u bağladığı hâlde sistem, eskiden eklenmiş **başka bir firmanın** (Belgemod) bilgileriyle makale üretti ("Makine Operatörü MYK Belgesi…"). Kök neden: `selectDailyTopic`, bağlı sitenin brief'i `'completed'` değilse kullanıcının **global iş profiline** (başka firma olabilir) düşüyordu. ustasiniyolla brief'i fire-and-forget Vercel'de kesilip `'running'`'de takıldığı için bu fallback tetiklendi → yanlış firma konulu makale. Ayrıca `'completed'` şartı, scrape'ten gelen geçerli `'partial'` brief'i de eliyordu.
- **Çözüm:** `selectDailyTopic` artık: bir site bağlıysa (`siteConnectionId`) bağlam **YALNIZ o sitenin brief'inden** gelir — global iş profiline **asla** düşmez. Brief hazır değilse (yok / takılı `running` / `failed`) istek içinde `runSiteBriefPipeline` ile **şimdi üretilir**, sonra okunur; o da olmazsa site URL'inden minimal bağlam kullanılır (yine global profil değil). `'partial'` brief de geçerli sayılır. Global profil yalnız **hiç site bağlı olmayan** (legacy) yolda kullanılır. Bu, [topicSelector.ts](lib/seo/topicSelector.ts) tek noktasında olduğu için hem otomatik hem manuel üretimi kapsar. İlgili: brief'in güvenilir tamamlanması (önceki commit).
- **Dosyalar:** `lib/seo/topicSelector.ts`

## 2026-06-05 — SEO "Hedef kategoriler": sonsuz "taranıyor" düzeltildi + tasarım iyileştirme
- **Sorun:** Üretim Ayarları'ndaki "Hedef kategoriler" alanı sürekli "Kategoriler taranıyor…" gösteriyor, hiç bitmiyordu. Kök neden: site bağlanınca brief taraması (HTTP scrape + tek Claude çağrısı) `upsertConnection` içinde fire-and-forget tetikleniyor; Vercel yanıt dönünce arka plan işini kesince brief `running`'de takılıyor; UI ise yalnız bir kez okuyup hiç yeniden denemiyordu → sonsuz "taranıyor". Ayrıca tasarım sorunları: (1) yanıltıcı "Boş bırakırsanız tüm kategoriler arasında dönülür" açıklaması (kullanıcı zaten manuel kategori giremez), (2) "Kategoriler taranıyor…" metni başlık etiketinden büyüktü (text-sm > text-xs), (3) statik "…".
- **Çözüm:** (1) Güvenilirlik: `POST /api/seo/brief` eklendi — brief hazır değilse (yok/takılı `running`/`failed`) taramayı **istek içinde sonuna kadar** çalıştırıp kategorileri kesin döndürür; hazırsa (completed/partial + kategori) **yeniden üretmez** (token israfı yok). Panel artık önce GET, hazır değilse awaited POST tetikliyor. Sahiplik kontrolü + maxDuration 60. (2) Açıklama kaldırıldı. (3) Tarama metni `text-sm` → `text-xs` (başlıktan büyük değil). (4) Statik "…" yerine soldan sağa dalgalanan **üç yeşil nokta** animasyonu (`.seo-scan-dots`, `prefers-reduced-motion` korumalı). **Token notu:** tarama = 1 küçük Claude çağrısı (≤1500 token), site başına ilk başarılı taramada bir kez, sonra 30 gün cache; aylık cron tazeler — düzenli ama ucuz. TR+EN güncellendi.
- **Dosyalar:** `app/api/seo/brief/route.ts`, `components/seo/SeoAutomationPanel.tsx`, `app/globals.css`, `locales/tr.json`, `locales/en.json`

## 2026-06-05 — SEO "Yayın Hedefi": bağlı yöntem kartında ✓ göstergesi + taşan açıklamalar düzeltildi
- **Sorun:** (1) WordPress/Webhook bağlantısı başarıyla kurulduğunda yöntem kartında hiçbir "bağlı" göstergesi yoktu (durum kartı daha önce kaldırılmıştı) — kullanıcı bağlandığını göremiyordu. (2) "Başka bir site / özel yazılım" kartının açıklaması iki satıra taşıyordu (asimetri).
- **Çözüm:** (1) Aktif bağlantı olan yöntem kartı artık emerald daire-içi ✓ (CheckCircle2) + emerald tint + emerald ikon tile alıyor (`wpConnected`/`webhookConnected` aktif bağlantıdan türetiliyor). (2) Kart açıklamaları kısaltıldı ve `truncate` ile tek satıra sabitlendi (TR+EN); artık başlık altına taşmıyor. Renkler onaylı palet (emerald/gray/primary), amber yok.
- **Dosyalar:** `components/seo/SeoSitesPanel.tsx`, `locales/tr.json`, `locales/en.json`

## 2026-06-05 — WordPress yayını: Authorization başlığını düşüren hostlar için otomatik XML-RPC fallback
- **Sorun:** Bir önceki düzeltme `auth_blocked` durumunu (sunucu HTTP `Authorization` başlığını PHP'ye iletmeden düşürüyor) doğru **teşhis** ediyordu ama kullanıcı yine bağlanamıyordu — REST + Application Password bu hostlarda yapısal olarak çalışamaz (WordPress kimliği yalnız `Authorization` başlığından okur). Canlı `ustasiniyolla.com` üzerinde curl ile kanıtlandı: Basic Auth gönderilse bile WordPress `rest_not_logged_in` dönüyor (kimlik hiç görülmüyor). Aynı sitede XML-RPC (`xmlrpc.php`) **açık** ve kimliği istek **gövdesinde** taşıdığı için başlık düşürmesinden etkilenmiyor (sahte kimlikle `403 Geçersiz kullanıcı adı ya da parola` → kimlik gövdeden görülüyor).
- **Çözüm:** (A) Yeni bağımlılıksız `WordPressXmlRpcConnector` (fetch tabanlı minimal XML-RPC istemci + parser): `wp.getUsersBlogs` (doğrulama+blogId), `wp.uploadFile` (öne çıkan görsel, base64), `wp.newPost` (yayın), `wp.getPost` (permalink). **Aynı uygulama parolası** kullanılır (WP core XMLRPC_REQUEST için de Application Passwords kabul eder). Manuel bağlama route'u REST `auth_blocked` dönünce otomatik XML-RPC dener; başarılıysa kullanıcı **hata görmeden** bağlanır. Seçilen taşıma yolu, migration olmadan şifreli credentials JSON'ına `wpTransport: 'rest'|'xmlrpc'` olarak yazılır; connector factory ve yayın akışı buna göre doğru connector'ı seçer. (B) XML-RPC kapalı hostlar için `auth_blocked` hata kutusuna birebir kopyalanır `.htaccess` snippet'i (`CGIPassAuth On` + mod_rewrite alternatifi) + "Kopyala" + "Tekrar Dene" butonu (TR+EN). Parser, gerçek site yanıtlarıyla 8/8 birim testten geçti. Meta/Google entegrasyonuna dokunulmadı; DB migration yok.
- **Dosyalar:** `lib/seo/connectors/wordpressXmlRpc.ts` (yeni), `lib/seo/connectors/types.ts`, `lib/seo/connectors/index.ts`, `lib/seo/siteConnectionStore.ts`, `app/api/seo/sites/wordpress/route.ts`, `components/seo/SeoWordPressConnect.tsx`, `locales/tr.json`, `locales/en.json`

## 2026-06-05 — Abonelik fiyatlandırması: rakip analizi + USD konumlandırma + kademe modül dağılımı
- **Sorun:** Paket fiyatları (49/99/199) rakip iyzads'ın USD rakamlarıyla birebir aynıydı ama `₺` cinsindendi → ürün, doğrudan ikizinin ~46 katı altında, kasıtsız fiyatlanıyordu. Ayrıca kademe özellik listeleri eskiydi: SEO Plus / CRM / Email Marketing / YoAlgoritma / Dönüşüm Sihirbazı modülleri hiç görünmüyordu; rakiplere göre çok daha geniş olan ürün, planlara yansımıyordu. 4 rakip (iyzads, WASK, Enhencer, Grower) fiyat+özellik analizi yapıldı.
- **Çözüm:** (1) Fiyatlar **USD gösterim**e geçti, iyzads'ın her kademesinin **~%20 altı**: Basic $39 / Starter $79 / Premium $159 (yıllık %30 indirim korunur). (2) **USD göster / TL çek** mimarisi: `USD_TRY_RATE` (47, manuel + tampon) + `toChargeTRY()` ile İyzico'ya `USD × kur` TL gönderilir; checkout/callback yolu ve `currency:'TRY'` doğrulaması değişmedi (deterministik). (3) Onaylı **kademe modül dağılımı**: Basic temel reklam+rapor+tasarım; Starter +Optimizasyon +AI Hedef Kitle +SEO Plus; Premium tam suite (+AI Strateji +YoAlgoritma +CRM +Email +Dönüşüm Sihirbazı). (4) **Bundled kredi** rakip-hizalı artırıldı: 20/60/100 → **50/150/500**. (5) Kredi paketleri USD'ye çevrildi ($9/$39/$69). (6) Boy-scout: `CreditLoadSection` `bg-amber-*` → primary (amber yasağı), `₺` → `$`, kademe özellik etiketleri + kredi UI string'leri tamamen i18n'e taşındı (TR+EN). Meta/Google entegrasyonuna dokunulmadı; mevcut aboneler geriye dönük faturalanmaz (fiyat checkout anında türetilir).
- **Dosyalar:** `lib/subscription/plans.ts`, `lib/billing/catalog.ts`, `components/subscription/PlanCard.tsx`, `components/subscription/CreditLoadSection.tsx`, `locales/tr.json`, `locales/en.json`

## 2026-06-05 — WordPress App Password "giriş bilgileri kabul edilmiyor" yanlış teşhisi düzeltildi
- **Sorun:** SEO > İçerikler > "Uygulama Parolası ile bağlan" kartında doğru WordPress kullanıcı adı + uygulama parolası girilse bile bağlantı reddediliyor ve "Kullanıcı adı veya uygulama parolası hatalı" gösteriliyordu. Kök neden (canlı `ustasiniyolla.com` üzerinde curl ile doğrulandı): REST API açık, Uygulama Parolaları etkin, yönlendirme/WAF yok — ancak sunucu (PHP 7.4, CGI/paylaşımlı hosting) HTTP `Authorization` başlığını PHP'ye **iletmeden düşürüyor**. WordPress kimlik bilgisini hiç görmüyor, 401 `rest_not_logged_in` dönüyor. Connector her 401'i kör şekilde "auth hatası" sayıp şifre hatası gibi gösteriyordu.
- **Çözüm:** `WordPressConnector.testConnection` artık 401/403 gövdesindeki WP hata kodunu okuyor: `rest_not_logged_in`/`rest_cannot_authenticate` → yeni `auth_blocked` kodu (başlık düşürülmüş; kimlik bilgisi doğru olabilir), `incorrect_password`/`invalid_username` → gerçek `auth` hatası. Yeni `auth_blocked`, modal ve banner'da "bu bir parola hatası değildir; sunucu Authorization başlığını engelliyor — hosting ayarından iletin ya da Webhook ile bağlanın" şeklinde doğru, eyleme dönük mesaj gösteriyor (TR+EN). Meta/Google entegrasyonuna dokunulmadı.
- **Dosyalar:** `lib/seo/connectors/types.ts`, `lib/seo/connectors/wordpress.ts`, `app/api/seo/sites/wordpress/route.ts`, `app/api/seo/sites/callback/route.ts`, `components/seo/SeoWordPressConnect.tsx`, `components/seo/SeoSitesPanel.tsx`, `locales/tr.json`, `locales/en.json`

## 2026-06-05 — SEO Plus > İçerikler "Yayın Hedefi": bağlı site durum kartı kaldırıldı
- **Sorun:** "Yayın Hedefi"ndeki aktif bağlı site (ustasiniyolla.com · WordPress · Aktif) durum kartı, hemen yanındaki "Uygulama Parolası ile bağlan" WordPress yöntem kartıyla görsel olarak çakışıp tekrar izlenimi veriyordu.
- **Çözüm:** Bağlı site durum kartı (ve onunla birlikte yalnız o kartta kullanılan test/sil handler'ları, state'leri, import'ları) kaldırıldı; geriye iki net bağlantı yöntemi kartı kaldı. Bağlıyken birincil blok boş kalınca `empty:hidden` ile fazladan boşluk oluşmuyor.
- **Dosyalar:** `components/seo/SeoSitesPanel.tsx`

## 2026-06-05 — SEO Plus > İçerikler "Yayın Hedefi" kart düzeni iyileştirme
- **Sorun:** "Yayın Hedefi" alanı 3 sütunlu tek bir grid'di; mevcut **aktif bağlı site kartı** ile iki **kesik çizgili (dashed) bağlantı-yöntemi kartı** aynı sırada yer alıyordu. Kartlar farklı yükseklikte (asimetrik), kavramsal olarak karışık ve dashed border görsel gürültü yaratıyordu.
- **Çözüm:** Sunum katmanı yeniden düzenlendi (handler/state/modal/API değişmedi): (1) Mevcut yayın hedefi / yetkilendirme durumu artık **tam genişlikte birincil blok**; (2) iki bağlantı yöntemi (Uygulama Parolası, Webhook) altta **eşit yükseklikli 2 sütunlu** kart olarak — dashed yerine premium solid border, ikon tile'ı ve aktif/hover durumları; (3) bölüm açıklaması `text-xs` → `text-sm leading-relaxed` (tipografi standardı); (4) boy-scout: Üretim Ayarları başlığı `text-sm` → `text-base`, palet dışı `text-purple-600` ikon → `text-primary`. Yeni metin/i18n eklenmedi.
- **Dosyalar:** `components/seo/SeoSitesPanel.tsx`, `components/seo/SeoAutomationPanel.tsx`

## 2026-06-04 — Sekme URL'leri: Türkçe slug + eksik modüller + temiz Strateji URL + canlı izleme script
- **Sorun:** (1) Türkçe arayüzde sekme URL'leri İngilizce kalıyordu (`/seo/analysis`, `/strateji/.../wizard`). (2) Email Marketing ve Optimizasyon sayfalarının sekmeleri/kaynak seçicisi URL'ye yansımıyordu (kök domainde kalıyordu). (3) Strateji detay URL'si verbose/kötüydü (`/strateji/yeni-strateji-04-06-2026--80778b82`). (4) Panelde dataLayer event'lerini tüketen canlı analitik script'i yoktu.
- **Çözüm:** (1) Sekme slug'ları locale-aware yapıldı — TR arayüzde Türkçe (`/seo/analiz`, `/seo/icerikler`, `/strateji/<id>/kesif`, `/google-ads/kampanya/<id>/genel-bakis`), EN arayüzde İngilizce (`/en/seo/analysis`). `slugToTabId` her iki dili de tanır (tolerant). (2) Email Marketing (Kişiler/Kampanyalar/Otomasyon) ve Optimizasyon (Meta/Google/TikTok kaynak) path tabanlı sekmeye taşındı (`[[...segments]]`); MultiAccountDropdown'da Optimizasyon platform geçişi de path tabanlı. (3) Strateji detay URL'si kısa kimliğe sadeleştirildi: `/strateji/<id8>/kesif` (eski okunabilir + tam-UUID linkleri yine çözülür). (4) Env-gated, default-off `AnalyticsScripts` ile GTM (+opsiyonel GA4) yüklenir — `afterInteractive`, `send_page_view:false` (çift sayım engeli), Consent Mode v2 ad_* denied; `NEXT_PUBLIC_GTM_CONTAINER_ID`/`NEXT_PUBLIC_GA4_MEASUREMENT_ID` boşken sıfır script.
- **Dosyalar:** `lib/tabRoutes.ts` (locale-aware slug + optimizasyon/email-marketing modülleri), `hooks/usePathTab.ts`, `components/analytics/AnalyticsScripts.tsx` (yeni), `app/layout.tsx`, `.env.example`, `lib/strategy/url.ts`, `components/strateji/StrategyRow.tsx`, `components/email/EmailDashboard.tsx`, `components/account/MultiAccountDropdown.tsx`, `components/seo/SeoArticlesTab.tsx`, `app/api/seo/sites/{connect,callback}/route.ts`; taşınan: `app/{email-marketing,optimizasyon}/[[...segments]]/page.tsx`

## 2026-06-04 — Sekme/alt-alan path URL'leri + dataLayer izleme katmanı
- **Sorun:** Sidebar modüllerinin içindeki sekmeler/alt-alanlar URL'ye yansımıyordu (örn. Hedef Kitle > Meta > Detaylı Kitle hep `/hedef-kitle`'de kalıyor, Google Ads sadece `/google-ads` gösteriyordu). Bu yüzden kullanıcının panel içinde **hangi sekmeyi kullandığı** event/analitik ile izlenemiyordu.
- **Çözüm:** Tüm sekmeli modüller gerçek alt-rota (path) tabanlı hale getirildi — her sekme kendine özel, paylaşılabilir bir URL'ye sahip (örn. `/hedef-kitle/meta/detayli-kitle`, `/meta-ads/reklamlar`, `/google-ads/kampanya/<id>/overview`). Merkezi `usePathTab` hook'u sekme durumunu URL path'inden türetir; sekme tıklaması `router.push` ile yeni path'e gider. Root layout'a mount edilen `RouteTracker`, her route/sekme değişiminde `window.dataLayer`'a (ve varsa `gtag`'e) `page_view` + `tab_view` event'i gönderir (GTM/GA4 eklendiğinde otomatik çalışır, script yokken zararsız). Korumalı Meta/Google alanlarında yalnız tab-state kaynağı değişti; API/publish akışlarına dokunulmadı. Geriye dönük URL yönlendirmesi kurulmadı (proje henüz canlı değil).
- **Dosyalar:** `lib/tabRoutes.ts` (yeni — slug↔id registry), `hooks/usePathTab.ts` (yeni), `lib/analytics/track.ts` (yeni), `components/analytics/RouteTracker.tsx` (yeni), `app/layout.tsx`, `components/SidebarNav.tsx`, `components/account/MultiAccountDropdown.tsx`; taşınan sayfalar: `app/{hedef-kitle,seo,raporlar,tasarim,meta-ads,google-ads}/[[...segments]]/page.tsx`, `app/strateji/[id]/[[...tab]]/page.tsx`, `app/google-ads/kampanya/[campaignId]/[[...tab]]/page.tsx`; `app/dashboard/reklam/{meta/MetaPage,google/GooglePage}.tsx`, `app/dashboard/reklam/google/components/GoogleTableReal.tsx`, `components/google/GoogleCampaignTable.tsx`, `components/seo/SeoArticlesTab.tsx`, `app/api/seo/sites/{connect,callback}/route.ts`, `locales/tr.json`, `locales/en.json`

## 2026-06-04 — SEO: otomatik yayın başarısız olunca "Yayınlanamadı" şeffaflığı + bağlan popup genişletildi
- **Sorun:** (1) "Makaleyi otomatik yayınla" seçili olduğu hâlde makale Taslak kalıyordu ve kullanıcıya **neden** olduğu söylenmiyordu — otomatik makale önce taslak kaydedilir, yalnız yayın başarılı olursa "yayınlandı"ya yükselir; yayın başarısız olunca (site bağlantısı/uygulama parolası geçersiz, site erişilemez vb.) sessizce taslak kalıyordu. (2) WordPress "Uygulama Parolası ile bağlan" popup'ı dar olduğundan açıklama cümleleri alt satıra kayıyordu.
- **Çözüm:** Otomatik yayın denenip başarısız olduğunda neden, makalenin `params.autoPublishError` alanına yazılıyor (migration yok). Makale listesinde taslak + bu alan doluysa "Yayınlanamadı" rozeti + ipucu (site bağlantısını/parolayı kontrol et) gösteriliyor — sessiz başarısızlık kalktı. Bağlan modalı `max-w-lg` → `max-w-2xl` genişletildi (cümleler tek satıra sığar). TR+EN anahtarlar eklendi.
- **Dosyalar:** `lib/seo/runScheduleArticle.ts`, `components/seo/SeoArticlesTab.tsx`, `components/seo/SeoSitesPanel.tsx`, `locales/tr.json`, `locales/en.json`

## 2026-06-04 — SEO Otomatik Üretim: girilen saat:dakikada TAM çalışır (cron dakikalık)
- **Sorun:** Kullanıcı yayın saatini 09:50 girse de makale 09:50'de üretilmiyordu. Cron `0 * * * *` (saatte bir, yalnız 0. dakika) çalıştığından, 09:50 hedefi ancak bir sonraki saat başında (10:00) telafi penceresiyle üretiliyordu. Ayrıca dakika seçici yalnız 5'er dakikalık slot sunuyordu → kullanıcıya "istediğin saati gir" denip aslında yaklaşık çalıştırmak yanıltıcıydı.
- **Çözüm:** SEO cron'u `* * * * *` (dakikalık) yapıldı → kullanıcının girdiği saat:dakika TAM yakalanıyor. Frontend dakika seçici 00–59 tam aralığa açıldı (5'er slot kısıtı kaldırıldı). Üretim idempotent kalır (`claimScheduleRun` atomik claim + `last_run_date` günde-bir guard) — dakikalık tetiklemede çift üretim olmaz. Kod yorumları (cron route + `isScheduleDue`) dakikalık modele göre güncellendi. Inngest kullanılmadı (prod'da güvenilir değil; inline-cron korunur).
- **Dosyalar:** `vercel.json`, `components/seo/SeoAutomationPanel.tsx`, `app/api/cron/seo-article-run/route.ts`, `lib/seo/timezone.ts`

## 2026-06-04 — SEO Plus: Üretim Ayarları UX rötuşları
- **Sorun:** (1) "Yeni İçerik" butonu Otomatik Üretim modunda da görünüyordu — mantıken anlamsız; (2) buton moru (purple) idi ve animasyonsuzdu; (3) "Makaleyi otomatik yayınla" checkbox tikinin rengi belirsizdi; (4) "Otomatik üretim / Manuel üretim" etiketlerinde "üretim" küçük harfle başlıyordu.
- **Çözüm:** "Yeni İçerik" butonu artık yalnız **Manuel Üretim** modunda görünüyor (mod bilgisi `SeoAutomationPanel` → `onModeChange` callback ile parent'a iletildi). Buton primary yeşile çevrildi + `active:scale` / `hover:shadow-md` + açılışta `Plus` ikonu 45° dönen toggle animasyonu. Otomatik yayınla checkbox'ı `appearance-none` + beyaz `Check` ikonu ile yeniden yazıldı (yeşil kutu, beyaz tik). Etiketler "Otomatik Üretim / Manuel Üretim" (TR) ve "Automatic Generation / Manual Production" (EN) olarak title-case yapıldı.
- **Dosyalar:** `components/seo/SeoArticlesTab.tsx`, `components/seo/SeoAutomationPanel.tsx`, `locales/tr.json`, `locales/en.json`

## 2026-06-04 — SEO: Yayın Hedefi kartları toggle+modal UX'e çevrildi
- **Sorun:** WordPress ve Webhook kartları satır içi açılıp/kapanıyordu; tıklanabilir olduğu hissettirmiyordu.
- **Çözüm:** Kartlar artık tıklandığında primary renk ile seçili hale geliyor ve içerik girişi için blur backdrop'lu centered modal açılıyor; inline açılım kaldırıldı. `alwaysOpen` prop ile form modal içinde wrapper'sız render ediliyor.
- **Dosyalar:** `SeoSitesPanel.tsx`, `SeoWordPressConnect.tsx`, `SeoWebhookConnect.tsx`, `locales/tr.json`, `locales/en.json`

## 2026-06-04 — SEO Plus: Yayın Hedefi 3'lü grid + renk + metin iyileştirmeleri
- **Sorun:** Yayın Hedefi kartları alt alta sıralıydı; checkbox/buton rengi mor (purple) idi; etiket metni uzun ve tire içeriyordu
- **Çözüm:** Yayın Hedefi içeriği `grid-cols-1 md:grid-cols-3` ile yan yana; her sütuna `animate-card-enter` staggered animasyon eklendi. Checkbox `accent-primary`, Save butonu `bg-primary` olarak güncellendi; purple renklerin tamamı primary/emerald'a taşındı. Etiket "Makaleyi otomatik yayınla (kapalıysa taslak olarak kalır.)" olarak kısaltıldı (TR + EN).
- **Dosyalar:** `components/seo/SeoSitesPanel.tsx`, `components/seo/SeoAutomationPanel.tsx`, `locales/tr.json`, `locales/en.json`

## 2026-06-03 — SEO brief hotfix: prod'da `select('*')` boş dönüp upsert sessizce bozuluyordu
- **Sorun:** Canlıya alındıktan sonra brief'ler bir türlü üretilmiyordu (`scan_status` hep `running`/`failed`, makaleler hâlâ yanlış işletme temalı). Teşhis: yeni `site_content_briefs` tablosunda prod PostgREST örneğinin şema cache'i `select('*')` genişletmesini **boş** döndürüyordu (açık kolon seçimi çalışıyordu). Bu yüzden `getBriefByConnection` satırı "yok" sanıyor, `upsertBrief` INSERT deneyip UNIQUE(site_connection_id) kısıtını ihlal edip **sessizce** başarısız oluyordu; pipeline dönüş değerini kontrol etmediği için yine "completed" raporluyordu.
- **Çözüm:** `siteContentBriefStore` içindeki tüm `select('*')` çağrıları açık kolon listesine (`BRIEF_COLS`) çevrildi; `upsertBrief` native `upsert(..., { onConflict: 'site_connection_id' })`'a geçirildi (oku-sonra-yaz bağımlılığı kaldırıldı). Doğrulama: ustasiniyolla.com brief'i "Ustasını Yolla" + gerçek hizmetler (Koltuk/Halı/Kombi/Klima…), Elysium Garden Hotel brief'i otel kategorileriyle `completed`.
- **Dosyalar:** `lib/seo/siteContentBriefStore.ts`, `app/api/cron/seo-brief-refresh/route.ts`

## 2026-06-03 — SEO: site-bazlı içerik brief'i (çoklu işletme) + esnek yayın takvimi + kategori hedefleme
- **Sorun:** SEO otomatik makale konusu kullanıcının tek işletme profilinden seçiliyordu. Birden fazla işletmesi olan kullanıcıda yanlış içerik üretiliyordu (ustasiniyolla.com hedef siteyken hesabın tek profili "Belgemod" olduğu için "Mesleki Yeterlilik Sınavı / MYK Belgesi" makaleleri yayınlandı). Ayrıca yayın takvimi yalnız Her gün/Hafta içi/Haftada bir ile sınırlıydı ve sitedeki birden çok hizmet/kategori arasında konu seçimi kontrol edilemiyordu.
- **Çözüm:** Her `site_connection` için Claude'un siteyi tarayıp sentezlediği siteye-özgü içerik brief'i (`site_content_briefs`) eklendi; `selectDailyTopic` artık hedef sitenin brief'inden beslenir, brief yoksa eski profil mantığına graceful düşer (sıfır regresyon). Anahtar kelime havuzu her zaman önceliklidir. Havuz boşken brief kategorileri arasında round-robin rotasyon yapılır; kullanıcı UI'dan hedef kategorileri seçebilir. Esnek yayın takvimi eklendi (Her gün / haftanın belirli günleri / ayın belirli günleri; eski `frequency` kayıtları legacy yolla korunur). Yeni site bağlanınca + otomasyon kaydında brief fire-and-forget üretilir; aylık cron bayatlamış/eksik brief'leri tazeler+backfill eder.
- **Dosyalar:** `supabase/migrations/20260603000000_site_content_briefs.sql`, `lib/seo/siteContentBriefStore.ts`, `lib/seo/siteBriefPipeline.ts`, `lib/seo/topicSelector.ts`, `lib/seo/timezone.ts`, `lib/seo/scheduleStore.ts`, `lib/seo/runScheduleArticle.ts`, `lib/seo/siteConnectionStore.ts`, `app/api/seo/schedules/route.ts`, `app/api/seo/schedules/[id]/route.ts`, `app/api/seo/brief/route.ts`, `app/api/cron/seo-article-run/route.ts`, `app/api/cron/seo-brief-refresh/route.ts`, `components/seo/SeoAutomationPanel.tsx`, `locales/tr.json`, `locales/en.json`, `vercel.json`

## 2026-06-02 — Fiyatlandırma: plan notları ile alt CTA arası boşluk küçültüldü
- **Sorun:** Plan kartları altındaki notlar ("* 14 gün ücretsiz deneme…") ile "Hemen başlamaya hazır mısınız?" başlığı arasındaki dikey boşluk aşırı fazlaydı (PLANS `pb-14 md:pb-20` + CTA `py-14 md:py-20` ≈ 112/160px).
- **Çözüm:** Bu mesafe, hero alt metni ("Reklam hesabı sayınıza göre…") ile aylık/yıllık toggle arası referans boşluğuna (hero `pb-8 md:pb-10` = 32/40px) eşitlendi: PLANS `pb-4 md:pb-5`, CTA `pt-4 md:pt-5` (alt padding `pb-14 md:pb-20` korundu) — toplam 32/40px.
- **Dosyalar:** `app/fiyatlandirma/page.tsx`

## 2026-06-02 — SEO otomatik makale üretimi: Inngest bağımlılığı kaldırıldı (inline üretim)
- **Sorun:** SEO Plus'ta zamanlama kaydedilmesine rağmen hiç makale üretilmiyordu (`yoai_articles` boş, `last_run_at: null`). Teşhis: saatlik cron `/api/cron/seo-article-run` çalışıyordu (`due:2, sent:2`) ama `mode:inngest` ile Inngest'e event gönderiyordu; Inngest Cloud prod'da function'ları sync etmediğinden event'ler hiçbir function'a ulaşmıyor, makale üretilmiyordu (150sn sonrası bile `last_error` null = function hiç başlamadı).
- **Çözüm:** Cron handler'daki `isInngestReady()` fan-out guard'ı kaldırıldı; SEO üretimi her zaman cron gövdesinde **inline** çalışır (üret + görsel + yayınla). SEO akışı hafif ve idempotent (`last_run_date` ile günde bir) olduğundan Inngest kurulumuna bağımlı değil; Vercel 60s bütçesine sığmayan due'lar bir sonraki saatlik cron'da aynı gün telafi edilir.
- **Dosyalar:** `app/api/cron/seo-article-run/route.ts`

## 2026-06-02 — Üç hata düzeltmesi: Email çok-adım validasyonu, CRM sayfa seçici flicker, SEO anahtar kelime kaybı
- **Sorun:** (1) Email Marketing otomasyonunda 2.+ adıma konu/içerik yazılıp ilk adım boş bırakılınca "Konu ve içerik zorunlu" hatası alınıyordu — validasyon yalnız `steps[0]`'a bakıyordu. (2) CRM'de birden çok sayfa bağlıyken yenilemede önce ilk sayfa (alfabetik/insertion sırası) görünüp sonra doğru aktif sayfaya geçen flicker vardı — `activePageId` `null` başlayıp doğru değer `useEffect`'te sonradan set ediliyordu. (3) SEO Plus üretim ayarlarında anahtar kelime input'a yazılıp Enter'a basılmadan "Kaydet"e basılınca kelime kaydedilmiyor, yenilemede kayboluyordu.
- **Çözüm:** (1) `handleSave` tüm adımları `findIndex` ile kontrol eder; eksik adım varsa o adıma odaklanıp uyarı verir. (2) `activePageId` lazy initializer ile `localStorage`'dan ilk render'da senkron okunur → bağlı sayfalar gelir gelmez doğru ad görünür, flicker yok. (3) `handleSave` input'taki commit edilmemiş kelimeyi de havuza dahil eder; ayrıca kayıt sonrası `keyword_pool` DB'nin döndürdüğü değerle senkronize edilir.
- **Dosyalar:** `components/email/AutomationsTab.tsx`, `components/crm/CrmDashboard.tsx`, `components/seo/SeoAutomationPanel.tsx`

## 2026-06-02 — Fiyatlandırma Sayfası: Tema Uyumu + Hero Düzeni
- **Sorun:** `/fiyatlandirma` plan kartları `bg-gray-800` (mavimsi slate) ile sayfanın saf siyah (`#060609`) zeminine uymuyordu; "İşletmeniz İçin Doğru Planı Seçin" başlığı ve alt metin desktop'ta alt satıra kayıyordu; gereksiz SSS bölümü vardı.
- **Çözüm:** PlanCard'a `glass` varyantı eklendi (white-alpha cam yüzey + emerald premium glow, sayfanın FAQ/toggle yüzeyleriyle uyumlu); `/abonelik` `solid` default ile korundu. Hero başlığa `lg:whitespace-nowrap` + responsive boyut, alt metin iki cümleye bölünüp (`heroSubtitle`/`heroSubtitle2`) her biri desktop'ta tek satır. SSS bölümü kaldırıldı.
- **Dosyalar:** `app/fiyatlandirma/page.tsx`, `components/subscription/PlanCard.tsx`, `components/landing/PricingPlans.tsx`, `locales/tr.json`, `locales/en.json`

## 2026-06-02 — Email Funnel: Koşullu Adım Dallanması
- **Sorun:** Drip otomasyonu tüm adımları koşulsuz gönderiyordu; açılma/tıklama davranışına göre dallanma yoktu.
- **Çözüm:** `email_automation_steps.condition` JSONB kolonu (always/if_opened/if_not_opened/if_clicked); `email_drip_queue.parent_queue_id` + `email_send_id` ile önceki adımın event'leri sorgulanıyor; cron processor koşulu değerlendirip ya gönderir ya `skipped` işaretler, sonraki adımı lazy kuyruğa ekler; UI'da her adım sekmesine WizardSelect koşul dropdown + koşul badge (✓ / ✗ / ↗) eklendi.
- **Dosyalar:** `supabase/migrations/20260602002000_*`, `lib/email/automationStepsStore.ts`, `lib/email/dripQueue.ts`, `lib/email/automationRunner.ts`, `app/api/cron/email-drip-process/route.ts`, `components/email/AutomationsTab.tsx`, `locales/tr.json`, `locales/en.json`

## 2026-06-02 — Email Funnel: Koşul dropdown + sekme badge (UI)
- **Sorun:** Otomasyon adımı formunda koşul (her zaman / önceki açıldıysa / açılmadıysa / tıklandıysa) seçimi yoktu; sekme butonlarından seçili koşul anlaşılamıyordu.
- **Çözüm:** (1) `StepDraft` interface'ine `condition: { type }` eklendi. (2) `openNew`, `openEdit`, "+ Adım Ekle" default değerlerine `condition: { type: 'always' }` eklendi. (3) `handleSave` payload'ına condition dahil edildi. (4) Sekme butonlarına koşul badge'i (✓ açıldıysa / ✗ açılmadıysa / ↗ tıklandıysa) eklendi. (5) Aktif adım formunda (adım > 0) delay'den önce WizardSelect koşul dropdown'u eklendi. (6) `tr.json` + `en.json`: `automations.steps.condition` anahtarları eklendi. TypeScript: 0 hata.
- **Dosyalar:** `components/email/AutomationsTab.tsx`, `locales/tr.json`, `locales/en.json`

## 2026-06-02 — Email Funnel: Cron koşul değerlendirme + lazy next step enqueue
- **Sorun:** Cron processor koşul değerlendirmesi (evaluateCondition), skipped durumu ve lazy next-step enqueue yapmıyordu; email_send_id geri yazılmıyordu.
- **Çözüm:** `email-drip-process/route.ts` yeniden yazıldı: (1) her item için önce `getStep` ile adım içeriği alınır, (2) `evaluateCondition` koşulu değerlendirir, koşul sağlanmazsa `markItemSkipped`, (3) gönderim sonrası `email_sends` satırından `id` okunarak `setEmailSendId` ile queue item'a yazılır, (4) `getNextStep` + `enqueueNextStep` ile bir sonraki adım lazy kuyruğa eklenir. Response'a `skipped` sayacı eklendi.
- **Dosyalar:** `app/api/cron/email-drip-process/route.ts`

## 2026-06-02 — Email Funnel: StepRow condition, lazy enqueue, evaluateCondition
- **Sorun:** Drip queue tüm adımları baştan kuyruğa ekleyerek koşul değerlendirmesi (if_opened/if_not_opened/if_clicked) yapılamıyordu; skipped durumu yoktu; getStep/getNextStep fonksiyonları eksikti.
- **Çözüm:** (1) `automationStepsStore.ts`: `StepRow`'a `condition: StepCondition` alanı eklendi, `getStep` ve `getNextStep` fonksiyonları eklendi, `StepInput`'a `condition` eklendi. (2) `dripQueue.ts`: `enqueueSteps` kaldırılıp yerine lazy `enqueueFirstStep` + `enqueueNextStep` geldi; `evaluateCondition` fonksiyonu parent email_events'ini kontrol eder; `setEmailSendId`, `markItemSkipped` eklendi; `QueueItem`'a `parent_queue_id` ve `email_send_id` alanları eklendi. (3) `automationRunner.ts`: `enqueueSteps` → `enqueueFirstStep` (yalnız `steps[0]`) olarak güncellendi.
- **Dosyalar:** `lib/email/automationStepsStore.ts`, `lib/email/dripQueue.ts`, `lib/email/automationRunner.ts`

## 2026-06-02 — YoAlgoritma: URL, header, AI reklam, otomatik tarama, dropdown iyileştirmeleri
- **Sorun:** (1) `/yoai` URL'si "YoAlgoritma" başlığıyla uyumsuz; bazı EN slug'lar (abonelik/hesabim/faturalarim) çevrilmemiş. (2) Öneri ticker'ı hesap seçiciye sıkışıp kesiliyor; "AI Analiz" rozeti + düz "Son güncelleme" yazısı. (3) AI Reklam Oluştur, haftalık tarama hiç çalışmadığında "AI reklam önerisi üretilemedi" hatası veriyor; platform kartlarında M/G harfleri. (4) Geliştirme kartları yalnız Pazar cron'dan üretiliyor → yeni kullanıcı/owner "Pazar gece" boş uyarısı görüyor. (5) İşletme dropdown'unda "Meta + Google" / "Yalnızca …" yazıları.
- **Çözüm:** (1) `app/yoai`→`app/yoalgoritma` rename; middleware + `lib/routes.ts` slug haritaları (yoalgoritma↔yoalgorithm, abonelik↔subscription, hesabim↔account, faturalarim↔invoices) + crm/email-marketing prefix tutarlılığı; iç linkler güncellendi (redirect gerekmedi — sistem henüz açılmadı). (2) Ticker 3 bölgeli layout ile ortalandı; "AI Analiz" kaldırıldı, son güncelleme renkli pill'e alındı. (3) Platform seçilince boş yanıt gelirse otomatik `forceGenerate=true` ile canlı üretim (publish akışı değişmedi); M/G → kurumsal `/platform-icons` logoları; modal metinleri i18n. (4) Yeni `POST /api/yoai/improvements/bootstrap` kart yoksa gerçek hiyerarşik taramayı tetikler (sahte veri yok, cooldown'lı); "İlk analiziniz hazırlanıyor…" durumu + Batch bitene kadar yoklama; "Pazar gece" metni kaldırıldı. (5) Platform yazıları yerine hesap adı yanında küçük (14px) Meta/Google logoları. TypeScript + `next build`: 0 hata.
- **Dosyalar:** `app/yoalgoritma/*` (rename), `middleware.ts`, `lib/routes.ts`, `lib/nav.ts`, `app/robots.ts`, `app/dashboard/HomePage.tsx`, `components/UserProfileDropdown.tsx`, `components/account/MultiAccountDropdown.tsx`, `components/account/BusinessSwitcherDropdown.tsx`, `components/seo/SeoSitesPanel.tsx`, `components/yoai/YoAlgoritmaHeader.tsx`, `components/yoai/CommandCenterHeader.tsx`, `components/yoai/AdCreationWizard.tsx`, `components/yoai/hierarchy/HierarchicalImprovements.tsx`, `app/api/yoai/improvements/bootstrap/route.ts`, `locales/tr.json`, `locales/en.json`

## 2026-06-02 — Email: Bounce Auto-Block + Drip Sequence
- **Sorun:** Hard bounce / spam şikayeti gelince kişi opt-out edilmiyordu; otomasyonlar tek mail ile sınırlıydı.
- **Çözüm:** (A) Resend webhook (`/api/email/webhooks/resend`) → hard bounce / complaint → `email_contacts.opt_out` + `crm_leads.email_opt_out` otomatik; timing-safe secret doğrulaması. (B) `email_automation_steps` + `email_drip_queue` tabloları; `automationRunner` adımlı otomasyonları kuyruğa yazar; saatlik cron (`/api/cron/email-drip-process`) vakti gelenleri gönderir. (C) `AutomationsTab` sekme tabanlı çok adımlı editör (max 5 adım, gecikme gün cinsinden, geri uyumluluk korundu).
- **Dosyalar:** `app/api/email/webhooks/resend/route.ts`, `app/api/cron/email-drip-process/route.ts`, `lib/email/automationStepsStore.ts`, `lib/email/dripQueue.ts`, `lib/email/automationRunner.ts`, `app/api/email/automations/[id]/route.ts`, `app/api/email/automations/route.ts`, `components/email/AutomationsTab.tsx`, `supabase/migrations/20260602000000_*`, `supabase/migrations/20260602001000_*`, `vercel.json`, `locales/tr.json`, `locales/en.json`

## 2026-06-02 — feat(email/drip): Multi-Step Otomasyon Composer UI (tab'lı adım editörü)
- **Sorun:** AutomationsTab composer'ı tek konu+içerik alanından oluşuyordu; çok adımlı drip dizisi oluşturulamıyordu.
- **Çözüm:** `StepDraft` interface ve `steps`/`activeStep` state eklendi. Composer'daki konu+içerik alanları yerine sekme tabanlı adım editörü geldi (max 5 adım, adım sil, gecikme günü). `handleSave` adımları API payload'una gönderir (legacy `subject`/`html` ilk adımdan beslenir). Preview iframe aktif adımı gösterir. `openNew` ve `openEdit` steps state'i sıfırlar/yükler. i18n: `automations.steps.*` anahtarları tr.json ve en.json'a eklendi. TypeScript kontrolü: 0 hata.
- **Dosyalar:** `components/email/AutomationsTab.tsx`, `locales/tr.json`, `locales/en.json`

## 2026-06-02 — feat(email/drip): Automation API Steps Desteği (GET list + POST/PATCH)
- **Sorun:** Automation API endpoint'leri (GET list, POST yeni otomasyon, PATCH güncelleme) adım (steps) verisi döndürmüyor ve kaydetmiyordu.
- **Çözüm:** `listSteps`, `replaceSteps`, `StepInput` import'ları eklendi. GET handler her otomasyonun adımlarını `Promise.all` ile paralel çeker ve `steps` alanıyla döner. POST handler body'deki `steps` dizisini `replaceSteps` ile kaydeder. PATCH handler body'de `steps` tanımlıysa yine `replaceSteps` ile günceller. TypeScript kontrolü: 0 hata.
- **Dosyalar:** `app/api/email/automations/route.ts`, `app/api/email/automations/[id]/route.ts`

## 2026-06-02 — feat(email/drip): Drip Queue Altyapısı + Saatlik Cron Processor
- **Sorun:** Email otomasyonları tek seferde tüm adımları gönderiyordu; zamanlı (delay_days) damla kampanyası (drip) desteği yoktu.
- **Çözüm:** (1) `automationStepsStore.ts` — `email_automation_steps` tablosunu yönetir (listSteps, replaceSteps). (2) `dripQueue.ts` — `email_drip_queue` tablosuna adımları `scheduled_at` ile ekler; `getDueItems`, `markItemSent`, `markItemFailed` fonksiyonları. (3) `automationRunner.ts` güncellendi: adım varsa anında göndermek yerine kuyruğa alır; `isOptedOut` export edildi. (4) `/api/cron/email-drip-process` saatlik cron endpoint: zamanı gelen kuyruk öğelerini işler, gönderir, `email_sends` kaydeder. (5) `vercel.json`'a saatlik cron eklendi.
- **Dosyalar:** `lib/email/automationStepsStore.ts`, `lib/email/dripQueue.ts`, `lib/email/automationRunner.ts`, `app/api/cron/email-drip-process/route.ts`, `vercel.json`

## 2026-06-02 — fix(email/webhook): Güvenlik ve kalite iyileştirmeleri
- **Sorun:** Resend webhook route'unda timing-attack açığı, tip güvensizliği, null crash riski ve try-catch eksikliği vardı.
- **Çözüm:** (1) Secret karşılaştırması `timingSafeEqual` ile güvenli hale getirildi. (2) `ResendWebhookEvent` interface eklendi, bounce tipi `'hard' | 'soft'` olarak daraltıldı. (3) `send.email` null check eklendi (crash önleme). (4) Supabase işlemleri try-catch içine alındı, hata loglanıp `ok: true` dönüyor.
- **Dosyalar:** `app/api/email/webhooks/resend/route.ts`

## 2026-06-02 — Email: Resend Webhook — Bounce/Complaint Auto Opt-Out
- **Sorun:** Resend'den gelen bounce ve şikayet (complaint) olayları işlenmiyordu; hard bounce veya şikayet olan alıcılar otomatik olarak opt-out yapılmıyordu.
- **Çözüm:** `POST /api/email/webhooks/resend` endpoint'i eklendi. `?secret=` query parametresiyle `RESEND_WEBHOOK_SECRET` doğrulaması yapılır. `email.bounced` (hard) ve `email.complained` olaylarında `email_events` tablosuna kayıt atılır, `email_sends.status` güncellenir, `email_contacts.opt_out` ve `crm_leads.email_opt_out` alanları otomatik olarak true yapılır. `email.delivered` olayında da status `delivered` güncellenir. Ayrıca `email_sends` tablosuna `'complained'` status değeri eklendi.
- **Dosyalar:** `app/api/email/webhooks/resend/route.ts`, `supabase/migrations/20260602000000_email_sends_bounce_webhook.sql`

## 2026-06-02 — Email Marketing: Açılma takibi + kampanya detay istatistik sayfası
- **Sorun:** Gönderilen kampanyalarda açılma/tıklama/teslim edilemedi istatistikleri takip edilmiyor ve gösterilmiyordu.
- **Çözüm:** (1) Her gönderilen maile gizli 1x1 piksel eklendi (`buildHtml`); piksel yüklenince `/api/email/track/open` endpoint'i `email_events` tablosuna `opened` kaydı atar. (2) `/api/email/campaigns/[id]/stats` API'si: gönderim + olay verilerini birleştirip saatlik açılma dağılımı ve alıcı bazlı liste döndürür. (3) `CampaignDetail.tsx`: 4 özet kart (Gönderilen / Açılma Oranı / Tıklama / Bounced) + Recharts AreaChart (saatlik açılmalar) + alıcı tablosu (açıldı/tıkladı/bounced sütunları). (4) Kampanya listesinde gönderilmiş kampanyalara tıklanınca veya BarChart2 butonuyla detay açılır.
- **Dosyalar:** `lib/email/sender.ts`, `app/api/email/track/open/route.ts`, `app/api/email/campaigns/[id]/stats/route.ts`, `components/email/CampaignDetail.tsx`, `components/email/CampaignsTab.tsx`, `locales/tr.json`, `locales/en.json`

## 2026-06-02 — CRM: Lead'leri Çek + Sayfaları Yönet + Aşamalar tek primary toggle grubuna alındı
- **Sorun:** Üç aksiyon butonu ayrı ayrı yerleştirilmişti; "Lead'leri Çek" primary renkli, diğer ikisi gri chip stilindeydi.
- **Çözüm:** Üç buton tek `bg-primary/10` kapsayıcıda birleştirildi; her biri `bg-primary text-white` stiliyle eşit görünüme kavuştu.
- **Dosyalar:** `components/crm/CrmDashboard.tsx`

## 2026-06-01 — CRM Sistemi: yeniden adlandırma, sayfa araması, yönetim grubu ve seçim hafızası
- **Sorun:** (1) "CRM" modül adı sade bir başlık istendi; (2) "Sayfaları Yönet" ve "Aşamalar" iki ayrı butondu, tek belirgin grup içine alınması istendi; (3) Sayfa bağlama seçicide çok sayıda Facebook sayfası olunca arama yoktu; (4) Çoklu sayfa seçicide son seçilen sayfa, sayfa yenilenince ilk sayfaya dönüyordu (hafızaya alınmıyordu).
- **Çözüm:** (1) Modül adı "CRM Sistemi" (TR) / "CRM System" (EN) olarak güncellendi — Topbar başlığı ve nav etiketleri. (2) "Sayfaları Yönet" + "Aşamalar" tek gri (`bg-gray-100`) kapsayıcıda, butonlar beyaz `shadow-sm` chip olarak belirgin. (3) `WizardSelect`'e opsiyonel `searchable` prop'u eklendi (default kapalı — mevcut/Meta-Google dropdown'ları etkilenmez), CRM sayfa seçicide aktif edildi; arama kutusu açılınca odaklanır, TR-duyarlı filtre + "Eşleşen sayfa yok" durumu. (4) Aktif sayfa seçimi `crm.activePageId` ile localStorage'a yazılıyor ve geçerliyse yenileme sonrası geri yükleniyor.
- **Dosyalar:** `components/crm/CrmDashboard.tsx`, `components/meta/wizard/WizardSelect.tsx`, `locales/tr.json`, `locales/en.json`

## 2026-06-01 — SEO: GEO/AEO puanı ve AI görünürlük taraması sayfa yenilemede korunuyor
- **Sorun:** SEO Plus'ta GEO/AEO Puanı ve altındaki AI görünürlük taraması yalnızca React state'inde tutuluyordu; sayfa yenilenince kayboluyordu (Genel SEO Puanı ise localStorage'dan geri yükleniyordu).
- **Çözüm:** GEO/AEO sonucu `seo_last_geo`, AI görünürlük sonucu `seo_ai_visibility` anahtarıyla localStorage'a yazılıyor ve mount'ta yalnız aynı URL'e aitse geri yükleniyor. Otomatik analiz akışına da GEO/AEO taraması eklendi.
- **Dosyalar:** `app/seo/page.tsx`, `components/seo/AiVisibilityChecker.tsx`

## 2026-06-01 — Genel yazı boyutu bir tık küçültüldü
- **Sorun:** Site geneli yazı boyutları biraz daha küçük istendi.
- **Çözüm:** Kök ölçek `html { font-size }` %93.75'ten %90'a düşürüldü; tüm rem tabanlı (Tailwind text-*, typography utility) boyutlar orantılı ve tutarlı şekilde küçüldü.
- **Dosyalar:** `app/globals.css`

## 2026-06-01 — SEO: "AI'da Görünüyor musun?" alıntısı site diline göre TR/EN
- **Sorun:** Tavily/Perplexity sorgusu İngilizce hardcoded'dı; dönen alıntı her zaman İngilizce çıkıyordu.
- **Çözüm:** Client locale (`useLocale`) API'ye iletiliyor; `buildQuery()` dile göre Türkçe veya İngilizce sorgu üretiyor. Default `tr`.
- **Dosyalar:** `components/seo/AiVisibilityChecker.tsx`, `app/api/seo/ai-visibility/route.ts`

## 2026-06-01 — SEO Plus: SEO ve GEO/AEO kart yapısı standartlaştırıldı
- **Sorun:** İki skor kartı farklı component yapısı kullanıyordu — SEO kartı `BigScoreCircle`'da `shrink-0` eksikti; button'da `flex-1` yoktu.
- **Çözüm:** `BigScoreCircle` wrapper'ına `shrink-0` eklendi, SEO kart button'una `flex-1` eklendi — GeoAeoScoreCard ile birebir aynı yapı.
- **Dosyalar:** `app/seo/page.tsx`

## 2026-06-01 — Google Ads hesap seçici: Meta dropdown'unun birebir muadili (büyük modal yerine inline panel) + hesap adı düzeltmesi
- **Sorun:** Google Ads hesap seçici, hesap değiştirme/ekleme için büyük bir centered modal (`GoogleAccountModal`) açıyordu — Meta'nın küçük hover dropdown'undan farklı. Ayrıca topbar'da hesap adı yerine ID numarası gösteriliyordu.
- **Çözüm:** Meta'nın `MultiAccountDropdown`'unun Google muadili olan yeni `GoogleAccountDropdown.tsx` oluşturuldu: hover ile açılan küçük panel; kayıtlı Google hesapları (ad gösterilir, aktif hesap yeşil vurgu, geçiş + çıkar), "Hesap Ekle/Seç" expandable browse (managers→children inline, ayrı modal yok), "Bağlantıyı Kes" — hepsi tek panelde. `Topbar.tsx` generic `accountSwitcherSlot` prop'una kavuştu (Google-specific kod kaldırıldı; sayfa kendi switcher'ını verir). `useGoogleAdsConnection`'a modal'dan bağımsız `loadAccounts()` eklendi (dropdown browse için managers fetch). Hesap adı düzeltmesi: `customerName` yalnız gerçek isim varsa (ID değilse) gönderilir — yoksa sunucu Google Ads API'den `descriptive_name` çeker. Büyük `GoogleAccountModal` yalnız hiç hesap seçili değilken (ilk zorunlu seçim) kalmaya devam eder.
- **Dosyalar:** `components/google/GoogleAccountDropdown.tsx` (yeni), `components/Topbar.tsx`, `app/dashboard/reklam/google/GooglePage.tsx`, `hooks/google/useGoogleAdsConnection.ts`, `components/google/GoogleAccountModal.tsx`, `locales/tr.json`, `locales/en.json`

## 2026-06-01 — SEO Plus: makale üretim toggle'ları — AI format + Article schema
- **Sorun:** Makale üretirken "AI'ya uygun format" ve "Article schema markup ekle" seçenekleri yoktu; yayın sırasında JSON-LD schema ekleme desteği de bulunmuyordu.
- **Çözüm:** `SeoArticlesTab.tsx`'e `aiFormat` ve `articleSchema` state'leri + checkbox toggle'ları eklendi. `aiFormat` üretim API çağrısına `params` ile geçilir; `buildGenerationPrompt` → `seo_article` case'ine AI format bloku eklendi (paragraf kısalığı, H2/H3 yapısı, konu cümlesi önde). `articleSchema` kaydetme çağrısına `params` ile geçilir; yayın route'unda (`app/api/seo/publish/route.ts`) `articleSchema === 'true'` ise `<script type="application/ld+json">` bloku HTML'e ön eklenir.
- **Dosyalar:** `components/seo/SeoArticlesTab.tsx`, `lib/yoai/prompts.ts`, `app/api/seo/publish/route.ts`

## 2026-06-01 — SEO sayfası: split SEO/GEO skor kartı ve koşullu panel gösterimi
- **Sorun:** SEO sayfasında GEO/AEO analizi hesaplansa da kullanıcıya gösterilecek UI entegrasyonu yoktu; mevcut tek "Overall Score" kartı sadece SEO skorunu gösteriyordu.
- **Çözüm:** `app/seo/page.tsx` güncellendi. (A) `GeoAeoScoreCard`, `GeoAeoAnalysisPanel`, `GeoAeoResult` import'ları eklendi. (B) `activeScore`, `geoResult`, `geoLoading` state değişkenleri eklendi. (C) `handleAnalyze` içinde SEO analizi başlarken arka planda `/api/seo/analyze-geo` fire-and-forget çağrısı başlatılır; auto-analyze akışında geoState sıfırlanır. (D) Eski tekil Overall Score kartı, iki tıklanabilir sekmeli (SEO | GEO/AEO) grid kartla değiştirildi. (E) Tüm SEO detay panelleri (Lighthouse, keywords, kategoriler, kırık linkler, yönlendirmeler, öneriler) yalnızca `activeScore === 'seo'` veya rakip karşılaştırması aktifken gösterilir; `activeScore === 'geo'` seçilince `GeoAeoAnalysisPanel` gösterilir.
- **Dosyalar:** `app/seo/page.tsx`

## 2026-06-01 — SSRF tam koruma: redirect manual, IPv6 AAAA, DNS fail-closed
- **Sorun:** `analyze-geo` endpoint'indeki mevcut SSRF koruması yetersizdi: `redirect: 'follow'` ile redirect zinciri doğrulanmıyordu; yalnızca IPv4 A kaydı kontrol ediliyordu (AAAA atlanıyordu); DNS hatası sessizce geçiliyordu (fail-open).
- **Çözüm:** `lib/seo/assertSafeUrl.ts` yeni standalone modülü oluşturuldu (`lib/email/ssrf.ts` deseniyle aynı kalite). `redirect: 'manual'` ile her redirect hop'unda `assertSafeUrl` yeniden çalışır; `dns.lookup({ all: true })` ile hem A hem AAAA kayıtları kontrol edilir; DNS hatası artık `throw` ile fail-closed; CGNAT (100.64/10), multicast, IPv4-mapped IPv6, non-HTTP redirect scheme reddi eklendi. Max 5 redirect limiti.
- **Dosyalar:** `lib/seo/assertSafeUrl.ts` (yeni), `app/api/seo/analyze-geo/route.ts`

## 2026-06-01 — GEO/AEO UI bileşenleri: ScoreCard, AnalysisPanel, VisibilityChecker
- **Sorun:** SEO Plus modülünde GEO/AEO skor kartı, kategori analiz paneli ve AI görünürlük kontrolü için UI bileşenleri yoktu.
- **Çözüm:** 3 yeni React client bileşeni oluşturuldu. `GeoAeoScoreCard` — SVG daire göstergeli skor kartı (seçilebilir, loading state). `GeoAeoAnalysisPanel` — 5 GEO/AEO kategorisini collapse/expand kartlarla gösteren panel + AiVisibilityChecker entegrasyonu. `AiVisibilityChecker` — Perplexity API üzerinden AI görünürlük sorgusu yapan buton + sonuç gösterimi. Tüm metinler `next-intl` i18n'den (`dashboard.seo.geoAeo`), proje tasarım kurallarına uygun (`animate-card-enter`, `hover:shadow-md`, amber renk yok).
- **Dosyalar:** `components/seo/GeoAeoScoreCard.tsx` (yeni), `components/seo/GeoAeoAnalysisPanel.tsx` (yeni), `components/seo/AiVisibilityChecker.tsx` (yeni)

## 2026-06-01 — SSRF koruması: analyze-geo URL doğrulaması
- **Sorun:** `app/api/seo/analyze-geo/route.ts` kullanıcı girdisini doğrulamadan fetch ediyordu; saldırgan `http://127.0.0.1/...` veya `http://169.254.169.254/metadata` göndererek iç ağa erişebilirdi.
- **Çözüm:** `isPrivateIp()` + `assertSafeUrl()` fonksiyonları eklendi. `dns/promises` ile hostname çözümlenerek tüm IP'ler RFC1918/loopback/link-local aralıklarına karşı kontrol edilir. Yalnızca HTTP/HTTPS izin verilir. Hata yanıtları iç detay sızdırmaz; `typeof url !== 'string'` input doğrulaması eklendi; `redirect: 'follow'` açık hale getirildi.
- **Dosyalar:** `app/api/seo/analyze-geo/route.ts`

## 2026-06-01 — SEO Plus: AI görünürlük API endpoint'i (Perplexity sorgusu)
- **Sorun:** SEO Plus modülünde AI görünürlük kontrolü için backend endpoint yoktu.
- **Çözüm:** `app/api/seo/ai-visibility/route.ts` oluşturuldu — domain'i Perplexity API'ye sorarak AI motorlarında görünürlüğü kontrol eder. `PERPLEXITY_API_KEY` yoksa `not_configured` döner, crash olmaz. Yanıtta `visible`, `excerpt` ve `domain` alanları döner.
- **Dosyalar:** `app/api/seo/ai-visibility/route.ts` (yeni)

## 2026-06-01 — geoAnalyzer: recursion guard + external-link edge case + DOM mutation fix
- **Sorun:** `flattenGraph` sonsuz döngüye girebilirdi; `analyzeEeat` canonical/og:url yokken tüm absolute linkleri harici sayıyordu; `analyzeCitability` zaten temizlenmiş DOM'dan script/style kaldırmayı tekrarlıyordu.
- **Çözüm:** `flattenGraph` için `depth > 10` guard eklendi. `analyzeEeat` içinde `baseHost` boşsa harici link kontrolü atlanarak `warning` döndürülür. `analyzeCitability` içindeki tekrarlı `script, style, noscript` cleanup kaldırıldı (`analyzeAiReadability` ilk çalıştığından bu adım gereksizdi).
- **Dosyalar:** `lib/seo/geoAnalyzer.ts`

## 2026-06-01 — GEO/AEO Analyzer: lib + API endpoint
- **Sorun:** SEO Plus modülü GEO/AEO puanı gösteriyor ancak gerçek HTML analizi yapan arka uç yoktu.
- **Çözüm:** `lib/seo/geoAnalyzer.ts` oluşturuldu — 5 kategori (schema %25, contentFormat %20, eeat %20, aiReadability %20, citability %15) ve 16 adet kontrol ile saf HTML analizi yapar; Cheerio tabanlı, dış API çağrısı yok. `app/api/seo/analyze-geo/route.ts` POST endpoint'i oluşturuldu — URL alır, sayfayı çeker, analyzeGeoAeo() çalıştırır, GeoAeoResult döner.
- **Dosyalar:** `lib/seo/geoAnalyzer.ts` (yeni), `app/api/seo/analyze-geo/route.ts` (yeni)

## 2026-06-01 — SEO modülü "SEO Plus" olarak yeniden adlandırıldı + GEO/AEO i18n anahtarları eklendi
- **Sorun:** SEO modülü artık klasik arama motoru analizinin ötesine geçerek GEO (Generative Engine Optimization) ve AEO (Answer Engine Optimization) yetenekleri kazanıyor; eski "SEO" adı ve açıklaması bu genişlemeyi yansıtmıyordu.
- **Çözüm:** Modül adı her yerde "SEO Plus" oldu (sidebar etiketi, sayfa başlığı, billing feature adı, dashboard section açıklaması). Yeni GEO/AEO puanı, kategori açıklamaları ve AI görünürlük kontrolü için `dashboard.seo.geoAeo` namespace'i eklendi. `dashboard.seo.articles` içine AI formatı ve Article schema i18n anahtarları eklendi. `lib/nav.ts` hardcoded label güncellendi.
- **Dosyalar:** `locales/tr.json`, `locales/en.json`, `lib/nav.ts`

## 2026-06-01 — "Dönüşüm Sihirbazı" sidebar ikonu sihirli değnek oldu
- **Sorun:** Yeniden adlandırılan "Dönüşüm Sihirbazı" alanının sidebar ikonu hâlâ eski `Rocket` (roket) idi; yeni "Sihirbaz" temasıyla uyumsuzdu.
- **Çözüm:** İkon lucide-react `WandSparkles` (sihirli değnek + pırıltılar) ile değiştirildi.
- **Dosyalar:** `lib/nav.ts`

## 2026-06-01 — "Marketing" alanı "Dönüşüm Sihirbazı" olarak yeniden adlandırıldı
- **Sorun:** Sidebar'da "Marketing" etiketiyle görünen alan aslında kampanya yönetimi değil; web sitesini tarayıp olayları (satın alma/form/lead) tespit eden ve GTM/GA4/Meta Pixel/Google Ads/Search Console üzerinden dönüşüm takibi altyapısı kuran 5 adımlı bir sihirbaz. Ad hem yanıltıcıydı hem de mevcut "Email Marketing" alanıyla çakışıyordu.
- **Çözüm:** Kullanıcı-yüzlü tüm etiketler "Dönüşüm Sihirbazı" (EN: "Conversion Wizard") oldu — sidebar etiketi, sayfa başlığı + dönüşüm odaklı yeni alt başlık, AccessRequiredModal feature adı/açıklaması, BusinessProfileGuard alan adı. Route (`/marketing-kurulumu`), klasörler, nav `id`, i18n key path'leri ve feature key (`marketing_setup`) link/bookmark kırılmaması için değiştirilmedi. İlgisiz `MARKETING_IMAGE`/`remarketing` geçen yerlere dokunulmadı.
- **Dosyalar:** `locales/tr.json`, `locales/en.json`, `app/marketing-kurulumu/layout.tsx`, `lib/nav.ts`

## 2026-06-01 — Owner/abonelik gate: geçici billing hatasında yanlış kilitlenme fix
- **Sorun:** Süper admin (owner) olmasına rağmen CRM, Email Marketing ve Marketing Kurulumu sayfaları "Bu özellik için abonelik gereklidir" modalıyla kilitleniyordu; hard refresh ile geçici düzeliyordu. `/api/billing/current` doğru şekilde `isOwner:true` + enterprise stub dönüyordu — sorun client'ta: `SubscriptionProvider` billing'i yalnız mount'ta bir kez çekiyor, `!res.ok` (geçici 5xx/network/erken-401) durumunda kilitleyici `FREE_DEFAULT`'a (`status:'expired'`) düşürüp `isOwner`'ı stale bırakıyordu (retry yok, yeniden-çekme yok). Bu yalnız owner'ı değil, billing çağrısı geçici başarısız olan her ödeme yapan kullanıcıyı da kilitliyordu. Sadece tam-sayfa hard gate'li 3 yeni modül (CRM/Email/Marketing) görünür semptom verdiği için diğer modüller (Optimizasyon/Strateji/SEO — aksiyonda gate'ler) "çalışıyor" sanılıyordu.
- **Çözüm:** `SubscriptionProvider.refresh` yeniden yazıldı: (1) yalnız 200 yanıt "çözülmüş" sayılır, geçici hatalarda 3 kez backoff ile retry; (2) **FAIL-OPEN** — tüm denemeler başarısızsa durum düşürülmez, iyi huylu mevcut state (benign trial default) korunur, owner/ödeme yapan kullanıcı kilitlenmez (erişim güvenliği zaten backend guard'larında); (3) sekme tekrar odaklanınca/görünür olunca billing sessizce yeniden çekilir — bayat provider durumu manuel hard refresh gerekmeden kendiliğinden iyileşir. Backend guard'lara ve Meta/Google entegrasyonuna sıfır dokunuş.
- **Dosyalar:** `components/providers/SubscriptionProvider.tsx`

## 2026-06-01 — Google OAuth doğrulama: gizlilik politikası "improperly formatted" fix
- **Sorun:** Google Cloud Verification Center, `helpful-envoy-489009-v2` (Google Ads Yoai) projesinde gizlilik politikası maddesini "Your privacy policy URL is improperly formatted" ile reddetti. Sayfa (`/en/privacy-policy`) HTTP 200 + tam HTML SSR olmasına rağmen: (1) gerçek `robots.txt` yoktu — `/robots.txt` `noindex`'li dashboard HTML'i dönüyordu; (2) root layout'taki `cookies()` kullanımı + middleware cookie set'i sayfayı `Cache-Control: private, no-cache, no-store` yapıyor, Google'a halka açık statik hukuki belge yerine özel/dinamik sayfa gibi görünüyordu; (3) legal sayfalarda explicit `robots`/`canonical`/`metadataBase` yoktu.
- **Çözüm:** (1) `app/robots.ts` ile gerçek public `robots.txt` (legal/marketing crawlable, dashboard/api disallow) + `app/sitemap.ts`. (2) `middleware.ts`'e `PUBLIC_LEGAL_SLUGS` seti + `applyPublicLegalHeaders` — legal path'lere (privacy/terms/cookie/data-deletion, EN+TR) `Cache-Control: public, s-maxage=86400` + `X-Robots-Tag: index, follow` set edilerek `private/no-store` ezildi; i18n/cookie mantığına dokunulmadı. (3) Root layout'a `metadataBase`; privacy (EN/TR) + terms (EN) sayfalarına `robots: {index, follow}` + `alternates.canonical`. Meta/Google Ads entegrasyonuna sıfır dokunuş — yalnız sunum/SEO katmanı.
- **Dosyalar:** `app/robots.ts`, `app/sitemap.ts`, `middleware.ts`, `app/layout.tsx`, `app/privacy-policy/page.tsx`, `app/gizlilik-politikasi/page.tsx`, `app/terms/page.tsx`

## 2026-06-01 — Email Otomasyon: unsubscribe linki, status-change guard, dead i18n key
- **Sorun:** (1) Otomasyon e-postalarındaki abonelikten-çık linkleri `c=automation` ile geldiği için campaigns tablosunda eşleşme bulamıyor, 400 dönüyor; yasal zorunluluk ihlali. (2) `runStageAutomations` her PATCH'te (aynı durum kaydedilse bile) tetiklendiğinden duplicate otomasyon maili gönderiliyordu. (3) `email.automations.stageLabel` i18n anahtarı hiçbir bileşende kullanılmıyordu.
- **Çözüm:** (1) Unsubscribe route'a `c=automation` dalı eklendi: `email_sends` tablosunda `automation_id IS NOT NULL` olan en son kaydı e-posta ile eşleştirip `user_id`/`send_id` çözümleniyor; campaign dalı (else) aynen korundu. (2) CRM leads PATCH'e `prev` okuma + `statusChanged` hesabı eklendi; `runStageAutomations` yalnız gerçek durum değişikliğinde tetikleniyor — Meta sync dokunulmadı, her PATCH'te çalışmaya devam ediyor. (3) `stageLabel` her iki locale dosyasından silindi; `automations` nesnesi 23 anahtara indi, TR/EN pariteleri korunuyor.
- **Dosyalar:** `app/api/email/unsubscribe/route.ts`, `app/api/crm/leads/[id]/route.ts`, `locales/tr.json`, `locales/en.json`

## 2026-06-01 — Email Marketing: Otomasyon (aşama tetikli otomatik e-posta)
- **Sorun:** Email Marketing > Otomasyon sekmesi "Yakında" ile devre dışıydı.
- **Çözüm:** CRM aşama girişi ve tekil yeni kişi eklenince anında otomatik e-posta gönderen otomasyon motoru. Inline fire-and-forget tetik (CRM PATCH + contacts POST, Meta-sync ile paralel best-effort — ana akışı bozmaz), mevcut `sender.ts` gönderim katmanı `buildDispatch` ile yeniden kullanıldı. Yeni `email_automations` CRUD store + `automationRunner` (opt-out/KVKK kontrollü, her tetiklenmede gönderim) + `AutomationsTab` UI (WizardSelect tetikleyici, canlı önizleme, aç/kapa). Kişiler sekmesine tekil "Kişi Ekle" formu (yalnız gerçekten yeni tekil manuel ekleme tetikler; toplu CSV/CRM import tetiklemez). `email_sends` otomasyon kayıtlarına açıldı (automation_id + campaign_id nullable). Tam EN/TR i18n.
- **Dosyalar:** `lib/email/{sender,automationStore,automationRunner}.ts`, `app/api/email/automations/{route,[id]/route}.ts`, `app/api/crm/leads/[id]/route.ts`, `app/api/email/contacts/route.ts`, `components/email/{AutomationsTab,EmailDashboard}.tsx`, `supabase/migrations/20260601000000_email_sends_automation.sql`, `locales/{tr,en}.json`

## 2026-05-31 — YoAlgoritma: Kartlar seçili hesaba göre filtrelenmiyordu (birleşik gösterim) düzeltildi
- **Sorun:** İşletme modunda (per-account) kullanıcı bir reklam hesabı seçse bile YoAlgoritma "Hesap Sağlık Durumu" kartları tüm hesapların birleşimini gösteriyordu. Kök neden: (1) `resolveYoaiScope`, `yoai_business_scope` cookie'si yoksa flag açık olsa bile `scoped:false` dönüyor; UI ise fallback ile hesabı "seçili" gösterip cookie'yi hiç yazmıyordu (switcher'da "zaten seçili" erken-return no-op) → endpoint filtresiz veri dönüyordu. (2) `account_alerts` filtresi, eşleşen günlük analize (`runCampaigns`) bağlıydı; analiz yoksa doğru kartlar bile boş dönüyordu. (3) Silinmiş Meta bağlantısından kalma `account_id=NULL` legacy uyarılar sızıyordu.
- **Çözüm:** (1) Switcher açılışta scope cookie yoksa UI'da seçili görünen işletmeyi sunucuya otomatik yazar (session-guard + tek reload); "zaten seçili" no-op yalnız cookie gerçekten yazılıysa çalışır. (2) Hierarchy endpoint `account_alerts`'ı `account_id` ile günlük analizden bağımsız süzer; `scopePending` artık yalnız kampanya kartları için "hazırlanıyor" gösterir, hesap uyarıları her zaman görünür. (3) Owner'ın orphan `account_id=NULL` legacy uyarıları superseded yapıldı (veri silinmedi, gizlendi).
- **Dosyalar:** components/account/UnifiedAccountSwitcher.tsx, app/api/yoai/improvements/hierarchy/route.ts, components/yoai/hierarchy/HierarchicalImprovements.tsx

## 2026-05-31 — YoAlgoritma: Hesap Sağlık kartı arka yüz metin sıkışması giderildi
- **Sorun:** Uzun `body` + `recommended_action` metninde `mt-auto` ile alta itilen paragraf body'e sıkışıyor, alt kenara yeterli boşluk kalmıyordu
- **Çözüm:** `p-4→p-5`, `mt-auto` kaldırılıp `mt-4 pt-3 border-t border-white/10` ile sabit ayırıcı çizgi eklendi
- **Dosyalar:** components/yoai/hierarchy/AccountAlertsBanner.tsx

## 2026-05-31 — YoAlgoritma: Hesap Sağlık kartları responsive grid düzeltmesi
- **Sorun:** AccountAlertsBanner, tüm uyarı kartlarını `repeat(n, 1fr)` ile tek satıra sıkıştırıyordu. 7 kart olduğunda her kart ~170px'e düşerek içerik okunamaz hale geliyordu.
- **Çözüm:** Inline `gridTemplateColumns` stili kaldırıldı, yerine responsive Tailwind grid eklendi: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`. Flip-card tasarımı ve koyu tema değiştirilmedi.
- **Dosyalar:** components/yoai/hierarchy/AccountAlertsBanner.tsx

## 2026-05-31 — Tüm modüller (Meta/Google reklam hariç): max-w-7xl + animasyon + amber fix
- **Sorun:** SEO, CRM, Marketing'e uygulanan genişlik + animasyon + okunabilir tipografi değişikliklerinin kalan tüm modüllere (Strateji, Optimizasyon, YoAlgoritma, Hedef Kitle, Tasarım, Raporlar, Entegrasyon) de taşınması istendi. Meta/Google reklam alanları hariç.
- **Çözüm:** **Strateji** — max-w-6xl→7xl, başlıklar text-base, info kartı+liste animate-card-enter. **Optimizasyon** — Meta+Google kampanya kartları kademeli animate-card-enter. **YoAlgoritma** — command center ana konteyneri animate-card-enter (max-w-[1440px] korundu). **Hedef Kitle** — max-w-7xl, GoogleAudienceView+AudienceList wrappers animate-card-enter. **Tasarım** — kredi göstergesi amber ihlali (bg-amber-50/text-amber-500/700) → bg-primary/5+text-primary. **Raporlar** — max-w-7xl (2 konum), KPI grid+trend grafiği animate-card-enter. **Entegrasyon** — max-w-7xl (2 konum), tüm platform bağlantı kartları hover:shadow-md. Meta/Google entegrasyon koduna dokunulmadı.
- **Dosyalar:** app/strateji/page.tsx, app/optimizasyon/page.tsx, app/yoai/page.tsx, app/hedef-kitle/page.tsx, app/tasarim/page.tsx, app/raporlar/page.tsx, app/entegrasyon/page.tsx

## 2026-05-31 — Marketing: SEO gibi tam genişlik + 3'lü kart gridleri
- **Sorun:** Marketing Kurulum sihirbazı `max-w-4xl` ile dardı; event seçim kartları 2'li grid'de sıkışık görünüyordu. SEO gibi genişletilmesi ve kartların 3'lü yan yana olması istendi.
- **Çözüm:** Sayfa konteyneri + 5 adım sarmalayıcısının tamamı `max-w-4xl → max-w-7xl`. Event seçim kartları (SiteScanner, 14 event) ve ConfigPreview platform kartları (5 kart) `sm:grid-cols-2 → lg:grid-cols-3`. ResultDashboard 4 kart için orphan oluşmaması adına dengeli 2×2 düzeninde bırakıldı (geniş ekranda kartlar büyür); PlatformConnect zaten `lg:grid-cols-4`. Yalnızca layout/sunum katmanı; API ve veri akışına dokunulmadı.
- **Dosyalar:** [app/marketing-kurulumu/page.tsx](app/marketing-kurulumu/page.tsx), [components/marketing-setup/steps/](components/marketing-setup/steps/) (SiteScanner, PlatformConnect, ConfigPreview, Deployment, ResultDashboard)

## 2026-05-31 — CRM & Marketing: SEO ile aynı tasarım dili (tipografi + animasyon)
- **Sorun:** SEO alanına uygulanan modern tasarım iyileştirmelerinin (okunabilir tipografi + kademeli giriş animasyonu) CRM ve Marketing alanlarına da taşınması istendi.
- **Çözüm:** Sunum katmanında tutarlı tipografi + animasyon: **CRM** Kanban sütunları ve liste lead kartlarına `animate-card-enter` kademeli giriş + hover-lift; bağlantı paneli/boş durum kartlarına giriş animasyonu; sütun başlıkları ve liste lead isimleri `text-sm → text-base`. **Marketing** wizard adım içeriği `key={step}` ile her geçişte yumuşak beliriş; tüm adım kart başlıkları (SiteScanner/PlatformConnect/ConfigPreview/ResultDashboard/Deployment) `text-sm → text-base`. Meta/Google entegrasyonu, API ve veri akışına dokunulmadı; `prefers-reduced-motion` guard'ı `globals.css`'de zaten mevcut.
- **Dosyalar:** [components/crm/CrmDashboard.tsx](components/crm/CrmDashboard.tsx), [components/marketing-setup/MarketingSetupWizard.tsx](components/marketing-setup/MarketingSetupWizard.tsx), [components/marketing-setup/steps/](components/marketing-setup/steps/) (SiteScanner, PlatformConnect, ConfigPreview, ResultDashboard, Deployment)

## 2026-05-31 — SEO: Amber/sarı renk ihlalleri kaldırıldı + i18n puan etiketleri
- **Sorun:** SEO sayfasında proje renk kuralını ihlal eden amber/sarı tonlar kullanılıyordu (`bg-amber-50`, `text-amber-700`, `text-amber-500`, `text-amber-600`, `#F59E0B`). Ayrıca `getScoreLabel` hardcoded Türkçe string döndürüyordu (i18n ihlali).
- **Çözüm:** Tüm amber renkleri onaylı palete taşındı: orta puan → `bg-primary/5` + `text-primary` + `#059669`; uyarı ikonları → `text-gray-500`; redirect zinciri → `bg-gray-100 text-gray-700`; redirect uyarısı → `text-primary`. `getScoreLabel` fonksiyonu `getScoreLabelKey` + `t('scoreLabels.*')` kullanacak şekilde refactor edildi; `scoreLabels` anahtarları (excellent/good/medium/weak/critical) her iki locales dosyasına eklendi.
- **Dosyalar:** [app/seo/page.tsx](app/seo/page.tsx), [locales/tr.json](locales/tr.json), [locales/en.json](locales/en.json)

## 2026-05-30 — CRM: Lead PULL akışı (webhook'a alternatif) + pages_manage_metadata
- **Sorun:** Test lead'i CRM'e düşmedi. Doğrudan Meta API teşhisi: `subscribed_apps` çağrısı `(#200) Requires pages_manage_metadata` döndü — bu izin OAuth scope'undan kaldırılmıştı, dolayısıyla "Sayfa Bağla" sayfayı leadgen webhook'una hiç abone edememiş. Webhook teslimatı bu izne bağlı.
- **Çözüm:** İki yönlü — (1) webhook iznini geri ekle, (2) izne hiç bağlı olmayan PULL yedeği kur:
  - **`pages_manage_metadata`** [lib/metaConfig.ts](lib/metaConfig.ts) META_SCOPES'a geri eklendi (app admin/owner reconnect'te review beklemeden alır → webhook gerçek-zamanlı çalışır; diğer kullanıcılar App Review sonrası).
  - **PULL akışı (`leads_retrieval`, mevcut izin):** [lib/crm/metaLeadPull.ts](lib/crm/metaLeadPull.ts) `pullLeadsForUser` — bağlı sayfaların `leadgen_forms`'undan `GET /{form_id}/leads` ile lead'leri çekip idempotent upsert. Webhook/pages_manage_metadata GEREKTİRMEZ.
  - **Türkçe alan ayrıştırıcı:** [lib/crm/leadFields.ts](lib/crm/leadFields.ts) `parseLeadFields` — `adiniz/soyadiniz/telefon_numarasi/email-adresi/E-MAİL ADRESİ` gibi TR alanları normalize edip ad/e-posta/telefon çıkarır. Webhook ingest de bu ayrıştırıcıya geçirildi.
  - **Manuel + otomatik:** `POST /api/crm/sync` ("Lead'leri Çek" butonu, [CrmDashboard](components/crm/CrmDashboard.tsx)) + saatlik cron [app/api/cron/crm-lead-pull](app/api/cron/crm-lead-pull/route.ts) (CRON_SECRET, tüm bağlı kullanıcılar; vercel.json).
  - Owner'ın mevcut 171 gerçek lead'i (Ada Trust Life: 38+118+15) bir kez içeri alındı.
- **Meta entegrasyonu:** Yalnız mevcut `MetaGraphClient` + `pageToken` + `leads_retrieval` reuse; additive, idempotent, kampanya/kitle altyapısına dokunulmadı.
- **Dosyalar:** `lib/metaConfig.ts`, `lib/crm/{leadFields,metaLeadPull,metaLeadIngest,pageSubscriptionStore}.ts`, `app/api/crm/sync/route.ts`, `app/api/cron/crm-lead-pull/route.ts`, `components/crm/CrmDashboard.tsx`, `vercel.json`, `locales/{tr,en}.json`. tsc 0 hata, tr/en parity.

---

## 2026-05-30 — CRM Faz 2: Meta senkron (olumlu/olumsuz lead → CUSTOMER_LIST + CAPI)
- **Sorun:** Olumlu/olumsuz işaretlenen lead'ler Meta ile senkron çalışmalı (Mailchimp ↔ Meta modeli) — reklam optimizasyonunu beslemeli ve hedeflemeyi şekillendirmeli.
- **Çözüm:** Lead durumu değişince gerçek Meta senkronu (additive, idempotent — mevcut Meta altyapısına dokunulmaz):
  - **Olumlu** → "YoAi CRM — Olumlu Lead'ler" CUSTOMER_LIST custom audience'a SHA-256 hash'li e-posta/telefon eklenir (lookalike/retargeting tohumu) + bir kez CAPI `QualifiedLead` custom olayı (`system_generated`; standart Lead metriğini şişirmez).
  - **Olumsuz** → "YoAi CRM — Olumsuz Lead'ler" audience'a eklenir (hedeflemeden hariç tutma) + olumlu listeden çıkarılır.
  - **Yeni (geri al)** → her iki listeden çıkarılır.
  - UI: işaretlemede "Meta'ya senkronlandı" toast'ı + lead satırında "Meta'ya gönderildi" rozeti.
  - **Motor:** `lib/crm/metaSync.ts` — mevcut `MetaGraphClient` (Authorization header) + `sendCapiEvent` yeniden kullanılır; audience bul/oluştur idempotent (aynı isim → tekrar oluşturmaz), üye ekleme `POST /{aud}/users`, çıkarma `DELETE /{aud}/users` (payload gövdede).
  - **İzleme:** `crm_leads`'e `meta_synced_at` / `meta_capi_sent` / `meta_sync_error` (migration `20260530001000`).
- **Adversarial inceleme (4 ajan) sonrası düzeltmeler:** DELETE payload query→gövde (kitle çıkarma kırığı giderildi); `markMetaSync` IDOR (user_id filtresi); PATCH 9sn timeout race + düşük retry (kullanıcıyı bekletmez); pagination cursor mantığı sağlamlaştırıldı; telefon baştaki sıfır + min-uzunluk doğrulaması; gereksiz `description` parametresi kaldırıldı. (Kapsam dışı: mevcut `metaCapiClient.ts` token-in-query deseni — çalışan marketing-setup CAPI'sine dokunulmadı.)
- **PII:** Hash'leme server-side (SHA-256, e-posta lowercase, telefon yalnız rakam); ham PII Meta'ya gönderilmez, loglanmaz.
- **Bekleyen (prod):** `20260530001000_crm_meta_sync.sql` omddq'ya uygulanmalı (`scripts/apply-crm-migration.mjs` artık iki migration'ı da çalıştırır). Faz 3 (e-posta marketing) ayrı onay bekliyor.
- **Dosyalar:** `lib/crm/{metaSync,leadStore}.ts`, `app/api/crm/leads/[id]/route.ts`, `app/api/crm/leads/route.ts`, `components/crm/CrmDashboard.tsx`, `supabase/migrations/20260530001000_crm_meta_sync.sql`, `scripts/apply-crm-migration.mjs`, `locales/{tr,en}.json`. tsc 0 hata; tr/en parity tam.

---

## 2026-05-30 — MetaConnectWizard limit conflict düzeltildi + /entegrasyon'da bağlı kullanıcı adı
- **Sorun 1 (kritik):** Wizard "1/2 hesap seçildi" gösteriyordu ama 2. seçimde abonelik modal'ı çıkıyordu; ileri'ye basınca da yine modal çıkıyordu. Kök neden: iki paralel limit sistemi (YENİ slot + ESKİ `useRegisteredAccounts`) çatışıyordu — eski reg sistemi daha sıkı sayıyordu, slot sistem 2 diyordu, MIN alınca 1 olunca 2. seçim block ediliyordu. Ayrıca `reg.addAccount` çağrısı limit_reached false-positive üretip ileri butonu modal'a düşürüyordu.
- **Sorun 2:** /entegrasyon Meta kartında "Bağlı" yazıyordu ama hangi hesabın bağlı olduğu görünmüyordu; kullanıcı bağlı OAuth kullanıcısının/işletmesinin adını da görmek istiyordu.
- **Çözüm:**
  - **Slot sistem yegane otorite:** Wizard'da eski `reg.addAccount` çağrısı kaldırıldı. `toggleAccount` ve `limitReached` SADECE slot sistem'i okur (`slotInfo.maxSlots - otherPlatformCount`). Eski `reg.remaining` legacy fallback tamamen silindi.
  - **Modal'lar kaldırıldı:** `showLimitModal` state, `setShowLimitModal` çağrıları, `AccessRequiredModal` JSX ve import tamamen silindi. Limit dolunca sessizce engellenir (uyarı yok, donuk slot görüntüsü yeterli).
  - **Bağlı kullanıcı adı:** `/api/meta/status` GET ek olarak `connectedUserName` döner (`/me?fields=name` Graph çağrısı, best-effort; hata olursa null). /entegrasyon Meta kartında "Bağlı" rozeti altında bağlı kullanıcı/işletme adı gösterilir.
- **Dosyalar:** `components/MetaConnectWizard.tsx`, `app/api/meta/status/route.ts`, `app/entegrasyon/page.tsx`. tsc 0 hata; next build temiz.
- **Sonraki:** Google için aynı şekilde bağlı kullanıcı adı gösterimi (OAuth userinfo veya manager hesap adı).

## 2026-05-30 — CRM Faz 1: Reklam lead'leri → CRM (olumlu/olumsuz işaretleme)
- **Sorun:** Meta Lead Ads reklamlarından düşen lead'leri tek panelde toplama, olumlu/olumsuz niteleme ve (sonraki fazda) Meta'ya geri senkron ihtiyacı (Mailchimp ↔ Meta modeli). Mevcut webhook'ta `leadgen` dalı boştu ("MVP: log only").
- **Çözüm:** Uçtan uca CRM Faz 1 — gerçek zamanlı webhook ile lead toplama, abonelik gerektiren modül:
  - **DB (migration):** `crm_page_subscriptions` (webhook page_id → user_id eşlemesi) + `crm_leads` (status `new|positive|negative`, `UNIQUE(user_id,meta_leadgen_id)` ile idempotent). Yalnız additive, RLS'li.
  - **Ingestion:** `app/api/meta/webhook` `leadgen` dalı dolduruldu → fire-and-forget `ingestLeadgen()`; Page Access Token ile `GET /{leadgen_id}` çekilip `crm_leads`'e idempotent yazılır. **Meta entegrasyonu bozulmadı** — GET/verify ve diğer alanlar aynen korundu, yalnız boş dal dolduruldu; mevcut `pageToken`/`client` yeniden kullanıldı.
  - **API:** `GET /api/crm/pages` (bağlanabilir + bağlı sayfalar), `POST/DELETE /api/crm/connect` (page → leadgen subscribe/unsubscribe), `GET /api/crm/leads` (maskeli liste + sayaçlar), `GET/PATCH /api/crm/leads/[id]` (tam detay + olumlu/olumsuz). Hepsi `checkCrmAccess` (auth + abonelik + owner bypass) ile korundu.
  - **UI:** Sidebar'a CRM (`Contact` ikonu) + `ROUTES.CRM`; `app/crm` (abonelik gate, owner bypass) → sayfa bağlama paneli + durum filtreleri + lead listesi (e-posta/telefon maskeli) + detay modalı (maskesiz, kendi lead'i; mailto/tel). Onaylı palet (no amber), WizardSelect.
  - **Billing + i18n:** `featureAccessMap.crm` (subscription_required) + tam `crm` namespace ve `sidebar.crm` / `features.crm` (tr+en eşit).
- **PII:** Liste maskeli, detay tam (kullanıcının kendi lead'i — iletişim için gerekli); ham veri DB'de service-role + abonelik gate arkasında.
- **Bekleyen (prod):** omddq'ya migration uygulanmalı (`scripts/apply-crm-migration.mjs` veya SQL Editor) — kod tablo olmadan da güvenli çalışır (boş liste/null, crash yok). Meta App'te webhook `leadgen` aboneliği + `META_WEBHOOK_VERIFY_TOKEN`. Faz 2 (Meta senkron) + Faz 3 (e-posta marketing) ayrı onay bekliyor.
- **Dosyalar:** `supabase/migrations/20260530000000_create_crm_tables.sql`, `scripts/apply-crm-migration.mjs`, `lib/crm/{pageSubscriptionStore,leadStore,guard,metaLeadIngest,mask}.ts`, `app/api/meta/webhook/route.ts`, `app/api/crm/{pages,connect,leads,leads/[id]}/route.ts`, `app/crm/{layout,page}.tsx`, `components/crm/{CrmDashboard,CrmLeadDetailModal}.tsx`, `lib/{routes,nav,billing/featureAccessMap}.ts`, `locales/{tr,en}.json`. tsc 0 hata.

---

## 2026-05-30 — Multi-slot fetch wrapper (Faz 3A): YoAlgoritma/analytics modülleri için multi-slot deep-fetch helper'ları
- **İhtiyaç:** Mevcut `fetchMetaDeep` / `fetchGoogleDeep` tek hesap çalışır (override pattern); YoAlgoritma, Strateji, Optimizasyon vb. modüller multi-slot aware olabilmek için tüm seçili slot'ların verisini iterate edip birleştirmeli.
- **Çözüm:** Yeni `lib/yoai/multiSlotFetcher.ts` — `fetchMetaDeepAllSlots(userId)` ve `fetchGoogleDeepAllSlots(userId)`:
  - `getSelectedAdAccountsForPlatform(userId, platform)` ile kullanıcının tüm seçili slot'larını çeker
  - Her slot için mevcut fetcher'ı override ile çağırır (entegrasyon kodu **hiç değişmez**)
  - Kampanyaları birleştirir; her birine `__slotIndex` + `__slotAccountId` + `__slotAccountName` ekler → downstream ayırt edebilir
  - Slot tablosu boşsa (yeni sistemden hiç slot kaydı yoksa) **eski tek-hesap akışına geri düşer** — sıfır regresyon, opt-in
- **Dönüş:** `{ campaigns, errors, connected, slotsUsed, slotsTried }` — slotsUsed = veri üreten slot sayısı, slotsTried = denenen toplam
- **Kullanım:** Yeni analytics endpoint'leri / Inngest fonksiyonları `fetchMetaDeep` yerine `fetchMetaDeepAllSlots` çağırarak çoklu hesabı destekleyebilir. Mevcut çağrılar dokunulmadı.
- **Dosyalar:** `lib/yoai/multiSlotFetcher.ts` (yeni). tsc 0 hata; next build temiz.
- **Sonraki adım**: Bu helper'ları gerçek çağrılarda (yoalgoritmaScan, perCampaignImprovements vb.) opt-in olarak kullanmak. Module-by-module ilerleyeceğiz.

## 2026-05-30 — Multi-account slot UI (Faz 2C): MetaConnectWizard slot sistemine bağlandı
- **Sorun:** Meta onboarding wizard'ı (Hoş Geldiniz → Bağlan → Hesap Seç → Tamamlandı) `useRegisteredAccounts` eski sistemini kullanıyordu; owner için limit `null` (sınırsız) idi, kullanıcı 5+ hesap seçebiliyordu. Yeni multi-account slot sisteminden (Faz 1+2A) habersizdi.
- **Çözüm:** MetaConnectWizard'a `/api/billing/ad-account-slots` çağrısı eklendi (mount'ta maxSlots + Google'da kullanılan slot sayısı çekilir). Meta için kalan slot = `maxSlots - googleSlots` formülüyle hesaplanır:
  - **Sayaç**: "X / Y seçildi" — Y = kalan Meta slot kapasitesi (slot sistemi yüklendiyse oradan, yoksa eski reg davranışı)
  - **Limit zorlama**: toggle'da slot limit + eski reg limit'in MİNİMUMU uygulanır → daha sıkı olan kazanır
  - **Yeni seçim engeli**: Limit dolunca sessizce engellenir (ilk kurulumda uyarı çıkmasın tercihi)
  - **Tamamlanmada kayıt**: Seçilen tüm hesaplar `/api/billing/ad-account-slots` POST ile slot 1, 2, 3... olarak kaydedilir → `/meta-ads`'teki slot selector'da görünür. Mevcut `/api/meta/select-adaccount` + `/api/account/registered` akışları korundu.
- **Tier davranışı**: owner = enterprise (20 slot), free/basic = 2 slot, starter = 4, premium = 8.
- **Dosyalar:** `components/MetaConnectWizard.tsx`. tsc 0 hata; next build temiz.

## 2026-05-30 — Multi-account slot UI (Faz 2B): /entegrasyon sadeleştirme (Meta + Google Ads kartları)
- **İstenen:** Entegrasyon sayfasında sadece "Meta bağlı / Google bağlı" durumu görünsün; hangi hesap seçili gösterilmesin. Hesap seçimi reklam sayfalarındaki slot selector'da yapılsın (Faz 2A'da eklendi).
- **Çözüm:** `/entegrasyon/page.tsx` Meta ve Google Ads kartlarında:
  - **Kaldırıldı**: hesap adı yeşil kutu gösterimi (`accountName` display block), "Hesabı Değiştir" butonu, "Hesap Seç" butonu, ilgili modal trigger'ları.
  - **Korundu**: Bağlantı toggle'ı (connect/disconnect), durum rozeti (Bağlı/Değil), ilk bağlanma için "Bağla" butonu.
  - **Akış**: Kullanıcı Meta/Google'ı bağlar → kart "Bağlı" gösterir → kullanıcı /meta-ads veya /google-ads'e gider → slot selector erişilebilir hesapları gösterir → kullanıcı slot 1'i seçer (= aktif).
- **GA + GSC etkilenmedi**: Property/site seçimi onlar için farklı bir konsept (multi-tenant ad account değil); /entegrasyon'da seçim akışları korundu.
- **Modal kodları dead-code olarak kaldı**: `GoogleAccountModal` import + state hâlâ var ama trigger çağrılmıyor (zarar vermez; ilerde temizlenir). next build temiz; tsc 0 hata.
- **Dosyalar:** `app/entegrasyon/page.tsx`

## 2026-05-30 — Multi-account slot UI (Faz 2A): AdAccountSlotSelector + /meta-ads + /google-ads entegrasyonu
- **İstenen:** Reklam sayfalarında 2-slot (tier'a göre N-slot) hesap seçici. Slot 1 = aktif hesap, slot 2+ = ek hesaplar. Tier'ı aşan slot'lar görünür ama kilitli (uyarı yok).
- **Çözüm:** Yeni `components/billing/AdAccountSlotSelector.tsx` (yeniden kullanılabilir) — props `platform: 'meta' | 'google_ads'`. Mount'ta `/api/meta/adaccounts` veya `/api/integrations/google-ads/accounts`'tan kullanıcının erişebildiği TÜM hesapları çeker; `/api/billing/ad-account-slots`'tan seçili slot'ları + maxSlots + isOwner okur. Her slot için WizardSelect dropdown gösterir; slot 1 = aktif (mor "Aktif" rozeti), diğerleri ek. Tier limitini aşan **1 ek slot görünür ama kilitli** (gri, lock ikonu, "Plan yükseltme gerekli", tıklanamaz — **uyarı popup'ı yok**). Slot değişimi: (1) `/api/billing/ad-account-slots` POST (slot tablosuna kaydet), (2) slot 1 ise ek olarak `/api/meta/select-adaccount` veya `/api/integrations/google-ads/select-account` çağır (mevcut Meta/Google entegrasyonu aktif hesabı buradan okur — mirror mantığı). Slot 2+ kaldırılabilir (X butonu); slot 1 silinemez (disconnect ayrı akış).
- **Entegrasyon:** `app/dashboard/reklam/meta/MetaPage.tsx` ve `app/dashboard/reklam/google/GooglePage.tsx`'in Topbar'ından SONRA, KPI kartlarından ÖNCE komponent eklendi. Mevcut Meta/Google entegrasyon kodu **dokunulmadı** — sadece public endpoint'ler client'tan çağrıldı.
- **i18n:** 9 yeni anahtar TR+EN (`slotsTitle`, `slotsSubtitle`, `slotLabel`, `slotActive`, `slotPickAccount`, `slotTierLocked`, `slotRemove`, `slotsLoading`, `slotsCount`). parity tam (3009/3009); tsc 0 hata; next build temiz.
- **Kalan iş**: Faz 2B (`/entegrasyon` sadeleştirme — hesap detayı kaldır, sadece bağlı/değil göster), Faz 3 (YoAlgoritma/Strateji/Optimizasyon vb. modülleri `getSelectedAdAccounts` ile çoklu slot aware yap).
- **Dosyalar:** `components/billing/AdAccountSlotSelector.tsx` (yeni), `app/dashboard/reklam/meta/MetaPage.tsx`, `app/dashboard/reklam/google/GooglePage.tsx`, `locales/tr.json`, `locales/en.json`

## 2026-05-30 — Multi-account slot altyapısı (Faz 1): DB + store + tier limit + endpoint
- **İstenen:** Kullanıcının Business Manager / MCC altında onlarca alt hesabı olabilir; tier'a göre N tane seçebilsin (Free/Basic: 2 toplam, Starter: 4, Premium: 8, Enterprise: 20). 3. seçim donuk olsun. Entegrasyon sayfası sade kalsın, hesap detayı reklam sayfalarına geçsin.
- **Çözüm (Faz 1 — altyapı):** Mevcut `meta_connections` / `google_ads_connections` tablolarına dokunmadan paralel yeni katman:
  - **Migration**: `user_selected_ad_accounts (user_id, platform, account_id, account_name, slot_index, ...)` — `UNIQUE(user_id, platform, slot_index)` + `UNIQUE(user_id, platform, account_id)`. Tabloya **omddq'ya elle uygulanmalı**.
  - **Store** (`lib/billing/adAccountSlots.ts`): `getSelectedAdAccounts`, `countSelectedAdAccounts`, `getSelectedAdAccountsForPlatform`, `setAdAccountSlot`, `removeAdAccountSlot`, `isAdAccountAlreadySelected`. Plan-tier limit: `getMaxAdAccountsForPlan(planId)` → free/basic 2, starter 4, premium 8, enterprise 20.
  - **Endpoint** (`/api/billing/ad-account-slots` GET/POST/DELETE): tier limit doğrulaması (owner muaf), aynı hesap iki slot'a giremez, sub'tan plan_id okur.
- **Mevcut entegrasyona dokunulmadı**: `selected_ad_account_id` / `customer_id` "aktif (slot 1)" mantığıyla mirror'lanır; `resolveMetaContext` / `getGoogleAdsContext` dokunulmadan çalışmaya devam eder.
- **Kalan iş (Faz 2 + 3):** /entegrasyon UI sadeleştirme (sadece bağlı/değil), reklam sayfalarında 2-slot dropdown selector, sihirbazın slot sistemine bağlanması, YoAlgoritma/Strateji vb. modüllerin multi-slot aware olması.
- **Dosyalar:** `supabase/migrations/20260530000000_create_user_selected_ad_accounts.sql` (yeni), `lib/billing/adAccountSlots.ts` (yeni), `app/api/billing/ad-account-slots/route.ts` (yeni). tsc 0 hata; next build temiz.

## 2026-05-30 — Marketing: "Yazma İzinleri" yeniden adlandırma + Meta/Google Ads multi-account dropdown
- **Sorun:** (1) "Bağlı" görünmesine rağmen "Kurulum İzni Ver" istemesi çelişki olarak algılanıyordu — okuma bağlantısı ile yazma izninin farkı açık değildi. (2) Kullanıcının Business Manager / MCC altında onlarca alt hesabı olabilir; sihirbazda yalnız tek hesap görünüyordu, alt hesapları seçemiyordu.
- **Çözüm:**
  - **#1 — Yeniden adlandırma**: "Kurulum İzinleri" → **"Yazma İzinleri (GTM + Analytics + Search Console)"**; "Kurulum İzni Ver" → "Yazma İzni Ver"; "Kurulum izinleri verildi" → "Yazma izinleri verildi". Açıklama tamamen yenilendi: "Mevcut Google bağlantın **okuma** için yeterli. Ancak GTM container kurulumu, Analytics property oluşturma ve Search Console doğrulaması **YAZMA** izni gerektirir — bu izin sadece bu kuruluma özeldir, reklam/analitik bağlantılarını etkilemez."
  - **#4 — Multi-account dropdown**: PlatformConnect artık mount'ta `/api/meta/adaccounts` ve `/api/integrations/google-ads/accounts` endpoint'lerinden kullanıcının erişebildiği TÜM reklam hesaplarını/customer'larını çeker. Birden fazla varsa salt-okunur display yerine **WizardSelect dropdown** gösterir + "{n} hesap bulundu — birini seç" rozeti. Hesap değiştirme: Meta için `/api/meta/select-adaccount` POST, Google Ads için `/api/integrations/google-ads/select-account` POST + connections refresh. Tek hesap varsa eski salt-okunur display korunur.
- **Kalan iş**: #5 (Entegrasyon sayfası sadeleştirme + 2-account tier limit + planlar arası dağılım) — DB schema değişikliği gerektirdiği için ayrı bir tur. Mevcut Meta/Google entegrasyon dosyalarına dokunulmadı (sadece public API endpoint'leri internal'dan çağırılıyor).
- **Dosyalar:** `components/marketing-setup/steps/PlatformConnect.tsx`, `locales/tr.json`, `locales/en.json`

## 2026-05-30 — Marketing: 3. parti eklenti tespiti + OpenAI yedek AI + "Site Analizi" + truncated banner kaldırıldı
- **Sorun:** (1) JivoChat, HotelRunner, WooCommerce gibi 3. parti widget'lar üzerinden işleyen iletişim/rezervasyon/satış event'leri yakalanmıyordu — kullanıcı "konu hangi plugin önemli değil, hepsini tarayıp event'leri yakala" dedi. (2) Claude site büyüklüğünde yetersiz kalırsa fallback yoktu (deterministik kural). (3) "Site Analizi (AI)" etiketi kullanıcıya gereksiz teknik detay veriyordu. (4) "Site büyük olduğu için yalnızca ilk N sayfa tarandı" uyarısı kabul edilemez bulundu (kullanıcıya zarar veren mesaj).
- **Çözüm:**
  - **Eklenti tespiti**: `KNOWN_PLUGINS` listesi (JivoChat, Tawk.to, Drift, Intercom, Crisp, LiveChat, Zendesk, Tidio, HubSpot, Messenger Customer Chat, WhatsApp Widget, HotelRunner, Booking.com, OpenTable, Calendly, Shopify, WooCommerce, İdeasoft, Ticimax, Contact Form 7, WPForms) script src/inline HTML üzerinden algılanır. Tespit edilen her eklentinin sağladığı event'ler kanıt havuzuna eklenir + Claude'a "Tespit edilen 3. parti eklenti/widget'lar" listesi geçirilir (sistem promptuna "eklenti tespiti güçlü kanıt" kuralı eklendi).
  - **OpenAI yedek AI**: Yeni `openaiAnalyzeSite` (gpt-4o-mini, JSON mode) Claude null/yetersiz dönerse devreye girer. `aiAnalyzeSite` orkestratörü Claude → OpenAI → deterministik fallback chain'ini yönetir. Mevcut `OPENAI_API_KEY` env'i kullanılır; `OPENAI_MODEL_SITE_SCAN` opsiyonel override. Shared `buildAnalysisPrompt` ile iki AI da aynı kurallar+kanıt havuzunu görür.
  - **"Site Analizi"**: `(AI)` eki kaldırıldı — kullanıcı AI kullanıldığını bilmek zorunda değil.
  - **Truncated banner**: SiteScanner.tsx'den kaldırıldı — tarama büyük sitelerde de sessizce tamamlanır.
- **Dosyalar:** `lib/marketing-setup/siteScanner.ts` (KNOWN_PLUGINS + plugin detect + buildAnalysisPrompt + parseAnalysisResult + claudeAnalyzeSite + openaiAnalyzeSite + aiAnalyzeSite), `components/marketing-setup/steps/SiteScanner.tsx` (truncated banner kaldırıldı), `locales/tr.json`, `locales/en.json`

## 2026-05-30 — Marketing: Claude analizi birincil + kanıt-temelli öneri + reason + URL ön-besleme
- **Sorun:** (1) Site tarama önerileri tutarsızdı — bir inşaat sitesi için "Arama Yapma" gibi kanıtsız event'ler öneriliyordu; Claude AI yeterince işin içinde değildi. (2) URL kutusu boş geliyordu; İşletme Profili'ndeki website_url'in kullanılması istendi.
- **Çözüm:** (1) `siteScanner.ts` yeniden yapılandırıldı — Claude artık BİRİNCİL analizci: sayfa içerikleri (başlık + meta + ilk metin) + tıklanabilir öğeler + deterministik kanıt havuzu Claude'a verilir; Claude işletme türünü belirler ve KANIT-TEMELLİ öneri üretir (`reason` zorunlu; kanıtsız event önermez kuralı sistem promptunda). `SiteScanResult`'a `businessAnalysis` + `RecommendedEvent.reason` eklendi. Claude erişilemezse deterministik fallback. UI'da yeni "Site Analizi (AI)" kartı + her önerinin altında kanıt cümlesi. (2) SiteScanner mount'ta `/api/yoai/business-profile`'dan `website_url`'yi çekip URL kutusunu ön-besler (kullanıcı yine değiştirip silebilir). 3 yeni i18n anahtarı TR+EN; parity tam (2998/2998); tsc 0 hata; next build temiz.
- **Dosyalar:** `lib/marketing-setup/types.ts`, `lib/marketing-setup/siteScanner.ts`, `components/marketing-setup/steps/SiteScanner.tsx`, `locales/tr.json`, `locales/en.json`

## 2026-05-29 — SEO otomatik makale: Inngest'siz çalışma + WhatsApp tespiti + zamanlama telafisi + anahtar kelime kalıcılığı; Marketing adı + Site İçi Arama kaldırma + font ayarı
- **Sorunlar:** (SEO) Zamanlanan makale hiç üretilmiyor/yayınlanmıyor, "Makalelerim" boş, anahtar kelime yenilemede kayboluyor. (Tarama) WhatsApp eklenti butonu tespit edilmiyor. (UI) Sidebar hâlâ "Marketing Kurulumu", "Site İçi Arama" event'i karışıklığı, yazılar fazla büyük.
- **Çözüm:**
  - **EN KRİTİK — Inngest'siz çalışma:** İş mantığı `lib/seo/runScheduleArticle.ts`'e (step'siz) çıkarıldı; Inngest function buna delege ediyor. Cron route artık Inngest yapılandırılmamışsa 503 vermek yerine **INLINE** üret→görsel→kaydet→yayınla çalıştırıyor (Vercel 60s zaman bütçesiyle, sıralı). Böylece otomatik akış Inngest kurulumuna **bağımlı olmadan** çalışır. + cron loglama eklendi.
  - **Zamanlama telafisi:** `isScheduleDue` tek-saat eşleşmesinden "yayın anı bugün geldi/geçti + bugün çalışmadı" mantığına geçti (dakika dahil) → kullanıcı saati pencereden sonra ayarlasa bile aynı gün bir sonraki cron'da telafi edilir, ertesi güne sarkmaz.
  - **Anahtar kelime kalıcılığı:** SeoAutomationPanel'de kelime ekle/çıkar artık **otomatik kaydediyor** ("Kaydet" beklemeden); kaydetme başarısızsa sessiz kalmıyor, hata göstergesi çıkıyor (saveError, TR+EN).
  - **WhatsApp tespiti (#1):** Firecrawl crawl + scrape'e `waitFor: 3500` eklendi — chat/click-to-chat eklenti butonları (wa.me/tel/ig.me…) client-side render edildiği için bekleme olmadan HTML'de görünmüyordu. (Gerçek site testinde `wa.me/...` linki Firecrawl çıktısında doğrulandı.)
  - **Site İçi Arama kaldırıldı (#2):** `view_search_results` event'i katalog + tarama kuralı + GA4 audience + i18n'den tamamen çıkarıldı (telefon aramasıyla karışıyordu).
  - **Sidebar "Marketing" (#4):** Etiket `lib/nav.ts` label'ından değil i18n `sidebar.marketingkurulumu`'dan geliyordu; o ve feature etiketi "Marketing" yapıldı (TR+EN).
  - **Font ayarı (#5):** 5 adımda başlık `text-2xl`→`text-xl`, gövde `text-base`→`text-sm` (çok büyükten bir tık küçüğe).
  - tsc 0 hata; tr/en parity 2995=2995.
- **Not (prod):** Üretimin canlıda çalışması için Vercel'de `ANTHROPIC_API_KEY` (zorunlu), `SITE_CREDENTIALS_KEY` (WordPress parola), `CRON_SECRET` + omddq'da `article_schedules` / `site_connections` / `yoai_articles` SEO kolonları gerekir.
- **Dosyalar:** `lib/seo/{runScheduleArticle.ts (yeni),timezone.ts}`, `inngest/functions/seoArticleRun.ts`, `app/api/cron/seo-article-run/route.ts`, `components/seo/SeoAutomationPanel.tsx`, `lib/marketing-setup/{siteScanner.ts,constants.ts,ga4AdminClient.ts}`, `lib/nav.ts`, `components/marketing-setup/steps/*.tsx`, `locales/{tr,en}.json`

## 2026-05-29 — Marketing Kurulumu UX: "Marketing" adı, arama etiketi netleştirme, URL bug'ı, büyük font + 4 platform kartı
- **Sorun (5 madde):** (1) "Arama Yapma" (site içi arama) ile "Telefon Araması" karıştırılıyordu. (2) Modül adı "Marketing" olacaktı, değişmemişti. (3) Adres kutusu boşken "14 sayfa tarandı" görünüyordu. (4) Yazılar çok küçük, alanlar dar/cılız. (5) Platform Bağlantıları'nda Google tek kart + Meta tek kart yerine 4 ayrı kart istendi.
- **Çözüm:**
  1. `events.viewSearchResults` etiketi "Arama Yapma" → **"Site İçi Arama"** (TR) / "Search" → "Site Search" (EN); telefon aramasıyla karışmaz.
  2. Modül adı **"Marketing"**: sidebar (`lib/nav.ts`) + sayfa başlığı (`marketingSetup.title`, TR+EN).
  3. **URL senkronizasyon bug'ı düzeltildi:** SiteScanner mount'tan sonra gelen kalıcı kayıt (async hydrate) ile adres kutusu artık senkronize ediliyor (`useEffect`); "tarandı" satırı hangi sitenin tarandığını (`scan.siteUrl`) da gösteriyor.
  4. **Okunabilirlik:** 5 adımın tamamında (SiteScanner, PlatformConnect, ConfigPreview, Deployment, ResultDashboard) font büyütüldü (text-xs→sm, başlık xl→2xl, açıklama sm→base), kartlar/girdiler ferahlatıldı (p-5→6, py-2.5→3), container `max-w-3xl`→`max-w-4xl`.
  5. **Platform Bağlantıları → 4 ayrı kart:** Google Ads · Google Analytics · Search Console · Meta. Her kart kendi ikonu + adı + bağlı/bağla durumuyla; bağlıysa primary çerçeve. (Kurulum izinleri + kimlik besleme bölümleri korundu.)
  - tsc 0 hata; tr/en parity 2995=2995; amber/yellow yok.
- **Dosyalar:** `lib/nav.ts`, `locales/{tr,en}.json`, `components/marketing-setup/steps/{SiteScanner,PlatformConnect,ConfigPreview,Deployment,ResultDashboard}.tsx`

## 2026-05-29 — Site Tarama: gerçek DOM tıklanabilir öğe çıkarma + Claude AI event tespiti (WhatsApp/telefon/IG DM/Messenger/e-posta)
- **Sorun:** Tarama yalnız e-ticaret/form event'lerini yakalıyordu; **iletişim kanalları (özellikle WhatsApp) eksikti.** Ayrıca bu kanallar çoğu sitede chat/click-to-chat **eklentileriyle** sonradan eklendiği için sitenin ana kodunda görünmeyebiliyordu — sabit "popüler plugin" tahmini yanlış olur.
- **Çözüm:** Tarama artık sitenin **gerçek DOM yapısını** çıkarıp event tespit ediyor (kullanıcının F12 `document.querySelectorAll('a, button, [onclick], [data-href]')` script'inin sunucu eşdeğeri):
  - `siteScanner.extractClickables()` — Firecrawl'ın render ettiği HTML'den **cheerio** ile tüm tıklanabilir öğeleri (a/button/[onclick]/[data-href] → tag, metin, hedef) çıkarır. Eklenti-enjekte butonlar dahil.
  - **Deterministik kurallar** genişletildi: WhatsApp (`wa.me`/`api.whatsapp.com`/`whatsapp://`), Messenger (`m.me`), Instagram DM (`ig.me`), telefon (`tel:`), e-posta (`mailto:`) — tıklanabilir öğelerin hedef+metni de haystack'e katılır, böylece eklenti linkleri yakalanır. (Telefon/e-posta footer'da yaygın → daha düşük güven.)
  - **Claude AI katmanı** (`classifyClickablesWithClaude`): çıkarılan tıklanabilir öğeler Claude'a verilip event'lere sınıflandırılır — deterministik kuralların kaçırdığı/belirsiz butonları (ör. `onclick` ile WhatsApp açan "Bize Ulaşın") yakalar. `ANTHROPIC_API_KEY` yoksa atlanır (deterministik fallback). Non-fatal.
  - `STANDARD_EVENTS`'e 5 iletişim event'i eklendi (`contact_whatsapp/phone/instagram/messenger/email`) → Meta `Contact` standart event'i + GA4 kanal-özel event + dönüşüm; otomatik olarak GA4 key event / Meta custom conversion / GTM tag / Google Ads dönüşüm akışına girer. 5 etiket TR+EN.
  - tsc 0 hata; tr/en parity 2995=2995. Firecrawl gerçek tarama akışı korundu; sahte veri yok.
- **Dosyalar:** `lib/marketing-setup/{siteScanner.ts,constants.ts}`, `locales/{tr,en}.json`

## 2026-05-29 — Marketing Kurulumu: test kaldırıldı + reklam bağlantıları (kitle/lookalike/GA4→Ads) GERÇEKTEN kuruluyor
- **İstek:** "Test istemiyorum, her şey fiilen çalışsın; gerekirse Meta/Google reklam tarafının içinden geçip bağlantıları gerçekten kur — ama mevcut reklam altyapımı bozma." + Abonelik penceresi TR/EN uyumlu olsun.
- **Çözüm:**
  - **Test kaldırma:** Sonuç ekranındaki "Meta'yı Test Et"/"GA4 test"/GTM önizleme test araçları bölümü tamamen kaldırıldı. CAPI doğrulaması artık sahte `TEST` kodu olmadan **gerçek olay** ile yapılıyor (`meta/route.ts` — `events_received>0` → CAPI fiilen çalışıyor).
  - **Meta website kitlesi + benzer (lookalike) kitle GERÇEKTEN oluşturuluyor:** `metaCapiClient.ensureWebsiteAudience` / `ensureLookalikeAudience` (Meta Marketing API `customaudiences`; idempotent — aynı isim varsa atlar; non-fatal — hata ana adımı bozmaz). Lookalike için reklam hesabının ülkesi `business_country_code`'dan çözülür.
  - **GA4 → Google Ads içe aktarma bağlantısı GERÇEKTEN kuruluyor:** `ga4AdminClient.ensureGoogleAdsLink` (GA4 Admin v1beta `googleAdsLinks`, mevcut `analytics.edit` scope; idempotent + non-fatal). Google Ads tarafı ek onay isterse dürüst not düşülür (sahte başarı yok). Reklam hesabı bağlı değilse atlanır.
  - **UI:** ConfigPreview'da gerçekten kurulan 3 kalem geri eklendi (artık dürüst vaat). ResultDashboard'da 4 gerçek metrik: kitleler (GA4+Meta), benzer kitleler, dönüşümler, yeniden pazarlama listeleri + GA4→Ads bağlantı durumu.
  - **Abonelik penceresi (AccessRequiredModal)** gömülü TR metinlerden `next-intl`'e taşındı (`billing.accessRequired`; 11 feature etiketi + açıklaması iki dilli; featureAccessMap geriye-uyum fallback).
  - Tümü **additive + idempotent**; mevcut kitle/kampanya/pixel altyapısına dokunulmadı. tsc 0 hata; tr/en parity 2990=2990.
- **Dosyalar:** `lib/marketing-setup/{metaCapiClient.ts,ga4AdminClient.ts}`, `app/api/marketing-setup/{meta,ga4}/route.ts`, `components/marketing-setup/steps/{ConfigPreview,ResultDashboard}.tsx`, `components/billing/AccessRequiredModal.tsx`, `locales/{tr,en}.json`

## 2026-05-29 — Marketing Kurulumu sihirbazı denetim düzeltmeleri (sahte sunum + güvenlik + akış) + çoklu hesap limit bug'ı
- **Sorun:** 20 ajanlı uçtan uca denetim (38 doğrulanmış bulgu, 0 yanlış pozitif) sihirbazın çekirdeğinin gerçek/çalışır olduğunu ama **sunum katmanının yer yer yanıltıcı** olduğunu, ayrıca **backend erişim guard'ının olmadığını** gösterdi. Ek olarak çoklu reklam hesabı limitinde çifte sayım bug'ı (Vercel flag açık → canlıda etkili).
- **Çözüm:**
  - **Sahte/yanıltıcı sunum:** (1) Site Tarama "Tespit Edilen Aksiyonlar" artık ham per-page liste yerine **event bazında tekil** chip + "{n} sayfada" frekansı (tekrarlı/sabit-yüzde görünümü kalktı). (2) ResultDashboard: "CAPI aktif" artık `capiVerified`'a koşullu; Google Ads dönüşüm sayısı **uydurma fallback** kaldırıldı (yalnız gerçek `conversionActionsCreated`); hep-0 "benzer kitle" kartı → gerçek **yeniden pazarlama listesi** sayısı; "eşleşme kalitesi" → dürüst "alınan olay"; GSC doğrulanmadıysa "doğrulama bekliyor". (3) ConfigPreview: deploy'un yapmadığı 3 vaat (Meta website/benzer kitleler, GA4 içe aktarma) "Oluşturulacak" listesinden çıkarıldı.
  - **Güvenlik:** Yeni `lib/marketing-setup/guard.ts` (`checkMarketingSetupAccess`: auth + flag/owner) **tüm aksiyon route'larına** (scan/setup/gtm/ga4/meta/google-ads/search-console/gtm-containers/connections) + yazma-scope'lu **setup-google OAuth start**'a eklendi. Önceden gate yalnız UI'daydı.
  - **Akış:** Deploy artık mount'ta otomatik canlı API'lere POST atmıyor — "Başlat" onayına bağlı + geri/ileri gezinmede tekrar çalışmıyor; "Onayla" en az bir platform bağlı değilken pasif; GTM "Yeni kapsayıcı" seçimi eski kapsayıcı ID'sini temizliyor; setup POST satır yoksa sessiz veri kaybı giderildi.
  - **Kalite:** "container" → "kapsayıcı" (TR), Google üç servisi ayrı durum, GA4 boş measurement-id koruması, gtmClient ölü kod, google-ads yanlış hata kodu, büyük-site kısmi tarama bilgi bandı, abonelik-gate'li kullanıcıda wizard mount edilmiyor. 8 yeni i18n anahtarı TR+EN (parity 2956=2956).
  - **Çoklu hesap:** MetaConnectWizard limit kontrolü artık zaten kayıtlı hesabı slot saymıyor (çifte sayım düzeltildi) — kullanıcı hak ettiği 2. hesabı seçebiliyor.
  - Meta/Google reklam API/publish entegrasyonuna dokunulmadı; tsc 0 hata; amber/yellow yok.
- **Dosyalar:** `lib/marketing-setup/{guard.ts (yeni),siteScanner.ts,types.ts,gtmClient.ts,ga4AdminClient.ts}`, `app/api/marketing-setup/{scan,setup,gtm,ga4,meta,google-ads,search-console,gtm-containers,connections}/route.ts`, `app/api/oauth/setup-google/start/route.ts`, `app/marketing-kurulumu/page.tsx`, `components/marketing-setup/steps/{SiteScanner,ResultDashboard,ConfigPreview,Deployment,PlatformConnect}.tsx`, `components/MetaConnectWizard.tsx`, `locales/{tr,en}.json`

## 2026-05-29 — Reklam hesabı bağlama: çoklu seçim (Meta wizard + Google modal), deneme limiti 2 → Pro bariyeri
- **İstenen:** Entegrasyon'dan Meta ve Google reklam hesapları bağlanırken **birden fazla hesap** seçilebilmeli; deneme süresinde Meta+Google **toplam en fazla 2** hesap, fazlası için abonelik (Pro) gerekmeli.
- **Çözüm:** Çoklu-hesap altyapısı (`user_registered_ad_accounts` + `lib/account/registeredAccounts.ts` + `/api/account/registered` + `MultiAccountDropdown`/`useRegisteredAccounts`, limit = abonelik/deneme yoksa **2**, owner sınırsız) zaten vardı ve Topbar switcher'da çalışıyordu — eksik olan **bağlama ekranlarıydı**. (1) **Meta wizard** (`/connect/meta`) radio'dan **checkbox çoklu seçime** çevrildi: flag açıkken `useRegisteredAccounts` ile limite kadar (deneme 2) birden çok hesap seçilir, hepsi kayıtlı kümeye eklenir, **ilki aktif olur**; limit dolunca seçim engellenir + `AccessRequiredModal type="subscription" featureKey="ad_account_slot"` ("Planları İncele"). Flag kapalıyken birebir eski tek-hesap (radio) davranışı korunur. Meta seçim/publish API'lerine **dokunulmadı** (yalnız UI + `/api/account/registered`). (2) **`/entegrasyon` Google modalı** eski inline tek-hesap modalından **çoklu destekli `GoogleAccountModal`** component'ine geçirildi (kayıt + limit gate + abonelik modalını kendi içinde yönetir). Wizard'daki hardcoded TR metinler i18n'e taşındı (12 yeni anahtar TR+EN), empty-faz amber ikonu ve config-missing amber bandı onaylı palete (gray/red) çevrildi. tsc 0 hata (değişen dosyalar). **Not:** Canlıda çalışması için Vercel `MULTI_ACCOUNT_ENABLED=true` + omddq'da `user_registered_ad_accounts` tablosu doğrulanmalı.
- **Dosyalar:** `components/MetaConnectWizard.tsx`, `app/entegrasyon/page.tsx`, `locales/tr.json`, `locales/en.json`

## 2026-05-29 — Marketing Kurulumu: hesap ADI gösterimi + mükerrer event seçimi kaldırıldı
- **Sorun:** (1) Platform Bağlantıları'nda reklam hesabı ID numarası (`act_…`, `142…`) gösteriliyordu; kullanıcı **hesap adı** istedi. (2) Adım 1'de (site tarama) event seçimi varken Adım 3'te (önizleme) tekrar event toggle'ı vardı — mükerrer.
- **Çözüm:** (1) `ConnectionStatus`'a `meta.adAccountName` + `googleAds.customerName` eklendi; `connections` route'u Meta adını Graph (`/{act}?fields=name`), Google Ads adını GAQL (`customer.descriptive_name`) ile çeker (salt-okunur, hata olursa ID'ye düşer). UI artık **adı** birincil, ID'yi küçük alt satırda gösterir. (2) ConfigPreview'den event toggle kartı kaldırıldı — önizleme artık sadece "ne oluşturulacak" özeti; event seçimi yalnız Adım 1'de. `preview.description` güncellendi, kullanılmayan `eventsTitle/eventsHint` anahtarları silindi. parity tam (2936/2936); tsc 0 hata; next build temiz. Mevcut Meta/Google entegrasyonuna dokunulmadı (yalnız okuma helper'ları import edildi).
- **Dosyalar:** `lib/marketing-setup/types.ts`, `app/api/marketing-setup/connections/route.ts`, `components/marketing-setup/steps/PlatformConnect.tsx`, `components/marketing-setup/steps/ConfigPreview.tsx`, `locales/tr.json`, `locales/en.json`

## 2026-05-29 — Marketing Kurulumu: mevcut GTM container'ları otomatik algılanır
- **İstenen:** Reklam hesabı kimlikleri gibi, kullanıcının Google hesabında zaten kurulu GTM container'ı varsa o da otomatik algılanmalı (manuel `GTM-XXXXXXX` yazma yerine).
- **Çözüm:** Yeni `GET /api/marketing-setup/gtm-containers` ucu, setup-consent token'ı (tagmanager scope) ile kullanıcının tüm GTM hesaplarındaki **web container'larını** listeler (`gtmClient.listContainers`, salt-okunur). PlatformConnect "Mevcut container'ı kullan" seçildiğinde manuel input yerine **algılanan container'lardan seçim** (WizardSelect: `İsim (GTM-XXXX)`) sunar + "{n} mevcut container bulundu" rozeti gösterir. Container bulunduğunda mod otomatik "existing"e geçip ilki önseçilir; hiç yoksa manuel giriş fallback'i korunur. 2 yeni i18n anahtarı TR+EN; parity tam (2938/2938); tsc 0 hata; next build temiz. Meta/Google entegrasyonuna dokunulmadı.
- **Dosyalar:** `app/api/marketing-setup/gtm-containers/route.ts` (yeni), `lib/marketing-setup/gtmClient.ts` (listContainers), `components/marketing-setup/steps/PlatformConnect.tsx`, `locales/tr.json`, `locales/en.json`

## 2026-05-29 — Marketing Kurulumu: reklam hesabı kimlikleri Entegrasyon'dan otomatik beslenir
- **Sorun:** Platform Bağlantıları adımında "Meta Reklam Hesabı Kimliği" ve "Google Ads Müşteri Kimliği" manuel `<input>` alanlarıydı; kullanıcı Entegrasyon'da hesapları zaten bağladığı hâlde tekrar elle girmesi isteniyordu. (Deploy adımları bu kimlikleri zaten `resolveMetaContext`/`getGoogleAdsContext`'ten alıyordu — manuel alanlar gereksiz ve yanıltıcıydı.)
- **Çözüm:** Bu iki alan artık `connections` endpoint'inden (`meta.adAccountId`, `googleAds.customerId`) **otomatik beslenip salt-okunur** gösteriliyor: bağlıysa yeşil "Entegrasyon'dan otomatik alındı" rozeti + kimlik; bağlı değilse "Entegrasyon'a git" yönlendirmesi. Değerler wizard state'ine + setup kaydına otomatik yansıtılır. Manuel giriş kaldırıldı; GTM container seçimi (gerçek kullanıcı tercihi) manuel kaldı. 3 yeni i18n anahtarı TR+EN; parity tam (2936/2936); tsc 0 hata; next build temiz.
- **Dosyalar:** `components/marketing-setup/steps/PlatformConnect.tsx`, `locales/tr.json`, `locales/en.json`

## 2026-05-29 — Marketing Kurulumu: deploy birikim bug'ı + önizleme kart tasarımı + event toggle
- **Sorun:** (1) Sonuç ekranında tüm platformlar "Bekliyor" görünüyordu — Deployment'taki `runStep`, `state.deploySteps`'i stale closure'dan okuyup üzerine yazıyor, her adım bir öncekini siliyor, yalnız son adım (search_console) kalıyordu. (2) "Otomatik Kurulum" adımı otomatik başlamıyordu (kullanıcı "Başlat"ı bulmak zorundaydı). (3) "Neler Kurulacak" alanı alt alta düz liste idi, "kaldırabilirsiniz" diyordu ama kaldırma yoktu; GTM/GA4/GSC'nin yanlışlıkla Google okuma bağlantısına bağlı görünmesi.
- **Çözüm:** (1) Deploy sonuçları artık `useRef` ile birikiyor (stale closure yok) — tüm adımların durumu doğru kalır. (2) Adıma girince (önizlemedeki "Onayla" onayından sonra) deploy otomatik başlar; tekil adım "Tekrar Dene" korunur. (3) ConfigPreview modern 2 sütun kart grid'e çevrildi: üstte event'leri ekle/çıkar toggle'ı (gerçek "kaldırma"), eşit yükseklikte platform kartları, ikon rozetleri, "Oluşturulacak/Bağlı değil" durumu. "Enabled" mantığı düzeltildi: GTM/GA4/GSC artık doğru şekilde **Kurulum İzinleri** (setup consent), Meta→Meta bağlantısı, Google Ads→Ads bağlantısına bağlı. tr/en parity tam (2933/2933); tsc 0 hata; next build temiz.
- **Dosyalar:** `components/marketing-setup/steps/Deployment.tsx`, `components/marketing-setup/steps/ConfigPreview.tsx`, `locales/tr.json`, `locales/en.json`

## 2026-05-29 — Marketing Kurulumu: deploy hata mesajları EN/TR'ye taşındı
- **Sorun:** Otomatik kurulum (Adım 4) ve sonuç ekranı, API route'larından gelen ham hata kodlarını (`not_authenticated`, `no_pixel`, `setup consent required`, ham Google API hataları…) doğrudan kullanıcıya basıyordu — EN/TR ve "ham teknik terim yok" kurallarını çiğniyordu.
- **Çözüm:** Yeni `stepError.ts` eşleyici, route hata kodlarını/mesajlarını `marketingSetup.errors.*` anahtarlarına çevirir (bilinmeyen → genel çevrilmiş mesaj; ham detay yalnız sunucu log'unda kalır). `Deployment.tsx` ve `ResultDashboard.tsx` artık `t(stepErrorKey(error))` gösteriyor. 4 yeni anahtar (notAuthenticated/noSetup/noPixel/missingSiteUrl) TR+EN eklendi; parity tam (2930/2930); tsc 0 hata.
- **Dosyalar:** `components/marketing-setup/stepError.ts` (yeni), `components/marketing-setup/steps/Deployment.tsx`, `components/marketing-setup/steps/ResultDashboard.tsx`, `locales/tr.json`, `locales/en.json`

## 2026-05-29 — Marketing Kurulum Sihirbazı (GTM + GA4 + Meta CAPI + Google Ads + Search Console)
- **İstenen:** Tek panelden tüm dijital pazarlama altyapısını sıfırdan kuran 5 adımlı sihirbaz: site tarama → platform bağlantıları → yapılandırma önizlemesi → otomatik kurulum → sonuç dashboard'u.
- **Çözüm:** Sidebar'a (owner / `MARKETING_SETUP_ENABLED` flag ile görünür) "Marketing Kurulumu" eklendi (`/marketing-kurulumu`). **Mevcut Meta/Google/GA4/GSC bağlantıları yeniden kullanıldı** — paralel OAuth kurulmadı, hiçbir entegrasyon dosyasına dokunulmadı. Yazma scope'ları (GTM/GA4-admin/GSC) için **ayrı "kurulum" Google consent** akışı eklendi; refresh token AES-256-GCM (`ENCRYPTION_KEY`) ile `marketing_setups.google_token_enc`'e şifreli yazılır. Site tarama Firecrawl ile (gerçek crawl → standart event önerisi). Tüm yazma istemcileri **gerçek API** çağırır (mock yok): GTM Mgmt v2 (container/tag/trigger/publish + snippet), GA4 Admin (property/stream/key event/dimension/audience), Meta Conversions API + custom conversions (SHA-256 hash + event_id dedup), Google Ads conversionActions/userLists (mevcut `adwords` scope), Search Console + Site Verification. Deploy client-orkestrasyonlu (sıra: GA4 → Meta → GTM → Google Ads → GSC), her adım bağımsız + retry, Vercel 60s limiti aşılmaz. UI: `WizardSelect`, emerald palet (amber/sarı yok), tam TR/EN i18n (`marketingSetup` namespace, 150 anahtar, parity tam), abonelik bariyeri (`AccessRequiredModal` + owner bypass) + `BusinessProfileGuard`. Yeni tablolar: `marketing_setups`/`setup_steps`/`capi_events` (migration yazıldı — **omddq'ya elle uygulanmalı**). tsc 0 hata; prod `next build` temiz.
- **Dosyalar:** `lib/marketing-setup/*` (crypto, constants, types, setupStore, visibility, siteScanner, gtmClient, ga4AdminClient, metaCapiClient, googleAdsConversionsClient, gscClient, setupGoogleToken), `app/api/marketing-setup/*` (scan, setup, connections, gtm, ga4, meta, google-ads, search-console, visibility), `app/api/capi/event/*`, `app/api/oauth/setup-google/*` (start, callback, status), `app/marketing-kurulumu/*` (layout, page), `components/marketing-setup/*` (wizard, stepper, modal, 5 step), `supabase/migrations/20260529000000_create_marketing_setups.sql`, `lib/nav.ts`, `lib/routes.ts`, `lib/billing/featureAccessMap.ts`, `components/SidebarNav.tsx`, `locales/tr.json`, `locales/en.json`, `.env.example`

## 2026-05-28 — İşletme Profili: güncellemede boş form + profil çoğalması düzeltildi
- **Sorun:** İşletme Profilini "Düzenle" ile güncellemeye çalışınca wizard boş (sıfırdan kurulum gibi) açılıyordu. Kök neden: `getProfileByUserId` `.maybeSingle()` kullanıyordu; kullanıcının `user_business_profiles` tablosunda birden fazla satırı varsa `.maybeSingle()` hata verip `null` döndürüyor → form prefill edilemiyor. Ayrıca `upsertProfile`'ın finder'ı da `.maybeSingle()` kullandığından çoklu satırda eşleşmeyi bulamayıp **yeni satır INSERT ediyor** — yani her kayıt profili çoğaltıp sorunu kalıcılaştıran bir kısır döngü yaratıyordu.
- **Çözüm:** Her iki sorgu `.maybeSingle()` yerine `.order('updated_at', desc).limit(1)` ile en güncel satırı alacak şekilde değiştirildi. `getProfileByUserId` artık çoklu satırda da deterministik olarak en güncel profili döndürür (form prefill çalışır); `upsertProfile` mükerrer INSERT yerine her zaman mevcut (en güncel) satırı UPDATE eder → çoğalma durur. DB'ye dokunulmadı (migration/silme yok); tek satırlı kullanıcılarda davranış aynı; owner bypass ve scope mantığı korundu; tsc 0 hata.
- **Dosyalar:** `lib/yoai/businessProfileStore.ts`

## 2026-05-27 — SEO: WordPress'e "Uygulama Parolası" ile manuel bağlanma yolu eklendi
- **Sorun:** Tek-tık WordPress yetkilendirmesi (`wp-admin/authorize-application.php`) ağır/yavaş WordPress kurulumlarında beyaz ekrana / zaman aşımına düşüyor (örnek sitede PHP 7.4 + çok eklenti; `/wp-json/` kökü ve `posts` ucu 20sn+ timeout, fakat hafif `users/me` ucu 0.5sn'de yanıt veriyor). Kullanıcı bu ağır sayfada takılıp bağlantıyı tamamlayamıyordu.
- **Çözüm:** Ağır yetkilendirme sayfasını tamamen atlayan alternatif yol: kullanıcı WP profilinden ürettiği uygulama parolasını YoAi'ye yapıştırır. Yeni `POST /api/seo/sites/wordpress` route'u, bağlantıyı hafif/hızlı `users/me` ucundan doğrular (testConnection, 10sn timeout), başarılıysa şifreli kaydeder; `auth_failed`/`unreachable`/`not_wordpress`/`test_failed` ayrımıyla net hata döner. UI: yeni `SeoWordPressConnect` bileşeni (site adresi etkin analiz URL'inden öntanımlı + kullanıcı adı + uygulama parolası göster/gizle + "nasıl alınır" adımları + profil sayfasına kısayol), `SeoSitesPanel`'de webhook'un üstüne eklendi. Mevcut tek-tık ve webhook yolları korundu. Migration yok; i18n TR+EN; Meta/Google entegrasyonu değişmedi; tsc 0 hata.
- **Dosyalar:** `app/api/seo/sites/wordpress/route.ts` (yeni), `components/seo/SeoWordPressConnect.tsx` (yeni), `components/seo/SeoSitesPanel.tsx`, `locales/tr.json`, `locales/en.json`

## 2026-05-27 — SEO: WordPress site bağlama callback'i sonsuz beklemede takılmıyor
- **Sorun:** WordPress "Uygulama Şifresi" yetkilendirmesinde kullanıcı "Onaylıyorum" dedikten sonra `/api/seo/sites/callback`'e dönülüyor ama sayfa sonsuza dek bekliyordu (yönlenmiyordu). Kök neden: callback, bağlantıyı doğrulamak için hedef sitenin `wp-json/wp/v2/users/me` ucuna istek atıyor; site (ör. güvenlik eklentisi sunucu-sunucu REST isteğini engelliyorsa) yanıt vermeyince `fetch` zaman aşımsız olduğu için asılı kalıyor ve fonksiyon timeout'a düşene kadar tarayıcı bekliyordu.
- **Çözüm:** `WordPressConnector.testConnection` fetch'ine `AbortSignal.timeout(10sn)` eklendi — site yanıt vermezse istek iptal edilip `network` hatası döner. Callback bu durumda sonsuz beklemek yerine net "Siteye ulaşılamadı (zaman aşımı/sunucu isteği engelleniyor)" mesajıyla (`reason=unreachable`) İçerikler sekmesine döner; `auth` → "şifre hatalı", diğer → "test edilemedi". Callback route'una `maxDuration=30` eklendi. Yetkilendirme/publish akışı ve Meta/Google entegrasyonu değişmedi; migration yok; tsc 0 hata.
- **Dosyalar:** `lib/seo/connectors/wordpress.ts`, `app/api/seo/sites/callback/route.ts`

## 2026-05-27 — SEO: İçerikler alanı analiz tabındaki aktif URL'e bağlandı (migration'sız)
- **Sorun:** SEO İçerikler alanı (yayın hedefi + içerik üretimi + makale listesi) işletme profilindeki sabit `website_url`'e bağlıydı. İstenen: ilk kurulumda profil URL'i analiz alanına otomatik gelip taransın (mevcut), ardından kullanıcı analiz tabındaki URL'i değiştirip yeniden analiz ettiğinde İçerikler alanı bu güncel URL'e ayak uydursun.
- **Çözüm:** Analiz tabındaki aktif/analiz edilen URL (`result.url`) tek kaynak yapıldı ve İçerikler tabına `activeSiteUrl` prop'u olarak geçirildi. İçerikler alanında `effectiveSiteUrl = activeSiteUrl ?? profileUrl` (fallback) üzerinden üç davranış bu URL'e bağlandı: (1) **Yayın hedefi/site bağlama** paneli (`SeoSitesPanel`) artık etkin site URL'inden beslenir; (2) **içerik üretimi** prompt'una site/marka bağlamı (`params.siteUrl`) eklendi — makale o sitenin sektörü/sesiyle üretilir; (3) **makale listesi** host bazında filtrelenir (`normalizeSiteHost`: protokol/www/path atılır) — her site kendi makalelerini görür, `siteUrl`'i atanmamış eski makaleler geriye uyumlu olarak her sitede görünür. Başlığa "İçerikler şu site için listeleniyor: {site}" göstergesi ve site-özel boş durum eklendi. **Migration YOK** (`yoai_articles.params` JSON alanı kullanıldı). i18n TR+EN. Meta/Google entegrasyonuna dokunulmadı; tsc 0 hata.
- **Dosyalar:** `app/seo/page.tsx`, `components/seo/SeoArticlesTab.tsx`, `lib/yoai/prompts.ts`, `locales/tr.json`, `locales/en.json`

## 2026-05-27 — Strateji: okunabilir URL (slug + kısa kimlik, migration'sız)
- **Sorun:** Strateji detay URL'i ham UUID gösteriyordu: `/strateji/af4c6f3c-216c-45a9-a7e7-de7eb9bb5ca7`. Okunabilir bir yapı istendi.
- **Çözüm:** Yeni `lib/strategy/url.ts` — `strategyPath(instance)` başlıktan Türkçe-uyumlu slug üretir ve sonuna UUID'nin ilk 8 hanesini ekler: `/strateji/girne-feribot-stratejisi--af4c6f3c`. `extractStrategyIdSegment()` URL'den kimlik kısmını ayıklar. **Migration YOK** (slug anlık türetilir, yeni kolon yok). **Geri uyumlu** (eski tam-UUID linkleri çalışır — ayraç yoksa param doğrudan kimlik). **API route'ları değişmez** — yalnız `GET /api/strategy/instances/[id]` kısa kimliği (8 hane) tam UUID'ye çözer (uuid kolonunda ilike çalışmadığı için hesabın stratejilerinde JS prefix eşleştirmesi); sayfa diğer mutasyon çağrılarında çözülmüş `instance.id`'yi (tam UUID) kullanır. Liste/satır linkleri (`StrategyRow` 4 yer + oluşturma akışı) `strategyPath()`'e geçirildi. Meta/Google entegrasyonuna dokunulmadı; build + tsc 0 hata.
- **Dosyalar:** `lib/strategy/url.ts` (yeni), `app/api/strategy/instances/[id]/route.ts`, `app/strateji/[id]/page.tsx`, `app/strateji/page.tsx`, `components/strateji/StrategyRow.tsx`

## 2026-05-27 — Strateji: sekme zıplaması + optimizasyon AI fallback + görev ikonu düzeltildi
- **Sorun:** (1) İş Geçmişi sekmesine tıklayınca birkaç saniye sonra otomatik olarak Görevler sekmesine geri atıyordu. (2) Optimizasyon önerileri (Sparkles ikonlu görevler) her seferinde aynı 3 sabit metni gösteriyordu — AI değil, koddaki şablon fallback'ten geliyordu (`ai_generated=false` doğrulandı), üstelik job "Başarılı" görünüp sorunu gizliyordu. (3) Optimizasyon görevlerinde Sparkles ikonu, görev tamamlanana kadar ekranda kaldığı için "Devam ediyor" (saat) durumu görünmüyor, ilk tıkta hiçbir şey değişmemiş gibi oluyordu.
- **Çözüm:** (1) Otomatik sekme mantığı artık yalnız ilk yüklemede çalışır (`autoTabbedRef`); manuel sekme seçimini polling ezmez. Terk edilmiş (orphan) `running/queued` job'lar `STALE_JOB_MS` (5dk) eşiğiyle polling'i sonsuza dek açık tutmaz ve İş Geçmişi'nde "Çalışıyor %40" yerine "Zaman aşımı" gösterilir. Blueprint Inngest'e taşınınca yarım kalan 3 takılı `generate_plan` job'u kalıcı olarak `failed` yapıldı. (2) Optimize Claude çağrısının kök sorunu giderildi — kırılgan eski ayarlar (15s timeout, 1000 token, ham `JSON.parse`) blueprint'tekiyle aynı şekilde sağlamlaştırıldı: timeout 40s, maxTokens 1500, robust JSON parse (fence + `[ ... ]` fallback). Metrics route'una `maxDuration=60` eklendi (pull_metrics + optimize tek istekte zincirlendiğinden fonksiyon erken öldürülüyordu). Fallback kullanılınca İş Geçmişi dürüstçe "Şablon öneri kullanıldı — AI önerisi alınamadı" notu gösterir. (3) Optimizasyon görevinde Sparkles yalnız "Yapılacak"ta gösterilir; tıklandıkça normal 3 durum görünür (⭕ → 🕐 saat → ✅ tik). Meta/Google entegrasyonuna dokunulmadı; yeni migration yok; tsc 0 hata.
- **Dosyalar:** `app/strateji/[id]/page.tsx`, `components/strateji/JobPanel.tsx`, `components/strateji/TaskPanel.tsx`, `lib/strategy/job-runner.ts`, `lib/strategy/constants.ts`, `app/api/strategy/instances/[id]/metrics/route.ts`

## 2026-05-27 — Tek AI = Claude (tüm OpenAI içerik/üretim çağrıları Claude'a taşındı)
- **Sorun:** Proje iki AI sağlayıcısını karışık kullanıyordu — reklam optimizasyonu Claude, ama YoAi sohbet/niyet, SEO konu+makale, Tasarım prompt iyileştirme, reklam metni üretimi ve birkaç zenginleştirme motoru OpenAI (`gpt-4o-mini`). Üretime çıkarken tek AI istendi: Claude.
- **Çözüm:** Paylaşılan Claude yardımcısı `lib/anthropic/text.ts` eklendi (`claudeText`, `claudeJson`, `claudeStream` — edge+node uyumlu raw fetch, model `getClaudeModel()` = `claude-sonnet-4-6`, JSON çıktısı fence-toleranslı). 10 OpenAI çağrı noktası Claude'a taşındı: YoAi sohbet (streaming), niyet algılama, Tasarım enhance-prompt, SEO konu seçici + makale üretici, reklam metni üreticisi (`adCreator`), analiz özetleyici (OpenAI-primary/Claude-fallback → tek Claude), kampanya niyet motoru, rakip tema analizcisi, rakip sorgu genişletici. Deterministik fallback'ler korundu (anahtar yoksa sistem kırılmaz). Strateji'deki kullanıcı-yüzlü "OpenAI key ekleyin" metni nötrleştirildi. **Not:** Çok-AI Karar Masası (Faz 4, `multiAiDecisionDesk`/`aiProviders`) bilinçli çoklu-sağlayıcı ensemble olduğu ve anahtarsız otomatik "skipped" düştüğü için olduğu gibi bırakıldı. tsc + production build temiz.
- **Dosyalar:** `lib/anthropic/text.ts` (yeni), `app/api/yoai/chat/route.ts`, `app/api/yoai/detect-intent/route.ts`, `app/api/tasarim/enhance-prompt/route.ts`, `lib/seo/topicSelector.ts`, `lib/seo/articleGenerator.ts`, `lib/yoai/adCreator.ts`, `lib/yoai/aiAnalysisSummarizer.ts`, `lib/yoai/campaignIntentEngine.ts`, `lib/yoai/competitorAnalyzer.ts`, `lib/yoai/competitorQueryExpander.ts`, `components/strateji/BlueprintView.tsx`

## 2026-05-27 — Hesabım gerçek (kullanıcıya özel sunucu hesabı) + Faturalar gerçek payment_transactions
- **Sorun:** (1) Hesabım sayfası tamamen `localStorage` üzerinden çalışıyordu; her kullanıcı sabit "Onur Şuay" varsayılanını görüyordu, e-posta boştu, "Şifre Değiştir"/"Fotoğraf Yükle" butonları işlevsizdi, referans kodu her açılışta `Math.random()` ile değişiyordu. (2) Faturalarım fatura geçmişi her zaman boştu; gerçek iyzico `payment_transactions` hiç gösterilmiyordu. "Soyad" alanı yanlışlıkla telefona bağlıydı (yazınca telefonu eziyordu). Bekleyen rozet amber (yasak renk).
- **Çözüm:** (1) Yeni `GET/PATCH /api/account/profile` (kanonik `getCurrentUser()` → `signups` tablosundan gerçek ad/e-posta; PATCH ad günceller + sidebar `user_name` cookie'sini senkronlar) ve `POST /api/account/password` (bcrypt ile mevcut şifre doğrulama → yeni şifre hash'le). Hesabım sayfası bu endpoint'lere bağlandı; "Onur Şuay" sabiti kaldırıldı, e-posta salt-okunur (login anahtarı), şifre değişimi gerçek + doğrulamalı (eşleşme/uzunluk/hatalı şifre geri-bildirimi), referans kodu artık kullanıcı id'sinden türeyen stabil kod, işlevsiz "Fotoğraf Yükle" butonu kaldırıldı. (2) Yeni `GET /api/billing/invoices` gerçek `payment_transactions`'tan kullanıcının ödemelerini sade Türkçe açıklamayla (ham enum yok) döner; Faturalarım geçmişi buradan dolar. Soyad bug'ı düzeltildi (`InvoiceInfo`'ya `lastName` alanı), amber rozet emerald/gray'e çevrildi, para birimi sembolü dinamik. **Migration GEREKMEDİ** (mevcut `signups` + `payment_transactions`). Not: iyzico üyelik onayı beklendiğinden canlı ödemeye dokunulmadı — altyapı gerçek veriye hazır. EN/TR i18n anahtarları eklendi.
- **Dosyalar:** `app/api/account/profile/route.ts` (yeni), `app/api/account/password/route.ts` (yeni), `app/api/billing/invoices/route.ts` (yeni), `app/hesabim/page.tsx`, `app/faturalarim/page.tsx`, `lib/subscription/types.ts`, `locales/tr.json`, `locales/en.json`

## 2026-05-27 — AI Tabanlı Hedef Kitle erişim bariyeri düzeltildi + profil-temelli kişiselleştirme
- **Sorun:** (1) "AI Tabanlı Hedef Kitle" sekmesi abonelik/owner gerektiriyordu ama tıklayınca içerik bariyersiz görünebiliyordu — gate imperatifti (sekme tıklamasına bağlı `setShowAudienceAiGate`), içerik render'ı ise yalnız `activeTab==='AI'`'a bakıyordu; yükleme anındaki default `hasSubscription` ile sekmeye girince abonelik sonradan `false` gelse bile içerik kalıyordu. (2) Kitle sihirbazı, işletme profilinden gelen zengin sinyalleri (sektör, kitle acıları, motivasyonlar, temalar) kullanmıyordu — sadece "hedef kitle" metnini prefill ediyordu.
- **Çözüm:** (1) `SeoArticlesTab` desenindeki gibi **deklaratif guard**: AI sekmesi içeriği yalnız `hasSubscription || isOwner` iken render edilir; erişim yoksa (ve abonelik yüklemesi bittiyse) kapatılamaz `AccessRequiredModal` (`type="subscription"`, `featureKey="audience_ai"`) çıkar. Boş-durum mor ikonu emerald'e çevrildi (renk kuralı), metinler i18n'e taşındı. (2) Sihirbaz açılış prefill'i `buildSeedDescription` ile zenginleştirildi — kullanıcı "hedef kitle" alanını doldurmamışsa sektör + kitle acıları + motivasyonlardan kişiselleştirilmiş açıklama üretilir. (Not: SEO web sitesi otomatik analizi, YoAi reklam içerik üretimi ve Strateji zaten kanonik `getBusinessContextForUser` + `buildBusinessContextPromptBlock` ile profil-temelli çalışıyor — doğrulandı.)
- **Dosyalar:** `app/hedef-kitle/page.tsx`, `components/hedef-kitle/AudienceWizardModal.tsx`, `locales/tr.json`, `locales/en.json`

## 2026-05-26 — TikTok menüsü "Yakında" (donuk) + tüm dropdown'lar Meta Ads tarzına (WizardSelect)
- **Sorun:** (1) Sol menüdeki "TikTok" öğesi tıklanabiliyordu ama hesap bağlama henüz yok; donuk/pasif olmalı ve yanında "(Yakında)" yazmalıydı. (2) Strateji'deki "Sektör" ve "Genel Bakış aralık" dropdown'ları ham native `<select>` (tarayıcı varsayılan görünümü) ile çiziliyordu; Meta Ads dropdown'ları gibi olmaları (yazı ailesi/boyutu, renk, köşe yuvarlaklığı, ok ikonu) istendi ve bu kuralın tüm site dropdown'ları için geçerli olması talep edildi.
- **Çözüm:** (1) `nav.ts`'te TikTok `disabled: true`; `SidebarNav` disabled child'ı tıklanamaz (`pointer-events-none` + `preventDefault` + `tabIndex=-1`, ikon soluk) yapar ve etiketin yanında parantez içinde `(Yakında)` (`sidebar.comingSoon`) gösterir. (2) Kanonik dropdown bileşeni `WizardSelect` (Meta kampanya wizard'ı referansı) belirlendi ve CLAUDE.md'ye "tüm dropdown'lar Meta tarzı / ham native `<select>` YASAK" kuralı eklendi (Meta/Google entegrasyon wizard'ları istisna — onlar zaten Meta tarzı + API koruması). Non-entegrasyon ham select'ler WizardSelect'e taşındı: Strateji (Sektör, KPIBar aralık), SEO Araçları (robots directive, sitemap changefreq x2), Tasarım (font seçici — her option kendi fontunda), Gözetim Merkezi (3 filtre) + Başvurular filtresi. WizardSelect'e opsiyonel per-option `style` (font önizleme korundu) ve uzun listeler için `max-h-72` kaydırma eklendi. EN/TR i18n korundu; amber/sarı yok; Meta/Google reklam entegrasyon koduna ve Reklam Yöneticisi Toolbar'ına (zaten stillenmiş, takvim ikonlu) dokunulmadı.
- **Dosyalar:** `lib/nav.ts`, `components/SidebarNav.tsx`, `components/meta/wizard/WizardSelect.tsx`, `components/strateji/WizardPhase1.tsx`, `components/strateji/KPIBar.tsx`, `components/seo/SeoToolsTab.tsx`, `components/tasarim/TextOverlayControls.tsx`, `components/gozetim/SignupApprovalsPanel.tsx`, `app/gozetim-merkezi/GozetimMerkeziClient.tsx`, `CLAUDE.md`

## 2026-05-26 — SEO: WP uyumsuz site → yetkilendir kutusu tamamen kalkar + her içeriğe otomatik görsel
- **Sorun:** (1) Kullanıcı "Yayın için yetkilendir"e tıklayıp sistem sitenin WordPress (tek-tık yayına uygun) olmadığını anladığında bile, işletme profilinden gelen "Yayın için yetkilendir" kutusu ekranda kalıyordu — kafa karıştırıcıydı; "Başka bir site / özel yazılım" (webhook) yolu öne çıkmıyordu. (2) Görsel üretimi hem otomasyon panelinde (checkbox) hem manuel kayıtta kullanıcının seçimine bırakılmıştı; her içeriğin görselli olması garanti değildi.
- **Çözüm:** (1) Callback `not_wordpress / rest_blocked / no_app_passwords` (SOFT_REASONS) döndüğünde site "tek-tık yayına uygun değil" olarak işaretlenir ve tarayıcıda (profil URL'i başına `localStorage`) kalıcı tutulur — yetkilendir kutusu **tamamen gizlenir**, yerine nötr gri bilgi notu (`wpIncompatibleNote`) gösterilir ve `SeoWebhookConnect` `defaultOpen` ile **otomatik açılarak asıl yayın yolu** olur. (2) Görsel üretimi her koşulda otomatik/gizli: manuel akışta makale kaydedilince arka planda sessizce görsel üretilir (`runImageGeneration(silent)` — kredi yoksa modal açmadan atlar); otomasyon panelindeki "görsel üret" checkbox'ı kaldırıldı, payload her zaman `generateImage: true`; Inngest motorunda `wantImage = isImageReady()` (flag'e bakılmaz, yalnız env hazır değilse atlanır). Manuel "görseli yeniden üret" butonu (kredi gate'li) korundu. EN/TR i18n; amber/sarı yok; WP Application Passwords akışı ve Meta/Google entegrasyonuna dokunulmadı; yeni migration yok.
- **Dosyalar:** `components/seo/SeoSitesPanel.tsx`, `components/seo/SeoWebhookConnect.tsx`, `components/seo/SeoArticlesTab.tsx`, `components/seo/SeoAutomationPanel.tsx`, `inngest/functions/seoArticleRun.ts`, `locales/tr.json`, `locales/en.json`

## 2026-05-26 — SEO: Genel Webhook/API yayın hedefi (WordPress dışı / özel yazılım siteleri)
- **Sorun:** Otomatik yayın yalnızca WordPress için çalışıyordu; özel yazılım ya da WP dışı bir sitesi olan kullanıcılar hedef bağlayamıyordu. WordPress kolaydı çünkü tek evrensel standart (REST API + Application Passwords) tüm WP sitelerinde aynı; diğer siteler için karşılığı yoktu.
- **Çözüm:** Daha önce kapalı olan `generic` connector gerçek bir **Webhook/API connector**'a dönüştürüldü. YoAi, her yayında makaleyi kullanıcının verdiği endpoint'e **HMAC-SHA256 imzalı JSON** olarak POST eder (`X-YoAi-Signature` başlığı); sitenin geliştiricisi imzayı doğrulayıp kaydı kendi sisteminde oluşturur. Tek connector ile **tüm özel yazılım siteleri** kapsanır (WP'nin tek connector'la tüm WP'leri kapsaması gibi). Factory'de `generic: true`; publish/test route'ları zaten `getConnector` üzerinden çalıştığı için otomatik devreye girdi. Yeni `POST /api/seo/sites/webhook` (https + min 8 karakter secret doğrulaması; secret AES-256-GCM ile şifreli saklanır). UI: `SeoWebhookConnect` (URL + secret üret/kopyala + etiket + geliştirici dokümanı: imzalı payload örneği, Node.js & PHP imza doğrulama kodu). `SeoSitesPanel` yeniden yapılandırıldı — webhook ile bağlama bölümü her zaman erişilebilir, listede platform etiketi. Ayrıca otomasyon uyarısı (`noSiteWarning`) sadeleştirildi. **Yeni migration gerekmedi** (`site_connections.platform` CHECK zaten `generic` içeriyor, `webhook_url` kolonu mevcut). EN/TR i18n; amber/sarı yok; WordPress tek-tık akışı ve Meta/Google entegrasyonuna dokunulmadı.
- **Dosyalar:** `lib/seo/connectors/genericWebhook.ts` (yeni), `lib/seo/connectors/index.ts`, `app/api/seo/sites/webhook/route.ts` (yeni), `components/seo/SeoWebhookConnect.tsx` (yeni), `components/seo/SeoSitesPanel.tsx`, `locales/tr.json`, `locales/en.json`

## 2026-05-26 — SEO Yayın Hedefi: dili WordPress'ten arındırma + nötr bağlanamama uyarısı
- **Sorun:** Yayın hedefi akışındaki tüm metinler "WordPress" varsayıyordu (hata mesajları, yetkilendirme ipucu, otomasyon uyarısı). Sitesi WordPress olmayan (özel yazılım / hazır sistem) kullanıcılar hem yanlış yönlendiriliyor hem de bağlanamayınca ürkütücü kırmızı "WordPress REST API erişilemiyor" hatası görüyordu.
- **Çözüm:** Kullanıcı-yüzlü metinler platform-bağımsız hale getirildi (`errNotWordpress`, `errRestBlocked`, `errNoAppPasswords`, `authorizeHint`, `noSiteWarning`) — WordPress yalnızca tek-tık bağlantının koşullu bir seçeneği olarak anılıyor, her durumda çalışan **Kopyala / HTML İndir** elle yayın yolu öne çıkarıldı. Bağlanamama bannerı, "site otomatik yayına uygun değil" anlamına gelen sebeplerde (not_wordpress / rest_blocked / no_app_passwords) kırmızı hata yerine nötr gri bilgi kutusuna çevrildi. EN/TR uyumlu; amber/sarı yok; bağlantı mekanizması (WP Application Passwords) ve Meta/Google entegrasyonuna dokunulmadı.
- **Dosyalar:** `components/seo/SeoSitesPanel.tsx`, `locales/tr.json`, `locales/en.json`

## 2026-05-26 — SEO İçerikler: "Yeni İçerik" butonu konumu + bağlı site yokken boş "Hedef Site" dropdown'u
- **Sorun:** (1) "Yeni İçerik" butonu sekmenin en üstündeydi; tıklayınca açtığı üretici form "Yayın Hedefi" ve "Üretim Ayarları" panellerinin **altında** render edildiğinden görünür alanın çok altında açılıyor, kullanıcıya buton "çalışmıyor" gibi görünüyordu. (2) Üretim Ayarları'nda bağlı site yokken "Hedef Site" dropdown'u boş/seçeneksiz kalıyor, kaydedilemeyen yarım bir form bozuk görünüyordu.
- **Çözüm:** (1) Buton üst başlıktan alınıp panellerin altına, yeni "Makalelerim" başlığıyla aynı satıra taşındı — üretici form artık butonun hemen altında, görünür açılıyor. (2) `noSites` durumunda boş dropdown'lı form gizlenip yerine net bir bilgilendirme gösteriliyor (otomatik üretim için önce yayın hedefi bağlanmalı; bağlı site yokken makaleler elle üretilip Kopyala/HTML İndir ile kullanılabilir). EN/TR i18n (`myArticles` eklendi, `noSiteWarning` zenginleştirildi); amber/sarı yok; Meta/Google entegrasyonuna dokunulmadı.
- **Dosyalar:** `components/seo/SeoArticlesTab.tsx`, `components/seo/SeoAutomationPanel.tsx`, `locales/tr.json`, `locales/en.json`

## 2026-05-25 — SEO: Site bağlama (WordPress tek-tık) + otomatik günlük makale üretimi/yayını + öne çıkan görsel
- **Sorun:** SEO "Makaleler" sekmesi yarım çalışıyordu: WordPress bağlantı bilgileri `localStorage`'da (kalıcı/güvensiz), yalnızca başlık+içerik gönderiliyordu (öne çıkan görsel yok), ve hiçbir otomasyon yoktu. Kullanıcı kendi sitesini bağlayıp her gün otomatik, SEO uyumlu, görselli makale üretip yayınlayabilmeliydi.
- **Çözüm:** (1) **Site bağlama** — `localStorage` kaldırıldı, kalıcı + AES-256-GCM şifreli `site_connections` tablosu. WordPress için **tek-tık yetkilendirme** (WP Application Passwords akışı): kullanıcı yalnız site adresini girer, şifreyi kendi WP panelinde onaylar, YoAi'ye girilmez. (2) **Connector soyutlaması** (`lib/seo/connectors`) — WordPress tam (media upload → `featured_media` + alt text + slug + excerpt); Shopify/İdeaSoft/Generic mimaride açık (İdeaSoft blog API'si resmî dokümanda doğrulanamadığı için ileri faza bırakıldı). (3) **Tam otomatik günlük akış** — saatlik cron (`/api/cron/seo-article-run`, timezone eşleştirmeli) → Inngest `article/generate-publish.user`: AI konu seç → yapılı SEO makale üret (meta description + slug + görsel alt) → fal.ai öne çıkan görsel → 20 kredi düş (owner bypass) → siteye yayınla. (4) **Manuel akış**: makaleye görsel üretme + site-seçimli yayın (`/api/seo/publish`). Tamamı EN/TR i18n, amber/sarı yok. Meta/Google entegrasyonuna dokunulmadı; eski `wordpress/publish` route'u geriye dönük korundu.
- **Dosyalar:** `lib/seo/{crypto,siteConnectionStore,scheduleStore,topicSelector,articleGenerator,imageForArticle,timezone}.ts`, `lib/seo/connectors/{types,wordpress,index}.ts`, `app/api/seo/{sites,sites/[id],sites/[id]/test,sites/connect,sites/callback,schedules,schedules/[id],publish}/route.ts`, `app/api/cron/seo-article-run/route.ts`, `inngest/functions/seoArticleRun.ts`, `app/api/inngest/route.ts`, `vercel.json`, `lib/yoai/prompts.ts`, `app/api/yoai/articles/route.ts` (+`[id]`), `app/api/tasarim/generate-image/route.ts` (paylaşılan lib'e delege), `components/seo/{SeoArticlesTab,SeoSitesPanel,SeoAutomationPanel}.tsx`, `locales/{tr,en}.json`, `supabase/migrations/20260525000000_create_site_connections.sql` (+ `article_schedules`, `yoai_articles` SEO kolonları)

---

## 2026-05-25 — Raporlar: Google Ads bağlantısı + dinamik veri
- **Sorun:** Raporlar sayfasında Google Ads sekmesi "Bağlı değil" olarak gri/kilitli kalıyordu. Sebep iki katmanlıydı: (1) `/api/google/status` yalnızca cookie okuyordu, oysa gerçek Google Ads bağlantısı `google_ads_connections` tablosunda (DB-first) tutuluyor — DB'deki bağlantı görülmüyordu; (2) sekme açılsa bile `normalizeGoogleAdsReport` top-level `data.cost`/`dailySeries` okuyordu ama `dashboard-kpis` endpoint'i `{ totals, changes, dates, series }` döndürüyor — KPI kartları ve grafik boş kalırdı.
- **Çözüm:** `/api/google/status` DB-first + cookie fallback yapısına çevrildi (`getGoogleAdsContext` ile aynı sıralama; Google API çağrısı yok, hızlı). Response şekli (`connected`/`accountId`/`accountName`/`hasSelectedAccount`) Raporlar ve Entegrasyon sayfalarıyla uyumlu korundu. `normalizeGoogleAdsReport` gerçek `dashboard-kpis` şekline göre yeniden yazıldı: `totals`'dan 6 KPI (Maliyet/Gösterim/Tıklama/TO/Dönüşümler/Dönüşüm Değeri) + `changes`'tan yüzde değişim, `dates`+`series` zip'lenerek günlük trend grafiği. Veri çeken endpoint'ler (`dashboard-kpis`, `campaign-comparison`) zaten DB-aware — entegrasyon koduna dokunulmadı.
- **Dosyalar:** `app/api/google/status/route.ts`, `app/raporlar/page.tsx`

---

## 2026-05-25 — Kullanıcı menüsünden "Kurumsal" kaldırıldı + Ana sayfa footer'ına dil seçici
- **Sorun:** Kullanıcı hesabı dropdown'ında "Kurumsal" (Gizlilik/Çerez/Kullanım Koşulları/Veri Silme) bölümü vardı; bu linkler zaten ana sayfa footer'ında olduğu için gereksiz tekrar. Ayrıca footer'da dil seçici yoktu.
- **Çözüm:** `UserProfileDropdown`'dan "Kurumsal" bloğu (ve kullanılmayan `Lock` import'u) kaldırıldı. Ana sayfa footer'ına referans tasarımındaki dark dropdown dil seçici (Globe ikon + bayrak + chevron, 🇹🇷 Türkçe / 🇬🇧 English) eklendi — YoAi'nin gerçek i18n mekanizmasıyla (`NEXT_LOCALE` cookie + `mapPathToLocale`), dışarı tıklayınca kapanır, aktif dil emerald ile işaretli.
- **Dosyalar:** `components/UserProfileDropdown.tsx`, `components/landing/FooterLangSwitcher.tsx` (yeni), `app/page.tsx`

---

## 2026-05-25 — Hedef Kitle kartı (Invalid Date / -1 kişi / ham enum / tipografi) + Advantage+ toggle
- **Sorun:** (#2) Kitle kartında "Invalid Date" (`new Date(createdAt)` fallback'siz) ve "-1 kişi" (Meta boyut vermeyince `approximateCount=-1` yine gösteriliyordu). (#3) Etiketler `text-caption` (çok küçük), "Alt Tür" değeri **ham enum** (LOOKALIKE/WEBSITE) basılıyor, grid simetrisi bozuk, tipografi tutarsız. (#4) Advantage+ toggle knob'u asimetrik (`left` yok, kapalı `translate-x-0.5`/açık `translate-x-5`).
- **Çözüm:** `AudienceCard`: `formatCreatedAt` (geçersiz/boş tarih → "—"), `hasValidCount` (boyut < 0 → satır hiç gösterilmez), `subtypeLabel` (ham enum → sade TR: WEBSITE→Web Sitesi, LOOKALIKE→Benzer Kitle, …). Etiket/değer tutarlı tipografi (etiket `11px uppercase gray-400`, değer `text-sm gray-800`), `grid-cols-2 gap-x-6 gap-y-3` simetrik hizalama. `StepInterests` Advantage+ toggle simetrik (`left-0.5` + `translate-x-0`/`translate-x-5`) + `role="switch"`/`aria-checked`. `tsc` ✓, `next build` ✓.
- **Dosyalar:** `components/hedef-kitle/AudienceCard.tsx`, `components/hedef-kitle/wizard/saved/StepInterests.tsx`

---

## 2026-05-24 — Reklam Yöneticisi: metrik filtresine yeni metrikler (Meta +6, Google +4 — fetch'e dokunmadan)
- **Sorun:** Metrik filtresinde yalnız 7 metrik vardı (Sonuçlar/Bütçe/Harcanan/Gösterim/Tıklama/CTR/CPC); Meta & Google çok daha fazlasını sunuyor.
- **Çözüm:** Keşifte bu metriklerin çoğunun API'den ZATEN çekildiği ama UI'da gösterilmediği tespit edildi → Meta/Google fetch koduna **DOKUNMADAN** (yalnız sunum katmanı) eklendi. **Meta:** ROAS, Erişim (reach — kampanya), CPM, Dönüşümler (purchases), Dönüşüm Oranı, Etkileşim (kampanya). **Google:** Dönüşümler, CPM, Dönüşüm Oranı, Dönüşüm Başına Maliyet (CPA). CPM / Dönüşüm Oranı / CPA, mevcut alanlardan hesaplanır (spent/impressions×1000, dönüşüm/tıklama×100, spent/dönüşüm) — render anında, 0'a bölme korumalı. `MetricFilterDropdown` + `getTableColumns` + tablo render genişletildi; localStorage `_v2` anahtarı (yeni metrikler varsayılan görünür, eski seçim sıfırlanır). EN/TR: `reach`/`cpm`/`conversions`/`conversionRate`/`engagement`/`cpa`. `tsc` ✓, `next build` ✓.
- **Dosyalar:** `app/dashboard/reklam/meta/components/MetaTableReal.tsx`, `app/dashboard/reklam/google/components/GoogleTableReal.tsx`, `app/dashboard/reklam/meta/MetaPage.tsx`, `app/dashboard/reklam/google/GooglePage.tsx`, `locales/tr.json`, `locales/en.json`

---

## 2026-05-24 — Çoklu işletme Faz 2.4: her reklam hesabına ayrı işletme profili (backend)
- **Sorun:** Kullanıcı ajans yapısında (Antso Denizcilik, Fikret Petrol, Metropol Yayınları… her biri ayrı marka/müşteri) ama sistem kullanıcı başına TEK işletme profili tutuyordu — her hesabın kendi profili olamıyordu, dolayısıyla AI her kampanyayı doğru markayla değerlendiremiyordu.
- **Çözüm:** `upsertProfile` constraint-agnostik **find-then-write** yapıldı (business_key varsa `(user_id, business_key)`, yoksa legacy `(user_id, business_key IS NULL)` ile bul → update/insert; `onConflict`'e bağlı değil). `business-profile` GET/POST, `YOAI_PER_ACCOUNT_SCOPE` açıkken aktif işletme scope'una göre çalışır: GET `getProfileForScope` ile o işletmenin profilini çeker (yoksa null → UI "profil oluştur"), POST `business_key`/`meta_account_id`/`google_customer_id`'yi profile bağlar. Migration: `user_business_profiles` `UNIQUE(user_id)` → partial unique `(user_id, business_key) WHERE business_key IS NOT NULL` (çoklu profile izin; bağsız/legacy NULL serbest — geriye uyumlu). Account switcher işletme seçince full reload yaptığından profil sayfası otomatik doğru profili yükler. `tsc` ✓, `next build` ✓.
- **Dosyalar:** `lib/yoai/businessProfileStore.ts`, `app/api/yoai/business-profile/route.ts`, `supabase/migrations/20260524010000_business_profiles_per_account_unique.sql`

---

## 2026-05-24 — Reklam Yöneticisi: metrik görünürlük filtresi + sütunlar tek satır (içeriğe göre genişler)
- **Sorun:** (Madde 1) Meta/Google Reklam Yöneticisi'nde kullanıcı hangi metrik sütunlarını göreceğini seçemiyordu (tüm metrikler sabit görünür). (Madde 3) Uzun kampanya adı / "Reklam Seti" bütçe etiketi hücrede alt satıra kayıyordu (wrap), tablo dağınık duruyordu.
- **Çözüm:** (1) Ortak `MetricFilterDropdown` component'i (dış-tıklama kapanır — proje picker standardı; en az 1 metrik açık kalır; yalnız primary/emerald/gray palet, amber yok). MetaPage + GooglePage toolbar'ına **takvimin sağına** eklendi. Kullanıcı seçimi localStorage'da kalıcı (`meta_visible_metrics` / `google_visible_metrics` — bağımsız). `getTableColumns` metrik sütunlarını `visibleMetrics`'e göre süzer; isim/durum sütunları her zaman görünür. Çok metrik seçilince tablo container'ı zaten `overflow-x-auto` → yatay scroll. (3) `<table>`'a `[&_td]:whitespace-nowrap` → tüm hücreler tek satır; table-layout resize yokken `auto` (içeriğe göre genişler), taşınca yatay scroll; ekran genişliğine esnek. Meta + Google ortak. EN/TR: `toolbar.metrics` / `metricsTitle` / `metricsAll`. Meta/Google API'ye dokunulmadı. `tsc` ✓, `next build` ✓.
- **Dosyalar:** `components/reklam/MetricFilterDropdown.tsx` (yeni), `app/dashboard/reklam/meta/MetaPage.tsx`, `app/dashboard/reklam/google/GooglePage.tsx`, `app/dashboard/reklam/meta/components/MetaTableReal.tsx`, `app/dashboard/reklam/google/components/GoogleTableReal.tsx`, `locales/tr.json`, `locales/en.json`

## 2026-05-24 — UI: hafif yeşil arka plan + Hesap Sağlık kartları tek satır + bütçe info ikonu kaldırıldı
- **Sorun:** (1) Modül sayfalarının (Strateji / Optimizasyon / Hedef Kitle / Tasarım / Raporlar / SEO / Entegrasyon) sağ içerik alanı bembeyazdı, boş/modern olmayan duruyordu. (2) YoAlgoritma "Hesap Sağlık Durumu" kartları sabit 3'lü grid'deydi; 4. kart alt satıra kayıyordu. (3) Meta tablosunda "Kampanya Bütçesi" / "Reklam Seti" etiketlerinin yanındaki info (ℹ️) ikonu gereksizdi.
- **Çözüm:** (1) `app/globals.css`'e `.app-content-surface` utility eklendi (hafif yeşil gradient `from-emerald-50/40 via-white to-emerald-50/20`, YoAlgoritma sayfasıyla tutarlı); 7 modül sayfasının kök içerik container'ı `bg-gray-50` → `app-content-surface`. (2) `AccountAlertsBanner` grid'i kart sayısına göre `gridTemplateColumns: repeat(N, minmax(0,1fr))` → kaç kart olursa olsun TEK SATIR, ekrana sığacak şekilde otomatik daralır (taşma yok). (3) Meta tablosunda iki bütçe etiketinin `Info` ikonu + tooltip'i kaldırıldı (etiketler kaldı), kullanılmayan `Info` import'u temizlendi. Meta/Google API'ye dokunulmadı. `tsc` ✓, `next build` ✓.
- **Dosyalar:** `app/globals.css`, `app/strateji/page.tsx`, `app/optimizasyon/page.tsx`, `app/hedef-kitle/page.tsx`, `app/tasarim/page.tsx`, `app/raporlar/page.tsx`, `app/seo/page.tsx`, `app/entegrasyon/page.tsx`, `components/yoai/hierarchy/AccountAlertsBanner.tsx`, `app/dashboard/reklam/meta/components/MetaTableReal.tsx`

## 2026-05-24 — Çoklu işletme (Faz 0+1): per-account profil & hesap-uyarı scope altyapısı
- **Sorun:** Kullanıcı birden fazla işletme yönetiyor (Meta hesabı = Antso feribot, Google hesabı = Belgemod emlak/inşaat) ama sistem kullanıcı başına TEK işletme profili tutuyordu (`user_business_profiles` UNIQUE(user_id)). Tarama tek profili (Belgemod) tüm kampanyalara uyguladığından, Meta'daki Antso kampanyaları için "Belgemod ile uyumsuz" yanlış hesap-uyarısı üretiliyordu; ayrıca `account_alerts` hesaba göre ayrılamıyordu (account_id sütunu yoktu) → her tarama aynı yanlış uyarıyı yeniden üretiyordu.
- **Çözüm:** **(Faz 0)** Additive migration: `user_business_profiles`'a `business_key`/`meta_account_id`/`google_customer_id`, `user_business_intelligence`'a `business_key`, `account_alerts`'e `account_id`/`business_key` (hepsi NULLABLE; `UNIQUE(user_id)` korundu → sıfır regresyon). **(Faz 1, `YOAI_PER_ACCOUNT_SCOPE` flag arkasında)** Tarama artık seçili işletmenin Meta+Google hesabını + KENDİ profilini kullanır (`getProfileForScope`/`getBusinessContextForScope`); eşleşen profil yoksa profilsiz tarar ve off-brand yanlış uyarısı ÜRETMEZ. `account_alerts` hesap boyutuyla yazılır; `supersedePendingAccountAlerts` yalnız ilgili hesabı süpürür (Antso taraması Belgemod uyarısını silmez); hierarchy endpoint'i `account_id`'ye göre filtreler. Cron, flag açıkken kullanıcının her işletmesi için ayrı scope'lu event fan-out yapar (kapalıyken kullanıcı başına tek legacy event). Meta/Google fetch entegrasyon koduna dokunulmadı (yalnız mevcut `override` parametresi geçildi). `tsc` ✓, `next build` ✓.
- **Dosyalar:** `supabase/migrations/20260524000000_per_account_business_profiles.sql` (yeni), `scripts/apply-per-account-business-profiles-migration.mjs` (yeni), `lib/yoai/businessKey.ts` (yeni), `lib/yoai/businessProfileStore.ts`, `lib/yoai/businessContextStore.ts`, `lib/yoai/ai/scanUser.ts`, `lib/yoai/ai/hierarchicalStore.ts`, `inngest/functions/perCampaignImprovements.ts`, `inngest/functions/yoalgoritmaScan.ts`, `app/api/cron/yoalgoritma-scan/route.ts`, `app/api/yoai/improvements/hierarchy/route.ts`

## 2026-05-24 — Meta & Google Reklam Yöneticisi: metrik sütunları ortalandı
- **Sorun:** Reklam Yöneticisi tablolarında metrik sütunlarının (SONUÇLAR, BÜTÇE, HARCANAN TUTAR, GÖSTERİMLER, TIKLAMALAR, CTR, CPC, ROAS) başlıkları sağa yaslıydı; başlık ile altındaki içerik aynı eksende ortalanmış görünmüyordu.
- **Çözüm:** Hem Meta hem Google tablosunda metrik sütunlarının başlığı (`th`) ve hücre içeriği (`td`) `text-center` yapıldı; bütçe/sonuç hücrelerindeki flex hizalama `justify-end`/`items-end` → `justify-center`/`items-center` çevrildi. İsim (KAMPANYA) ve durum (DURUM/ETKİNLİK) sütunları sola yaslı bırakıldı. `rightAlignKeys` → `centerAlignKeys` olarak yeniden adlandırıldı.
- **Dosyalar:** `app/dashboard/reklam/meta/components/MetaTableReal.tsx`, `app/dashboard/reklam/google/components/GoogleTableReal.tsx`

## 2026-05-23 — Kampanyalar BÜTÇE sütunu: reklam seti bütçesinde "Reklam Seti" etiketi
- **Sorun:** Kampanyalar sekmesinde, bütçesi kampanya seviyesinde olmayan (reklam seti / ABO bütçeli) kampanyalarda BÜTÇE sütunu boş bir "-" gösteriyordu; kullanıcı bütçenin nerede yönetildiğini anlamıyordu.
- **Çözüm:** Kampanya bütçesi yokken "-" yerine "Reklam Seti" etiketi + bilgi tooltip'i ("Bu kampanyada bütçe reklam seti seviyesinden yönetiliyor") gösteriliyor — Reklam Setleri sekmesindeki "Kampanya bütçesi (CBO)" bloğuyla simetrik. EN/TR: `labels.adsetBudget` / `tooltips.adsetBudget` `tr.json`+`en.json`'a eklendi. `tsc` ✓.
- **Dosyalar:** `app/dashboard/reklam/meta/components/MetaTableReal.tsx`, `locales/tr.json`, `locales/en.json`

## 2026-05-23 — Meta Ads "Sonuçlar" kolonu boş görünme düzeltmesi (satış-funnel)
- **Sorun:** Reklam Yöneticisi'nde aktif satış kampanyalarının SONUÇLAR kolonu "—" görünüyordu, oysa Meta Ads Manager 11/120 sonuç gösteriyordu. Canlı veri doğrulaması (geçici debug) ile kök neden bulundu: kod, kampanya hedefi `OUTCOME_SALES` olduğu için `actions` dizisinde yalnızca `purchase`/`omni_purchase` arıyordu; ama bu kampanyalar **ödeme başlatmaya** optimize olduğundan Meta'nın gerçek sonucu `initiate_checkout` (11/120) idi ve `purchase` action'ı hiç dönmüyordu → 0 → "—".
- **Çözüm:** `initiate_checkout` ve `add_to_cart` sonuç türleri eklendi (gerçek veriden doğrulanmış action_type varyantlarıyla). Yeni `withFunnelFallback` mantığı: satışa-optimize bir satırda `purchase` sonucu 0 ise Meta'nın yaptığı gibi conversion funnel'da bir alt adıma (ödeme başlatma → sepete ekleme → form) düşülür — tahmin değil, Meta'nın kendi sonuç hiyerarşisi. Kampanya (`extractObjectiveResults`), reklam seti (`extractGoalResults`) ve reklam (`extractResultsFallback`) seviyelerinin üçü de kapsandı. Riskli `results` Meta alanı **kullanılmadı** (tek-call inline insights'ı bozma riski). EN/TR: `resultTypeInitiateCheckout`/`resultTypeAddToCart` `tr.json`+`en.json`'a eklendi. `tsc` ✓.
- **Dosyalar:** `lib/meta/resultExtraction.ts`, `app/api/meta/campaigns/route.ts`, `app/api/meta/adsets/route.ts`, `app/dashboard/reklam/meta/components/MetaTableReal.tsx`, `locales/tr.json`, `locales/en.json`

## 2026-05-23 — Login gerektirmeyen public Fiyatlandırma sayfası
- **Sorun:** Ana sayfa header'ındaki "Fiyatlandırma" linki `/abonelik`'e gidiyordu; o sayfa `AccountApprovalGuard` ile korunduğu için ziyaretçiyi login ekranına atıyordu. Fiyatlar sadece panele giren kullanıcıya görünüyordu — login olmadan görünmesi gerekiyordu.
- **Çözüm:** Login gerektirmeyen yeni public `/fiyatlandirma` sayfası eklendi (landing teması: koyu emerald, hero + aylık/yıllık toggle + 4 plan kartı + SSS + alt CTA + footer). Planlar mevcut `SUBSCRIPTION_PLANS` + ortak `PlanCard` ile gösterilir (yeni veri tanımı yok). Anonim ziyaretçi plan seçince `/signup`'a, Enterprise'da satış e-postasına yönlenir; gerçek İyzico checkout hâlâ auth arkasındaki `/abonelik`'te kalır. Header linki `/abonelik` → `/fiyatlandirma`. EN/TR: `pricing` namespace `tr.json`+`en.json`'a eklendi, middleware'e `fiyatlandirma ↔ pricing` eşlemesi (EN'de `/en/pricing`). `tsc` ✓, `next build` ✓.
- **Dosyalar:** `app/fiyatlandirma/page.tsx` (yeni), `components/landing/PricingPlans.tsx` (yeni), `components/landing/LandingHeader.tsx`, `middleware.ts`, `locales/tr.json`, `locales/en.json`

## 2026-05-23 — YoAlgoritma Geliştirme Kartları da işletmeye scope edildi (asıl belgemod fix)
- **Sorun:** İşletme seçimi Command Center'ı doğru filtreliyordu (DB kanıtlı) ama kullanıcının asıl baktığı **"Geliştirme Kartları"** hâlâ tüm hesapların kartlarını (örn. belgemod "Çelik Kaynakçı") gösteriyordu. Kök neden: kartlar `GET /api/yoai/improvements/hierarchy` → `getImprovementHierarchy(userId)`'den geliyor; tablo (`campaign_improvements`) `source_platform` + `campaign_id` taşıyor ama **hesap kimliği sütunu yok** ve okuma yalnız `user_id`'ye göreydi → işletmeden bağımsız tüm kartlar dönüyordu.
- **Çözüm:** hierarchy endpoint'i, seçili işletmenin **scope'lu günlük analizindeki kampanya kimliklerine** göre kartları filtreler (`{platform}:{campaignId}` eşleşmesi). Böylece migration/şema değişikliği gerekmeden başka hesabın kartları düşer; aynı platformdaki iki hesap (Metropol vs belgemod, ikisi de Google) bile ayrılır. Eşleşen scope'lu analiz hazır değilse `scopePending` döner (yanlış kart yerine "hazırlanıyor"). Sayfa, Command Center scope'u oturunca `improvementRefreshKey` bump ederek kartları yeniden çeker. `YOAI_PER_ACCOUNT_SCOPE` kapalıyken tüm kartlar (mevcut davranış). `tsc` ✓.
- **Dosyalar:** `app/api/yoai/improvements/hierarchy/route.ts`, `components/yoai/hierarchy/HierarchicalImprovements.tsx`, `app/yoai/page.tsx`

## 2026-05-23 — YoAlgoritma scope-duyarlı client cache (v2) + işletme cookie düzeltmesi
- **Sorun:** (1) İşletme cookie'si Next 15 route handler'da `cookies().set()` ile yazılınca yanıta eklenmiyordu → scope hep boşa düşüyordu. (2) `/yoai` localStorage cache (v1) scope'tan bağımsızdı → işletme değişse de eski (belgemod) snapshot ekranda kalıyordu.
- **Çözüm:** (1) Cookie `res.cookies.set` ile YANIT üzerine yazılır (garantili Set-Cookie). (2) Cache anahtarı v1→v2; snapshot `yoai_business_scope` imzasıyla etiketlenir, yüklemede imza uyuşmazsa gösterilmez → taze fetch. `tsc` ✓.
- **Dosyalar:** `app/api/yoai/business-scope/route.ts`, `lib/yoai/clientCache.ts`, `app/yoai/page.tsx`

## 2026-05-23 — Proje standardı: tüm değişiklikler EN/TR uyumlu zorunlu
- **Sorun:** Kullanıcı, projede yapılan her değişikliğin iki dilde (EN/TR) çalışmasını ve bu kuralın kalıcı kayda geçmesini istedi.
- **Çözüm:** `CLAUDE.md`'ye **"EN/TR İki Dil Uyumu (ZORUNLU)"** bölümü eklendi: kullanıcı-yüzlü hiçbir metin hardcoded olamaz; her yeni anahtar HEM `tr.json` HEM `en.json`'a aynı key path ile eklenir; `next-intl` (`useTranslations`/`getTranslations`), default locale `tr`. Bir iş iki dil dosyası da güncellenmeden bitmiş sayılmaz.
- **Dosyalar:** `CLAUDE.md`

## 2026-05-23 — YoAlgoritma per-account Faz 3.4: İşletme bazlı scope (otomatik isim eşleştirme)
- **Sorun:** YoAlgoritma seçili Meta + seçili Google'ı körlemesine **birleştiriyordu**. Meta "Fikret Petrol" seçiliyken Google hâlâ "belgemod" aktif olduğundan kartlarda belgemod verisi karışıyordu (Faz 3.3b scope kapısı tek başına çözmedi — iki platform bağımsız seçiliyordu).
- **Çözüm:** Kullanıcının kayıtlı Meta + Google hesapları **otomatik isim eşleştirmesiyle** "işletme"lere gruplanır (`groupIntoBusinesses`: Türkçe-duyarlı normalize + TLD/yasal-ek temizliği + içerik eşleşmesi). YoAlgoritma seçici **işletme moduna** geçer; bir işletme seçilince yalnız **o işletmenin** Meta+Google'ı çekilir — eşi olmayan platform (örn. yalnız-Meta işletmesi) için diğer platform hiç çağrılmaz, başka hesabın verisi karışmaz. Seçim `yoai_business_scope` cookie'sinde tutulur; `runDeepAnalysis` opsiyonel scope override ile yalnız o hesapları fetch'ler; command-center / refresh / daily-run scope imzasını tek kaynaktan (`resolveYoaiScope`) hesaplar → uyuşmazlık/gereksiz yeniden-analiz yok. Tümü **`YOAI_PER_ACCOUNT_SCOPE` flag'i arkasında (default KAPALI)** — kapalıyken mevcut birleşik davranış birebir korunur, sıfır regresyon. Yeni UI tamamen EN/TR. `tsc` ✓.
- **Dosyalar:** `lib/account/businessGroups.ts` (yeni), `lib/yoai/businessScope.ts` (yeni), `app/api/yoai/business-scope/route.ts` (yeni), `components/account/BusinessSwitcherDropdown.tsx` (yeni), `components/account/UnifiedAccountSwitcher.tsx`, `lib/yoai/deepAnalysis.ts`, `lib/yoai/metaDeepFetcher.ts`, `lib/yoai/googleDeepFetcher.ts`, `app/api/yoai/command-center/route.ts`, `app/api/yoai/command-center/refresh/route.ts`, `app/api/yoai/daily-run/route.ts`, `app/api/account/registered/route.ts`, `hooks/useRegisteredAccounts.ts`, `locales/tr.json`, `locales/en.json`

## 2026-05-22 — Optimizasyon: TikTok sekmesi "Yakında" (devre dışı) + Meta Genel Bakış'tan tekrar eden Ana Metrik kaldırıldı
- **Sorun:** (1) TikTok kaynak sekmesi tıklanabilirdi ama henüz tam hazır değildi. (2) Meta detay panelinde **Genel Bakış** sekmesindeki "Ana Metrik" bloğu (örn. Tıklama) ile **Metrikler** sekmesindeki aynı metrik tekrar ediyordu.
- **Çözüm:** (1) `OptimizasyonPage` kaynak seçicisinde TikTok sekmesi `disabled` + gri "Yakında" rozetiyle işaretlendi (onaylı palet, amber yok); `?platform=tiktok` derin linki de artık TikTok'u zorla açmaz. (2) `DetailPanel` Genel Bakış sekmesinden tekrar eden North Star (Ana Metrik) `KpiDisplay` kaldırıldı — aynı metrik Metrikler sekmesinde duruyor. `tsc` ✓.
- **Dosyalar:** `app/optimizasyon/page.tsx`, `components/optimization/DetailPanel.tsx`

## 2026-05-22 — Düzeltme: Per-account — damgasız (eski) analizler de yeniden üretilir
- **Sorun:** `YOAI_PER_ACCOUNT_SCOPE` açıkken YoAlgoritma'da hesap değiştirince veri değişmiyordu — mevcut günlük analizler flag öncesi üretildiği için `account_scope=null`'dı; kapı null'ı "geriye-uyum" sayıp eski (birleşik) veriyi gösteriyordu.
- **Çözüm:** Kapı artık null damgayı da "uyuşmazlık" sayar → o hesap için `/refresh` ile yeniden üretir + damgalar (ilk yüklemede bir kez; sonra eşleşir). `/refresh` damgayı **cookie** (anlık) seçiminden verir; command-center kapısı da cookie okuduğu için DB fire-and-forget gecikmesi kaynaklı yanlış uyuşmazlık olmaz. `tsc` ✓.
- **Dosyalar:** `app/api/yoai/command-center/route.ts`, `app/api/yoai/command-center/refresh/route.ts`

## 2026-05-22 — Çoklu Reklam Hesabı Faz 3.3b: YoAlgoritma per-account analiz (belgemod fix, flag arkasında)
- **Sorun:** YoAlgoritma command-center, kullanıcının seçili Meta+Google hesaplarının birleşik günlük analizini (per-user, günde 1) gösteriyordu; başka hesaba geçince hâlâ önceki seçimin verisi görünüyordu (belgemod).
- **Çözüm:** `yoai_daily_runs.account_scope` (aktif seçim imzası) eklendi; tamamlanan analiz `upsertDailyRun`'da DB seçiminden otomatik damgalanır (cron/POST/inngest tek noktadan, pipeline'a dağıtık dokunuş yok). command-center, çalışmanın imzası aktif seçimle eşleşmezse `scope_mismatch` döner; YoAlgoritma sayfası yeni `/api/yoai/command-center/refresh` ile o hesap için analizi yeniden üretip gösterir (AI engine açıkken bootstrap command_center_data üretmediği için gerekli). Hepsi **`YOAI_PER_ACCOUNT_SCOPE` flag'i arkasında (default KAPALI)** — kapalıyken mevcut per-user davranış birebir korunur, sıfır regresyon. `tsc` ✓.
- **Dosyalar:** `lib/yoai/dailyRunStore.ts`, `app/api/yoai/command-center/route.ts`, `app/api/yoai/command-center/refresh/route.ts` (yeni), `app/yoai/page.tsx`, `lib/yoai/featureFlag.ts`

## 2026-05-22 — Çoklu Reklam Hesabı Faz 3.3a: YoAlgoritma'ya birleşik seçici
- **Sorun:** YoAlgoritma özel header (Topbar değil) kullandığı için hesap seçici hiç yoktu.
- **Çözüm:** Kendi kendine yeten `UnifiedAccountSwitcher` (tetikleyici buton + birleşik dropdown + veri çekimi tek bileşende) `YoAlgoritmaHeader`'a eklendi. Flag kapalıyken render etmez. Switcher ile hesap değiştirme global aktif hesabı değiştirir (tüm modülleri etkiler). **NOT:** YoAlgoritma'nın KENDİ command-center verisinin aktif hesaba göre değişmesi (belgemod fix) Faz 3.3b'de — `account_scope` migration gerektirir. `tsc` ✓.
- **Dosyalar:** `components/account/UnifiedAccountSwitcher.tsx` (yeni), `components/yoai/YoAlgoritmaHeader.tsx`

## 2026-05-22 — Düzeltme: Seçici butonu aktif platformun hesabını gösterir (Google sekmesi)
- **Sorun:** Hedef Kitle/Optimizasyon'da Google sekmesindeyken üstteki seçici butonu hâlâ aktif **Meta** hesabını (örn. "Fikret Petrol") gösteriyordu; aktif Google hesabı görünmüyordu.
- **Çözüm:** Sayfa, aktif platforma göre doğru hesap adını Topbar'a veriyor: Meta sekmesi → Meta hesabı, Google sekmesi → aktif Google hesabı (`/api/integrations/google-ads/selected`'tan çekilir). Dropdown açılınca her iki bölüm + doğru vurgular zaten görünüyordu; bu yalnız buton etiketini düzeltir. `tsc` ✓.
- **Dosyalar:** `app/hedef-kitle/page.tsx`, `app/optimizasyon/page.tsx`

## 2026-05-22 — Çoklu Reklam Hesabı Faz 3.2: Hedef Kitle'ye birleşik seçici
- **Sorun:** Hedef Kitle'de hesap seçici görünmüyordu.
- **Çözüm:** Hedef Kitle `/api/meta/status`'tan aktif Meta hesabını çekip Topbar'a `adAccountName` geçiriyor → birleşik seçici (Meta + Google) görünür. `?platform` okunup `PlatformTabs` sekmesi ayarlanır (Google seçince Hedef Kitle'de kalıp Google sekmesi açılır — Optimizasyon ile aynı). `tsc` ✓.
- **Dosyalar:** `app/hedef-kitle/page.tsx`

## 2026-05-22 — Düzeltme: Yalnız-Meta modüllerde (Strateji) Google hesapları gizlenir
- **Sorun:** Strateji yalnız Meta reklam hesabı altında strateji oluşturur (Google-hesap kavramı yok), ama birleşik dropdown Google hesaplarını da gösteriyor ve seçilince `/google-ads`'e yönlendiriyordu (istenmeyen). Ayrıca rozet toplam (9) gösterip yalnız Meta listeliyordu.
- **Çözüm:** Dropdown artık modülün platformuna göre kapsamlı: `/strateji` ve `/meta-ads` yalnız-Meta → Google bölümü + "Google hesabı ekle" gizlenir; rozet o sayfada görünen hesap sayısını gösterir. `/optimizasyon`, `/hedef-kitle`, `/yoai` (iki platformu da kullanan) hepsini gösterir. Böylece Strateji'de Google seçimi/yönlendirmesi olmaz. `tsc` ✓.
- **Dosyalar:** `components/account/MultiAccountDropdown.tsx`

## 2026-05-22 — Düzeltme: Birleşik seçici bağlam-duyarlı (sekmeli modülde sekmeyi aç, çıkma)
- **Sorun:** Optimizasyon (Meta/Google/TikTok sekmeli) birleşik dropdown'ında Google hesabı seçilince `/google-ads`'e atıyor, modülden çıkarıyordu. Doğrusu: Optimizasyon'da kal + Google sekmesini aç.
- **Çözüm:** Hesap seçimi artık bağlam-duyarlı (`navigateAfterSwitch`): çok-platformlu modülde (`/optimizasyon`, `/hedef-kitle`) aynı sayfa + `?platform=X` (ilgili sekme açılır, modülden çıkılmaz); `/yoai` reload; sadece-Meta modülde (Strateji/Meta sayfası) Meta → reload, Google → `/google-ads`. Optimizasyon `?platform` okuyup `source` sekmesini ayarlar. Meta seçimi de aynı mantıkla yönlendirir (stale `?platform` sorunu olmaz). `tsc` ✓.
- **Dosyalar:** `components/account/MultiAccountDropdown.tsx`, `app/optimizasyon/page.tsx`, `components/Topbar.tsx`

## 2026-05-22 — Düzeltme: Birleşik seçicide Google hesabı seçince Google sayfasına git
- **Sorun:** Strateji/Optimizasyon (Meta verisi gösteren sayfalar) birleşik dropdown'ında bir Google hesabı seçilince sayfa reload oluyor ve hâlâ aktif Meta hesabını gösteriyordu (örn. Metropol seçilince Elysium Garden görünüyordu) — "yanlış hesap açıldı" izlenimi.
- **Çözüm:** Google hesabı seçilince mevcut Meta sayfasını reload etmek yerine `/google-ads`'e yönlendirilir; o Google hesabının verisi orada görünür. Meta seçimi olduğu gibi kalır (Meta sayfası zaten Meta'yı gösterir). YoAlgoritma cache de temizlenir. `tsc` ✓.
- **Dosyalar:** `components/account/MultiAccountDropdown.tsx`

## 2026-05-22 — Çoklu Reklam Hesabı Faz 3: Birleşik hesap seçici (Meta + Google)
- **Sorun:** Strateji/Optimizasyon'daki hesap seçici yalnız Meta hesaplarını listeliyordu; kayıtlı Google hesapları (toplam 9'un bir kısmı) görünmüyordu. Kullanıcı tüm hesapların tek filtrede görünmesini istedi (birleşik model).
- **Çözüm:** `MultiAccountDropdown` birleşik hale getirildi — "Meta Hesapları" + "Google Hesapları" bölümleri tüm kayıtlı hesapları listeler. Bir hesabı seçince o platformun aktif hesabı olur (Meta → select-adaccount, Google → select-account) + reload ile veri bağlanır. Google ekleme hiyerarşik olduğundan Google sayfasına yönlendirir; Meta ekleme inline. Aktif Google `/selected`'tan çekilip vurgulanır + ismi zenginleşir. Toplam limit rozeti artık listeyle tutarlı. `tsc` ✓.
- **Not:** Hedef Kitle + YoAlgoritma'da seçici görünürlüğü ve YoAlgoritma per-account sonraki adımlarda.
- **Dosyalar:** `components/account/MultiAccountDropdown.tsx`, `locales/tr.json`, `locales/en.json`

## 2026-05-22 — Çoklu Reklam Hesabı Faz 3.1: Strateji'ye hesap seçici
- **Sorun:** Reklam hesabı seçici yalnızca Optimizasyon'da görünüyordu; Strateji'de yoktu.
- **Çözüm:** Strateji `/api/meta/status`'tan aktif Meta hesabını çekip Topbar'a `adAccountName` geçiriyor → Meta çoklu-hesap seçici görünür (Optimizasyon ile aynı desen). Strateji instances zaten `ad_account_id`'ye bağlı; geçiş reload → yeni hesabın verisine bağlanır. `tsc` ✓.
- **Dosyalar:** `app/strateji/page.tsx`

## 2026-05-22 — Düzeltme: Google modalında kayıtlı hesaplar "Hesap Ekle"de görünmesin
- **Sorun:** Kayıtlı (KAYITLI HESAPLAR) Google hesapları, alttaki "Hesap Ekle" listesinde de görünüyordu (örn. Metropol Yayınları iki yerde).
- **Çözüm:** Browse listesi (managers + children) zaten kayıtlı hesapları filtreler; yöneticiler (derinleşmek için) kalır. Hepsi kayıtlıysa "Eklenecek başka hesap yok" gösterilir. (Meta dropdown'ında bu zaten vardı.) `tsc` ✓.
- **Dosyalar:** `components/google/GoogleAccountModal.tsx`

## 2026-05-22 — Düzeltme: Google çoklu-hesap modalı (ad görünmüyor + busy görseli)
- **Sorun:** (1) Kayıtlı Google hesabında ad yerine ID görünüyordu (backfill edilen hesap isim taşımıyor). (2) Bir hesap "Seçiliyor..." iken altındaki tüm "Seç" butonları soluklaşıp işaretlenmiş gibi görünüyordu.
- **Çözüm:** (1) Modalda isim zenginleştirme: aktif hesabın adı (`activeCustomerName`) + managers/children listelerinden ad çözülür; kayıt isim taşımıyorsa bunlardan gösterilir (connection store/backfill'e dokunulmadı). (2) `disabled:opacity-50` global solma kaldırıldı; yalnız tıklanan buton `bg-primary/60` + "Seçiliyor..." gösterir (`isPicking` helper), diğerleri değişmez. `tsc` ✓.
- **Dosyalar:** `components/google/GoogleAccountModal.tsx`, `app/dashboard/reklam/google/GooglePage.tsx`

## 2026-05-22 — Çoklu Reklam Hesabı Faz 2.2b: Google çoklu-hesap modalı (flag arkasında)
- **Sorun:** Google sayfasındaki hesap modalı tek-seçimdi; Meta'daki gibi birden fazla hesap kaydetme + aralarında geçiş + limit (toplam Meta+Google) yoktu.
- **Çözüm:** `GoogleAccountModal` geliştirildi (flag açıkken): üstte **"Kayıtlı Hesaplar (X/Y)"** bölümü (geçiş = mevcut `select-account` endpoint + reload; çıkar), browse listesinde **"seçince kaydet"** akışı (yöneticide derinleş, hesapta önce `addAccount` ile kaydet → limit kontrol → sonra mevcut select). Limit dolunca **AccessRequiredModal** (`ad_account_slot`, dismissible). Limit toplam (Meta+Google) `/api/account/registered` üzerinden. **Hook/entegrasyon mantığına dokunulmadı** (mevcut handler'lar + endpoint çağrıldı). Bonus: modaldaki yasak amber yönetici rozeti `primary`'ye çekildi. Flag kapalıyken modal birebir eski davranış. `tsc` ✓.
- **Dosyalar:** `components/google/GoogleAccountModal.tsx`, `app/dashboard/reklam/google/GooglePage.tsx`

## 2026-05-22 — Çoklu Reklam Hesabı Faz 2.2: Meta switcher UI + limit modal (flag arkasında)
- **Sorun:** Kullanıcı Topbar'dan tek hesap seçebiliyordu; plan limitine kadar birden fazla hesap kaydedip aralarında geçiş yapabilmeli, limit dolunca premium upsell görmeli.
- **Çözüm:** `useRegisteredAccounts` hook'u (`/api/account/registered` ile konuşur) + `MultiAccountDropdown` bileşeni (kayıtlı hesaplar arası geçiş + "Hesap Ekle" + "X/Y hesap" göstergesi + çıkar). Topbar Meta dropdown'ı `reg.enabled` ise yeni bileşeni render eder; **flag kapalıyken bugünkü tek-hesap UI birebir korunur**. Limit dolunca `AccessRequiredModal` (`featureKey="ad_account_slot"`). Geçiş mevcut `handleSelectAccount` (select-adaccount + reload) ile yapılır — **Meta seçim route'una dokunulmadı**. `AccessRequiredModal`'a opsiyonel `dismissible`/`onClose` eklendi (additive; alan erişim bariyerlerinde default katı davranış aynen) çünkü hesap-ekleme soft limiti kullanıcıyı hapsetmemeli. Yeni i18n anahtarları (tr+en). `tsc` ✓.
- **Not:** Google çoklu-seçim + /entegrasyon yönetim görünümü Faz 2.2b'de.
- **Dosyalar:** `hooks/useRegisteredAccounts.ts` (yeni), `components/account/MultiAccountDropdown.tsx` (yeni), `components/Topbar.tsx`, `components/billing/AccessRequiredModal.tsx`, `lib/billing/featureAccessMap.ts`, `locales/tr.json`, `locales/en.json`

## 2026-05-22 — Çoklu Reklam Hesabı Faz 2.1: Kayıt API + limit gate (default-off flag)
- **Sorun:** Faz 2.0 veri modeli vardı ama kayıt/limit zorlamasını yapan bir uç nokta yoktu; ayrıca özellik canlıya açılmadan önce mevcut davranışı etkilememeli.
- **Çözüm:** `GET/POST/DELETE /api/account/registered` — kayıtlı hesapları listeler (limit + kalan), ekler (plan limitini zorlar → `limit_reached` 403, UI AccessRequiredModal için yapısal yanıt), çıkarır. Limit gate yalnız burada; Meta/Google **seçim route'larına dokunulmadı** (UI "önce kaydet → sonra seç" akışıyla çağıracak). `MULTI_ACCOUNT_ENABLED` flag'i **default kapalı** — kapalıyken GET `enabled:false`, POST/DELETE `feature_disabled` döner, hiçbir prod davranışı değişmez. `ensureBackfilled`: set boşsa mevcut seçili Meta+Google hesabını seed eder (geriye uyum, idempotent). Owner sınırsız. `tsc` ✓.
- **Dosyalar:** `app/api/account/registered/route.ts` (yeni), `lib/account/registeredAccounts.ts` (`isMultiAccountEnabled` + `ensureBackfilled`)

## 2026-05-22 — Çoklu Reklam Hesabı Faz 2.0: Kayıt veri modeli + limit kaynağı (backend temel)
- **Sorun:** Kullanıcı tek reklam hesabı seçebiliyordu; plan limitine kadar birden fazla hesap kaydedip aralarında geçiş yapabilmeli (faturalama toplam adede göre). Bunun için önce kayıt veri modeli + limit çözümleyici gerekiyordu.
- **Çözüm:** Additive `user_registered_ad_accounts` tablosu (kullanıcı başına platform+hesap, `UNIQUE(user_id,platform,account_id)`) — mevcut tablolara/davranışa dokunmaz. `lib/account/registeredAccounts.ts`: `list/add/remove/count/isRegistered` + `resolveAccountLimit(userId)` (limit = `subscriptions.ad_accounts` TOPLAM; owner = sınırsız, paylaşılan `isSuperAdminEmail` allowlist). `addRegisteredAccount` plan limitini zorlar (`limit_reached`), zaten kayıtlıysa slot tüketmez. Aktif hesap hâlâ `meta_connections`/`google_ads_connections`'ta; bu tablo geçiş için izinli kümedir. Migration + idempotent apply-script (`npm run db:migrate:registered-accounts`). Hiçbir akış henüz çağırmıyor → sıfır davranış değişikliği; Meta/Google entegrasyonuna dokunulmadı. `tsc` ✓.
- **Dosyalar:** `supabase/migrations/20260522010000_create_user_registered_ad_accounts.sql` (yeni), `lib/account/registeredAccounts.ts` (yeni), `scripts/apply-registered-accounts-migration.mjs` (yeni), `package.json`

## 2026-05-22 — YoAlgoritma: Hesap değişiminde bayat client cache temizliği (Madde 1 ön hazırlık)
- **Sorun:** Aktif reklam hesabı değiştiğinde YoAlgoritma'nın `localStorage`/`sessionStorage` snapshot'ı önceki hesaba aitti ve sayfa yenilemede eski hesabın kartları kısa süre "yanıp sönüyordu". (Optimizasyon, Strateji, Hedef Kitle zaten sunucuda `ad_account_id`'ye göre filtreli/önbellekli olduğu için hesap değişiminde doğru yeniden bağlanıyor — onlarda değişiklik gerekmedi.)
- **Çözüm:** Cache anahtarlarını ve geçersiz kılmayı tek kaynakta toplayan `lib/yoai/clientCache.ts` (`clearYoAlgoritmaClientCache()`, SSR-güvenli). Meta hesap geçişinde (`Topbar.handleSelectAccount`) `window.location.reload()` öncesi çağrılıyor; YoAlgoritma sayfası anahtarları artık bu modülden alıyor (drift yok). Tarama pipeline'ına ve şemaya dokunulmadı. `tsc` ✓.
- **Not:** YoAlgoritma'nın aktif-hesaba göre sunucu tarafı analizi (`yoai_daily_runs` Meta+Google birleşik toplam, `UNIQUE(user_id,run_date)`) çoklu-hesap tarama orkestrasyonu gerektirdiğinden Madde 2 kapsamında ele alınacak.
- **Dosyalar:** `lib/yoai/clientCache.ts` (yeni), `components/Topbar.tsx`, `app/yoai/page.tsx`

## 2026-05-22 — Abonelik: Bağımsız reklam hesabı sayaçları + Enterprise (7+) seçilebilir
- **Sorun:** Abonelik sayfasında (1) tek bir `adAccountCount` state'i 4 plan kartına birden veriliyordu → bir kartın reklam hesabı sayacını değiştirince diğer tüm kartlar (ve hem Aylık hem Yıllık görünüm) eş zamanlı değişiyordu; (2) Basic/Starter/Premium sayaçlarının üst sınırı yoktu (2→10); (3) Enterprise kartı hiç seçilemiyordu (`if (planId === 'enterprise') return` + sunucu katalogundan hariç) ve sayacı 6'da kilitliydi.
- **Çözüm:** (1) Sayaç state'i plan başına bağımsız bir haritaya çevrildi (`Record<planId, number>`); her kart kendi sayısıyla fiyatını ayrı hesaplar, kartlar artık birbirini etkilemez. (2) Sınırlar `plans.ts`'de sabit olarak tanımlandı: self-servis planlar 2→6, 6'da `+` kapanır ve "7+ hesap için Enterprise" ipucu çıkar (eşit kart yüksekliği için rezerve slot). (3) Enterprise sayacı 7'den başlar (7→50, aktif +/-), kart "İletişime Geç" ile gerçek satış adresine (`info@yodijital.com`) seçili hesap sayısını içeren ön-doldurulmuş `mailto` açar — self-servis ödeme almaz, sunucu katalogu değişmedi. Ayrıca bu dosyadaki yasak amber renkler (deneme rozeti/not) onaylı palete (primary) çekildi. `tsc` ✓.
- **Dosyalar:** `app/abonelik/page.tsx`, `components/subscription/PlanCard.tsx`, `lib/subscription/plans.ts`, `locales/tr.json`, `locales/en.json`

## 2026-05-22 — Düzeltme: Google tarama dropdown'ı kesiliyordu + Hedef Kitle'de ham boyut enum'u
- **Sorun:** (1) Google optimizasyon kartında dropdown menü kartın `overflow-hidden` container'ı yüzünden kesiliyordu (yarısı görünmüyordu) ve Meta kartıyla görsel olarak eşleşmiyordu — Meta kartında `overflow-hidden` yok. (2) Hedef Kitle > Google'da kullanıcı listelerinin **Boyut** alanı ham Google enum'u olarak gösteriliyordu (`ONE_THOUSAND_TO_TEN_THOUSAND`, `LESS_THAN_FIVE_HUNDRED`) — ham teknik terim yasağı ihlali.
- **Çözüm:** (1) `GoogleCampaignCard` container'ından `overflow-hidden` kaldırıldı, Meta `CampaignCard` ile birebir aynı class'a getirildi (`relative … transition-shadow hover:shadow-md`); dropdown artık tam görünür. Tarama animasyonu (`ScanOverlay`) köşelerden taşmaz çünkü overlay kendi içinde `rounded-2xl overflow-hidden` yapar. (2) `GoogleAudienceView`'a `SIZE_RANGE_LABELS` haritası + `sizeRangeLabel()` helper eklendi; tüm Google `UserListSizeRange` enum'ları sade TR aralığa çevrilir ("1.000 – 10.000", "500'den az" …). Bilinmeyen/UNKNOWN değerlerde boş döner — ham enum hiç görünmez. `tsc` ✓.
- **Dosyalar:** `components/optimization/GoogleCampaignCard.tsx`, `components/hedef-kitle/google/GoogleAudienceView.tsx`

## 2026-05-22 — Optimizasyon: Google "Sihirli Tarama" butonu/dropdown/animasyonu Meta ile birebir
- **Sorun:** Google sekmesindeki tarama butonu Meta'dan farklıydı — "Tara" + Sparkles ikonu (Meta'da "Sihirli Tarama" + 🪄), dropdown sadeydi (PRO rozeti ve açıklama yok), ve tarama tetiklenince Meta'daki sweep-line + faz etiketli `ScanOverlay` animasyonu Google'da hiç çıkmıyordu (yalnız buton spinner'ı vardı).
- **Çözüm:** `GoogleCampaignCard` tarama butonu/dropdown'ı Meta `CampaignCard` ile **birebir** eşitlendi: aynı yeşil buton stili + 🪄 emoji + "Sihirli Tarama" etiketi, aynı `w-52` dropdown (Hızlı Tara = Zap + "Kural tabanlı analiz" açıklaması; AI ile Tara = Sparkles + **PRO** rozeti + açıklama), tüm metinler `t('magicScan.*')` çeviri anahtarlarından. Tarama tetiklenince Meta'daki `ScanOverlay` (yeşil sweep-line + dönen faz etiketleri) Google kartında da gösterilir; `page.tsx`'e `extScanPhase` faz döngüsü (800ms/4 faz) eklendi. Entegrasyon/API mantığı (`handleExtScan` fetch akışı, score/apply endpoint'leri) değiştirilmedi — yalnız UI/animasyon paritesi. `tsc` ✓.
- **Dosyalar:** `components/optimization/GoogleCampaignCard.tsx`, `app/optimizasyon/page.tsx`

## 2026-05-22 — Optimizasyon: Google + TikTok'u Meta seviyesine çıkar (4 kapılı skor + detay paneli)
- **Sorun:** Meta'da zengin detay (4 kapılı skor kırılımı + detay paneli) varken Google/TikTok yalnız sade kart gösteriyordu — üç platform aynı deneyimi sunmuyordu.
- **Çözüm:** Google ve TikTok'a da Meta'nın derinliği eklendi: (1) Yeni `lib/google/optimization/gates.ts` → `computeGates(metrics, currency)` 4 kapı (Teslimat %40 / Verim %30 / Kalite %15 / Doygunluk %15) hesaplar; skor artık Meta'yla **aynı gate-ağırlıklı metodoloji**. Sıralama/sıklık verisi olmayan kapılar "veri yok" notuyla işaretlenir, ceza verilmez (sahte veri yok). (2) `GoogleDetailPanel` (Meta DetailPanel muadili) — 4 kapı bar'ı + tüm metrikler + kanal/teklif/bütçe + sorunlar + ad grupları; Google ve TikTok için ortak. (3) Google score route + TikTok score katmanı `computeGates` kullanıyor; `GoogleOptimizationCampaign.gates` eklendi. (4) `GoogleCampaignCard` sadeleştirildi (inline detay → panele taşındı); sayfada kart genişletilince detay paneli, tarama yapılınca öneri paneli gösterilir (Meta deseni). Renkler onaylı palet (pass=emerald, warn=gri, fail=kırmızı). Meta yolu değişmedi. `tsc` ✓.
- **Sonuç:** Meta / Google / TikTok artık **aynı derinlikte** (skor + 4 kapı kırılımı + detay paneli + tarama + canlı apply).
- **Dosyalar:** `lib/google/optimization/gates.ts` (yeni), `lib/google/optimization/types.ts`, `app/api/google/optimization/score/route.ts`, `lib/tiktok/optimization/score.ts`, `components/optimization/GoogleDetailPanel.tsx` (yeni), `components/optimization/GoogleCampaignCard.tsx`, `app/optimizasyon/page.tsx`

## 2026-05-22 — Optimizasyon: TikTok kanadı + 4 düzeltme (#3 #4 #5 #6)
- **Sorun:** Optimizasyon kritik incelemesinde 4 açık kaldı: (#3) sadece Meta+Google, TikTok yok; (#4) Meta score route'ta para birimi sabit `'TRY'` (USD/EUR hesaplarda yanlış); (#5) `ScoreBadge` "orta" skoru amber `#F59E0B` + "zayıf" turuncu (renk kuralı ihlali); (#6) ad set sayfalama 5 sayfa ile sınırlı (büyük hesaplarda eksik).
- **Çözüm:** **(#3 TikTok — tam modül, Google deseniyle):** mevcut TikTok read altyapısı (`/campaign/get/` + `/report/integrated/get/`) ile gerçek metrikler çekilir, Google rule engine (platformdan bağımsız) ile skorlanır → `GET /api/tiktok/optimization/score`; öneriler `POST /api/tiktok/optimization/magic-scan` (ortak recommender + ortak AI scan kotası); tek-tık canlı apply/rollback `POST /api/tiktok/optimization/apply` (mevcut `/campaign/status/update/` + `/campaign/update/` mutate'leri). UI: Optimizasyon sayfasına **Meta/Google/TikTok 3'lü kaynak seçici**; Google kartları/sonuçları platformdan bağımsız hale getirilip yeniden kullanıldı (`GoogleScanResults` artık `applyEndpoint` prop'lu — yanlış platforma apply önlendi). ROAS TikTok'ta gelir verisi olmadığı için null (uydurulmaz). **(#4):** Meta score route hesabın gerçek para birimini (`account.currency`) çekiyor. **(#5):** ScoreBadge amber/turuncu → gri/kırmızı (onaylı palet). **(#6):** ad set sayfalama 5 → 15. Meta/Google/TikTok entegrasyon (mutate) koduna dokunulmadı — yalnız mevcut helper'lar çağrıldı. `tsc` ✓.
- **Dosyalar:** `lib/tiktok/optimization/score.ts` (yeni), `app/api/tiktok/optimization/{score,magic-scan,apply}/route.ts` (yeni), `components/optimization/{ScoreBadge,GoogleScanResults}.tsx`, `app/optimizasyon/page.tsx`, `app/api/meta/optimization/score/route.ts`

## 2026-05-22 — Hedef Kitle: Google sekmesi açıldı (salt-okunur gerçek veri) + BI bandı kaldırıldı
- **Sorun:** (A) Hedef Kitle yalnız Meta'yı destekliyordu; Google "Yakında" rozetiyle kapalıydı. (B) Sayfa üstünde teknik iç jargon olan "Business Intelligence Memory bağlı" bandı kullanıcıya gösteriliyordu.
- **Çözüm:** (A) Google sekmesi aktifleştirildi ve **salt-okunur gerçek veri** görünümü eklendi — Google'da Meta gibi kayıtlı kitle nesnesi (Detaylı/Benzer/Retargeting) sistemi olmadığı için sahte oluşturma akışı sunulmadı. **Detaylı Kitle** = Google segment kataloğu (Satın Alma Niyeti/İlgi Alanı/Demografi/Yaşam Olayı, arama+gözat); **Retargeting** = hesabın gerçek user list'leri (boyut/üyelik/uygunluk). **Benzer Kitle** (Google 2023'te kaldırdı) ve **AI Tabanlı** (Strateji→Meta) sekmeleri Google'da gizlendi; Google'da "+ Yeni Kitle" yok. Mevcut read endpoint'leri kullanıldı, **entegrasyon koduna dokunulmadı**, DB migration yapılmadı. Google bağlı değilse zarif "bağlı değil" durumu. (B) BI bandı UI'dan kaldırıldı; arkasındaki business-context sihirbaz ön-doldurmasında çalışmaya devam ediyor, gereksiz fetch temizlendi. `tsc` ✓.
- **Dosyalar:** `components/hedef-kitle/google/GoogleAudienceView.tsx` (yeni), `components/hedef-kitle/PlatformTabs.tsx`, `app/hedef-kitle/page.tsx`, `docs/hedef-kitle-ve-optimizasyon.md` (yeni)

## 2026-05-22 — Optimizasyon: Google Ads kanadı Faz 2 (tek-tık canlı apply + rollback)
- **Sorun:** Google önerileri Faz 1'de yalnız advisory'di — kullanıcı tek tıkla uygulayamıyordu.
- **Çözüm:** Mevcut Google mutate helper'ları (`updateCampaignStatus`/`updateCampaignBudget`) ile canlı apply: (1) recommender net kararlara `changeSet` ekliyor — NEGATIVE_ROAS → kampanya duraklat, LOW_ROAS/HIGH_CPA → günlük bütçe %20 kıs (hepsi REVIEW_REQUIRED, açık onay; AUTO_APPLY yok). (2) `POST /api/google/optimization/apply` → status için resourceName türetir, bütçe için budget resourceName'i GAQL ile çözer, mutate eder. (3) `GoogleScanResults` "Uygula" + uygulandıktan sonra "Geri Al" (rollback = ters newValue). Apply sonrası sayfa Google verisini tazeler. Entegrasyon koduna dokunulmadı (helper'lar yalnız çağrıldı). `tsc` ✓.
- **Açık (Faz 3):** Google-only kullanıcı için sayfa girişi (şu an Meta bağlantı kapısına bağlı).
- **Dosyalar:** `app/api/google/optimization/apply/route.ts` (yeni), `lib/google/optimization/recommender.ts`, `components/optimization/GoogleScanResults.tsx`, `app/optimizasyon/page.tsx`

## 2026-05-22 — Optimizasyon: Google Ads kanadı Faz 1 (score + tarama + UI)
- **Sorun:** Optimizasyon modülü en baştan beri yalnız Meta'yı kapsıyordu — Google Ads veren markalar hesaplarını skorlayamıyor/öneri alamıyordu.
- **Çözüm:** Meta'dan ayrı, paralel bir Google motoru eklendi (mevcut Google read/mutate helper'ları kullanıldı, entegrasyon koduna dokunulmadı): (1) `GET /api/google/optimization/score` → `fetchGoogleDeep` ile gerçek GAQL insights → kampanya skoru + Meta-format ProblemTag + riskLevel. (2) `POST /api/google/optimization/magic-scan` → `lib/google/optimization/recommender` (deterministik şablon + Claude); AI taraması Meta ile **aynı sunucu-otoriter günlük kotayı** (`consume_ai_scan`) tüketir, aşımda 402. (3) UI: Optimizasyon sayfasına **Meta/Google kaynak seçici** + `GoogleCampaignCard` (skor, kanal türü, teklif stratejisi, opt. skoru, metrikler, sorunlar) + `GoogleScanResults` (advisory öneriler). Meta yolu hiç değişmedi. Sahte veri yok (Google bağlı değilse 401 + "Entegrasyon" yönlendirmesi). `tsc` ✓.
- **Faz notu:** Faz 1 öneriler **advisory** (tek-tık canlı apply Faz 2'de — Google mutate helper'ları hazır). Google-only kullanıcı için sayfa girişi (Meta bağlantı kapısı) Faz 2'de gevşetilecek.
- **Dosyalar:** `app/api/google/optimization/score/route.ts` (yeni), `app/api/google/optimization/magic-scan/route.ts` (yeni), `lib/google/optimization/recommender.ts` (yeni), `lib/google/optimization/types.ts` (yeni), `components/optimization/GoogleCampaignCard.tsx` (yeni), `components/optimization/GoogleScanResults.tsx` (yeni), `app/optimizasyon/page.tsx`

## 2026-05-22 — Optimizasyon: AI motoru Claude'a + günlük scan limiti sunucuya (otoriter)
- **Sorun:** (A) Optimizasyon "AI ile Tara" motoru OpenAI `gpt-4o-mini` kullanıyordu (proje standardı Claude'a aykırı). (B) Günlük AI scan limiti yalnız **client-side localStorage**'da tutuluyordu (`SubscriptionProvider` + `lib/subscription/storage.ts`) → teknik kullanıcı `/api/meta/optimization/magic-scan` çağrısıyla limiti bypass edip ücretli AI çağrısı yaptırabiliyordu (kaynak/gelir sızıntısı).
- **Çözüm:** (A) `aiRecommender.ts` `generateWithAI` Claude'a taşındı (`getAnthropicClient` + `getAiEngineModel`, prompt-cache'li system bloğu, 10s timeout); gate `isAnthropicReady()`; deterministik rule-engine fallback korundu. (B) Yeni `ai_scan_usage` tablosu + atomik `consume_ai_scan` RPC (`spend_credits` deseni): günlük ücretsiz kota sunucuda sayılır, dolunca `COST_PER_AI_SCAN`=5 kredi atomik düşer (yarış-güvenli `UPDATE...WHERE balance>=cost`), yetersizse izin verilmez. `magic-scan` route'u `useAI` + Claude hazırsa kotayı tüketir; reddedilirse **402 `AI_SCAN_LIMIT`** döner, client kredi modalını açar. Yeni kullanıcı için `getCreditBalance` ile 100-hoşgeldin satırı garanti edilir. Meta entegrasyonuna ve apply/rollback yoluna dokunulmadı. `tsc` ✓.
- **Migration (ZORUNLU, deploy'dan ÖNCE):** `npm run db:migrate:aiscan` (omddq) — `consume_ai_scan` RPC uygulanmadan kod deploy edilirse "AI ile Tara" 402/500'e düşer (güvenli tarafta kalır, bedava AI çağrısı YAPTIRMAZ).
- **Env notu:** Optimizasyon AI artık `ANTHROPIC_API_KEY` (mevcut) kullanır; `OPENAI_*` Optimizasyon için gereksiz.
- **Dosyalar:** `lib/meta/optimization/aiRecommender.ts`, `app/api/meta/optimization/magic-scan/route.ts`, `lib/billing/aiScanUsage.ts` (yeni), `lib/subscription/types.ts`, `app/optimizasyon/page.tsx`, `supabase/migrations/20260522000000_ai_scan_usage.sql` (yeni), `scripts/apply-ai-scan-usage-migration.mjs` (yeni), `package.json`, `docs/strateji-ve-optimizasyon.md`

## 2026-05-22 — Strateji modülü: 6 iyileştirme (Claude motoru + haftalık cron + çok-kanal + marka bağlamı + KPI + YoAlgoritma köprüsü)
- **Sorun:** Strateji modülünün kritik incelemesinde 6 açık bulundu: (#1) blueprint + optimize motoru OpenAI `gpt-4o-mini` kullanıyordu (proje standardı Claude'a aykırı, zayıf model); (#2) "Plan aktifken haftalık otomatik analiz" vaadi vardı ama cron YOKtu — metrik yalnız sayfa ziyaretinde lazy çekiliyordu; (#3) Apply yalnız Meta'yı ele alıyordu (Google/TikTok yok) + ölü `campaignPlan` objesi; (#4) `_yoai_business_context_prompt` hiç doldurulmuyordu → planlar jenerik; (#5) "Kalan Bütçe = aylık bütçe − 7 günlük harcama" yanıltıcıydı + 14/30 gün aralığının hiç verisi yoktu (yalnız 7g snapshot yazılıyordu); (#6) Strateji ve YoAlgoritma birbirinden kopuktu.
- **Çözüm:** (#1) Yeni `lib/strategy/claude.ts` (Anthropic SDK + `getAiEngineModel` + prompt-cache'li system bloğu); `ai-generator.ts` ve `runOptimizeJob` Claude'a taşındı, template fallback korundu (artık `isAnthropicReady()` gate'i). (#2) `app/api/cron/strategy-metrics` + vercel.json cron (Pzt 04:00) — RUNNING instance'lar için bayat metrik varsa `checkPeriodicJobs` ile pull_metrics kuyruğa alıp işler. (#3) `createCampaignStructure` çok-kanallı (Meta + Google, channel_mix ağırlıklı funnel görevleri); ölü obje temizlendi; canlı auto-push bilinçli olarak EKLENMEDİ (gerçek para + entegrasyon riski — kullanıcı AdCreationWizard ile yayına alır). (#4) `runGeneratePlanJob` artık instance sahibinin brand intelligence'ını `getBusinessContextForUser` + `buildBusinessContextPromptBlock` ile motora besliyor. (#5) `runPullMetricsJob` 7/14/30 gün snapshot'larını çekiyor; metrics route'ta `total_budget` aylık sabit + `remaining = aylık − 30g harcama` + performans seçili aralık; KPIBar etiketleri netleşti ("Aylık Bütçe" / "Kalan (Bu Ay)" / "Harcanan (7g)"). (#6) `runOptimizeJob` aynı kullanıcının açık YoAlgoritma hesap uyarılarını (`listAccountAlertsForUser`) optimizasyon promptuna besliyor. Sahte veri yok (gerçek aktivite yoksa snapshot yazılmaz). Meta/Google entegrasyon koduna ve AdCreationWizard'a dokunulmadı. `tsc` ✓.
- **Env notu:** Strateji AI artık `ANTHROPIC_API_KEY` (mevcut) kullanır; `OPENAI_*` env'leri Strateji için artık gereksiz. Cron `CRON_SECRET` gerektirir (mevcut).
- **Dosyalar:** `lib/strategy/claude.ts` (yeni), `lib/strategy/ai-generator.ts`, `lib/strategy/job-runner.ts`, `app/api/strategy/metrics/route.ts`, `components/strateji/KPIBar.tsx`, `app/api/cron/strategy-metrics/route.ts` (yeni), `vercel.json`

## 2026-05-22 — YoAlgoritma: Google Arama Ağı reklam önerileri ("Reklam 0" bug fix)
- **Sorun:** Hiyerarşik geliştirme kartlarında Google Arama Ağı kampanyalarının ad set'i altında her zaman "Reklam (0)" görünüyordu. Kök neden: `ad_spec` validator'ı tamamen Meta-merkezliydi — `validateAdSpec` bir reklam önerisini geçerli sayması için `creative.asset_requirements.format ∈ {image,video,carousel,collection}` ve `targeting.demographics` (yaş) zorunlu kılıyordu. Google Arama Ağı (RSA) reklamı metin tabanlıdır (görsel asset yok) ve anahtar kelimeyle hedeflenir → her geçerli Search önerisi `ad_spec=null`'a düşüp persist'te sessizce atlanıyordu (`!adi.ad_spec → continue`). Veri ve model çıktısı sağlamdı, sorun yalnız validation katmanındaydı.
- **Çözüm:** Validator + tip + prompt platform-bilinçli yapıldı (yayın köprüsü `improvementToProposal` zaten toleranslıydı — değişmedi, Meta/Google API entegrasyonuna dokunulmadı): (1) `AdSpecCreative.asset_requirements` ve `AdSpecTargeting.demographics` opsiyonel; yeni opsiyonel `targeting.keywords` (Google Search). (2) `validateCreative`/`validateTargeting` artık platform parametresi alıyor — Meta'da asset+demografik HÂLÂ zorunlu, Google'da opsiyonel. (3) `perCampaignPrompt.ts`'e RSA direktifi (3-15 başlık ≤30 krk, 2-4 açıklama ≤90 krk, asset yok, keyword hedefleme). (4) AdCard'da anahtar kelime gösterimi + `asset_requirements` opsiyonel-zincir düzeltmesi. Test: 11/11 geçti (Google gevşek + Meta sıkı doğrulandı), `tsc` ✓.
- **Dosyalar:** `lib/yoai/ai/types.ts`, `lib/yoai/ai/adSpecPayload.ts`, `lib/yoai/ai/perCampaignPrompt.ts`, `components/yoai/hierarchy/AdCard.tsx`, `components/yoai/hierarchy/shared.tsx`, `components/yoai/ImprovementCard.tsx`, `locales/tr.json`, `locales/en.json`, `src/tests/yoalgoritmaAdSpecPayload.test.ts`
- **Üretim doğrulaması (2026-05-22):** Canlı DB'de bug'ın kanıtı görüldü — owner hesabı için `ad_improvements` (Google) tablosu **tamamen boştu**, buna karşılık `campaign_improvements`'ta 8+ Google Arama kampanyası vardı (kampanya + ad set seviyesi üretiliyor, yalnız reklam seviyesi sessizce atlanıyordu — bug'ın kesin imzası). Fix production'a deploy edildikten sonra `/api/cron/yoalgoritma-scan?onlyUser=<owner>` (admin override, `CRON_SECRET`) ile **yalnız owner için** hiyerarşik yeniden üretim tetiklendi (`scan.user` + `campaign-improvements.user`). Süreç Batch API olduğundan asenkrondur. **Sonuç (~7 dk sonra): Google `ad_improvements` 0 → 8** — yeni RSA reklam kartları üretildi (`pending`, güven %74–85); fix canlıda doğrulandı. Not: `applied`/`approved` durumundaki kampanyalar **freeze-on-decision** lifecycle'ı gereği yeniden üretilmez — yeni RSA reklam kartları yalnız aktif + dondurulmamış kampanyalarda belirir.

## 2026-05-21 — Billing production-hardening: atomik kredi + çift-grant + abonelik expiry (P0+P1)
- **Sorun:** Production'a açılış öncesi billing denetimi para-kritik açıklar buldu: (1) İyzico callback'te `markTransactionSucceeded` kazandı mı kontrol edilmeden entitlement veriliyordu → eşzamanlı callback'te **çift kredi/çift abonelik**; (2) `addCreditsServer/spendCreditsServer/refundCreditsServer` "oku-değiştir-yaz" → **lost update/çift harcama**; (3) abonelik `current_period_end` hiçbir yerde kontrol edilmiyordu → "active" sonsuza dek erişim; (4) `/api/credits/spend`'de owner bypass yoktu; (5) plans.ts yanıltıcı "USD" yorumu (fiyatlar TRY).
- **Çözüm:** (1) `markTransactionSucceeded` artık pending→succeeded geçişini KAZANIP kazanmadığını döner; callback entitlement'ı yalnız kazanılırsa verir. (2) Yeni atomik DB RPC'leri `add_credits/spend_credits/refund_credits` (deduct_strategy_credit deseni) + `credit_transactions` ledger tablosu; db.ts JS aritmetiğini bıraktı. (3) `getSubscription` lazy-expiry (süresi/denemesi geçen abonelik → expired, kalıcı) → serverGuard + billing/current tek noktadan doğru; strateji route `current_period_end` kontrolü + abonelik-zorunlu açık kapatıldı; `applySubscriptionPurchase` yenilemede kalan günü korur. (4) credits/spend owner bypass (kredi düşmez). (5) plans.ts yorumu TRY. `tsc` ✓.
- **Migration (ZORUNLU, deploy'dan ÖNCE):** `npm run db:migrate:billing` (omddq) — RPC'ler/ledger uygulanmadan kod deploy edilirse kredi işlemleri kırılır.
- **Dosyalar:** `supabase/migrations/20260521000000_billing_atomic_credits_and_ledger.sql`, `scripts/apply-billing-atomic-migration.mjs`, `lib/billing/db.ts`, `app/api/billing/iyzico/callback/route.ts`, `app/api/credits/spend/route.ts`, `lib/subscription/plans.ts`, `app/api/strategy/instances/route.ts`, `package.json`

## 2026-05-21 — Sahte-veri temizliği: Meta ölü mock grafik + Tasarım/Görsel mock sayfası
- **Sorun:** Proje genelinde "hiçbir alan sahte olamaz" ilkesi gereği tarama yapıldı. İki gerçek sahte-veri noktası bulundu: (1) `MetaPage.tsx`'te `mockChartData = Math.random()*100+50` — kullanılmayan ölü kod ama yine de uydurma; (2) `app/dashboard/tasarim/gorsel/page.tsx` baştan sona **mock sayfa** (sabit Unsplash stok foto galerisi + `setTimeout` ile sahte üretim + rastgele Unsplash URL + sahte `useState(100)` kredi).
- **Çözüm:** (1) MetaPage'teki kullanılmayan `mockChartData` satırı kaldırıldı (Meta entegrasyon mantığına dokunulmadı). (2) Orphan mock gorsel sayfası — hiçbir menüden linkli değildi; gerçek tasarım stüdyosu zaten `/tasarim`'de (gerçek fal.ai üretimi + gerçek kredi + AccessRequiredModal) ve ana menü oraya linkliyor — gerçek `/tasarim`'e **redirect** ile değiştirildi. `tsc` ✓.
- **Dosyalar:** `app/dashboard/reklam/meta/MetaPage.tsx`, `app/dashboard/tasarim/gorsel/page.tsx`, `docs/CHANGELOG.md`

## 2026-05-21 — Strateji · SAHTE metrikler kaldırıldı, GERÇEK Meta verisine bağlandı (K1)
- **Sorun:** Strateji `runPullMetricsJob` performans metriklerini (spend, clicks, impressions, conversions, roas, cpa, ctr) `Math.random()` ile **uyduruyordu**. Aylık abonelik olarak satılan üründe sahte metrik kabul edilemez.
- **Çözüm:** Job artık bağlı Meta hesabının **gerçek son-7-gün hesap-geneli insights**'ını çekiyor (`metaGraphFetch('/{account}/insights', date_preset=last_7d)` + `normalizeInsights`; Meta entegrasyon kodu değiştirilmedi). Token **instance'ın kendi `user_id`'sinden** çözülür (`getMetaConnection`) — ambient cookie'ye bakılmaz, çapraz-kullanıcı sızıntısı engellenir. Gerçek veri yoksa (Meta bağlantısı yok / son 7 günde aktivite yok) **snapshot yazılmaz**, uydurma yapılmaz — UI boş durum gösterir. Gerçek veri çekilince optimize job zincirlenir. Kullanılmayan `getInstanceBudget` ölü kodu kaldırıldı. `tsc` ✓.
- **Dosyalar:** `lib/strategy/job-runner.ts`, `docs/CHANGELOG.md`

## 2026-05-21 — Strateji · Çift kredi düşme fix (K2) + renk paleti temizliği (K3)
- **Sorun:** (K2) Aylık limit aşan (overage) kullanıcı strateji oluştururken kredi **iki kez** düşüyordu: client `spendCredits` → `/api/credits/spend` (10 kredi) + backend `deduct_strategy_credit` RPC (10 kredi) → toplam 20. (K3) Strateji alanı CLAUDE.md onaylı paletin dışında **amber/yellow/purple/green** tonları kullanıyordu (özellikle `app/strateji/page.tsx`'te yasaklı `bg-amber-*`).
- **Çözüm:** (K2) Client tarafı `spendCredits` çağrısı kaldırıldı; kredi düşümü **tek nokta = backend RPC**. Başarılı oluşturmadan sonra `refreshCredits()` ile gerçek bakiye UI'a yansıtılıyor; salt-okunur `hasEnoughCredits` modal kontrolü korundu. (K3) Strateji alanındaki tüm amber/yellow/purple/green ihlalleri onaylı palete taşındı: marka/aksiyon → `primary`, başarı/durum → `emerald`, "med" rozet → `gray`, negatif (düşük ROAS) → `red`; üç faz başlık bandı (yeşil/purple/amber) tek tip `primary` bandına birleştirildi. Strateji akışı, AI üretim, billing RPC, tablolar ve job motoru **değiştirilmedi**. `tsc` ✓.
- **Dosyalar:** `app/strateji/page.tsx`, `app/strateji/[id]/page.tsx`, `components/strateji/{KPIBar,JobPanel,StrategyRow,PhaseIndicator,ScanAnimation,TaskPanel,WizardPhase1,BlueprintView}.tsx`, `docs/CHANGELOG.md`

## 2026-05-21 — YoAlgoritma Faz 3 · UI cila 10: reklam yayından önce düzenlenebilir (kart-içi edit)
- **Sorun:** Öneri (özellikle reklam) **yayınlanmadan önce kullanıcı tarafından düzenlenebilir** olmalı. Mevcut durumda yalnız Meta kreatifi wizard'da düzenleniyordu; Google'da yoktu; kart seviyesinde hiç yoktu.
- **Çözüm:** Reklam (ad) kartına **"Düzenle" modu** — başlıklar / açıklamalar / ana metin / CTA / günlük bütçe kart üzerinde düzenlenir, **"Kaydet"** → `improvement_payload.ad_spec` güncellenir (`updateAdImprovementSpec`, yalnız `pending`/`approved`; decision endpoint `action: 'edit'`). Onayla/Yayınla artık **düzenlenmiş** ad_spec ile sihirbaza gider → hem Meta hem Google. Düzenleme **bizim katmanda** (Meta/Google entegrasyonuna dokunulmadı). `edit`/`save`/`cancel` i18n. `build` ✓.
- **Dosyalar:** `lib/yoai/ai/hierarchicalStore.ts`, `app/api/yoai/improvements/hierarchy/decision/route.ts`, `components/yoai/hierarchy/{AdCard,DrilldownModal,HierarchicalImprovements}.tsx`, `locales/{tr,en}.json`, `docs/CHANGELOG.md`

## 2026-05-21 — YoAlgoritma Faz 3 · UI cila 9: flip kart yazı kesilmesi düzeltildi (auto-height)
- **Sorun:** Hesap Sağlık flip kartlarında sabit `h-52` yükseklik uzun metni **kesiyordu** (özellikle arka yüz body + önerilen aksiyon üst üste binip görünmüyordu).
- **Çözüm:** Sabit yükseklik kaldırıldı; ön/arka yüz **aynı grid hücresinde** (grid-overlay: `face { grid-area: 1/1 }`, `flip-inner { display: grid }`) → kart **en uzun içeriğe göre büyür**, kesilme yok. Outer grid `auto-rows-fr` ile satırdaki kartlar **eşit yükseklikte**. `min-h-[13rem]` taban. Flip + shimmer + tap korundu. `build` ✓.
- **Dosyalar:** `components/yoai/hierarchy/AccountAlertsBanner.tsx`, `docs/CHANGELOG.md`

## 2026-05-21 — YoAlgoritma Faz 3 · UI cila 8: sağlık flip kartları koyu tema
- **Sorun:** Hesap Sağlık Durumu flip kartları açık yeşil zeminliydi; Geliştirme Kartları gibi koyu tema + beyaz yazı istendi.
- **Çözüm:** `AccountAlertsBanner` flip yüzleri (ön+arka) → `#0f172a` + emerald radial gradient + `#23314d` border (Geliştirme Kartları ile birebir). Yazılar beyaz (`slate-50`/`slate-200`), önerilen aksiyon `emerald-300`, ikonlar koyu temaya uygun (`red-400`/`emerald-400`/`slate-400`), tap ikonu `emerald-400`. Flip + shimmer + tap animasyonu korundu. `build` ✓.
- **Dosyalar:** `components/yoai/hierarchy/AccountAlertsBanner.tsx`, `docs/CHANGELOG.md`

## 2026-05-21 — YoAlgoritma Faz 3 · UI cila 7: ad set kart altı Geri/İleri navigasyonu
- **Sorun:** Ad set'ten reklamlara nasıl geçileceği net değildi ("Reklamları Gör" yeterince belirgin değil).
- **Çözüm:** `AdsetCard` kart altı iki butonlu nav — sol **"Geri"** (popup'ı kapat → kampanya), sağ **"İleri (N)"** (bu ad set'in reklamları; reklam yoksa disabled). Ad görünümü geri butonu da "Geri" olarak netleştirildi. `back`/`next` i18n. `build` ✓.
- **Dosyalar:** `components/yoai/hierarchy/{AdsetCard,DrilldownModal}.tsx`, `locales/{tr,en}.json`, `docs/CHANGELOG.md`

## 2026-05-21 — YoAlgoritma Faz 3 · UI cila 6: butonlar yalnız reklamda + modal başlık sabit değil + objective adı + rakip vurgu
- **Sorun:** (1) Ad set'te buton olmamalı — yayın finalde **reklam (ad) kartından**; Onayla/Reddet yalnız reklamda. (2) Modal başlığı `sticky` → kaydırınca sabit kalıp UI bozuyordu; yukarıda kalmalı. (3) AI `recommended_type` = **"Müşteri Adayı Hedefi"** üretmiş; Meta'da böyle hedef yok, doğrusu **"Potansiyel Müşteri"**. (4) "Rakip analizi nerede?" — aslında **reklam kartında dolu** (ad set'te değil).
- **Çözüm:** `AdsetCard` → Onayla/Reddet **kaldırıldı** (yalnız "Reklamları Gör"); karar/yayın butonları **yalnız `AdCard`'da**. `DrilldownModal` başlığı **sticky değil** (içerikle kayar). `meta-enums.ts` + `perCampaignPrompt.ts`: "Müşteri Adayı" → **"Potansiyel Müşteri"** (Meta gerçek hedef adı) + prompt'a **geçerli kampanya türü adları** direktifi (uydurma yasağı). `CampaignCard` `fixObjectiveTerm` ile mevcut veriyi de gösterimde düzeltir. `AdCard` rakip karşılaştırması bloğu **belirginleştirildi** (indigo + `Swords` ikonu). `build` ✓.
- **Dosyalar:** `components/yoai/hierarchy/{AdsetCard,DrilldownModal,CampaignCard,AdCard,shared}.tsx`, `lib/yoai/translations/meta-enums.ts`, `lib/yoai/ai/perCampaignPrompt.ts`, `docs/CHANGELOG.md`

## 2026-05-21 — YoAlgoritma Faz 3 · UI cila 5: flip tap ikonu + ad set butonları geri
- **Sorun:** (1) Flip kart ön yüzündeki "detay için üzerine gelin" **yazısı** kaldırılıp yerine tıklama-animasyonlu ikon istendi. (2) Ad set kartlarındaki **Onayla/Reddet butonları yanlışlıkla kaldırılmıştı** — popup'ta (drill-down) olmalı.
- **Çözüm:** `AccountAlertsBanner` ön yüz altı: yazı yerine **animasyonlu `Pointer` (tap) ikonu** (`yoaiTap` keyframe — hafif bas-bırak; kullanıcının `tap.png`'si yerine benzer lucide ikonu). `AdsetCard`'a `HierCardActions` (advisory: Onayla/Reddet/Uygulandı İşaretle/Geri Al) **geri eklendi** + `DrilldownModal`'da karar handler'ları bağlandı. Kampanya kartı yine **butonsuz** (yalnız UYGULA). `build` ✓.
- **Dosyalar:** `components/yoai/hierarchy/{AccountAlertsBanner,AdsetCard,DrilldownModal}.tsx`, `docs/CHANGELOG.md`

## 2026-05-21 — YoAlgoritma Faz 3 · UI cila 4: simetrik kampanya kartı + Title Case adlar
- **Sorun:** Kampanya kartı simetrik değildi (gerekçe solda / öneriler sağda yan yana); kimlik dağınık; UYGULA butonu büyük; adlar tamamı BÜYÜK harf ("TRAFFİK").
- **Çözüm:** Üst **hafif kutu** tek satır → `logo+durum | Kampanya: … | Kampanya Türü: … | Güven Skoru: %… | UYGULA` (buton küçültüldü: `px-4 py-1.5`). Gövde simetrik dik akış: **AI Gerekçesi tam genişlik üstte**, altında **Öneriler yan yana kart grid'i** (responsive 1/2/3 kolon). `titleCaseTr` (Türkçe duyarlı, `tr-TR` locale) → tüm adlar **Title Case**: "6 SET // 28 EKİM 2025 // TRAFFİK" → "6 Set // 28 Ekim 2025 // Traffik" (kampanya/ad set/reklam + modal başlıkları). `build` ✓.
- **Dosyalar:** `components/yoai/hierarchy/{shared,CampaignCard,AdsetCard,AdCard,DrilldownModal}.tsx`, `docs/CHANGELOG.md`

## 2026-05-21 — YoAlgoritma Faz 3 · UI cila 3: yatay kampanya kartı + buton sadeleştirme + ortalı flip başlık
- **Sorun:** (a) flip kart başlıkları sola yaslı + içinde "—" çizgisi; (b) Onayla/Reddet **hem kampanya kartında hem drill-down'da** (çift) ve kampanya Onayla'sı yayınlamıyordu; (c) alt başlık metni gereksiz; (d) kampanya kartları **çok uzun (dik)**, buton "Ad Set'leri Gör" yerine **"UYGULA"** istendi.
- **Çözüm:** `AccountAlertsBanner` ön yüz **simetrik** (ikon üst · başlık merkez · ipucu alt) + başlıktaki "—" cümle ayırıcıya çevrildi (`tidyTitle`). Onayla/Reddet/Yayınla **yalnız reklam (ad) kartında** — kampanya + ad set kartlarından kaldırıldı (çift buton + "yayınlamıyor" şikayeti giderildi; yayın doğrudan reklam kartından). Kampanya kartı **yatay tam-genişlik** (üstte kimlik + **UYGULA** butonu; altında gerekçe | öneriler yan yana 2-kolon; tür uyumsuzluğu tam-genişlik şerit) → çok daha kısa. Grid tek kolon. Alt başlık metni kaldırıldı. `apply` (UYGULA/APPLY) i18n. Popup (drill-down) **aynı**. `build` ✓.
- **Dosyalar:** `components/yoai/hierarchy/{AccountAlertsBanner,CampaignCard,AdsetCard,HierarchicalImprovements,DrilldownModal}.tsx`, `locales/{tr,en}.json`, `docs/CHANGELOG.md`

## 2026-05-21 — YoAlgoritma Faz 3 · UI cila 2: flip-box sağlık kartları + yatay modal + font −1
- **Sorun:** Canlı incelemede 3 talep — (1) modal içinde ad set **dik/uzun değil yatay**; (2) yazılar **bir punto küçük**; (3) Hesap Sağlık kartları **flip-box** (ön: başlık + tıklama ikonu; hover → 180° dönüp detay; etrafında soldan-sağa sonsuz **shimmer ışık**; açık yeşil zemin + koyu yazı).
- **Çözüm:** `AccountAlertsBanner` → 3D **flip kartlar** (CSS `rotateY` hover), dönen konik-gradyan **shimmer halka**, `MousePointerClick` ipucu (`flipHint`), emerald gradient zemin + koyu metin, severity yalnız ikon renginde. `DrilldownModal` → kartlar **tam genişlik tek kolon** + `horizontal` prop. `AdsetCard`/`AdCard` horizontal: öneriler 2-kolon / `ad_spec` 2-kolon grid (yatay). Tüm hiyerarşi kartlarında **font −1** (16→15, 13→12). `flipHint` i18n (tr/en). `build` ✓.
- **Dosyalar:** `components/yoai/hierarchy/{shared,AccountAlertsBanner,AdsetCard,AdCard,CampaignCard,DrilldownModal,HierCardActions}.tsx`, `locales/{tr,en}.json`, `docs/CHANGELOG.md`

## 2026-05-21 — YoAlgoritma Faz 3 · UI cila: hesap sağlık kartları + popup drill-down + logo ikonlar + büyük yazı
- **Sorun:** Canlı /yoai incelemesinde 5 talep: (1) "Hesap Sağlık Uyarıları" → "Hesap Sağlık Durumu" + animasyonlu dikdörtgen kartlar + başlık ikonu, (2) Geliştirme Kartları başlığına ikon, (3) kart sol üstünde Meta/Google **yazı yerine logo**, (4) yazılar çok küçük (okunmuyor), (5) "Ad Set'leri Gör" inline yerine **popup** + net Kampanya→Tür→Reklam Seti→Reklam hiyerarşisi.
- **Çözüm:** `AccountAlertsBanner` — `Activity` ikonu + "Hesap Sağlık Durumu" + sol-aksanlı, gölgeli, **staggered fade-in animasyonlu** kartlar. `shared.tsx` `PlatformBadge` artık Meta (mavi "f") / Google (çok-renkli "G") **logo SVG'si** (AdPreviewCard'dan). Tüm hiyerarşi kartlarında **yazı boyutları büyütüldü** (9–11px → 12–16px). `HierarchicalImprovements` başlığına `Sparkles` ikonu; **in-place drill-down kaldırıldı → yeni `DrilldownModal` popup'ı** (Kampanya + tür header → Reklam Seti grid → Reklam grid; breadcrumb + geri). Ad onayı → modal kapanır + wizard açılır. `tr/en.json` `alertsTitle` güncellendi. `build` ✓.
- **Dosyalar:** `components/yoai/hierarchy/{shared,AccountAlertsBanner,DrilldownModal,HierarchicalImprovements,CampaignCard,AdsetCard,AdCard,HierCardActions}.tsx`, `locales/{tr,en}.json`, `docs/CHANGELOG.md`

## 2026-05-21 — YoAlgoritma Faz 3 · Adım 6+7: Hiyerarşik drill-down UI + i18n
- **Sorun:** Düz per-ad kart grid'i yerine hesap → kampanya → ad set → reklam **drill-down** UI; tüm detaylar AÇIK (collapse yok); buton davranışları (pending/approved/applied/rejected_by_user); çift dil.
- **Çözüm:** `components/yoai/hierarchy/` — `AccountAlertsBanner` (SEVİYE 0 banner; kırmızı/primary, **amber yok**), `CampaignCard` (SEVİYE 1; kampanya türü uyumsuzluğu **kırmızı uyarı en üstte**), `AdsetCard` (SEVİYE 2), `AdCard` (SEVİYE 3; `ad_spec` tam açık), `HierCardActions` (pending → Onayla+Reddet; approved → Yayınla[ad]/Uygulandı[advisory]+Reddet; applied → Reddet; rejected_by_user → gri + "Geri Al"), `HierarchicalImprovements` (breadcrumb drill-down + decision endpoint + ad approve→wizard). `app/yoai/page.tsx`: `ImprovementCardGrid` → `HierarchicalImprovements`; wizard `onPublished` → yeni `decision applied` endpoint. Enum'lar `translateEnum(locale)` ile çevrilir. `tr.json` + `en.json`: yeni `dashboard.yoai.hierarchy` namespace (~45 anahtar, TR+EN). Eski `ImprovementCard(Grid)` kod olarak korundu (artık render edilmiyor). `npm run build` ✓, `tsc` 0 hata.
- **Dosyalar:** `components/yoai/hierarchy/{shared,HierCardActions,AccountAlertsBanner,CampaignCard,AdsetCard,AdCard,HierarchicalImprovements}.tsx`, `app/yoai/page.tsx`, `locales/tr.json`, `locales/en.json`, `docs/CHANGELOG.md`

## 2026-05-21 — YoAlgoritma Faz 3 · Adım 4+5: Per-campaign hiyerarşik AI motoru + Inngest pipeline
- **Sorun:** Düz per-ad öneri yerine hesap → kampanya → ad set → reklam hiyerarşik kart modeli + kampanya türü doğrulama gerekiyordu.
- **Çözüm (Adım 4 — motor):** `perCampaignPrompt.ts` (hiyerarşik sistem prompt: kampanya türü uyumsuzluğu en üstte vurgu, İngilizce enum YASAK, "kaynak belirtme" yasağı, off-brand ürün/hizmet kontrolü, three-pillar; user brief enum'ları `translateEnum` ile TR'ye çevirir) + `perCampaignAgent.ts` (kampanya başına 1 Batch isteği — 24K/6K; 4 seviyeli JSON parse + toleranslı validate; `ad_spec` mevcut `validateAdSpecPayload` ile). **Çözüm (Adım 5 — pipeline):** `hierarchicalStore.ts` (4 tablo CRUD + lifecycle: *freeze-on-decision* — karar verilmiş kampanya dondurulur, kararsız kampanyanın pending alt-ağacı haftalık supersede; nested hiyerarşi okuma) + `inngest/functions/perCampaignImprovements.ts` (fetch → reconcile → batch → poll → FK zinciri persist; `account_alerts` ilk-per-platform; concurrency 5) + serve route kaydı + cron fan-out (per-ad yerine `campaign-improvements` event; eski per-ad function rollback için kayıtlı) + 2 endpoint (`hierarchy` GET, `decision` POST: approve/reject/unreject/applied; ad approve → wizard proposal). Eski `ai_suggestions` + `ai_ad_improvements` akışları PARALEL korundu. Meta/Google entegrasyon koduna dokunulmadı. `tsc` 0 hata. **Smoke test (Adım 9) bekliyor.**
- **Dosyalar:** `lib/yoai/ai/perCampaignPrompt.ts`, `lib/yoai/ai/perCampaignAgent.ts`, `lib/yoai/ai/hierarchicalStore.ts`, `inngest/functions/perCampaignImprovements.ts`, `app/api/inngest/route.ts`, `app/api/cron/yoalgoritma-scan/route.ts`, `app/api/yoai/improvements/hierarchy/route.ts`, `app/api/yoai/improvements/hierarchy/decision/route.ts`, `docs/CHANGELOG.md`

## 2026-05-21 — YoAlgoritma Faz 3 · Adım 2: Bilingual enum çeviri katmanı
- **Sorun:** Meta/Google API İngilizce enum döndürüyor (`OUTCOME_ENGAGEMENT`, `CONVERSATIONS`, `Advantage+ Placements`…); UI'da ham enum **asla** görünmemeli ve hem TR hem EN locale tam desteklenmeli. Mevcut `humanizeTr` yalnızca Türkçe idi.
- **Çözüm:** Yeni `lib/yoai/translations/` katmanı — `types.ts` + `meta-enums.ts` + `google-enums.ts` (objective / optimization goal / CTA / placement / bidding / status / ad type / match type domain'leri, TR+EN map) + `index.ts`: `translateEnum(value, locale, platform?)` + `translateEnumList`, `normKey` normalizasyonu (`Advantage+ Placements` → `ADVANTAGE_PLACEMENTS`), bilinmeyen değer "Title Case"e düşer — ham SNAKE_CASE asla görünmez. `humanizeTr.ts` geriye dönük uyumlu kalıp merkezî `translateEnum`'a delege ediyor (regresyon yok; mevcut kartlar otomatik zenginleşti). `tsc` 0 hata.
- **Dosyalar:** `lib/yoai/translations/{types,meta-enums,google-enums,index}.ts`, `lib/yoai/ai/humanizeTr.ts`, `docs/CHANGELOG.md`

## 2026-05-21 — YoAlgoritma Faz 3 · Adım 1: Hiyerarşik geliştirme tabloları (omddq'ya uygulandı)
- **Sorun:** Faz 2'nin düz `ai_ad_improvements` tablosu, hesap → kampanya → ad set → reklam hiyerarşik drill-down modelini desteklemiyordu.
- **Çözüm:** 4 yeni tablo — `account_alerts` (SEVİYE 0), `campaign_improvements` (SEVİYE 1), `adset_improvements` (SEVİYE 2, campaign FK), `ad_improvements` (SEVİYE 3, adset FK) + RLS + touch trigger + 7-değer status enum (yeni: `rejected_by_user`). Tümü additive + idempotent; eski `ai_ad_improvements` paralel korunuyor. Migration Supabase SQL Editor'de **canonical omddq** projesine uygulandı, 4 tablo doğrulandı.
- **Dosyalar:** `supabase/migrations/20260520010000_create_hierarchical_improvements.sql`, `scripts/apply-hierarchical-improvements-migration.mjs`, `package.json`, `docs/CHANGELOG.md`

## 2026-05-20 — /yoai sayfa sadeleştirme: eski "AI Reklam Önerileri" + stale footer kaldırıldı
- **Sorun:** /yoai sayfasında iki gereksiz/kafa karıştırıcı kalıntı vardı: (1) eski `AiAdSuggestions` ("AI Reklam Önerileri") bölümü kullanıcıya "AI kampanya önerisi üretilemedi" boş empty-state gösteriyordu; (2) eski rule-engine'den kalma "Analiz tarihi: … · Haftalık analiz Pazar gece otomatik güncellenir" footer'ı. Geliştirme Kartları bölümünde zaten "Son: X" rozeti var, footer gereksizdi.
- **Çözüm:** `app/yoai/page.tsx`'ten yalnızca UI kaldırıldı: `AiAdSuggestions` import + render bloğu, artık dead olan `handleApprovalChanged` handler'ı ve stale footer `<p>`'si silindi. **Generate-ad altyapısı (lib + API route'ları + AdCreationWizard) ve header'daki "AI Reklam Oluştur" butonu (`onCreateAd → setShowAdWizard`) korundu** — kullanıcı oradan başlatabilir. Stale metin locale key değil inline JSX idi (grep ile doğrulandı). Sayfa artık tek bölüm gösteriyor: "Geliştirme Kartları" (ImprovementCardGrid). tsc 0 hata.
- **Dosyalar:** `app/yoai/page.tsx`, `docs/CHANGELOG.md`

## 2026-05-20 — Per-Ad Improvement Cards Faz 2 implementation (feature branch)
- **Sorun:** YoAlgoritma "düz suggestion listesi" yerine her aktif reklam için 1:1 "Geliştirme Kartı" modeli istendi (Faz 1 planı onaylandı). Kart = o reklama özel iyileştirilmiş ad_spec + AI gerekçesi + rakip karşılaştırma + uygunluk; Onayla → mevcut yayın sihirbazı; lifecycle (pasif→iptal, creative değişti→güncelle).
- **Çözüm (branch `feat/yoalgoritma-per-ad-improvements`):** (1) `ai_ad_improvements` tablosu + `user_business_intelligence` sentez kolonları (omddq'ya uygulandı). (2) fetchMetaDeep/fetchGoogleDeep additive full creative (Google RSA headlines/descriptions/final_urls) + `creativeHash`. (3) Per-ad AI motoru (perAdPrompt/perAdAgent, cached bağlam blokları, off-brand direktifi). (4) Inngest: `yoalgoritmaPerAdImprovements` (fetch→reconcile: auto-cancel/supersede/skip refresh policy→per-ad batch→persist) + `brandIngestionUser` (Claude marka sentezi, soft-fail) + improvementStore + weekly cron fan-out. (5) UI: ImprovementCard + ImprovementCardGrid (dark/emerald, tam Türkçe i18n, filtreler, Şimdi Tara) + endpoint'ler (list/approve/reject/applied/scan) + `ad_spec→FullAdProposal` köprüsü → mevcut AdCreationWizard ile önizleme→yayın (Meta/Google entegrasyonuna dokunulmadı) + wizard `onPublished` → kart "Yayında". (6) "Marka Bilgilerini Yenile" butonu (İşletme Profili) + CLAUDE.md "manuel buton" kuralı netleştirmesi. Mevcut ai_suggestions + generate-ad akışları paralel korundu; onboarding route değişmedi. `npm run build` ✓, tsc 0 hata. **Smoke test (gerçek scan + yayın akışı) bekliyor.**
- **Dosyalar:** migration + apply script, creativeHash.ts, analysisTypes.ts, meta/googleDeepFetcher.ts, perAdPrompt/perAdAgent/improvementStore/brandSynthesis/improvementToProposal.ts, brandProfilePipeline.ts, inngest/functions/perAdImprovements.ts + brandIngestion.ts, app/api/inngest + cron + 6 improvements endpoint + brand-refresh, ImprovementCard(Grid).tsx, AdCreationWizard.tsx, app/yoai/page.tsx, isletme-profili/page.tsx, locales/*.json, CLAUDE.md, docs/CHANGELOG.md

## 2026-05-20 — Per-ad improvement cards refactor planı (Faz 1 audit, kod yok)
- **Sorun:** YoAlgoritma "düz suggestion listesi" mimarisi terk edilip "her aktif reklam için 1:1 improvement card" modeline geçilecek. Faz 2 implementation öncesi mevcut akışın tam haritası + yeni tablo/worker/UI/maliyet planı gerekiyordu.
- **Çözüm:** Tam audit yapıldı. Kritik bulgular: (1) `ai_suggestions` yazılıyor ama hiç okunmuyor; `payload.ad_spec` UI'a ulaşmıyor (`buildDeepAnalysisFromAi` payload'ı düşürüyor). (2) Ekrandaki AdPreviewCard kartları `generate-ad` pipeline'ından, `ai_suggestions` ile ilgisiz. (3) Meta full creative çekiliyor, Google RSA creative ÇEKİLMİYOR (Faz 2 GAQL genişletme gerek). (4) Brand Intelligence pipeline'ının %80'i ZATEN VAR ama deterministik — eksik tek parça Claude sentez katmanı; trigger hook + Apify IG/FB scraper'ları zaten kurulu. (5) Meta publish 3-katman create var, Google publish external entegrasyon (doğrulanmadı). Plan: paralel yeni `ai_ad_improvements` tablosu + per-ad Batch AI + lifecycle worker + Claude brand sentez (Inngest). Açık çelişki işaretlendi: manuel "Yenile" butonu vs CLAUDE.md "manuel tara butonu yok" kuralı (Onur kararı bekliyor). Maliyet tahmini: ~$190/ay (100 kullanıcı), brand ingestion ihmal edilebilir.
- **Dosyalar:** `docs/yoalgoritma_per_ad_refactor_plan.md` (yeni), `docs/CHANGELOG.md`

## 2026-05-20 — Off-brand reasoning fix (sektör listesi örnekleyici)
- **Sorun:** AI motoru, profilde deklare edilen sektör listesini "tam ve eksiksiz liste" sanıyordu. MYK belgelendirme firması (Belgemod) örneğinde profilde "Aşçılık" listelenmediği için Aşçı MYK belgesi kampanyasını `pause_campaign` ile durdurmayı öneriyordu — oysa ürün (MYK belgesi) aynı, sadece meslek farklı = on-brand.
- **Çözüm:** `systemPrompt.ts` içinde kullanıcı beyanı bloğundan sonra "Sektör listesi yorumu (off-brand kararı)" direktifi eklendi: sektör listesi ÖRNEKLEYİCİDİR; önce ürün/hizmet uyumu kontrol edilir; belirsizlikte `pause_campaign` yerine yeni `flag_for_review` action type'ı + "ürün listesiyle uyumlu ama sektör listesinde yok, manuel inceleme" gerekçesi. `recommended_actions[].action_type` enum'una `flag_for_review` eklendi (persist katmanı zaten serbest string kabul ediyor). Değişiklik tamamen prompt metni + enum literal içinde — kod yolu değişmedi. Smoke testi Pazar gece cron'unda gerçek scan ile doğrulanacak.
- **Dosyalar:** `lib/yoai/ai/systemPrompt.ts`, `docs/CHANGELOG.md`

## 2026-05-20 — GA4 + GTM entegrasyon planı (planlama fazı, kod yok)
- **Sorun:** Google Analytics 4 ve Google Tag Manager entegrasyonu için Aşama 2'de referans alınacak, mevcut Meta/Google pattern'lerini birebir izleyen executable bir plan dokümanı gerekiyordu.
- **Çözüm:** Mevcut Google yapısı tam haritalandı — kritik bulgu: GA4 sunucu-taraflı OAuth + salt-okunur raporlama (`analytics.readonly`) ZATEN VAR (`google_analytics_connections` + 7 route + connectionStore/service), GTM ise greenfield (sıfır kod), client-side ölçüm tag'i yok. Meta DB-first migration recipe (cookie fallback'siz, `fbece82` güvenlik düzeltmesi) referans alındı. Plan dokümanı 10 bölüm + açık sorular ile yazıldı: tablo şeması (ayrı tablo önerisi — birleşik tablo refactor riski reddedildi), OAuth scope/incremental authorization, helper imzaları (resolveGAContext/resolveGTMContext), API route haritası, wizard UI, i18n parity, fazlı rollout (Faz 1 salt-okunur additive → Faz 2 yazma flag-gated), verification/demo video test stratejisi.
- **Dosyalar:** `docs/google_ga_gtm_entegrasyon_plani.md` (yeni), `docs/CHANGELOG.md`

## 2026-05-20 — Privacy Policy EN sayfası eski içerik gösteriyordu (stale cache fix)
- **Sorun:** Production'da TR (`/gizlilik-politikasi`) yeni GA4/GTM içeriğini gösteriyordu ama EN (`/en/privacy-policy`) eski deployment cache'inde takılı kalmıştı (eski dpl ID). Kaynak doğru: `en.json` + `tr.json` + paylaşılan `PrivacyPolicyContent` aynı commit'te güncellenmişti. Kök neden: `/en/privacy-policy` middleware rewrite ile `/privacy-policy` filesystem route'una düşüyor; bu sayfada `revalidate`/`dynamic` olmadığı için SSG (full route cache) idi → rewrite edilen EN path Vercel CDN'inde eski static HTML'e takılıyordu (TR route deploy'da invalidate edilirken rewrite hedefi edilmiyordu).
- **Çözüm:** Her iki gizlilik sayfasına `export const dynamic = 'force-dynamic'` eklendi → static cache devre dışı, EN rewrite path bir daha eski HTML servis edemez. Build sonrası iki route da `ƒ` (Dynamic) oldu. İçerik kaynağına dokunulmadı.
- **Dosyalar:** `app/privacy-policy/page.tsx`, `app/gizlilik-politikasi/page.tsx`, `docs/CHANGELOG.md`

## 2026-05-20 — Privacy Policy: GA4 + GTM section'ları (Google OAuth verification)
- **Sorun:** Google OAuth verification için gizlilik politikasında Google Analytics (GA4) ve Google Tag Manager (GTM) scope açıklamaları yoktu. Ayrıca Section 9 "following channel:" cümlesi bir kanal listelemeden bitiyordu (email eksik) ve "Last updated" tarihi hiç yoktu.
- **Çözüm:** TEK KAYNAK (`locales/*.json` + paylaşılan `PrivacyPolicyContent`) olduğu doğrulandı — site + panel aynı içeriği kullanıyor. Section 3.2'den sonra 3.3 (GA4: analytics.readonly/edit) ve 3.4 (GTM: tagmanager.readonly/edit.containers/publish) section'ları EN + TR eklendi; component'e JSX render eklendi (anahtarlar otomatik render edilmiyordu). Section 9'a email eklendi, "Last updated: November 20, 2025 / Son güncelleme: 20 Kasım 2025" eklendi. 3.1/3.2 ve 4.1 Limited Use'a dokunulmadı, URL'ler korundu.
- **Dosyalar:** `locales/en.json`, `locales/tr.json`, `components/legal/PrivacyPolicyContent.tsx`, `docs/CHANGELOG.md`

## 2026-05-20 — A6: Supabase env split-brain teşhisi + kod hardening
- **Sorun:** İki Supabase projesi karışıklığı. `omddq…` canlı (tüm tablolar var: user_business_profiles, ai_engine_runs, yoai_daily_runs, ai_suggestions — REST 200), `fbqr…` ölü (HTTP 000/DNS yok). 2026-05-19 env düzenlemesinde `NEXT_PUBLIC_SUPABASE_URL` fbqr→omddq değişmiş ama `SUPABASE_URL` fbqr'de kalmış (split). Üstüne kod tutarsızdı: ana server client `SUPABASE_URL||NEXT_PUBLIC` (→ölü fbqr), Meta modülleri `NEXT_PUBLIC||SUPABASE_URL` (→canlı omddq). Sonuç: AI engine'in yazdığı proje ≠ UI'ın okuduğu proje — audit'in "ai_engine_runs boş" bulgusunun kök nedeni.
- **Çözüm (Onur kararı: omddq canonical + güvenli kod hardening):** `lib/supabase/env.ts` tek noktası eklendi — `resolveSupabaseUrl/ServiceKey/AnonKey` (server-first: `SUPABASE_URL||NEXT_PUBLIC`, ana yazma client'ıyla aynı → kritik AI engine yolu davranış değiştirmez) + `warnIfSupabaseSplitBrain` (SUPABASE_URL≠NEXT_PUBLIC ise bir kez console.warn, crash yok). 4 modül (client.ts, audienceStore, meta/igVerifyStore, meta/discoveryCache) bu helper'a geçirildi → resolution sırası tutarlı. Production env'i Onur Vercel'de düzeltecek (repoint tek başına yapılmadı). 6/6 env testi.
- **⚠️ Deploy sırası (KRİTİK):** Bu branch prod'a çıkmadan ÖNCE Vercel'de `SUPABASE_URL` omddq'ya eşitlenmeli. Aksi halde server-first sıra Meta modüllerini de ölü fbqr'a yönlendirir.
- **Vercel remediation checklist (Onur):** (1) Supabase Dashboard → omddq → Settings → API → Project URL + `service_role`/`sb_secret` key kopyala. (2) Vercel env: `SUPABASE_URL`=omddq URL, `SUPABASE_SERVICE_ROLE_KEY` (ve varsa `SUPABASE_SERVICE_KEY`)=omddq secret, `NEXT_PUBLIC_SUPABASE_URL`=omddq (zaten), `NEXT_PUBLIC_SUPABASE_ANON_KEY`=omddq publishable (zaten). (3) fbqr'a ait tüm env değerlerini sil. (4) Redeploy. (5) Smoke scan tetikle → `ai_engine_runs` + `ai_suggestions.payload` omddq'da görünüyor mu doğrula.
- **Dosyalar:** `lib/supabase/env.ts` (yeni), `lib/supabase/client.ts`, `lib/audience/audienceStore.ts`, `lib/meta/igVerifyStore.ts`, `lib/meta/discoveryCache.ts`, `src/tests/supabaseEnvResolution.test.ts` (yeni), `docs/CHANGELOG.md`

## 2026-05-20 — A5: Tam ad spec çıktısı (ai_suggestions.payload JSONB)
- **Sorun:** AI motoru yalnızca optimizasyon önerileri (pause/budget/refresh) üretiyordu; `ai_suggestions.payload` JSONB kolonu boştu (`{}`). Proje amacındaki "tam ad spec" (campaign_type, cta, bütçe, hedefleme, başlıklar, açıklamalar, asset gereksinimleri) hiç üretilmiyordu.
- **Çözüm:** Onur kararıyla Seçenek 1 (mevcut payload JSONB, migration YOK — A6 DB karışıklığı çözülmeden risk sıfır). `types.ts`'e `AdSpecPayload` şeması eklendi (kind: optimization | new_ad_proposal + action + ad_spec). `adSpecPayload.ts` toleranslı manuel validator (Zod eklemeden — yeni bağımlılık yok): geçerli ad_spec → new_ad_proposal; eksik/bozuk → optimization fallback, scan asla kırılmaz. `agent.validateOutput` her recommended_action payload'ını Claude→typed sınırında normalize ediyor. System prompt'a tam ad_spec şeması + "kreatif üreten major aksiyonlarda tam spec üret, platform kurallarına+marka beyanına uy" direktifi eklendi. 8/8 validator testi + 3 temsili ad_spec örneği. Canlı scan env (Anthropic key boş + DB ölü) nedeniyle gerçek üretim çıktısı bu oturumda alınamadı. UI binding sonraki oturuma.
- **Dosyalar:** `lib/yoai/ai/types.ts`, `lib/yoai/ai/adSpecPayload.ts` (yeni), `lib/yoai/ai/agent.ts`, `lib/yoai/ai/systemPrompt.ts`, `src/tests/yoalgoritmaAdSpecPayload.test.ts` (yeni), `docs/CHANGELOG.md`

## 2026-05-20 — A4: Rakip reklam analizi AI motoruna bağlandı (3. ayak)
- **Sorun:** Apify rakip altyapısı çalışıyordu ama AI tarama motoruna HİÇ bağlı değildi (`lib/yoai/ai/*` içinde sıfır competitor referansı) — üç ayaklı analizin 3. ayağı kopuktu. Ayrıca scrape kullanıcının beyan ettiği rakip adlarıyla değil, kampanya keyword'leriyle çalışıyordu.
- **Çözüm:** İki yol eklendi. (1) READ (her zaman açık, ücretsiz): `competitorBrief.ts` pure builder + `competitorScanStep.loadCompetitorBrief` → cache'li `yoai_competitor_insights` + `yoai_competitor_ads` verisini "## Rakip Reklam Analizi" bloğuna çevirip platforma özel Claude payload'ına ekler (Google metinsiz kayıtları dürüstçe "metin mevcut değil" etiketler). gatherUserScanInputs competitorContext'i yükler, buildUserBrief gömer. (2) WRITE (flag ile, **varsayılan KAPALI**): `scrapeDeclaredCompetitors` — `YOALGORITMA_SCRAPE_COMPETITORS=true` ise beyan edilen rakipleri (max 3) Apify ile tarar, per-competitor 7 günlük cache, paralel, soft-fail; Inngest'e fetch'ten önce `scrape-competitors` step'i olarak eklendi. competitorScanner'a opsiyonel maxRecords cost cap (non-breaking). 6/6 smoke testi, A1-A3 regresyon yok. Token etkisi ~500-700/platform. NOT: write yolu prod maliyeti nedeniyle dormant — Onur Vercel'de flag açıp canlı test edince devreye girer.
- **Dosyalar:** `lib/yoai/ai/competitorBrief.ts` (yeni), `lib/yoai/ai/competitorScanStep.ts` (yeni), `lib/yoai/ai/scanUser.ts`, `lib/yoai/ai/agent.ts`, `lib/yoai/ai/systemPrompt.ts`, `lib/yoai/competitorScanner.ts`, `inngest/functions/yoalgoritmaScan.ts`, `src/tests/yoalgoritmaCompetitorBrief.test.ts` (yeni), `docs/CHANGELOG.md`

## 2026-05-20 — A3: Apify rakip normalizer veri kalitesi düzeltildi
- **Sorun:** Meta Ad Library actor'ı (curious_coder) reklam metnini `snapshot.{body.text, title, cta_text, link_url, cards[]}` altında nested veriyordu ama normalizer düz üst-seviye anahtarları okuyordu → ad_body/ad_title/cta hep null dönüyordu (rakip akışı bağlansa bile metin kaybolurdu). Google Transparency actor'ı (solidcode) ise hiç reklam metni döndürmüyordu, normalizer bunu sessizce null'lıyordu.
- **Çözüm:** `normalizeApifyMetaAd` nested snapshot okuyacak şekilde yeniden yazıldı: body.text / {markup.__html} HTML temizleme / cards[] carousel fallback / snapshot.images+videos → creative_assets / açık `is_active` boolean. Eski düz şema FALLBACK olarak korundu (backward compat). `normalizeApifyGoogleAd` dürüst `text_available` bayrağı ekledi (actor metin döndürmediğinde downstream "metin yok — advertiser/format/URL sinyali" olarak sunabilir). 9 birim testi (audit'in gerçek Trendyol payload şekliyle) eklendi, hepsi geçti. NOT: Google actor metin sınırı bir actor kısıtı; relevance sorunu A4'te tam-isim aramasıyla hafifletilecek.
- **Dosyalar:** `lib/yoai/apifyCompetitorProvider.ts`, `src/tests/apifyCompetitorNormalizer.test.ts` (yeni), `docs/CHANGELOG.md`

## 2026-05-20 — A2: Platform resmi reklam kuralları AI motoruna bağlandı (curated, cache'li)
- **Sorun:** Resmi Meta/Google reklam dokümanları (~140KB) AI tarama motorunun system prompt'una hiç bağlı değildi; öneriler karakter limiti, kampanya tipi uygunluğu, asset spec ve politikaya karşı doğrulanmıyordu (üç ayaklı analizin 2. ayağı eksik).
- **Çözüm:** Onur onayıyla Seçenek A (curated snippet) uygulandı. `docs/*.md`'den distile edilen `meta_ad_rules_curated.ts` (~1.45K tok) ve `google_ads_rules_curated.ts` (~1.62K tok) eklendi (karakter limitleri, objective/kampanya tipi matrisi, bidding, optimizasyon müdahale kuralları, politika kırmızı çizgileri). `buildSystemBlocks(platform)` taranan platforma göre ilgili kuralı system array'ine 2. cache'li blok olarak ekliyor (Meta scan'de Meta, Google scan'de Google — platform izolasyonu testle doğrulandı). System prompt'a "Platform reklam kuralları (uygunluk ZORUNLU)" direktifi eklendi. agent.ts hem streaming hem batch yolunda helper'ı kullanıyor. 7/7 smoke testi geçti.
- **Dosyalar:** `lib/yoai/ai/docs/meta_ad_rules_curated.ts` (yeni), `lib/yoai/ai/docs/google_ads_rules_curated.ts` (yeni), `lib/yoai/ai/systemPrompt.ts`, `lib/yoai/ai/agent.ts`, `src/tests/yoalgoritmaPlatformRules.test.ts` (yeni), `docs/CHANGELOG.md`

## 2026-05-20 — A1: Kullanıcı beyanı + iş zekası AI motoruna tam bağlandı
- **Sorun:** Haftalık AI tarama motoru kullanıcının kendi marka beyanından yalnızca 6 alan gönderiyordu (sektör, iş tanımı, ton, hedef kitle, dönüşüm hedefi) ve bunu 1500 karaktere kırpıyordu. Marka adı, ürün/hizmetler, anahtar kelimeler, lokasyon, yasaklı iddialar, rakipler ve hazır `user_business_intelligence` Claude'a hiç gitmiyordu — "aşçılık sertifikası → aşçı iş ilanı" tipi alakasız öneri riski.
- **Çözüm:** Yeni pure builder `lib/yoai/ai/scanBusinessBrief.ts` eklendi; `getBusinessContextForUser` (profil + rakipler + intelligence tek noktada) sonucunu Claude payload'ına gidecek tam markdown'a çeviriyor. Kullanıcı beyanı = birincil/kırpılmaz (iş tanımı tam metin), intelligence = ikincil/kapatılabilir enrichment. `loadBusinessContext` minimal sorgu yerine bu builder'ı kullanıyor; `buildUserBrief` 1500 char clamp'i kaldırıldı; system prompt'a "marka uygunluğu (ZORUNLU)" direktifi eklendi. Token etkisi: Belgemod örneğinde ~150 → ~920 token (+770, 50K bütçenin çok altında — sıkıştırma gereksiz). 10/10 builder smoke testi geçti.
- **Dosyalar:** `lib/yoai/ai/scanBusinessBrief.ts` (yeni), `lib/yoai/ai/scanUser.ts`, `lib/yoai/ai/systemPrompt.ts`, `src/tests/yoalgoritmaScanBusinessBrief.test.ts` (yeni), `docs/CHANGELOG.md`

## 2026-05-20 — YoAlgoritma bağlam audit raporu
- **Sorun:** Haftalık AI tarama motorunun, proje amacındaki üç ayaklı analiz prensibine (aktif reklamlar + platform kuralları + rakip analizi) ve business profile zorunluluğuna uyumu denetlenmemişti.
- **Çözüm:** Salt okuma + kod izleme + canlı Apify testiyle audit yapıldı. Bulgular: aktif filtre Meta/Google ✅; platform docs entegrasyonu ❌ (system prompt'ta yok); Apify altyapısı var ama AI motoruna bağlı değil ❌ (lib/yoai/ai/* içinde sıfır competitor referansı); business profile context kısmi ⚠ (6 alan gidiyor; marka adı/ürünler/rakipler/intelligence gitmiyor); tam ad spec üretilmiyor ❌. Canlı test: iki actor da SUCCEEDED (<$0.01), ama Meta normalizer nested snapshot'ı kaçırıyor + Google actor reklam metni döndürmüyor. 6 öncelikli aksiyon (A1-A6) listelendi; en yüksek getiri A3 (mevcut user_business_intelligence'ı payload'a eklemek).
- **Dosyalar:** `docs/yoalgoritma_context_audit.md` (yeni)

## 2026-05-20 — YoAlgoritma proje amacı + Google resmi dokümanlar + index
- **Sorun:** YoAlgoritma'nın iş kuralları (üç ayaklı analiz, aktif-only, business profile zorunluluğu, tam ad spec çıktısı) ve resmi platform dokümanlarının AI engine'e nasıl bağlanacağı yazılı referans olarak yoktu.
- **Çözüm:** `docs/yoalgoritma_proje_amaci.md` (sistem amacı + 7 değişmez iş kuralı + DoD) yazıldı. Google Ads 2026 PDF'leri (Temel/Orta + İleri Seviye + kaynakça) sadık transkripsiyonla Markdown'a aktarıldı. `docs/resmi_dokumanlar_index.md` ile her dokümanın hangi AI görevinde referans alınacağı + system prompt'a bağlama stratejisi (Seçenek A cache'li gömme / Seçenek B RAG-lite) tanımlandı.
- **Dosyalar:** `docs/yoalgoritma_proje_amaci.md` (yeni), `docs/google_ads_resmi_dokumanlari.md` (yeni, ~51KB), `docs/resmi_dokumanlar_index.md` (yeni), `docs/CHANGELOG.md`

## 2026-05-20 — Meta resmi reklam dokümanları konsolidasyonu
- **Sorun:** Resmi Meta Ads 2026 eğitim PDF'leri (Temel/Orta + İleri Seviye Mühendislik + kaynak listeleri) proje bilgi tabanında yapılandırılmış tek bir Markdown dosyası olarak yoktu.
- **Çözüm:** Üç PDF ve iki kaynak `.txt` dosyası birebir (özet değil, sadık transkripsiyon) Markdown'a aktarıldı; tüm spec/limit tabloları Markdown tablosuna çevrildi, karakter limitleri, asset oranları, event parametreleri, kampanya tipleri ve politika kuralları korundu. Türkçe içerik çevrilmedi.
- **Dosyalar:** `docs/meta_resmi_reklam_dokumanlari.md` (yeni, ~87KB), `docs/CHANGELOG.md`

## 2026-05-19 — submit-batch fix (custom_id pattern violation)
- **Sorun:** Sync düzeldikten sonra ilk run `submit-batch` adımında `400 invalid_request_error — requests.0.custom_id: String should match pattern '^[a-zA-Z0-9_-]{1,64}$'` ile düştü. custom_id `${userId}|${platform}|${accountId}` şeklinde üretiliyor, `|` karakteri Anthropic Batch API pattern'inde yasak.
- **Çözüm:** [inngest/functions/yoalgoritmaScan.ts](inngest/functions/yoalgoritmaScan.ts) içinde separator `|` → `_` ve emniyet için izinli set dışındaki karakterleri `_` ile değiştiren regex eklendi; sonra 64 char slice. Hatanın gerçek mesajı Inngest REST API `GET /v2/runs/{runId}/trace?includeOutput=true` ile çekildi.
- **Dosyalar:** `inngest/functions/yoalgoritmaScan.ts`, `docs/CHANGELOG.md`

## 2026-05-19 — Inngest sync fix (concurrency 10→5)
- **Sorun:** Cron `yoalgoritma/scan.user` event'ini yolluyordu ama Inngest function tetiklenmiyordu (`ai_engine_runs` boş). Inngest REST API ile sync denendiğinde `POST /v2/apps/yoai-ai-engine/syncs` `422 concurrency_limit` döndü — "function concurrency 10 > plan limit 5". Bu yüzden Vercel integration her sync denemesinde reddediliyor, function kayıt edilemiyor; queue'daki event (`01KS12K…`) işleme alınamıyordu.
- **Çözüm:** `inngest/functions/yoalgoritmaScan.ts` içindeki `concurrency: { limit: 10 }` → `5` indirildi (Inngest Free plan tavanı). Header yorumu da güncellendi. Deploy sonrası `POST /v2/apps/yoai-ai-engine/syncs` ile manuel sync tetiklendi, bekleyen event işlenmeye başladı.
- **Dosyalar:** `inngest/functions/yoalgoritmaScan.ts`, `docs/CHANGELOG.md`

## 2026-05-19 — YoAlgoritma AI Engine Test Planı
- **Sorun:** Faz 2 kod ve migration prod'a alındı (USE_AI_ENGINE=false ile dormant). Açma öncesi sistematik doğrulama için bir test prosedürü yazılı kaynak olarak gerekiyordu.
- **Çözüm:** `docs/yoalgoritma_test_plan.md` yazıldı. İçerik: ön koşul tablosu, Preview test prosedürü (3 manuel tetikleme yöntemi — UI bootstrap / cron simulation / single-user POST — `CRON_SECRET` Authorization header kullanımı dahil), 5 SQL doğrulama sorgusu (`ai_engine_runs` token aralıkları 20K-80K input normal kabul edildi, `ai_suggestions` confidence varyansı `STDDEV>=10`, `ai_alerts` severity dağılımı, reasoning kalite check, günlük token bütçe + USD tahmini Sonnet 4.6 fiyatlamasıyla), 6 red flag eşiği (süre>5dk, token>200K, STDDEV<5, hata oranı>%20, generic reasoning, tutarsız öneri) ve her biri için tek-komut rollback talimatı, production'a açma 8-maddelik final checklist. Setup adımları: Vercel env pull yapıldı + Vercel Development env'inde olmayan local-only key'ler (SUPABASE_SERVICE_KEY, APIFY_*, vd.) yedekten merge edildi. Supabase migration kullanıcı tarafından Dashboard SQL Editor üzerinden uygulandı (4 tablo: `ai_engine_runs`, `ai_alerts`, `ai_opportunities`, `ai_suggestions`).
- **Dosyalar:** `docs/yoalgoritma_test_plan.md`

## 2026-05-19 — YoAlgoritma AI Engine Upgrade Faz 2: Rebuild (Claude Sonnet 4.6 + Tool Use + Agentic Loop)
- **Sorun:** Faz 1 audit'i rule-engine'in 6 kök nedenle generic çıktı verdiğini kanıtladı (hardcoded confidence, dar metrik whitelist, per-account context yok, vs.). Claude API + tool use + agentic loop ile gerçek AI tabanlı sisteme geçilmeli.
- **Çözüm:** Tam Faz 2 mimarisi kuruldu. `@anthropic-ai/sdk` ^0.97 + `inngest` ^4.4 dependency'leri eklendi. 4 yeni Supabase tablosu (`ai_engine_runs`, `ai_alerts`, `ai_opportunities`, `ai_suggestions`) + RLS + touch trigger migration'ı yazıldı. 6+1 tool tanımı yapıldı (`get_account_overview`, `get_campaign_metrics`, `get_adset_breakdown`, `get_creative_performance`, `compare_vs_benchmark`, `detect_anomaly`, `rule_engine_evidence` — mevcut deterministic rule engine'i koruyup Claude'a evidence kaynağı olarak verdi). Claude Sonnet 4.6 + adaptive thinking + prompt-cached system prompt ile manual agentic loop yazıldı (max 15 iteration, 16K max_tokens, typed Anthropic exception handling, JSON çıktısı parse + validate). Per-user scan orchestrator fetcher'ları parallel çağırıp her platform için Claude'u koşturuyor, sonuç hem `ai_*` tablolarına hem `yoai_daily_runs.command_center_data`'ya (mevcut UI ile uyumlu DeepAnalysisResult formatında) yazıyor — frontend bozulmadan gerçek confidence + reasoning gösteriyor. Inngest function + serve endpoint + cron endpoint (`/api/cron/yoalgoritma-scan`) yazıldı; Inngest yoksa graceful inline fallback. `USE_AI_ENGINE` feature flag eski/yeni flow arasında geçiş yapıyor — flag ON iken `/api/yoai/daily-run` no-op'a düşüyor (çakışma yok), POST manuel bootstrap AI engine'e delege ediyor. `vercel.json`'a yeni cron (`0 5 * * *` 08:00 TR), `package.json`'a `db:migrate:ai-engine` script. Meta/Google entegrasyon dosyalarına dokunulmadı — fetcher'lar sarmalandı. `npm run build` başarılı (tüm rotalar derlendi, TS hatasız).
- **Dosyalar:** `package.json`, `package-lock.json`, `vercel.json`, `app/api/yoai/daily-run/route.ts` (feature flag delegation), `lib/anthropic/client.ts`, `inngest/client.ts`, `inngest/functions/yoalgoritmaScan.ts`, `app/api/inngest/route.ts`, `app/api/cron/yoalgoritma-scan/route.ts`, `lib/yoai/featureFlag.ts`, `lib/yoai/ai/types.ts`, `lib/yoai/ai/systemPrompt.ts`, `lib/yoai/ai/tools/index.ts`, `lib/yoai/ai/agent.ts`, `lib/yoai/ai/persist.ts`, `lib/yoai/ai/scanUser.ts`, `supabase/migrations/20260519000000_create_ai_engine_tables.sql`, `scripts/apply-ai-engine-migration.mjs`

## 2026-05-19 — YoAlgoritma AI Engine Upgrade Faz 1: Audit Raporu
- **Sorun:** YoAlgoritma "Kural Motoru" generic, template-driven öneriler üretiyor — verim alınamıyor. Claude API + tool use + agentic loop ile rebuild gerekiyor; önce mevcut sistemin tam haritası ve teşhisi lazım.
- **Çözüm:** Kapsamlı audit yapıldı. Sayfa & UI haritası, 13 API rotasının tablosu, Meta + Google rule engine derin incelemesi, confidence skorlarının sahte olduğu kanıtlandı ([adCreator.ts:474](lib/yoai/adCreator.ts#L474)), kullanılan/kullanılmayan metrikler, 10 Supabase tablosu durumu, Anthropic / Inngest / Vercel cron altyapısı incelendi. 6 kök neden tespit edildi (kopuk confidence, dar metrik whitelist, per-account context yok, generic template, tek-AI decision desk, teşhis-aksiyon kopuklugu). Korunacak / yenilenecek / deprecate edilecek liste ile Faz 2 mimarisi belgelendi. Faz 2 (rebuild) onay bekliyor — kod değişikliği yok.
- **Dosyalar:** `docs/yoalgoritma_audit.md`

## 2026-05-15 — Kurumsal ve Gözetim Merkezi Sol Menüden Kaldırıldı
- **Sorun:** Kurumsal (yasal linkler) ve Gözetim Merkezi ana sidebar nav'da görünüyordu; bu öğeler kullanıcı profil dropdown'ında olmalıydı.
- **Çözüm:** `lib/nav.ts`'ten kurumsal accordion item'ı silindi. `SidebarNav.tsx`'te `gozetimMerkeziNavItem` enjeksiyonu kaldırıldı, `hasGozetimAccess` prop'u `UserProfileDropdown`'a geçildi. `UserProfileDropdown.tsx`'e iki yeni bölüm eklendi: admin için `ShieldCheck` ikonlu "Gözetim Merkezi" linki (yalnızca `hasGozetimAccess === true`) ve tüm kullanıcılar için "Kurumsal" bölümü (Gizlilik Politikası, Çerez Politikası, Kullanım Koşulları, Veri Silme).
- **Dosyalar:** `lib/nav.ts`, `components/SidebarNav.tsx`, `components/UserProfileDropdown.tsx`

## 2026-05-16 — Strateji Migration Uygulama Script'i
- **Sorun:** Strateji migration'larını uygulamak için Supabase Dashboard'a girip SQL Editor'a yapıştırmak gerekiyordu — manuel ve hata yapmaya açık.
- **Çözüm:** `scripts/apply-strategy-migrations.mjs` script'i eklendi. Proje genelindeki `apply-google-ads-migration.mjs` pattern'ine uygun: `DATABASE_URL` `.env.local`'dan okunur, `pg` client ile direkt bağlanır, 2 migration sırasıyla uygulanır, `RAISE NOTICE` çıktıları terminale yansır. `npm run db:migrate:strategy` komutuyla çalışır. `DATABASE_URL` yoksa net hata mesajı ve Supabase Dashboard linki verir.
- **Dosyalar:** `scripts/apply-strategy-migrations.mjs`, `package.json`

## 2026-05-16 — Strateji NULL user_id Backfill Migration
- **Sorun:** `20260516000000` migrasyonu öncesinde oluşturulmuş `strategy_instances` kayıtları `user_id = NULL` taşıyor. Yeni GET filtresinde (`.eq('user_id', ctx.userId)`) bu kayıtlar dışarıda kalıyor — kullanıcı eski stratejilerini göremez.
- **Çözüm:** Güvenli (unambiguous) backfill migration yazıldı. `meta_connections.selected_ad_account_id` → `strategy_instances.ad_account_id` JOIN ile eşleşme yapılır. Aynı `ad_account_id`'ye birden fazla `user_id` karşılık geliyorsa o kayıtlara dokunulmaz (ambiguous). `act_` prefix normalizasyonu (`REPLACE`) yapılır; eski kayıtlarda prefix olmayabilir. Hiçbir kayıt silinmez. Orphan (eşleşme bulunamayan) kayıtlar NULL kalır, GET'te görünmez — bu kasıtlıdır. Migration idempotent: tekrar çalıştırılabilir. `RAISE NOTICE` ile güncellenen / ambiguous / orphan sayısı raporlanır. 10 yeni statik analiz testi eklendi.
- **Dosyalar:** `supabase/migrations/20260516100000_strategy_instances_user_id_backfill.sql`, `src/tests/strategySecurityTests.test.ts`

## 2026-05-16 — Strateji Faz 1+2 Final Blocker Fix: GET izolasyonu + Owner bypass + Testler
- **Sorun:** (1) GET `/api/strategy/instances` yalnızca `ad_account_id` filtresi kullanıyordu → aynı Meta hesabını kullanan iki farklı kullanıcı birbirinin stratejilerini görebiliyordu. (2) `onursuay@hotmail.com` owner hesabı plan/kredi/aylık limit engeline takılıyordu — backend'de bypass yoktu. (3) Faz 1+2 değişikliklerini doğrulayan otomatik test yoktu.
- **Çözüm:** (1) GET handler'a `.eq('user_id', ctx.userId)` eklendi — çift izolasyon: `ad_account_id` + `user_id`. (2) `SUPER_ADMIN_EMAILS = ['onursuay@hotmail.com']` sabiti ve `isOwner(userId)` DB sorgusu eklendi (signups tablosundan email doğrulaması, case-insensitive). POST handler'da `if (!ownerMode)` bloğu: plan limit kontrolü, aylık sayım, kredi kontrolü, RPC düşme — tamamı owner'da atlanıyor. Instance oluşturma ve user_id kaydı her durumda çalışıyor. (3) `src/tests/strategySecurityTests.test.ts` dosyası oluşturuldu: 30 statik analiz testi — migration yapısı, GET çift filtreleme, owner bypass, normal kullanıcı kontrolleri, cross-user orphan koruması. Tüm testler geçiyor.
- **Dosyalar:** `app/api/strategy/instances/route.ts`, `src/tests/strategySecurityTests.test.ts`

## 2026-05-16 — Strateji Faz 1+2: RLS Güvenlik Katmanı + Backend Kredi Enforce
- **Sorun:** `strategy_instances`, `strategy_inputs`, `strategy_outputs`, `strategy_tasks`, `sync_jobs`, `metrics_snapshots` tablolarında RLS ENABLED ama hiçbir policy tanımlı değildi → cross-tenant veri erişim riski. POST `/api/strategy/instances` endpoint'i kredi ve plan limitini kontrol etmiyordu → frontend bypass ile sınırsız strateji oluşturulabiliyordu. `strategy_tasks.category` CHECK constraint'i 'optimization' değerini içermiyordu → job-runner'ın optimize job'u DB hatasıyla başarısız oluyordu.
- **Çözüm:** (1) `strategy_instances` tablosuna `user_id TEXT` kolonu + index eklendi. (2) Tüm 6 strateji tablosuna SELECT/INSERT/UPDATE/DELETE RLS policy'leri yazıldı (root tablo `user_id` karşılaştırması, child tablolar strategy_instances'a EXISTS JOIN ile). Pattern: `COALESCE(auth.uid()::text, current_setting('request.jwt.claim.sub', true))` — proje genelindeki audiences tablosuyla tutarlı. (3) Atomik `deduct_strategy_credit(p_user_id uuid, p_cost int DEFAULT 10)` PostgreSQL RPC fonksiyonu eklendi — `balance >= cost` olmadan UPDATE yapmaz, race-condition'a karşı güvenli. (4) POST endpoint'e plan limiti kontrolü eklendi: DB'deki `subscriptions` tablosundan plan okunur, aylık strateji sayısı sayılır, limit aşıldığında 429 döner. Trial/expired kontrolü yapılır. Row yoksa soft default 3/ay uygulanır. (5) credit_balances satırı yoksa 100 krediyle auto-upsert yapılır (trial kullanıcı deneyimi korunur). (6) POST artık `user_id` alanını INSERT row'una ekler. Yanıtta `creditsRemaining` döner. (7) `strategy_tasks.category` CHECK constraint'i 'optimization' içerecek şekilde güncellendi.
- **Dosyalar:** `supabase/migrations/20260516000000_strategy_user_id_rls.sql`, `app/api/strategy/instances/route.ts`

---

## 2026-05-15 — YoAlgoritma Faz 1: Yanıltıcı UI Temizliği
- **Sorun:** (1) `ApprovalFlowPreview` bileşenindeki "İncele" butonu, "Onayla" ile aynı `handleApprove` fonksiyonunu çağırıyordu — copy-paste bug, kullanıcı incelemek isterken aksiyonu tetikleyebilirdi. (2) `HealthOverviewCards` içinde "İyileştirme Fırsatları" ve "Önerilen Aksiyonlar" subtitle metinleri hardcoded olup gerçek sayıdan bağımsız her zaman aynı ifadeyi gösteriyordu.
- **Çözüm:** (1) "İncele" butonu artık `handleExpand` çağırıyor: kart açılıyor/kapanıyor, tam açıklamayı gösteriyor, hiçbir approval/execution tetiklenmiyor. Buton metni genişleme durumuna göre "İncele"/"Kapat" oluyor. (2) "İyileştirme Fırsatları" subtitle'ı `health.opportunities > 0` koşuluna, "Önerilen Aksiyonlar" subtitle'ı `health.draftActions > 0` koşuluna bağlandı. Sıfır olduğunda "Kritik fırsat yok" / "Öneri oluşturulmadı" gösteriyor. "Bekleyen Onaylar" ifadesi de "İncelemenizi bekliyor" olarak nötürleştirildi. `policyGuard.ts` `one-click-approve` route'unda aktif kullanımda olduğu doğrulandı, dokunulmadı. `ctrBenchmark` değerlerinin yalnızca engine-içi fit scoring'de kullanıldığı, kullanıcıya hiç gösterilmediği doğrulandı.
- **Dosyalar:** `components/yoai/ApprovalFlowPreview.tsx`, `components/yoai/HealthOverviewCards.tsx`

## 2026-05-15 — Gözetim Merkezi Signup Management Cleanup + Real Blocklist System
- **Sorun:** Gözetim Merkezi'nde "Hata Takibi" ve "Son Kayıt Olan Kullanıcılar" alanları gereksiz yük oluşturuyordu. Owner onay/red listesinde normal kullanıcı gibi görünüyordu. Detay ekranı sağ drawer olarak açılıyordu. Reddet yanında Engelle aksiyonu yoktu. Blocklist sadece görsel değil, gerçek backend koruması yoktu.
- **Çözüm:** (1) Hata Takibi ve Son Kayıt Olan Kullanıcılar kaldırıldı. (2) Owner/süper admin (onursuay@hotmail.com) başvuru listesi ve KPI sayılarından çıkarıldı. (3) Detay sağ drawer → ortalanmış blur-modal. (4) Engelle butonu eklendi: 6 seçenekli modal (user/email/domain/ip/hepsi/manuel-inceleme). (5) Manuel İnceleme statüsü (approval_status='manual_review') eklendi. (6) `signup_blocklist` tablosu DB'ye eklendi (RLS, partial unique index). (7) signup/login/verify/premeeting route'larına gerçek blocklist guard'ı eklendi. (8) blocked/manual_review kullanıcılar /basvuru-durumu'nda özel mesaj görür. (9) Yeni başvuru sesli uyarı sistemi (toggle + localStorage + AudioContext + toast).
- **Dosyalar:** `supabase/migrations/20260515200000_signup_blocklist.sql`, `lib/admin/blocklist.ts`, `lib/auth/accountApproval.ts`, `app/api/admin/signups/route.ts`, `app/api/admin/signups/[id]/block/route.ts`, `app/api/admin/signups/[id]/manual-review/route.ts`, `app/api/signup/route.ts`, `app/api/auth/login/route.ts`, `app/api/signup/verify/route.ts`, `app/api/signup/premeeting/schedule/route.ts`, `app/api/signup/premeeting/decline/route.ts`, `app/basvuru-durumu/page.tsx`, `components/gozetim/SignupApprovalsPanel.tsx`, `app/gozetim-merkezi/GozetimMerkeziClient.tsx`, `src/tests/signupBlocklist.test.ts`, `src/tests/gozetimMerkeziUiCleanup.test.ts`

## 2026-05-15 — Hedef Kitle Faz 11: UX Cleanup
- **Sorun:** (1) Silme butonu tek tıkla kalıcı siliyordu — geri alınamaz. (2) POPULATING/CREATING kitleler cron güncelleyene kadar UI'da bayat kalıyordu. (3) AI sekmesinde "Yeni Kitle" butonu wizard açıyordu ama AI kitleleri wizard'dan değil Strateji modülünden geliyor.
- **Çözüm:** (1) `AudienceCard` 2-step delete confirm: "Sil" → "Emin misin? Evet / İptal". 4 saniye içinde onaylanmazsa veya kart kapanırsa otomatik iptal. (2) `page.tsx` auto-poll: CREATING/POPULATING audience varken her 30 saniyede `fetchAudiences` çalışır, hepsi terminal duruma geçince interval temizlenir. (3) `activeTab === 'AI'` iken "Yeni Kitle" butonu render edilmez.
- **Dosyalar:** `components/hedef-kitle/AudienceCard.tsx`, `app/hedef-kitle/page.tsx`

## 2026-05-15 — Hedef Kitle Faz 9: Arka Plan Sync Cron
- **Sorun:** POPULATING/CREATING durumundaki Meta kitleleri otomatik olarak READY/ERROR/DELETED durumuna geçmiyordu; kullanıcı "Senkronize Et" butonuna manuel basması gerekiyordu.
- **Çözüm:** `GET /api/cron/audiences-sync` endpoint'i oluşturuldu. Vercel Cron ile her saat başı çalışır. DB'den `CREATING` veya `POPULATING` statüsündeki ve `meta_audience_id` atanmış tüm kitleleri çeker; `user_id` bazında gruplar; her kullanıcının Meta bağlantısını alır; `/{metaAudienceId}?fields=id,approximate_count_lower_bound,...` ile durum sorgular. `operation_status.code === 200` ya da `approximate_count_lower_bound > 0` → READY; Meta error 100 → DELETED; `opCode >= 400` → ERROR. Tüm DB güncellemeleri `.eq('user_id', userId)` ile güvenli şekilde kısıtlanır. `vercel.json`'a `"schedule": "0 * * * *"` cron kaydı eklendi.
- **Dosyalar:** `app/api/cron/audiences-sync/route.ts` (yeni), `vercel.json`

## 2026-05-15 — Hedef Kitle Faz 7: DRAFT Edit UI
- **Sorun:** DRAFT durumundaki kitleler liste ekranında düzenlenemiyordu; hata yapıldığında tek seçenek silip yeniden oluşturmaktı.
- **Çözüm:** `AudienceCard` DRAFT kartlarına "Düzenle" (Pencil) butonu eklendi. Butona basıldığında wizard edit modda açılır: mevcut `yoai_spec_json` parse edilerek Custom/Lookalike/Saved state'i reconstruct edilir, form dolu gelir. Kaydet'e basıldığında `PATCH /api/audiences/[id]` çağrılır (Meta'ya gönderim yapılmaz — kullanıcı listeden "Meta'ya Gönder" ile manuel tetikler). Confirm ekranı edit/create moduna göre farklı metin gösterir. `UnifiedAudience`'a `yoaiSpecJson?` eklendi. Tüm 99 test geçiyor.
- **Dosyalar:** `components/hedef-kitle/AudienceCard.tsx`, `components/hedef-kitle/AudienceList.tsx`, `components/hedef-kitle/AudienceWizardModal.tsx`, `components/hedef-kitle/wizard/types.ts`, `app/hedef-kitle/page.tsx`

## 2026-05-15 — Hedef Kitle Faz 3: Business Context Seed Prefill
- **Sorun:** Wizard'ın tüm formlari (Custom/Lookalike/Saved) tamamen boş başlıyordu; kullanıcı onboarding'de girdiği hedef kitle açıklaması wizard'a taşınmıyordu.
- **Çözüm:** `AudienceWizardModal` mount'ta `/api/audiences/business-context` çeker, `seedHintsRef` (useRef) ile saklar, modal her açılışında ve `reset()` çağrısında `declaredTargetAudience` değerini 3 wizard türünün `description` alanına prefill eder. İş profili yüklenmemişse veya fetch başarısız olursa sessizce boş string fallback — mevcut davranış korunur. Location/country alanları prefill edilmez (Meta key formatı uyumsuz). `audienceFaz3SeedPrefill.test.ts` (19 test) eklendi. Toplam 99 test, 0 hata.
- **Dosyalar:** `components/hedef-kitle/AudienceWizardModal.tsx`, `src/tests/audienceFaz3SeedPrefill.test.ts` (yeni)

## 2026-05-15 — Hedef Kitle Faz 2: Lookalike Seed Güvenliği + Binding Testleri
- **Sorun:** Lookalike seed lookup'ta `user_id` / `ad_account_id` filtresi yoktu — başka kullanıcının seed audience ID'si bilinirse kendi lookalike'ına referans olarak eklenebilirdi. Faz 2 binding kapsamı için test kanıtı da yoktu.
- **Çözüm:** `[id]/create/route.ts` seed lookup'a `.eq('ad_account_id', ctx.accountId).eq('user_id', ctx.userId)` eklendi. `audienceUserIdBinding.test.ts` (21 test) eklendi: migration SQL kontrolü, MetaContext userId alanı, 5 route user_id filtresi, seed cross-user engeli, orphan NULL fallback yokluğu. Toplam 80 test, 0 hata, TypeScript sıfır hata.
- **Dosyalar:** `app/api/audiences/[id]/create/route.ts`, `src/tests/audienceUserIdBinding.test.ts` (yeni)

## 2026-05-15 — Hedef Kitle Faz 2: user_id Bağlama + RLS
- **Sorun:** `audiences` tablosunda `user_id` kolonu yoktu; tüm sorgular yalnızca `ad_account_id` ile izole ediliyordu — aynı reklam hesabını kullanan farklı kullanıcılar birbirinin kitlesini görebilirdi.
- **Çözüm:** `user_id TEXT` kolonu eklendi, DB indexi oluşturuldu, tablo RLS etkinleştirildi (SELECT/INSERT/UPDATE/DELETE policy). `MetaContext` arayüzüne `userId` alanı eklendi ve tüm audience API route'larında (list, create, get, patch, delete, sync, meta-create) `.eq('user_id', ctx.userId)` filtresi + INSERT'e `user_id` yazımı eklendi. 59 mevcut test geçti, TypeScript sıfır hata.
- **Dosyalar:** `supabase/migrations/20260515100000_audiences_user_id_rls.sql` (yeni), `lib/meta/context.ts`, `app/api/audiences/route.ts`, `app/api/audiences/[id]/route.ts`, `app/api/audiences/[id]/create/route.ts`, `app/api/audiences/sync/route.ts`, `lib/yoai/metaDeepFetcher.ts`

## 2026-05-15 — Hedef Kitle Faz 1 Test Coverage
- **Sorun:** Faz 1 değişikliklerinin (copy, exclude payload, confirmation) test kanıtı yoktu.
- **Çözüm:** 2 yeni test dosyası eklendi. `audiencePayloadBuilder.test.ts`: 35 test — PIXEL/IG/PAGE/VIDEO/LEADFORM include/exclude payload doğruluğu, cross-source exclusion throw, unsupported source throw, Lookalike ratio/country, SavedAudience targeting. `audienceWizardConfirmation.test.ts`: 24 test — StepSummary copy regresyon, confirm phase varlığı, navigateStep onay bypass yokluğu, pendingSubmitType flow, amber/yellow renk regresyon (20 dosya). Mevcut 11 BI context testi de geçti. Toplam 70 test, 0 hata.
- **Dosyalar:** `src/tests/audiencePayloadBuilder.test.ts` (yeni), `src/tests/audienceWizardConfirmation.test.ts` (yeni)

## 2026-05-15 — Hedef Kitle Faz 1A/1B: Copy + Payload + Confirmation Fix
- **Sorun:** 3 wizard StepSummary'de "Meta'ya gönderim Faz 2'de aktif edilecek" yanıltıcı metni vardı; exclude rules payload'a kaynak tipi taşınmıyordu; CATALOG/APP/OFFLINE/CUSTOMER_LIST seçilince generic ENGAGEMENT fallback ile Meta'ya yanlış payload gönderiliyordu; kullanıcı onayı olmadan Meta'ya audience oluşturuluyordu; 6 dosyada amber/yellow Tailwind ihlali mevcuttu.
- **Çözüm:** Tüm StepSummary metinleri gerçeği yansıtacak şekilde güncellendi. Wizard son adımında "Oluştur ve Meta'ya Gönder" confirmation modal'ı eklendi — kullanıcı açık onay vermeden Meta'ya POST yapılmıyor. Exclude rules payloadBuilder'da: PIXEL exclusions filtre bilgisini taşıyor; IG/PAGE/VIDEO/LEADFORM case'lerine event_sources içeren exclusion handling eklendi; cross-source exclusion hata fırlatıyor. Desteklenmeyen kaynak tipleri (CATALOG/APP/OFFLINE/CUSTOMER_LIST) artık throw ile engelleniyor; StepSource'ta disabled; StepRule'da "desteklenmiyor" mesajı. Amber/yellow ihlalleri CLAUDE.md kuralına uygun palet ile değiştirildi.
- **Dosyalar:** `components/hedef-kitle/AudienceWizardModal.tsx`, `components/hedef-kitle/wizard/types.ts`, `components/hedef-kitle/wizard/AudienceWizardNavigation.tsx`, `components/hedef-kitle/wizard/custom/StepSummary.tsx`, `components/hedef-kitle/wizard/custom/StepExclude.tsx`, `components/hedef-kitle/wizard/custom/StepSource.tsx`, `components/hedef-kitle/wizard/custom/StepRule.tsx`, `components/hedef-kitle/wizard/lookalike/StepSummary.tsx`, `components/hedef-kitle/wizard/saved/StepSummary.tsx`, `components/hedef-kitle/wizard/saved/StepExclude.tsx`, `lib/meta/audiences/payloadBuilder.ts`

## 2026-05-15 — Başvuru Durumu / Ön Görüşme Kartı UI Polish
- **Sorun:** `/basvuru-durumu` ekranı ve `PreMeetingApprovalModal` kartı dar, küçük ikonlu ve animasyonsuzdu; premium hissi vermiyordu.
- **Çözüm:** Her iki kart genişletildi (max-w-xl→max-w-2xl / max-w-md→max-w-lg), padding ve başlık boyutları artırıldı (text-3xl), ikon alanı büyütüldü (h-16→h-20) ve pulse/glow animasyonu eklendi. Kart mount sırasında fade+scale-in girişi, footer metni gecikmeli fade-in ile gösteriliyor. Birincil CTA butonlarına renkli shadow eklendi; ikincil CTA metin kontrası iyileştirildi. Hiçbir onay/ön görüşme/API/guard/mail mantığına dokunulmadı.
- **Dosyalar:** `app/basvuru-durumu/page.tsx`, `components/signup/PreMeetingApprovalModal.tsx`

## 2026-05-15 — Manuel Signup Approval + Ön Görüşme Planlama Akışı
- **Sorun:** Kayıt formu dolduran herkes email doğrulamasından sonra otomatik olarak `/dashboard`'a düşüyor ve YoAi'nin tüm iç panellerine (Optimizasyon, Strateji, YoAlgoritma, Hedef Kitle, Tasarım, vb.) doğrudan erişebiliyordu. Owner manuel onay/red verme imkânı, ön görüşme akışı, owner bildirim maili, başvuru loglaması ve "değerlendirme aşamasında" UX yoktu.
- **Çözüm:** Tam manuel onay akışı kuruldu. `signups` tablosuna `approval_status` (pending|approved|rejected|call_scheduled|call_declined), `premeeting_status` (pending|scheduled|declined) ve bağlı meta-alanlar eklendi (`approved_at`, `approved_by`, `rejected_at`, `rejected_by`, `approval_note`, `signup_source`, `premeeting_*`). Yeni `signup_premeeting_bookings` tablosu (unique scheduled_at index ile slot çakışmasını engelliyor) + `notification_log` tablosu owner mail gönderim durumunu izliyor. `/api/signup/verify` artık `approval_status`'a dokunmuyor; sadece email doğrulamasını yapıp `/basvuru-durumu`'na yönlendiriyor ve oturumu (`user_id`/`session_id`/`user_email`/`user_name`) açıyor. `/api/auth/login` `approvalStatus` + `redirectTo` (owner/approved → `/dashboard`; aksi halde `/basvuru-durumu`) dönüyor. Yeni `/basvuru-durumu` sayfası onaylanmamış kullanıcının görebileceği TEK ekran (sidebar yok, dashboard yok); blur backdrop'lu, X'siz, ESC yutmalı `PreMeetingApprovalModal` ("Başvurunuz Alındı" + "Görüşme Planla" / "Şimdilik Planlamak İstemiyorum") gösteriyor. `PreMeetingScheduleModal` DB-tabanlı availability (Europe/Istanbul, hafta içi 10:00-18:00, 30 dk slot) ile dolu saatleri engelliyor; çakışma backend'de de unique-index ile reddediliyor. Yeni `AccountApprovalGuard` tüm iç panel layout'larını sarıyor; owner / approved değilse sidebar dahil hiçbir şey render edilmeden `/basvuru-durumu`'na yönlendiriliyor — kullanıcıya "sisteme giriş yaptı" hissi verilmiyor. Gözetim Merkezi'ne yeni `Başvurular` paneli eklendi: onay/red/manuel not aksiyonları + detay drawer. Owner bildirim maili (`onursuay@hotmail.com`, `cnursuay@gmail.com`) `new_signup` / `premeeting_scheduled` / `premeeting_declined` olaylarında Resend üzerinden gidiyor, `notification_log` tablosuna sent/failed olarak düşüyor. Owner allowlist (`SUPER_ADMIN_EMAILS`) tüm akıştan bypass uyguluyor.
- **Dosyalar:** `supabase/migrations/20260515000000_signups_manual_approval_and_premeeting.sql` (yeni), `lib/auth/accountApproval.ts` (yeni), `lib/notifications/ownerNotifier.ts` (yeni), `app/api/signup/route.ts`, `app/api/signup/verify/route.ts`, `app/api/auth/login/route.ts`, `app/api/signup/approval-status/route.ts` (yeni), `app/api/signup/premeeting/{availability,schedule,decline}/route.ts` (yeni), `app/api/admin/signups/route.ts` (yeni), `app/api/admin/signups/[id]/{approve,reject,note}/route.ts` (yeni), `app/basvuru-durumu/{layout,page}.tsx` (yeni), `components/signup/{PreMeetingApprovalModal,PreMeetingScheduleModal}.tsx` (yeni), `components/auth/AccountApprovalGuard.tsx` (yeni), `components/gozetim/SignupApprovalsPanel.tsx` (yeni), `app/gozetim-merkezi/GozetimMerkeziClient.tsx`, `app/login/page.tsx`, `app/{dashboard,yoai,optimizasyon,strateji,hedef-kitle,tasarim,raporlar,seo,meta-ads,google-ads,tiktok-ads,hesabim,abonelik,faturalarim,entegrasyon}/layout.tsx`, `src/tests/{manualSignupApproval,preMeetingScheduling,gozetimMerkeziSignupApproval}.test.ts` (yeni)

## 2026-05-15 — Global Credit vs Subscription Access Modal Standard
- **Sorun:** Kredi vs abonelik gerektiren alanlar tek bir CreditRequiredModal ile gösteriliyordu, kullanıcıya iki durum farklı görünmüyordu. Strateji ve diğer sayfalarda hâlâ eski `SubscriptionGateModal` (kapatılabilir, "Strateji Limiti Doldu" gibi inline metin), YoAlgoritma'da chat içinde "Yeterli krediniz bulunmuyor." inline mesajı, Tasarım'da yetersiz bakiyede sadece sessizce buton disable, SEO ve Hedef Kitle > AI Tabanlı Hedef Kitle'de hiç guard yoktu.
- **Çözüm:** Yeni `components/billing/AccessRequiredModal.tsx` — `type='credit' | 'subscription'` props ile aynı tasarım ailesinden iki ayırt edilebilir varyant (Sparkles+Zap+"AI KREDİ"+"Kredi Yükle" vs ShieldCheck+Lock+"ABONELİK"+"Planları İncele"). Kapatılamaz (X yok, ESC yutulur, dış tıklama yutulur, body scroll kilitli). `lib/billing/featureAccessMap.ts` merkezi feature kayıt defteri (subscription_required: optimization, strategy, yoalgoritma, seo, audience_ai; credit_required: optimization_ai_scan_pro, design_generation, strategy_overage, yoalgoritma_chat). `lib/admin/superAdminClient.ts` client-safe owner allowlist. `/api/billing/current` artık `isOwner` bayrağı döndürüyor; `CreditProvider.hasEnoughCredits` ve `SubscriptionProvider.isOwner` owner için bypass uyguluyor. Eski `CreditRequiredModal` `AccessRequiredModal type='credit'`'a delege eden ince wrapper olarak korundu (geriye dönük uyumluluk). Optimizasyon (subscription + credit overage), Strateji (subscription + overage), YoAlgoritma (subscription + chat credit), Tasarım (credit), SEO (subscription), Hedef Kitle AI sekmesi (subscription) yeni modal'a bağlandı. CLAUDE.md kuralı yeniden yazıldı. 64 yeni + 7 wrapper test geçti, typecheck + build temiz.
- **Dosyalar:** `CLAUDE.md`, `components/billing/AccessRequiredModal.tsx` (yeni), `components/billing/CreditRequiredModal.tsx` (wrapper), `lib/billing/featureAccessMap.ts` (yeni), `lib/admin/superAdminClient.ts` (yeni), `app/api/billing/current/route.ts`, `components/providers/CreditProvider.tsx`, `components/providers/SubscriptionProvider.tsx`, `app/optimizasyon/page.tsx`, `app/strateji/page.tsx`, `app/yoai/page.tsx`, `app/tasarim/page.tsx`, `app/seo/page.tsx`, `app/hedef-kitle/page.tsx`, `src/tests/accessRequiredModal.test.ts` (yeni), `src/tests/creditRequiredModal.test.ts`

## 2026-05-15 — Global Credit Required Modal Standard + UI owner bypass
- **Sorun:** Faz 1 sonrası /optimizasyon sayfasında abonelik yoksa düz kırmızı inline yazı görünüyordu ("Optimizasyon için aktif bir abonelik gerekli."). Ayrıca owner hesabı (onursuay@hotmail.com) sidebar'da "Free" görünüyor ve "AI ile Tara Pro" butonu hâlâ abonelik uyarısı veriyordu — backend bypass'i client-side gating'i etkilemiyordu.
- **Çözüm:** Yeni `components/billing/CreditRequiredModal.tsx` — Business Profile modal standardında, blur arkalıklı, kapatılamayan (X yok, ESC yutulur, dış tıklama yutulur, body scroll kilitli), CTA `/abonelik`'e yönlendiren premium modal. Optimizasyon sayfasında 403 score response'unda accessDenied state set ediliyor → inline kırmızı yazı yerine modal render ediliyor. `/api/billing/current` owner için enterprise/active subscription stub döndürüyor → sidebar plan label'ı + tüm UI gating (canUseOptimizationAI, AI Scan butonları) otomatik düzeliyor. CLAUDE.md'ye proje geneli kural eklendi. 18 unit test geçti.
- **Dosyalar:** `CLAUDE.md`, `components/billing/CreditRequiredModal.tsx` (yeni), `app/api/billing/current/route.ts`, `app/optimizasyon/page.tsx`, `src/tests/creditRequiredModal.test.ts` (yeni)

## 2026-05-15 — Optimizasyon guard owner bypass (Faz 1 hotfix)
- **Sorun:** Faz 1 backend guard production'da çalışıyor ancak owner hesabı (onursuay@hotmail.com) `subscriptions` tablosunda paid kayıt taşımadığı için "Optimizasyon için aktif bir abonelik gerekli." mesajıyla bloklanıyordu. Magic-scan tetiklenemediği için `yoai_recommendation_results` tablosuna kayıt düşmüyordu.
- **Çözüm:** `requireOptimizationAccess()` içine super-admin bypass eklendi — `isSuperAdminEmail(user.email)` allowlist (default `onursuay@hotmail.com`, `SUPER_ADMIN_EMAILS` env ile override) eşleşirse subscription kontrolü atlanıp `enterprise/active` stub state ile erişim veriliyor. Gözetim Merkezi'nde kullanılan tutarlı pattern. Normal kullanıcılar için subscription guard değişmedi.
- **Dosyalar:** `lib/meta/optimization/serverGuard.ts`

## 2026-05-15 — Optimizasyon Faz 1: Backend guard + fallback transparency + batch confirm + persistence
- **Sorun:** Audit raporu 4 kritik açık tespit etti: (1) magic-scan/score endpoint'lerinde subscription kontrolü yoktu, client-side bypass mümkündü; (2) AI istendiği halde fallback'a düşüldüğünde kullanıcı bilemiyordu; (3) "Apply Selected" butonu çoklu Meta mutation'ı tek tıkla onaysız başlatabiliyordu; (4) tarama sonuçları DB'ye yazılmıyor, page refresh'te kayboluyordu.
- **Çözüm:** Yeni `lib/meta/optimization/serverGuard.ts` — `canUseOptimization` mantığını server tarafına taşıdı, magic-scan + score route başlarına eklendi (mevcut Graph API çağrı mantığına dokunulmadı). `MagicScanResult` tipine `aiRequested`/`aiFallbackUsed` alanları eklendi; backend `useAI && !aiGenerated` durumunu flag'liyor. `ScanHeroBanner` fallback notice gösteriyor (amber yerine `text-orange-300`). `MagicScanResults` artık "Apply Selected" butonunu DiffPanel onay modalından geçiriyor — direkt apply yolu kapandı; DiffPanel `batchSummary` + Meta mutation uyarısı içeriyor. Yeni `POST/GET /api/yoai/optimization/recommendations` endpoint'i `recordBeforeSnapshot` ile her taramayı `yoai_recommendation_results` tablosuna fire-and-forget kaydediyor (Supabase yoksa graceful skip). `bg-amber-500` → `bg-orange-500` (RISK_COLORS), CLAUDE.md renk kuralı.
- **Dosyalar:** `lib/meta/optimization/serverGuard.ts` (yeni), `lib/meta/optimization/types.ts`, `app/api/meta/optimization/magic-scan/route.ts`, `app/api/meta/optimization/score/route.ts`, `app/api/yoai/optimization/recommendations/route.ts` (yeni), `components/optimization/MagicScanResults.tsx`, `components/optimization/scan/ScanHeroBanner.tsx`, `locales/tr.json`, `locales/en.json`

## 2026-05-15 — Apify tüm 5 platform çalışıyor: LinkedIn dev_fusion actor eklendi
- **Sorun:** LinkedIn için çalışan actor yoktu, input format testi gerekiyordu
- **Çözüm:** `dev_fusion/Linkedin-Company-Scraper` actor'ı izin onaylandı. Input key: `profileUrls` (startUrls değil). Canlı test: SUCCEEDED, companyName/description/industry/employeeCount döndü. `buildActorInput` LinkedIn dalı güncellendi. Tüm 5 platform (Instagram/Facebook/LinkedIn/YouTube/TikTok) Apify ile çalışıyor
- **Dosyalar:** `lib/yoai/apifySocialConfig.ts`, `.env.local`, `.env.example`, `CLAUDE.md`
- **Vercel'e eklenecek:** `APIFY_LINKEDIN_COMPANY_ACTOR_ID=dev_fusion/Linkedin-Company-Scraper`

## 2026-05-15 — Apify entegrasyonu canlı test + LinkedIn fallback
- **Sorun:** LinkedIn için FREE plan'da erişilebilir Apify actor yok; env'de actor ID bırakılmıştı
- **Çözüm:** Canlı test sonuçları: Instagram ✓, Facebook ✓, YouTube ✓, TikTok ✓ (hepsi SUCCEEDED + veri döndü). LinkedIn actor ID boşaltıldı → public metadata fallback otomatik devreye girer. CLAUDE.md güncellendi
- **Dosyalar:** `.env.local`, `.env.example`, `CLAUDE.md`

## 2026-05-15 — Apify social scan encoding bug fix + env yapılandırması
- **Sorun:** `apifySocialRunner.ts` actor ID'yi `encodeURIComponent` ile encode ediyordu → `apify%2Finstagram-profile-scraper` gönderiliyor, Apify `~` bekliyor → tüm social scan'ler 404 ile failliyor. Ayrıca 90s polling loop Vercel 60s limitini aşıyordu. `.env.local`'da hiç Apify değişkeni yoktu
- **Çözüm:** `encodeActorId()` fonksiyonu `replace(/\//g, '~')` kullanır. Polling loop kaldırıldı, `?waitForFinish=50` ile synchronous yaklaşıma geçildi (toplam ~58s < 60s Vercel limiti). `.env.local`'a tüm actor ID'ler + token placeholder eklendi. CLAUDE.md'ye Apify kuralları işlendi
- **Dosyalar:** `lib/yoai/apifySocialRunner.ts`, `.env.local`, `.env.example`, `CLAUDE.md`
- **Yapılacak:** `APIFY_API_TOKEN` Apify console'dan (console.apify.com) alınıp `.env.local` VE Vercel dashboard'a eklenecek

## 2026-05-15 — İşletme Profili: sektör formatı, Ana Hedef chip, kaynak grid taşma fix
- **Sorun:** Sektör etiketleri ham DB değeriyle ("egitim · mesleki_belgelendirme") görünüyordu; Ana Hedef büyük kutu, lokasyon chip'leriyle tutarsız; Marka Kaynakları'nda 5+ kaynak flex-wrap ile taşıyordu
- **Çözüm:** `formatSector()` helper eklendi (alt çizgi → boşluk, baş harf büyük, Türkçe locale). Ana Hedef lokasyon chip stiliyle eşleştirildi. Marka Kaynakları `grid-cols-2` sabit grid'e alındı — kaç kaynak olursa olsun 2 sütunda dizilir, truncate ile taşmaz
- **Dosyalar:** `app/yoai/isletme-profili/page.tsx`

## 2026-05-15 — İşletme Profili: güven ring merkez fix + hedef/kaynaklar 4-sütun grid
- **Sorun:** %85 güven yazısı daire içinde merkeze hizalı değil (CSS rotate + absolute div kayması); Hedef & Lokasyon + Marka Kaynakları iki ayrı kartda yükseklik dengesizliği ve boş alan sorunu
- **Çözüm:** Ring: CSS `-rotate-90` kaldırıldı, arc `transform="rotate(-90 40 40)"` SVG attribute ile döndürülüyor; metin `<text>` elementi `textAnchor="middle"` + `dominantBaseline="middle"` ile geometrik merkeze sabitlendi. Layout: iki ayrı kart yerine tek kart `grid-cols-4` + `divide-x` ile 4 eşit sütun (Ana Hedef / Lokasyonlar / Hedef Kitle / Marka Kaynakları)
- **Dosyalar:** `app/yoai/isletme-profili/page.tsx`

## 2026-05-15 — İşletme Profili hero + layout iyileştirmeleri
- **Sorun:** Güven ring'inde %85 yazısı daire ile hizalı değil; hero üzerinde beyaz metin okunaksız; Hedef & Lokasyon ile Marka Kaynakları alt alta ve sade görünümlüydü
- **Çözüm:** Ring: SVG + text katmanı `absolute inset-0` ile tam ortalandı, ring rengi açık tonda (emerald-300) güncellendi. Hero: koyu gradient + `bg-black/25` scrim eklendi, metin `drop-shadow` + `font-semibold` ile netleştirildi. Layout: Firma Bilgileri tam genişlik, Hedef & Lokasyon + Marka Kaynakları yan yana (2-col grid); lokasyonlar icon'lu kutucuklara, marka kaynakları 2-col grid kutucuklara alındı
- **Dosyalar:** `app/yoai/isletme-profili/page.tsx`

## 2026-05-15 — İşletme profili tarama pipeline'ı düzeltildi: otomatik tarama + duplicate önleme
- **Sorun:** /scan route'u sahte çalışıyordu (sadece status flip), re-scan'da eski scan kayıtları birikerek duplicate oluşturuyordu, UI'da gereksiz manuel "Tara" butonu vardı
- **Çözüm:** (1) `deleteSourceScansForProfile` fonksiyonu eklendi — her taramada eski kayıtlar temizlenir. (2) `/scan` route'u gerçek `runScan` pipeline'ını çalıştıracak şekilde yeniden yazıldı. (3) UI'dan "Tara" butonu kaldırıldı, ScanBadge tüm status değerlerini (pending/running/completed/partial/failed) gösteriyor. (4) CLAUDE.md'ye tarama kuralları eklendi.
- **Dosyalar:** `lib/yoai/businessProfileStore.ts`, `app/api/yoai/business-profile/route.ts`, `app/api/yoai/business-profile/scan/route.ts`, `app/yoai/isletme-profili/page.tsx`, `CLAUDE.md`

## 2026-05-15 — İşletme Profili sayfası kart tasarımı ile yeniden tasarlandı
- **Sorun:** Sayfa çok sıradan görünüyordu, bilgiler düz liste halinde sunuluyordu
- **Çözüm:** Animasyonlu gradient hero kart, güven skoru ring'i, istatistik chip'leri, kart grid sistemi, hover animasyonları, "Tara" butonu eklendi. "Bekliyor" statüsü açıklandı: scan_status=pending → kaynak taraması henüz yapılmamış
- **Dosyalar:** `app/yoai/isletme-profili/page.tsx`

## 2026-05-15 — İşletme Profili sayfası scroll sorunu düzeltildi
- **Sorun:** `/yoai/isletme-profili` sayfasında içerik aşağı kaymıyor, bilgiler görünmüyordu
- **Çözüm:** `MainContent` bileşenindeki `overflow-hidden` → `overflow-y-auto` olarak değiştirildi; içerik artık dikey scroll yapar
- **Dosyalar:** `components/MainContent.tsx`

## 2026-05-14 — İşletme Profili yönetim sayfası eklendi
- **Sorun:** Onboarding'de kaydedilen işletme profili bilgileri düzenlenebilir bir alanda görünmüyordu
- **Çözüm:** `/yoai/isletme-profili` sayfası oluşturuldu; profil ve rakipler bölüm bölüm görüntülenir, "Düzenle" butonu mevcut onboarding modalını edit modda açar. Sidebar'da YoAi altına "İşletme Profili" sub-item eklendi
- **Dosyalar:** `app/yoai/isletme-profili/page.tsx`, `lib/nav.ts`

## 2026-05-14 — BusinessProfile step adı düzeltme + virgülle ayırın input fix
- **Sorun:** Step 4 adı "Marka Kaynakları" yerine "Kaynaklar" olacaktı; virgülle ayırın input'larına virgül yazılınca karakter kayboluyordu (her onChange'de split/filter yapılıyordu)
- **Çözüm:** STEPS dizisinde isim güncellendi; tüm virgülle-ayırın alanları için `CommaSeparatedInput` komponenti eklendi — raw text local state'de tutulur, sadece blur'da parse edilip draft'a yazılır
- **Dosyalar:** `components/yoai/BusinessProfileOnboarding.tsx`

## 2026-05-13 — Gözetim Merkezi HTTP 500 Fix + Onboarding Modal Polish
- **Sorun:**
  1. Business Profile onboarding modal'ında alt köşelerde gri arka plan footer'ı `rounded-3xl` köşelerden taşırıyordu (overflow-hidden eksikti).
  2. Onboarding modal X butonu sadece `isEditMode` iken görünüyordu — yeni kullanıcı modal'ı kapatamıyor, sayfa dışına çıkamıyordu.
  3. Gözetim Merkezi (`/gozetim-merkezi`) HTTP 500 veriyordu; tablo `Veri alınamadı` görüntülüyordu. Profilsiz kullanıcılar listede hiç görünmüyordu.
- **Kök neden:**
  - `app/api/admin/gozetim-merkezi/route.ts` ve `app/api/admin/business-profiles/route.ts`, boş profile listesi durumunda `.in('profile_id', ['__none__'])` sentinel kullanıyordu. `profile_id` UUID kolonu — Postgres `invalid input syntax for type uuid: "__none__"` döndürüp tüm Promise.all'u 500'e çakıyordu.
  - Sadece profile'i olan kullanıcılar listeye dahil ediliyordu — kayıt olup profile oluşturmamış kullanıcılar Gözetim Merkezi'ne giremiyordu.
  - `BusinessProfileGuard` sadece `silent` modu için `onClose` geçiyordu; kullanıcı modal'ı kapatamıyordu.
- **Çözüm:**
  - **`app/api/admin/gozetim-merkezi/route.ts`**: UUID sentinel kaldırıldı; boş array'de sorgu tamamen atlanıyor (`Promise.resolve({ data: [] })`). Her alt query bağımsız `diagnostics` listesine yazılıyor — kısmi hata olsa bile UI veri alabiliyor ve hata bant olarak görüntüleniyor. Signups query'sinde olmayan kullanıcılar `profile: null` ile listeye eklendi → kayıt olup profile oluşturmayan kullanıcılar artık tabloda "Profilsiz" olarak görünüyor. Yeni KPI'lar: `intelligenceMissing`, `signups24h`, `signups7d`, `totalCompetitors`, `totalSources`. `errorTypeCounts` + `recentFailedScans` failed scan'lerin tipini sınıflandırıyor (`login_wall`, `no_extractable_metadata`, `scraper_provider_missing`, `http_404`, `apify_error`, `timeout`, `network`).
  - **`app/api/admin/business-profiles/route.ts`**: Aynı UUID sentinel düzeltmesi uygulandı.
  - **`app/gozetim-merkezi/GozetimMerkeziClient.tsx`**: Yeni KPI kartları + filtreler (Onboarding / Tarama / Intelligence) + diagnostic banner + "Hata Takibi" bloku (tip dağılımı + son hatalı tarama listesi) + profilsiz satır render desteği. Detay drawer profile-id yerine entry-key ile çalışıyor.
  - **`components/yoai/BusinessProfileOnboarding.tsx`**: Modal container `overflow-hidden` ile rounded radius'tan taşan footer arka planı engellendi. X butonu artık `onClose` her tanımlandığında görünüyor (eski `isEditMode && onClose` koşulu kaldırıldı). ESC tuşu desteği eklendi.
  - **`components/yoai/BusinessProfileGuard.tsx`**: `onClose` her zaman geçiyor; kullanıcı modal'ı kapatınca onboarding **tamamlanmış sayılmıyor** — Guard kilit ekranı (`{area} kilidi açık değil`) bırakılıyor ve "İşletme Profilini Tamamla" butonu modal'ı yeniden açıyor. Yalnızca `onComplete` `state='completed'` set ediyor.
  - **`src/tests/gozetimMerkeziAccess.test.ts`**: UUID sentinel yasağı, `diagnostics`, `profileless`, signups24h/7d, error sınıflandırma, intelligenceMissing testleri eklendi (31 test geçiyor).
  - **`src/tests/businessProfileOnboardingModal.test.ts` (yeni)**: 7 statik test — modal overflow-hidden, onClose-bağlı X butonu, ESC kapatma, Guard kilit ekranı, onClose içinde `setState('completed')` bypass yok, amber/yellow class yasağı.
- **Güvenlik:** `checkAdminAccess` aynen korundu. Yetkisiz kullanıcı 404 ile reddediliyor, normal kullanıcı sessizce `/dashboard`'a yönleniyor. `ADMIN_SECRET` header path'i kaldırılmadı. Diagnostic mesajları sadece yetkili oturum için döner.
- **Dosyalar:** `app/api/admin/gozetim-merkezi/route.ts`, `app/api/admin/business-profiles/route.ts`, `app/gozetim-merkezi/GozetimMerkeziClient.tsx`, `components/yoai/BusinessProfileOnboarding.tsx`, `components/yoai/BusinessProfileGuard.tsx`, `src/tests/gozetimMerkeziAccess.test.ts`, `src/tests/businessProfileOnboardingModal.test.ts`

## 2026-05-13 — Apify Social Profile Actor Integration
- **Sorun:** Business Intelligence Profile sosyal medya kaynakları yalnızca public metadata fallback ile taranıyordu. Instagram, Facebook, TikTok çoğu zaman login wall döndürdüğünden gerçek profil verisi elde edilemiyordu. Apify entegrasyonu yoktu.
- **Çözüm:**
  - **`lib/yoai/apifySocialConfig.ts` (yeni):** Env-based Apify config helper. `APIFY_API_TOKEN`, platform-specific actor ID env'leri (APIFY_INSTAGRAM/FACEBOOK/LINKEDIN/YOUTUBE/TIKTOK_*_ACTOR_ID), `getApifyToken()`, `getApifyActorId(platform)`, `isApifyReady(platform)`, `buildActorInput(platform, url)`. Token/secret loglanmaz.
  - **`lib/yoai/apifySocialRunner.ts` (yeni):** Apify REST API runner. Async flow: actor start → poll status → dataset fetch. Timeout 90s, rate-limit (429), failed actor durumları net raporlanır (`apify_token_missing`, `apify_actor_missing`, `apify_run_failed`, `apify_dataset_empty`, `apify_timeout`, `apify_rate_limited`). Sistem kırılmaz.
  - **`lib/yoai/socialProfileNormalizer.ts` (yeni):** Per-platform normalizer (Instagram, Facebook, LinkedIn, YouTube, TikTok). `NormalizedSocialProfile` ortak shape. Defensive parsing — field yoksa uydurma yok. `normalizeSocialProfile(platform, raw, url)` dispatch.
  - **`lib/yoai/socialSourceScanner.ts` (güncellendi):** Apify token + actor ID mevcutsa → Apify actor dene → normalize → output. Apify fail/empty → public metadata fallback. `error_message` formatında `|provider:{value}` her durumda yazılır. Gözetim Merkezi mevcut parser ile uyumlu.
  - **`src/tests/apifySocialScanner.test.ts` (yeni):** 28 test — config, runner mock, normalizer per-platform, fake data kontrolü, token güvenlik, BI memory binding, Gözetim Merkezi data shape.
- **Dosyalar:** `lib/yoai/apifySocialConfig.ts`, `lib/yoai/apifySocialRunner.ts`, `lib/yoai/socialProfileNormalizer.ts`, `lib/yoai/socialSourceScanner.ts`, `src/tests/apifySocialScanner.test.ts`

## 2026-05-13 — Hidden Gözetim Merkezi Dashboard
- **Sorun:** Kullanıcı/firma/scan/BI durumlarını ayrı bir admin domain'i açmadan, sadece `onursuay@hotmail.com` hesabına gizli görünecek şekilde proje içinden izlemek gerekiyordu. Normal kullanıcı sidebar item'ı görmemeli; URL'yi bilse bile 403 değil sessiz redirect almalı; admin alanının varlığı sızdırılmamalı. ADMIN_SECRET manuel erişim bozulmamalı.
- **Çözüm:**
  - **`lib/admin/superAdmin.ts` (yeni):** Merkezi yetki helper'ı. `SUPER_ADMIN_EMAILS` env (default `onursuay@hotmail.com`), `isSuperAdminEmail()`, `resolveSessionEmail()` (httpOnly `user_id` → signups.email lookup; public `user_email` cookie'ye güvenmez), `getIsCurrentUserSuperAdmin()`, `checkAdminAccess()` — `x-admin-secret` header VEYA oturum e-postası ile yetkilendirir, yetki yoksa 404 önerir (admin alanı sızdırılmaz).
  - **`/api/admin/me`:** Sidebar görünürlük keşfi. Her oturum için 200 + `{ hasAccess: boolean }`. Yetkisiz kullanıcı için aynı şekil cevap → admin varlığı sızdırılmaz.
  - **`/api/admin/gozetim-merkezi` (yeni konsolide endpoint):** KPI'ler (toplam kullanıcı, onboarding tamam/eksik, profilsiz kullanıcı, toplam scan, completed/running/failed scan, ortalama intelligence confidence), `signups` join'li firma listesi (kullanıcı email/isim/durum + profile + competitors + sourceScansSummary + intelligenceSummary), son kayıt olan kullanıcılar listesi. `checkAdminAccess` ile korumalı, 404 sızıntısız.
  - **`/api/admin/business-profiles` hardening:** Eski `x-admin-secret`-only check → `checkAdminAccess` (header VEYA oturum). 401 yerine 404. ADMIN_SECRET manuel kullanım korunuyor.
  - **`/gozetim-merkezi` route:** `app/gozetim-merkezi/page.tsx` server component — yetki yoksa `redirect('/dashboard')`. 403/forbidden ekranı yok. `layout.tsx` sidebar + main content. `GozetimMerkeziClient.tsx` (KPI grid, kullanıcı/firma tablosu, son kayıtlar tablosu, sağ tarafta açılan detay drawer — firma bilgileri / rakipler / source scan + extracted_title/description/keywords/services + error / business intelligence summary).
  - **Sidebar (`components/SidebarNav.tsx`):** Mount'ta `/api/admin/me` fetch; `hasAccess=true` ise `gozetimMerkeziNavItem` dinamik enjekte. Default state `false` → normal kullanıcı item'ı asla görmez. `lib/nav.ts` içinde ayrı export, `navItems` içine konmaz.
  - **UI kuralları:** `Süper Admin` / `Admin Panel` ifadesi hiçbir kullanıcı-facing metinde geçmez (sadece teknik helper adları). Renk paleti: gray/primary/emerald/red — amber/yellow yok. Scan status badge renkleri palet ile uyumlu.
- **Test:** `src/tests/gozetimMerkeziAccess.test.ts` (24 test — allowlist, env override, ADMIN_SECRET path, 404 sızıntısı, signups join, scan extracted fields, sidebar gating, navItems içinde değil, page server-side guard, sessiz redirect, "Süper Admin"/"Admin Panel" UI metni yok, amber/yellow yok). Mevcut `businessIntelligenceProfile.test.ts` (18/18) çalışmaya devam ediyor. Typecheck temiz, `npm run build` temiz — `/gozetim-merkezi` route'u prod bundle'da kayıtlı.
- **Dosyalar:** `lib/admin/superAdmin.ts` (yeni), `lib/nav.ts`, `components/SidebarNav.tsx`, `app/api/admin/me/route.ts` (yeni), `app/api/admin/gozetim-merkezi/route.ts` (yeni), `app/api/admin/business-profiles/route.ts`, `app/gozetim-merkezi/page.tsx` (yeni), `app/gozetim-merkezi/layout.tsx` (yeni), `app/gozetim-merkezi/GozetimMerkeziClient.tsx` (yeni), `src/tests/gozetimMerkeziAccess.test.ts` (yeni), `docs/CHANGELOG.md`.

---

## 2026-05-13 — Social Source Scanner Provider + Hedef Kitle Business Context Runtime Binding
- **Sorun:** Sosyal medya kaynakları (Instagram/Facebook/LinkedIn/YouTube/TikTok) `scraper_provider_missing` ile failed kalıyordu — hiç taranmıyordu. Hedef Kitle alanında BusinessProfileGuard dışında Business Intelligence Memory runtime context olarak hiç bağlanmamıştı.
- **Çözüm:**
  - **`lib/yoai/socialSourceScanner.ts` (yeni):** Sosyal kaynaklar için public HTTP metadata fallback — og:title / og:description / title / meta description / canonical / site_name / body excerpt çıkarır. Login wall tespit eder; tespit edilirse `scan_status=failed` + `error_message=login_wall|provider:…` yazar. Hiçbir extractable metadata yoksa `no_extractable_metadata` ile failed. Fake veri YOK.
  - **`businessSourceScanner.ts` entegrasyonu:** Sosyal kaynak çağrıları artık `scanSocialSource` modülüne delege ediliyor; `scraper_provider_missing` / `social_scraper_not_implemented` literal'leri kaldırıldı.
  - **`lib/yoai/audienceBusinessContext.ts` (yeni):** Hedef Kitle runtime context interface'i (`AudienceBusinessContextRuntime` + `AudienceSeedHints`). Pure builder `buildAudienceContextFromBusiness(ctx)` test edilebilir; wrapper `getAudienceBusinessContext(userId)` dynamic import üzerinden supabase'i runtime'da yükler. AI persona generator için stabil seed hint şeması: sectorMain/Sub/Label, primaryLocations, audiencePains, audienceMotivations, audienceTypes, keywordThemes, brandTone, productsOrServices, mainConversionGoal, declaredTargetAudience, recommendedMetaObjectives, recommendedGoogleCampaignTypes.
  - **`/api/audiences/business-context` (yeni route):** Cookie-tabanlı; `getAudienceBusinessContext` ile runtime audience context döner — businessContextLoaded, sector, location, sourceCoverage, confidence, seed hints.
  - **`app/hedef-kitle/page.tsx` UI binding:** Sayfa açıldığında runtime context'i fetch eder; loaded ise sayfa başına Business Intelligence Memory bilgilendirme banner'ı (sektör / hedef kitle ihtiyaçları / motivasyonlar) eklenir. CLAUDE.md renk paletine uygun: `bg-primary/5 border-primary/20`, chip'ler `bg-emerald-50 text-emerald-700`.
  - **Super admin scan visibility:** `/api/admin/business-profiles` her scan için artık ayrı `sourceScansSummary` döner — provider_used, errorCore (normalize edilmiş `|provider:` ayrıştırması), source_type/url, scan_status, confidence, extracted_title/description/keywords/services.
- **Test:** `src/tests/socialSourceScanner.test.ts` (13 test — fetch mocking; provider info; og metadata happy path; login wall failed; HTTP 404; network error; entegre business binding) + `src/tests/hedefKitleBusinessContextBinding.test.ts` (11 test — pure builder; locked/ready context; seed hint şeması; AI generator interface stabilitesi). `businessIntelligenceProfile.test.ts` sosyal provider eski beklentisi güncellendi. Typecheck temiz, build temiz.
- **Dosyalar:** `lib/yoai/socialSourceScanner.ts` (yeni), `lib/yoai/businessSourceScanner.ts`, `lib/yoai/audienceBusinessContext.ts` (yeni), `app/api/audiences/business-context/route.ts` (yeni), `app/hedef-kitle/page.tsx`, `app/api/admin/business-profiles/route.ts`, `src/tests/socialSourceScanner.test.ts` (yeni), `src/tests/hedefKitleBusinessContextBinding.test.ts` (yeni), `src/tests/businessIntelligenceProfile.test.ts`.

---

## 2026-05-13 — Business Intelligence Profile + Sector Dropdown + Multi-Source Scanner + YoAlgoritma Card UI Cleanup
- **Sorun:** YoAi kullanıcı işletmesini tanımadan reklam, strateji, hedef kitle veya öneri üretiyordu; sektör/lokasyon bağlamı yoktu. YoAlgoritma proposal kartları geniş ekranda 3 kolon değildi, üstte gereksiz Meta/Google bölüm başlıkları vardı, kart sol üstünde teknik kampanya türü badge'i gözüküyordu, "OUTCOME_ENGAGEMENT" gibi enum'lar kullanıcıya sızabiliyordu.
- **Çözüm:**
  - **Business Intelligence Profile altyapısı:** `user_business_profiles`, `user_business_competitors`, `user_business_source_scans`, `user_business_intelligence` Supabase tabloları (RLS aktif, service_role bypass).
  - **Türkiye sektör kataloğu:** 18 ana sektör + ~200 alt sektör; onboarding dropdown'u dinamik yüklüyor.
  - **Sektör + lokasyon intelligence:** Müşteri ihtiyaçları, kampanya tipi önerileri, riskli iddialar, anahtar kelime temaları üretiyor; sahte web research yok (`research_source='internal_inference'`).
  - **Multi-source scanner:** Website / marketplace / Google Business gerçek HTTP fetch + HTML parsing; sosyal sağlayıcı yoksa `scraper_provider_missing` ile failed yazıyor — sahte veri üretmiyor.
  - **Business context store:** Tüm üretim motorları için `getBusinessContextForUser(userId)` tek giriş; locked/diagnostic/source_coverage döner.
  - **Onboarding modal:** 6 adımlı (Firma → Sektör → Hedef → Marka Kaynakları → Rakipler → Detay); en az 1 marka kaynağı + 3 rakip zorunlu.
  - **Access guard:** Profili olmayan kullanıcı `/yoai`, `/strateji`, `/hedef-kitle`, `/google-ads`, `/meta-ads` route'larında kilitleniyor.
  - **Üretim motoru bağlamaları:** YoAlgoritma `generate-ad` (adCreator prompt'u), Strateji `generate-plan` (ai-generator user prompt prefix), proposal engine orchestrator (`businessKeywords` → competitor query expander).
  - **YoAlgoritma kart UI:** Meta/Google üst section başlıkları kaldırıldı; tek 3 kolon grid; kartın sol üstüne platform logosu (Meta/Google SVG); "Kampanya Türü" satırı eklendi; teknik enum'lar humanize (`OUTCOME_ENGAGEMENT` → "Etkileşim").
  - **Süper admin endpoint:** `app/api/admin/business-profiles/route.ts` (ADMIN_SECRET) tüm profilleri + scan_status + intelligence özetlerini döner.
  - **Eski filtreler korundu:** `policyStatus='rejected'`, `expired`, generic content filter, ONAYLA/REDDET akışı, publish/approval/preflight değişmedi.
- **Dosyalar:** `supabase/migrations/20260513000000_create_business_intelligence_profile.sql`, `lib/yoai/sectorCatalog.ts`, `lib/yoai/sectorLocationIntelligence.ts`, `lib/yoai/businessSourceScanner.ts`, `lib/yoai/businessProfileStore.ts`, `lib/yoai/businessProfileValidation.ts`, `lib/yoai/businessContextStore.ts`, `lib/yoai/businessIntelligenceBuilder.ts`, `app/api/yoai/business-profile/route.ts`, `app/api/yoai/business-profile/sectors/route.ts`, `app/api/yoai/business-profile/scan/route.ts`, `app/api/admin/business-profiles/route.ts`, `app/api/yoai/generate-ad/route.ts`, `app/api/strategy/instances/[id]/generate-plan/route.ts`, `lib/yoai/adCreator.ts`, `lib/yoai/proposalEngineOrchestrator.ts`, `lib/strategy/ai-generator.ts`, `lib/strategy/job-runner.ts`, `components/yoai/BusinessProfileOnboarding.tsx`, `components/yoai/BusinessProfileGuard.tsx`, `components/yoai/AiAdSuggestions.tsx`, `components/yoai/AdPreviewCard.tsx`, `app/yoai/layout.tsx`, `app/strateji/layout.tsx`, `app/hedef-kitle/layout.tsx`, `app/google-ads/page.tsx`, `app/meta-ads/page.tsx`, `src/tests/businessIntelligenceProfile.test.ts`, `src/tests/yoalgoritmaProposalCardLayout.test.ts`

---

## 2026-05-12 — Daily Run Freshness + Analysis Timestamp Fix
- **Sorun:** (1) UI "Analiz tarihi" alanında "Her gün 16:15'de otomatik güncellenir" yazıyordu; gerçek cron `0 5 * * *` = 05:00 UTC = **08:00 İstanbul**. (2) `generate-ad`: DB'deki run'da `proposals: []` (boş array) varsa `shouldGenerateLive` hiç set edilmiyordu; stale run için yeni öneri üretimi tetiklenmiyordu. (3) `isRunning`: timeout'a uğramış (>3 saat) 'running' kayıtlar aynı gün içindeki manuel retry'ı bloke ediyordu. (4) `maxDuration = 120` — 10 kampanya + çoklu AI batch ile zaman aşımı riski vardı.
- **Çözüm:** (1) `app/yoai/page.tsx` — "16:15" → "08:00" (2 yer). (2) `generate-ad/route.ts` — `shouldGenerateLive` check genişletildi: run varsa ama `proposals` null/boş ise VE run önceki günden kalıyorsa live generation tetiklenir. (3) `dailyRunStore.ts` — `isRunning` fonksiyonu `updated_at` da okuyacak şekilde güncellendi; 3 saatten eski 'running' kayıt stuck sayılıp retry'a izin verir. (4) Her iki route'ta `maxDuration` 120→300 artırıldı. (5) `daily-run/route.ts` comment düzeltildi: `"0 7 * * *"` → `"0 5 * * *"`.
- **Dosyalar:** `app/yoai/page.tsx`, `app/api/yoai/generate-ad/route.ts`, `app/api/yoai/daily-run/route.ts`, `lib/yoai/dailyRunStore.ts`

---

## 2026-05-12 — Restore Proposal Generation After Stale Cleanup
- **Sorun:** Stale/generic proposal cleanup başarıyla yapıldıktan sonra `yoai_pending_approvals` tablosundaki tüm eski öneriler `expired` olarak işaretlendi. Ancak `daily_run_store`'daki kayıtlı öneri verisi hâlâ duruyordu. `forceGenerate=false` ile API çağrıldığında: (1) kayıtlı run bulunuyor, (2) tüm öneriler visibility filter'da expired olarak düşürülüyor, (3) `persistedProposals = []` olmasına rağmen `persisted: true` ile return ediliyor. Live generation hiç tetiklenmiyor → UI "AI kampanya önerisi üretilemedi." gösteriyor.
- **Çözüm:** `route.ts` persisted path'ine `shouldGenerateLive` bayrağı eklendi. Visibility filter sonrası `persistedProposals.length === 0` ama `beforeFilter > 0` ise (yani öneriler stale cleanup ile temizlenmişse) empty return yerine canlı üretim başlatılıyor. İlk kez açan kullanıcı veya gerçekten veri olmayan durum için empty return davranışı korundu. Generic filtre, policy guard, approval logic değiştirilmedi.
- **Dosyalar:** `app/api/yoai/generate-ad/route.ts`

---

## 2026-05-12 — Proposal Visibility Root Fix (Production)
- **Sorun:** Ekranda "Hızlı Yanıt Al!", "Kariyerinize Yön Verin!", "Usta Kaynakçı Olun!" gibi jenerik kartlar görünüyordu. Meta/Google kartlarında "Meta Ad Library'den rakip reklam bulunamadı..." boş kutular gösteriliyordu. localStorage v3 cache eski stale proposal'ları tutuyordu. Grid tek kolon gibi davranıyor, sağ taraf boş kalıyordu. Sunucu ve UI filtre kuralları farklıydı.
- **Çözüm:** (1) `GENERIC_CONTENT_PATTERNS` genişletildi — 15 pattern: hızlı yanıt al, kariyerinize yön verin, usta kaynakçı olun, hemen başvurun, kaliteli hizmet, uygun fiyatlı, fırsatları kaçırmayın vb. (2) `sanitizeProposalForDisplay` tüm platformlarda boş/yanlış competitor insight'ı kaldıracak şekilde güncellendi — "bulunamadı" mesajları `undefined` yapılıyor, boş kutu renderlanmıyor. (3) `proposalVisibilityFilter.ts` yeni merkezi filtre — hem API route hem UI `isVisible` aynı kuralı uygular. (4) `AiAdSuggestions` cache key v4'e bump edildi, eski v1/v2/v3 key'ler mount'ta silinir, API boş döndüğünde eski cache temizlenir. (5) `isVisible()` içine `isGenericProposalContent()` eklendi — UI'da ek koruma katmanı. (6) Grid `gridClass(count)` ile dinamik — 1 kart tek kolon, 2 kart 2 kolon, 3+ kart 3 kolon. (7) `engineVersion: 'yoalgoritma-intelligence-v4'` yeni proposal'lara eklendi. (8) 22 test yazıldı, tamamı geçti.
- **Dosyalar:** `lib/yoai/competitorDisplay.ts`, `lib/yoai/proposalVisibilityFilter.ts` (yeni), `lib/yoai/adCreator.ts`, `app/api/yoai/generate-ad/route.ts`, `components/yoai/AiAdSuggestions.tsx`, `src/tests/proposalVisibilityFilter.test.ts` (yeni)

---

## 2026-05-12 — Stale Proposal Server-Side Filter (Production Fix)
- **Sorun:** `generate-ad?forceGenerate=false` persisted proposal'ları döndürürken `yoai_pending_approvals` tablosuna bakmıyordu. Stale cleanup DB'de expired yapsa bile `daily_run_store` snapshot'ındaki eski proposal'lar API response'unda filtrelenmeden dönüyordu. `isVisible()` UI filtresi timing bağımlıydı; localStorage cache'den anında render edilen eski kartlar approvals yükleninceye kadar görünüyordu. Ayrıca jenerik/placeholder içerikli proposal'lar ve policyStatus=rejected kayıtlar persisted path'de API'de filtrelenmiyordu.
- **Çözüm:** `generate-ad?forceGenerate=false` path'ine 3 sunucu tarafı filtre eklendi: (1) `listApprovals(userId, { status: 'expired' })` ile expired approval'ı olan proposal'lar response'dan çıkarıldı, (2) `policyStatus=rejected` proposal'lar persisted path'de de filtrelendi (sadece forceGenerate=true'da değil), (3) `isGenericProposalContent()` ile "Videomuzu Kaçırmayın", "Yeni Ürünler Sizi Bekliyor", "Sitemizi Ziyaret Edin", "Hemen Tıklayın" ve teknik enum (OUTCOME_*) içerikli proposal'lar kaldırıldı. Bu sayede localStorage'a yazılan cache de temizlenmiş veri içeriyor.
- **Dosyalar:** `app/api/yoai/generate-ad/route.ts`, `lib/yoai/competitorDisplay.ts`

---

## 2026-05-12 — Daily Active Campaign Intelligence Refresh
- **Sorun:** YoAlgoritma günlük analiz yapıyor ancak aktif kampanyaları teker teker taramıyor, mevcut önerilerin geçerliliğini kontrol etmiyor ve stale öneri temizliği yapılmıyordu. Google/Meta kampanyaları kapanınca, URL değişince veya creative değişince eski öneriler UI'da kalmaya devam ediyordu.
- **Çözüm:** `lib/yoai/dailyActiveCampaignIntelligence.ts` oluşturuldu. 6 kontrol çalıştıran `runDailyActiveCampaignIntelligence()` (pure, test edilebilir): kampanya aktif listede yok → campaign_deleted, kampanya DELETED/REMOVED/ARCHIVED → campaign_inactive, landing URL değişmiş → landing_url_changed/update_recommendation, kreatif büyük ölçüde değişmiş → creative_changed/update_recommendation, hedef objective değişmiş → objective_changed, öneri 30+ gün işlemsiz → proposal_too_old. PAUSED kampanyalar stale değil → needs_review. `applyStaleCleanup()` DB migration gerekmeden mevcut `expired` statüsünü kullanır; metadata.stale_reason nedeni taşır. `daily-run/route.ts` (GET + POST) güncellendi: her kullanıcı için proposal üretiminden önce intelligence scan çalışır, stale öneriler temizlenir, runSummary alanları eklendi (scannedUsers, activeCampaignsScanned, proposalsCreated, proposalsMarkedStale, proposalsReviewRequired, intentRefreshCount, competitorRefreshCount, errors). `AiAdSuggestions.tsx`: cache key v2→v3 bump (eski stale önerileri tarayıcı cache'ten düşer), expired statüsündeki öneriler `isVisible()` filtresiyle UI'dan gizlenir. 12/12 unit test geçiyor, typecheck temiz, build başarılı.
- **Dosyalar:** `lib/yoai/dailyActiveCampaignIntelligence.ts` (yeni), `app/api/yoai/daily-run/route.ts`, `components/yoai/AiAdSuggestions.tsx`, `src/tests/dailyActiveCampaignIntelligence.test.ts` (yeni), `docs/CHANGELOG.md`

---

## 2026-05-12 — Proposal Engine Final Binding
- **Sorun:** YoAlgoritma'da bugüne kadar inşa edilen 5 intelligence parçası (Official Ads Knowledge Base, Proposal Policy Guard, Campaign Intent Engine, Competitor Query Expander, Monthly Official Docs Refresh) birbirinden bağımsız çalışıyordu. Competitor Query Expander hiç çağrılmıyordu; proposal üretimi akışında query plan context yoktu; engine diagnostics response'ta yer almıyordu.
- **Çözüm:** `lib/yoai/proposalEngineOrchestrator.ts` oluşturuldu: `buildProposalEngineContext()` tek çağrıyla intent profile build + platform-specific competitor query plan expansion yapar; `EngineContextDiagnostics` (intentProfilesBuilt, lowConfidenceIntentCount, competitorQueryPlansBuilt, queryPlanConfidenceLow, fallbackUsed) döndürür. Platform izolasyonu garantilidir: Google proposal → `platform:'google'` query plan, Meta proposal → `platform:'meta'` query plan; platformlar karışmaz. `adCreator.ts` güncellendi: `CompetitorQueryPlan` import eklendi; `buildPrompt` ve `generateFullAutoProposals`'a `competitorQueryPlansByCampaignId` parametresi eklendi; her kampanya analiz bloğuna `RAKİP SORGU PLANI (platform, güven%)` satırı eklendi; `_debug`'a `policyRejectedCount`, `policyReviewRequiredCount`, `competitorQueryPlansUsed` eklendi. `generate-ad/route.ts` güncellendi: inline intent building kaldırıldı, yerine `buildProposalEngineContext()` çağrısı eklendi; `competitorQueryPlansByCampaignId` `generateFullAutoProposals`'a geçirildi; response'a `engineDiagnostics` (intentProfilesUsed, lowConfidenceIntentCount, competitorQueryPlansUsed, queryPlanConfidenceLow, policyRejectedCount, policyReviewRequiredCount, fallbackUsed, byPlatform) eklendi. UI/approval/publish/meta-ads/google-ads akışları değişmedi. 12/12 unit test geçiyor, typecheck temiz, build başarılı.
- **Dosyalar:** `lib/yoai/proposalEngineOrchestrator.ts` (yeni), `lib/yoai/adCreator.ts`, `app/api/yoai/generate-ad/route.ts`, `src/tests/proposalEngineFinalBinding.test.ts` (yeni), `docs/CHANGELOG.md`

---

## 2026-05-12 — Monthly Official Ads Docs Refresh
- **Sorun:** Google ve Meta resmi dokümanları değiştiğinde YoAlgoritma bunu fark etmiyordu; knowledge base manuel güncelleme gerektiriyordu.
- **Çözüm:** `lib/yoai/officialAdsDocsRefresh.ts` oluşturuldu: `normalizeOfficialAdsContent` (html/rss/markdown/manual_review stratejileri), `hashOfficialAdsContent` (SHA-256), `summarizeOfficialAdsDiff`, `classifyOfficialAdsChange` (critical/high → review_required, medium/low → active), `fetchOfficialAdsSource` (15s timeout, AbortController), `runOfficialAdsDocsRefresh` (supabase injection). `app/api/cron/official-ads-refresh/route.ts` oluşturuldu: CRON_SECRET koruması (Authorization: Bearer veya ?secret=), `official_ads_refresh_runs` tablosuna run kaydı, her kaynak için fetch+normalize+hash karşılaştırması, hash değişmişse snapshot yazma + source status güncelleme, fetch hatasında job patlamaz. `vercel.json`'a `0 6 1 * *` (her ayın 1'i 06:00 UTC) monthly cron eklendi. Mevcut daily-run cron değişmedi. Approved knowledge items otomatik ezilmez; sadece sources/snapshots/refresh_runs tabloları yazılır. 12/12 unit test geçiyor, typecheck temiz, build başarılı.
- **Dosyalar:** `lib/yoai/officialAdsDocsRefresh.ts` (yeni), `app/api/cron/official-ads-refresh/route.ts` (yeni), `vercel.json`, `src/tests/officialAdsDocsRefresh.test.ts` (yeni), `docs/CHANGELOG.md`

---

## 2026-05-12 — Competitor Query Expander
- **Sorun:** Rakip bulunamadı sorununun büyük bölümü gerçekten rakip olmamasından değil, yanlış veya zayıf arama sorgusundan kaynaklanıyordu. Tek düz anahtar kelime yerine kampanya niyetine dayalı bağlamsal sorgular üretilmesi gerekiyordu.
- **Çözüm:** `lib/yoai/competitorQueryExpander.ts` oluşturuldu. `CampaignIntentProfile` + kampanya sinyallerinden (servis adı, domain, offer type, detected_keywords, keyword list, reklam grubu adları) platform-spesifik `CompetitorQueryPlan` üretir. Google için niyet odaklı arama sorguları, Meta için sosyal reklam dili sorgular ayrı üretilir; platformlar karışmaz. Deterministic heuristic önce çalışır; confidence < 50 ise OpenAI ile genişletilir; LLM başarısız olursa sistem kırılmaz. `lib/yoai/competitorScanner.ts`'e `deriveCompetitorQueryPlan` fonksiyonu ve `CompetitorScanResult`'a diagnostic alanları eklendi (`usedQuery`, `querySource`, `queryPlanConfidence`, `queryPlanReason`, `noResultReason`, `rawCount`, `usefulCount`). `meta-ad-library/route.ts` ve `google-auction/route.ts`'e `diagnostic` response bloğu eklendi; rakip bulunamadı sebebi 5 kategoriye ayrıldı (query üretilemedi, sonuç yok, actor hata, usefulCount=0, platform auth eksik). 16/16 unit test geçiyor.
- **Dosyalar:** `lib/yoai/competitorQueryExpander.ts` (yeni), `lib/yoai/competitorScanner.ts`, `app/api/yoai/competitors/meta-ad-library/route.ts`, `app/api/yoai/competitors/google-auction/route.ts`, `src/tests/competitorQueryExpander.test.ts` (yeni), `docs/CHANGELOG.md`

---

## 2026-05-12 — Campaign Intent Engine
- **Sorun:** YoAlgoritma proposal üretmeden önce kampanyanın gerçek iş bağlamını (ne sattığı, kime sattığı, dönüşüm hedefi) anlamıyordu. Bu yüzden "Sitemizi Ziyaret Edin" gibi jenerik başlıklar üretebiliyordu.
- **Çözüm:** `lib/yoai/campaignIntentEngine.ts` oluşturuldu. Kampanya adı, reklam seti adları, reklam metinleri ve landing page içeriğinden `CampaignIntentProfile` çıkarır (business_domain, offer_type, service_or_product, target_audience, conversion_goal, funnel_stage, detected_keywords, vb.). Önce deterministic heuristic (domain signal lookup tablosu), düşük confidence'da OpenAI LLM ile zenginleştirme. `lib/yoai/landingPageAnalyzer.ts` oluşturuldu: URL fetch (8s timeout), HTML'den title/meta/h1-h3/body text çıkarma, normalize + summary. Fetch hatası sistemi kırmaz; error missing_data'ya yazılır. `supabase/migrations/20260512100000_create_campaign_intent_profiles.sql` migration eklendi: (user_id, platform, campaign_id) unique, 7 gün TTL, RLS aktif. `adCreator.ts` güncellendi: `buildPrompt` ve `generateFullAutoProposals` fonksiyonlarına `intentProfilesByCampaignId` parametresi eklendi; sistem prompt'a jenerik başlık yasağı kuralı, her kampanya bloğuna KAMPANYA INTENT bölümü eklendi. `generate-ad/route.ts` güncellendi: decision desk sonrası intent profil build edilip `generateFullAutoProposals`'a geçiriliyor. 10/10 unit test geçiyor.
- **Dosyalar:** `lib/yoai/campaignIntentEngine.ts` (yeni), `lib/yoai/landingPageAnalyzer.ts` (yeni), `supabase/migrations/20260512100000_create_campaign_intent_profiles.sql` (yeni), `lib/yoai/adCreator.ts`, `app/api/yoai/generate-ad/route.ts`, `src/tests/campaignIntentEngine.test.ts` (yeni), `docs/CHANGELOG.md`

---

## 2026-05-12 — Proposal Policy Guard (Faz B)
- **Sorun:** YoAlgoritma'nın ürettiği öneriler UI'ya ve publish akışına, platform kuralları açısından hiç kontrol edilmeden düşüyordu. Google başlıklarında ünlem, 30 karakter üzeri başlık, 90 karakter üzeri açıklama, teknik enum görünürlüğü (MAXIMIZE_CONVERSIONS, OUTCOME_ENGAGEMENT vb.) ve Meta'da geçersiz objective/destination kombinasyonları (OUTCOME_ENGAGEMENT + ON_AD) gözden kaçıyordu.
- **Çözüm:** `lib/yoai/proposalPolicyGuard.ts` oluşturuldu. Google guard: ünlem kaldırma, emoji kaldırma, başlık 30 / açıklama 90 karakter limiti (normalize + violation), teknik enum Türkçeye çevirme, ALLCAPS yoğunluğu, generic headline tespiti. Meta guard: capability matrix (`capabilityMatrix.ts`) ile objective/destination uyumluluk kontrolü, geçersiz destination'ları fallback ile normalize etme (ON_AD→ON_PAGE, WHATSAPP→ON_PAGE vb.), teknik enum temizleme. Official Ads Knowledge Base forbidden_values entegrasyonu. `adCreator.ts`'e `applyPolicyGuardToProposals` çağrısı eklendi; rejected öneriler proposal listesinden çıkarılıyor. `FullAdProposal` tipine geriye uyumlu `policyStatus?`, `policyViolations?`, `policySummary?` alanları eklendi. `AdPreviewCard.tsx` review_required durumunda "Platform Kuralı Uyarısı" bandı gösteriyor. `AiAdSuggestions.tsx` rejected proposal'ları filtreden geçiriyor. Unit testler eklendi.
- **Dosyalar:** `lib/yoai/proposalPolicyGuard.ts` (yeni), `lib/yoai/adCreator.ts`, `components/yoai/AdPreviewCard.tsx`, `components/yoai/AiAdSuggestions.tsx`, `src/tests/proposalPolicyGuard.test.ts` (yeni), `docs/CHANGELOG.md`

---

## 2026-05-12 — Official Ads Knowledge Base Foundation (Faz A)
- **Sorun:** Google ve Meta reklam bilgileri adCreator.ts içinde hardcoded sabit olarak tutuluyordu; DB-driven, güncellenebilir ve resmi kaynaklara bağlanabilir bir yapı yoktu.
- **Çözüm:** 4 yeni tablo oluşturuldu (`official_ads_sources`, `official_ads_knowledge_items`, `official_ads_doc_snapshots`, `official_ads_refresh_runs`). 10 resmi kaynak URL'si ve 12 knowledge item (6 Meta objective + 6 Google kampanya türü) seed edildi. `officialAdsKnowledgeStore.ts` loader yazıldı: 60s cache, table-missing fallback, boş liste dönünce adCreator.ts hardcoded fallback devreye girer. `adCreator.ts`'e DB knowledge entegrasyonu eklendi: `getApprovedKnowledgeByPlatform` ile AI prompt'a `RESMİ BİLGİ TABANI (DB)` bloğu additive olarak ekleniyor. Mevcut proposal şeması, approval/publish logic, UI bileşenleri değişmedi.
- **Dosyalar:** `supabase/migrations/20260512000000_create_official_ads_knowledge_base.sql`, `lib/yoai/officialAdsKnowledgeStore.ts`, `lib/yoai/adCreator.ts`, `docs/CHANGELOG.md`

---

## 2026-05-11 — Wizard Dark Premium Tasarım + Meta Preflight Uyumluluk Düzeltmesi
- **Sorun:** ONAYLA sonrası açılan wizard ve MetaPreflightPanel eski beyaz modal tasarımında kalıyordu. `OUTCOME_ENGAGEMENT + ON_AD` kombinasyonu capability matrix'te yoktu, preflight "v1 kapsamında desteklenmiyor" teknik hatası veriyordu. `PAUSED`, `pageSel.source` gibi teknik stringler kullanıcıya görünüyordu.
- **Çözüm:** `AdCreationWizard.tsx` tüm adımlar dark premium (`bg-[#0f172a]`, `border-[#1e2d45]`) tasarıma taşındı. `MetaPreflightPanel.tsx` dark renk paleti, koyu input/select/radio, kullanıcı dostu hata mesajları, `ASSET_LABELS` map ile teknik asset adları Türkçe'ye çevrildi, "PAUSED" butonu kaldırıldı. `normalizeMetaDestination()` fonksiyonu ile `OUTCOME_ENGAGEMENT + ON_AD/WHATSAPP/MESSENGER/IG_DIRECT` → `ON_PAGE` normalize edildi. `lib/yoai/adCreator.ts` `OUTCOME_ENGAGEMENT.bestDestinations` sadece desteklenen `['ON_PAGE', 'WEBSITE']` olarak düzeltildi.
- **Dosyalar:** `components/yoai/AdCreationWizard.tsx`, `components/yoai/MetaPreflightPanel.tsx`, `lib/yoai/adCreator.ts`, `docs/CHANGELOG.md`

## 2026-05-11 — Diagonal Renk Kesişimi (Slash Karakteri Kaldırıldı)
- **Sorun:** ONAYLA/REDDET butonları arasında beyaz "/" karakteri görünüyordu.
- **Çözüm:** Slash span tamamen kaldırıldı. REDDET butonu `clip-path: polygon(16px 0%, 100% 0%, 100% 100%, 0% 100%)` + `margin-left: -16px` ile yeşil/kırmızı renklerin diagonal kesişimi oluşturuldu. Wrapper `overflow-hidden rounded-b-2xl`. Mini-confirm REDDET/VAZGEÇ aynı mantıkla güncellendi.
- **Dosyalar:** `components/yoai/AiAdSuggestions.tsx`, `docs/CHANGELOG.md`

## 2026-05-11 — Slash Divider Overlay + AI Analiz Yetenekleri Kaldırıldı
- **Sorun:** ONAYLA/REDDET butonları arasında "/" işareti için ayrı padding (px-2) ile boşluk açılıyordu. Slash butonlar arasına gap yaratıyordu. "AI Analiz Yetenekleri" bölümü /yoai sayfasında gereksiz yer kaplıyordu.
- **Çözüm:** Slash span kaldırıldı, container `relative flex` yapıldı; slash `absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10` overlay olarak yerleştirildi. ONAYLA `rounded-bl-2xl`, REDDET `rounded-br-2xl`. REDDET/VAZGEÇ mini-confirm aynı mantıkla güncellendi. `AnalysisCapabilities` bileşeni page.tsx'ten kaldırıldı (import + kullanım).
- **Dosyalar:** `components/yoai/AiAdSuggestions.tsx`, `app/yoai/page.tsx`, `docs/CHANGELOG.md`

## 2026-05-11 — Proposal Kart Hizalama + Aksiyon Buton Kontrast Düzeltmesi
- **Sorun:** Aynı satırdaki proposal kartları farklı yükseklikte bitiyordu. ONAYLA/REDDET butonları şeffaf arka planla okunaksız görünüyordu. Ayraç dikey çizgi ("|") olarak görünüyordu. AI Kontrol Notu bazı kartların yüksekliğini aşırı büyütüyordu. Yazı kontrası düşüktü.
- **Çözüm:** `AdPreviewCard` kökü `h-full flex flex-col` yapıldı; ana içerik alanı `flex-1`; action footer kart içine taşınarak `border-t` ile ayrıldı. `actionFooter?: ReactNode` prop eklendi, kart artık `div` (eskiden `button`). ONAYLA: `bg-emerald-600 text-white`; REDDET: `bg-red-600 text-white`. Ayraç "/" metin karakteri oldu, tıklanamaz. AI Kontrol Notu `max-h-[110px] overflow-hidden line-clamp-2` ile sınırlandı. Label renkleri `text-slate-500` → `text-slate-400`, açıklama renkleri `text-slate-400` → `text-slate-300`'e yükseltildi. Mini-confirm separator da "|" → "/" güncellendi.
- **Dosyalar:** `components/yoai/AdPreviewCard.tsx`, `components/yoai/AiAdSuggestions.tsx`, `docs/CHANGELOG.md`

## 2026-05-11 — Google Competitor Context Injection Düzeltmesi
- **Sorun:** `generate-ad/route.ts` içinde `platformCompetitorAds = p === 'Meta' ? competitorAnalysis.competitorAds : []` satırı Google proposal'larına her zaman boş rakip context geçiriyordu. `competitorAnalysis.competitorAds` sadece Meta Ad Library'den geldiği için Google'a Meta rakip verisi karışma riski vardı ve DB'deki Google rakip verileri kullanılmıyordu. Ayrıca `adCreator.ts`'deki `hasCompetitorData` guard, `persistedCompetitorContext` var olsa bile sadece `competitorAds.length > 0` bakarak Google proposal'larına "rakip bulunamadı" mesajı yazıyordu.
- **Çözüm:** (1) `route.ts`: Meta için `competitorAnalysis.competitorAds` (Meta Ad Library) kullanılır; Google için `listCompetitorAds(userId, { platform: 'google', limit: 50 })` ile DB'den Google rakip reklamları çekilir, `compareWithCompetitors` ile Google'a özel comparison üretilir. (2) `adCreator.ts`: `hasCompetitorData = competitorAds.length > 0 || !!persistedCompetitorContext` — `persistedCompetitorContext` (yoai_competitor_insights DB) varken "bulunamadı" mesajı yazılmaz; AI prompt'ta beslenen insight kullanılır. Platformlar arası veri karışması sıfırlandı.
- **Dosyalar:** `app/api/yoai/generate-ad/route.ts`, `lib/yoai/adCreator.ts`, `docs/CHANGELOG.md`

## 2026-05-11 — Google Proposal Rakip Kaynak Etiketi Düzeltme + Stale Cache Temizleme
- **Sorun:** Google öneri kartında / wizard önizlemesinde "Meta Ad Library'den rakip reklam bulunamadı" metni görünüyordu. Eski persisted proposal'lar DB'de yanlış kaynak etiketiyle saklanmıştı; `forceGenerate=false` yolunda sanitizasyon yoktu. localStorage `yoai_proposals_cache_v1` de aynı stale veriyi tutuyordu.
- **Çözüm:** (1) `lib/yoai/competitorDisplay.ts` yeni helper dosyası oluşturuldu: `getCompetitorSourceLabel`, `getEmptyCompetitorMessage`, `sanitizeProposalForDisplay` fonksiyonları. Google proposal'da Meta kaynak metni varsa `sanitizeProposalForDisplay` otomatik düzeltiyor. (2) `adCreator.ts`: hardcoded platform mesajları `getEmptyCompetitorMessage(platform)` helper'ına bağlandı. (3) `generate-ad/route.ts`: persisted proposals dönerken `sanitizeProposalForDisplay` uygulandı — DB'deki eski stale metin artık kullanıcıya çıkmıyor. (4) `AiAdSuggestions.tsx`: localStorage cache key `v1 → v2` bump edildi (tüm kullanıcılarda eski cache geçersizleşti), cache okuma ve API fetch sonrası da `sanitizeProposalForDisplay` uygulandı. (5) Google kartlarında "Google Reklam Şeffaflık Merkezi", Meta kartlarında "Meta Reklam Kütüphanesi" doğru şekilde gösteriliyor.
- **Dosyalar:** `lib/yoai/competitorDisplay.ts` (yeni), `lib/yoai/adCreator.ts`, `app/api/yoai/generate-ad/route.ts`, `components/yoai/AiAdSuggestions.tsx`, `docs/CHANGELOG.md`

## 2026-05-11 — YoAlgoritma ONAYLA / REDDET Production UX Birleştirme
- **Sorun:** Meta ONAYLA eski "Tek Tıkla Onayla" modalını açıyordu (farklı akış); Google ONAYLA AdCreationWizard açıyor ama wizard içinde "Devam Et" direkt `handlePublish()` tetikliyordu — onay adımı yoktu. REDDET büyük modal + category dropdown + textarea açıyordu, kart listeden de kalkmıyordu.
- **Çözüm:** (1) Meta ONAYLA → `OneClickApproveDialog` bağlantısı kaldırıldı; artık her iki platform için de `onOpenWizard(proposal)` çağrılıyor — AdCreationWizard açılıyor. (2) AdCreationWizard'a `'confirm'` adımı eklendi: Google için "Devam Et" artık direkt publish değil, `confirm` adımına gidiyor; burada kampanya özeti (platform, isim, hedef, bütçe, başlık, URL) + "Yayınla" butonu gösteriliyor. (3) Meta wizard değişmedi: preflight → creative → publish. (4) Wizard başlığı `initialProposal` varsa "Öneri Onayı" olarak gösteriliyor. (5) REDDET artık büyük modal açmıyor: kart içinde inline mini-confirm gösteriyor ("Bu öneriyi reddetmek istiyor musunuz? REDDET / VAZGEÇ"). (6) Reddet onaylanınca kart `proposals` listesinden çıkarılıyor — ekrandan kalkıyor. localStorage cache de güncelleniyor. (7) `OneClickApproveDialog`, `ReasonModal`, `REJECTION_CATEGORIES`, `humanizeCta`, `CTA_LABELS` gereksiz kod AiAdSuggestions'tan tamamen kaldırıldı. (8) `publishResult.message` içindeki "PAUSED" otomatik "taslak"a dönüştürülüyor.
- **Dosyalar:** `components/yoai/AiAdSuggestions.tsx`, `components/yoai/AdCreationWizard.tsx`, `docs/CHANGELOG.md`

## 2026-05-11 — YoAlgoritma Proposal Card Aksiyon Akışı + UI Temizliği
- **Sorun:** Öneri kartlarında 4-ikon aksiyon satırı (göz/kalem/saat/çarpı) ve "Onayla ve Yayınla (PAUSED)" butonu yanlış UX veriyordu; diagnostic uyarılar kartın dışında ayrı kutular olarak duruyordu; teknik enum stringler (MAXIMIZE_CONVERSIONS, ON_AD vb.) kullanıcıya ham gösteriliyordu; Meta/Google akışı asimetrikti.
- **Çözüm:** (1) 4-ikon satırı tamamen kaldırıldı. (2) "Onayla ve Yayınla (PAUSED)" kaldırıldı; yerine ONAYLA/REDDET iki parçalı dark premium aksiyon çubuğu eklendi (ortada dikey ayırıcı, ONAYLA emerald, REDDET kırmızımsı). (3) ONAYLA: Meta için OneClickApproveDialog, Google için AdCreationWizard açar — hem Meta hem Google aynı UX mantığı. (4) REDDET: reject modalı açar, kart listeden kalkar. (5) Diagnostic/uyarı kutular `AdPreviewCard` içine "AI Kontrol Notu" olarak entegre edildi — kartın dışında kopuk kutu kalmadı. (6) `MAXIMIZE_CONVERSIONS`, `ON_AD`, `SEND_MESSAGE`, `OUTCOME_ENGAGEMENT` gibi tüm enum'lar kullanıcı dostu Türkçeye çevrildi (`fmtBidding`, `fmtOptGoal`, `fmtDest` + `BIDDING_STRATEGY_LABEL` haritaları). (7) "PAUSED" kullanıcıya gösterilmiyor: OneClickApproveDialog'da "PAUSED" → "taslak" olarak değiştirildi, error interceptor ile "YOAI_DIRECT_PUBLISH_ENABLED" hata mesajı → kullanıcı dostu Türkçe mesaja dönüştürüldü. (8) Google RSA kart: başlıklar chip formatında, anahtar kelimeler emerald chip olarak modernleştirildi. (9) Backend/API/Apify/AI şeması değişmedi, publish guard'ları korundu.
- **Dosyalar:** `components/yoai/AiAdSuggestions.tsx`, `components/yoai/AdPreviewCard.tsx`, `components/yoai/OneClickApproveDialog.tsx`, `docs/CHANGELOG.md`

## 2026-05-11 — YoAlgoritma Dark Premium Kart Tasarımı + Lab Arka Planı
- **Sorun:** AI Reklam Önerisi kartları sade beyaz/açık tonlarda, premium AI deneyimi hissini yeterince vermiyordu. Arka planda dekoratif unsur yoktu.
- **Çözüm:** (1) `AdPreviewCard.tsx` tamamen yeniden tasarlandı: kart arka planı `bg-[#0f172a]` (dark navy), border `border-[#23314d]`, hover `border-emerald-400/40`, iç preview panel `bg-[#151f33]`. Badge renkleri `bg-indigo-500/20 text-indigo-200`, güven metni `text-slate-400`, label/value çiftleri slate tonları, beklenen performans `text-emerald-400`, AI gerekçesi `text-indigo-400` başlıkla. CTA enum'ları humanize edildi (`SEND_MESSAGE → Mesaj Gönder` vb.). (2) `app/yoai/page.tsx`'te sağ içerik alanına 7 adet vektörel deney tüpü SVG eklendi — `pointer-events-none`, `absolute inset-0`, opacity 0.055–0.07, emerald/cyan/indigo tonlar, farklı boyut ve rotasyonlarda, CSS `@keyframes` ile yavaş yüzen animasyon. Sidebar'a hiç dokunulmadı.
- **Dosyalar:** `components/yoai/AdPreviewCard.tsx`, `app/yoai/page.tsx`

## 2026-05-11 — Competitor Insight insightError Yüzey Çıkarma + Table-Missing Görünürlüğü
- **Sorun:** `yoai_competitor_insights` tablosu production'da henüz yaratılmamışsa (migration uygulanmamış), `upsertCompetitorInsight` içindeki `isTableMissingError` dalı hata fırlatmak yerine `return null` yapıyordu. Route'un `catch` bloğu bunu yakalamıyordu; `insightRow = null` oluyordu ama `insightError` set edilmiyordu. Sonuç: response'da `insightId=null`, hiç `insightError` yok — sorun tamamen sessiz kalıyordu.
- **Çözüm:** (1) `upsertCompetitorInsight`'ta table-missing durumları `return null` yerine `throw new Error('competitor_insight_table_missing: apply migration ...')` yapıyor. (2) Aynı şekilde `!supabase` / `!userId` guard'ları da `throw` yapıyor. (3) Her iki route'a (Meta + Google, tüm sağlayıcı path'ları) `if (insightRow === null && !insightError)` safety-net check eklendi; bu durum da `insightError` olarak response'a yansıyor. Artık tüm insight başarısızlıkları response'da görünür; migration uygulanmadıysa `insightError: "competitor_insight_table_missing: apply migration ..."` mesajı gelir.
- **Dosyalar:** `lib/yoai/competitorInsightStore.ts`, `app/api/yoai/competitors/meta-ad-library/route.ts`, `app/api/yoai/competitors/google-auction/route.ts`

## 2026-05-11 — Competitor Insight Persist Düzeltildi (insightId artık dolu)
- **Sorun:** `upsertCompetitorInsight`'ın SELECT sorgusunda `campaign_type_context` ve `query_keyword` için `.eq(col, null)` kullanılıyordu. PostgREST'te `eq.null` SQL NULL'ı eşleştirmiyor (string 'null' karşılaştırması yapıyor). Bu yüzden mevcut insight satırı hiç bulunamıyor, INSERT denenince `COALESCE`-tabanlı unique constraint ihlali oluşuyor ve fonksiyon sessizce `null` dönüyordu. Meta Apify yolunda ayrıca insight hatası `insightError` olarak response'a yansımıyordu.
- **Çözüm:** (1) `upsertCompetitorInsight` SELECT: null değerler için `.eq()` → `.is()` olarak düzeltildi; artık `IS NULL` sorgusu üretiyor. (2) SELECT/UPDATE/INSERT hataları (table_missing hariç) artık `throw` ediyor; routelar try/catch ile yakalayıp `insightError` olarak response'a ekliyor. (3) Meta Apify + official path, Google SerpApi path: insight üretimi ayrı try/catch'e alındı, `insightError` tüm endpoint response'larında görünüyor.
- **Dosyalar:** `lib/yoai/competitorInsightStore.ts`, `app/api/yoai/competitors/meta-ad-library/route.ts`, `app/api/yoai/competitors/google-auction/route.ts`

## 2026-05-11 — Apify Competitor Normalization + Persistence Düzeltildi
- **Sorun:** (1) Meta actor `adStartDate`/`adEndDate` alanlarını Unix seconds (number) olarak döndürüyor; kod bunları doğrudan DB timestamp alanına yazınca `date/time field value out of range: "1772179200"` hatasıyla tüm 50 kayıt skipped oluyordu. (2) Google actor alanları yanlış map ediliyordu: `creativeId` → source_ad_id'e, `advertiserId` → source_page_id'e düşmüyor, `firstShown`/`lastShown`/`adUrl`/`imageUrl`/`previewUrl` alanları normalize edilmiyordu. (3) Google fingerprint boş alanlardan üretildiğinden farklı reklamlar aynı hash'e düşüp duplicate/update hatalı çalışıyordu. (4) `creative_assets` her zaman boş kalıyordu.
- **Çözüm:** (1) `normalizeAdDate()` helper eklendi: Unix seconds/ms number, numeric string, ISO string hepsini destekliyor; invalid ise null döndürüyor. (2) `normalizeApifyMetaAd`: date lookup'larına `adStartDate`/`adEndDate` eklendi; her iki tarih alanı `normalizeAdDate()` ile işleniyor — DB'ye artık ISO string veya null gidiyor. (3) `normalizeApifyGoogleAd`: `creativeId`/`advertiserId` doğru field'lara map edildi; `firstShown`/`lastShown`/`adUrl` lookup'lara eklendi; `imageUrl`→image asset, `previewUrl`→video/thumbnail asset olarak `creative_assets` dolduruluyor; `adFormat` extracted_signals'a taşındı. (4) Google route'ta insight store hataları artık `insightError` + `errors` alanlarında response'da görünüyor.
- **Dosyalar:** `lib/yoai/apifyCompetitorProvider.ts`, `app/api/yoai/competitors/google-auction/route.ts`

## 2026-05-11 — Apify Actor Routing + Meta URLs Schema Düzeltildi
- **Sorun:** (1) Google endpoint response'ında `actorId: curious_coder/facebook-ads-library-scraper` görünüyordu; `getApifyConfig()` her iki actor için hardcoded fallback kullandığından env var eksikliğinde Google route Meta actor ID'sini alabiliyordu. (2) Meta actor `urls: [searchUrl]` (string array) alırken `[{ url: searchUrl }]` (object array) bekliyordu → Apify HTTP 400 "Items in input.urls". (3) `APIFY_ACTOR_ID_missing` reason platform-agnostic'ti; hangi actor'ın eksik olduğu anlaşılamıyordu.
- **Çözüm:** (1) `getApifyConfig()`: hardcoded fallback actor ID'ler kaldırıldı; her iki alan artık yalnızca env var değeri (yoksa boş string). (2) `buildMetaActorInput`: `urls: [{ url: searchUrl }]` object array formatına çevrildi. (3) `runMetaApifyAdLibraryScan`: reason `'APIFY_META_ACTOR_ID_missing'`; `runGoogleApifyTransparencyScan`: reason `'APIFY_GOOGLE_ACTOR_ID_missing'`. Google route env var eksikse `supported:false` döner, asla Meta actor'a düşmez.
- **Dosyalar:** `lib/yoai/apifyCompetitorProvider.ts`

## 2026-05-11 — Apify Actor Input Mapping Düzeltildi + Failure Diagnostics Eklendi
- **Sorun:** Meta actor `totalRecords`/`limitPerInputUrl` yanlış input key kullanıyordu; boş sonuç riskini artırıyordu. Google actor `platform:'all'` geçersiz enum gönderdiği için FAILED oluyordu. Actor hata verdiğinde `statusMessage`, `exitCode`, `durationMillis` bilgileri route response'ında görünmüyordu.
- **Çözüm:** (1) `buildMetaActorInput`: `totalRecords` → `count`, `limitPerInputUrl` → `limitPerSource` olarak düzeltildi. (2) `buildGoogleActorInput`: `platform:'all'` tamamen kaldırıldı; `dateFrom`/`dateTo` undefined alanları da temizlendi — actor default tüm platformları tarar. (3) `runApifyActor`: Apify `runData`'dan `statusMessage`, `exitCode`, `stats.durationMillis` yakalanıp `ApifyActorRunResult`'a eklendi. (4) `runMetaApifyAdLibraryScan` / `runGoogleApifyTransparencyScan`: `actor_failed` branch bu diagnostic alanları `ApifyScanResult`'a propagate ediyor. (5) `meta-ad-library` route: `actor_failed` için explicit branch + diagnostic alanlar. (6) `google-auction` route: pending/empty/failed response'a `statusMessage`/`exitCode`/`durationMillis` eklendi.
- **Dosyalar:** `lib/yoai/apifyCompetitorProvider.ts`, `app/api/yoai/competitors/meta-ad-library/route.ts`, `app/api/yoai/competitors/google-auction/route.ts`

## 2026-05-11 — YoAlgoritma Command Center Sadeleştirildi + Öneri Kartları Modernize Edildi
- **Sorun:** /yoai ekranında KPI alanı ve Onay Geçmişi görünüyordu, sayfa odağını dağıtıyordu. Öneri kartları düzdü, platform bazlı renkli çerçeveler ve üst çizgiler vardı. "Onayla ve Yayınla" butonu kart arka planından ayrışmıyordu.
- **Çözüm:** (1) KpiDashboard render ve import'u page.tsx'den kaldırıldı. (2) ApprovalHistoryPanel render ve import'u page.tsx'den kaldırıldı, historyRefreshKey state temizlendi. (3) Sayfa sırası: Hero → AI Reklam Önerileri → AI Analiz Yetenekleri. (4) AdPreviewCard'dan Meta mavi ve Google 4-renkli üst çubuklar kaldırıldı. (5) Kart arka planı soft yeşil gradient (`from-white via-emerald-50/30 to-white`), border emerald-100/70, shadow-sm, hover: shadow-md + border-emerald-200/80. (6) Kart içine `radial-gradient` soft glow overlay eklendi (%10 opacity, pointer-events-none). (7) "Onayla ve Yayınla" butonu `bg-emerald-600 hover:bg-emerald-700 text-white font-semibold` ile netleştirildi.
- **Dosyalar:** `app/yoai/page.tsx`, `components/yoai/AdPreviewCard.tsx`, `components/yoai/AiAdSuggestions.tsx`

## 2026-05-11 — Rakip İçgörüsü Platforma Göre Ayrıldı (Competitor Insight Source Fix)
- **Sorun:** Google önerilerinde "Meta Ad Library'den rakip reklam bulunamadı" yazıyordu. Google için Meta Ad Library ifadesi hatalıydı. Ayrıca Meta competitor ads (rakip analizi sadece Meta'dan çekiyordu) Google proposals'a da geçiriliyordu. CTA alanı teknik enum değerleri (ör. SEND_MESSAGE) gösteriyordu.
- **Çözüm:** (1) `adCreator.ts`'de boş rakip mesajı platform bazlı ayrıldı: Meta → "Meta reklam kütüphanesi", Google → "Google reklam şeffaflık merkezi", diğer → genel mesaj. (2) `generate-ad/route.ts`'de `competitorAds` platform filtreli geçirildi: Google proposals için `[]`, Meta proposals için Meta analiz sonuçları. (3) `AiAdSuggestions.tsx` detail modalda CTA enum değerleri Türkçe etikete çevrildi (`humanizeCta` helper + `CTA_LABELS` haritası, 30+ enum).
- **Dosyalar:** `lib/yoai/adCreator.ts`, `app/api/yoai/generate-ad/route.ts`, `components/yoai/AiAdSuggestions.tsx`

## 2026-05-11 — KPI Platform Selector Kompakt Boyuta Küçültüldü
- **Sorun:** Sol platform selector butonları (Tümü/Meta/Google) fazla büyüktü, sağdaki KPI kart alanını sıkıştırıyordu.
- **Çözüm:** Kolon genişliği `sm:w-24` → `sm:w-14`, padding `px-3 py-2` → `px-2 py-1.5`, font `text-[13px]` → `text-[11px]`, border-radius `rounded-xl` → `rounded-lg`, wrapper gap `gap-4` → `gap-3` olarak küçültüldü.
- **Dosyalar:** `components/yoai/KpiDashboard.tsx`

## 2026-05-11 — KPI Platform Selector Dikey Sol Rail'e Taşındı
- **Sorun:** Tümü / Meta / Google seçimi KPI kartlarının üstünde yatay tab olarak duruyordu.
- **Çözüm:** Layout `flex-col sm:flex-row` yapısına çevrildi. Selector desktop'ta KPI kartlarının solunda `w-24` dar kolon olarak alt alta durur; mobilde yatay 3 buton olarak kalır. Aktif buton `bg-primary/10 text-primary border-primary/30`; pasif `bg-gray-50 text-gray-500 border-gray-200`; hover `border-primary/20`. KPI hesaplama mantığı (Tümü/Meta/Google) değişmedi.
- **Dosyalar:** `components/yoai/KpiDashboard.tsx`

## 2026-05-11 — Onay Geçmişi Detay Alanı Kullanıcı Odaklı Hale Getirildi
- **Sorun:** Detay bölümünde Proposal ID, Audit ID, Kaynak Kampanya ID gibi teknik alanlar kullanıcıya gösteriliyordu; `DetailRow` label'ları iki satıra kırılıyordu.
- **Çözüm:** Tüm teknik ID alanları (proposal_id, publish_audit_id, source_campaign_id) detay bölümünden kaldırıldı — admin/debug için kod yorumu bırakıldı. Detay bölümünde yalnızca kullanıcıya anlamlı bilgiler kaldı: Başlık, Hedef, Günlük Bütçe, CTA, Neden, Sonuç Notu, AI Güven, Oluşturuldu, Güncellendi. `DetailRow` bileşeni `mono` prop'u kaldırılarak sadeleştirildi; label'lara `whitespace-nowrap` + `minWidth: 5.5rem` uygulandı — tüm label'lar artık tek satırda kalıyor. "Teknik Detaylar" başlığı "Detaylar" olarak değiştirildi.
- **Dosyalar:** `components/yoai/ApprovalHistoryPanel.tsx`

## 2026-05-11 — Onay Geçmişi Kart UI Polish
- **Sorun:** Günlük Bütçe label'ı iki satıra kırılıyor; CTA teknik enum olarak görünüyor (SEND_MESSAGE vb.); kart çerçevesi yeterince belirgin değil; Detay bölümü karta entegre görünmüyor; alan amacı kullanıcıya açık değil.
- **Çözüm:** Alan başlığının altına Türkçe açıklama eklendi. `InfoRow` label'larına `whitespace-nowrap` + `5.5rem` min-width uygulandı (Günlük Bütçe artık tek satırda). CTA enum'ları için `humanizeCta` fonksiyonu eklendi (SEND_MESSAGE → Mesaj Gönder; bilinmeyenleri otomatik capitalize). Kart border `gray-200`'e güçlendirildi, hover'da `primary/30` border + shadow-md eklendi. Detay bölümü `bg-gray-50/60` + `rounded-xl` ile kart içine entegre edildi, "Teknik Detaylar" başlığı ile ayrıştırıldı. "Detay" butonu "Detayları Gör / Detayları Gizle" olarak güncellendi.
- **Dosyalar:** `components/yoai/ApprovalHistoryPanel.tsx`

## 2026-05-11 — Onay Geçmişi Modern Kart Grid Tasarımı
- **Sorun:** ApprovalHistoryPanel accordion/liste görünümündeydi; teknik ID alanları (Proposal ID, Audit ID) ana ekranda görünüyordu; tasarım modern kart mantığına uymuyordu.
- **Çözüm:** Bileşen tamamen yeniden tasarlandı. Accordion kaldırıldı, responsive kart grid oluşturuldu (1/2/3 kolon). Her kart; status badge, platform badge, AI kararı badge, sonuç badge, kampanya adı, hedef, bütçe, başlık, CTA, neden, kategori badge ve tarih gösteriyor. Teknik alanlar (Proposal ID, Audit ID, Kaynak Kampanya) "Detay" butonuyla açılan kart alt bölümüne taşındı. Hover animasyonu (hafif yükselme + shadow) eklendi.
- **Dosyalar:** `components/yoai/ApprovalHistoryPanel.tsx`

## 2026-05-11 — KPI Dashboard Platform Ayrımı (Meta / Google)
- **Sorun:** YoAlgoritma KPI özet alanı Meta ve Google metriklerini tek toplamda gösteriyordu. CTR ve CPC hangi platforma ait belli değildi.
- **Çözüm:** KpiDashboard'a platform tab'ı eklendi (Tümü / Meta / Google). Tümü modunda yanıltıcı CTR/CPC kaldırıldı; Meta ve Google tab'larında platformBreakdown verisiyle CTR ve CPC ayrı hesaplanıyor. Kart başlıkları "Meta CTR", "Google CPC" gibi platform bazlı hale getirildi.
- **Dosyalar:** `components/yoai/KpiDashboard.tsx`

## 2026-05-11 — AiAdSuggestions: Duplicate Startup Fetch Fix
- **Sorun:** `/yoai` fresh açılışında `generate-ad` endpoint'i 2 kez çağrılıyordu. `connectedPlatforms` prop'u parent re-render'da yeni dizi referansı olarak gelince `fetchProposals` useCallback yeniden oluşuyor, useEffect ikinci kez tetikleniyordu.
- **Çözüm:** `connectedPlatforms` değeri `connectedPlatformsRef` ile ref'e alındı; `fetchProposals` deps listesi boşaltıldı (`[]`). useEffect'e `lastFetchedKeyRef` guard eklendi: `platformsKey = connectedPlatforms.slice().sort().join(',')` değişmemişse fetch yapılmıyor. `forceGenerate=true` çağrıları guard'dan bağımsız, doğrudan `fetchProposals(true)` ile çalışmaya devam ediyor.
- **Dosyalar:** `components/yoai/AiAdSuggestions.tsx`

## 2026-05-11 — Faz 2D: Identity Key Fix — session_id → user_id
- **Sorun:** 15 yoai route, DB anahtarı olarak `session_id` (her login'de değişen rastgele UUID) kullanıyordu. CRON `user_id` (signups.id — stabil) ile yazıyor, UI `session_id` ile okuyordu. Veri asla görüntülenemiyordu.
- **Çözüm:** Tüm yoai API route'larında `cookieStore.get('session_id')` → `cookieStore.get('user_id')` olarak değiştirildi (15 dosya, 20 satır).
- **Dosyalar:** `generate-ad`, `daily-run`, `command-center`, `results`, `approvals`, `approvals/[id]`, `approvals/[id]/versions`, `one-click-approve`, `actions/record`, `actions/outcomes`, `competitors/analyze`, `competitors/meta-ad-library`, `competitors/google-auction`, `articles`, `articles/[id]`

## 2026-05-11 — Faz 2C (fix): Apify Runtime Timeout Safety
- **Sorun:** `waitForFinish=120 s` + 30 s buffer = 150 s; Vercel `maxDuration=60 s` → production timeout riski.
- **Çözüm:**
  - `waitForFinish` default 120 s → **45 s** (hard cap ile, caller override edemez fazlasını).
  - `AbortSignal.timeout` = waitSecs + 8 s (eski +30 s).
  - `fetchApifyDatasetItems` timeout 30 s → **10 s**. Toplam bütçet: 45 + 10 = **55 s** < 60 s.
  - `isApifyRunStillRunning()` + `isApifyRunSucceeded()` status helper'ları eklendi.
  - Actor 45 s içinde bitmezse **error fırlatılmaz**; `{ supported:true, isPending:true, reason:'APIFY_RUN_STILL_RUNNING', runId, runStatus }` controlled response döner.
  - `ApifyScanResult` interface'e `isPending` ve `runStatus` eklendi.
  - `google-auction/route.ts` ve `meta-ad-library/route.ts` pending response'u 200 OK ile döndürür; `isPending`, `runStatus`, `runId` response'a yansıtıldı.
- **Dosyalar:** `lib/yoai/apifyCompetitorProvider.ts`, `app/api/yoai/competitors/google-auction/route.ts`, `app/api/yoai/competitors/meta-ad-library/route.ts`

## 2026-05-11 — Faz 2C: Apify Competitor Provider Layer
- **Sorun:** SerpApi Google + Meta API rakip reklam taraması için her ikisi de ayrı kimlik gerektiriyordu; birleşik bir Apify provider katmanı yoktu; actor input'ları backend tarafından dinamik üretilmiyordu.
- **Çözüm:**
  - **apifyCompetitorProvider.ts** (yeni) — `isApifyEnabled()`, `getApifyConfig()`, `runApifyActor()`, `fetchApifyDatasetItems()`, `buildMetaActorInput()`, `buildGoogleActorInput()`, `normalizeApifyMetaAd()`, `normalizeApifyGoogleAd()`, `mapApifyMetaToCompetitorAd()`, `mapApifyGoogleToCompetitorAd()`, `runMetaApifyAdLibraryScan()`, `runGoogleApifyTransparencyScan()`. Hardcoded demo query/URL yok. APIFY_API_TOKEN yoksa `supported:false`. Boş sonuç `empty_result` olarak raporlanır; sahte veri üretilmez. Quality stats (raw/normalized/useful/missing oranlar) her scan'de console.info ile loglanır.
  - **competitorScanner.ts** güncellendi — `runMetaCompetitorScanForUser()` ve `runGoogleCompetitorScanForUser()` Apify branch eklendi. `META_AD_LIBRARY_PROVIDER=apify` → Apify; aksi halde Meta API. `GOOGLE_ADS_TRANSPARENCY_PROVIDER=apify` → Apify; aksi halde SerpApi fallback. Meta kampanya sadece Meta actor, Google kampanya sadece Google actor — çapraz tarama yok. `runCompetitorScanForUser()` Apify provider'da metaAccessToken olmadan da Meta scan çalıştırır.
  - **google-auction/route.ts** güncellendi — `GOOGLE_ADS_TRANSPARENCY_PROVIDER=apify` ise Apify Google actor kullanır; değilse SerpApi path korunur. Response'a `provider`, `actorId`, `rawCount`, `normalizedCount`, `usefulCount` eklendi.
  - **meta-ad-library/route.ts** güncellendi — `META_AD_LIBRARY_PROVIDER=apify` ise Apify Meta actor kullanır; değilse Meta Graph API path korunur. Mevcut camelCase response shape geriye dönük uyumlu. Response'a `provider`, `actorId`, persist metadata eklendi.
  - **.env.example** güncellendi — `APIFY_API_TOKEN`, `APIFY_META_AD_LIBRARY_ACTOR_ID`, `APIFY_GOOGLE_ADS_TRANSPARENCY_ACTOR_ID`, `COMPETITOR_ADS_PROVIDER`, `META_AD_LIBRARY_PROVIDER`, `GOOGLE_ADS_TRANSPARENCY_PROVIDER` eklendi.
- **Dosyalar:** `lib/yoai/apifyCompetitorProvider.ts`, `lib/yoai/competitorScanner.ts`, `app/api/yoai/competitors/google-auction/route.ts`, `app/api/yoai/competitors/meta-ad-library/route.ts`, `.env.example`, `docs/CHANGELOG.md`

## 2026-05-11 — Faz 7: Result Tracking / Feedback Loop
- **Sorun:** Öneri sonuçları (before/after metrikleri) kaydedilmiyordu; uygulama etkisi takip edilemiyordu.
- **Çözüm:**
  - **yoai_recommendation_results migration** (yeni) — `supabase/migrations/20260510008000_create_yoai_recommendation_results.sql`: proposal_id, approval_id, source_campaign_id, platform, before_snapshot, after_snapshot, metric_delta, outcome (pending/improved/no_change/declined/insufficient_data), outcome_summary, status, RLS user-owned.
  - **resultTrackingStore.ts** (yeni) — `recordBeforeSnapshot()`, `recordAfterSnapshot()` (delta+outcome hesaplar), `computeMetricDelta()` (sayısal alan karşılaştırma), `summarizeOutcomeDeterministic()` (CTR±%15, CPC±%15, ROAS±%10 eşikleri), `listRecommendationResults()`. Supabase null guard; tablo yoksa soft-fail.
  - **results/route.ts** (yeni) — GET: liste (outcome/status/sourceCampaignId/limit filtreler); POST: `action:'before'` yeni kayıt, `action:'after'` delta+outcome güncelle.
  - **ApprovalHistoryPanel.tsx** güncellendi — expand açılınca `/api/yoai/results` lazy fetch; outcome badge (improved=emerald, declined=red, no_change/insufficient_data/pending=gray) satır header'ında gösterilir; expanded detail'de "Öneri Sonucu" satırı eklendi.
- **Dosyalar:** `supabase/migrations/20260510008000_create_yoai_recommendation_results.sql`, `lib/yoai/resultTrackingStore.ts`, `app/api/yoai/results/route.ts`, `components/yoai/ApprovalHistoryPanel.tsx`

## 2026-05-11 — Faz 6: Direct Publish Safety Layer Advanced
- **Sorun:** `one-click-approve` route'unda payload doğrulama, içerik politikası kontrolü ve feature flag guard yoktu; güvenlik kontrolleri dağınıktı.
- **Çözüm:**
  - **publishSafety.ts** (yeni) — `isDirectPublishEnabled()`, `isActivePublishEnabled()`, `assertPausedOnly()`, `getMaxDailyBudgetTry()`, `validatePublishFeatureFlags()`. Feature flag merkezi; ACTIVE publish açıksa hata fırlatır.
  - **publishPayloadValidator.ts** (yeni) — `validatePublishPayload()`: platform, campaignName, campaignObjective, headline, dailyBudget, finalUrl (destination'a göre koşullu), primaryText alanlarını kontrol eder. Eksik alan varsa `PAYLOAD_INVALID` döner.
  - **policyGuard.ts** (yeni) — `checkPolicyViolations()`: deterministic regex tabanlı içerik kontrolü (13 Türkçe/İngilizce kural). Garantili kazanç, risksiz yatırım, kumar, ilaç garantisi, clickbait gibi ifadeler riskLevel=high ise yayını bloklar, low ise uyarı verir. LLM çağrısı yok.
  - **one-click-approve/route.ts** güncellendi — Meta API çağrısından önce sırayla: assertPausedOnly + validatePublishFeatureFlags (step 0), validatePublishPayload (step 0B), checkPolicyViolations (step 7B). Her blok audit log + approval notifyApprovalAttempt yazar.
  - **OneClickApproveDialog.tsx** güncellendi — idle state'e "Otomatik güvenlik kontrolleri" bilgi kutusu eklendi (4 madde: feature flags, bütçe limiti, payload doğrulama, içerik politikası).
- **Dosyalar:** `lib/yoai/publishSafety.ts`, `lib/yoai/publishPayloadValidator.ts`, `lib/yoai/policyGuard.ts`, `app/api/yoai/one-click-approve/route.ts`, `components/yoai/OneClickApproveDialog.tsx`

## 2026-05-11 — Faz 2B: Google Ads Transparency Connector + Meta Scanner Completion
- **Sorun:** Google rakip reklam verisi mevcut değildi; `google-auction` route her zaman `supported:false` dönüyordu; `CompetitorDashboard` Google bağlantı durumunu göstermiyordu.
- **Çözüm:**
  - **googleTransparencyConnector.ts** (yeni) — SerpApi `google_ads_transparency_center` engine üzerinden Google Ads Transparency araması. `SERPAPI_API_KEY` yoksa `supported:false` döner, sahte veri üretilmez. `normalizeGoogleTransparencyAd()` ile `NormalizedCompetitorAd` formatına dönüştürür.
  - **competitorScanner.ts** (yeni) — Meta + Google rakip taramasını birleştiren unified scanner. `deriveCompetitorQueriesFromCampaigns()` (max 5 sorgu), `runMetaCompetitorScanForUser()`, `runGoogleCompetitorScanForUser()`, `runCompetitorScanForUser()` (Promise.allSettled — her platform soft-fail). Sahte veri üretilmez.
  - **google-auction/route.ts** güncellendi — SerpApi connector kullanılıyor; sonuçlar `upsertCompetitorAds` + `generateCompetitorInsightFromAds` + `upsertCompetitorInsight` ile persist ediliyor. Key yoksa `{ supported:false, reason:'SERPAPI_API_KEY_missing' }`.
  - **CompetitorDashboard.tsx** güncellendi — Header'a Meta / Google bağlantı durumu badge'leri eklendi (connected=emerald, missing_key/unavailable=gray). Google status `/api/yoai/competitors/google-auction` üzerinden fire-and-forget ile kontrol edilir.
  - **.env.example** güncellendi — `SERPAPI_API_KEY` ve `GOOGLE_ADS_TRANSPARENCY_PROVIDER=serpapi` eklendi.
- **Dosyalar:** `lib/yoai/googleTransparencyConnector.ts`, `lib/yoai/competitorScanner.ts`, `app/api/yoai/competitors/google-auction/route.ts`, `components/yoai/CompetitorDashboard.tsx`, `.env.example`

## 2026-05-11 — Faz 5: Approval Lifecycle Advanced / Decision Desk Visibility + Versioning + Rejection Learning Foundation
- **Sorun:** Multi-AI Decision Desk kararları kullanıcıya görünmüyordu; rejection/hold kararları yapısal kategori içermiyordu; approval'ların düzenleme geçmişi kaydedilmiyordu.
- **Çözüm:**
  - **yoai_approval_versions tablosu** — `supabase/migrations/20260510007000_create_yoai_approval_versions.sql`: approval başına versiyon satırları (original/edited/regenerated/manual); unique (approval_id, version_number); RLS user-owned; audit immutability (UPDATE/DELETE policy yok).
  - **approvalStore.ts** — `createApprovalVersion()`, `listApprovalVersions()`, `getLatestApprovalVersion()`, `ensureInitialApprovalVersion()` additive eklendi. Soft-fail pattern (tablo yoksa loglar, flow kırmaz).
  - **modelDecisionStore.ts** — `listModelDecisions` filtresine `proposalId` eklendi; `getLatestDecisionDeskResultByProposal()`, `listModelDecisionsForApproval()`, `getJudgeDecisionSummaryByCampaignIds()` additive eklendi.
  - **GET /api/yoai/approvals** — Her kayda `decision_badge` (latest judge decision özeti) eklendi; tek batch sorgusu (N+1 yok). List endpoint korundu.
  - **GET /api/yoai/approvals/[id]** — `decisionRows` (tam rol çıktıları) + `versionCount` eklendi; concurrent fetch ile performans korundu.
  - **POST/GET /api/yoai/approvals/[id]/versions** — Yeni route; GET versiyon listesi, POST versiyon oluşturma (`original` için idempotent).
  - **DecisionDeskSummary.tsx** — Yeni readonly component: judge final decision, confidence, risk, campaignTypeFidelity, rol durumları, final recommendation, creative brief, payload notes, unresolved risks, required human checks. Multi-AI disabled/karar yoksa açık mesaj.
  - **ApprovalVersionPanel.tsx** — Yeni component: approval başına versiyon listesi (collapse/expand); kaynak (original/edited/regenerated/manual), versiyon numarası, özet ve tarih.
  - **AiAdSuggestions.tsx** — Rejection/hold kategori dropdown'ları (8 red + 6 beklet kategorisi); kategori `metadata.rejection_category`/`metadata.hold_category` olarak PATCH body'e gidiyor. Kart action row'una `decision_badge` mini-göstergesi (AI karar + güven + kontrol sayısı). Detail modal: `DecisionDeskSummary` + `ApprovalVersionPanel` lazy yükleme; `handleEdit` akışında `source='edited'` version kaydı (non-blocking). Publish behavior korundu.
  - **ApprovalHistoryPanel.tsx** — `rejection_category`/`hold_category` metadata'sı expand detayında gösteriliyor; judge decision badge satır başlığında görünüyor; `decision_badge` tip eklendi.
- **Dosyalar:** `supabase/migrations/20260510007000_*`, `lib/yoai/approvalStore.ts`, `lib/yoai/modelDecisionStore.ts`, `app/api/yoai/approvals/route.ts`, `app/api/yoai/approvals/[id]/route.ts`, `app/api/yoai/approvals/[id]/versions/route.ts`, `components/yoai/DecisionDeskSummary.tsx`, `components/yoai/ApprovalVersionPanel.tsx`, `components/yoai/AiAdSuggestions.tsx`, `components/yoai/ApprovalHistoryPanel.tsx`

---

## 2026-05-10 — Faz 4: Multi-AI Decision Desk / Role-Based AI Evaluation + Judge Layer
- **Sorun:** Tek model ile üretilen AI proposal'larının karar kalitesi ve gerekçe güvenilirliği sınırlıydı; farklı perspektifler (strateji, kreatif, risk, teknik) tek çağrıda birleştiriliyordu.
- **Çözüm:**
  - **yoai_model_decisions tablosu** — `supabase/migrations/20260510006000_create_yoai_model_decisions.sql`: 5 rol (strategist/creative/risk_policy/technical_validator/judge) ve 4 provider (openai/anthropic/gemini/deterministic) için audit kayıtları; RLS ile kullanıcı yalnızca kendi kayıtlarını okur.
  - **multiAiTypes.ts** — `MultiAiRole`, `MultiAiProvider`, `RoleDecisionOutput`, `StrategistDecision`, `CreativeDecision`, `RiskPolicyDecision`, `TechnicalValidatorDecision`, `JudgeDecision`, `MultiAiDecisionDeskResult` tip tanımları.
  - **Provider wrapper'ları** — `aiProviders/openaiProvider.ts` (strategist/validator/judge), `aiProviders/anthropicProvider.ts` (risk_policy), `aiProviders/geminiProvider.ts` (creative, text-only bu fazda). API key yoksa `status='skipped'`; timeout ve hata durumunda `status='timeout'/'failed'`. Secret loglama yok.
  - **providerGuards.ts** — Timeout wrapper, JSON parse helper, secret redaction, input hash, cost estimation utilities.
  - **modelDecisionStore.ts** — `recordModelDecisionBatch()`, `listModelDecisions()`, `getLatestDecisionDeskResult()`. Tablo yoksa `[TABLE_MISSING]` warn; sistem kırılmaz.
  - **multiAiDecisionDesk.ts** — `isMultiAiEnabled()`, `runStrategistRole()`, `runCreativeRole()`, `runRiskPolicyRole()`, `runTechnicalValidatorRole()`, `runJudgeRole()`, `runMultiAiDecisionDesk()`. Roller paralel çalışır; judge tüm çıktıları sentezler; cost guard ve timeout koruması; deterministic fallback judge.
  - **adCreator.ts** — `decisionDeskResultsByCampaignId` parametresi eklendi; judge context prompt'a additive block olarak eklenir. Output schema değişmedi.
  - **generate-ad/route.ts** — `YOAI_MULTI_AI_ENABLED=true` ise synthesis paketleri üzerinden desk çalışır; disabled ise hiçbir provider çağrısı olmaz. Pending approval mapping ve publish lifecycle dokunulmadı.
  - **Shadow mode** — Multi-AI yalnızca proposal generation context kalitesini artırır; DB'ye audit kaydı yazar; publish yapmaz; approval status değiştirmez.
- **Dosyalar:** `supabase/migrations/20260510006000_create_yoai_model_decisions.sql`, `lib/yoai/multiAiTypes.ts`, `lib/yoai/aiProviders/providerGuards.ts`, `lib/yoai/aiProviders/openaiProvider.ts`, `lib/yoai/aiProviders/anthropicProvider.ts`, `lib/yoai/aiProviders/geminiProvider.ts`, `lib/yoai/modelDecisionStore.ts`, `lib/yoai/multiAiDecisionDesk.ts`, `lib/yoai/adCreator.ts` (additive), `app/api/yoai/generate-ad/route.ts` (additive)

## 2026-05-10 — Faz 3.5: Env Security Hardening (Cron + Webhook + Token + server-only)
- **Sorun:** Env/API Key Audit'ten gelen 8 kritik/yüksek bulgular: cron endpoint'leri CRON_SECRET yokken production'da açık kalıyordu; Meta webhook'ta hardcoded verify token fallback vardı; META_TOKEN_SECRET eksikken production'da sessiz hata oluşuyordu; `lib/supabase/client.ts` (service role key) `server-only` ile korunmuyordu; `.env.example` hiç yoktu.
- **Çözüm:**
  - **CRON_SECRET fail-secure** — `app/api/yoai/daily-run/route.ts` ve `app/api/strategy/jobs/runner/route.ts`: `CRON_SECRET` env yokken production'da 503 döner; local/dev'de bypass açık. Önceki `if (cronSecret && ...)` pattern güvensizdi.
  - **META_WEBHOOK_VERIFY_TOKEN** — `app/api/meta/webhook/route.ts`: Hardcoded `'yoai_webhook_verify_2024'` fallback kaldırıldı. Env yoksa GET verification 503 döner; production'da sessiz bypass yok.
  - **META_TOKEN_SECRET production log** — `lib/meta/crypto.ts`: `getSecret()` production ortamında secret eksikse `console.error` ile açık hata loglar; şifreleme null döner, sessiz bozulma yok.
  - **server-only guard** — `lib/supabase/client.ts` başına `import 'server-only'` eklendi; client component'ten yanlış import edilirse build-time error verir.
  - **`.env.example` oluşturuldu** — A–I grupları: Supabase, AI Providers (OpenAI/Anthropic/Gemini), Google/Google Ads, Meta, YoAlgoritma Safety Flags, Cron/Security, Competitor Intelligence, Payments, App/Auth. Tüm değerler placeholder.
- **Dosyalar:** `.env.example` (yeni), `app/api/yoai/daily-run/route.ts`, `app/api/strategy/jobs/runner/route.ts`, `app/api/meta/webhook/route.ts`, `lib/meta/crypto.ts`, `lib/supabase/client.ts`

## 2026-05-10 — Faz 3: Synthesis Engine v2 (Campaign + Doctrine + Competitor + Diagnosis Fusion)
- **Sorun:** AI proposal generator (`adCreator`) kampanya performansı, Faz 1 platform doctrine'ı ve Faz 2 kalıcı rakip içgörüsünü ayrı ayrı prompt'a yedikliyordu — birleştirilmiş tek bir karar bağlamı yoktu, kampanya türü sadakati her seferinde prompt'tan tekrar inşa ediliyordu, missing competitor / doctrine durumlarında deterministik fallback merkezi değildi.
- **Çözüm:**
  - **Yeni** `lib/yoai/synthesisTypes.ts` — `SynthesisInput`, `CampaignSynthesisPackage`, `CampaignSynthesisSource`, `SynthesisRisk`, `SynthesisOpportunity`, `SynthesisRecommendationConstraint`, `SynthesisConfidence`, `SynthesisEngineResult`, `PerformanceSnapshot`, `DoctrineSnapshot`, `DiagnosisSnapshot`, `CompetitorSnapshot`, `SynthesisSummary`. `mustKeepCampaignType: true` literal tipi schema seviyesinde garanti ediyor.
  - **Yeni** `lib/yoai/synthesisEngine.ts` — Deterministik fonksiyonlar: `summarizePerformanceSnapshot()` (% cinsinden CTR + roas/frequency null-safe), `extractDiagnosisSignals()` (problemTags + metrik tabanlı root-causes), `mergeDoctrineSignals()` (Faz 1 doctrine + fit), `mergeCompetitorSignals()` (Faz 2 insight; yoksa `available=false`), `decideMainProblem`/`decideMainOpportunity`, `buildProposalBrief` (≤1000 char, prompt-safe), `buildSynthesisContextForPrompt`, `buildCampaignSynthesisPackage(input)`, `buildSynthesisPackagesForCampaigns(campaigns, options)` (doctrine map'i tek fetch + competitor lookup cache + non-fatal warnings).
  - **Campaign type sadakati** — `buildForbiddenMoves(campaignType, platform)`: Meta Traffic→Sales/Engagement yasağı, Engagement→Lead/Sales yasağı, Message→web traffic yasağı, Lead→engagement yasağı, Sales→reach/awareness yasağı, Awareness→sales/lead yasağı, Search→Display kreatif yasağı, Display→Search keyword expansion yasağı, Video→non-video yasağı, PMax→tek kanal yasağı + her tip için `<platform>/<type> DEĞİŞTİRİLEMEZ` genel kuralı. Her paket `synthesis.forbiddenMoves[]` ve `constraints[]` olarak yazılır; ayrıca prompt brief'e "Forbidden:" satırı eklenir.
  - **Üç kaynak birleşimi** — Her `CampaignSynthesisPackage` (1) `performanceSnapshot` (spend/impr/clicks/ctr/cpc/conversions/cpm/roas/frequency), (2) `doctrine` (name/description/successMetrics/failureSignals/requiredAssets/bidding/creative/targeting/policy + fitScore/fitSeverity/matchedPrinciples/missingRequirements/recommendedChecks), (3) `diagnosis` (rootCauses/problemTags/riskLevel/opportunities/recommendedActions), (4) `competitor` (adsCount/topHooks/topCtas/topValueProps/commonPhrases/offerPatterns/creativePatterns/competitorSummary/confidence) ve (5) `synthesis` (mainProblem/mainOpportunity/recommendedAngle/creative/targeting/biddingDirection + mustKeepCampaignType + forbiddenMoves + proposalBrief + confidence + evidence) içerir. `source` alanı her paketin doctrine/competitor kaynağını (`db`/`fallback`/`missing`) belgeler.
  - **Missing handling** — Competitor insight yok → `available=false`, summary "Rakip içgörüsü kayıtlı değil.", brief'te "Rakip içgörüsü: yok — uydurma yapma." Doctrine yok → `available=false`, fitScore=null, neutral fallback yön cümleleri (creative/targeting/bidding doctrine yerine performans tabanlı genel ipucuya düşer).
  - **`lib/yoai/adCreator.ts`** — `generateFullAutoProposals()` ve `buildPrompt()` opsiyonel `synthesisPackagesByCampaignId?: Record<string, CampaignSynthesisPackage>` parametresi kabul eder. Doluysa her kampanya analiz bloğunun sonuna `buildSynthesisContextForPrompt(pkg)` çıktısı eklenir (≤1000 char). System prompt'a campaign-type sadakati kuralları ve "SYNTHESIS bloğu BİRİNCİL bağlam" direktifi eklendi. **`FullAdProposal` output schema DEĞİŞMEDİ**, mevcut doctrine summary ve `persistedCompetitorContext` path'leri korundu (synthesis verilmezse eski akış aynen çalışır).
  - **`app/api/yoai/generate-ad/route.ts`** — Her platform için aktif kampanyalar üzerinden `buildSynthesisPackagesForCampaigns(platformCampaigns, { userId })` çağrısı yapılır; `packageMap` `generateFullAutoProposals`'a additive olarak geçirilir. Hata durumunda `synthesisPackagesByCampaignId` undefined kalır, rota eski generation path ile devam eder. `forceGenerate` / persisted snapshot dön / pending approval bulk-insert akışı KORUNDU.
- **Korunanlar:**
  - `app/api/integrations/meta/**`, `app/api/integrations/google-ads/**`, `app/api/integrations/tiktok-ads/**` — DOKUNULMADI.
  - `lib/yoai/meta/orchestrator.ts`, `metaDeepFetcher.ts`, `googleDeepFetcher.ts`, `meta/diagnosis.ts`, `meta/decision.ts` — DOKUNULMADI.
  - `app/api/yoai/one-click-approve/route.ts`, `execute-action/route.ts` — DOKUNULMADI (Faz 0/1/2 lifecycle korundu).
  - Google/Meta wizard dosyaları, Supabase client config, auth/middleware — DOKUNULMADI.
  - **AI proposal output JSON schema (`FullAdProposal`) DEĞİŞMEDİ.**
  - Faz 0A audit log + 0B budget guard + 0C/0D approval lifecycle + Faz 1 doctrine + Faz 2 competitor persistence — KORUNDU.
  - `bulkInsertPendingApprovalsIfMissing` (pending approval mapping) akışı dokunulmadı.
- **Yapılmayanlar (bilinçli):** Multi-AI Decision Desk yok; judge/referee yok; yeni LLM provider yok; Google Transparency gerçek entegrasyonu yok; image/video vision analysis yok; publish/approval/payload değişmedi; `command_center_data` UI alanı eklenmedi (additive snapshot riskli görüldü).
- **Doğrulama:** `npx tsc --noEmit` → temiz. `npm run build` → tüm route'lar derlendi (yalnızca pre-existing dynamic-route warning'leri var, bu fazla ilgisiz). Gerçek publish çağrısı yapılmadı; production DB migration apply edilmedi (synthesis için yeni tablo gerekmiyor).
- **Dosyalar:**
  - YENİ `lib/yoai/synthesisTypes.ts`
  - YENİ `lib/yoai/synthesisEngine.ts`
  - `lib/yoai/adCreator.ts` (synthesis context entegre)
  - `app/api/yoai/generate-ad/route.ts` (synthesis packages build + pass)
  - `docs/CHANGELOG.md`

---

## 2026-05-10 — Faz 2: Competitor Ad Intelligence Persistence (Meta Ad Library Store + Insights)
- **Sorun:** Rakip reklam verisi sessionStorage'da 15 dk cache seviyesinde, kalıcı `competitor_ads` tablosu yok; aynı reklam tekrar geldiğinde duplicate kayıt riski var; Google Ads Transparency endpoint'i sahte/boş dönüyor ama UI bunu netleştirmiyor; AI proposal generator rakip insight'a erişebiliyor ama veri tarihsel/güvenilir değil.
- **Çözüm:**
  - **Yeni migration** `20260510005000_create_yoai_competitor_ads.sql` — `yoai_competitor_ads` tablosu (platform, source, source_ad_id, source_page_id, ad_fingerprint, advertiser_*, query_keyword, industry_keyword, campaign_type_context, ad_body/title/description, call_to_action, destination_url, publisher_platforms JSONB, ad_delivery_start/stop, creative_assets JSONB, raw_payload JSONB, extracted_signals JSONB, first_seen, last_seen, seen_count, is_active) + 8 index + RLS (`select/insert/update/delete WHERE user_id = auth.uid() OR service_role`) + **unique dedupe index** `(user_id, platform, source, ad_fingerprint)`.
  - **Yeni migration** `20260510005100_create_yoai_competitor_insights.sql` — `yoai_competitor_insights` tablosu (top_hooks, top_ctas, top_value_props, common_phrases, creative_patterns, offer_patterns, publisher_distribution JSONB, competitor_summary, confidence 0-100, raw_ad_ids, generated_at, expires_at) + COALESCE-li expression unique index ile (user_id, platform, source, COALESCE(campaign_type_context,''), COALESCE(query_keyword,'')) tuple bazında en güncel snapshot garantisi + RLS (kendi kayıtları + service_role).
  - **Yeni helper** `lib/yoai/competitorAdStore.ts` — `normalizeMetaAdLibraryAd(rawAd, context)` (ham + camelCase Meta Ad Library response'unu tolere eder), `buildCompetitorAdFingerprint(ad)` (source_ad_id varsa `sid:source:id`, yoksa SHA-256 advertiser+title+body hash), `upsertCompetitorAds(userId, ads, context)` (mevcut fingerprint'leri tek select ile çeker, batch insert + paralel update; `first_seen` korunur, `last_seen`/`seen_count` artırılır), `listCompetitorAds(userId, filters)`, `getRecentCompetitorAds(userId, lookbackDays=30)`, `markCompetitorAdSeen(userId, fingerprint, platform, source)`, `sanitizeCompetitorRawPayload(raw)` (publishAuditStore.sanitizeResponseExcerpt reuse — token/cookie/secret/api_key/client_secret REDACTED, max-2000-char string, max-50-item array, max-depth 6). Deterministik signal extraction: urgency/price/social_proof/quality/offer token set'leri + cta_type. Tablo yoksa structured TABLE_MISSING warning + boş sonuç döner; çağıran flow kırılmaz.
  - **Yeni helper** `lib/yoai/competitorInsightStore.ts` — `generateCompetitorInsightFromAds(ads, context)` deterministik kural-tabanlı snapshot üretir (LLM çağrısı YOK; HOOK/VALUE_PROP/OFFER/PHRASE token set'leri + CTA + publisher distribution sayımı; confidence = `min(60, ads*3) + min(40, advertisers*8)`). `upsertCompetitorInsight(userId, snapshot)` tuple unique index üzerinden select+update/insert pattern (NULL'lı tuple'lar için PostgreSQL davranışı nötrlendi). `getLatestCompetitorInsight(userId, filters)` ve `buildCompetitorContextForPrompt(userId, campaignTypeContext, queryKeyword, {platform, maxChars=1200})` — kademeli fallback: spesifik tuple → sadece campaign_type → sadece platform; veri yoksa null döner.
  - **app/api/yoai/competitors/meta-ad-library/route.ts** — Mevcut Meta Ad Library Graph API çağrısı KORUNDU; response shape (camelCase `data: [...]`) **geriye dönük uyumlu**. session_id cookie'sinden userId alınır, ham response normalize edilip `upsertCompetitorAds` çağrılır, sonra `generateCompetitorInsightFromAds` + `upsertCompetitorInsight`. Yeni alan: `persisted: { inserted, updated, skipped, insightId, errors }`. `?campaign_type_context=` query param desteği eklendi (opsiyonel). Tüm persistence try/catch içinde non-fatal — DB hata atarsa response yine eski shape ile döner.
  - **app/api/yoai/competitors/analyze/route.ts** — `runFullCompetitorAnalysis` çağrısı KORUNDU; mevcut UI alanları (userProfile/competitorAds/comparison/errors) aynı. Best-effort persistence: ilk Meta kampanyasının `normalizeCampaignType` ile baskın campaign type'ı çıkarılır, userProfile.keywords ile query_keyword türetilir, sonuçlar `upsertCompetitorAds` (idempotent — fingerprint dedupe) + `upsertCompetitorInsight` ile yazılır. Ek alan: `persisted: { inserted, updated, skipped, insightId, campaignTypeContext, queryKeyword, errors }`.
  - **app/api/yoai/competitors/google-auction/route.ts** — Dürüst modelleme: `{ ok: true, supported: false, source: 'google_ads_transparency', reason: 'not_implemented_or_unavailable', next_step: 'Doğrulanmış erişim, scrape stratejisi veya manuel konektör gerekiyor.', data: { competitors: [], ads: [], errors: ['...sahte rakip verisi üretilmiyor.'] } }`. **Sahte Google rakip reklamı üretilmedi.**
  - **components/yoai/CompetitorDashboard.tsx** — Yeni opsiyonel "Kalıcı analiz kaydı" banner'ı (yalnızca `persisted.inserted + persisted.updated > 0` ise gösterilir): yeni rakip / güncellenen rakip / campaign_type / query_keyword / insight kaydedildi bilgileri. **Mock veri YOK** — sadece API'dan dönen sayılar gösterilir. SessionStorage cache 15 dk korundu (büyük UI redesign yok); cache key'ine `persisted` snapshot'ı eklendi. Renk paleti `bg-gray-50 / border-gray-200 / text-gray-700` (CLAUDE.md kuralı: amber/yellow YOK).
  - **lib/yoai/adCreator.ts** — `generateFullAutoProposals()` ve `buildPrompt()` opsiyonel `persistedCompetitorContext?: string | null` parametresi kabul eder. Doluysa user prompt'un sonuna `KALICI RAKİP İÇGÖRÜSÜ (DB):\n...` bloğu append edilir. **Output JSON schema DEĞİŞMEDİ**, generate logic dokunulmadı, daily-run akışı bozulmadı (default `undefined`).
  - **app/api/yoai/generate-ad/route.ts** — Her platform için `normalizeCampaignType` ile baskın campaign type → `buildCompetitorContextForPrompt(userId, campaignType, null, {platform})` ile kalıcı insight çekilir, `generateFullAutoProposals`'a additive olarak geçirilir. Hata durumunda null kalır, akış değişmez.
- **Korunanlar:**
  - `app/api/integrations/meta/**`, `app/api/integrations/google-ads/**`, `app/api/integrations/tiktok-ads/**` — DOKUNULMADI.
  - `lib/yoai/meta/orchestrator.ts`, `metaDeepFetcher.ts`, `googleDeepFetcher.ts`, `meta/diagnosis.ts`, `meta/decision.ts` — DOKUNULMADI.
  - `lib/yoai/competitorAnalyzer.ts` — DOKUNULMADI (mevcut Meta Ad Library çağrısı/text extraction/keyword pipeline aynen çalışıyor).
  - `app/api/yoai/one-click-approve/route.ts`, `execute-action/route.ts`, `daily-run/route.ts` — DOKUNULMADI (Faz 0/1 lifecycle korundu).
  - Google/Meta wizard dosyaları, Supabase client config, auth/middleware — DOKUNULMADI.
  - AI proposal output JSON schema — DEĞİŞMEDİ.
  - Faz 0A audit log + 0B budget guard + 0C/0D approval lifecycle + Faz 1 doctrine — KORUNDU.
- **Davranış garantileri:**
  - Migration uygulanmazsa: structured TABLE_MISSING warning'ler atılır; meta-ad-library / analyze response'u eski (Faz 1) shape ile döner, `persisted` alanı eklenmez. UI sadece banner göstermez. Hiçbir flow crash etmez.
  - Sahte rakip verisi üretmiyor: ham response'tan ad_fingerprint deterministik üretilir; raw_payload sanitize edilir (token/secret REDACTED).
  - Google Ads Transparency: çalışmıyor, çalışmıyor diyor; DB'ye sahte Google rakip reklamı yazılmaz.
  - Faz 2'de yeni LLM çağrısı YOK; insight üretimi tamamen deterministik kural-tabanlı.
  - Görsel/video extraction yok: `creative_assets` boş array (placeholder değil; Faz sonraki için alan hazır).
  - Tablo yoksa generate-ad'in kalıcı insight context'i `null` döner — adCreator prompt'una ek blok eklemez, mevcut akış ile birebir aynı.
- **Doğrulama:** `npx tsc --noEmit` → 0 error · `npm run build` → ✓ /api/yoai/competitors/{analyze,google-auction,meta-ad-library} ve /api/yoai/generate-ad temiz derlendi · /yoai bundle 24.9 kB sabit (server-only persistence; client bundle büyümedi).
- **Migration apply gereksinimi:** İsteğe bağlı. Uygulanmazsa rakip reklam persistence kaybolur ama mevcut UI/AI akışı eski (Faz 1) davranışıyla çalışır.
- **Dosyalar:**
  - `supabase/migrations/20260510005000_create_yoai_competitor_ads.sql` (yeni)
  - `supabase/migrations/20260510005100_create_yoai_competitor_insights.sql` (yeni)
  - `lib/yoai/competitorAdStore.ts` (yeni)
  - `lib/yoai/competitorInsightStore.ts` (yeni)
  - `app/api/yoai/competitors/meta-ad-library/route.ts` (additive persist + camelCase response korundu)
  - `app/api/yoai/competitors/analyze/route.ts` (additive persist + campaign type binding)
  - `app/api/yoai/competitors/google-auction/route.ts` (dürüst unsupported response)
  - `components/yoai/CompetitorDashboard.tsx` (kalıcı analiz banner'ı)
  - `lib/yoai/adCreator.ts` (additive persistedCompetitorContext param)
  - `app/api/yoai/generate-ad/route.ts` (kalıcı insight prompt context wiring)
  - `docs/CHANGELOG.md` (bu giriş)

---

## 2026-05-10 — Faz 1: Campaign Type Intelligence + DB-driven platform doctrine
- **Sorun:** Meta doctrine kısmen güçlü ama kod içinde hardcoded; Google doctrine generic, Display/Video/PMax-spesifik kurallar yok; doctrine DB'de değil yeni kural eklemek deploy gerektiriyor; kampanya tipi normalize edilmiş olsa bile diagnosis/proposal pipeline'ında güçlü kullanılmıyordu.
- **Çözüm:**
  - **Yeni migration** `20260510004000_create_yoai_platform_doctrine.sql` — `yoai_platform_doctrine` tablosu (8 JSONB doctrine kolonu: success_metrics, failure_signals, required_assets, targeting_principles, bidding_principles, creative_principles, policy_notes, recommendation_rules, severity_rules) + 6 index + RLS (read: authenticated, write: service_role) + unique partial index `(platform, campaign_type) WHERE is_active`. **Seed: 10 kampanya türü** için gerçek uygulanabilir doctrine kayıtları (placeholder değil): meta_traffic, meta_engagement, meta_lead, meta_message, meta_sales, meta_awareness, google_search, google_display, google_video, google_pmax. 99 JSONB literal'ı tümü valid JSON olarak doğrulandı.
  - **Yeni helper** `lib/yoai/campaignTypeIntelligence.ts` — `normalizeCampaignType()` (Meta: objective+optimization_goal+destination triple; Google: channelType+biddingStrategy), `inferMetaCampaignType()` ve `inferGoogleCampaignType()` (legacy objective remap'leri uyarılı), `scoreDoctrineFit()` (severity rules DSL ile metrik karşılaştırması, 0-100 score, severity: low/medium/high/critical), `buildCampaignTypeContext()` (AI prompt için ≤500 char özet). Bilinmeyen kombinasyonlarda fallback: `<platform>_unknown` + warning'ler.
  - **Yeni helper** `lib/yoai/platformDoctrineStore.ts` — `listActiveDoctrine()`, `getDoctrineMap()` (60s in-memory cache), `getDoctrineByCampaignType()`, `getDoctrineForCampaign()`, `clearDoctrineCache()`. Tablo yoksa **`fallbackHardcodedDoctrine()` mirror** devreye girer (10 campaign type için minimal iskelet) — daily-run/adCreator migration uygulanmasa bile **kırılmaz**, sadece kapsam azalır. Tek bir warning log'la kullanıcı bilgilendirilir.
  - **deepAnalysis.ts wiring** — `runDeepAnalysis()` orchestrator'a additive enrichment eklendi: `getDoctrineMap()` çağrılır, her kampanya için `normalizeCampaignType` + `scoreDoctrineFit` çalıştırılır, sonuç `campaign.campaignTypeIntelligence` opsiyonel alanına yazılır (try/catch ile non-fatal). Aggregation, structural analysis, AI summarization akışı **dokunulmadı** — sadece her campaign object'i zenginleştirildi.
  - **adCreator.ts wiring** — `generateFullAutoProposals()` başlangıcında `getDoctrineMap()` + `buildCampaignTypeContext()` ile `doctrineSummariesByCampaignId` Record üretilir. `buildPrompt()` opsiyonel parametre kabul eder; `analysisDetails` string'inin sonuna her kampanya için "DOCTRINE: ..." satırı eklenir. System prompt'a tek satır kural: "Kampanya türünün DOCTRINE'ına sadık kal: required_assets, success_metrics, failure_signals, bidding_principles ve creative_principles ile uyumlu öneri üret." **Output JSON schema değişmedi**, prompt aşırı büyütülmedi.
  - **analysisTypes.ts** — yeni opsiyonel alan `DeepCampaignInsight.campaignTypeIntelligence?: CampaignTypeIntelligenceSnapshot` (campaignType, confidence, doctrineName, doctrineFitScore, doctrineFitSeverity, matchedPrinciples, failureSignals, recommendedChecks, warnings). Tamamen additive — UI hiçbir yerde bu alanı tüketmiyor; varsa kullanır.
- **Korunanlar:**
  - `lib/yoai/platformKnowledge.ts` — DOKUNULMADI (legacy hardcoded knowledge devam ediyor; runStructuralAnalysis aynen çalışıyor).
  - `lib/yoai/googleRuleEngine.ts` — DOKUNULMADI (12 kural aynen).
  - `lib/yoai/meta/diagnosis.ts`, `decision.ts`, `orchestrator.ts` — DOKUNULMADI.
  - `lib/yoai/metaDeepFetcher.ts`, `googleDeepFetcher.ts` — DOKUNULMADI (zorunlu değildi).
  - `app/api/integrations/meta/**`, `app/api/integrations/google-ads/**`, `app/api/integrations/tiktok-ads/**` — DOKUNULMADI.
  - `app/api/yoai/one-click-approve/route.ts`, `execute-action/route.ts`, daily-run wiring (route'tan değil deepAnalysis'ten orchestre edilir) — DEĞİŞMEDİ.
  - PAUSED default + budget guard + audit log + approval lifecycle (Faz 0A-0D) — KORUNDU.
  - AI proposal output JSON schema — DEĞİŞMEDİ; sadece prompt context zenginleşti.
  - Wizard'lar (Search/Display/PMax/Meta) — DOKUNULMADI.
- **Davranış garantileri:**
  - Migration uygulanmazsa: `platformDoctrineStore` tek warning log'u atar, fallback mirror devreye girer; daily-run/adCreator çalışmaya devam eder.
  - Bilinmeyen campaign type'da: `<platform>_unknown` döner, warnings dolu, doctrine null → `scoreDoctrineFit` nötr 50 score + "no_doctrine_loaded" check döndürür.
  - Eksik field (objective/channelType/adsets) → crash etmez, confidence düşer, warnings'e eklenir.
  - DB cache 60s — aynı request içinde tekrar DB roundtrip yapmaz.
- **Doğrulama:** `npx tsc --noEmit` → 0 error · `npm run build` → ✓ tüm route'lar derlendi · /yoai bundle 24.9 kB sabit (backend-only) · Migration JSONB literal'ları (99 adet) Node.js JSON.parse ile doğrulandı.
- **Migration apply gereksinimi:** İsteğe bağlı. Uygulanırsa DB-driven doctrine devreye girer (yeni kural eklemek SQL UPDATE ile mümkün); uygulanmazsa fallback ile aynı kapsam minimum-iskelet düzeyinde sürer.
- **Dosyalar:**
  - `supabase/migrations/20260510004000_create_yoai_platform_doctrine.sql` (yeni, 10 campaign type seed)
  - `lib/yoai/campaignTypeIntelligence.ts` (yeni)
  - `lib/yoai/platformDoctrineStore.ts` (yeni)
  - `lib/yoai/analysisTypes.ts` (additive `campaignTypeIntelligence` alanı)
  - `lib/yoai/deepAnalysis.ts` (try/catch enrichment loop)
  - `lib/yoai/adCreator.ts` (doctrine summaries + buildPrompt opsiyonel param + 1 satır system prompt kural)

---

## 2026-05-10 — Faz 0D: Approval lifecycle UI completion (pending count + edit prefill + history)
- **Sorun:** Faz 0C'den sonra approval queue tablosu hazır + AiAdSuggestions'da reject/hold/detail aksiyonları çalışıyor ama: (1) "Bekleyen Onaylar" metriği hala `ccData.drafts.length`'e bağlıydı (gerçek pending approval count değil), (2) "Düzenle" butonu disabled kalmıştı (wizard prefill akışı bağlanmamıştı), (3) kullanıcı geçmiş approval kararlarını göremiyordu.
- **Çözüm:**
  - **Pending count metric**: `app/yoai/page.tsx`'e yeni state `approvalsPendingCount` + `refreshApprovalsPendingCount()` callback (mount + onApprovalChanged'da fetch). `CommandCenterHeader` yeni prop `approvalsPendingCount?: number` — tanımlıysa onu, değilse `health.pendingApprovals` (drafts.length) fallback. Endpoint hata verirse mevcut değer korunur (graceful degrade).
  - **onApprovalChanged callback**: `AiAdSuggestions` yeni prop `onApprovalChanged?: () => void` — reject/hold/edit/published sonrası tetiklenir. Page bu callback'te pending count'u yeniden fetch edip `historyRefreshKey`'i artırır → ApprovalHistoryPanel da otomatik refresh olur.
  - **Düzenle butonu aktif**: AiAdSuggestions'da `<Pencil>` butonu disabled placeholder yerine `handleEdit(proposal, approval)`'a bağlandı. Akış: (1) `onOpenWizard(proposal)` ile wizard hemen açılır (kullanıcı beklemesin), (2) best-effort PATCH `/api/yoai/approvals/{id} {status:'editing', edited_payload: proposal}` paralel çağrılır. Sadece pending/hold'dan editing'e geçer (zaten editing ise no-op). edited_payload sanitize edilmiş proposal snapshot olarak DB'ye yazılır. AdCreationWizard zaten `initialProposal` prop'u destekliyor — minimal değişiklik.
  - **ApprovalHistoryPanel** (yeni component): `/api/yoai/approvals?limit=20` ile beslenen son 20 kayıt. Status badge (pending/published/rejected/hold/editing/failed/expired — onaylı palet, amber YOK), campaignName/headline, platform, created_at/updated_at, reason (rejection_reason → hold_reason → status_reason fallback), publish_audit_id, expand/collapse ile detay (proposal_id, source_campaign_id, hedef, bütçe, başlık, CTA mono font ile). Boş state "Henüz onaylanmış, reddedilmiş veya bekletilmiş öneri yok." `refreshKey` prop'u ile parent'tan re-fetch tetiklenebilir.
  - **UI metinleri**: "Öneriyi düzenle" (tooltip), "Beklet", "Reddet", "Onayla ve PAUSED Olarak Oluştur", "Onay Geçmişi", "son N kayıt".
- **Korunanlar:**
  - PAUSED default + budget guard + explicit checkbox + audit log (Faz 0A/0B/0C aynen)
  - Status transition guard (PATCH endpoint'i hala USER_PATCHABLE_STATUSES + ALLOWED_USER_TRANSITIONS guard'lı)
  - Manual "AI Reklam Oluştur" CTA ([page.tsx:368](app/yoai/page.tsx#L368) `setShowAdWizard(true)`) — wizardProposal=null kalır → boş wizard açılır (Düzenle ile karışmaz)
  - `lib/yoai/meta/orchestrator.ts`, adCreator, daily-run, deepFetcher'lar, diagnosis, decision — DOKUNULMADI
  - `app/api/integrations/**`, AI proposal promptları, ad_proposals_data JSONB — DEĞİŞMEDİ
  - Search/Display/PMax/Meta wizard'ları — DOKUNULMADI
- **Status flow doğruluğu**:
  - pending → editing (Düzenle ile)
  - hold → editing (Düzenle ile, hold'da iken)
  - editing → editing geçişi engellendi (UI tarafında no-op + transition guard zaten reddederdi)
  - rejected/published/approved → editing yapılamaz (UI'da Düzenle butonu o durumlarda zaten görünmüyor — kart status badge'iyle değiştirilmiş)
  - published terminal kalmaya devam (sadece markApprovalPublished/markApprovalFailed direkt yazabilir)
- **Doğrulama:** `npx tsc --noEmit` → 0 error · `npm run build` → ✓ tüm route'lar derlendi · /yoai bundle 23.5→24.9 kB.
- **Migration apply gereksinimi:** YOK. Faz 0C'deki `yoai_pending_approvals` tablosu yeterli (edited_payload kolonu zaten Faz 0C'de hazırlanmıştı, bu fazda kullanılmaya başlandı).
- **Dosyalar:**
  - `components/yoai/ApprovalHistoryPanel.tsx` (yeni)
  - `app/yoai/page.tsx` (pending count state + history panel render + onApprovalChanged)
  - `components/yoai/CommandCenterHeader.tsx` (approvalsPendingCount prop + fallback)
  - `components/yoai/AiAdSuggestions.tsx` (Düzenle aktif + handleEdit + onApprovalChanged callback)

---

## 2026-05-10 — Faz 0C: Approval lifecycle foundation (pending queue + reject + hold + detail)
- **Sorun:** AI Reklam Önerileri için kalıcı approval queue yoktu — pending/rejected/hold/edit state'leri, rejection_reason, approval history hiçbiri DB'de tutulmuyordu. Kart aksiyonları (Detayları Gör / Reddet / Beklet / Düzenle) UI'da yoktu. Bekleyen Onaylar metriği gerçek approval kayıtlarına bağlanabilir değildi.
- **Çözüm:**
  - **Yeni migration** `20260510003000_create_yoai_pending_approvals.sql` — `signups(id) UUID FK + ON DELETE CASCADE`, status enum (pending/approved/rejected/hold/editing/published/failed/expired), proposal_snapshot JSONB, rejection_reason/hold_reason/status_reason, edited_payload, approved_at/rejected_at/held_at/published_at/failed_at, publish_audit_id (FK yoai_publish_audit_log), metadata JSONB, 8 index, 4 RLS policy + unique (user_id, proposal_id) duplicate guard.
  - **Yeni helper** `lib/yoai/approvalStore.ts` — `bulkInsertPendingApprovalsIfMissing()` (proposal listesi için tek-roundtrip insert + ON CONFLICT DO NOTHING), `upsertPendingApprovalFromProposal()` (per-row, protected status'ları korur), `listApprovals(filters)`, `getApprovalById()`, `updateApprovalStatus()` (transition guard'lı), `markApprovalPublished()`, `markApprovalFailed()`, `recordPublishAttemptOnApproval()` (status değiştirmez, sadece metadata.last_publish_attempt yazar), `countPendingApprovals()`. Tablo yoksa AUDIT_LOSS log + null/false döner.
  - **Yeni API route** `app/api/yoai/approvals/route.ts` — GET: list/filter/count (status csv, platform, limit, ?count=1).
  - **Yeni API route** `app/api/yoai/approvals/[id]/route.ts` — GET single, PATCH status update (sadece pending/rejected/hold/editing — published/approved/failed direkt yazılamaz). `ALLOWED_USER_TRANSITIONS` matrix ile geçiş guard'ı: `INVALID_TRANSITION → 409`, `NOT_FOUND → 404`, `TABLE_MISSING → 503`.
  - **generate-ad/route.ts wiring** — Hem persisted path hem live generation path'inde `bulkInsertPendingApprovalsIfMissing()` çağrılır (non-fatal try/catch). Yeni proposal'lar pending kayıt oluşturur, mevcut kayıtlar (rejected/hold/published vb.) DOKUNULMAZ.
  - **one-click-approve/route.ts wiring** — Body'den `approvalId` alınır. Publish başarılı → `markApprovalPublished(userId, approvalId, auditId)` (status='published', published_at, publish_audit_id FK). Budget block / preflight block / capability unsupported / creative fail / orchestrator partial fail → status DEĞİŞMEZ; sadece `recordPublishAttemptOnApproval` ile `metadata.last_publish_attempt = {at, code, message, auditId}` yazılır — proposal yaşıyor, kullanıcı tekrar deneyebilir.
  - **AiAdSuggestions UI** — yeniden yazıldı:
    - Mount'ta `/api/yoai/approvals?limit=200` ile approval state çekilir.
    - Card altına 4-buton row: **Detayları Gör** (modal), **Düzenle** (disabled, "sonraki fazda"), **Beklet** (textarea modal → PATCH hold), **Reddet** (textarea modal → PATCH rejected). Meta için ek **Onayla ve Yayınla (PAUSED)** big button — OneClickApproveDialog'a `approvalId` geçiriyor.
    - Card durum badge'leri: Yayınlandı (emerald) · Reddedildi (gray + reason + Geri Al) · Bekletildi (gray + reason + Aktif Et) · Failed (status_reason inline). Hepsi onaylı palet (amber YOK).
    - DetailModal: 19 alanlı tablo + Google headlines/descriptions array'leri.
    - ReasonModal: ortak component (reject + hold), textarea + Onayla/İptal.
  - **OneClickApproveDialog** — yeni props: `approvalId`, `onPublished`. Body'ye `approvalId` aktarılır; success'te parent'a notify edilir (state refresh).
- **Korunanlar:**
  - `lib/yoai/meta/orchestrator.ts`, `lib/yoai/meta/diagnosis.ts`, `lib/yoai/meta/decision.ts`, `lib/yoai/adCreator.ts`, `lib/yoai/deepAnalysis.ts`, `lib/yoai/metaDeepFetcher.ts`, `lib/yoai/googleDeepFetcher.ts` — DOKUNULMADI.
  - `app/api/integrations/meta/**`, `app/api/integrations/google-ads/**`, `app/api/integrations/tiktok-ads/**` — DOKUNULMADI.
  - `app/api/yoai/execute-action/route.ts`, `daily-run`, `command-center`, `competitors/*`, Search/Display/PMax wizard'ları — DOKUNULMADI.
  - PAUSED default + budget guard + explicit checkbox confirmation (Faz 0B) korundu.
  - AI proposal generation, prompt'lar, ad_proposals_data JSONB yapısı — DEĞİŞMEDİ. Geriye dönük uyumlu.
  - Command Center metrikleri (CommandCenterHeader pendingApprovals = ccData.drafts.length) bu fazda DEĞİŞTİRİLMEDİ — `/api/yoai/approvals?count=1` endpoint'i hazır, UI binding sonraki minor PR'da yapılabilir.
- **Status transitions** (PATCH endpoint izinli geçişleri): pending→{rejected,hold,editing}, hold→{rejected,pending,editing}, editing→{rejected,hold,pending}, rejected→{pending}, failed→{pending}, expired→{pending}. published/approved → terminal (publish flow dışı PATCH'tan yazılamaz).
- **Doğrulama:** `npx tsc --noEmit` → 0 error · `npm run build` → ✓ tüm route'lar derlendi · /yoai bundle 21.6→23.5 kB.
- **Migration apply gereksinimi:** `supabase/migrations/20260510003000_create_yoai_pending_approvals.sql` production'da uygulanmalı. Faz 0A'daki `yoai_publish_audit_log` zaten dependency (publish_audit_id FK).
- **Dosyalar:**
  - `supabase/migrations/20260510003000_create_yoai_pending_approvals.sql` (yeni)
  - `lib/yoai/approvalStore.ts` (yeni)
  - `app/api/yoai/approvals/route.ts` (yeni)
  - `app/api/yoai/approvals/[id]/route.ts` (yeni)
  - `app/api/yoai/generate-ad/route.ts` (approval upsert wiring)
  - `app/api/yoai/one-click-approve/route.ts` (approvalId binding + status update)
  - `components/yoai/AiAdSuggestions.tsx` (yeniden yazıldı: aksiyon row + modal'lar)
  - `components/yoai/OneClickApproveDialog.tsx` (approvalId + onPublished props)

---

## 2026-05-10 — Faz 0B: Publish audit binding + budget guard + explicit confirmation
- **Sorun:** Faz 0A'da yoai_publish_audit_log tablosu ve publishAuditStore helper'ı eklendi ama publish akışına bağlanmamıştı. Ek olarak: budget guard yoktu (proposal'daki dailyBudget cap'siz Meta'ya iletiliyordu), idle phase'de explicit checkbox onay yoktu, partial failure orphan kaynaklar hiçbir yerde izlenmiyordu.
- **Çözüm:**
  - **Budget guard** (`one-click-approve/route.ts`): `evaluateBudgetGuard()` helper Meta API çağrısından ÖNCE çalışır. Cap kaynağı `process.env.YOAI_MAX_DAILY_BUDGET_TRY` (default 1000 TRY). 3 blok kodu: `BUDGET_GUARD_BLOCKED` (cap aşımı), `BUDGET_MISSING_OR_INVALID` (NaN/<=0), `UNSUPPORTED_BUDGET_CURRENCY` (TRY dışı). Tümü 422 + audit `blocked`.
  - **Audit log binding**: `recordPublishAuditAttempt()` ile `pending` insert (proposal validate edildikten hemen sonra), her stage'de `updatePublishAuditStatus()` ile geçiş — `success` (orchestrator ok), `blocked` (budget/capability/preflight/needs_input), `failed` (creative gen / meta upload / campaign_failed / route exception), `orphaned` (adset_failed = campaign orphan, ad_failed = campaign+adset orphan). `payload_hash` (SHA-256), `payload_excerpt`/`response_excerpt` `sanitizeResponseExcerpt()` ile token/secret/cookie redact'li.
  - **Orphan resource tracking**: `OrchestratorResult.created` zaten partial result dönüyor — orchestrator'a dokunulmadan audit log'a `orphan_resources` JSONB array'i olarak yazılır: `[{platform, type: 'campaign'|'adset'|'ad', id, parent_id?}]`. Rollback eklenmedi (Meta delete endpoint'lerine dokunmamak gerekti — bilerek Faz 0C+'ye bırakıldı).
  - **Response contract**: success → `{ ok:true, data, auditId, auditWarning? }`; budget block → `{ ok:false, code, message, maxDailyBudget, requestedBudget, auditId }`; audit yazımı başarısız ama publish başarılı → `{ ok:true, ..., auditWarning:'AUDIT_LOG_WRITE_FAILED' }`.
  - **OneClickApproveDialog idle phase**: detaylı özet (Platform/Kampanya Adı/Hedef/Günlük Bütçe/Reklam Özeti+CTA), bilgi kutusu (`bg-primary/5 + text-primary` — onaylı palet, amber YOK), zorunlu checkbox ("Bu reklamın Meta hesabımda PAUSED olarak oluşturulacağını ... onaylıyorum"), buton: "Onayla ve PAUSED Olarak Oluştur" (checkbox işaretsizken disabled).
- **Korunanlar:**
  - `lib/yoai/meta/orchestrator.ts` — DOKUNULMADI. Partial result mevcut yapısı yeterli.
  - `app/api/integrations/meta/**`, `app/api/integrations/google-ads/**` — DOKUNULMADI.
  - `lib/yoai/adCreator.ts`, AI proposal promptları, daily-run, deepAnalysis, googleDeepFetcher, metaDeepFetcher, diagnosis, decision — DOKUNULMADI.
  - PAUSED default davranışı korundu (her zaman PAUSED kuruluyor).
  - Mevcut `recordActionOutcome` learning kaydı korundu (action_outcomes ayrı tablo).
  - Google Ads / Meta wizard'lar değişmedi.
- **Güvenlik:** `sanitizeResponseExcerpt` her audit yazısında token/refresh_token/cookie/secret/api_key alanlarını `[REDACTED]` ile değiştiriyor; string >2000 char kırpılıyor; array >50 kesiliyor; depth >6 `[...]`.
- **Doğrulama:** `npx tsc --noEmit` → 0 error · `npm run build` → ✓ tüm route'lar derlendi · /yoai bundle 21.3→21.6 kB (idle phase detayları).
- **Dosyalar:**
  - `app/api/yoai/one-click-approve/route.ts` (budget guard + audit binding)
  - `components/yoai/OneClickApproveDialog.tsx` (idle phase: checkbox + detaylar)
- **Migration apply:** Faz 0A migration'larının (özellikle `yoai_publish_audit_log`) production'da uygulanmış olması gerekir. Uygulanmadıysa `recordPublishAuditAttempt` AUDIT_LOSS log atar ama publish akışı kırılmaz; response'da `auditWarning: 'AUDIT_LOG_WRITE_FAILED'` döner.

---

## 2026-05-10 — Faz 0A: YoAlgoritma audit foundation (DB migration + RLS + audit log)
- **Sorun:** YoAlgoritma Merkezi'nin onay/yayın denetim altyapısı eksikti — `yoai_action_outcomes` migration'da kayıtlı değildi (sadece `docs/sql/` altında manuel SQL), `learningStore.ts` tablo yoksa sessizce no-op'a düşüyordu (audit kaybı), `yoai_daily_runs`/`yoai_articles` için FK + RLS yoktu, publish denetimi için bir tablo da yoktu.
- **Çözüm:**
  - Yeni migration `20260510000000_create_yoai_action_outcomes.sql` — `docs/sql/yoai_action_outcomes.sql` formal migration'a taşındı; idempotent (IF NOT EXISTS / DROP POLICY IF EXISTS); RLS aktif; per-user select/insert/update policy; user_id TEXT olarak korundu (mevcut veriyle uyum).
  - Yeni migration `20260510001000_create_yoai_publish_audit_log.sql` — yeni `yoai_publish_audit_log` tablosu (UUID FK signups(id) ON DELETE CASCADE; status: pending/success/failed/blocked/orphaned/rolled_back; payload_hash, payload/response_excerpt JSONB, orphan_resources JSONB, budget_amount/currency); 4 index; RLS + policies.
  - Yeni migration `20260510002000_yoai_runs_articles_rls_fk.sql` — `yoai_daily_runs`/`yoai_articles` için TEXT user_id'yi UUID'ye cast eder ve `signups(id) ON DELETE CASCADE` FK ekler. Geçersiz UUID veya orphan referans varsa **RAISE EXCEPTION** ile durur (transaction rollback olur, veri değişmez); manuel cleanup gerektiğini bildirir. RLS aktif; per-user select/insert/update/delete policy. Idempotent (zaten UUID/FK varsa skip eder).
  - `lib/yoai/learningStore.ts` — tablo yokken sessiz no-op davranışı **AUDIT_LOSS** structured log'a dönüştürüldü (insert için `console.error`, list için `console.warn`); fonksiyon hala `null`/`[]` döner, çağıran flow kırılmaz.
  - Yeni helper `lib/yoai/publishAuditStore.ts` — `recordPublishAuditAttempt()`, `updatePublishAuditStatus()`, `hashPayload()` (SHA-256), `sanitizeResponseExcerpt()` (recursive token/secret redact + size cap). Faz 0A'da hiçbir publish endpoint'ine bağlanmadı; sonraki fazda non-blocking şekilde kullanılacak.
- **Korunanlar:** `one-click-approve`, `execute-action`, `meta/orchestrator`, `metaDeepFetcher`, `googleDeepFetcher`, `adCreator`, AI proposal promptları, Meta/Google integration route'ları — hiçbirine dokunulmadı. Publish davranışı, campaign create logic, AI üretimi değişmedi. UI ve wizard akışları olduğu gibi.
- **Doğrulama:** `npx tsc --noEmit` → 0 error · `npm run build` → ✓ tüm route'lar derlendi.
- **Dosyalar:**
  - `supabase/migrations/20260510000000_create_yoai_action_outcomes.sql` (yeni)
  - `supabase/migrations/20260510001000_create_yoai_publish_audit_log.sql` (yeni)
  - `supabase/migrations/20260510002000_yoai_runs_articles_rls_fk.sql` (yeni)
  - `lib/yoai/learningStore.ts` (AUDIT_LOSS log)
  - `lib/yoai/publishAuditStore.ts` (yeni helper, henüz bağlanmadı)

---

## 2026-05-10 — PMax asset upload tile/add chrome → Display picker dilinde
- **Sorun:** PMaxStepAssetGroup içindeki image/logo/video önizleme tile'ları (`w-24 h-24` opacity-driven X) ve add-button'ları (`text-primary hover:underline` text link) Display'in DisplayStepAds tile chrome'undan farklıydı: Display `w-16 h-16 rounded-lg border` thumbnail + `border-2 border-dashed border-gray-300 hover:border-primary` 16x16 add-tile kullanıyordu. Video listesi de tile değil row tarzı görünüyordu.
- **Çözüm:**
  - Yeni paylaşılan primitive `GoogleWizardAssetTile` — 16x16 önizleme thumbnail (image/logo/video variant'ları, ratio badge, video play overlay, sil X butonu).
  - Yeni paylaşılan primitive `GoogleWizardAssetAddTile` — Display dilinde dashed border add-button (boş listede full + min-h-[88px], dolu listede 16x16 kare). Plus icon veya custom icon (Shapes/Video) destekler.
  - PMax `ImageUploadDialog` ve `VideoUploadSection` görünür preview/add bloklarını yeni tile primitive'lerine taşıdı. Image rolü `variant="image"`, logo rolü `variant="logo"` (object-contain + bg-white), video rolü `variant="video"` + Youtube overlay.
  - Tüm dialog/state/upload mantığı (drag-drop, file input, multi-tab dialog, blob URL revoke, validation) **birebir korundu** — sadece görsel chrome değişti.
- **Korunanlar:** Logic, payload, state, validation. Display picker'lara dokunulmadı.
- **Dosyalar:**
  - `components/google/wizard/shared/GoogleWizardUI.tsx` (2 yeni primitive)
  - `components/google/wizard/pmax/steps/PMaxStepAssetGroup.tsx` (görünür tile chrome)

---

## 2026-05-10 — Final pixel-level UI parity: tüm büyük step dosyaları Display section/card chrome'unda
- **Sorun:** `StepConversionAndName`, `StepAudience`, `StepKeywordsAndAds`, `PMaxStepAssetGroup`, `PMaxStepCampaignSettings` dosyalarında lokal `<section>`/`<h4>` blokları ile farklı section chrome'lar kullanılıyordu — Display'in `bg-white rounded-xl border border-gray-200 p-6` standardından sapma vardı. Ek olarak `StepKeywordsAndAds.tsx:124`'te bir adet daha native `<select>` (defaultMatchType) gözden kaçmıştı.
- **Çözüm:**
  - **`StepConversionAndName`**: 3 adet `GoogleWizardSection` kartına ayrıldı — Kampanya Adı (Tag), Dönüşüm Hedefleri (Target), İstenen Sonuçlar (Flag). Web/telefon outcome kartları `border-2 rounded-xl shadow-sm` Display radio chrome'unda.
  - **`StepAudience`**: 2 `GoogleWizardSection` kartı — Hedefleme Modu (Target) + Kitle Segmentleri (Users). Mode kartları `border-2 rounded-xl border-primary bg-primary/[0.03] shadow-sm`.
  - **`StepKeywordsAndAds`**: 5 `GoogleWizardSection` kartı (Reklam Grubu/Anahtar Kelimeler/Negatif/URL-Path/Başlıklar/Açıklamalar). Section başlık/icon hizası Display ile birebir. `defaultMatchType` native select → `WizardSelect`.
  - **`PMaxStepCampaignSettings`** + **`PMaxStepAssetGroup`**: Lokal `CollapsibleSection`'lar `rounded-lg` → `rounded-xl`, `px-5 py-4` → `px-6 py-5`, `<h4 text-sm>` → `<h3 text-[15px]>` ile Display GoogleWizardSection chrome'una hizalandı. Asset group section header'ı icon span'ı `text-gray-400` ile aynı.
  - Lokal `Field` component'leri (StepConversionAndName, StepKeywordsAndAds) `text-[13px] font-medium text-gray-700 mb-1.5` Display label tipografisinde.
- **Audit kanıtı:** `grep -rn "<select " components/google/wizard/` → 0 sonuç. Native dropdown tamamen kalktı.
- **Korunanlar:** Tüm validation, payload, submit, state mantığı. Sağ Özet panel davranışı (Search/PMax step 0 gizli, step 1+ görünür). Display görünümü değişmedi.
- **Dosyalar:** 5 step dosyası (Search 3 + PMax 2)

---

## 2026-05-10 — Tüm Google wizard'larında AB Siyasi radio kartları + son 2 native select Display dilinde
- **Sorun:** AB Siyasi Reklamları radio'ları Search ve PMax'te görsel olarak Display'in radio card chrome'undan farklıydı (küçük native input + ince border). Ek olarak `LocationAdvancedModal` ve `PMaxLocationAdvancedModal` içindeki yarıçap birim seçicisi (km/mi) hâlâ native `<select>` idi.
- **Çözüm:**
  - Yeni paylaşılan primitive `GoogleWizardRadioOption` (Display'in `sr-only` native input + custom dot indicator + `border-2 rounded-xl shadow-sm` chrome). Yan ürün: `GoogleWizardCheckboxOption` (gelecek standardizasyon için).
  - Search `StepCampaignSettingsSearch` AB Siyasi Reklamları radio bloğu yeni primitive'e taşındı; section başlık tipografisi Display GoogleWizardSection ile birebir aynı.
  - PMax `PMaxStepCampaignSettings` AB Siyasi Reklamları aynı şekilde paylaşılan primitive ile.
  - `LocationAdvancedModal` ve `PMaxLocationAdvancedModal` yarıçap birimi (km/mi) → `WizardSelect`. Artık `components/google/wizard/` altında **sıfır** native `<select>` var.
- **Korunanlar:** state mantığı (`euPoliticalAdsDeclaration` enum'u, `radiusUnit`), validation, payload. Display tarafı dokunulmadı.
- **Dosyalar:**
  - `components/google/wizard/shared/GoogleWizardUI.tsx` (yeni primitive'ler)
  - `components/google/wizard/steps/StepCampaignSettingsSearch.tsx`
  - `components/google/wizard/pmax/steps/PMaxStepCampaignSettings.tsx`
  - `components/google/wizard/shared/LocationAdvancedModal.tsx`
  - `components/google/wizard/pmax/PMaxLocationAdvancedModal.tsx`

---

## 2026-05-10 — Search + PMax tüm native select'ler → Meta WizardSelect (Display'in kullandığı custom dropdown)
- **Sorun:** Search'teki Teklif Stratejisi dropdown'ı ve diğer native `<select>`'ler tarayıcı default mavi option listesi gösteriyordu — Display ile pixel parite yoktu (Display zaten Meta'nın `WizardSelect` custom dropdown'ını kullanıyor).
- **Çözüm:** Search ve PMax step component'lerindeki **tüm 10 native `<select>`** kullanımı `@/components/meta/wizard/WizardSelect` ile değiştirildi. Aynı görsel dil: `rounded-xl` border, `border-primary` open state, `bg-primary/8 text-primary font-semibold` selected option, `Check` icon, `ChevronDown` rotate, primary ring focus, açılan menünün `shadow-[0_8px_24px_rgba(0,0,0,0.12)]` lift'i. Tarayıcı default native dropdown tamamen elendi.
- **Dönüştürülen select'ler:**
  - Search: `StepBiddingAcquisition` (biddingStrategy), `StepCampaignSettings` (biddingStrategy), `StepConversionAndName` (phone country code), `StepAdGroupKeywords` (defaultMatchType), `StepAdSchedule` (4× hour/minute time pickers)
  - PMax: `PMaxStepBiddingAcquisition` (biddingFocus), `PMaxStepCampaignSettings` (5× schedule selectors), `PMaxStepAssetGroup` (callToAction)
- **Korunanlar:** Tüm onChange handler'ları, validation, payload, state mantığı. Sadece JSX `<select>` → `<WizardSelect>` map'i. Display tarafı dokunulmadı.
- **Dosyalar:** Search 5 + PMax 3 step dosyası

---

## 2026-05-10 — Search + PMax step içleri Display tasarım dilinde renk/kart parite
- **Sorun:** Sağ Özet paneli ve shell Display ile aynıydı ama step iç form'ları (input focus ring, button rengi, kart chrome, banner palette) Search'te ve PMax'te hâlâ blue-500/amber/yellow eski tema kullanıyordu — Display ile görsel parite eksikti.
- **Çözüm:**
  - `inputCls` paylaşılan constant'ları (Search `WizardTypes.ts`, PMax `PMaxWizardTypes.ts`) Display'in `googleWizardInputCls` palette'ine taşındı (`px-4 py-3`, `bg-white transition-colors`, `focus:ring-primary/20 focus:border-primary`). Tüm `inputCls` kullanan input/select/textarea'lar şimdi Display ile birebir aynı görünüm.
  - Tüm Search ve PMax step dosyalarında palet tarama: `focus:ring-blue-500` → `focus:ring-primary/20`, `text-blue-600/700/800` → `text-primary`, `bg-blue-600/700` → `bg-primary*`, `border-blue-*` → `border-primary*`. Proje renk yasağı temizliği: `bg-amber-*`, `text-amber-*`, `border-amber-*`, `bg-yellow-*` → gray-50/200/700 paletine (warning) veya red-300 (validation ring).
  - Yeni paylaşılan primitive'ler: `GoogleWizardField` (label + required + hint + error tek bir yapıda) ve `GoogleWizardInfoBox` (info/success/warning/danger banner — amber yok).
  - `StepBudget` (Search) tamamen Display dilinde 3 `GoogleWizardSection` kartına yeniden organize edildi (DollarSign / Info / Calendar icon + title).
  - `StepBiddingAcquisition` (Search) `GoogleWizardSection` ile sarmalandı (DollarSign + Users); radio kartları `border-2 rounded-xl shadow-sm` Display chrome'una hizalandı.
  - PMax `CollapsibleSection`'ları `rounded-lg` → `rounded-xl` Display chrome'una hizalandı.
- **Korunanlar:** Tüm validation, payload, submit, API logic. Step sayıları/sırası. Search RSA yapısı, PMax asset group state. Display tarafı dokunulmadı.
- **Dosyalar:**
  - Yeni primitive: `components/google/wizard/shared/GoogleWizardUI.tsx` (Field + InfoBox eklendi)
  - Constant: `components/google/wizard/shared/WizardTypes.ts`, `components/google/wizard/pmax/shared/PMaxWizardTypes.ts`
  - Section yeniden yazıldı: `components/google/wizard/steps/StepBudget.tsx`, `StepBiddingAcquisition.tsx`
  - Palet swap (sed): tüm 14 step dosyası — Search 8 + PMax 6

---

## 2026-05-10 — Wizard summary panel: seçim ekranlarında gizle (Search + PMax step 0)
- **Sorun:** "Kampanya Hedefinizi Seçin" ekranı bir form adımı değil, seçim ekranı; sağ Özet paneli orada hâlâ görünüyordu. PMax giriş (Entry) ekranı da seçim/entry niteliğinde — özet panel orada da gereksizdi.
- **Çözüm:** Hem Search hem PMax wizard `step > 0` koşulunda paneli render ediyor, `step === 0`'da `null` geçiyor. Shell'in `hasRightSummary = !!rightSummary` mantığı boş kolon bırakmadan içeriği tam genişliğe yayıyor.
- **Dosyalar:** `components/google/wizard/GoogleCampaignWizard.tsx`, `components/google/wizard/pmax/PMaxCampaignWizard.tsx`

---

## 2026-05-10 — Search wizard step 0 (Hedef & Tür) ekranında sağ Özet paneli gizlendi
- **Sorun:** "Kampanya Hedefinizi Seçin / Hedef & Tür" ekranında sağ Özet paneli kolon gibi yer kaplıyordu; kart seçim alanı dengesiz duruyordu.
- **Çözüm:** `GoogleCampaignWizard` artık `step === 0` iken `rightSummary` prop'unu `undefined` geçiyor. Shell'in `hasRightSummary` flag'i zaten boş kolon bırakmadan düz content layout'a geçiyor; step 1+'da panel eski gibi görünüyor. PMax step 0 (Entry) gerçek form ekranı olduğu için orada panel kalmaya devam ediyor; Display'a dokunulmadı.
- **Dosyalar:** `components/google/wizard/GoogleCampaignWizard.tsx`
- **Sorun:** UI shell standardizasyonu (51a7511) sadece full-screen layout'u taşıdı; Search ve PMax wizard'larda Display'deki sağ sticky Özet paneli yoktu.
- **Çözüm:**
  - `components/google/wizard/shared/SearchSummaryPanel.tsx` — Search wizard'ın 8 step'ine eşlenmiş 8 readonly özet kartı (Goal/Type, Conversion & Name, Bidding, Settings/Lang/EU, AI Max, RSA Reklam, Bütçe, Yayın Kontrolü).
  - `components/google/wizard/pmax/PMaxSummaryPanel.tsx` — PMax wizard'ın 6 step'ine eşlenmiş 6 readonly özet kartı (Overview, Bidding, Settings, Asset Group, Bütçe, Yayın Kontrolü) — asset group kartında businessName + image/logo/video sayıları + headline/description sayıları.
  - Her iki panel `GoogleWizardSummaryCard` + `GoogleWizardSummaryRow` paylaşılan primitive'lerini kullanıyor — DisplaySidebar ile birebir aynı görsel dil (typography, kart radius, primary highlight on active step, tick badge on complete).
  - GoogleCampaignWizard ve PMaxCampaignWizard `rightSummary` prop'u üzerinden panelleri shell'e besliyor.
- **Korunanlar:** Tüm wizard step component'leri, validation, payload, submit logic. Display görünümü değişmedi (DisplaySidebar yerinde, aynı tasarım dilini kullanıyor).
- **Dosyalar:**
  - Yeni: `components/google/wizard/shared/SearchSummaryPanel.tsx`, `components/google/wizard/pmax/PMaxSummaryPanel.tsx`
  - Güncellendi: `components/google/wizard/GoogleCampaignWizard.tsx`, `components/google/wizard/pmax/PMaxCampaignWizard.tsx`

---

## 2026-05-10 — Google Ads Wizard UI Shell Standardizasyonu (Search + Display + PMax)
- **Sorun:** Display wizard modern full-screen tasarımı kazanmıştı; Search ve PMax hâlâ eski centered-modal/blue-button görünümünde duruyordu. PMax'ın partial result bandı amber/yellow kullanıyordu (proje renk yasağı).
- **Çözüm:**
  - Yeni paylaşılan UI primitive'leri (`shared/GoogleWizardUI.tsx`): `GoogleWizardSection`, `GoogleWizardRadioCard`, `GoogleWizardSummaryCard`, `GoogleWizardSummaryRow`, `GoogleWizardResultState`, `googleWizardInputCls`.
  - Yeni paylaşılan full-screen layout (`shared/GoogleWizardShell.tsx`): üst header (logo + eyebrow + title + X), sol dikey step menüsü (sub-nav opsiyonel), orta içerik, opsiyonel sağ sticky özet, alt footer (back / step indicator / next-submit), google-snake-border, ESC kapat, body scroll lock, success/partial result bandı.
  - Display wizard yeni shell'e taşındı — görünüm birebir korundu, DisplaySidebar ve google-snake-border yerinde.
  - Search wizard centered modal'dan full-screen shell'e geçti; 8 step, validation, payload, PMax/Display routing davranışı değişmedi. Renkler primary'ye normalize edildi.
  - PMax wizard yeni shell'i kullanıyor; 6 step, asset group sub-nav (campaign-settings step'i altında 9 anchor), submit gating (`hasBlockingIssues`) korundu. Amber partial banner emerald/gray paletine geçti.
  - `DisplayWizardUI.tsx` artık paylaşılan primitive'lere alias re-export yapan ince bir wrapper — eski Display step component'leri (`DisplayStepAds`, `DisplaySidebar` vb.) hiç değişmeden çalışmaya devam ediyor.
- **Korunanlar:** wizard step sayıları/sırası, tüm step component'leri, `validateStep`/`validateDisplayStep`/`validatePMaxStep`, `buildCreatePayload`/`buildPerformanceMaxCreatePayload`, API route'lar, Supabase/auth/middleware, AB Siyasi Reklamları ve Yayın Kontrolü/Summary akışı.
- **Dosyalar:**
  - Yeni: `components/google/wizard/shared/GoogleWizardUI.tsx`, `components/google/wizard/shared/GoogleWizardShell.tsx`
  - Güncellendi: `components/google/wizard/GoogleCampaignWizard.tsx`, `components/google/wizard/display/DisplayCampaignWizard.tsx`, `components/google/wizard/display/DisplayWizardUI.tsx`, `components/google/wizard/pmax/PMaxCampaignWizard.tsx`

---

## 2026-04-28 — Display Wizard: Native select → Meta WizardSelect + arkaplan gradient
- **Sorun:** Display wizard'ı Meta'ya hizalamış olsam da iki belirgin fark kalmıştı: (1) arka plan beyaz görünüyordu, (2) native HTML `<select>` elementinin açılan menüsü tarayıcı/OS tarafından çiziliyordu — yazı tipi/boyutu Meta'nın özel dropdown'undan farklıydı.
- **Çözüm:**
  - `displaySelectCls` kaldırıldı; tüm Display select'leri `@/components/meta/wizard/WizardSelect` (Meta'nın özel dropdown bileşeni) ile değiştirildi. Açılan menü artık birebir aynı: ChevronDown rotate animasyonu, primary ring, seçili öğede primary/8 bg + check icon, font/size tam kontrolde.
  - Body bg `bg-gray-50` → `bg-gradient-to-br from-rose-50/40 via-gray-50 to-blue-50/30` (Meta wizard'ında algılanan sıcak ton hissi).
- **Etkilenen select'ler:** `display.biddingFocus` (4 seçenek), `display.callToAction` (11 seçenek).
- **Dosyalar:** `components/google/wizard/display/DisplayCampaignWizard.tsx`, `DisplayWizardUI.tsx`, `steps/DisplayStepBudgetBidding.tsx`, `steps/DisplayStepAds.tsx`

---

## 2026-04-28 — Display Wizard: Tasarım Meta Ads Trafik wizard'ına birebir hizalandı
- **Sorun:** Google Görüntülü reklam wizard'ı kendine özgü blue-600 paletli, sol-sidebar+küçük modal düzeniyle Meta Ads Trafik wizard'ından görsel olarak ayrışıyordu. Kullanıcı tüm Display adımlarının Meta wizard'ı ile birebir aynı tipografi, renk, buton ve form bileşeni tasarımına sahip olmasını istedi.
- **Çözüm:**
  - **Container yeniden yazıldı (`DisplayCampaignWizard.tsx`):** Sol dikey adım menüsü kaldırıldı; Meta'daki gibi tam-ekran modal + üst yatay numaralı step pill progress + 2 kolonlu (içerik + sticky sağ özet sidebar) düzene geçildi. Footer `Geri / X / Y / İleri` Meta ile aynı.
  - **Yeni paylaşılan UI modülü (`DisplayWizardUI.tsx`):** Meta'nın `Section`, `BudgetOptionCard` (RadioCard), `Progress`, `SidebarCard`, `SidebarRow` primitive'leri Display için klonlandı. Tüm renkler `primary` (#2BB673) — eski blue-600 yok.
  - **Yeni sidebar (`DisplaySidebar.tsx`):** Meta TWSidebar formatında her adım için canlı özet kartı (aktif → primary border, tamamlanmış → check rozeti).
  - **5 step component yeniden yazıldı:** `DisplayStepCampaignSettings`, `DisplayStepBudgetBidding`, `DisplayStepTargeting`, `DisplayStepAds`, `DisplayStepSummary` — her biri `<DisplaySection icon title description>` ile sarıldı, input'lar `displayInputCls` (px-4 py-3, primary focus ring) kullanıyor, radio seçimleri `<DisplayRadioCard>` (büyük 18px daire + primary fill).
  - **Locale anahtarları eklendi:** `display.summarySidebarTitle`, `summaryReadyLabel`, `summaryMissingLabel`.
- **Dokunulmadı:** `StepConversionAndName`, `StepAudience`, `StepLocationLanguage` — Search wizard ile paylaşılıyor; tasarım değişikliği Search'e sızmasın diye orijinal stilleri korundu (yalnız Display wizard içinde DisplaySection wrapper içinde render ediliyorlar).
- **Dosyalar:** `components/google/wizard/display/DisplayCampaignWizard.tsx`, `DisplayWizardUI.tsx` (yeni), `DisplaySidebar.tsx` (yeni), `steps/DisplayStepCampaignSettings.tsx`, `steps/DisplayStepBudgetBidding.tsx`, `steps/DisplayStepTargeting.tsx`, `steps/DisplayStepAds.tsx`, `steps/DisplayStepSummary.tsx`, `locales/tr.json`, `locales/en.json`

---

## 2026-04-28 — Display Reklam: Ekle butonları kart alanını dolduruyor + Kitle uyarı banner'ı kaldırıldı
- **Sorun:** (1) Resim/Logo/Video ekle butonları boşken sadece 64×64px gösteriliyor, kart içindeki upload alanını doldurmuyordu. (2) Kitle Hedefleme adımında "Bu adım isteğe bağlı" banner'ı gereksizdi.
- **Çözüm:** (1) Asset yokken buton `w-full flex-1 min-h-[88px]` ile tüm upload alanını kaplar; asset varsa `w-16 h-16` thumbnail boyutuna döner. (2) StepAudience'daki isteğe bağlı not div'i kaldırıldı.
- **Dosyalar:** `components/google/wizard/display/steps/DisplayStepAds.tsx`, `components/google/wizard/steps/StepAudience.tsx`

---

## 2026-04-28 — Scraper modernize edildi: lazy-load + srcset + bg-image + UA bloklama
- **Sorun:** "Öneriler" tab'ında çok sayıda görseli olan sitelerde (`uludagkebap.com.tr` gibi) "Henüz önerilen öğe yok" çıkıyordu. Sebepler: (1) `YoAiBot` user-agent'ı bot olarak algılanıp bloklanıyordu, (2) regex sadece `src=` ve `og:image` yakalıyordu — modern sitelerin `data-src`, `data-lazy-src`, `srcset`, `<picture><source>`, inline `background-image`, `<style>` blok'larındaki görseller atlanıyordu, (3) data: URL placeholder'ları gerçek görsel sanılıyordu.
- **Çözüm:**
  1. **Real Chrome UA + tam browser header seti** (Accept, Accept-Language, Sec-Fetch-*) → Cloudflare/WordPress güvenlik eklentileri artık bloklamıyor.
  2. **Tag-bazlı tarama:** `<img>` ve `<source>` tag'leri tüm attribute'larıyla parse ediliyor; `data-src`, `data-lazy-src`, `data-original`, `data-srcset`, `data-image`, `data-bg`, `srcset` ve son çare olarak `src` deneniyor.
  3. **srcset'ten en yüksek çözünürlük** (`pickBestFromSrcset` — `w` ve `x` descriptor'ı destekler).
  4. **Inline `style="background-image: url(...)"` ve `<style>` blok'ları** taranıyor.
  5. **data: URL placeholder'ları atlanıyor** (lazy-load shim'leri filtreleniyor).
  6. **Tracking pixel filtresi:** facebook.com/tr, google-analytics, googletagmanager, doubleclick, hotjar vb. atlanıyor; görsel uzantısı olmayan + tracking query parametreli URL'ler de atlanıyor.
  7. Aday limit 50 → 80; timeout 8s → 12s.
- **Dosyalar:** `app/api/integrations/google-ads/assets/scrape/route.ts`

---

## 2026-04-28 — Görsel modal: yanıltıcı "15 resim seçin" başlığı + counter + hard cap
- **Sorun:** Google Ads "Reklamınızda kullanılacak 15 resim seçin" başlığı zorunluluk algısı yaratıyor (asıl: max 15, min 1). Ayrıca multi-upload limiti aşabiliyordu — kullanıcı 16+ görsel ekleyebilirdi.
- **Çözüm (UX writer + altyapı):**
  1. **Başlık:** "Reklamınızda kullanılacak resimleri seçin" → **"Reklam görsellerini seçin"** (eylem-odaklı, dayatma yok).
  2. **Sayaç pill:** Başlık yanında `X / 15` rozeti — ilerleme hissi, hedef değil üst limit.
  3. **Alt-açıklama:** "En fazla 15 görsel ekleyebilirsiniz — daha çok varyasyon, daha iyi optimizasyon." (fayda-odaklı).
  4. **Hard cap altyapısı:** `remainingSlots` hesaplandı; tek dosya yüklemede, multi-upload'da ve PendingPane → handleImport'ta limit aşımı engellendi. Multi-upload'da fazla seçilen dosyalar atlanıp net mesaj gösteriliyor: "N görsel atlandı: en fazla 15 görsel eklenebilir (kalan kontenjan: K)."
  5. **Eşzamanlı yükleme güvenliği:** Bulk loop içinde yerel `added` sayacı tutuldu — `existing` prop'unun bulk içinde stale kalmasına karşı koruma.
- **Dosyalar:** `components/google/wizard/display/steps/DisplayImagePicker.tsx`

---

## 2026-04-28 — Öneriler boş-durum: çeviri key'leri görünüyordu, metinler hardcode edildi
- **Sorun:** Boş-durum ekranında "dashboard.google.wizard.display.imagePicker.recEmptyTitle" gibi çeviri anahtarları ham olarak görünüyordu. `t() || 'fallback'` deseni çalışmıyor çünkü çeviri yoksa `t()` key string'in kendisini döner (truthy).
- **Çözüm:** Tüm boş-durum metinleri Google'ın birebir Türkçesine sabitlendi: "Henüz önerilen öğe yok" + "Önerilen öğeler nihai URL'nizi ve hedeflemenizi temel alır. Bunlardan bazılarını görmek için, henüz yapmadıysanız nihai URL eklemeyi deneyin veya başka bir web sitesini ya da sosyal medya platformunu tarayın." Ayrıca illüstrasyon Google'ın saksı + bitki + kum saati + buharlı çay fincanı kompozisyonuna yaklaştırıldı.
- **Dosyalar:** `components/google/wizard/display/steps/DisplayImagePicker.tsx`

---

## 2026-04-28 — Öneriler tab'ı: URL inputu kaldırıldı, Google'ın boş-durum ekranı eklendi
- **Sorun:** "Reklamınızda kullanılacak resimleri seçin → Öneriler" tab'ında ayrı bir URL inputu vardı. Google Ads'te bu alan otomatik olarak Nihai URL'den beslenir; URL girilmemişse illüstrasyonlu bir boş-durum gösterilir.
- **Çözüm:** RecPane'in URL inputu ve "Tara" butonu kaldırıldı. Tab açıldığında 5. adımdaki Nihai URL (`defaultWebUrl`) ile otomatik scrape yapılır. Nihai URL boşsa Google'ın "Henüz önerilen öğe yok" başlığı + saksı/kum saati illüstrasyonu + "Önerilen öğeler nihai URL'nizi ve hedeflemenizi temel alır…" açıklamasıyla aynı boş-durum gösteriliyor. URL değiştiğinde önbellek (`recLoadedFor`) sıfırlanıp yeniden taranıyor.
- **Dosyalar:** `components/google/wizard/display/steps/DisplayImagePicker.tsx`

---

## 2026-04-28 — Display "Yükle" tab'ında çoklu görsel yükleme
- **Sorun:** "Reklamınızda kullanılacak resimleri seçin → Yükle" tab'ında file input `multiple` olmasına rağmen sadece ilk dosya işleniyordu; aynı anda birden fazla görsel eklenemiyordu.
- **Çözüm:** Çoklu seçim için bulk handler eklendi. 1 dosya seçildiğinde mevcut "kategori onayla / kırpma" akışı korunuyor; 2+ dosya seçildiğinde her dosya otomatik kategoriye atanıyor (uyumsuz oranlarda ilk kırpma seçeneği uygulanıyor) ve doğrudan Google Ads'e yükleniyor. İlerleme sayacı (X / N) ve dosya başına hata raporu eklendi.
- **Dosyalar:** `components/google/wizard/display/steps/DisplayImagePicker.tsx`

---

## 2026-04-28 — Öğe kitaplığı "page size is not supported" hatası giderildi
- **Sorun:** Display reklam → "Reklamınızda kullanılacak resimleri seçin" → "Öğe kitaplığı" tab'ında Google Ads API hata döndürüyordu: `Setting the page size is not supported. Search Responses will have fixed page size of '10000' rows.`
- **Çözüm:** `googleAds:search` REST endpoint'i artık body içindeki `page_size` parametresini kabul etmiyor (sabit 10000 satır döner). `assets/library` route'undaki IMAGE ve YOUTUBE_VIDEO sorgularında `searchGAds` çağrılarından `pageSize: 200` opsiyonu kaldırıldı; GAQL içindeki `LIMIT 200` korundu.
- **Dosyalar:** `app/api/integrations/google-ads/assets/library/route.ts`

---

## 2026-04-23 — Display Reklam: Resimler/Logolar/Videolar yan yana grid düzeni
- **Sorun:** "Görsel ve video varlıkları" bölümündeki Resimler, Logolar ve Videolar kutuları dikey sıralıydı; aynı hizada ve aynı boyutta değildi.
- **Çözüm:** Üç bölümü `grid grid-cols-3 gap-4` yapısına taşıdı. Her bölüm eşit genişlikte, aynı hizalı ve aynı yükseklikte (`flex flex-col`) birer kart olarak gösteriliyor.
- **Dosyalar:** `components/google/wizard/display/steps/DisplayStepAds.tsx`

---

## 2026-04-23 — Display Yükle tab'ına Google Drive entegrasyonu
- **Sorun:** DisplayImagePicker ve DisplayLogoPicker'ın "Yükle" tab'ında yalnızca local upload vardı. Gerçek Google Ads'teki gibi cloud entegrasyonu yoktu.
- **Çözüm:**
  1. **Yeni endpoint** `/api/integrations/google-ads/assets/picker-config`: Server-side env var'lardan (GOOGLE_PICKER_API_KEY, GOOGLE_PICKER_CLIENT_ID, GOOGLE_PICKER_APP_ID) client'a sadece gerekli değerleri döner. Yapılandırılmamışsa `{ configured: false }`.
  2. **`googleDrivePicker.ts` helper'ı:** Google Picker API ve Google Identity Services script'lerini dinamik yükler. Flow: GIS token → Picker → Drive API `files.get?alt=media` → Blob → File. Kullanıcı sadece Picker'da seçtiği dosyaya `drive.file` scope'u ile izin verir (tüm Drive'a erişim yok).
  3. **UI: Yükle tab'ında "Google Drive" butonu** hem ImagePicker hem LogoPicker'da. Seçilen görsel File nesnesine dönüşüp mevcut `onFilePick` handler'ına iletilir → aynı boyut/oran validasyonu + kategori seçimi akışı.
  4. Drive API Key scope'u: yalnızca Picker API + Drive API (restrict edildi).
- **Env vars (.env.local, gitignored):**
  - `GOOGLE_PICKER_API_KEY` (yeni API key)
  - `GOOGLE_PICKER_CLIENT_ID` (mevcut `GOOGLE_CLIENT_ID` reuse edildi)
  - `GOOGLE_PICKER_APP_ID` (project number, 12 haneli)
  - OAuth consent screen'e `drive.file` scope'u eklendi (non-sensitive, verification gerekmez).
- **Dosyalar:** app/api/integrations/google-ads/assets/picker-config/route.ts (yeni), components/google/wizard/display/steps/googleDrivePicker.ts (yeni), components/google/wizard/display/steps/DisplayImagePicker.tsx, components/google/wizard/display/steps/DisplayLogoPicker.tsx, locales/tr.json, locales/en.json

---

## 2026-04-23 — Kitle hedefleme: SaaS per-user mimari (oto-iyileşme + canlı per-customer)
- **Sorun:** `/api/integrations/google-ads/tools/audience-segments` tek global `audience_cache` satırını okuyordu. Satırı doldurmak için yalnızca admin `x-admin-secret` header'lı `/api/admin/google-audiences/refresh` endpoint'ini tetikleyebiliyordu. Sonuçta her yeni abone kullanıcı wizard'da "Kitle verileri henüz hazır değil" görüyordu. Ayrıca `user_list` / `custom_audience` / `combined_audience` kullanıcıya özel olmasına rağmen global cache'e konuyordu — hatalı mimari.
- **Çözüm:**
  1. **Global vs per-customer ayrımı:**
     - `affinity` / `inMarket` / `detailedDemographics` / `lifeEvents` → Google global taksonomisi, tek ortak cache.
     - `userLists` / `customAudiences` / `combinedAudiences` → çağıran kullanıcıya özel, her request'te canlı.
  2. **Oto-iyileşen cache:** Endpoint cache'te global dataset yoksa çağıran kullanıcının Google Ads credentials'ıyla global kategorileri çeker (`browseGlobalAudiences`), `audience_cache`'e yazar, response'u döndürür. İlk abone wizard'ı açtığında kendini iyileştirir, sonraki herkes hazır veriyi görür.
  3. **Per-customer canlı çekim:** Her request'te `browseUserAudiences(ctx)` ile çağıranın user_list / custom / combined audience'ları çekilir. Cache'e yazılmaz. 60 sn private cache header.
  4. **`browseGlobalAudiences` ve `browseUserAudiences` helper'ları** `lib/google-ads/audience-segments.ts`'e eklendi (additive; mevcut `browseAllAudiences` silinmedi). Read-only GAQL; entegrasyon mutation path'ine dokunulmadı.
  5. **`buildPerCustomerAddenda` helper'ı** `buildAudienceDataset.ts`'e eklendi — per-customer segment'leri browse node + search item'a çevirir, merge için kullanılır.
  6. **Admin refresh endpoint'i korundu** — artık opsiyonel force-refresh aracı.
  7. **Graceful degradation:** Kullanıcı Google Ads'e bağlı değilse ve cache boşsa "data_not_ready" doğru mesajıyla döner.
- **Etki:** Search ve PMax wizard'ları da aynı endpoint'i kullandığı için onlarda da "Kitle verileri yok" problemi çözüldü. Mevcut fonksiyon imzaları değişmedi.
- **Dosyalar:** app/api/integrations/google-ads/tools/audience-segments/route.ts, lib/google-ads/audience-segments.ts, lib/audience/buildAudienceDataset.ts

---

## 2026-04-23 — Display Resimler alanı: 5-tab picker (Öneriler + Öğe Kitaplığı + Web Sitesi + Yükle + Ücretsiz Stok)
- **Sorun:** Resimler için 3 ayrı inline uploader (landscape / square / portrait) + üstte "Stok resim ekle" butonu vardı. Gerçek Google Ads'te tek "Resim ekle" butonu → 5 tab'lı modal açılır.
- **Çözüm:**
  1. **Yeni DisplayImagePicker component'i** — 5 tab'lı tam modal:
     - **Öneriler:** Reklamın Nihai URL'sini otomatik tarayıp (scrape endpoint'i) aday görselleri listeler.
     - **Öğe Kitaplığı:** GAQL ile kullanıcının Google Ads hesabındaki IMAGE asset'leri (yalnızca 1.91:1 / 1:1 / 4:5 uyumluları). Seçilen asset tekrar upload olmadan direkt kullanılır.
     - **Web Sitesi veya Sosyal Medya:** Kullanıcı URL girer, scraper çalışır.
     - **Yükle:** Drag-drop + click-to-pick (cloud Drive/Dropbox credentials geldiğinde eklenecek).
     - **Ücretsiz Stok Resimler:** Pexels entegrasyonu (arama + sayfalama + fotoğrafçı atıfı).
  2. **Seç → Kategorize → Ekle akışı:** Herhangi bir tab'tan görsel seçildiğinde pending state'e geçer; aspect ratio'ya göre Yatay/Kare/Dikey otomatik işaretlenir, uyumsuz kategoriler greyed out. Kullanıcı "Ekle"ye basınca backend'e iletilir.
  3. **DisplayStepAds refactor:** 3 inline ImageUploader ve stock butonu kaldırıldı. Yerine tek "Resim ekle" butonu + birleşik thumbnail grid (her thumb üstünde oran etiketi 1.91:1 / 1:1 / 4:5).
  4. `DisplayStockImagePicker` component'i silindi — işlevi yeni ImagePicker'ın Stok tab'ına taşındı.
- **Dosyalar:** components/google/wizard/display/steps/DisplayImagePicker.tsx (yeni), components/google/wizard/display/steps/DisplayStepAds.tsx (refactor), components/google/wizard/display/steps/DisplayStockImagePicker.tsx (silindi), locales/tr.json, locales/en.json

---

## 2026-04-23 — Display Videolar alanı: 2-tab picker (Öğe Kitaplığı + YouTube'da Ara)
- **Sorun:** Video alanı basit bir "YouTube URL'si yapıştır" input'uydu. Gerçek Google Ads'te 3 tab var (Öğe Kitaplığı / YouTube'da Ara / Seslendirme ekleyin).
- **Çözüm:**
  1. **Öğe Kitaplığı genişletildi:** `app/api/integrations/google-ads/assets/library` artık `?type=YOUTUBE_VIDEO` kabul ediyor; GAQL ile `asset.youtube_video_asset.youtube_video_id` çekiyor. Kullanıcının Google Ads hesabındaki kayıtlı video asset'leri listelenir, seçilen direkt kullanılır (tekrar upload yok).
  2. **YouTube'da Ara endpoint'i** (`app/api/integrations/google-ads/assets/youtube`): `GET ?q=...&pageToken=...` YouTube Data API v3 search (TR/EN locale, sayfalama). `GET ?lookup=<url|id>` oEmbed ile URL/ID çözümleme — API key gerekmez, yapıştırma özelliği her zaman çalışır. `POST { videoId, name }` AssetService.MutateAssets ile YOUTUBE_VIDEO asset oluşturur.
  3. **DisplayVideoPicker modal:** 2 tab, grid + thumbnail + kanal adı, pagination (next/prev page tokens).
  4. **Seslendirme Ekleyin tab'ı KASITLI OLARAK eklenmedi.** Gerçek Google Ads'in yeni AI özelliği TTS + FFmpeg + YouTube upload zinciri gerektiriyor (Google Cloud TTS credential, video pipeline, youtube.upload OAuth scope, telif kontrolü). Kullanıcı açıkça "başarılı şekilde çalışır veremeyeceksen ekleme" dedi — o yüzden atlandı.
  5. **DisplayStepAds revizyonu:** Eski inline `YoutubeUploader` component'i ve `extractYoutubeId` helper'ı temizlendi. Yerine "Video ekle" butonu — 5 sınırlı grid, her thumb üstünde YouTube ikonu + silme.
  6. Yeni env var: `YOUTUBE_API_KEY` (Google Cloud Console → YouTube Data API v3). Yoksa arama 503 + açık mesaj, URL yapıştırma çalışır.
- **Dosyalar:** app/api/integrations/google-ads/assets/library/route.ts, app/api/integrations/google-ads/assets/youtube/route.ts (yeni), components/google/wizard/display/steps/DisplayVideoPicker.tsx (yeni), components/google/wizard/display/steps/DisplayStepAds.tsx, locales/tr.json, locales/en.json

---

## 2026-04-23 — Display Logolar alanı: 3-tab picker (Öğe Kitaplığı + Web Scraper + Upload)
- **Sorun:** Logolar alanı tek bir basit file input idi. Gerçek Google Ads'te 3 tab var (Öğe Kitaplığı / Web Sitesi veya Sosyal Medya / Yükle) — bu parite eksikti.
- **Çözüm:**
  1. **Öğe Kitaplığı endpoint'i** (`app/api/integrations/google-ads/assets/library/route.ts`): GAQL sorgusu ile kullanıcının Google Ads hesabındaki tüm IMAGE asset'lerini listeler. Read-only, campaign create akışına dokunmaz.
  2. **Web Scraper endpoint'i** (`app/api/integrations/google-ads/assets/scrape/route.ts`): `GET ?url=` URL'yi tarayıp og:image, twitter:image, favicon/apple-touch-icon, `<img>`, srcset aday görsellerini döner. SSRF koruması: localhost/RFC1918/metadata IP'leri engellenir. `POST { imageUrl, kind }` aday görseli indirip Google Ads Asset'a upload eder.
  3. **DisplayLogoPicker modal:** 3 tab'lı picker. Library tab GAQL'dan çeker ve sadece logo-uygun oran (4:1 veya 1:1) olanları gösterir. Web tab siteyi scrape edip sonuçları grid'de gösterir; default URL kampanyanın finalUrl'sidir. Upload tab drag-drop + click-to-pick + client-side boyut/oran validasyonu.
  4. **DisplayStepAds revizyonu:** Eski iki ayrı LOGO/SQUARE_LOGO inline uploader'ı tek "Logo ekle" butonu ile değiştirildi. Logolar artık 5 adet sınırlı ortak grid'de gösteriliyor, her thumb üstünde oran etiketi (4:1 / 1:1).
  5. Boyut seçim mantığı: yüklenen/seçilen görselin genişlik/yükseklik oranına göre LOGO (landscape 4:1) veya SQUARE_LOGO (1:1) otomatik kategorize edilir. Uyumsuzsa açık hata.
- **Dosyalar:** app/api/integrations/google-ads/assets/library/route.ts (yeni), app/api/integrations/google-ads/assets/scrape/route.ts (yeni), components/google/wizard/display/steps/DisplayLogoPicker.tsx (yeni), components/google/wizard/display/steps/DisplayStepAds.tsx, locales/tr.json, locales/en.json

---

## 2026-04-23 — Display reklam adımına Pexels ücretsiz stok resim entegrasyonu + Google Ads boyut/oran validasyonu
- **Sorun:** Reklam adımında stok resim kaynağı yoktu. Ayrıca kullanıcı yüklediği görsel boyut/oran Google Ads Responsive Display Ad şartlarını karşılamıyorsa hata Google'dan çok geç dönüyordu.
- **Çözüm:**
  1. **Pexels API entegrasyonu:** Yeni `app/api/integrations/google-ads/assets/stock/route.ts` — `GET` Pexels search proxy (sayfalama + TR locale), `POST` seçilen Pexels URL'sini indir + Google Ads `AssetService.MutateAssets`'e base64 upload. Sadece images.pexels.com host'u kabul (SSRF korunması). `PEXELS_API_KEY` env var gerekli; yoksa 503 + açık hata.
  2. **DisplayStockImagePicker:** Arama + grid + sayfalama + seçim sonrası kategori (Yatay/Kare/Dikey/Logo/Square Logo) radio'ları. Auto-detect aspect ratio ile önceden işaretli. Uyumsuz kategoriler greyed out. Fotoğrafçı atıfı her kartta.
  3. **displayImageSpecs.ts:** Google Ads RDA resmi spec'leri (min/önerilen/max + ratio tolerance) — MARKETING_IMAGE 1.91:1, SQUARE 1:1, PORTRAIT 4:5, LOGO 4:1, SQUARE_LOGO 1:1. `validateImageForKind`, `detectBestKind`, `readImageDimensions` helper'ları.
  4. **Upload client-side validation:** DisplayStepAds'teki her uploader artık dosyayı okuyup width/height/size'ı alıp Google'ın spec'lerine karşı kontrol ediyor. Hata mesajları beklenen oran ve minimum boyutla birlikte.
  5. Format kısıtlaması: `image/(jpeg|png|gif)` regex.
- **Dosyalar:** app/api/integrations/google-ads/assets/stock/route.ts (yeni), components/google/wizard/display/steps/DisplayStockImagePicker.tsx (yeni), components/google/wizard/display/steps/displayImageSpecs.ts (yeni), components/google/wizard/display/steps/DisplayStepAds.tsx, locales/tr.json, locales/en.json

---

## 2026-04-23 — Display dönüşüm hedefleri adımında "İstenen sonuçlar" validasyonu
- **Sorun:** Display wizard step 2'de "Web sitesi ziyaretleri" veya "Telefon Aramaları" kutucukları işaretlenip alan boş bırakıldığında İleri butonu engellenmiyordu (sadece inline kırmızı yazı çıkıyordu).
- **Çözüm:** `displayWizardValidation.ts` step 1'e eklendi: desiredOutcomeWebsite aktifse geçerli URL zorunlu (websiteUrlRequired / websiteUrlInvalid), desiredOutcomePhone aktifse ülke + geçerli numara zorunlu (`isValidPhoneForCountry` shared helper ile). Search tarafı etkilenmedi.
- **Dosyalar:** components/google/wizard/display/displayWizardValidation.ts

---

## 2026-04-23 — Google Ads Display wizard gerçek parity — backend ad creation + asset upload
- **Sorun:** Mevcut Display wizard backend'e yanlış bağlıydı. `create-campaign.ts` yalnızca SEARCH için reklam yaratıyordu, Display submit edildiğinde Google Ads'te reklamı olmayan boş kampanya oluşuyordu. `buildCreatePayload` Display metin alanlarını (`displayHeadlines`, `displayLongHeadline`, `displayDescriptions`, `displayBusinessName`) taşımıyordu. Görsel/logo/video asset desteği hiç yoktu. `optimizedTargeting` toggle'ı backend'e uygulanmıyordu.
- **Çözüm:**
  1. **Yeni asset upload endpoint** (`app/api/integrations/google-ads/assets/upload/route.ts`): AssetService.MutateAssets ile gerçek görsel/logo/YouTube video upload. Base64 image data + youtubeVideoId desteği, 5 MB sınırı.
  2. **Backend Display ad creation branch** (`lib/google-ads/create-campaign.ts`): SEARCH branch'i korunarak `if (channelType === 'DISPLAY')` bloğunda `responsiveDisplayAd` operasyonu. `marketingImages`, `squareMarketingImages`, `portraitMarketingImages`, `logoImages`, `squareLogoImages`, `youtubeVideos`, `headlines`, `longHeadline`, `descriptions`, `businessName`, `callToActionText` tam parity.
  3. **MANUAL_CPM bidding** backend + frontend (Görüntülenebilir BGBM) — ad group-level `cpmBidMicros`.
  4. **MANUAL_CPC & MAXIMIZE_CLICKS alt stratejileri** Display bidding'de.
  5. **optimizedTargeting** gerçekten ad group seviyesinde `optimizedTargeting.optimizedTargetingEnabled` olarak backend'e gidiyor (DISPLAY branch).
  6. **Display validasyonu** create route: en az 1 landscape + 1 square görsel, başlık, uzun başlık, açıklama, işletme adı kontrolleri.
  7. **buildCreatePayload Display branch**: `campaignType === 'DISPLAY'` için ayrı branch — Search payload byte-identical korundu.
  8. **DisplayStepAds**: gerçek file upload UI (5 görsel türü ayrı ayrı: landscape/square/portrait/logo yatay/logo kare) + YouTube URL/ID input + preview gallery + remove + size/type validasyonu.
  9. **Sol sidebar layout**: DisplayCampaignWizard üst stepper'dan dikey sol adım menüsüne geçti (Display-only; max-w-5xl modal, geri-ileri navigation tıklanabilir). Search/PMax wizard'lar etkilenmedi.
  10. **Call-to-action seçici** (11 resmi Google Ads CTA) Display ad'de.
  11. `WizardTypes.ts`: `BiddingStrategy` union'a `MANUAL_CPM` eklendi; yeni `DisplayAsset`, `DisplayClicksSub`, `DisplayAssetKind` tipleri; `WizardState`'e Display asset/CPM/CTA optional alanları.
- **Dosyalar:** components/google/wizard/shared/WizardTypes.ts, components/google/wizard/shared/WizardHelpers.ts, components/google/wizard/steps/StepCampaignSettings.tsx (tek satır MANUAL_CPM label), components/google/wizard/display/DisplayCampaignWizard.tsx, components/google/wizard/display/displayWizardValidation.ts, components/google/wizard/display/steps/DisplayStepBudgetBidding.tsx, components/google/wizard/display/steps/DisplayStepAds.tsx, components/google/wizard/display/steps/DisplayStepSummary.tsx, lib/google-ads/create-campaign.ts, app/api/integrations/google-ads/campaigns/create/route.ts, app/api/integrations/google-ads/assets/upload/route.ts (yeni), locales/tr.json, locales/en.json

---

## 2026-04-23 — Display teklif özetinde teknik enum yerine kullanıcı dostu etiket
- **Sorun:** "Aktif teklif yapısı" kutusu ve Özet ekranı `Strateji: MAXIMIZE_CLICKS · Odak: CLICKS` gibi ham enum gösteriyordu.
- **Çözüm:** displayBiddingFocus + alt seçeneğe göre kullanıcı dostu etiket üretildi (örn. "Dönüşümleri otomatik olarak en üst düzeye çıkar", "Görüntülenebilir gösterimler"). Özet'teki raw `biddingStrategy` de aynı etiketle değiştirildi.
- **Dosyalar:** components/google/wizard/display/steps/DisplayStepBudgetBidding.tsx, components/google/wizard/display/steps/DisplayStepSummary.tsx

---

## 2026-04-23 — Google Ads Display wizard gerçek akışa hizalandı
- **Sorun:** Display wizard'ında Konumlar ALL/TURKEY/CUSTOM'a sıkışmıştı, proximity ve presence/interest modu yoktu; Bütçe+Teklif tek blok halindeydi; Hedefleme'de optimize targeting yoktu; reklamlarda amber placeholder CLAUDE.md rengine aykırıydı; özet Ad Group'ı göstermiyordu.
- **Çözüm:** Display Kampanya Ayarları'ndaki Konumlar bloğu Search'ün `StepLocationLanguage` component'i ile birebir hizalandı (scope + proximity + presence/interest + LocationAdvancedModal). Diller + AB Siyasi Reklamları zaten aligned — dokunulmadı. `DisplayStepTargeting` wrapper'ı Search'ün `StepAudience` component'ini bozmadan üzerine "Optimize edilmiş hedefleme" toggle'ı ekledi. Bütçe/Teklif iki alt başlığa bölündü. `WizardHelpers.buildCreatePayload` içine `optimizedTargeting` yalnızca `advertisingChannelType === 'DISPLAY'` koşuluyla eklendi — Search payload'ı değişmedi. Reklam adımındaki amber bilgi kutusu CLAUDE.md kuralı gereği gray/gray-700'e çevrildi. Özet ekranı Ad Group adını ve optimize targeting durumunu gösteriyor.
- **Dosyalar:** components/google/wizard/display/DisplayCampaignWizard.tsx, components/google/wizard/display/steps/DisplayStepCampaignSettings.tsx, components/google/wizard/display/steps/DisplayStepTargeting.tsx (yeni), components/google/wizard/display/steps/DisplayStepBudgetBidding.tsx, components/google/wizard/display/steps/DisplayStepAds.tsx, components/google/wizard/display/steps/DisplayStepSummary.tsx, components/google/wizard/display/displayWizardValidation.ts, components/google/wizard/shared/WizardHelpers.ts, locales/tr.json, locales/en.json

---

## 2026-04-20 — DisplayImagePicker 4 sorun düzeltildi
- **Sorun:** (1) Öneriler sekmesinde URL girişi yoktu. (2) Öğe kitaplığı hata mesajı generikti. (3) Yükle sekmesi uyumsuz oranlı görseli reddediyordu, kırpma sunmuyordu. (4) Stok API yapılandırılmamış hatası kullanıcıya belirsiz görünüyordu.
- **Çözüm:** (1) RecPane içine URL input + Tara butonu eklendi. (2) Library hata mesajı "Yükle sekmesini kullanın" önerisi ile iyileştirildi. (3) Canvas tabanlı otomatik kırpma motoru eklendi — uyumsuz oran → 3 kırpma seçeneği gösterilir (Google Ads davranışı), kullanıcı birini seçer. Birden fazla dosya input'a eklendi. (4) Stok sekmesi PEXELS_API_KEY eksikse kullanıcıya net alternatif öneri verir.
- **Dosyalar:** components/google/wizard/display/steps/DisplayImagePicker.tsx

---

## 2026-04-20 — Display wizard Resimler/Logolar/Videolar kart düzeni yeniden tasarlandı
- **Sorun:** Başlık ve açıklama aynı satırda sıkışıktı; kartlar arasında simetri yoktu.
- **Çözüm:** Her kart 3 bölüme ayrıldı: başlık (üst, border-b), upload alanı (flex-1 orta), açıklama (alt, border-t). `items-stretch` ile eşit yükseklik. Simetri kuralı memory'e kaydedildi.
- **Dosyalar:** components/google/wizard/display/steps/DisplayStepAds.tsx

---

## 2026-04-20 — Google Display wizard adım 0 duplikasyonu düzeltildi
- **Sorun:** "Görüntülü Reklam" seçilince DisplayCampaignWizard açılıyor; fakat adım 0'ında yine aynı `StepGoalType` (Hedef & Tür seçimi) render ediliyordu — Search wizard ile birebir aynı ekran iki kez görünüyordu.
- **Çözüm:** `DisplayCampaignWizard`'dan `StepGoalType` adımı (eski step 0) tamamen kaldırıldı. Tüm adımlar 1 aşağı kaydırıldı (6 adımlı akış). `displayWizardValidation.ts` case numaraları da güncellendi. `GoogleCampaignWizard`'daki yasak amber renkleri primary/gray ile değiştirildi.
- **Dosyalar:** components/google/wizard/display/DisplayCampaignWizard.tsx, components/google/wizard/display/displayWizardValidation.ts, components/google/wizard/GoogleCampaignWizard.tsx

---

## 2026-04-20 — YoAlgoritma persisted stale error için hot-heal
- **Sorun:** metaDeepFetcher'a cookie fallback eklendi ama command-center yalnızca Supabase'deki persisted daily-run sonucunu döndüğü için eski tarama sonucundaki "Meta bağlantısı bulunamadı" hatası sayfada kalmaya devam ediyordu.
- **Çözüm:** app/yoai/page.tsx içine hot-heal useEffect: ccData.errors içinde "Meta bağlantısı" içeren bir hata varsa, localStorage cache temizlenir ve `triggerBackgroundBootstrap()` tetiklenerek yeni bir daily-run (fix uygulanmış) çalıştırılır. Tek seferlik guard (`healedRef`).
- **Dosyalar:** app/yoai/page.tsx

---

## 2026-04-20 — YoAlgoritma "Meta bağlantısı yok" yanılgısı düzeltildi
- **Sorun:** Entegrasyon sayfası Meta'yı "Bağlı" gösterirken YoAlgoritma "Meta bağlantısı bulunamadı" uyarısı veriyordu. İki sayfa farklı kaynak okuyor: Entegrasyon cookie (süre dolmuşsa bile token varsa "bağlı"), YoAlgoritma ise `meta_connections` DB tablosundaki `status='active'` + expiry kontrolü.
- **Çözüm:** `metaDeepFetcher.ts` içine 3. tier cookie fallback eklendi. DB lookup başarısız olursa, cookie'deki `meta_access_token` + `meta_selected_ad_account_id` + expiry kontrolü yapılır. Geçerliyse YoAlgoritma da bağlantıyı Entegrasyon ile aynı kaynaktan çözer. Integration kodu değiştirilmedi.
- **Dosyalar:** lib/yoai/metaDeepFetcher.ts

---

## 2026-04-20 — Günlük tarama saati 08:00'e alındı
- **Sorun:** Cron schedule 16:15 Istanbul'daydı, kullanıcı her sabah 08:00 istedi.
- **Çözüm:** vercel.json schedule `15 13 * * *` → `0 5 * * *` (08:00 Istanbul = 05:00 UTC). Vercel sunucu tabanlı çalıştığından PC kapalı olsa da tetiklenir.
- **Dosyalar:** vercel.json

---

## 2026-04-20 — YoAi sayfa genişlik + KPI font küçültme
- **Sorun:** İçerik alanı dar (`max-w-6xl`) görünüyordu; KPI rakamları (₺0, %0,00 vb.) `text-xl` ile gereksiz büyüktü.
- **Çözüm:** Page container `max-w-6xl` → `max-w-[1440px]`. KpiDashboard rakamları `text-xl` → `text-base`.
- **Dosyalar:** app/yoai/page.tsx, components/yoai/KpiDashboard.tsx

---

## 2026-04-20 — AI Reklam Önerileri header + summary bar kaldırıldı
- **Sorun:** "AI Reklam Önerileri" başlığı, açıklaması, "Yeniden Oluştur" / "Yeni Oluştur" butonları ve özet bar (kampanya sayısı, fırsat, AI öneri sayısı) gereksiz ve tekrarlı görünüyordu.
- **Çözüm:** `AiAdSuggestions.tsx` içinden header bloğu, summary bar ve regenerate butonu kaldırıldı. Sadece Meta/Google öneri kartları ve teşhis mini-kartları + Tek Tıkla Onayla butonu kalıyor.
- **Dosyalar:** components/yoai/AiAdSuggestions.tsx

---

## 2026-04-20 — Rakip Analizi v2: gerçek creative body + LLM tema + dürüst format
- **Sorun:** (1) Kendi reklam analizi sadece ad NAME üzerinde çalışıyordu (creative body'yi okumuyordu) — tema tespiti yanıltıcıydı. (2) Theme keyword listeleri 4 kategori × 6-8 kelime olarak sınırlıydı. (3) CTA liste çok dardı ve Meta'nın asıl CTA button type'ını hiç okumuyordu. (4) `competitorFormats` alanı aslında `ad.platforms` (facebook/instagram) değerlerini tutuyordu — bug. (5) `competitorInsight` metni rakip verisi 0 olsa bile AI tarafından üretiliyordu (hallucination riski).
- **Çözüm:**
  - `lib/yoai/metaDeepFetcher.ts`: ad fetch field'larına `creative{body,title,link_url,call_to_action_type,object_story_spec}` eklendi. Artık her ad için gerçek `creativeBody`, `creativeTitle`, `callToActionType`, `linkUrl` DB'ye geliyor.
  - `lib/yoai/analysisTypes.ts`: `AdInsight` tipine yukarıdaki 4 alan opsiyonel olarak eklendi.
  - `lib/yoai/competitorAnalyzer.ts`: `THEME_LEXICON` (6 kategori, kategoriye 15-20 kelime) + `CTA_PHRASES` (28 ifade) + `CTA_BUTTON_LABEL` (20 Meta enum → TR). `analyzeUserAds` artık creative body + title + name birleşimi üzerinde tema çıkarıyor; ayrıca `ad.callToActionType` (Meta enum) `ctaTypes`'a ekleniyor.
  - Yeni `enhanceThemesWithLLM` adımı: `runFullCompetitorAnalysis` sonunda OpenAI'ye batch olarak user + competitor ad bodies yollanır, 12 kategorilik (risk_azaltma, statu, topluluk, kisisellestirme, otorite, merak_uyandirma eklendi) nüanslı tema etiketleri alınır ve mevcut keyword-bazlı setle union'lanır. Başarısızsa sessizce fallback çalışır.
  - `compareWithCompetitors`: tüm 6 tema kategorisi taranır, genişletilmiş CTA_PHRASES ile body+title+description scan'lenir. `competitorPlatforms` (facebook/instagram) dürüst isimle ayrıldı; `competitorFormats` her zaman `[]` (Meta Ad Library güvenilir media_type dönmüyor — deprecated).
  - `lib/yoai/adCreator.ts`: AI response post-processing'de **hard guard** — `competitorAds.length === 0` ise `competitorInsight` zorla şu metne overridelenir: "Meta Ad Library'den rakip reklam bulunamadı (anahtar kelime eşleşmesi yok). Karşılaştırma yapılmadı." AI artık rakip yokken uydurma karşılaştırma üretemez.
- **Dosyalar:** lib/yoai/analysisTypes.ts, lib/yoai/metaDeepFetcher.ts, lib/yoai/competitorAnalyzer.ts, lib/yoai/adCreator.ts

---

## 2026-04-20 — Öneri kartlarında Meta API kodları Türkçe etikete çevrildi
- **Sorun:** Öneri kartlarında `optimizationGoal` ve `destinationType` alanları Meta API ham değerleriyle gösteriliyordu (POST_ENGAGEMENT, ON_AD, LANDING_PAGE_VIEWS, WEBSITE gibi) — kullanıcı dostu değildi.
- **Çözüm:** `AdPreviewCard.tsx` içinde `OPTIMIZATION_GOAL_LABEL` + `DESTINATION_LABEL` mapping'leri eklendi. Örnek: POST_ENGAGEMENT → "Gönderi Etkileşimi", ON_AD → "Reklam İçi Form", LANDING_PAGE_VIEWS → "Landing Page Görüntüleme", WEBSITE → "Web Sitesi". Ham değer `title` attribute'u olarak kalıyor (hover'da teknik karşılık görünür).
- **Dosyalar:** components/yoai/AdPreviewCard.tsx

---

## 2026-04-20 — YoAlgoritma hata banner'ları: "Yeniden Bağla" CTA'sı ile aksiyona çevrildi
- **Sorun:** "Meta bağlantısı bulunamadı" / "Google fetch hatası" gibi errors dizisi kullanıcıya pasif text olarak gösteriliyordu; ne yapması gerektiği belli değildi.
- **Çözüm:** Error banner'ı artık platform sezerek (meta/google keyword eşleştirmesi) ilgili `/entegrasyon?tab=...` sayfasına yönlendiren "Yeniden Bağla" butonu gösterir. Stil bg-primary/5 + primary border (CLAUDE.md rule'a uyumlu). Metin `text-sm` ile daha okunaklı.
- **Dosyalar:** app/yoai/page.tsx

---

## 2026-04-20 — YoAlgoritma sayfası: hafif yeşil arkaplan + daha okunaklı typography
- **Sorun:** YoAi sayfa arkaplanı beyaz/gri boş duruyordu ve yazılar küçüktü; Meta Ads wizard'ının kullandığı yumuşak yeşil gradient + daha büyük font hiyerarşisi referans alınarak benzer aesthetic istendi.
- **Çözüm:** (1) `app/yoai/page.tsx` arkaplan `bg-gray-50` → `bg-gradient-to-b from-emerald-50/40 via-white to-emerald-50/20`. (2) Banner metni `text-xs` → `text-sm`. (3) `KpiDashboard` etiket `text-[11px]`→`text-[13px]`, değer `text-lg`→`text-xl`, ikon alanı 7×7→8×8, padding 4→5. (4) `CommandCenterHeader` başlık `text-xl`→`text-2xl`, açıklama `text-xs`→`text-sm`, stats kutuları ikon 7→9, etiket `text-[9px]`→`text-[11px]`, değer `text-sm`→`text-base`; durum pill'leri ve "AI Reklam Oluştur" butonu daha büyük. (5) `AiAdSuggestions` başlık `text-lg`→`text-xl`, alt metin `text-xs`→`text-sm`, butonlar daha büyük. (6) `AnalysisCapabilities` başlık + kart fontları büyütüldü, kart padding 4→5.
- **Dosyalar:** app/yoai/page.tsx, components/yoai/KpiDashboard.tsx, components/yoai/CommandCenterHeader.tsx, components/yoai/AiAdSuggestions.tsx, components/yoai/AnalysisCapabilities.tsx

---

## 2026-04-20 — Bilgi bandı arkaplanı hafif yeşile alındı
- **Sorun:** "Henüz günlük analiz yok" bandı gri-nötr duruyordu; kullanıcı hafif yeşil tint istedi (marka tonuyla uyumlu).
- **Çözüm:** `bg-gray-50 border-gray-200` → `bg-primary/5 border-primary/20`. CLAUDE.md'deki "important" palette'i zaten bu kombinasyonu öneriyordu.
- **Dosyalar:** app/yoai/page.tsx

---

## 2026-04-20 — Amber / sarı renk tonları projeden kaldırıldı (CLAUDE.md kuralı)
- **Sorun:** Kullanıcı amber/sarı/hardal/bej uyarı renklerini istemiyor; kalıcı kural olarak eklenmesini istedi.
- **Çözüm:** `CLAUDE.md`'ye **UI Renk Kuralı (YASAK)** bölümü eklendi — `bg-amber-*`, `text-amber-*`, `border-amber-*`, `bg-yellow-*`, `text-yellow-*`, `border-yellow-*` class'ları artık projede kullanılmayacak. Onayları gösteren renk paleti tanımlandı (info=gray, important=primary, critical=red, success=emerald). Mevcut tüm `components/yoai/*` ve `app/yoai/*` dosyalarındaki amber/yellow class'ları toplu olarak gray tonlarına çevrildi.
- **Dosyalar:** CLAUDE.md, app/yoai/page.tsx, components/yoai/* (20+ dosya)

---

## 2026-04-20 — YoAlgoritma otomatik bootstrap + cron 16:15'e alındı
- **Sorun:** Kullanıcı YoAi sayfasını açtığında hiç veri yoksa "İlk Analizi Başlat" butonuna basmak zorunda kalıyordu. Talep edilen davranış: sayfa açılır, kullanıcı hiçbir şey yapmadan arka planda analiz başlar ve hazır olunca görünür.
- **Çözüm:** (1) `app/yoai/page.tsx` — sayfa mount edildiğinde eğer backend'de de cache'te de veri yoksa otomatik olarak `/api/yoai/daily-run` POST tetiklenir (arka planda), bu sırada banner'da loader + "İlk analiz arka planda hazırlanıyor…" mesajı gösterilir; bitince otomatik fetch ile veri yerleşir. (2) Vercel cron `0 13 * * *` → `15 13 * * *` (16:15 Istanbul). UI metinleri "16:15" olarak güncellendi.
- **Dosyalar:** app/yoai/page.tsx, vercel.json

---

## 2026-04-20 — "Henüz günlük analiz" empty state kompakt uyarı bandına dönüştürüldü
- **Sorun:** Büyük kart (p-12, geniş yükseklik) alanı gereksiz doldurup dikkat dağıtıyordu.
- **Çözüm:** Tek satır sarı uyarı bandı (bg-amber-50) — Sparkles ikon + tek cümle metin + küçük "İlk Analizi Başlat" butonu yan yana.
- **Dosyalar:** app/yoai/page.tsx

---

## 2026-04-20 — YoAlgoritma: "Taranıyor" ve tüm loading flash'ları kaldırıldı
- **Sorun:** Önceki cache fix'e rağmen SSR/hydration sırasında CommandCenterHeader "Taranıyor…" ve skeleton kutular hâlâ flash ediyordu. Kullanıcı her refresh'te bunları görüp tarama zannediyordu.
- **Çözüm:** (1) CommandCenterHeader: loading UI tamamen kaldırıldı — her durumda statü pill'i "AI Analiz / Kural Motoru / Hazır" olarak gösterilir, health yoksa stats kutularında "—" placeholder; skeleton animate-pulse silindi. (2) KpiDashboard: loading skeleton kaldırıldı, kpis yoksa "—" gösterir. (3) AiAdSuggestions: proposals + diagnoses + decisions için localStorage cache (`yoai_proposals_cache_v1`); cache varsa loading=false başlar; cache+proposal yoksa hiçbir skeleton render edilmez, component null döner.
- **Dosyalar:** components/yoai/CommandCenterHeader.tsx, components/yoai/KpiDashboard.tsx, components/yoai/AiAdSuggestions.tsx

---

## 2026-04-20 — YoAlgoritma sayfa yenilemede "Taranıyor" görünmez (localStorage cache)
- **Sorun:** Backend persisted veriyi hızlı dönse de, sayfa yenilemede DB read'in 300-500ms sürdüğü süre boyunca CommandCenterHeader "Taranıyor…" ve skeleton kutuları gösteriyordu. Kullanıcı bu flash'ı hâlâ tarama zannediyordu.
- **Çözüm:** `yoai_cc_cache_v1` localStorage anahtarıyla command-center verisi önbelleğe alındı. Sayfa açıldığında cache'ten anında yüklenir (loading=false başlar), backend arka planda sessizce yenilenir ve state güncellenir — kullanıcı hiçbir loading UI görmez. Cache yoksa sadece ilk kurulum için normal loading akışı çalışır.
- **Dosyalar:** app/yoai/page.tsx

---

## 2026-04-20 — Günlük cron 16:00'a alındı (Istanbul)
- **Sorun:** Günlük otomatik analizin 16:00 İstanbul saatinde başlaması istendi.
- **Çözüm:** `vercel.json` cron `0 13 * * *` (16:00 Istanbul, 13:00 UTC). UI metinleri "16:00" olarak güncellendi.
- **Dosyalar:** vercel.json, app/yoai/page.tsx

---

## 2026-04-20 — Günlük cron 15:52'ye alındı (Istanbul)
- **Sorun:** Günlük otomatik analizin 15:52 İstanbul saatinde başlaması istendi.
- **Çözüm:** `vercel.json` cron schedule `0 7 * * *` (10:00 Istanbul) → `52 12 * * *` (15:52 Istanbul, UTC 12:52). UI'daki "10:00" metinleri "15:52" olarak güncellendi.
- **Dosyalar:** vercel.json, app/yoai/page.tsx

---

## 2026-04-20 — Öneri kartı default görseli değiştirildi
- **Sorun:** AdPreviewCard'daki default görsel `/ai-birf.jpg` yerine yeni görsel istendi.
- **Çözüm:** `public/digital-ads.jpg` eklendi; AdPreviewCard src güncellendi.
- **Dosyalar:** components/yoai/AdPreviewCard.tsx, public/digital-ads.jpg

---

## 2026-04-20 — YoAlgoritma: Kampanya İzleme (InsightStream) kaldırıldı
- **Sorun:** "Kampanya İzleme · AI Kampanya Analizi · 0 aktif kampanya izleniyor" bölümü kullanıcıya operasyonel gürültü getiriyordu; izleme algoritmanın arka plan görevi olmalı.
- **Çözüm:** `app/yoai/page.tsx` içinden InsightStream render'ı, import'u ve `insightsForStream` derivation'ı kaldırıldı. Component dosyası korundu. İzleme artık sadece cron + daily-run içinden arka planda yapılıyor; UI'da görünmüyor.
- **Dosyalar:** app/yoai/page.tsx

---

## 2026-04-20 — YoAlgoritma: sayfa yenileme artık tarama tetiklemiyor
- **Sorun:** Sayfa her yenilendiğinde "Taranıyor…" gösterilip baştan analiz çalışıyordu. Kullanıcı sessiz arka plan davranışı beklerken her refresh'te boş ekran + uzun bekleme görüyordu.
- **Çözüm:** `/api/yoai/command-center` artık sadece persisted veri döner; persisted yoksa `data: null` ile anında yanıtlar (UI "İlk Analizi Başlat" boş state gösterir). Önceki live `runDeepAnalysis()` fallback'i kaldırıldı. `/api/yoai/generate-ad` da aynı mantıkla: `forceGenerate=false` (normal yükleme) → persisted varsa hemen döner, yoksa boş döner — live üretim yalnızca kullanıcı "Yeniden Oluştur" butonuna bastığında (`forceGenerate=true`) çalışır. Taramalar sadece günlük cron (`GET /api/yoai/daily-run`) ve kullanıcının manuel tetiklediği "İlk Analizi Başlat" / "Yeniden Oluştur" yollarıyla yapılır.
- **Dosyalar:** app/api/yoai/command-center/route.ts, app/api/yoai/generate-ad/route.ts

---

## 2026-04-20 — YoAlgoritma sayfasında eski kartlar kaldırıldı
- **Sorun:** Günlük Brifing, Hesap Durumu (HealthScore), Bütçe Dağılımı, Haftalık Özet kartları artık kullanılmıyor.
- **Çözüm:** `app/yoai/page.tsx` içinden DailyBriefing, HealthScore, SmartBudgetPanel, WeeklyReport render'ları ve import'ları kaldırıldı. Component dosyaları korundu (başka bir yerde ihtiyaç olursa).
- **Dosyalar:** app/yoai/page.tsx

---

## 2026-04-20 — YoAlgoritma otomatik akış: teşhis + tek-tık onay
- **Sorun:** Teşhis / preflight / creative / orchestrator modülleri hazır olsa da yalnızca wizard üzerinden (adım adım) erişilebiliyordu. Kullanıcı "YoAi sayfası açılsın, hazır öneri + teşhis + tek tıkla onay" deneyimi bekliyordu.
- **Çözüm:** (1) `generate-ad` ve `daily-run` çağrıları artık proposal'larla birlikte `diagnoses` + `decisions` de üretip kayda yazıyor (sadece Meta; mevcut akışı bozmuyor). (2) Yeni `/api/yoai/one-click-approve` endpoint'i — auto-discover (tek page/pixel/form varsa otomatik seçer), gerekirse `NEEDS_INPUT` ile kullanıcıdan eksik seçimleri ister, preflight → AI görsel üret → Meta'ya yükle → orchestrator full stack (campaign+adset+ad+creative, tümü PAUSED) → learning store kaydı — hepsi tek istekte. (3) UI: `AiAdSuggestions` her Meta proposal'ı altında teşhis mini-kart (root cause + confidence + önerilen aksiyon) ve "Tek Tıkla Onayla" butonu gösterir; buton `OneClickApproveDialog`'u açar (progress ekranı + NEEDS_INPUT pickerları).
- **Dosyalar:** app/api/yoai/generate-ad/route.ts, app/api/yoai/daily-run/route.ts, app/api/yoai/one-click-approve/route.ts, components/yoai/OneClickApproveDialog.tsx, components/yoai/AiAdSuggestions.tsx

---

## 2026-04-20 — YoAlgoritma DiagnosisPanel + Learning Layer v1 (veri biriktirme)
- **Sorun:** Diagnosis + decision katmanları hazır olsa da UI'da gösterilmiyordu; önerilerin sonuç takibi için veri hattı yoktu (ChatGPT'nin en önemli eleştirisi).
- **Çözüm:** `DiagnosisPanel` standalone bileşeni eklendi — kampanya listesini alır, `/api/yoai/diagnose` çağırır, root cause + evidence + önerilen aksiyonları expandable card'lar ile gösterir (drop-in; mevcut sayfalara otomatik entegre edilmedi, parent component'in yerleştirmesi gerekir). Learning Layer v1: `lib/yoai/learningStore.ts` + `/api/yoai/actions/record` + `/api/yoai/actions/outcomes` endpoint'leri — öneriler ve kullanıcı uygulamaları (applied/rejected) kayda geçer; sonuç analizi v2'ye bırakıldı. Supabase tablosu `yoai_action_outcomes` yoksa sessizce no-op'a düşer (hata yok). SQL şeması `docs/sql/yoai_action_outcomes.sql`'de.
- **Dosyalar:** components/yoai/DiagnosisPanel.tsx, lib/yoai/learningStore.ts, app/api/yoai/actions/record/route.ts, app/api/yoai/actions/outcomes/route.ts, docs/sql/yoai_action_outcomes.sql

---

## 2026-04-20 — YoAlgoritma diagnosis + decision katmanları (çok değişkenli teşhis)
- **Sorun:** Mevcut teşhis tek değişkenli kurallar üretiyordu (ör. "CTR düşük → LPV öner"). Hangi kök nedenin baskın olduğunu (hook / landing / fatigue / audience / pixel / event / budget) ayırt etmiyordu; teşhisten aksiyona geçiş haritası yoktu.
- **Çözüm:** `lib/yoai/meta/diagnosis.ts` — CTR+CPM+frequency+CPA/CPC+dönüşüm trendi birlikte okunarak 9 tane root cause (hook_problem, landing_page_problem, creative_fatigue, audience_mismatch, event_quality_problem, insufficient_data, budget_starvation, wrong_optimization_goal, pixel_misfire) tanımlandı; her teşhise confidence + evidence eşlik eder. `lib/yoai/meta/decision.ts` — her root cause'u monitor/tweak/revise/recreate/change_objective aksiyonlarına bağlar. `/api/yoai/diagnose` endpoint'i eklendi (read-only, hiçbir Meta kaynağına dokunmaz). Mevcut analiz akışı etkilenmedi; bu yeni katman opsiyonel olarak çağırılır.
- **Dosyalar:** lib/yoai/meta/diagnosis.ts, lib/yoai/meta/decision.ts, app/api/yoai/diagnose/route.ts

---

## 2026-04-20 — YoAlgoritma Wizard: kreatif pipeline (AI görsel + Meta upload)
- **Sorun:** Preflight adımı sonrası kullanıcıya "Ads Manager'dan ekle" mesajı dönüyor, reklam (ad + creative) gerçek oluşmuyordu. YoAlgoritma "taslak üret ve onaylat" vaadini tamamlamıyordu.
- **Çözüm:** `MetaCreativePanel` eklendi; preflight sonrası yeni `creative` adımı: AI görsel üretilir (tasarim/enhance-prompt + tasarim/generate-image), görsel Meta'ya yüklenir (`/api/meta/upload-media` → imageHash), birincil metin kullanıcı tarafından düzenlenebilir, ardından `create-ad`'e `creative` payload'u olarak iletilir. Orchestrator zaten campaign+adset+ad tam zincirini PAUSED olarak kuruyor. Kullanıcı "Yeniden üret" ile farklı görsel deneyebilir.
- **Dosyalar:** components/yoai/MetaCreativePanel.tsx, components/yoai/AdCreationWizard.tsx

---

## 2026-04-20 — YoAlgoritma Wizard: Meta preflight UI adımı
- **Sorun:** Backend preflight/orchestrator hazır olsa da `AdCreationWizard` preview → publish arasında doğrulama yapmıyor, kullanıcı eksik asset'leri (sayfa seçimi, pixel, form, dönüşüm olayı, URL) hiç görmüyordu.
- **Çözüm:** `MetaPreflightPanel` bileşeni eklendi; wizard'a yeni `preflight` adımı eklendi. Meta seçildiğinde preview sonrası `/api/yoai/preflight` çağrılır; capability durumu, page seçimi (ambiguous ise radio), pixel/form/URL/event picker'ları ve eksik asset sebepleri gösterilir. Kreatif bu sürümde wizard'da üretilmediği için kullanıcıdan "Ads Manager'dan ekleyeceğim" onayı alınır. Google path değişmedi.
- **Dosyalar:** components/yoai/MetaPreflightPanel.tsx, components/yoai/AdCreationWizard.tsx

---

## 2026-04-20 — YoAlgoritma Meta v1: capability matrix + preflight + orchestrator
- **Sorun:** YoAlgoritma create flow yarım kalıyordu — Meta'da campaign+adset oluşuyor, ad/creative adımı atlanıp kullanıcıya "Ads Manager'dan tamamla" deniyordu. Ayrıca page seçimi sessiz `pages[0].id` bug'ıyla yapılıyordu; preflight asset kontrolü (pixel/form/event/URL) hiç yoktu; desteklenmeyen kombinasyonlar (catalog sales, WhatsApp leads) sessizce düşüyordu.
- **Çözüm:** Sadece `lib/yoai/meta/` altında, dış modüllere dokunmadan v1 sistem kuruldu: (1) `capabilityMatrix.ts` — Traffic/Awareness/Engagement/Leads(InstantForm+Website)/Sales(Website) desteklenen kombinasyonlar + unsupported sebepleri; (2) `pageResolver.ts` — explicit > inherited > single > ambiguous > missing öncelik sırası, "ilk page'i al" bug'ı kaldırıldı; (3) `preflight.ts` — asset bazlı doğrulama (page/pixel/form/event/URL/creative); (4) `orchestrator.ts` — preflight → campaign(PAUSED) → adset(PAUSED) → ad+creative(PAUSED) tam zinciri, adım-adım rollback bilgisi; (5) `app/api/yoai/preflight/route.ts` yeni endpoint; create-ad route creative varsa orchestrator, yoksa legacy path (backward compat).
- **Dosyalar:** lib/yoai/meta/capabilityMatrix.ts, lib/yoai/meta/pageResolver.ts, lib/yoai/meta/preflight.ts, lib/yoai/meta/orchestrator.ts, app/api/yoai/create-ad/route.ts, app/api/yoai/preflight/route.ts

---

## 2026-04-20 — GA4 & Search Console callback fix + teşhis logları
- **Sorun:** OAuth başarılı olmasına rağmen "Bağlanmadı" kalıyor, veri çekmiyordu. Callback OAuth sonrası `/dashboard`'a yönlendiriyor, kullanıcı entegrasyon sayfasındaki property/site seçim modalını hiç görmüyordu. Ayrıca `user_id` cookie yoksa veya refresh_token gelmediyse sessizce DB'ye yazmıyordu
- **Çözüm:** GA ve GSC callback'leri `/entegrasyon?ga=connected` / `?gsc=connected` adresine yönlendirir, böylece property/site seçim akışı görünür; `user_id` yok / `refresh_token` yok / DB save fail durumları ayrı `reason` query param'ları ile kullanıcıya gösterilir; `[GA_CALLBACK]`/`[GSC_CALLBACK]` console logları eklendi
- **Dosyalar:** app/api/integrations/google-analytics/callback/route.ts, app/api/integrations/google-search-console/callback/route.ts

---

## 2026-04-20 — İyzico ödeme akışı + backend tabanlı abonelik/kredi sistemi
- **Sorun:** Abonelik ve kredi sistemi tamamen localStorage'da sahte şekilde çalışıyordu; "Satın Al" butonuna basınca ödeme yapılmadan plan aktif oluyor ve kredi yükleniyordu
- **Çözüm:** İyzico redirect (hosted checkout) entegrasyonu, Supabase `subscriptions`/`credit_balances`/`payment_transactions` tabloları, fiyat/plan/süre kararının tamamen backend'de alındığı `lib/billing/catalog.ts` katalogu; callback'te `retrieveCheckoutForm` ile doğrulama, idempotent `pending→succeeded` transition, `conversation_id` + `paidPrice` karşılaştırmasıyla tampering koruması; frontend sadece `planId`/`packageId` gönderir, `paymentPageUrl`'e yönlendirir, dönüşte `?payment=success|failed` query'si sadece toast gösterir — gerçek state `/api/billing/current`'tan okunur
- **Dosyalar:** supabase/migrations/20260420000000_create_billing_tables.sql, lib/billing/{catalog,iyzico,db,user}.ts, app/api/billing/iyzico/{start,callback}/route.ts, app/api/billing/current/route.ts, app/api/credits/{spend,refund}/route.ts, components/providers/{CreditProvider,SubscriptionProvider}.tsx, app/abonelik/page.tsx, components/subscription/CreditLoadSection.tsx, lib/subscription/storage.ts, package.json

---

## 2026-04-20 — Dashboard açılış crash fix (Meta 401 → toLocaleString undefined)
- **Sorun:** Meta API 401 döndüğünde hata objesi `metaInsights` state'e set ediliyordu; `clicks`/`impressions` undefined gelince `fmtInt(undefined).toLocaleString` crash yapıp sayfayı tamamen kırıyordu
- **Çözüm:** `fmtCurrency`/`fmtInt` null-safe yapıldı (`Number(v) || 0`); Meta data check'ine `impressions !== undefined || clicks !== undefined` guard eklendi
- **Dosyalar:** app/dashboard/HomePage.tsx

---

## 2026-04-10 — Dropdown kullanıcı bilgi bloğu kaldırıldı
- **Sorun:** Sol alt profil dropdown açıldığında en üstte "Onur Şuay" ve "Deneme Sürümü" bilgi satırı görünüyordu
- **Çözüm:** `UserProfileDropdown.tsx` içindeki "User header" div bloğu (px-4 py-3 border-b) tamamen silindi; dropdown artık doğrudan "Hesabım" menü maddesiyle başlıyor
- **Dosyalar:** components/UserProfileDropdown.tsx

---

## 2026-04-09 — Google Analytics & Search Console bağlantı kalıcılığı

- **Sorun:** GA ve GSC bağlantıları logout/login sonrasında kopuyordu
- **Çözüm:** Tüm route'larda `session_id` (her login'de yeni UUID) yerine `user_id` (kalıcı DB kullanıcı ID'si) kullanıldı; callback'lerdeki gereksiz UUID üretme kodu temizlendi
- **Dosyalar:** `app/api/integrations/google-analytics/` ve `app/api/integrations/google-search-console/` altındaki 14 route dosyası

---

## 2026-04-09 — Meta Ads Campaign Wizard header hizalama

- **Sorun:** Wizard header'ındaki başlık `...` ile kesiliyor, logo alanı içerik alanıyla hizasız görünüyordu
- **Çözüm:** Header `max-w-7xl mx-auto px-8` ile body ile hizalandı, truncate kaldırıldı, "Meta Ads" subtitle eklendi
- **Dosyalar:** `components/meta/CampaignWizard.tsx`

---

## 2026-04-09 — Meta Ads Campaign Wizard tam UI modernizasyonu

- **Sorun:** Wizard adımlarındaki tasarım basit ve sıradan görünüyordu; dropdown'lar native `<select>`, fontlar küçük, renkler soluktu
- **Çözüm:** Tüm 4 adımda kapsamlı modernizasyon yapıldı:
  - `WizardSelect` custom dropdown bileşeni oluşturuldu (tüm selectlerde standart)
  - Tüm native `<select>` elementleri `WizardSelect` ile değiştirildi
  - Minimum 12px font kuralı uygulandı
  - `rounded-xl` + inset shadow depth efekti tüm input/select alanlarına eklendi
  - Kampanya hedefi, bütçe tipi, buying type radio butonları card-style pill'e dönüştürüldü
  - Wizard arka planı teal gradyana alındı
  - `BudgetOptimizationCard` tam olarak yeniden yazıldı
- **Dosyalar:** `components/meta/wizard/WizardSelect.tsx` (yeni), `StepCampaign.tsx`, `StepAdSet.tsx`, `StepAd.tsx`, `TabDetails.tsx`, `TabBudget.tsx`, `TabAudience.tsx`, `AdTextFields.tsx`, `BudgetOptimizationCard.tsx`, `WizardProgress.tsx`, `WizardSidebar.tsx`, `CampaignWizard.tsx`

## 2026-05-15 — Scan paralel çalıştırma (Kısmi sorunu fix)
- **Sorun:** Kendi marka + rakip taramaları sıralı çalışıyordu (toplam ~100s), Vercel 60s limitini aşıyor, scan_status 'partial' ya da 'running' kalıyordu
- **Çözüm:** `runProfileScansAndIntelligence` ve `runScan` içinde `Promise.all` ile her iki tarama grubu paralel çalıştırılıyor (toplam süre ~50s, 60s limitinin altında)
- **Dosyalar:** `app/api/yoai/business-profile/route.ts`, `app/api/yoai/business-profile/scan/route.ts`
