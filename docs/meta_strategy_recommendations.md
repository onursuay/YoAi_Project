# Meta Ads Strateji Karar Çerçevesi

Bu döküman YoAi algoritmasının Meta Ads reklamlarını analiz ederken ve yeni reklam önerisi oluştururken kullandığı karar mantığını tanımlar.

## 1. Kampanya Amacı Seçimi

### İş Hedefi → Kampanya Amacı Eşleştirme

| İş Hedefi | Önerilen Amaç | Neden |
|---|---|---|
| Marka bilinirliği artırma | OUTCOME_AWARENESS | Geniş kitleye ulaşım, düşük CPM |
| Web sitesine trafik çekme | OUTCOME_TRAFFIC | Link tıklama optimizasyonu |
| Sosyal medya etkileşimi | OUTCOME_ENGAGEMENT (ON_AD) | Beğeni, yorum, paylaşım |
| WhatsApp'tan müşteri edinme | OUTCOME_ENGAGEMENT (WHATSAPP) | Mesaj bazlı dönüşüm |
| Instagram DM ile satış | OUTCOME_ENGAGEMENT (INSTAGRAM_DIRECT) | DM açma optimizasyonu |
| Lead form ile müşteri toplama | OUTCOME_LEADS (ON_AD) | Form doldurma optimizasyonu |
| WhatsApp ile lead toplama | OUTCOME_LEADS (WHATSAPP) | Mesaj başlatma optimizasyonu |
| Web sitesinden satış | OUTCOME_SALES (WEBSITE) | Satın alma/dönüşüm optimizasyonu |
| Katalog/e-ticaret satış | OUTCOME_SALES (CATALOG) | Ürün bazlı dinamik reklam |
| Uygulama indirme | OUTCOME_APP_PROMOTION | Yükleme optimizasyonu |

## 2. Dönüşüm Hedefi (Destination) Seçimi

### Ne Zaman Hangi Destination?

#### WEBSITE vs MESSENGER vs WHATSAPP
- **WEBSITE**: Kullanıcının web sitesi varsa ve online dönüşüm (form, satın alma) istiyorsa
- **MESSENGER**: Kullanıcı Facebook Messenger üzerinden müşteri iletişimi yapıyorsa
- **WHATSAPP**: Kullanıcı WhatsApp Business kullanıyorsa (Türkiye'de çok yaygın, tercih edilmeli)
- **INSTAGRAM_DIRECT**: Kullanıcı Instagram DM üzerinden satış yapıyorsa

#### Türkiye Pazarı Özel Kuralları
- Hizmet sektörü (temizlik, tamir, danışmanlık) → **WHATSAPP tercih edilmeli** (Türkiye'de WhatsApp dominant)
- E-ticaret → **WEBSITE + CATALOG** tercih edilmeli
- Yerel işletme (restoran, kuaför) → **WHATSAPP veya CALL** tercih edilmeli
- B2B hizmet → **LEADS (ON_AD)** veya **WHATSAPP** tercih edilmeli

## 3. Optimizasyon Hedefi Seçimi

### Kritik Kararlar

#### Traffic kampanyasında LINK_CLICKS vs LANDING_PAGE_VIEWS
- **LINK_CLICKS**: Daha fazla tıklama ama bounce rate yüksek olabilir
- **LANDING_PAGE_VIEWS**: Daha az tıklama ama kaliteli (sayfa yüklenen) trafik
- **Öneri**: Landing page hızlıysa LANDING_PAGE_VIEWS tercih edilmeli

#### Engagement kampanyasında POST_ENGAGEMENT vs THRUPLAY
- **POST_ENGAGEMENT**: Beğeni, yorum, paylaşım istiyorsa
- **THRUPLAY**: Video izleme istiyorsa (15 sn+ izleme)
- **Öneri**: Video içerik varsa THRUPLAY, yoksa POST_ENGAGEMENT

#### Leads kampanyasında LEAD_GENERATION vs OFFSITE_CONVERSIONS
- **LEAD_GENERATION**: Meta'nın kendi lead formu (ON_AD destination)
- **OFFSITE_CONVERSIONS**: Web sitesindeki form (WEBSITE destination, pixel gerekli)
- **Öneri**: Hızlı sonuç için LEAD_GENERATION, detaylı form için OFFSITE_CONVERSIONS

#### Sales kampanyasında OFFSITE_CONVERSIONS vs VALUE
- **OFFSITE_CONVERSIONS**: Dönüşüm sayısını maksimize et
- **VALUE**: Dönüşüm değerini (geliri) maksimize et (ROAS odaklı)
- **Öneri**: Yeterli dönüşüm verisi varsa (50+ /hafta) VALUE, yoksa OFFSITE_CONVERSIONS

#### WhatsApp kampanyasında CONVERSATIONS vs REPLIES
- **CONVERSATIONS**: Yeni konuşma başlatma (ENGAGEMENT)
- **REPLIES**: Yanıt alma optimizasyonu (LEADS/SALES)
- **Öneri**: Lead toplama amacıysa REPLIES, genel iletişim için CONVERSATIONS

## 4. Sorunlu Yapılandırma Tespiti

### Kırmızı Bayraklar (Hemen Düzeltilmeli)

| Mevcut Yapılandırma | Sorun | Öneri |
|---|---|---|
| TRAFFIC + LINK_CLICKS + yüksek bounce rate | Kalitesiz trafik | LANDING_PAGE_VIEWS'a geç |
| ENGAGEMENT + POST_ENGAGEMENT + satış hedefi | Yanlış amaç | LEADS veya SALES'e geç |
| LEADS + ON_AD + karmaşık hizmet | Form yetersiz | WHATSAPP'a geç (detaylı iletişim) |
| SALES + OFFSITE_CONVERSIONS + <10 dönüşüm/hafta | Yetersiz veri | TRAFFIC'e düş veya pixel olgunlaştır |
| AWARENESS + herhangi biri + düşük bütçe (<100 TRY/gün) | Bütçe yetersiz | TRAFFIC'e geç (daha verimli) |
| WHATSAPP + CONVERSATIONS + lead hedefi | Yanlış optimizasyon | REPLIES'a geç |
| Herhangi biri + Frequency > 4 | Kreatif yorgunluğu | Yeni kreatif veya kitle genişlet |
| WEBSITE destination + pixel yok | Dönüşüm izlenemiyor | Pixel kurulumu öner |

### Sarı Bayraklar (İyileştirme Fırsatı)

| Mevcut Yapılandırma | Fırsat | Öneri |
|---|---|---|
| TRAFFIC + tek hedef kitle | A/B test yok | Lookalike kitle ekle |
| Herhangi biri + tek reklam seti | Risk yoğunlaşması | 2-3 reklam seti oluştur |
| SALES + CBO kapalı | Manuel bütçe | CBO'yu değerlendir (otomatik dağılım) |
| Tüm kampanyalar aynı objective | Çeşitlilik yok | Funnel stratejisi öner |

## 5. Bütçe Önerileri

| Amaç | Minimum Günlük (TRY) | Önerilen Günlük (TRY) | Neden |
|---|---|---|---|
| AWARENESS | 50 | 200+ | Geniş erişim için yeterli bütçe gerekli |
| TRAFFIC | 35 | 100+ | Yeterli tıklama verisi için |
| ENGAGEMENT | 35 | 75+ | Etkileşim maliyeti düşük |
| LEADS | 50 | 150+ | Lead başı maliyet yüksek olabilir |
| SALES | 75 | 250+ | Dönüşüm optimizasyonu veri gerektirir |
| APP_PROMOTION | 50 | 150+ | Yükleme başı maliyet değişken |

## 6. Hedefleme Önerileri

### Lokasyon
- Yerel işletme → Şehir/ilçe bazlı hedefleme (yarıçap 10-30 km)
- Ulusal marka → Tüm Türkiye
- E-ticaret → Kargo ulaşılan bölgeler

### Dil
- Türkiye pazarı → Türkçe (varsayılan)
- Turistik bölge → Türkçe + İngilizce

### Yaş/Cinsiyet
- Genel kural: İlk başta geniş tut, veriye göre daralt
- B2B: 25-55 yaş
- E-ticaret: Ürüne göre (Meta'nın Advantage+ önerisi kullanılabilir)
