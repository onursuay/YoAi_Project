# YoAi Project — Değişiklik Günlüğü

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
