# YoAi Project — Değişiklik Günlüğü

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
