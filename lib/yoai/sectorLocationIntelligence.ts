/* ──────────────────────────────────────────────────────────
   YoAi — Sector + Location Intelligence

   Kullanıcının seçtiği sektör (ana + alt) ve hedef lokasyon
   üzerinden deterministik iş bağlamı çıkarır:
     • sektör ne iş yapar
     • temel müşteri ihtiyaçları
     • hedef kitle tipleri
     • satın alma motivasyonları
     • lokasyona göre müşteri beklentileri
     • Google kampanya tipi önerileri
     • Meta objective önerileri
     • reklam vaatleri
     • riskli/yasak iddialar
     • yerel pazarlama açıları
     • anahtar kelime temaları

   Hiçbir sahte web research yapılmaz. Dış sağlayıcı yoksa
   research_source = 'internal_inference' ile imzalanır.
   ────────────────────────────────────────────────────────── */

import { getSectorMain } from './sectorCatalog'

export interface SectorLocationInsight {
  sector_main_id: string
  sector_main_label: string
  sector_sub_id: string | null
  sector_sub_label: string | null
  target_locations: string[]

  sector_summary: string
  customer_needs: string[]
  audience_types: string[]
  purchase_motivations: string[]
  location_expectations: string

  recommended_google_campaign_types: string[]
  recommended_meta_objectives: string[]
  ad_promises: string[]
  risk_claims: string[]
  local_angles: string[]
  keyword_themes: string[]

  research_source: 'internal_inference' | 'external_research'
  confidence: number
  generated_at: string
}

/* ── Sector-level deterministic profiles ──────────────────── */

interface SectorProfile {
  summary: string
  customer_needs: string[]
  audience_types: string[]
  purchase_motivations: string[]
  google_campaign_types: string[]
  meta_objectives: string[]
  ad_promises: string[]
  risk_claims: string[]
  keyword_themes: string[]
}

const SECTOR_PROFILES: Record<string, SectorProfile> = {
  saglik_medikal: {
    summary: 'Sağlık ve medikal hizmetler — randevu, tedavi, danışmanlık. Güven ve uzmanlık odaklı.',
    customer_needs: ['Güvenilir uzman', 'Yakın lokasyon', 'Şeffaf fiyat', 'Hızlı randevu', 'Hasta yorumları'],
    audience_types: ['25-55 yaş kadın/erkek', 'Sağlık sorunu yaşayan', 'Estetik talep eden', 'Aile yöneticisi'],
    purchase_motivations: ['Sağlık problemi çözümü', 'Estetik kaygı', 'Rutin kontrol', 'Çocuk sağlığı'],
    google_campaign_types: ['Search', 'Performance Max', 'Display Remarketing'],
    meta_objectives: ['OUTCOME_LEADS', 'OUTCOME_ENGAGEMENT', 'OUTCOME_TRAFFIC'],
    ad_promises: ['Uzman doktor kadrosu', 'Modern teknoloji', 'Hızlı randevu', 'Konfor ve mahremiyet'],
    risk_claims: ['Garanti verme', 'Mucizevi sonuç vaadi', 'Onaysız tıbbi iddia', 'Önce/sonra fotoğraf kuralı', 'Yan etki gizleme'],
    keyword_themes: ['doktor', 'klinik', 'randevu', 'tedavi', 'fiyat', 'merkez', 'uzman', 'muayene'],
  },
  guzellik_wellness: {
    summary: 'Güzellik, kişisel bakım ve wellness — randevu bazlı yerinde hizmet veya ürün satışı.',
    customer_needs: ['Hijyen', 'Uzman personel', 'Sonuç odaklı paket', 'Esnek randevu', 'Sosyal kanıt'],
    audience_types: ['18-45 yaş kadın', '25-50 yaş erkek (berber/cilt)', 'Düğün/etkinlik öncesi'],
    purchase_motivations: ['Görünüm iyileştirme', 'Özel gün hazırlığı', 'Rutin bakım', 'Stres rahatlama'],
    google_campaign_types: ['Search', 'Performance Max', 'Local'],
    meta_objectives: ['OUTCOME_LEADS', 'OUTCOME_ENGAGEMENT', 'OUTCOME_TRAFFIC'],
    ad_promises: ['Profesyonel bakım', 'Hızlı sonuç', 'İlk seans indirimi', 'Lokasyon avantajı'],
    risk_claims: ['Mucize sonuç', 'Önce/sonra abartılı kıyaslama', 'Kalıcı sonuç garantisi'],
    keyword_themes: ['güzellik merkezi', 'cilt bakımı', 'lazer epilasyon', 'masaj', 'fiyat', 'randevu'],
  },
  yeme_icme: {
    summary: 'Yeme-içme — restoran, cafe, fast food, paket servis. Lokasyon, menü ve atmosfer kritik.',
    customer_needs: ['Yakın lokasyon', 'Menü çeşitliliği', 'Hijyen', 'Hızlı servis', 'Atmosfer', 'Online sipariş'],
    audience_types: ['18-45 yaş şehirli', 'Aile yöneticisi', 'Çalışan / öğle yemeği', 'Etkinlik organizatörü'],
    purchase_motivations: ['Açlık', 'Sosyalleşme', 'Özel gün', 'İş yemeği', 'Rahatlık'],
    google_campaign_types: ['Local', 'Performance Max', 'Search'],
    meta_objectives: ['OUTCOME_TRAFFIC', 'OUTCOME_ENGAGEMENT', 'OUTCOME_AWARENESS'],
    ad_promises: ['Taze malzeme', 'Hızlı paket servis', 'Açılışa özel', 'Lezzet sözü'],
    risk_claims: ['Sağlık iddiası (zayıflatır vb.)', 'Organik/doğal iddiasının belgesiz kullanımı'],
    keyword_themes: ['restoran', 'menü', 'paket servis', 'fiyat', 'rezervasyon', 'mekan', 'yemek'],
  },
  konaklama_turizm: {
    summary: 'Konaklama ve turizm — otel, tur, transfer, kiralama. Sezonsal ve konum bağımlı.',
    customer_needs: ['Doğru tarih ve fiyat', 'Şeffaf iptal', 'Konum/manzara', 'Ulaşım', 'Yorumlar'],
    audience_types: ['Aile tatilcisi', 'Çift / balayı', 'Genç gezgin', 'İş seyahati'],
    purchase_motivations: ['Tatil', 'Etkinlik', 'İş', 'Romantik kaçamak', 'Düğün/balayı'],
    google_campaign_types: ['Performance Max', 'Search', 'Display Remarketing'],
    meta_objectives: ['OUTCOME_LEADS', 'OUTCOME_TRAFFIC', 'OUTCOME_ENGAGEMENT'],
    ad_promises: ['Erken rezervasyon indirimi', 'Manzaralı oda', 'Ücretsiz transfer', 'Fiyat garantisi'],
    risk_claims: ['Yıldız sayısı yanıltıcı kullanımı', 'Stok yokken indirim göstermek', 'Ulaşılamaz kampanya'],
    keyword_themes: ['otel', 'rezervasyon', 'tatil', 'paket', 'fiyat', 'tur', 'erken rezervasyon'],
  },
  perakende_eticaret: {
    summary: 'Perakende ve e-ticaret — ürün satışı online + fiziksel mağaza. Katalog, fiyat, lojistik.',
    customer_needs: ['Doğru fiyat', 'Hızlı kargo', 'Kolay iade', 'Stok bilgisi', 'Beden/ürün doğruluğu'],
    audience_types: ['Online alışveriş yapanlar', 'Hediye arayan', 'Kampanya avcısı', 'Marka takipçisi'],
    purchase_motivations: ['İhtiyaç', 'Hediye', 'İndirim', 'Sezon değişimi', 'Yenileme'],
    google_campaign_types: ['Performance Max', 'Shopping', 'Search', 'Display Remarketing'],
    meta_objectives: ['OUTCOME_SALES', 'OUTCOME_TRAFFIC', 'OUTCOME_ENGAGEMENT'],
    ad_promises: ['Ücretsiz kargo', 'Aynı gün teslim', 'Kolay iade', 'Sepete özel'],
    risk_claims: ['Sahte indirim', 'Mevcut olmayan ürün', 'Yorum manipülasyonu'],
    keyword_themes: ['ürün adı', 'fiyat', 'sipariş', 'kargo', 'indirim', 'kampanya', 'satın al'],
  },
  otomotiv_mobilite: {
    summary: 'Otomotiv ve mobilite — araç satışı, servis, lastik, kiralama. Yüksek hacimli karar.',
    customer_needs: ['Şeffaf ekspertiz', 'Doğru fiyat', 'Garanti/servis', 'Test sürüşü', 'Finansman'],
    audience_types: ['25-55 yaş erkek', 'Filo yöneticisi', 'Aile araç alıcısı', 'Genç sürücü'],
    purchase_motivations: ['Araç değişimi', 'Bakım', 'Hasar onarımı', 'Lastik mevsimi', 'Filo yenileme'],
    google_campaign_types: ['Search', 'Performance Max', 'Display Remarketing'],
    meta_objectives: ['OUTCOME_LEADS', 'OUTCOME_TRAFFIC'],
    ad_promises: ['Garantili ekspertiz', 'Kampanya araç', 'Hızlı servis', 'Uygun finansman'],
    risk_claims: ['Hasarlı araç gizleme', 'Belgesiz servis garantisi', 'Yıllık fiyat sabitleme abartısı'],
    keyword_themes: ['oto servis', 'satılık araç', 'lastik', 'kiralama', 'ikinci el', 'fiyat'],
  },
  insaat_emlak_mimarlik: {
    summary: 'İnşaat, emlak, mimarlık — uzun karar süreci, yüksek tutar, danışmanlık ağırlıklı.',
    customer_needs: ['Konum bilgisi', 'Proje detayı', 'Fiyat şeffaflığı', 'Teslim tarihi', 'Referans projeler'],
    audience_types: ['Yatırımcı', 'Aile alıcı', 'Yurtdışı vatandaş', 'İlk ev sahibi'],
    purchase_motivations: ['Yatırım getirisi', 'Konut ihtiyacı', 'Vatandaşlık', 'Kira getirisi'],
    google_campaign_types: ['Search', 'Performance Max', 'Display Remarketing'],
    meta_objectives: ['OUTCOME_LEADS', 'OUTCOME_TRAFFIC'],
    ad_promises: ['Erken yatırım fırsatı', 'Şeffaf fiyat', 'Garantili teslim', 'Lokasyon avantajı'],
    risk_claims: ['Onaysız ruhsat iddiası', 'Tahmini değer artışı garantisi', 'Tapu durumu yanıltma'],
    keyword_themes: ['proje', 'satılık daire', 'kiralık', 'müteahhit', 'mimari', 'emlak', 'fiyat'],
  },
  ev_isyeri_hizmetleri: {
    summary: 'Ev ve iş yeri hizmetleri — temizlik, tesisat, taşıma, güvenlik. Yerel ve aciliyet ağırlıklı.',
    customer_needs: ['Yakın lokasyon', 'Hızlı geri dönüş', 'Şeffaf fiyat', 'Sigorta', 'Personel güveni'],
    audience_types: ['Ev sahibi', 'Site yöneticisi', 'Ofis yöneticisi', 'Esnaf'],
    purchase_motivations: ['Aciliyet', 'Rutin bakım', 'Taşınma', 'Güvenlik ihtiyacı'],
    google_campaign_types: ['Local', 'Search', 'Performance Max'],
    meta_objectives: ['OUTCOME_LEADS', 'OUTCOME_TRAFFIC'],
    ad_promises: ['7/24 hizmet', 'Şeffaf fiyat', 'Sigortalı ekip', 'Aynı gün servis'],
    risk_claims: ['Belgesiz teknisyen', 'Sigortasız ekip', 'Sözlü garanti'],
    keyword_themes: ['nakliyat', 'temizlik', 'tesisat', 'servis', 'fiyat', 'çağırma', 'yakın'],
  },
  egitim: {
    summary: 'Eğitim — okul, kurs, sertifika, online eğitim. Uzun karar süreci, ailenin de etkilediği.',
    customer_needs: ['Müfredat detayı', 'Eğitmen kadrosu', 'Başarı oranı', 'Fiyat / taksit', 'Lokasyon'],
    audience_types: ['Veli', 'Öğrenci', 'Çalışan / kariyer arayan', 'Yetişkin öğrenen'],
    purchase_motivations: ['Sınav başarısı', 'Kariyer geçişi', 'Sertifika ihtiyacı', 'Kişisel gelişim'],
    google_campaign_types: ['Search', 'Performance Max', 'Display Remarketing'],
    meta_objectives: ['OUTCOME_LEADS', 'OUTCOME_TRAFFIC', 'OUTCOME_ENGAGEMENT'],
    ad_promises: ['Garantili sertifika', 'Erken kayıt indirimi', 'Online + yüz yüze', 'Burs imkanı'],
    risk_claims: ['Sınav başarı garantisi', 'İş garantisi', 'Onaysız akreditasyon iddiası'],
    keyword_themes: ['kurs', 'eğitim', 'sertifika', 'kayıt', 'ders', 'fiyat', 'online'],
  },
  finans_sigorta_hukuk_danismanlik: {
    summary: 'Finans, sigorta, hukuk, danışmanlık — uzmanlık ve güven ağırlıklı, regülasyon odaklı.',
    customer_needs: ['Uzman danışman', 'Şeffaf fiyat', 'Hızlı dönüş', 'Gizlilik', 'Lokasyon yakınlığı'],
    audience_types: ['Esnaf / KOBİ sahibi', 'Bireysel danışan', 'Yatırımcı', 'Sigorta sahibi'],
    purchase_motivations: ['Vergi yükümlülüğü', 'Hukuki sorun', 'Yatırım kararı', 'Sigorta yenileme'],
    google_campaign_types: ['Search', 'Performance Max', 'Display Remarketing'],
    meta_objectives: ['OUTCOME_LEADS', 'OUTCOME_TRAFFIC'],
    ad_promises: ['Ücretsiz ön görüşme', 'Şeffaf fiyat', 'Hızlı dönüş', 'Gizlilik'],
    risk_claims: ['Garanti dava kazanma', 'Garanti getiri vaadi', 'Müşteri teminatı yanıltma'],
    keyword_themes: ['danışmanlık', 'sigorta', 'avukat', 'muhasebe', 'fiyat', 'teklif'],
  },
  teknoloji_dijital: {
    summary: 'Teknoloji ve dijital — yazılım, SaaS, dijital ajans. Karşılaştırma + demo + denemek odaklı.',
    customer_needs: ['Ücretsiz deneme', 'Demo', 'Fiyat şeffaflığı', 'Entegrasyon', 'Destek kalitesi'],
    audience_types: ['Startup kurucu', 'KOBİ sahibi', 'CTO / IT yöneticisi', 'Pazarlama yöneticisi'],
    purchase_motivations: ['Verimlilik', 'Otomasyon', 'Maliyet düşürme', 'Yeni teknoloji'],
    google_campaign_types: ['Search', 'Performance Max', 'Display Remarketing'],
    meta_objectives: ['OUTCOME_LEADS', 'OUTCOME_TRAFFIC', 'OUTCOME_AWARENESS'],
    ad_promises: ['Ücretsiz deneme', 'Hızlı kurulum', 'Şeffaf fiyat', '7/24 destek'],
    risk_claims: ['Yanlış uptime iddiası', 'Performans garantisi', 'Belgesiz sertifika iddiası'],
    keyword_themes: ['yazılım', 'platform', 'demo', 'fiyat', 'ücretsiz dene', 'entegrasyon'],
  },
  medya_organizasyon_eglence_spor: {
    summary: 'Medya, organizasyon, eğlence, spor — etkinlik bazlı, sezonsal, yüksek görsel ağırlık.',
    customer_needs: ['Tarih/uygunluk', 'Referans iş', 'Şeffaf fiyat', 'Esnek paket'],
    audience_types: ['Çift / aile', 'Şirket organizasyon yöneticisi', 'Genç hayran kitlesi'],
    purchase_motivations: ['Özel gün', 'Şirket etkinliği', 'Eğlence', 'Spor üyeliği'],
    google_campaign_types: ['Search', 'Performance Max', 'Display'],
    meta_objectives: ['OUTCOME_LEADS', 'OUTCOME_ENGAGEMENT', 'OUTCOME_AWARENESS'],
    ad_promises: ['Erken rezervasyon', 'Yaratıcı konsept', 'Tam profesyonel ekip', 'Sınırsız çekim'],
    risk_claims: ['Çıkmamış imza/sözleşme garantisi', 'Sahte referans iş'],
    keyword_themes: ['organizasyon', 'düğün', 'fotoğraf', 'spor salonu', 'etkinlik', 'fiyat'],
  },
  uretim_sanayi: {
    summary: 'Üretim ve sanayi — B2B ağırlıklı, uzun satış döngüsü, MOQ ve ihracat odaklı.',
    customer_needs: ['Numune', 'MOQ', 'Sertifika', 'Teslim süresi', 'Fiyat skala'],
    audience_types: ['Toptancı', 'İhracatçı', 'Üretim alıcısı', 'Tedarik zinciri yöneticisi'],
    purchase_motivations: ['Hammadde temini', 'OEM üretim', 'İhracat', 'Maliyet düşürme'],
    google_campaign_types: ['Search', 'Performance Max'],
    meta_objectives: ['OUTCOME_LEADS', 'OUTCOME_TRAFFIC'],
    ad_promises: ['Sertifikalı üretim', 'Uygun MOQ', 'Hızlı numune', 'Esnek üretim'],
    risk_claims: ['Sertifika gizleme', 'Kapasite yanıltma', 'Teslim süresi şişirme'],
    keyword_themes: ['üretim', 'imalat', 'OEM', 'tedarik', 'sertifika', 'fiyat', 'fabrika'],
  },
  tarim_hayvancilik_gida: {
    summary: 'Tarım, hayvancılık, gıda tedarik zinciri — sezonsal, yerel, B2B + B2C karışık.',
    customer_needs: ['Tazelik', 'Sertifika', 'Tedarik sürekliliği', 'Fiyat', 'Soğuk zincir'],
    audience_types: ['Toptancı', 'Restoran sahibi', 'Bireysel tüketici', 'İhracatçı'],
    purchase_motivations: ['Gıda tedariki', 'Organik talep', 'Sezon ürünü', 'İhracat'],
    google_campaign_types: ['Search', 'Performance Max', 'Local'],
    meta_objectives: ['OUTCOME_TRAFFIC', 'OUTCOME_LEADS', 'OUTCOME_SALES'],
    ad_promises: ['Bahçeden masaya', 'Sertifikalı organik', 'Soğuk zincir teslim', 'Toplu sipariş indirimi'],
    risk_claims: ['Belgesiz organik iddiası', 'Sahte coğrafi işaret', 'Tedarik garantisi yanıltma'],
    keyword_themes: ['organik', 'doğal', 'üretici', 'toptan', 'sertifikalı', 'fiyat', 'tedarik'],
  },
  enerji_cevre: {
    summary: 'Enerji ve çevre — güneş enerjisi, ısı pompası, geri dönüşüm. Yatırım geri dönüşü ağırlıklı.',
    customer_needs: ['Yatırım geri dönüşü', 'Sertifika', 'Devlet desteği', 'Garanti', 'Bakım'],
    audience_types: ['Konut sahibi', 'Çiftçi', 'Sanayici', 'Belediye yöneticisi'],
    purchase_motivations: ['Faturayı düşürme', 'Devlet teşviki', 'Yeşil yatırım', 'Atık yönetimi'],
    google_campaign_types: ['Search', 'Performance Max', 'Display Remarketing'],
    meta_objectives: ['OUTCOME_LEADS', 'OUTCOME_TRAFFIC'],
    ad_promises: ['Devlet teşvik desteği', '10 yıl garanti', 'Hızlı geri dönüş', 'Anahtar teslim'],
    risk_claims: ['Yanlış geri dönüş süresi', 'Sertifika gizleme', 'Devlet teşvik vaadi yanıltma'],
    keyword_themes: ['güneş enerjisi', 'panel', 'ısı pompası', 'fiyat', 'teşvik', 'kurulum'],
  },
  lojistik_ticaret: {
    summary: 'Lojistik ve ticaret — kargo, nakliye, depolama, B2B toptan. Hız + güvenilirlik kritik.',
    customer_needs: ['Hız', 'Takip', 'Sigorta', 'Şeffaf fiyat', 'Kapsama'],
    audience_types: ['E-ticaret operatörü', 'KOBİ', 'Tedarik yöneticisi'],
    purchase_motivations: ['Hızlı teslim', 'İhracat', 'Toplu nakliye', 'Depolama ihtiyacı'],
    google_campaign_types: ['Search', 'Performance Max'],
    meta_objectives: ['OUTCOME_LEADS', 'OUTCOME_TRAFFIC'],
    ad_promises: ['Aynı gün kargo', 'Sigortalı taşıma', 'Şeffaf takip', 'Esnek depolama'],
    risk_claims: ['Sigorta yanıltma', 'Teslim süresi vaadi', 'Kapsama dışı bölge gizleme'],
    keyword_themes: ['kargo', 'nakliye', 'taşımacılık', 'depolama', 'fiyat', 'kurye'],
  },
  ik_hizmet_isletmeleri: {
    summary: 'İnsan kaynağı ve hizmet işletmeleri — istihdam, güvenlik, temizlik, tercüme. B2B + B2C.',
    customer_needs: ['Aday kalitesi', 'Hız', 'Sözleşme şartları', 'Sigorta', 'Referans'],
    audience_types: ['İnsan kaynakları yöneticisi', 'KOBİ sahibi', 'Bireysel danışan'],
    purchase_motivations: ['İstihdam', 'Güvenlik', 'Tercüme', 'Bakım hizmeti'],
    google_campaign_types: ['Search', 'Performance Max'],
    meta_objectives: ['OUTCOME_LEADS', 'OUTCOME_TRAFFIC'],
    ad_promises: ['Sertifikalı personel', 'Hızlı eşleştirme', 'Referans portföy'],
    risk_claims: ['Sertifika gizleme', 'Sigortasız personel', 'Sözleşme dışı vaatler'],
    keyword_themes: ['ik', 'eleman', 'güvenlik', 'temizlik', 'tercüme', 'fiyat', 'firma'],
  },
  kamu_stk_meslek: {
    summary: 'Kamu, STK, meslek kuruluşları — bilgilendirme, üyelik, kampanya. Reklam değil iletişim ağırlıklı.',
    customer_needs: ['Şeffaflık', 'Bilgi netliği', 'Üyelik avantajları', 'Etkinlik takvimi'],
    audience_types: ['Genel halk', 'Üye / aday üye', 'Bağışçı', 'Gönüllü'],
    purchase_motivations: ['Bilgi alma', 'Üyelik', 'Bağış', 'Gönüllülük'],
    google_campaign_types: ['Search', 'Display'],
    meta_objectives: ['OUTCOME_AWARENESS', 'OUTCOME_TRAFFIC', 'OUTCOME_ENGAGEMENT'],
    ad_promises: ['Şeffaf bilgi', 'Üyelik avantajı', 'Etkinlik daveti'],
    risk_claims: ['Yanıltıcı kampanya verisi', 'Onaysız bağış kullanımı vaadi'],
    keyword_themes: ['dernek', 'üyelik', 'bağış', 'etkinlik', 'duyuru'],
  },
}

const DEFAULT_PROFILE: SectorProfile = {
  summary: 'Genel iş kolu — segmentlere ve hedef kitleye göre özelleştirme yapılmalı.',
  customer_needs: ['Şeffaf fiyat', 'Hızlı geri dönüş', 'Güvenilirlik'],
  audience_types: ['Hedef kitle profili profilden çıkarılacak'],
  purchase_motivations: ['İhtiyaç', 'Teklif değerlendirme'],
  google_campaign_types: ['Search', 'Performance Max'],
  meta_objectives: ['OUTCOME_LEADS', 'OUTCOME_TRAFFIC'],
  ad_promises: ['Profesyonel hizmet', 'Şeffaf fiyat'],
  risk_claims: ['Onaysız iddialar', 'Garanti vaadi'],
  keyword_themes: ['hizmet', 'fiyat', 'firma', 'iletişim'],
}

/* ── Location intelligence ────────────────────────────────── */

const LOCATION_NOTES: Record<string, string> = {
  istanbul: 'Yoğun rekabet, yüksek CPC. Mahalle/ilçe bazlı hedefleme avantaj sağlar.',
  ankara: 'Kamu yoğunluklu, B2B fırsatı yüksek. Bürokratik dil tercihi.',
  izmir: 'Modern tüketici, sahil ve turizm dönemi etkili.',
  bursa: 'Sanayi ve tekstil yoğunluklu, B2B ağırlıklı.',
  antalya: 'Turizm sezonu (Mayıs-Ekim) belirleyici. Yabancı dil opsiyonu önemli.',
  adana: 'Tarım ve gıda sanayi yoğunluklu. Sıcak iklim ürünleri öne çıkar.',
  konya: 'Muhafazakar tüketici, yerel marka güveni yüksek. Otomotiv yan sanayi güçlü.',
  gaziantep: 'Yeme-içme ve gıda sanayi öne çıkar. İhracat odaklı B2B.',
  mersin: 'Liman ve lojistik. Tarım ihracatı.',
  kayseri: 'Sanayi ve mobilya. KOBİ yoğunluğu.',
  eskisehir: 'Üniversite şehri, genç tüketici.',
  diyarbakir: 'Bölgesel ticaret merkezi, geleneksel tüketici.',
  trabzon: 'Yerel turizm + tarım + balıkçılık.',
  samsun: 'Karadeniz ticaret merkezi, lojistik.',
  malatya: 'Tarım ürünleri (kayısı), yerel ticaret.',
  kocaeli: 'Sanayi yoğun, otomotiv ve kimya. B2B.',
  denizli: 'Tekstil ve mermer ihracatı.',
  sanliurfa: 'Tarım, gıda, geleneksel ticaret.',
  hatay: 'Lojistik, gıda, gastronomi.',
}

function locationKey(loc: string): string {
  return loc
    .toLocaleLowerCase('tr-TR')
    .replace(/[ıİ]/g, 'i')
    .replace(/[şŞ]/g, 's')
    .replace(/[ğĞ]/g, 'g')
    .replace(/[üÜ]/g, 'u')
    .replace(/[öÖ]/g, 'o')
    .replace(/[çÇ]/g, 'c')
    .replace(/\s+/g, '')
    .trim()
}

function buildLocationExpectations(locations: string[]): string {
  if (!locations || locations.length === 0) {
    return 'Hedef lokasyon belirtilmedi — Türkiye geneli varsayıldı.'
  }
  const lines: string[] = []
  for (const loc of locations.slice(0, 5)) {
    const key = locationKey(loc)
    const note = LOCATION_NOTES[key]
    if (note) lines.push(`${loc}: ${note}`)
    else lines.push(`${loc}: yerel arama hacmi ve mahalle bazlı hedefleme önerilir.`)
  }
  return lines.join(' ')
}

function buildLocalAngles(locations: string[]): string[] {
  if (!locations || locations.length === 0) return ['Türkiye geneli hizmet']
  const out: string[] = []
  for (const loc of locations.slice(0, 3)) {
    out.push(`${loc} bölgesi yerel hizmet`)
    out.push(`${loc} müşterilerine özel kampanya`)
  }
  return out
}

/* ── Confidence scoring ────────────────────────────────────── */

function computeConfidence(
  hasMain: boolean,
  hasSub: boolean,
  hasLocations: boolean,
  knownLocationCount: number,
): number {
  let conf = 25
  if (hasMain) conf += 30
  if (hasSub) conf += 20
  if (hasLocations) conf += 15
  if (knownLocationCount > 0) conf += 10
  return Math.min(100, conf)
}

/* ── Public API ───────────────────────────────────────────── */

export interface SectorLocationInput {
  sector_main_id?: string | null
  sector_sub_id?: string | null
  target_locations?: string[]
}

export function buildSectorLocationInsight(input: SectorLocationInput): SectorLocationInsight {
  const mainId = (input.sector_main_id || '').trim()
  const subId = (input.sector_sub_id || '').trim() || null
  const locations = (input.target_locations || []).filter((l) => typeof l === 'string' && l.trim().length > 0)

  const main = mainId ? getSectorMain(mainId) : null
  const profile = (mainId && SECTOR_PROFILES[mainId]) || DEFAULT_PROFILE

  const subLabel = subId && main
    ? main.subs.find((s) => s.id === subId)?.label || null
    : null

  const knownCount = locations.filter((l) => Boolean(LOCATION_NOTES[locationKey(l)])).length
  const confidence = computeConfidence(!!main, !!subLabel, locations.length > 0, knownCount)

  return {
    sector_main_id: mainId || 'unknown',
    sector_main_label: main?.label || 'Belirtilmedi',
    sector_sub_id: subId,
    sector_sub_label: subLabel,
    target_locations: locations,
    sector_summary: profile.summary,
    customer_needs: profile.customer_needs,
    audience_types: profile.audience_types,
    purchase_motivations: profile.purchase_motivations,
    location_expectations: buildLocationExpectations(locations),
    recommended_google_campaign_types: profile.google_campaign_types,
    recommended_meta_objectives: profile.meta_objectives,
    ad_promises: profile.ad_promises,
    risk_claims: profile.risk_claims,
    local_angles: buildLocalAngles(locations),
    keyword_themes: profile.keyword_themes,
    research_source: 'internal_inference',
    confidence,
    generated_at: new Date().toISOString(),
  }
}
