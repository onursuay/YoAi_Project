/* ──────────────────────────────────────────────────────────
   YoAi — Türkiye Sektör Kataloğu

   Business Intelligence Profile onboarding'inde kullanılan ana
   sektör + alt sektör listesi. Kullanıcı ana sektörü seçince alt
   sektör dropdown'u dinamik olarak değişir; "uzmanlık / özel
   hizmet" alanı serbest metin olarak ayrıca toplanır.

   Kaynak: "TÜRKİYE'DEKİ SEKTÖRLER" referans listesi.
   ────────────────────────────────────────────────────────── */

export interface SectorSubItem {
  id: string
  label: string
}

export interface SectorMainItem {
  id: string
  label: string
  subs: SectorSubItem[]
}

export const SECTOR_CATALOG: SectorMainItem[] = [
  {
    id: 'saglik_medikal',
    label: 'Sağlık ve Medikal',
    subs: [
      { id: 'ozel_klinik', label: 'Özel Klinik / Muayenehane' },
      { id: 'dis_hekimligi', label: 'Diş Hekimliği' },
      { id: 'estetik_plastik_cerrahi', label: 'Estetik / Plastik Cerrahi' },
      { id: 'sac_ekimi', label: 'Saç Ekimi' },
      { id: 'gz_lazer', label: 'Göz / Lazer' },
      { id: 'fizik_tedavi', label: 'Fizik Tedavi / Rehabilitasyon' },
      { id: 'psikoloji_psikiyatri', label: 'Psikoloji / Psikiyatri' },
      { id: 'diyetisyen', label: 'Diyetisyen / Beslenme Danışmanı' },
      { id: 'tup_bebek_kadin_dogum', label: 'Tüp Bebek / Kadın Doğum' },
      { id: 'medikal_urun_satisi', label: 'Medikal Cihaz / Ürün Satışı' },
      { id: 'eczane', label: 'Eczane' },
      { id: 'laboratuar_goruntuleme', label: 'Laboratuvar / Görüntüleme' },
      { id: 'veteriner', label: 'Veteriner / Hayvan Sağlığı' },
      { id: 'evde_saglik', label: 'Evde Sağlık / Bakım' },
    ],
  },
  {
    id: 'guzellik_wellness',
    label: 'Güzellik, Kişisel Bakım, Wellness',
    subs: [
      { id: 'guzellik_merkezi', label: 'Güzellik Merkezi' },
      { id: 'cilt_bakim', label: 'Cilt Bakım Merkezi' },
      { id: 'lazer_epilasyon', label: 'Lazer Epilasyon' },
      { id: 'kuafor_berber', label: 'Kuaför / Berber' },
      { id: 'manikur_pedikur', label: 'Manikür / Pedikür / Tırnak' },
      { id: 'masaj_spa', label: 'Masaj / SPA / Hamam' },
      { id: 'kozmetik_satis', label: 'Kozmetik Ürün Satışı' },
      { id: 'kisisel_bakim_ecommerce', label: 'Kişisel Bakım E-Ticaret' },
      { id: 'wellness_yoga', label: 'Wellness / Yoga / Meditasyon' },
      { id: 'fitness_studio', label: 'Fitness Studio / Pilates' },
    ],
  },
  {
    id: 'yeme_icme',
    label: 'Yeme-İçme',
    subs: [
      { id: 'restoran', label: 'Restoran' },
      { id: 'cafe_brunch', label: 'Cafe / Brunch' },
      { id: 'fastfood', label: 'Fast Food' },
      { id: 'pastane_firin', label: 'Pastane / Fırın' },
      { id: 'kahveci', label: 'Kahveci / Specialty Coffee' },
      { id: 'bar_kokteyl', label: 'Bar / Kokteyl Mekanı' },
      { id: 'gece_kulubu', label: 'Gece Kulübü' },
      { id: 'catering', label: 'Catering / Yemek Tedariki' },
      { id: 'paket_servis', label: 'Paket Servis / Online Sipariş' },
      { id: 'cig_kofte_doner_kebap', label: 'Çiğ Köfte / Döner / Kebap' },
      { id: 'tatlici_dondurma', label: 'Tatlıcı / Dondurma' },
      { id: 'unlu_mamuller_satis', label: 'Unlu Mamuller Satışı' },
    ],
  },
  {
    id: 'konaklama_turizm',
    label: 'Konaklama ve Turizm',
    subs: [
      { id: 'otel_resort', label: 'Otel / Resort' },
      { id: 'butik_otel', label: 'Butik Otel' },
      { id: 'pansiyon', label: 'Pansiyon / Apart' },
      { id: 'villa_kiralama', label: 'Villa Kiralama / Tatil Evi' },
      { id: 'tur_operatoru', label: 'Tur Operatörü / Acente' },
      { id: 'transfer_arac_kiralama', label: 'Transfer / Araç Kiralama (Tatil)' },
      { id: 'rent_a_car', label: 'Rent a Car' },
      { id: 'yacht_tekne_charter', label: 'Yat / Tekne Kiralama' },
      { id: 'kamp_glamping', label: 'Kamp / Glamping' },
      { id: 'termal_spa_oteli', label: 'Termal / Spa Oteli' },
    ],
  },
  {
    id: 'perakende_eticaret',
    label: 'Perakende ve E-Ticaret',
    subs: [
      { id: 'genel_eticaret', label: 'Genel E-Ticaret' },
      { id: 'moda_giyim', label: 'Moda / Giyim' },
      { id: 'ayakkabi_canta', label: 'Ayakkabı / Çanta' },
      { id: 'aksesuar_taki', label: 'Aksesuar / Takı / Kuyumculuk' },
      { id: 'ev_dekor', label: 'Ev / Dekorasyon' },
      { id: 'mobilya', label: 'Mobilya' },
      { id: 'beyaz_esya_elektrikli', label: 'Beyaz Eşya / Elektrikli' },
      { id: 'elektronik_telefon', label: 'Elektronik / Telefon' },
      { id: 'oyuncak_hobi', label: 'Oyuncak / Hobi' },
      { id: 'pet_shop', label: 'Pet Shop / Evcil Hayvan' },
      { id: 'spor_outdoor', label: 'Spor / Outdoor Ürünler' },
      { id: 'kitap_kirtasiye', label: 'Kitap / Kırtasiye' },
      { id: 'sup_market_zincir', label: 'Süpermarket / Zincir Mağaza' },
      { id: 'butik_konsept_magaza', label: 'Butik / Konsept Mağaza' },
    ],
  },
  {
    id: 'otomotiv_mobilite',
    label: 'Otomotiv ve Mobilite',
    subs: [
      { id: 'oto_galeri_satis', label: 'Oto Galeri / İkinci El Satış' },
      { id: 'sifir_arac_bayii', label: 'Sıfır Araç Bayii' },
      { id: 'oto_servis_tamir', label: 'Oto Servis / Tamir' },
      { id: 'oto_lastik_jant', label: 'Lastik / Jant' },
      { id: 'oto_yikama_detailing', label: 'Oto Yıkama / Detailing' },
      { id: 'kaporta_boya', label: 'Kaporta / Boya' },
      { id: 'oto_ekipman', label: 'Oto Aksesuar / Ekipman' },
      { id: 'motosiklet_satis_servis', label: 'Motosiklet Satış / Servis' },
      { id: 'oto_ekspertiz', label: 'Oto Ekspertiz' },
      { id: 'arac_paylasim_filo', label: 'Araç Paylaşım / Filo' },
    ],
  },
  {
    id: 'insaat_emlak_mimarlik',
    label: 'İnşaat, Emlak, Mimarlık',
    subs: [
      { id: 'insaat_firmasi', label: 'İnşaat Firması / Müteahhit' },
      { id: 'emlak_ofis', label: 'Emlak Ofisi / Danışmanlığı' },
      { id: 'gayrimenkul_yatirim', label: 'Gayrimenkul Yatırım / Proje' },
      { id: 'mimarlik_burosu', label: 'Mimarlık Bürosu' },
      { id: 'ic_mimarlik_dekorasyon', label: 'İç Mimarlık / Dekorasyon' },
      { id: 'tadilat_renovasyon', label: 'Tadilat / Renovasyon' },
      { id: 'yapi_malzeme', label: 'Yapı Malzemeleri Satışı' },
      { id: 'peyzaj_bahce', label: 'Peyzaj / Bahçe Düzenleme' },
      { id: 'havuz_yapimi', label: 'Havuz Yapımı' },
      { id: 'cati_yalitim', label: 'Çatı / Yalıtım' },
    ],
  },
  {
    id: 'ev_isyeri_hizmetleri',
    label: 'Ev ve İş Yeri Hizmetleri',
    subs: [
      { id: 'temizlik_firmasi', label: 'Temizlik Firması (Ev / Ofis)' },
      { id: 'haserzat_ilaclama', label: 'İlaçlama / Haşere' },
      { id: 'klima_kombi_servis', label: 'Klima / Kombi Servisi' },
      { id: 'su_isi_yalitim', label: 'Su / Isı Tesisat' },
      { id: 'elektrik_tesisat', label: 'Elektrik Tesisatı' },
      { id: 'beyaz_esya_servisi', label: 'Beyaz Eşya Servisi' },
      { id: 'taşinma_evden_eve', label: 'Evden Eve Nakliyat' },
      { id: 'guvenlik_alarm_kamera', label: 'Güvenlik / Alarm / Kamera' },
      { id: 'cilingir_anahtar', label: 'Çilingir / Anahtarcı' },
      { id: 'mobilya_montaj', label: 'Mobilya Montaj / Demontaj' },
    ],
  },
  {
    id: 'egitim',
    label: 'Eğitim',
    subs: [
      { id: 'okul_oncesi_anaokulu', label: 'Okul Öncesi / Anaokulu' },
      { id: 'ozel_okul', label: 'Özel Okul (İlk-Orta-Lise)' },
      { id: 'dershane_kurs', label: 'Dershane / Sınav Kursu (LGS, YKS, KPSS)' },
      { id: 'yabanci_dil_kursu', label: 'Yabancı Dil Kursu' },
      { id: 'mesleki_egitim', label: 'Mesleki Eğitim / Sertifika' },
      { id: 'mesleki_belgelendirme', label: 'Mesleki Belgelendirme (MYK)' },
      { id: 'online_egitim_platformu', label: 'Online Eğitim Platformu' },
      { id: 'yazilim_kodlama_egitim', label: 'Yazılım / Kodlama Eğitimi' },
      { id: 'sanat_muzik_egitim', label: 'Sanat / Müzik Eğitimi' },
      { id: 'spor_egitim', label: 'Spor Eğitimi (Yüzme, Tenis, vb.)' },
      { id: 'koc_mentor', label: 'Koçluk / Mentörlük' },
      { id: 'universite_yuksekokul', label: 'Üniversite / Yüksekokul' },
      { id: 'surucu_kursu', label: 'Sürücü Kursu' },
    ],
  },
  {
    id: 'finans_sigorta_hukuk_danismanlik',
    label: 'Finans, Sigorta, Hukuk, Danışmanlık',
    subs: [
      { id: 'sigorta_acente', label: 'Sigorta Acentesi' },
      { id: 'finansal_danismanlik', label: 'Finansal Danışmanlık / Yatırım' },
      { id: 'kredi_finansman', label: 'Kredi / Finansman Aracılığı' },
      { id: 'serbest_muhasebeci', label: 'Serbest Muhasebeci / SMMM' },
      { id: 'avukat_hukuk_burosu', label: 'Avukat / Hukuk Bürosu' },
      { id: 'is_kurma_isletme_dan', label: 'İşletme / İş Kurma Danışmanlığı' },
      { id: 'ik_danismanlik', label: 'İK Danışmanlığı / İşe Alım' },
      { id: 'pazarlama_dijital_dan', label: 'Pazarlama / Dijital Danışmanlık' },
      { id: 'patent_marka_tescil', label: 'Patent / Marka Tescil' },
      { id: 'gocmenlik_vize', label: 'Göçmenlik / Vize Danışmanlık' },
      { id: 'bagimsiz_finansal_kuyumcu', label: 'Kuyumcu / Altın / Döviz' },
      { id: 'kripto_dijital_varlik', label: 'Kripto / Dijital Varlık Danışmanlığı' },
    ],
  },
  {
    id: 'teknoloji_dijital',
    label: 'Teknoloji ve Dijital',
    subs: [
      { id: 'yazilim_firmasi', label: 'Yazılım / Geliştirme Firması' },
      { id: 'saas_urun', label: 'SaaS Ürün' },
      { id: 'mobil_uygulama', label: 'Mobil Uygulama' },
      { id: 'web_tasarim_ajansi', label: 'Web Tasarım Ajansı' },
      { id: 'dijital_ajans', label: 'Dijital Reklam Ajansı' },
      { id: 'seo_ajansi', label: 'SEO / İçerik Ajansı' },
      { id: 'eticaret_altyapi', label: 'E-Ticaret Altyapı / Entegrasyon' },
      { id: 'siber_guvenlik', label: 'Siber Güvenlik' },
      { id: 'bulut_iaas_hosting', label: 'Bulut / Hosting / IaaS' },
      { id: 'ai_data_firmasi', label: 'AI / Data Firması' },
      { id: 'fintech', label: 'Fintech' },
      { id: 'edtech', label: 'EdTech' },
      { id: 'iot_gomulu_sistemler', label: 'IoT / Gömülü Sistemler' },
    ],
  },
  {
    id: 'medya_organizasyon_eglence_spor',
    label: 'Medya, Organizasyon, Eğlence, Spor',
    subs: [
      { id: 'organizasyon_etkinlik', label: 'Organizasyon / Etkinlik Şirketi' },
      { id: 'dugun_davet', label: 'Düğün / Davet Organizasyonu' },
      { id: 'fotograf_video', label: 'Fotoğraf / Video Prodüksiyon' },
      { id: 'reklam_film_yapim', label: 'Reklam Filmi / Yapım' },
      { id: 'matbaa_baski_serigrafi', label: 'Matbaa / Baskı / Serigrafi' },
      { id: 'gazete_yayinevi', label: 'Gazete / Yayınevi' },
      { id: 'sanat_galeri', label: 'Sanat Galerisi / Müze' },
      { id: 'tiyatro_konser_sahne', label: 'Tiyatro / Konser / Sahne' },
      { id: 'spor_kulubu_takim', label: 'Spor Kulübü / Takım' },
      { id: 'spor_salonu_gym', label: 'Spor Salonu / Gym' },
      { id: 'eglence_park', label: 'Eğlence / Tema Park' },
      { id: 'gaming_esports', label: 'Gaming / E-Sports' },
    ],
  },
  {
    id: 'uretim_sanayi',
    label: 'Üretim ve Sanayi',
    subs: [
      { id: 'tekstil_uretim', label: 'Tekstil / Konfeksiyon Üretimi' },
      { id: 'gida_uretim_tedarik', label: 'Gıda Üretim / Tedarik' },
      { id: 'metal_makine_imalat', label: 'Metal / Makine İmalatı' },
      { id: 'plastik_kimya_uretim', label: 'Plastik / Kimya Üretimi' },
      { id: 'mobilya_imalat', label: 'Mobilya İmalatı' },
      { id: 'ambalaj_paketleme', label: 'Ambalaj / Paketleme Üretimi' },
      { id: 'elektronik_imalat', label: 'Elektronik İmalatı' },
      { id: 'otomotiv_yan_sanayi', label: 'Otomotiv Yan Sanayi' },
      { id: 'insaat_malzeme_uretim', label: 'İnşaat Malzemesi Üretimi' },
      { id: 'cam_seramik', label: 'Cam / Seramik' },
      { id: 'kagit_karton', label: 'Kağıt / Karton Üretimi' },
    ],
  },
  {
    id: 'tarim_hayvancilik_gida',
    label: 'Tarım, Hayvancılık, Gıda Tedarik Zinciri',
    subs: [
      { id: 'cifci_tarim_uretim', label: 'Çiftçi / Tarım Üreticisi' },
      { id: 'sera_uretim', label: 'Sera / Sebze-Meyve' },
      { id: 'organik_dogal_urun', label: 'Organik / Doğal Ürün Satışı' },
      { id: 'hayvancilik', label: 'Hayvancılık (Süt-Et-Yumurta)' },
      { id: 'su_urunleri', label: 'Su Ürünleri / Balıkçılık' },
      { id: 'aricilik_bal', label: 'Arıcılık / Bal Üretimi' },
      { id: 'tarim_ekipman_satis', label: 'Tarım Ekipman / Tohum / Gübre' },
      { id: 'gida_toptan_dagitim', label: 'Gıda Toptan / Dağıtım' },
      { id: 'soguk_zincir_lojistik', label: 'Soğuk Zincir / Lojistik' },
    ],
  },
  {
    id: 'enerji_cevre',
    label: 'Enerji ve Çevre',
    subs: [
      { id: 'gunes_enerji_panel', label: 'Güneş Enerjisi / Panel' },
      { id: 'ruzgar_yenilenebilir', label: 'Rüzgar / Yenilenebilir Enerji' },
      { id: 'elektrik_isi_pompasi', label: 'Isı Pompası / Verimlilik' },
      { id: 'akilli_ev_otomasyon', label: 'Akıllı Ev / Otomasyon' },
      { id: 'atik_geri_donusum', label: 'Atık / Geri Dönüşüm' },
      { id: 'su_aritma_filtre', label: 'Su Arıtma / Filtre' },
      { id: 'cevre_danismanlik', label: 'Çevre Danışmanlığı / İSG' },
      { id: 'lpg_dogalgaz_ekipman', label: 'LPG / Doğalgaz Ekipman' },
    ],
  },
  {
    id: 'lojistik_ticaret',
    label: 'Lojistik ve Ticaret',
    subs: [
      { id: 'kargo_kurye', label: 'Kargo / Kurye' },
      { id: 'evden_eve_nakliyat', label: 'Evden Eve / Şehirler Arası Nakliyat' },
      { id: 'ulus_uluslararasi_tasimacilik', label: 'Uluslararası Taşımacılık' },
      { id: 'depolama_fulfillment', label: 'Depolama / Fulfillment' },
      { id: 'gumruk_dis_ticaret', label: 'Gümrük / Dış Ticaret' },
      { id: 'ihracat_ithalat', label: 'İhracat / İthalat' },
      { id: 'b2b_toptan_satis', label: 'B2B Toptan Satış' },
      { id: 'tedarik_zinciri_dan', label: 'Tedarik Zinciri Danışmanlığı' },
    ],
  },
  {
    id: 'ik_hizmet_isletmeleri',
    label: 'İnsan Kaynağı ve Hizmet İşletmeleri',
    subs: [
      { id: 'ozel_istihdam_burosu', label: 'Özel İstihdam Bürosu' },
      { id: 'eleman_aday_platformu', label: 'Eleman / Aday Platformu' },
      { id: 'yurtdisi_isgucu', label: 'Yurtdışı İşgücü / Vize' },
      { id: 'is_sagligi_guvenligi', label: 'İş Sağlığı ve Güvenliği' },
      { id: 'ozel_guvenlik_servisi', label: 'Özel Güvenlik Servisi' },
      { id: 'ofis_temizlik_zinciri', label: 'Ofis Temizlik Zinciri' },
      { id: 'tercume_dil_hizmetleri', label: 'Tercüme / Dil Hizmetleri' },
      { id: 'cocuk_bakici_yasli_bakim', label: 'Çocuk / Yaşlı Bakım Hizmetleri' },
    ],
  },
  {
    id: 'kamu_stk_meslek',
    label: 'Kamu, STK, Meslek Kuruluşları',
    subs: [
      { id: 'kamu_kurum', label: 'Kamu Kurumu / Belediye' },
      { id: 'stk_dernek_vakif', label: 'STK / Dernek / Vakıf' },
      { id: 'oda_borsa_meslek_birligi', label: 'Oda / Borsa / Meslek Birliği' },
      { id: 'sendika', label: 'Sendika' },
      { id: 'siyasi_parti', label: 'Siyasi Parti / Kampanya' },
      { id: 'egitim_vakfi_burs', label: 'Eğitim Vakfı / Burs Programı' },
      { id: 'cevre_hayvan_haklari', label: 'Çevre / Hayvan Hakları STK' },
      { id: 'inanc_dini_kurum', label: 'İnanç / Dini Kurum' },
    ],
  },
]

/* ── Helpers ────────────────────────────────────────────────── */

export function getSectorMain(mainId: string): SectorMainItem | null {
  return SECTOR_CATALOG.find((s) => s.id === mainId) || null
}

export function getSectorSubs(mainId: string): SectorSubItem[] {
  return getSectorMain(mainId)?.subs || []
}

export function getSectorLabel(mainId: string, subId?: string | null): string {
  const main = getSectorMain(mainId)
  if (!main) return mainId
  if (!subId) return main.label
  const sub = main.subs.find((s) => s.id === subId)
  return sub ? `${main.label} → ${sub.label}` : main.label
}

export function isValidSectorMain(mainId: string): boolean {
  return SECTOR_CATALOG.some((s) => s.id === mainId)
}

export function isValidSectorSub(mainId: string, subId: string): boolean {
  const main = getSectorMain(mainId)
  if (!main) return false
  return main.subs.some((s) => s.id === subId)
}
