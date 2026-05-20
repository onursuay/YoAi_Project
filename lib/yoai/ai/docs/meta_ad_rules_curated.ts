/* ──────────────────────────────────────────────────────────
   YoAlgoritma AI Engine — Meta Reklam Kuralları (Curated, ~6-8K token)

   Kaynak: docs/meta_resmi_reklam_dokumanlari.md (resmi Meta Ads 2026
   dokümanından distile edildi) + Meta platform sabitleri (karakter
   limitleri, asset oranları).

   Bu sabit, agent.ts'de Meta hesabı taranırken system array'ine
   ikinci cache'li blok olarak eklenir (prompt caching → batch
   maliyeti artmaz). Google taramasında YÜKLENMEZ.

   Güncelleme: docs/meta_resmi_reklam_dokumanlari.md değişirse buradaki
   distile kurallar da gözden geçirilmeli (docs/resmi_dokumanlar_index.md §4).
   ────────────────────────────────────────────────────────── */

export const META_AD_RULES_CURATED = `# Meta Ads — Resmi Kural Özeti (öneri uygunluk referansı)

Bu bölüm, önerdiğin her aksiyon/kreatif/yapı değişikliğinin Meta'nın resmi kurallarına ve 2026 teslimat mantığına uygun olup olmadığını doğrulaman içindir. Limit aşan, yanlış objective öneren veya politikaya aykırı öneri ÜRETME.

## Kreatif sabitleri (karakter limitleri ve asset oranları)
| Alan | Limit / öneri |
|------|---------------|
| Primary text (ana metin) | İlk ~125 karakter "Daha fazla"dan önce görünür; teklif/fayda ilk cümlede olmalı |
| Headline (başlık) | Kısa, aksiyonlu; ~40 karakter feed'de güvenli görünür |
| Description | ~30 karakter feed'de görünür; başlığı tekrar etme, ek güven kat |
| Link/feed görsel-video | 1:1 (kare) genel uyum, 4:5 feed'de daha fazla alan |
| Reels / Stories | 9:16 dikey; ana kısa-video formatı |
| Video | İlk 3 saniye hook kritik; sesli+sessiz çalışmalı |
| CTA | Hedefe birebir: Shop Now, Learn More, Sign Up, Send Message |

İlk satır her placement'ta kesilebilir → en kritik mesaj başa. Reklam metni + kreatif + landing page AYNI vaadi söylemeli.

## Kampanya amaçları (objective) — ne için, ne zaman değil
6 amaç: Awareness, Traffic, Engagement, Leads, App promotion, Sales. Amaç, sistemin hangi davranışı değerli sayacağını belirler.
| Amaç | Doğru kullanım | Ana KPI | SEÇİLMEZ |
|------|----------------|---------|----------|
| Awareness | Marka bilinirliği, erişim, üst funnel | Reach, frequency | Ölçülebilir satış/lead bekleniyorsa |
| Traffic | Web/app/mesaj alanına ziyaretçi | Landing page view | Satın alma/form/rezervasyon hedefiyse TEK BAŞINA yanlış |
| Engagement | Etkileşim, mesaj başlatma, video izlenme | Conversation/engagement | Yüksek niyetli satış/lead ana hedefse |
| Leads | Instant form, web form, mesaj, arama | Qualified lead cost | E-ticaret satın alma ana hedefse (→ Sales) |
| App promotion | Uygulama yükleme / in-app aksiyon | Install, app event | Web satış/lead akışında |
| Sales | Web/app/mağaza/katalog satın alma, rezervasyon | Purchase, CPA, ROAS | Sadece trafik/bilinirlik isteniyorsa pahalı |

**KRİTİK HATA:** Satış hedefinde Traffic kampanyası açmak = stratejik hata. Traffic satış değil trafik optimize eder.

## Kampanya modeli seçim matrisi
| İş hedefi | Doğru amaç | Dönüşüm konumu | Ana KPI |
|-----------|-----------|----------------|---------|
| E-ticaret satışı | Sales | Website / App / Catalog | Purchase, CPA, ROAS |
| Bilet/rezervasyon | Sales veya Leads | Website / Website lead | Purchase / qualified lead |
| Hizmet teklifi | Leads | Instant Form / Website / Messages | Qualified lead cost |
| WhatsApp/Messenger talep | Engagement veya Leads | Messaging apps | Qualified conversation |
| Marka duyurusu | Awareness | Video / reach | Reach, frequency |
| Mobil uygulama | App promotion | App | Install, app event |

## Reklam seti & bütçe mühendisliği
- **Kitle:** Geniş kitle / Advantage+ Audience ilk tercih. İlgi alanı mikro-parçalama 2026'da çoğu hesapta verimsiz.
- **Yerleşim:** Advantage+ Placements varsayılan. Manuel placement yalnızca marka güvenliği / kreatif uyumsuzluğu / net veri varsa.
- **Bütçe:** Aynı hedefe çalışan 2-5 reklam seti → Advantage+ campaign budget (CBO). Eşit test zorunluysa → ad set budget. Çok küçük bütçe → bütçeyi parçalama, az reklam seti.
- **Optimization event:** Hedefe en yakın event (Purchase, Lead, CompleteRegistration). Event hacmi düşükse ara event geçici, nihai hedef unutulmaz.
- **Demografik kısıt** yalnızca iş modeli gerektiriyorsa; gereksiz kısıt algoritmanın fırsat alanını daraltır.

## Ölçüm (Pixel + CAPI)
- Pixel + CAPI birlikte, event_id ile deduplication, standart event isimleri.
- Sales'te value + currency doğru; Leads'te CRM qualified/unqualified ayrımı.
- "Medya problemi" gibi görünen çoğu sorun aslında event/ölçüm veya landing page (hız/mobil UX) problemidir.

## Optimizasyon ve müdahale kuralları
| Durum | YAPILIR | YAPILMAZ |
|-------|---------|----------|
| İlk 48-72 saat zayıf | Event/teslimat hatası yoksa beklenir | Saatlik panik kapatma |
| CTR düşük | Kreatif/hook/teklif revize | Hedeflemeyi sürekli daraltmak |
| CPC iyi, dönüşüm yok | Landing/teklif/güven/event/fiyat kontrol | Traffic iyi diye bütçe büyütmek |
| Lead çok, kalitesiz | Form soruları/CRM/teklif kontrol | Sadece düşük CPL'yi başarı saymak |
| ROAS düşüyor | Kreatif yorgunluğu/frekans/stok/web hızı | Kazanan kampanyayı sık düzenlemek |

Kazanan kreatifi sürekli yenile (kreatif yorgunluğu hızlı maliyet artışı doğurur). İlk 48-72 saatte yapı/event/bütçe değişikliği öğrenmeyi bozar.

## Sık yapılan hatalar (öneri verirken bunları tekrarlama)
- Satış hedefinde Traffic; her ilgi alanına ayrı reklam seti (bütçe parçalama).
- Event ölçümü bozukken algoritmayı suçlamak; kreatif üretmeden hedeflemeyle mucize beklemek.
- Kazanana sürekli küçük düzenleme; placement'ı veriyle değil önyargıyla kapatmak.
- Lead kalitesini CRM'den ölçmeden sadece form maliyetine bakmak.

## Politika kırmızı çizgileri
- Kişisel özellik iması (ırk, din, sağlık, cinsel yönelim, finansal durum) yasak.
- Özel kategoriler (kredi, istihdam, konut, sosyal/politik) özel ayar ister.
- Abartılı/garanti vaat, yanıltıcı before/after, sansasyonel içerik reddedilir.
- Reklam vaadi ile landing page tutarsızlığı politika + performans riski.`
