# YoAlgoritma — Proje Amacı ve İş Kuralları

> Bu doküman YoAlgoritma modülünün **amacını ve değişmez iş kurallarını** tanımlar.
> Referans niteliğindedir: AI engine, scan akışı ve doküman entegrasyonu bu kurallara uymak zorundadır.
> Son güncelleme: 2026-05-20
> İlgili dokümanlar: [yoalgoritma_context_audit.md](yoalgoritma_context_audit.md), [YOALGORITMA_MERKEZI_ARCHITECTURE.md](YOALGORITMA_MERKEZI_ARCHITECTURE.md), [resmi_dokumanlar_index.md](resmi_dokumanlar_index.md)

---

## 1. Sistem Amacı

YoAlgoritma, YOAI içinde, kullanıcının bağlı **Meta + Google reklam hesaplarını** AI ile **periyodik olarak tarayan** ve aşağıdaki çıktıları üreten bir modüldür:

- **Kritik uyarılar (alerts)** — acil müdahale gerektiren durumlar
- **İyileştirme fırsatları (opportunities)** — performans artırıcı açık alanlar
- **Önerilen aksiyonlar (suggestions)** — somut, uygulanabilir adımlar
- **Tam reklam spec'i** — yeni/iyileştirilmiş reklam için eksiksiz tanım:
  - `campaign_type` (kampanya türü)
  - `conversion_goal` (dönüşüm hedefi)
  - `cta` (call-to-action)
  - `budget` (bütçe)
  - `location` (konum hedefleme)
  - `placements` (yerleşimler)
  - `demographics` (demografik hedefleme)
  - `creative_brief` (kreatif brief)
  - `headlines` (başlıklar)
  - `descriptions` (açıklamalar)

Amaç, kullanıcının reklam hesabını bir uzman reklam stratejistinin gözünden, gerçek veriye ve resmi platform kurallarına dayanarak değerlendirmek ve **uygulanabilir** çıktı üretmektir.

---

## 2. Üç Ayaklı Analiz Prensibi

Sistem **her tarama sırasında** üç bilgi kaynağını birleştirmek **zorundadır**. Üç ayaktan biri eksikse sonuç kalitesizdir.

### Ayak 1 — Kullanıcının mevcut AKTİF reklamları
- Kullanıcının bağlı hesabındaki canlı kampanya/adset/ad verisi.
- **Yalnızca aktif** reklamlar. `paused` / `closed` / `archived` durumundaki reklamlar **ASLA** dikkate alınmaz (bkz. Bölüm 4).

### Ayak 2 — Platform resmi reklam kuralları / dokümantasyonu
- Meta + Google'ın resmi reklam kuralları, asset spec'leri, karakter limitleri, kampanya tipleri, hedefleme seçenekleri ve politikaları.
- AI'ın ürettiği her önerinin platform kurallarına **uygunluğunu** kontrol etmek için kullanılır.
- Kaynak: bkz. [resmi_dokumanlar_index.md](resmi_dokumanlar_index.md).

### Ayak 3 — Rakip analizi
- Rakiplerin canlı reklamları:
  - **Meta Ad Library** (Apify: `curious_coder/facebook-ads-library-scraper`)
  - **Google Ads Transparency** (Apify: `solidcode/ads-transparency-scraper`)
- Rakibin ne tür reklam yaptığı, hangi mesajı/CTA'yı kullandığı analize girer.

> **Kural:** Üç ayak da AI'a context olarak verilmeden üretilen öneri eksik kabul edilir.

---

## 3. Business Profile Zorunluluğu

Kullanıcı kayıt olurken **zorunlu olarak** aşağıdakileri girer. Bu alanlar **her AI taramasında context olarak Claude'a verilmek zorundadır**:

- **Marka adı**
- **Sektör**
- **Rakipler** (isim + sosyal medya URL'leri)
- **Kendi sosyal medya hesapları**
- **Kısa iş tanımı**
- **Website URL'si**

### Neden zorunlu?
AI yalın metrik gördüğünde **işin ne olduğunu anlamaz**. Business profile olmadan oluşan klasik hata:

> Aşçılık **sertifikası satan** bir kullanıcıya, AI'ın "aşçılara iş fırsatı" reklamı önermesi.

Yani metrik aynı olsa bile, işin doğası (ne satıldığı, kime satıldığı) bilinmeden üretilen öneri yanlış hedefe gider. Business profile bu bağlamı sağlar.

---

## 4. Aktif-Only Kuralı

Pasif / duraklamış / arşivlenmiş kampanyalar AI'a **verilmez**. Tarama yalnızca canlı reklamlar üzerinden yapılır.

| Platform | Zorunlu filtre |
|----------|----------------|
| **Meta** | `effective_status = ACTIVE` |
| **Google** | `status = ENABLED` |

> **Kural:** Filtre veri çekme (fetch) katmanında uygulanmalıdır — yalnızca sayım/özet düzeyinde değil. AI'a giden kampanya detayı (`campaignsDetail`) yalnızca aktif kampanyaları içermelidir.

---

## 5. Çıktı Kalite Kriterleri

- **Generic template kabul edilmez.** "Kreatifinizi yenileyin" gibi belirsiz, her hesaba uyan öneriler geçersizdir.
- **Her öneri spesifik olmalı:**
  - Gerçek `ad ID` / kampanya ID referansı
  - Gerçek metrik (CTR, CPM, CPC, ROAS, frequency, conversion_rate)
  - Business context referansı (markanın ne yaptığı, kime sattığı)
- **Confidence skorları gerçek model belirsizliğini yansıtmalı.** Sabit %80 gibi uydurma yüksek skorlar yasaktır. Skor, kanıtın gücüne göre değişmelidir.
- **Platform kurallarına uygun olmalı.** Önerilen başlık/açıklama karakter limitlerine, asset spec'lerine ve politikalara uymalı (Ayak 2).

---

## 6. Frekans ve Maliyet

| Parametre | Değer |
|-----------|-------|
| **Tarama frekansı** | Haftalık — Pazar 03:00 UTC |
| **Model** | Claude Sonnet 4.6 |
| **Mod** | Batch API (24h SLA, %50 indirim) |
| **Tahmini maliyet** | ~$0.21 / kullanıcı / tarama |
| **Inngest concurrency** | 5 (free plan limiti) |

---

## 7. Kabul Kriteri Özeti (Definition of Done)

Bir tarama "tam" sayılmak için:

1. ✅ Yalnızca **aktif** kampanyalar analiz edildi (Meta `ACTIVE`, Google `ENABLED`).
2. ✅ **Business profile** (marka, sektör, rakipler, sosyal hesaplar, iş tanımı, website) Claude'a context olarak verildi.
3. ✅ **Platform resmi dokümanları** (Meta + Google kuralları) uygunluk kontrolü için AI'a erişilebilir kılındı.
4. ✅ **Rakip reklamları** (Meta Ad Library + Google Ads Transparency, Apify üzerinden) çekilip Claude'a context olarak verildi.
5. ✅ Çıktı **spesifik** (gerçek ID + gerçek metrik + business referansı), **generic değil**.
6. ✅ **Tam ad spec** (campaign_type, conversion_goal, cta, budget, location, placements, demographics, creative_brief, headlines, descriptions) üretildi ve saklandı.
7. ✅ Confidence skorları gerçek belirsizliği yansıtıyor.

> Bu maddelerin mevcut implementasyondaki uyum durumu için bkz. [yoalgoritma_context_audit.md](yoalgoritma_context_audit.md).
