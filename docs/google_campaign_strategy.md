# Google Ads Strateji Karar Çerçevesi

Bu döküman YoAi algoritmasının Google Ads reklamlarını analiz ederken ve yeni reklam önerisi oluştururken kullandığı karar mantığını tanımlar.

## 1. Kampanya Tipi Seçimi

### İş Hedefi → Kampanya Tipi Eşleştirme

| İş Hedefi | Önerilen Tip | Neden |
|---|---|---|
| Arama yapan kişilere ulaşma | SEARCH | Intent bazlı, en yüksek dönüşüm oranı |
| Marka bilinirliği artırma | DISPLAY veya VIDEO | Geniş erişim, görsel/video ile dikkat çekme |
| E-ticaret ürün satışı | SHOPPING veya PERFORMANCE_MAX | Ürün feed'i ile otomatik gösterim |
| Tüm kanallarda otomasyon | PERFORMANCE_MAX | Google AI tüm kanalları yönetir |
| YouTube'da video reklam | VIDEO | In-stream, bumper, shorts |
| Uygulama indirme | APP | Yükleme optimizasyonu |
| Yerel mağaza trafiği | LOCAL | Harita ve yakın çevre |

## 2. Teklif Stratejisi Seçimi

### Kritik Karar Matrisi

| Durum | Önerilen Strateji | Neden |
|---|---|---|
| Yeni kampanya, dönüşüm verisi yok | MAXIMIZE_CLICKS | Önce trafik topla, veri biriktir |
| 15-30 dönüşüm/ay birikti | MAXIMIZE_CONVERSIONS | Yeterli veri var, dönüşüm optimizasyonu başlat |
| 30+ dönüşüm/ay, maliyet kontrolü | TARGET_CPA | Dönüşüm başı maliyet hedefi koy |
| E-ticaret, gelir takibi var | MAXIMIZE_CONVERSION_VALUE | Geliri maksimize et |
| E-ticaret, 50+ satış/ay | TARGET_ROAS | ROAS hedefi koy (ör. 4x) |
| Marka aramaları, pozisyon önemli | TARGET_IMPRESSION_SHARE | Üst pozisyonu garanti et |
| Tam kontrol isteniyor | MANUAL_CPC | Her keyword için ayrı teklif |

### Teklif Stratejisi Geçiş Kuralları

```
MAXIMIZE_CLICKS (başlangıç)
    ↓ 15-30 dönüşüm/ay biriktikten sonra
MAXIMIZE_CONVERSIONS
    ↓ CPA stabilize olduktan sonra
TARGET_CPA (hedef CPA belirle)
    ↓ E-ticaret + gelir verisi varsa
TARGET_ROAS (hedef ROAS belirle)
```

## 3. Sorunlu Yapılandırma Tespiti

### Kırmızı Bayraklar

| Mevcut Yapılandırma | Sorun | Öneri |
|---|---|---|
| MAXIMIZE_CLICKS + 50+ dönüşüm/ay | Veri var ama kullanılmıyor | MAXIMIZE_CONVERSIONS'a geç |
| TARGET_CPA + <15 dönüşüm/ay | Yetersiz veri, AI öğrenemiyor | MAXIMIZE_CONVERSIONS'a düş |
| TARGET_ROAS + <30 satış/ay | Yetersiz veri | MAXIMIZE_CONVERSION_VALUE'ya düş |
| MANUAL_CPC + geniş keyword listesi | Manuel yönetim sürdürülemez | Smart bidding'e geç |
| SEARCH + sadece BROAD match | Gereksiz harcama | PHRASE veya EXACT match ekle |
| Herhangi biri + negatif keyword yok | İlgisiz aramalar | Negatif keyword listesi oluştur |
| SEARCH + >20 ad group | Yönetim zorluğu | Grupları birleştir veya PMax değerlendir |
| Herhangi biri + impression share <50% bütçe kaybı | Bütçe yetersiz | Bütçe artır veya hedefleme daralt |
| SEARCH + CTR <2% | Reklam metni zayıf | Başlıkları ve açıklamaları yenile |
| Herhangi biri + Quality Score <5 | Düşük kalite | Landing page + reklam uyumu iyileştir |

### Sarı Bayraklar

| Mevcut Yapılandırma | Fırsat | Öneri |
|---|---|---|
| SEARCH only + e-ticaret | PMax potansiyeli | Performance Max kampanya ekle |
| Tek kampanya + yüksek bütçe | Risk yoğunlaşması | Kampanya çeşitlendir |
| Dönüşüm takibi yok | Optimizasyon yapılamaz | Dönüşüm eylemi tanımla |
| Search terms raporu incelenmemiş | İsraf riski | Arama terimleri analiz et |
| Display + geniş hedefleme | Düşük kalite trafik | Hedefleme daralt |

## 4. Dönüşüm Hedefi Önerileri

### Search Kampanyaları İçin

| İş Tipi | Önerilen Dönüşüm Eylemi | Dönüşüm Penceresi |
|---|---|---|
| E-ticaret | PURCHASE | 30 gün (tıklama), 1 gün (görüntüleme) |
| Lead gen (form) | SUBMIT_LEAD_FORM | 30 gün |
| Lead gen (telefon) | PHONE_CALL_LEAD | 30 gün |
| SaaS | SIGNUP | 90 gün |
| Yerel işletme | GET_DIRECTIONS + PHONE_CALL_LEAD | 7 gün |

### Performance Max İçin
- Birincil: PURCHASE veya SUBMIT_LEAD_FORM
- İkincil: ADD_TO_CART, BEGIN_CHECKOUT (micro conversion)
- PMax en az 30 dönüşüm/ay ile en iyi çalışır

## 5. Bütçe Önerileri

| Kampanya Tipi | Minimum Günlük (TRY) | Önerilen Günlük (TRY) | Neden |
|---|---|---|---|
| SEARCH (marka) | 30 | 100+ | Marka aramalarında impression share |
| SEARCH (genel) | 50 | 200+ | Yeterli tıklama verisi |
| DISPLAY | 30 | 100+ | CPM bazlı, hacim gerekli |
| VIDEO | 30 | 150+ | CPV bazlı, izleme gerekli |
| SHOPPING | 50 | 200+ | Ürün bazlı rekabet |
| PERFORMANCE_MAX | 75 | 300+ | Tüm kanallar, yüksek veri ihtiyacı |

## 6. Hedefleme Önerileri

### Lokasyon
- **Yerel işletme**: Şehir + yarıçap (10-50 km)
- **Ulusal hizmet**: Tüm Türkiye
- **E-ticaret**: Kargo bölgeleri (negatif: ulaşılamayan bölgeler)
- **PRESENCE_ONLY**: Fiziksel mağaza varsa (sadece o lokasyondakiler)
- **PRESENCE_OR_INTEREST**: Online hizmet (lokasyona ilgi duyanlar da dahil)

### Dil
- Türkiye: Türkçe
- Turizm/ihracat: Türkçe + İngilizce + hedef pazar dili

### Ağ Ayarları (Search)
- **Google Arama**: Her zaman açık
- **Arama Ağı ortakları**: Bütçe kısıtlıysa kapat
- **Görüntülü Reklam Ağı**: Search kampanyasında kapalı tut (ayrı Display kampanyası aç)

## 7. RSA (Responsive Search Ad) En İyi Uygulamalar

| Kural | Detay |
|---|---|
| Başlık sayısı | Minimum 8, ideal 10-15 |
| Açıklama sayısı | Minimum 3, ideal 4 |
| Başlık uzunluğu | Çeşitli: kısa (15 kar) + uzun (30 kar) karışık |
| Anahtar kelime kullanımı | İlk 3 başlıkta ana keyword olmalı |
| CTA çeşitliliği | Farklı CTA'lar dene (Hemen Ara, Teklif Al, İncele) |
| Benzersizlik | Her başlık birbirinden farklı olmalı |
| Pin kullanımı | Sadece marka adı için (geri kalan serbest) |
