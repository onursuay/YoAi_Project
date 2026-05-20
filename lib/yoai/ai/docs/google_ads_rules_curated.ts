/* ──────────────────────────────────────────────────────────
   YoAlgoritma AI Engine — Google Ads Kuralları (Curated, ~6-8K token)

   Kaynak: docs/google_ads_resmi_dokumanlari.md (resmi Google Ads 2026
   dokümanından distile edildi) + Google platform sabitleri (RSA
   karakter limitleri, asset sayıları).

   agent.ts'de Google hesabı taranırken system array'ine ikinci
   cache'li blok olarak eklenir. Meta taramasında YÜKLENMEZ.

   Güncelleme: docs/google_ads_resmi_dokumanlari.md değişirse buradaki
   distile kurallar da gözden geçirilmeli (docs/resmi_dokumanlar_index.md §4).
   ────────────────────────────────────────────────────────── */

export const GOOGLE_ADS_RULES_CURATED = `# Google Ads — Resmi Kural Özeti (öneri uygunluk referansı)

Bu bölüm, önerdiğin her aksiyon/asset/yapı değişikliğinin Google Ads'in resmi kurallarına ve 2026 mantığına uygun olup olmadığını doğrulaman içindir. Limit aşan, yanlış kampanya tipi öneren veya politikaya aykırı öneri ÜRETME.

Hiyerarşi: Account > Campaign > Ad group / Asset group > Ads / Assets > Keywords / Audiences / Product groups. **Hedef** işi söyler; **kampanya tipi** dağıtım kanalını söyler — aynı şey değildir.

## Kreatif sabitleri (RSA + asset)
| Alan | Limit / öneri |
|------|---------------|
| RSA başlık (headline) | Maks 30 karakter, en fazla 15 başlık; FARKLI açılar (problem, çözüm, fiyat, güven, lokasyon, hız, garanti, sosyal kanıt, CTA) — aynı mesajı tekrar etme |
| RSA açıklama (description) | Maks 90 karakter, en fazla 4 açıklama |
| Display path (görünen URL yolu) | 2 alan × maks 15 karakter |
| Ad assets (uzantılar) | Sitelink, callout, structured snippet, call, location — BOŞ bırakma |
| PMax / Demand Gen asset | Çoklu başlık+açıklama+görsel (1:1, 1.91:1, 4:5/9:16) + logo + video; asset diversity şart |

Ad group başına TEK tema; karışık niyet RSA mesajını sulandırır, landing eşleşmesini bozar.

## Kampanya tipi karar matrisi
| Tip | Ana amaç | Ana kaldıraç | En uygun | Risk |
|-----|----------|--------------|----------|------|
| Search | Aktif niyet yakalama | Keyword, RSA, landing relevance, Quality Score | Lead, satış, çağrı, lokal | Talep yoksa hacim sınırlı; kontrolsüz broad bütçe yakar |
| Performance Max | Tüm envanterde dönüşüm/gelir | Conversion data, asset group, feed, audience signal | E-ticaret, çok kanallı, Search tamamlayıcı | Kötü ölçüm + zayıf feed = kontrol kaybı |
| Demand Gen | Görsel/video talep yaratma | Kreatif, audience, feed opsiyonu | Sosyal mantığını Google envanterine taşımak | Sert satış beklentisiyle tek başına yanıltır |
| Display | Görsel erişim, remarketing | Responsive assets, audience, placement exclusion | Remarketing, farkındalık, destek | Kalitesiz placement, app trafiği, düşük niyet |
| Shopping | Ürün bazlı e-ticaret | Merchant feed (title, price, GTIN, labels) | Ürün listeleme/satış | Feed hatası = doğrudan performans kaybı |
| Video | YouTube farkındalık/consideration | Hook, format, audience | Marka, ürün anlatımı, video remarketing | Zayıf ilk 5 sn bütçe boşa |
| App | Yükleme / in-app aksiyon | SDK/events, asset diversity | Install, in-app action | Bozuk event = düşük kaliteli install |

## Bidding sistemi
- Smart Bidding: Maximize Conversions, Target CPA, Maximize Conversion Value, Target ROAS.
- Yeni hesap / az veri → Maximize Conversions (veya kontrollü ECPC). Yeterli conversion → tCPA/tROAS anlamlı.
- **E-ticarette value tracking düzgün değilse tROAS kullanmak HATA.**
- Düşük bütçe + çok agresif hedef ROAS + zayıf feed + yeni hesap = öğrenme kilitlenir.

## Ölçüm altyapısı
- Temel: conversion tracking + Enhanced Conversions + Consent Mode + offline import + CRM geri besleme.
- Primary vs Secondary conversion ayır: Primary yalnızca gerçekten değerli olaylar (bidding'i besler); mikro eventler Secondary (sadece raporlama).
- Lead işlerinde form gönderimi tek başına yetmez: MQL/SQL/satış/iptal/spam/randevu Google'a geri beslenmeli (offline conversion import).

## Optimum başlangıç (senaryo bazlı)
| Senaryo | Başlangıç | Bidding | Conversion |
|---------|-----------|---------|------------|
| Yeni lead hesabı | Search + ölçüm | Max Conv → veri gelince tCPA | CRM qualified lead primary; PMax hemen ana kampanya YAPILMAZ |
| E-ticaret | PMax + Shopping/Search destek | Max conv value → tROAS | Purchase + value + enhanced conversions |
| Lokal hizmet | Search + call + location assets | Max conv / tCPA | Call, lead, route, appointment |
| B2B yüksek değer | Search + remarketing + Demand Gen | Max conv → qualified tCPA | MQL/SQL offline import; lead sayısı değil DEĞERİ optimize |
| Marka bilinirliği | Video reach/views + Demand Gen | CPM/CPV | Kısa vadede satış KPI ile yargılanmaz |

## Sorun teşhis tablosu
| Sorun | Muhtemel neden | Net aksiyon |
|-------|----------------|-------------|
| Gösterim yok | Düşük bütçe, agresif hedef CPA/ROAS, policy, dar kitle | Hedef gevşet, bütçe/teklif düzelt, policy/ürün hatası çöz |
| CPC yüksek | Rekabet, düşük QS, zayıf relevance, kontrolsüz broad | Landing+RSA+keyword tema uyumu, negatifler, niyet segmentasyonu |
| Lead çok ama kalitesiz | Yanlış primary, broad düşük niyet, kolay form, spam | Qualified lead import, form kalitesi, negatifler, tCPA |
| PMax bütçe yakıyor | Zayıf feed/asset, bozuk conversion, Search cannibalization | Feed temizle, asset ayrımı, brand exclusion, value rules |
| Learning limited | Az conversion, parçalı yapı, düşük bütçe, sık değişiklik | Konsolidasyon, 7-14 gün stabilite, yeterli bütçe |
| ROAS dalgalı | Sezon, stok/fiyat, attribution lag | Stok/fiyat senkron, tROAS geçişi yavaş, ürün segmentasyonu |

## Net prensipler
- Öğrenme döneminde (ilk 7-14 gün) sık bütçe/hedef/conversion/landing/yapı değişikliği yapma — sistem stabil karar veremez.
- Hesap mimarisi konsolide olmalı; aşırı parçalama öğrenmeyi dağıtır.
- PMax'te kontrol ayar kutularında değil INPUT kalitesinde (feed, asset, conversion value, audience signal, URL kapsamı).
- Marka savunması Search'te ayrı yönetiliyorsa PMax'te brand exclusion ile marka trafiğinin şişirdiği sonuçları ayrıştır.
- CTR yükselmesi tek başına anlamlı değil; CTR artarken lead kalitesi düşüyorsa kampanya kötüye gidiyor olabilir.

## Politika kırmızı çizgileri
- Yanıltıcı/abartılı vaat, garanti edilemez sonuç iddiası reddedilir.
- Hassas kategoriler (sağlık, finans, istihdam, konut) kısıtlı; kişiselleştirilmiş hedefleme sınırlı.
- Marka adı/ticari marka izinsiz kullanımı, taklit site, yanlış yönlendiren landing page reddedilir.
- RSA/asset metni ile landing page tutarsızlığı Quality Score + politika riski.`
