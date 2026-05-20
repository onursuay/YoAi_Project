# Google Ads Resmi Reklam Dokümanları

> Bu dosya `/Users/onursuay/Desktop/Onur Suay/Onur Şuay/Sponsorlu/Meta ve Google Ads Resmi Dökümanları/Google_Ads_2026_Tum_Paket/` altındaki resmi Google Ads eğitim dokümanlarından konsolide edilmiştir.
> Son güncelleme: 2026-05-20
> Kaynak dosyalar:
> - Google_Ads_2026_Temel_Orta_Seviye_Egitim_Dokumani.pdf (Temel/Orta seviye, 7 sayfa)
> - Google_Ads_2026_Ileri_Seviye_Muhendislik_Dokumani.pdf (İleri seviye, 10 sayfa)
> - Google_Ads_2026_Kaynak_Listesi.pdf + .txt (kaynakça)

## İçindekiler

- [Bölüm: Temel / Orta Seviye](#bölüm-temel--orta-seviye)
  - [Google Ads çalışma mantığı](#google-ads-çalışma-mantığı)
  - [Kampanya hedefleri ve kampanya tipleri](#kampanya-hedefleri-ve-kampanya-tipleri)
  - [Ölçüm altyapısı](#ölçüm-altyapısı)
  - [Bidding sistemi](#bidding-sistemi)
  - [Kampanya modeli karar tablosu](#kampanya-modeli-karar-tablosu)
  - [Optimum başlangıç ayarları](#optimum-başlangıç-ayarları)
  - [Hesap kurulum checklist](#hesap-kurulum-checklist)
  - [Pratik sorun teşhis tablosu](#pratik-sorun-teşhis-tablosu)
  - [Kısa sonuç](#kısa-sonuç)
  - [21. Kampanya bazlı kurulum reçeteleri](#21-kampanya-bazlı-kurulum-reçeteleri)
  - [22. Search detay protokolü](#22-search-detay-protokolü)
  - [23. PMax detay protokolü](#23-pmax-detay-protokolü)
  - [24. Demand Gen detay protokolü](#24-demand-gen-detay-protokolü)
  - [25. Merchant Center ve feed mühendisliği](#25-merchant-center-ve-feed-mühendisliği)
  - [26. Lead generation kalite mimarisi](#26-lead-generation-kalite-mimarisi)
  - [27. Bütçe ve öğrenme matematiği](#27-bütçe-ve-öğrenme-matematiği)
  - [28. Raporlama ve karar şablonu](#28-raporlama-ve-karar-şablonu)
  - [29. 90 günlük hesap geliştirme yol haritası](#29-90-günlük-hesap-geliştirme-yol-haritası)
  - [30. Nihai mühendislik kontrol listesi](#30-nihai-mühendislik-kontrol-listesi)
- [Bölüm: İleri Seviye Mühendislik](#bölüm-i̇leri-seviye-mühendislik)
  - [1. Google Ads açık artırma ve kalite sistemi](#1-google-ads-açık-artırma-ve-kalite-sistemi)
  - [2. Hesap mimarisi ve konsolidasyon](#2-hesap-mimarisi-ve-konsolidasyon)
  - [3. Search mühendisliği](#3-search-mühendisliği)
  - [4. AI Max for Search](#4-ai-max-for-search)
  - [5. Performance Max mühendisliği](#5-performance-max-mühendisliği)
  - [6. Demand Gen mühendisliği](#6-demand-gen-mühendisliği)
  - [7. Display ve remarketing mühendisliği](#7-display-ve-remarketing-mühendisliği)
  - [8. Shopping ve Merchant Center](#8-shopping-ve-merchant-center)
  - [9. Video ve YouTube kampanyaları](#9-video-ve-youtube-kampanyaları)
  - [10. Conversion tracking mimarisi](#10-conversion-tracking-mimarisi)
  - [11. Consent Mode ve gizlilik](#11-consent-mode-ve-gizlilik)
  - [12. Bidding strateji mühendisliği](#12-bidding-strateji-mühendisliği)
  - [13. Attribution ve raporlama](#13-attribution-ve-raporlama)
  - [14. Kreatif ve asset mühendisliği](#14-kreatif-ve-asset-mühendisliği)
  - [15. Landing page mühendisliği](#15-landing-page-mühendisliği)
  - [16. Negatifler, brand safety ve kontrol](#16-negatifler-brand-safety-ve-kontrol)
  - [17. Ölçekleme protokolü](#17-ölçekleme-protokolü)
  - [18. Ajans operasyon SOP](#18-ajans-operasyon-sop)
  - [19. Hata teşhis mühendisliği](#19-hata-teşhis-mühendisliği)
  - [20. 2026 ileri seviye net prensipler](#20-2026-ileri-seviye-net-prensipler)
  - [Kampanya tipi mühendislik karar matrisi](#kampanya-tipi-mühendislik-karar-matrisi)
  - [Conversion action sınıflandırma tablosu](#conversion-action-sınıflandırma-tablosu)
  - [İleri seviye troubleshooting karar ağacı](#i̇leri-seviye-troubleshooting-karar-ağacı)
  - [Uygulanacak ajans standardı](#uygulanacak-ajans-standardı)
  - [21-28. Tekrarlanan kampanya/protokol/raporlama bölümleri](#21-28-tekrarlanan-kampanyaprotokolraporlama-bölümleri)
  - [29. 90 günlük hesap geliştirme yol haritası (İleri Seviye)](#29-90-günlük-hesap-geliştirme-yol-haritası-i̇leri-seviye)
  - [30. Nihai mühendislik kontrol listesi (İleri Seviye)](#30-nihai-mühendislik-kontrol-listesi-i̇leri-seviye)
- [Kaynakça](#kaynakça)

---

## Bölüm: Temel / Orta Seviye

> **Google Ads 2026 Temel ve Orta Seviye Eğitim Dokümanı**
> Kampanya tipleri, hedefler, ayarlar, optimizasyon ve ajans kullanım SOP
> Hazırlanma tarihi: 19 Mayıs 2026 | Kaynak tipi: Resmi Google Ads Help, Google Ads API, Google Skillshop/Best Practices dokümanları.

Bu doküman Google Ads tarafında kampanya kuran, yöneten ve performans yorumlayan ekipler için hazırlanmıştır. Amaç, arayüz adımlarını ezberletmek değil; hangi kampanya modelinin hangi ticari amaca hizmet ettiğini netleştirmektir.

### Google Ads çalışma mantığı

Google Ads bir kampanya kurma ekranı değil, açık artırma + sinyal + kalite + teklif + ölçüm sistemidir. Reklamveren hedefini ve varlıklarını verir; Google sistemi arama niyeti, kullanıcı bağlamı, cihaz, lokasyon, geçmiş sinyaller, reklam kalitesi ve teklif stratejisiyle her gösterimde karar verir.

Hesap mimarisi **Account > Campaign > Ad group / Asset group > Ads / Assets > Keywords / Audiences / Product groups** mantığıyla çalışır. Kampanya bütçe, hedef, bidding ve ağ seçimini belirler; ad group veya asset group niyet/tema/kreatif alanını düzenler.

2026 için net gerçek: Google Ads tarafında manuel mikro kontrol azaldı; veri kalitesi, conversion action hijyeni, Smart Bidding, broad match, Performance Max, Demand Gen ve AI Max gibi otomasyon katmanları güçlendi. Mühendis gibi düşünmek, buton ezberi değil sinyal mimarisi kurmaktır.

### Kampanya hedefleri ve kampanya tipleri

Campaign objective seçimi hangi kampanya tiplerinin ve optimizasyon ayarlarının açılacağını etkiler. Sales, Leads, Website traffic, App promotion, Awareness/YouTube reach-views-engagements, Local store visits gibi hedefler farklı envanter ve bidding davranışı üretir.

Kampanya tipi ise reklamın nerede gösterileceğini belirler: Search, Performance Max, Demand Gen, Display, Shopping, Video, App. Hedef ve kampanya tipi aynı şey değildir; hedef işi söyler, kampanya tipi dağıtım kanalını söyler.

Yanlış eşleşme maliyetlidir: Satış beklenen yerde sadece Traffic kurgusu, lead beklenen yerde ölçümsüz Video Reach, e-ticarette bozuk Merchant feed ile Performance Max bütçeyi yakar.

### Ölçüm altyapısı

Google Ads performans mühendisliğinin temeli conversion tracking, Enhanced Conversions, Consent Mode, offline conversion import ve CRM geri besleme sistemidir. Algoritma satın alma, nitelikli lead veya gelir sinyalini görmüyorsa optimizasyon körleşir.

Her hesapta Primary ve Secondary conversion ayrımı yapılmalıdır. Primary sadece bidding için gerçekten değerli olaylarda kullanılmalıdır; mikro eventler Secondary olarak raporlama amacıyla izlenmelidir.

Lead işletmelerinde form gönderimi tek başına yeterli değildir. MQL, SQL, satış, iptal, spam, telefon kalitesi, randevu ve tahsilat gibi offline sonuçlar Google Ads tarafına geri beslenmelidir.

### Bidding sistemi

Smart Bidding; Maximize Conversions, Target CPA, Maximize Conversion Value ve Target ROAS gibi conversion/value odaklı stratejileri kapsar. Sistem her açık artırmada farklı teklif verir.

Yeni hesapta veri azsa genelde Maximize Conversions veya manuel/ECPC geçiş yaklaşımı; yeterli conversion datası oluşunca tCPA/tROAS daha anlamlıdır. E-ticarette value tracking düzgün değilse tROAS kullanmak hatadır.

Budget, bid strategy ve conversion action birlikte düşünülür. Düşük bütçe + çok yüksek hedef ROAS + zayıf feed + yeni hesap kombinasyonu öğrenmeyi kilitler.

### Kampanya modeli karar tablosu

| Kampanya tipi | Ana amaç | Nerede çalışır | Ana kaldıraç | En uygun kullanım | Risk |
|---|---|---|---|---|---|
| Search | Aktif niyet yakalama | Hizmeti/ürünü arayan kullanıcı | Keyword, RSA, landing relevance, Quality Score | Lead, satış, çağrı, lokal niyet | Talep yoksa hacim sınırlı kalır; broad match yanlış sinyalle bütçe yakar |
| Performance Max | Tüm Google envanterinde dönüşüm/gelir | Sales, lead, local, e-ticaret | Conversion data, asset group, audience signals, feed, hedef CPA/ROAS | E-ticaret, çok kanallı büyüme, mevcut Search tamamlayıcısı | Kötü ölçüm ve zayıf feed ile kontrol kaybı yaratır |
| Demand Gen | Görsel/video talep yaratma | YouTube Shorts/in-feed, Discover, Gmail, Display | Creative, audience, product feed opsiyonu | Sosyal reklam mantığını Google envanterine taşımak | Sert satış beklentisiyle tek başına kısa vadede yanıltabilir |
| Display | Görsel erişim, remarketing, düşük maliyetli görünürlük | GDN web/app/YouTube/Gmail | Responsive display assets, audience, placement exclusions | Remarketing, farkındalık, destek kampanyası | Kalitesiz placement, app trafiği, düşük niyet riski |
| Shopping | Ürün bazlı e-ticaret görünürlüğü | Merchant Center feed | Feed title, price, availability, GTIN, labels | Ürün listeleme ve satış | Feed hatası doğrudan performans kaybıdır |
| Video | YouTube farkındalık, izlenme, consideration, action | YouTube ve video partners | Video hook, format, audience, bidding | Marka, ürün anlatımı, video remarketing | Yanlış format ve zayıf ilk 5 saniye bütçe boşa harcar |
| App | Uygulama yükleme/etkileşim | Google Search, Play, YouTube, Display | SDK/events, asset diversity, hedef event | Install, in-app action | Event kalitesi bozuksa düşük kaliteli install gelir |

### Optimum başlangıç ayarları

| Senaryo | Başlangıç modeli | Bidding | Conversion ayarı | Hedefleme | Not |
|---|---|---|---|---|---|
| Yeni lead hesabı | Search + ölçüm kurulumu | Maximize Conversions, veri geldikçe tCPA | Form submit primary değilse CRM qualified lead primary yapılmalı | Exact/phrase + kontrollü broad | PMax hemen ana kampanya yapılmaz; önce sinyal temizliği |
| Kirli veri/pixel geçmişi | Yeni conversion action + temiz import | Maximize Conversions ile kontrollü yeniden öğrenme | Spam leadleri secondary/ignore | Negatif keyword ve lokasyon temizliği | Eski kirli conversion bidding dışı bırakılır |
| E-ticaret | PMax + Shopping/Search destek | Max conversion value -> tROAS | Purchase + value + enhanced conversions | Feed segmentasyonu, custom label | En kritik konu Merchant feed kalitesi |
| Lokal hizmet | Search + call assets + location assets | Max conv / tCPA | Call, lead, route, appointment | Konum yarıçapı + arama niyeti | Geniş Display yerine Search yoğunluğu |
| B2B yüksek değer lead | Search + remarketing + Demand Gen | Max conv sonra qualified tCPA | MQL/SQL offline import | Long-tail exact/phrase, negatifler | Lead sayısı değil lead değeri optimize edilir |
| Marka bilinirliği | Video reach/views + Demand Gen | CPM/CPV veya hedefe göre | Engaged-view, site visit secondary | Geniş kitle + kreatif test | Kısa vadede satış KPI ile yargılanmaz |

### Hesap kurulum checklist

1. Google Ads hesabı, faturalandırma, erişim yetkileri ve MCC bağlantısı kontrol edilir.
2. Google Tag, GTM, GA4 ve Google Ads conversion action kurulumu doğrulanır.
3. Enhanced Conversions ve gerekli ise Consent Mode yapılandırılır.
4. Primary conversion action sadece ticari değeri olan olaylara atanır.
5. UTM standardı ve CRM kaynak eşleştirme alanları hazırlanır.
6. Search için keyword tema yapısı ve negatif keyword havuzu oluşturulur.
7. Merchant Center varsa feed, politika, ürün onayları ve custom label mantığı kurulur.
8. İlk 7-14 gün boyunca gereksiz günlük müdahaleden kaçınılır.

### Pratik sorun teşhis tablosu

| Sorun | Muhtemel neden | Bakılacak alan | Net aksiyon |
|---|---|---|---|
| Gösterim yok | Bütçe çok düşük, hedef CPA/ROAS çok agresif, policy, düşük kalite, dar kitle | Campaign diagnostics, bid strategy status, policy, eligible products, search volume | Hedefleri gevşet, bütçe/teklif sinyali düzelt, ürün/policy hatalarını çöz |
| CPC yüksek | Rekabet, düşük Quality Score, zayıf ad relevance, broad match kontrolsüz | Search terms, QS components, auction insights | Landing + RSA + keyword tema uyumu, negatifler, niyet segmentasyonu |
| Lead çok ama kalitesiz | Yanlış conversion primary, broad düşük niyet, form çok kolay, spam | Lead source, CRM status, search terms, placement | Qualified lead import, form kalitesi, negatifler, tCPA hedefi |
| PMax bütçe yakıyor | Feed/asset zayıf, conversion bozuk, Search cannibalization, düşük intent | Asset group report, listing groups, search term insights | Feed temizle, asset ayrımı, brand exclusion, value rules |
| Learning limited | Az conversion, çok parçalı yapı, düşük bütçe, sık değişiklik | Bid strategy report, conversion volume | Kampanya konsolidasyonu, 7-14 gün stabilite, yeterli bütçe |
| ROAS dalgalı | Sezon, stok/fiyat, attribution lag, budget shocks | Conversion lag, Merchant diagnostics, products | Stok/fiyat senkronu, tROAS geçişi yavaş, ürün segmentasyonu |

### Kısa sonuç

Google Ads 2026 düzeninde kazanan hesaplar daha çok kampanya açanlar değil; daha temiz conversion sinyali, daha iyi kreatif/feed, daha sade hesap mimarisi ve daha disiplinli ölçüm sistemi kuranlardır.

### 21. Kampanya bazlı kurulum reçeteleri

| Model | Mühendislik reçetesi |
|---|---|
| Search - Lead | Amaç: nitelikli lead. Yapı: marka, non-brand yüksek niyet, rakip/alternatif ayrı. Bidding: Maximize Conversions -> tCPA. Primary: qualified lead veya en azından form submit. Zorunlu: negatif keyword havuzu, call/form tracking, landing message match. |
| Search - E-ticaret | Amaç: kategori/ürün niyeti yakalama. Yapı: brand, kategori, yüksek marj, ürün terimi. Bidding: Max conv value/tROAS. Zorunlu: fiyat/stock uyumu, RSA ürün faydası, Shopping/PMax ile çakışma kontrolü. |
| PMax - E-ticaret | Amaç: tüm envanterde satış/değer. Yapı: asset group ürün kategorisi/marj/seasonality. Feed: title, image, GTIN, custom labels. Bidding: Max conv value -> tROAS. Zorunlu: purchase value, enhanced conversions, Merchant diagnostics. |
| PMax - Lead | Amaç: multi-channel lead. Yapı: hizmet temalı asset group. Primary: qualified lead mümkünse offline import. Risk: düşük kaliteli lead. Zorunlu: lead kalite feedback, spam filtre, form/landing kalite. |
| Demand Gen | Amaç: talep yaratma + consideration + remarketing. Yapı: yaratıcı konsept/ad set benzeri gruplama. Bidding: hedefe göre conversions veya clicks/views. Zorunlu: güçlü creative, ürün feed opsiyonu, engaged-view yorumlama. |
| Display Remarketing | Amaç: geri çağırma. Yapı: ziyaret derinliği ve zaman penceresi. Bidding: conversions veya target CPA. Zorunlu: frequency, placement/app exclusion, düşük kalite trafik kontrolü. |
| Video Reach/Views | Amaç: erişim/izlenme. Yapı: format hedefe göre. KPI: reach, frequency, CPV, VTR, engaged views. Zorunlu: satış kampanyası gibi yargılamama. |
| Video Action | Amaç: dönüşüm destekli YouTube. Yapı: action creative + landing. Primary: lead/purchase. Zorunlu: güçlü CTA, mobil landing, remarketing segmentleri. |
| App Campaigns | Amaç: install veya in-app action. Yapı: event seçimi. Zorunlu: Firebase/SDK event temizliği, asset diversity, fake/low quality install kontrolü. |

### 22. Search detay protokolü

Search kampanyasında ilk ayrım marka ve non-brand ayrımıdır. Marka kampanyası savunma, ölçüm ve düşük maliyetli talep yakalama amacı taşır; non-brand kampanya yeni talep ve büyüme alanıdır.

Ad group başına tema net olmalıdır. Aynı ad group içinde farklı niyetler karışırsa RSA mesajı sulanır, landing eşleşmesi bozulur ve search terms analizi zorlaşır.

Keyword match stratejisi dönüşüm verisiyle birlikte düşünülür. Exact daha kontrollüdür ama hacmi sınırlayabilir; phrase orta kontrol sağlar; broad ancak Smart Bidding ve temiz conversion sinyaliyle ölçek aracıdır.

Negatif keyword yönetimi sadece alakasız kelime temizliği değildir. İş modeli dışı niyet, ücretsiz/iş ilanı/şikayet/servis/ikinci el gibi ticari değeri olmayan sorgular baştan engellenmelidir.

RSA metinlerinde aynı anlamı tekrar eden 15 başlık değil; farklı açıları test eden mesaj seti gerekir: problem, çözüm, fiyat/teklif, güven, lokasyon, hız, garanti, sosyal kanıt, kategori, CTA.

Landing page, reklam metnindeki vaadi sayfanın ilk ekranında karşılamalıdır. Kullanıcı reklamdaki mesajı sayfada bulamazsa CPC ucuz olsa bile CPA yükselir.

| Search alanı | Mühendis standardı | Hatalı yaklaşım |
|---|---|---|
| Keyword | Tema ve niyet bazlı yapı | Tek ad group içine her kelimeyi atmak |
| Broad match | Temiz conversion + Smart Bidding sonrası kontrollü | Yeni/ölçümsüz hesapta geniş eşleme açmak |
| Negatifler | Haftalık search terms protokolü | Sadece bütçe bitince bakmak |
| RSA | Mesaj çeşitliliği ve landing uyumu | Aynı başlığı farklı kelimelerle tekrar etmek |
| Ad assets | Sitelink, callout, structured snippet, call/location | Eklentileri boş bırakmak |
| AI Max | Raporlarla izlenen kontrollü otomasyon | URL/sorgu kontrolü olmadan bırakmak |

### 23. PMax detay protokolü

PMax kampanyasında kontrol, kampanya içindeki ayar kutularından çok input kalitesiyle sağlanır. Feed, assets, conversion value, audience signal ve URL kapsamı sistemin karar alanını belirler.

Asset group her zaman iş mantığı taşımalıdır. Örneğin yüksek marjlı ürünler, farklı kategori landingleri, farklı müşteri niyetleri veya farklı kreatif mesajlar ayrım gerekçesidir.

Audience signals hedefleme değil, öğrenme sinyalidir. Google bu sinyali başlangıç yönü olarak kullanır; sadece o kitleye kilitlenmez. Bu yüzden audience signal seçimi CRM, remarketing, custom segment ve satın alma niyeti üzerinden kaliteli kurulmalıdır.

Brand exclusion ve final URL expansion kontrolleri hesaba göre değerlendirilir. Marka savunması Search ile ayrı yönetiliyorsa PMax içinde marka trafiğinin şişirdiği sonuçlar ayrıştırılmalıdır.

E-ticarette ürün segmentasyonu custom label ile yapılmalıdır. Marjı düşük, stoku sorunlu, iade oranı yüksek veya fiyat rekabeti zayıf ürünler aynı bütçede yüksek marjlı ürünlerle yarıştırılmamalıdır.

PMax raporlamasında sadece kampanya CPA/ROAS yeterli değildir. Asset group, listing group, product, search term insights, new customer acquisition ve conversion value breakdown izlenmelidir.

| PMax kontrol alanı | Doğru kullanım | Risk |
|---|---|---|
| Asset groups | Tema, kategori, marj veya landing bazlı | Rastgele gruplama öğrenmeyi dağıtır |
| Audience signals | CRM, remarketing, custom intent, in-market | Kitle hedefleme sanmak yanlış |
| Final URL expansion | Uygun sayfalara genişleme | Yanlış landing ve düşük marjlı sayfa riski |
| Merchant feed | Title/image/GTIN/custom label optimizasyonu | Feed zayıfsa sistem kötü ürünü iter |
| Bidding | Value doğruysa tROAS; hacim gerekiyorsa Max value | Agresif ROAS hacmi boğar |
| Brand control | Search stratejisiyle birlikte | Marka trafiği performansı olduğundan iyi gösterir |

### 24. Demand Gen detay protokolü

Demand Gen sosyal reklam mantığına yakın düşünülmelidir: kreatif, kitle, teklif, ürün sahnesi ve mobil deneyim kampanyanın ana motorudur.

YouTube Shorts ve Discover gibi yüzeylerde kullanıcı aktif arama yapmıyor olabilir; bu yüzden mesaj açık, görsel güçlü ve ilk temas ikna edici olmalıdır.

Demand Gen ile ürün feed birleştirildiğinde kampanya sanal vitrin gibi çalışabilir. Ancak feed kalitesi ve kreatif uyumu zayıfsa ürün gösterimi performans üretmez.

Bu kampanyada tek KPI last-click satış olmamalıdır. View-through/engaged-view, assisted conversion, remarketing havuzu büyümesi, yeni kullanıcı ve marka arama artışı birlikte okunmalıdır.

Kreatif setleri konsept bazlı yönetilmelidir: problem-çözüm, sosyal kanıt, ürün demo, fiyat/teklif, karşılaştırma, kurumsal güven, hızlı fayda.

| Creative konsept | Ne anlatır | Ne zaman kullanılır |
|---|---|---|
| Problem çözüm | Kullanıcının ağrısını ve çözümü hızlı gösterir | Soğuk kitle |
| Ürün demo | Ürünün nasıl çalıştığını gösterir | Yeni/karmaşık ürün |
| Sosyal kanıt | Yorum, müşteri, kullanım sahnesi | Güven ihtiyacı yüksek hizmet |
| Teklif/fiyat | Net kampanya veya avantaj | Dönüşüm odaklı dönem |
| Karşılaştırma | Alternatiflere göre fark | Rekabet yoğun pazar |
| Kurumsal güven | Sertifika, tecrübe, garanti | Yüksek karar riski |

### 25. Merchant Center ve feed mühendisliği

Merchant Center performansı reklam panelinden önce ürün verisiyle belirlenir. Eksik GTIN, zayıf title, kalitesiz görsel, yanlış availability, fiyat uyumsuzluğu ve kategori hatası PMax/Shopping performansını düşürür.

Ürün title alanı arama niyetine göre optimize edilmelidir. Marka + ürün tipi + temel özellik + kullanım/ölçü/renk/model bilgisi çoğu kategoride daha iyi sinyal verir.

Custom label alanları stratejik segmentasyon için kullanılmalıdır. Örneğin margin_high, bestseller, clearance, season_summer, price_0_500, stock_risk, new_arrival gibi etiketler bütçe ve raporlama kontrolü sağlar.

Feed fiyatı ile landing fiyatı uyumsuzsa güven, onay ve performans bozulur. Stok dışı ürünlerin reklamda kalması gereksiz tıklama maliyeti üretir.

E-ticaret hesaplarında ROAS değerlendirmesi brüt ciro değil, mümkünse marj ve iade sonrası net değer üzerinden yapılmalıdır.

| Feed alanı | Neden kritik | Optimizasyon |
|---|---|---|
| Title | Arama ve ürün eşleşme sinyali | Kategori ve niyet kelimeleri ekle |
| Image | CTR ve güven etkisi | Temiz, yüksek kalite, ürünü net gösteren görsel |
| GTIN/MPN | Ürün kimliği ve eşleşme | Mümkün olan her üründe eksiksiz |
| Price | Rekabet ve onay | Landing ile anlık uyum |
| Availability | Boşa tıklama önleme | Stok senkronu |
| Custom labels | Segmentasyon ve bütçe kontrolü | Marj, sezon, stok, performans sınıfı |

### 26. Lead generation kalite mimarisi

Lead kampanyalarında ham form sayısı başarı değildir. Başarı; ulaşılabilir, ilgili, bütçesi olan ve satışa ilerleyen lead oranıdır.

Google Ads tarafına sadece form submit gönderilirse sistem form dolduran herkesi değerli sanır. Bu özellikle düşük kaliteli, iş dışı veya spam leadleri artırabilir.

CRM içinde lead statüleri standartlaştırılmalıdır: new, contacted, unqualified, qualified, appointment, sale, lost, spam. Bu statüler offline conversion olarak geri beslenebilir.

Lead form sürtünmesi iş modeline göre ayarlanmalıdır. Çok kolay form hacmi artırır ama kaliteyi düşürebilir; çok zor form kaliteyi artırır ama hacmi boğabilir.

Telefon leadlerinde çağrı süresi tek başına yeterli değildir; gerçek satış veya randevu sonucu mümkünse call conversion import ile beslenmelidir.

| Lead sinyali | Kalite seviyesi | Bidding kullanımı |
|---|---|---|
| Form submit | Düşük/orta | Geçici primary veya secondary |
| Qualified lead | Yüksek | Tercih edilen primary |
| Appointment booked | Yüksek | Primary olabilir |
| Sale/Closed won | En yüksek | Value ile primary |
| Spam/unqualified | Negatif öğrenme için hariç | Primary yapılmaz |
| Call > 60 sn | Orta | Sektöre göre primary/secondary |

### 27. Bütçe ve öğrenme matematiği

Kampanya bütçesi hedef CPA veya beklenen conversion hacmiyle ilişkili olmalıdır. Çok düşük bütçeyle çok parçalı kampanya kurmak öğrenmeyi dağıtır.

Öğrenme döneminde sık bütçe, hedef, conversion action, landing veya yapı değişikliği yapılırsa sistem stabil karar veremez.

Günlük bütçe belirlerken hedef CPA x beklenen günlük conversion sayısı mantığı kullanılabilir. Örneğin hedef CPA 500 TL ise günlük 100 TL bütçeyle sağlıklı öğrenme beklemek gerçekçi değildir.

Bütçe artışları kademeli yapılmalıdır. Ani artışlar envanter genişletir, CPA/ROAS dalgalanabilir. Ölçekleme öncesi conversion lag ve attribution penceresi kontrol edilmelidir.

Hedef ROAS çok agresif seçilirse sistem yüksek olasılıklı az sayıda kullanıcıya sıkışır ve büyüme durur. Hedefler önce gözlem, sonra kademeli sıkılaştırma ile yönetilir.

| Durum | Yanlış aksiyon | Doğru aksiyon |
|---|---|---|
| Düşük hacim | Daha çok kampanya açmak | Konsolide et, bütçe ve sinyali birleştir |
| CPA yüksek | Hemen tCPA çok düşürmek | Search terms/landing/conversion kalite kontrolü |
| ROAS düşük | Bütçeyi aniden kesmek | Ürün/marj/feed/price segmentasyonu |
| Learning limited | Sürekli hedef değiştirmek | 7-14 gün stabilite ve hacim sağlamak |
| PMax dalgalı | Asset group silmek | Conversion lag ve ürün raporuyla karar vermek |

### 28. Raporlama ve karar şablonu

Profesyonel Google Ads raporu metrik dökümü değil karar üretimidir. Her rapor şu yapıya sahip olmalıdır: durum, neden, risk, aksiyon, beklenen etki, kontrol tarihi.

Müşteriye CTR yükseldi demek tek başına anlamlı değildir. CTR yükselirken lead kalitesi düşüyorsa kampanya kötüye gitmiş olabilir.

Kanal bazlı raporda Search, PMax, Demand Gen, Display, Video ve Shopping farklı KPI setleriyle okunmalıdır. Tüm kampanyaları aynı CPA/ROAS beklentisiyle yargılamak teknik hatadır.

Raporlarda conversion lag açıkça belirtilmelidir. Özellikle B2B, yüksek sepet, telefon satışı ve offline satış işlerinde bugünün harcaması bugünün satışıyla birebir eşleşmez.

| Rapor bölümü | İçerik | Karar |
|---|---|---|
| Özet | Harcama, gelir/lead, CPA/ROAS, trend | Devam/optimize/durdur |
| Sinyal sağlığı | Tracking, enhanced conversions, offline import | Ölçüm güvenilir mi? |
| Kampanya kırılımı | Search/PMax/Demand Gen/Display/Video | Bütçe nereye kaymalı? |
| Sorun teşhisi | Neden performans düştü/yükseldi | Aksiyon listesi |
| Testler | Kreatif, landing, bidding, feed | Kazanan/kaybeden |
| Sonraki adım | Net yapılacaklar | Sorumlu ve tarih |

### 29. 90 günlük hesap geliştirme yol haritası

| Dönem | Ana iş | Beklenen çıktı |
|---|---|---|
| Gün 1-7 | Measurement audit, conversion action temizliği, GTM/GA4/Google Ads kontrol | Güvenilir sinyal altyapısı |
| Gün 8-14 | Search/PMax temel yapı, feed ve landing kontrolü | İlk stabil kampanya mimarisi |
| Gün 15-30 | Search terms, negatifler, kreatif/asset testleri, CRM lead kalite kontrolü | Erken optimizasyon |
| Gün 31-45 | Bidding geçişleri, tCPA/tROAS değerlendirme, asset group revizyonu | Daha kontrollü maliyet/değer |
| Gün 46-60 | Demand Gen/remarketing/video destek katmanı | Talep ve yeniden pazarlama büyümesi |
| Gün 61-90 | Offline conversions, value rules, feed segmentasyonu, ölçekleme | Mühendislik düzeyinde büyüme sistemi |

### 30. Nihai mühendislik kontrol listesi

> Not: Orijinal dokümanda bu liste 9. maddeden başlar ve 20. maddede biter; numaralandırma kaynak PDF'teki haliyle korunmuştur.

9. Primary conversion action ticari değeri temsil ediyor mu?
10. Enhanced Conversions aktif ve diagnostics temiz mi?
11. Lead işletmesinde CRM kalite sonucu Google Ads tarafına dönüyor mu?
12. Search kampanyalarında search terms ve negatifler haftalık yönetiliyor mu?
13. Broad match sadece temiz sinyalle ve Smart Bidding ile mi kullanılıyor?
14. PMax asset groups iş mantığına göre mi ayrıldı?
15. Merchant feed title, image, price, availability ve custom labels optimize mi?
16. Demand Gen/Video kreatifleri mobile-first ve ilk 5 saniye güçlü mü?
17. Landing sayfaları reklam vaadiyle birebir uyumlu mu?
18. Bütçe ve hedef CPA/ROAS öğrenme için gerçekçi mi?
19. Raporlama sadece metrik değil karar üretiyor mu?
20. Her değişiklik için not, gerekçe, beklenen etki ve kontrol tarihi var mı?

---

## Bölüm: İleri Seviye Mühendislik

> **Google Ads 2026 İleri Seviye Mühendislik Kılavuzu**
> Google Ads mühendisleri gibi hesap mimarisi, sinyal sistemi, bidding, ölçüm ve problem teşhisi
> Hazırlanma tarihi: 19 Mayıs 2026 | Kaynak tipi: Resmi Google Ads Help, Google Ads API, Google Skillshop/Best Practices dokümanları.

Bu kılavuz Google Ads hesabını reklam paneli olarak değil, veri beslenen ve açık artırmada karar veren bir optimizasyon sistemi olarak ele alır.

İleri seviye yaklaşımda ana soru "hangi butona basılır" değildir. Ana soru şudur: Google algoritmasına hangi hedef, hangi sinyal, hangi değer, hangi kısıt, hangi kreatif ve hangi landing deneyimi veriliyor?

Net prensip: Google Ads sistemine kötü conversion sinyali verirsen, sistem kötü müşteriyi daha ucuza bulmayı öğrenir. İyi sinyal verirsen, iyi müşteriyi ölçeklemeye başlar.

### 1. Google Ads açık artırma ve kalite sistemi

Her gösterim bir açık artırmadır. Reklam sıralaması sadece teklif değildir; ad relevance, expected CTR, landing page experience, asset kalitesi, kullanıcı bağlamı ve reklam eklentileri de sonucu etkiler.

Search tarafında Quality Score tanısal bir metriktir. Mühendislikte QS tek başına KPI değil, CPC ve ad rank problemini teşhis eden sinyal olarak kullanılır.

Auction-time bidding cihaz, lokasyon, saat, sorgu, kitle sinyali, dönüşüm olasılığı ve değer tahminini aynı anda hesaba katar. Bu yüzden manuel CPC ile modern conversion scale çoğu durumda sınırlıdır.

### 2. Hesap mimarisi ve konsolidasyon

2026 hesap mimarisinde aşırı bölünmüş kampanyalar genelde öğrenmeyi yavaşlatır. Kampanya bölme kararı yalnızca bütçe kontrolü, farklı hedef, farklı marj, farklı lokasyon veya farklı operasyonel sahiplik varsa mantıklıdır.

Search ad group yapısı tema bazlı olmalı; her ad group tek niyet kümesine hizmet etmelidir. PMax asset group yapısı ürün/hizmet kategorisi, landing page, audience signal ve kreatif mesaj uyumuna göre düzenlenmelidir.

Konsolidasyon körlemesine yapılmaz. Marka/non-brand, ülke, dil, ürün marjı, stok, lead kalite farkı, bütçe sahibi ve raporlama ihtiyacı ayrım nedenidir.

### 3. Search mühendisliği

Search hala en yüksek niyetli kampanya tipidir. Ancak exact/phrase/broad match artık eski manuel anahtar kelime mantığıyla çalışmaz; yakın varyasyonlar, semantik eşleşme ve AI Max katmanı dikkate alınmalıdır.

Responsive Search Ads için minimum hedef: yeterli headline çeşitliliği, landing uyumu, fiyat/değer önerisi, güven unsuru, CTA ve sorgu teması. Pinleme sadece hukuki/marka zorunluluğu varsa kontrollü kullanılmalıdır.

Broad match sadece conversion tracking temizse, Smart Bidding aktifse, negatif keyword disiplini varsa ve search terms düzenli izleniyorsa ölçekleme aracıdır. Aksi halde bütçe sızıntısıdır.

### 4. AI Max for Search

AI Max, Search kampanyalarında otomasyon ve landing/asset genişleme kapasitesini artıran katmandır. DSA ve PMax Final URL expansion mantığına yaklaşır ama Search kontrol alanını korur.

AI Max aktif edildiğinde ilk iki hafta yoğun mikro müdahale yapılmamalıdır. Search terms, landing pages, asset ve keyword raporlarıyla otomasyon trafiği incelenir.

Kritik güvenlik: yanlış landing sayfaları, uygunsuz sorgular, düşük marjlı ürünler ve marka dışı karışımlar negatif/URL kontrolü ile yönetilmelidir.

### 5. Performance Max mühendisliği

PMax tek kampanyadan Search, YouTube, Display, Discover, Gmail ve Maps envanterine erişir. Search kampanyasının yerine değil, keyword-based Search kampanyalarını tamamlayacak şekilde düşünülmelidir.

PMax performansı conversion action kalitesi, asset çeşitliliği, ürün feed kalitesi, audience signal, bütçe seviyesi ve değer sinyaline bağlıdır. Sadece kampanya açmak yeterli değildir.

Asset group ayrımı landing page, ürün grubu, mesaj ve kitle sinyali uyumuna göre yapılır. Her asset group farklı stratejik tema taşımalıdır; rastgele kategoriler öğrenmeyi dağıtır.

E-ticarette PMax başarısı Merchant Center feed mühendisliğine bağlıdır: title, description, GTIN, price, availability, image, product_type, google_product_category, custom_label ve stok doğruluğu kritik önemdedir.

### 6. Demand Gen mühendisliği

Demand Gen, YouTube Shorts, in-feed, Discover, Gmail ve Display Network üzerinde görsel/video talep oluşturur. Sosyal reklam zihniyetine yakın ama Google kullanıcı bağlamına bağlı çalışır.

Demand Gen kısa vadeli son tıklama satış kampanyası gibi yönetilirse yanlış okunur. Engaged-view, assisted conversions, new customer, ürün feed etkileşimi ve remarketing etkisi birlikte değerlendirilmelidir.

Creative-first bir kampanya tipidir. Hook, ürün kullanım sahnesi, sosyal kanıt, teklif, hızlı mesaj ve mobile-first video bu kampanyanın ana kaldıraçlarıdır.

### 7. Display ve remarketing mühendisliği

Display kampanyaları düşük maliyetli erişim, remarketing ve görsel destek için kullanılabilir. Ancak placement kalitesi, app trafiği ve düşük niyet riski nedeniyle sıkı kontrol gerekir.

Responsive Display Ads asset tabanlı çalışır; Google farklı headline, açıklama, logo, görsel ve video kombinasyonlarını üretir. Tek kreatif değil, asset portföyü yönetilir.

Remarketing segmentleri davranış derinliğine göre ayrılmalıdır: tüm ziyaretçiler, ürün görüntüleyenler, sepete ekleyenler, form başlatanlar, video izleyenler, eski müşteriler.

### 8. Shopping ve Merchant Center

Shopping tarafında reklam kalitesi feed kalitesiyle başlar. Ürün başlığı, görsel, fiyat, stok ve kategori hataları Google Ads optimizasyonunu doğrudan bozar.

Custom labels mühendislik aracıdır: marj, sezon, stok, fiyat bandı, bestseller, clearance, yeni ürün, ROAS segmenti gibi iş verileri feed içine taşınır.

PMax ve Shopping birlikte kullanılacaksa ürün kapsamı, priority, ürün segmenti ve raporlama amacı net ayrılmalıdır.

### 9. Video ve YouTube kampanyaları

Video kampanyaları awareness, consideration ve action hedefleri için farklı davranır. Video views/reach ile direct sales kampanyasını aynı KPI ile ölçmek hatadır.

İlk 5 saniye kreatif mühendisliğin en kritik alanıdır. Marka, problem, vaat, dikkat çeken görsel ve teklif hızlı verilmelidir.

YouTube action kurgularında conversion tracking, landing page hızı, CTA ve remarketing zinciri birlikte düşünülmelidir.

### 10. Conversion tracking mimarisi

Primary conversion action bidding sinyalidir. Her event primary yapılmaz. Page view, scroll, time on site gibi mikro olaylar bidding sinyali yapılırsa sistem ucuz ama değersiz kullanıcı bulmayı öğrenir.

Enhanced Conversions, hashed first-party verilerle ölçüm doğruluğunu artırır. 2026 itibarıyla web ve leads enhanced conversions ayarlarının daha birleşik hale gelmesi beklenir.

Offline conversions, lead işletmelerinin gerçek performans motorudur. GCLID/GBRAID/WBRAID, email/phone hash, order id, conversion time, conversion value ve consent bilgileri düzgün tutulmalıdır.

### 11. Consent Mode ve gizlilik

Consent Mode reklam ölçümünü kullanıcı izin durumuna göre modellemeye destek olur. Yanlış kurulum veri kaybı veya hukuki risk yaratır.

GTM, Google tag, CMP ve Google Ads conversion action eşleşmesi test edilmelidir. DebugView, Tag Assistant ve conversion diagnostics birlikte kullanılmalıdır.

Türkiye ve AB trafiği olan hesaplarda açık rıza, çerez politikası ve veri işleme süreçleri kampanya performansı kadar operasyonel risk açısından da önemlidir.

### 12. Bidding strateji mühendisliği

Maximize Conversions hacim öğrenmek için; Target CPA maliyet disiplini için; Maximize Conversion Value gelir/value optimizasyonu için; Target ROAS karlılık disiplini için kullanılır.

Target CPA/ROAS hedefleri piyasa gerçekliğinden kopuk seçilirse sistem gösterimi kısar. Hedefler geçmiş veriden kademeli türetilmelidir.

Bid strategy değişiklikleri sık yapılmaz. Her majör değişiklik öğrenme sürecini etkiler. Değişiklik sonrası 7-14 gün değerlendirme penceresi korunmalıdır.

### 13. Attribution ve raporlama

Google Ads atribüsyonu son tıklama raporlaması değildir; conversion lag, engaged-view, data-driven attribution ve cross-device etkiler hesaba katılır.

GA4 ve Google Ads dönüşüm sayıları birebir aynı olmayabilir. Farklı atribüsyon, zaman damgası, consent, modelleme ve import mantığı nedeniyle sapma normaldir.

Raporlama mühendisliği KPI hiyerarşisi kurar: spend, impressions, clicks, CPC, CTR, CVR, CPA, ROAS, revenue, qualified lead rate, margin, LTV.

### 14. Kreatif ve asset mühendisliği

Asset-based reklam çağında kreatif tek görsel değil, kombinasyon sistemidir. Google headlines, descriptions, images, logos, videos ve feed varlıklarını farklı envanterlerde eşleştirir.

Kreatif testleri sadece CTR ile değerlendirilmez. Conversion rate, CPA, assisted conversion, new customer rate, lead kalite ve asset report birlikte okunur.

Creative fatigue özellikle Demand Gen, Display ve Video tarafında takip edilmelidir. Aynı mesajın frekansı yükseldiğinde CTR/CVR bozulabilir.

### 15. Landing page mühendisliği

Landing page reklam sisteminin dışındaki en büyük performans kaldıraçlarından biridir. Mesaj uyumu, hız, mobil deneyim, form sürtünmesi, güven unsurları, fiyat/teklif netliği dönüşümü belirler.

Search için landing-query-ad üçgeni koparsa Quality Score ve CVR düşer. PMax/Demand Gen için landing page içeriği Google AI tarafından sinyal olarak kullanılır.

Formlarda çok az alan lead kalitesini düşürebilir, çok fazla alan hacmi düşürebilir. CRM sonuçlarıyla optimum form sürtünmesi belirlenmelidir.

### 16. Negatifler, brand safety ve kontrol

Search terms raporu düzenli incelenmelidir. Negatif keyword, brand exclusion, placement exclusion ve içerik uygunluğu kontrolleri bütçe sızıntısını azaltır.

PMax kontrol alanı Search kadar granular değildir; bu yüzden input kalitesi, feed segmentasyonu, brand exclusion ve asset/URL kontrolü daha kritiktir.

Display ve Video tarafında çocuk içeriği, mobil app placement, düşük kalite siteler ve uygunsuz kategoriler kontrol edilmelidir.

### 17. Ölçekleme protokolü

Ölçekleme bütçeyi bir anda ikiye katlamak değildir. Veri stabilitesi, impression share, CPA/ROAS trendi, conversion lag ve stok/operasyon kapasitesi kontrol edilir.

Bütçe artışı genelde kademeli yapılır. Hedef CPA/ROAS agresif şekilde sıkılaştırılırsa hacim düşebilir.

Başarılı kampanyayı bölmek yerine önce bütçe, asset, feed, landing ve kitle sinyali iyileştirilir. Ayrı kampanya ancak iş gerekçesi varsa açılır.

### 18. Ajans operasyon SOP

Her hesapta haftalık değişiklik günlüğü tutulmalıdır. Ne değişti, neden değişti, beklenen etki ne, kontrol tarihi ne, rollback şartı ne açık olmalıdır.

Müşteriye sadece metrik raporu değil karar raporu verilmelidir: ne oldu, neden oldu, ne yapılacak, ne yapılmayacak.

Yetki, faturalandırma, MCC, dönüşüm sahipliği, GTM erişimi, Merchant Center ve CRM bağlantıları onboarding checklist içinde kapatılmalıdır.

### 19. Hata teşhis mühendisliği

Performans düştüğünde önce ölçüm, policy, bütçe, bidding status, conversion lag, landing uptime, feed, stok, fiyat ve rekabet kontrol edilir. Kreatif veya kitle suçlanmadan önce sistemsel nedenler elenir.

Tek günlük veriyle karar verilmez. Ancak tracking kırılması, bütçe tüketim anomalisi, policy disapproval veya feed hata artışı acildir.

Sorun teşhisi her zaman hipotez-test-aksiyon formatında yapılmalıdır.

### 20. 2026 ileri seviye net prensipler

Google Ads mühendisliği otomasyona karşı savaşmak değil, otomasyona doğru veri ve sınır vermektir.

En iyi hesap yapısı en çok kontrol veren değil, en iyi öğrenmeyi sağlayan yapıdır.

Kötü ölçümle iyi kampanya olmaz. Kötü landing ile ucuz trafik bile zarar ettirir. Kötü feed ile PMax ölçeklenmez. Kötü kreatifle Demand Gen çalışmaz.

### Kampanya tipi mühendislik karar matrisi

| Kampanya | Veri ihtiyacı | Kontrol seviyesi | Ölçek potansiyeli | Ana optimizasyon | Kullanma / durdurma şartı |
|---|---|---|---|---|---|
| Search | Orta | Yüksek | Talep hacmi kadar | Query niyeti + RSA + bidding | Search terms alakasız ve CVR düşükse yapı revize |
| PMax | Yüksek | Orta/Düşük | Çok yüksek | Conversion value + feed + assets | Ölçüm/feed zayıfsa ana bütçe verilmez |
| Demand Gen | Orta | Orta | Yüksek | Creative + audience + engaged conversion | Kreatif zayıfsa ölçek yapılmaz |
| Display | Düşük/Orta | Orta | Yüksek ama kalite riski var | Audience + placement + creative | Placement kalitesi kötü ise kısılır |
| Shopping | Yüksek feed kalitesi | Orta | Ürün hacmi kadar | Feed + price + custom labels | Merchant hataları varken ölçek yok |
| Video | Orta | Orta | Çok yüksek | Hook + format + hedef | Yanlış KPI ile değerlendirilmez |
| App | Yüksek event kalitesi | Düşük/Orta | Yüksek | In-app event + asset diversity | SDK/event kalitesi bozuksa açılmaz |

### Conversion action sınıflandırma tablosu

| Event | Primary mi? | Neden | Not |
|---|---|---|---|
| Purchase / Revenue | Evet | Doğrudan ticari değer | Value ve order_id zorunlu |
| Qualified lead / SQL | Evet | Lead kalitesini temsil eder | Offline import önerilir |
| Raw form submit | Koşullu | CRM yoksa geçici primary | Spam varsa secondary yapılır |
| Phone call > anlamlı süre | Koşullu | Hizmet işletmeleri için değerli | Call conversion import daha doğru |
| Page view | Hayır | Düşük niyet | Remarketing segmenti olabilir |
| Scroll / time on site | Hayır | Bidding sinyali olarak zayıf | Secondary analitik amaçlı |
| Add to cart | Koşullu | E-ticarette mikro sinyal | Purchase yoksa geçici kullanılabilir |
| Begin checkout | Koşullu | Purchase öncesi güçlü sinyal | Purchase yeterli olunca secondary olabilir |

### İleri seviye troubleshooting karar ağacı

| Belirti | Önce kontrol et | İkinci kontrol | Aksiyon |
|---|---|---|---|
| Gösterim yok | Bütçe çok düşük, hedef CPA/ROAS çok agresif, policy, düşük kalite, dar kitle | Campaign diagnostics, bid strategy status, policy, eligible products, search volume | Hedefleri gevşet, bütçe/teklif sinyali düzelt, ürün/policy hatalarını çöz |
| CPC yüksek | Rekabet, düşük Quality Score, zayıf ad relevance, broad match kontrolsüz | Search terms, QS components, auction insights | Landing + RSA + keyword tema uyumu, negatifler, niyet segmentasyonu |
| Lead çok ama kalitesiz | Yanlış conversion primary, broad düşük niyet, form çok kolay, spam | Lead source, CRM status, search terms, placement | Qualified lead import, form kalitesi, negatifler, tCPA hedefi |
| PMax bütçe yakıyor | Feed/asset zayıf, conversion bozuk, Search cannibalization, düşük intent | Asset group report, listing groups, search term insights | Feed temizle, asset ayrımı, brand exclusion, value rules |
| Learning limited | Az conversion, çok parçalı yapı, düşük bütçe, sık değişiklik | Bid strategy report, conversion volume | Kampanya konsolidasyonu, 7-14 gün stabilite, yeterli bütçe |
| ROAS dalgalı | Sezon, stok/fiyat, attribution lag, budget shocks | Conversion lag, Merchant diagnostics, products | Stok/fiyat senkronu, tROAS geçişi yavaş, ürün segmentasyonu |
| PMax Search trafiğini yiyor | Brand/non-brand, Search kampanyası, search term insights | Brand exclusions, URL expansion | Search kampanyasını güçlendir, PMax brand kontrolü yap |
| Demand Gen satış getirmiyor | Kampanya hedefi ve attribution penceresi | Engaged-view, assisted, remarketing | KPI beklentisini düzelt, kreatif/landing test et |
| Offline import eşleşmiyor | GCLID/GBRAID/WBRAID kaydı | Hash formatı, conversion time, consent | CRM formunda click id sakla, enhanced leads kur |
| Merchant ürünleri onaylı ama performans yok | Feed title/image/price rekabeti | PMax product group raporu | Feed SEO ve custom label segmentasyonu yap |

### Uygulanacak ajans standardı

1. Her müşteri için measurement audit yapılmadan kampanya ölçeklenmez.
2. Primary conversion action listesi yazılı onaylanır.
3. Search terms ve negatif keyword yönetimi haftalık minimum SOP olur.
4. Merchant Center varsa feed sağlık skoru haftalık kontrol edilir.
5. PMax için asset group, listing group ve search term insight raporu aylık stratejiye bağlanır.
6. Demand Gen ve Video için kreatif test takvimi olmadan bütçe artırılmaz.
7. Her büyük değişiklik için beklenen etki ve rollback kriteri yazılır.
8. Raporlar metrik değil karar üretir.

### 21-28. Tekrarlanan kampanya/protokol/raporlama bölümleri

> Not: İleri Seviye dokümanının 21-28 numaralı bölümleri (Kampanya bazlı kurulum reçeteleri, Search detay protokolü, PMax detay protokolü, Demand Gen detay protokolü, Merchant Center ve feed mühendisliği, Lead generation kalite mimarisi, Bütçe ve öğrenme matematiği, Raporlama ve karar şablonu) Temel/Orta Seviye dokümanındaki 21-28 bölümleriyle birebir aynı içeriktedir. Tekrarı önlemek için tam metin yukarıdaki [Bölüm: Temel / Orta Seviye](#bölüm-temel--orta-seviye) altında yer alır:
>
> - [21. Kampanya bazlı kurulum reçeteleri](#21-kampanya-bazlı-kurulum-reçeteleri)
> - [22. Search detay protokolü](#22-search-detay-protokolü)
> - [23. PMax detay protokolü](#23-pmax-detay-protokolü)
> - [24. Demand Gen detay protokolü](#24-demand-gen-detay-protokolü)
> - [25. Merchant Center ve feed mühendisliği](#25-merchant-center-ve-feed-mühendisliği)
> - [26. Lead generation kalite mimarisi](#26-lead-generation-kalite-mimarisi)
> - [27. Bütçe ve öğrenme matematiği](#27-bütçe-ve-öğrenme-matematiği)
> - [28. Raporlama ve karar şablonu](#28-raporlama-ve-karar-şablonu)

### 29. 90 günlük hesap geliştirme yol haritası (İleri Seviye)

| Dönem | Ana iş | Beklenen çıktı |
|---|---|---|
| Gün 1-7 | Measurement audit, conversion action temizliği, GTM/GA4/Google Ads kontrol | Güvenilir sinyal altyapısı |
| Gün 8-14 | Search/PMax temel yapı, feed ve landing kontrolü | İlk stabil kampanya mimarisi |
| Gün 15-30 | Search terms, negatifler, kreatif/asset testleri, CRM lead kalite kontrolü | Erken optimizasyon |
| Gün 31-45 | Bidding geçişleri, tCPA/tROAS değerlendirme, asset group revizyonu | Daha kontrollü maliyet/değer |
| Gün 46-60 | Demand Gen/remarketing/video destek katmanı | Talep ve yeniden pazarlama büyümesi |
| Gün 61-90 | Offline conversions, value rules, feed segmentasyonu, ölçekleme | Mühendislik düzeyinde büyüme sistemi |

### 30. Nihai mühendislik kontrol listesi (İleri Seviye)

> Not: Orijinal dokümanda bu liste 9. maddeden başlar ve 20. maddede biter; numaralandırma kaynak PDF'teki haliyle korunmuştur.

9. Primary conversion action ticari değeri temsil ediyor mu?
10. Enhanced Conversions aktif ve diagnostics temiz mi?
11. Lead işletmesinde CRM kalite sonucu Google Ads tarafına dönüyor mu?
12. Search kampanyalarında search terms ve negatifler haftalık yönetiliyor mu?
13. Broad match sadece temiz sinyalle ve Smart Bidding ile mi kullanılıyor?
14. PMax asset groups iş mantığına göre mi ayrıldı?
15. Merchant feed title, image, price, availability ve custom labels optimize mi?
16. Demand Gen/Video kreatifleri mobile-first ve ilk 5 saniye güçlü mü?
17. Landing sayfaları reklam vaadiyle birebir uyumlu mu?
18. Bütçe ve hedef CPA/ROAS öğrenme için gerçekçi mi?
19. Raporlama sadece metrik değil karar üretiyor mu?
20. Her değişiklik için not, gerekçe, beklenen etki ve kontrol tarihi var mı?

---

## Kaynakça

> **Google Ads 2026 Resmi Kaynak Listesi** — Kullanılan ana Google dokümanları
> Hazırlanma tarihi: 19 Mayıs 2026 | Kaynak tipi: Resmi Google Ads Help, Google Ads API, Google Skillshop/Best Practices dokümanları.

1. Choose the right campaign type: https://support.google.com/google-ads/answer/2567043?hl=en
2. About campaign objectives in Google Ads: https://support.google.com/google-ads/answer/7450050?hl=en
3. About Performance Max campaigns: https://support.google.com/google-ads/answer/10724817?hl=en
4. About Demand Gen campaigns: https://support.google.com/google-ads/answer/13695777?hl=en
5. Demand Gen creative specifications: https://support.google.com/google-ads/answer/13704860?hl=en
6. About Smart Bidding: https://support.google.com/google-ads/answer/7065882?hl=en
7. About conversion measurement: https://support.google.com/google-ads/answer/1722022?hl=en
8. About enhanced conversions: https://support.google.com/google-ads/answer/9888656?hl=en
9. Enhanced conversions 2026 settings update: https://support.google.com/google-ads/answer/16884284?hl=en
10. Set up enhanced conversions for web with Google tag: https://support.google.com/google-ads/answer/13258081?hl=en
11. Google Ads API conversions overview: https://developers.google.com/google-ads/api
12. Manage offline conversions - Google Ads API: https://developers.google.com/google-ads/api/docs/conversions/upload-offline
13. Manage online click conversions - Google Ads API: https://developers.google.com/google-ads/api/docs/conversions/upload-online
14. Import call conversions - Google Ads API: https://developers.google.com/google-ads/api/docs/conversions/upload-calls
15. About responsive search ads: https://support.google.com/google-ads/answer/7684791?hl=en
16. Your guide to responsive search ads: https://support.google.com/google-ads/answer/12159142?hl=en
17. About keyword matching options: https://support.google.com/google-ads/answer/7478529?hl=en
18. Optimize Google Ads with AI Max for Search campaigns: https://support.google.com/google-ads/answer/15913066?hl=en
19. About responsive display ads: https://support.google.com/google-ads/answer/6363750?hl=en
20. About Display ads and the Google Display Network: https://support.google.com/google-ads/answer/2404190?hl=en
21. Optimize Display campaigns: https://support.google.com/google-ads/answer/6382966?hl=en
22. About Shopping ads: https://support.google.com/google-ads/answer/2454022?hl=en
23. Shopping ads requirements: https://support.google.com/google-ads/answer/6275312?hl=en
24. Use custom labels for Shopping ads: https://support.google.com/google-ads/answer/6275295?hl=en
25. Create a video campaign: https://support.google.com/google-ads/answer/2375497?hl=en-gb
26. About video ad formats: https://support.google.com/google-ads/answer/2375464?hl=en
27. About Video campaign objectives: https://support.google.com/google-ads/answer/10197127?hl=en
28. Google Ads specs: ad formats, sizes, best practices: https://support.google.com/google-ads/answer/13676244?hl=en
29. Google Ads Best Practices hub: https://support.google.com/google-ads/answer/6154846?hl=en
