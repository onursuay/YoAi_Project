# YoAi Project — Değişiklik Günlüğü

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
