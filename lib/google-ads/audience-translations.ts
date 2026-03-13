/**
 * Google Ads Audience Segment Name Translations
 *
 * Dynamic translation engine:
 * 1. Google API already returns ~60% of names in Turkish (Accept-Language: tr)
 * 2. Names still in English are auto-translated via OpenAI
 * 3. Translations are cached persistently (never re-translated)
 *
 * This file contains:
 * - Static cache of known translations (from real API data)
 * - "Trips to X" pattern handler for travel destinations
 * - Dynamic translation via OpenAI for unknown English names
 * - Persistent file cache for translated names
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve } from 'path'

/* ================================================================== */
/*  STATIC TRANSLATIONS — Known English names from Google Ads API      */
/* ================================================================== */

const STATIC_TR: Record<string, string> = {
  /* AFFINITY */
  'active & outdoor wear': 'Aktif ve Outdoor Giyim',
  'alcoholic beverages': 'Alkollü İçecekler',
  'audiophiles': 'Ses Kalitesi Tutkunları',
  'avid business news readers': 'İş Haberleri Takipçileri',
  'avid local news readers': 'Yerel Haber Takipçileri',
  'avid news readers': 'Haber Takipçileri',
  'avid political news readers': 'Siyasi Haber Takipçileri',
  'avid world news readers': 'Dünya Haberleri Takipçileri',
  'banks online': 'Online Bankacılık Kullanıcıları',
  'boating & sailing enthusiasts': 'Tekne ve Yelken Tutkunları',
  'budget fashion shoppers': 'Bütçe Dostu Moda Alışverişçileri',
  'charitable donors & volunteers': 'Hayırseverler ve Gönüllüler',
  'cloud services power users': 'Bulut Hizmeti İleri Kullanıcıları',
  'console gamers': 'Konsol Oyuncuları',
  'convenience store shoppers': 'Market Alışverişçileri',
  'cord cutters': 'Kablo TV\'yi Bırakanlar',
  'cord nevers': 'Kablo TV Kullanmayanlar',
  'cricket enthusiasts': 'Kriket Tutkunları',
  'department store shoppers': 'Mağaza Alışverişçileri',
  'diners by meal': 'Öğüne Göre Yemek Yiyenler',
  'eco-conscious fashion consumers': 'Çevre Bilinçli Moda Tüketicileri',
  'electronic dance music fans': 'Elektronik Dans Müziği Hayranları',
  'entertainment news enthusiasts': 'Eğlence Haberleri Meraklıları',
  'esports fans': 'E-Spor Hayranları',
  'everyday & casual wear': 'Günlük Giyim',
  'fans of american football': 'Amerikan Futbolu Hayranları',
  'fans of australian football': 'Avustralya Futbolu Hayranları',
  'fans of latin music': 'Latin Müziği Hayranları',
  'fans of new & upcoming movies': 'Yeni ve Yaklaşan Film Hayranları',
  'fans of new & upcoming video games': 'Yeni ve Yaklaşan Oyun Hayranları',
  'fans of south asian film': 'Güney Asya Filmi Hayranları',
  'fashion trend seekers': 'Moda Trendi Arayanlar',
  'fight & wrestling fans': 'Dövüş ve Güreş Hayranları',
  'footwear': 'Ayakkabı',
  'game, reality & talk show fans': 'Yarışma, Reality ve Talk Show Hayranları',
  'grocery shoppers': 'Market Müşterileri',
  'hats, gloves & scarves': 'Şapka, Eldiven ve Atkılar',
  'high-end computer aficionados': 'Üst Düzey Bilgisayar Tutkunları',
  'home automation enthusiasts': 'Akıllı Ev Tutkunları',
  'homeschooling parents': 'Evde Eğitim Veren Ebeveynler',
  'jewelry': 'Takı',
  'live sports viewers': 'Canlı Spor İzleyicileri',
  'makeup & cosmetics': 'Makyaj ve Kozmetik',
  "men's media fans": 'Erkek Medyası Takipçileri',
  'motor sports enthusiasts': 'Motor Sporları Tutkunları',
  'olympics fans': 'Olimpiyat Hayranları',
  'pc gamers': 'PC Oyuncuları',
  'perfumes & fragrances': 'Parfüm ve Kokular',
  'public transit users': 'Toplu Taşıma Kullanıcıları',
  'quality-conscious fashion buyers': 'Kalite Odaklı Moda Alıcıları',
  'racquetball enthusiasts': 'Raket Sporu Tutkunları',
  'rugby enthusiasts': 'Rugby Tutkunları',
  'shoppers by store type': 'Mağaza Türüne Göre Alışverişçiler',
  'shopping enthusiasts': 'Alışveriş Tutkunları',
  'skincare products': 'Cilt Bakım Ürünleri',
  'snowbound travelers': 'Kış Tatilcileri',
  'superstore shoppers': 'Hipermarket Müşterileri',
  'taxi service users': 'Taksi Kullanıcıları',
  'transportation modes': 'Ulaşım Türleri',
  'us military history enthusiasts': 'ABD Askeri Tarih Meraklıları',
  'vegans': 'Veganlar',
  'vegetarians & vegans': 'Vejetaryenler ve Veganlar',
  'veterans & veteran supporters': 'Gaziler ve Destekçileri',
  'viewership behavior': 'İzleme Davranışı',
  'weightlifters': 'Halter Sporcuları',
  "women's media fans": 'Kadın Medyası Takipçileri',
  'yoga lovers': 'Yoga Severler',
  'moda tüketici behavior': 'Moda Tüketici Davranışı',
  'prefers organik yiyecek': 'Organik Yiyecek Tercih Edenler',
  'lüks moda buyers': 'Lüks Moda Alıcıları',

  /* IN-MARKET — Hotels & Travel */
  '1 & 2 star hotels': '1 ve 2 Yıldızlı Oteller',
  '3 star hotels': '3 Yıldızlı Oteller',
  '4 star hotels': '4 Yıldızlı Oteller',
  '5 star hotels': '5 Yıldızlı Oteller',
  'hotels by star rating': 'Yıldız Sayısına Göre Oteller',
  'air travel by class': 'Sınıfa Göre Hava Yolculuğu',
  'business & first class': 'Business ve First Class',
  'economy class': 'Ekonomi Sınıfı',
  'trips by destination': 'Varış Noktasına Göre Seyahatler',

  /* IN-MARKET — Automotive */
  'auto exterior parts & accessories': 'Araç Dış Parça ve Aksesuarları',
  'auto interior parts & accessories': 'Araç İç Parça ve Aksesuarları',
  'automotive electronic components': 'Otomotiv Elektronik Bileşenleri',
  'classic vehicles': 'Klasik Araçlar',
  'convertibles': 'Üstü Açık Arabalar',
  'convertibles (new)': 'Üstü Açık Arabalar (Yeni)',
  'convertibles (used)': 'Üstü Açık Arabalar (İkinci El)',
  'compact cars (new)': 'Kompakt Otomobiller (Yeni)',
  'compact cars (used)': 'Kompakt Otomobiller (İkinci El)',
  'coupes': 'Coupe Arabalar',
  'coupes (new)': 'Coupe Arabalar (Yeni)',
  'coupes (used)': 'Coupe Arabalar (İkinci El)',
  'crossovers': 'Crossover Araçlar',
  'crossovers (new)': 'Crossover Araçlar (Yeni)',
  'crossovers (used)': 'Crossover Araçlar (İkinci El)',
  'diesel vehicles': 'Dizel Araçlar',
  'diesel vehicles (new)': 'Dizel Araçlar (Yeni)',
  'diesel vehicles (used)': 'Dizel Araçlar (İkinci El)',
  'hatchbacks': 'Hatchback Arabalar',
  'hatchbacks (new)': 'Hatchback Arabalar (Yeni)',
  'hatchbacks (used)': 'Hatchback Arabalar (İkinci El)',
  'hybrid & alternative vehicles': 'Hibrit ve Alternatif Araçlar',
  'hybrid & alternative vehicles (new)': 'Hibrit ve Alternatif Araçlar (Yeni)',
  'hybrid & alternative vehicles (used)': 'Hibrit ve Alternatif Araçlar (İkinci El)',
  'microcars & subcompacts': 'Mikro ve Alt Kompakt Arabalar',
  'microcars & subcompacts (new)': 'Mikro ve Alt Kompakt Arabalar (Yeni)',
  'microcars & subcompacts (used)': 'Mikro ve Alt Kompakt Arabalar (İkinci El)',
  'motor vehicles by brand': 'Marka Bazında Motorlu Araçlar',
  'motor vehicles by type': 'Tür Bazında Motorlu Araçlar',
  'motorcycles (new)': 'Motosikletler (Yeni)',
  'motorcycles (used)': 'Motosikletler (İkinci El)',
  'off-road vehicles': 'Arazi Araçları',
  'off-road vehicles (new)': 'Arazi Araçları (Yeni)',
  'off-road vehicles (used)': 'Arazi Araçları (İkinci El)',
  'pickup trucks': 'Pickup Kamyonetler',
  'pickup trucks (new)': 'Pickup Kamyonetler (Yeni)',
  'pickup trucks (used)': 'Pickup Kamyonetler (İkinci El)',
  'sedans (new)': 'Sedanlar (Yeni)',
  'sedans (used)': 'Sedanlar (İkinci El)',
  'sports cars': 'Spor Arabalar',
  'sports cars (new)': 'Spor Arabalar (Yeni)',
  'sports cars (used)': 'Spor Arabalar (İkinci El)',
  'station wagons': 'Station Wagon Arabalar',
  'station wagons (new)': 'Station Wagon Arabalar (Yeni)',
  'station wagons (used)': 'Station Wagon Arabalar (İkinci El)',
  'suvs (new)': 'SUV\'ler (Yeni)',
  'suvs (used)': 'SUV\'ler (İkinci El)',
  'vans & minivans (new)': 'Minibüs ve Minivanlar (Yeni)',
  'vans & minivans (used)': 'Minibüs ve Minivanlar (İkinci El)',
  'vehicles (other)': 'Diğer Araçlar',
  'car audio': 'Araç Ses Sistemleri',
  'car batteries': 'Araç Aküleri',
  'car brakes': 'Araç Frenleri',
  'brake service & repair': 'Fren Servisi ve Tamiri',
  'collision & auto body repair': 'Kaporta ve Boya Tamiri',
  'engine & transmission': 'Motor ve Şanzıman',
  'high performance & aftermarket auto parts': 'Yüksek Performans Oto Parçaları',
  'oil changes': 'Yağ Değişimi',
  'transmission repair': 'Şanzıman Tamiri',
  'wheels & tires': 'Jantlar ve Lastikler',
  'campers & rvs': 'Karavanlar',
  'scooters & mopeds': 'Scooter ve Mopedler',
  'scooters & mopeds (new)': 'Scooter ve Mopedler (Yeni)',
  'scooters & mopeds (used)': 'Scooter ve Mopedler (İkinci El)',
  'economy, compact & mid-size car rental': 'Ekonomi ve Orta Boy Araç Kiralama',
  'full-size & standard car rental': 'Büyük ve Standart Araç Kiralama',
  'luxury, convertible & specialty car rental': 'Lüks ve Özel Araç Kiralama',
  'minivan & suv rental': 'Minivan ve SUV Kiralama',

  /* IN-MARKET — Real Estate */
  'apartments (for rent)': 'Kiralık Daireler',
  'apartments (for sale)': 'Satılık Daireler',
  'commercial properties (for rent)': 'Kiralık Ticari Gayrimenkul',
  'commercial properties (for sale)': 'Satılık Ticari Gayrimenkul',
  'furnished apartments': 'Eşyalı Daireler',
  'unfurnished apartments': 'Eşyasız Daireler',
  'houses (for rent)': 'Kiralık Evler',
  'houses (for sale)': 'Satılık Evler',
  'new apartments (for sale)': 'Satılık Yeni Daireler',
  'new houses (for sale)': 'Satılık Yeni Evler',
  'preowned apartments (for sale)': 'Satılık İkinci El Daireler',
  'preowned houses (for sale)': 'Satılık İkinci El Evler',

  /* IN-MARKET — Beauty & Personal Care */
  'anti-aging skin care products': 'Yaşlanma Karşıtı Cilt Bakım Ürünleri',
  'body lotions & moisturizers': 'Vücut Losyonları ve Nemlendiriciler',
  'eye makeup': 'Göz Makyajı',
  'eyeglasses & contact lenses': 'Gözlük ve Kontakt Lens',
  'face lotions & moisturizers': 'Yüz Losyonları ve Nemlendiriciler',
  'face makeup': 'Yüz Makyajı',
  'facial cleansers & makeup removers': 'Yüz Temizleyicileri ve Makyaj Çıkarıcıları',
  'hair color products': 'Saç Boyası Ürünleri',
  'lip makeup': 'Dudak Makyajı',
  'manicures & pedicures': 'Manikür ve Pedikür',
  'massage therapy': 'Masaj Terapisi',
  'shampoos & conditioners': 'Şampuanlar ve Saç Kremleri',
  'shaving & hair removal': 'Tıraş ve Tüy Alma',
  'spas & beauty services': 'Spa ve Güzellik Hizmetleri',
  'tanning & sun care products': 'Bronzlaştırıcı ve Güneş Bakım Ürünleri',

  /* IN-MARKET — Furniture (top-level categories for reverse search) */
  'home furniture': 'Ev Mobilyası',
  'bedroom furniture': 'Yatak Odası Mobilyaları',
  'office furniture': 'Ofis Mobilyası',
  'outdoor furniture': 'Dış Mekan Mobilyaları',
  'furniture': 'Mobilya',
  'home furnishings': 'Ev Eşyaları',
  'bedding': 'Yatak Takımları',
  'bedroom': 'Yatak Odası',

  /* IN-MARKET — Home & Garden */
  'accent tables': 'Aksesuar Masalar',
  'air conditioners': 'Klimalar',
  'beds & bed frames': 'Yataklar ve Yatak Çerçeveleri',
  'carpet installation': 'Halı Döşeme',
  'ceiling light fixtures': 'Tavan Aydınlatma Armatürleri',
  'climate control & air quality': 'İklim Kontrolü ve Hava Kalitesi',
  'coffee & espresso makers': 'Kahve ve Espresso Makineleri',
  'coffee maker & espresso machine accessories': 'Kahve Makinesi Aksesuarları',
  'cooking ranges & stoves': 'Fırınlar ve Ocaklar',
  'curtains & drapes': 'Perdeler',
  'desks': 'Çalışma Masaları',
  'door & window installation': 'Kapı ve Pencere Montajı',
  'driveway & walkway paving': 'Yol ve Kaldırım Döşeme',
  'fencing': 'Çit ve Parmaklık',
  'fans': 'Vantilatörler',
  'fireplaces': 'Şömineler',
  'foundation repair': 'Temel Onarım',
  'garden sheds & outdoor structures': 'Bahçe Kulübeleri ve Dış Mekan Yapıları',
  'garage door & opener installation & repair': 'Garaj Kapısı Montajı ve Tamiri',
  'general contracting & remodeling services': 'Tadilat ve Müteahhitlik Hizmetleri',
  'gutter cleaning & repair': 'Oluk Temizliği ve Tamiri',
  'headphones & headsets': 'Kulaklıklar',
  'heating & cooling': 'Isıtma ve Soğutma',
  'home inspection services': 'Ev Denetim Hizmetleri',
  'home security systems': 'Ev Güvenlik Sistemleri',
  'helpdesk & customer support solutions': 'Müşteri Destek Çözümleri',
  'holiday items & decorations': 'Bayram Ürünleri ve Dekorasyonları',
  'home office': 'Ev Ofis',
  'home storage & shelving': 'Ev Depolama ve Raflar',
  'hosted data & cloud storage': 'Bulut Depolama',
  'house plants': 'Saksı Bitkileri',
  'interior design & decorating services': 'İç Tasarım ve Dekorasyon Hizmetleri',
  'juicers & blenders': 'Meyve Sıkacakları ve Blenderlar',
  'kitchen & dining room': 'Mutfak ve Yemek Odası',
  'kitchen & dining room chairs': 'Mutfak ve Yemek Odası Sandalyeleri',
  'kitchen & dining room tables': 'Mutfak ve Yemek Odası Masaları',
  'landscape design': 'Peyzaj Tasarımı',
  'lawn mowers': 'Çim Biçme Makineleri',
  'lawn care & gardening supplies': 'Bahçe Bakım Malzemeleri',
  'linens': 'Ev Tekstili',
  'living room': 'Oturma Odası',
  'locksmith services': 'Çilingir Hizmetleri',
  'microwaves': 'Mikrodalga Fırınlar',
  'mixer & blender accessories': 'Mikser ve Blender Aksesuarları',
  'mixers': 'Mikserler',
  'nursery': 'Bebek Odası',
  'office chairs': 'Ofis Sandalyeleri',
  'paint': 'Boya',
  'plumber services': 'Tesisatçı Hizmetleri',
  'plumbing fixture hardware & parts': 'Tesisat Armatür Parçaları',
  'plumbing fixtures': 'Tesisat Armatürleri',
  'pool & spa services': 'Havuz ve Spa Hizmetleri',
  'roofing': 'Çatı Kaplama',
  'roofing services': 'Çatı Hizmetleri',
  'refrigerator accessories': 'Buzdolabı Aksesuarları',
  'refrigerators': 'Buzdolapları',
  'small appliances': 'Küçük Ev Aletleri',
  'sofas': 'Kanepeler',
  'stereo systems': 'Stereo Sistemler',
  'stools': 'Tabureler',
  'tableware': 'Sofra Takımları',
  'vacuums': 'Elektrik Süpürgeleri',
  'wall light fixtures': 'Duvar Aydınlatma Armatürleri',
  'washers & dryers': 'Çamaşır ve Kurutma Makineleri',
  'water purifiers': 'Su Arıtma Cihazları',
  'siding installation': 'Dış Cephe Kaplama Montajı',
  'tree trimming & removal': 'Ağaç Budama ve Kaldırma',
  'water heaters': 'Su Isıtıcıları',
  'window blinds & shades': 'Stor ve Güneşlikler',

  /* IN-MARKET — Food & Grocery */
  'batteries': 'Piller',
  'candy, chocolate & gum': 'Şeker, Çikolata ve Sakız',
  'condiments & sauces': 'Soslar ve Çeşniler',
  'dairy & eggs': 'Süt Ürünleri ve Yumurta',
  'fast food meals': 'Fast Food Yemekleri',
  'hand sanitizers': 'El Dezenfektanları',
  'nutrition drinks & shakes': 'Beslenme İçecekleri',
  'produce & farm boxes': 'Çiftlik Ürünleri Kutuları',
  'reusable food & beverage containers': 'Yeniden Kullanılabilir Yiyecek Kapları',
  'toddler meals': 'Küçük Çocuk Yemekleri',

  /* IN-MARKET — Apparel & Accessories */
  'bridal wear': 'Gelinlik',
  "children's apparel": 'Çocuk Giyimi',
  'necklaces': 'Kolyeler',
  'pants': 'Pantolonlar',
  'shirts & tops': 'Gömlekler ve Üstler',
  'socks': 'Çoraplar',
  'suits & business attire': 'Takım Elbise ve İş Kıyafetleri',
  'work safety protective gear': 'İş Güvenliği Koruyucu Ekipmanları',
  'wedding & engagement rings': 'Alyans ve Nişan Yüzükleri',

  /* IN-MARKET — Technology */
  'audio streaming subscription services': 'Müzik Akış Abonelik Hizmetleri',
  'computer monitors': 'Bilgisayar Monitörleri',
  'crm solutions': 'CRM Çözümleri',
  'collaboration & conferencing tools': 'İş Birliği ve Konferans Araçları',
  'digital slrs': 'Dijital SLR Fotoğraf Makineleri',
  'domain registration': 'Alan Adı Tescili',
  'drawing & animation software': 'Çizim ve Animasyon Yazılımı',
  'erp solutions': 'ERP Çözümleri',
  'gaming peripherals & accessories': 'Oyun Çevre Birimleri ve Aksesuarları',
  'memory & storage': 'Bellek ve Depolama',
  'nintendo consoles': 'Nintendo Konsolları',
  'payment processing & merchant services': 'Ödeme İşleme ve Satıcı Hizmetleri',
  'photo software': 'Fotoğraf Yazılımı',
  'physical security & access control': 'Fiziksel Güvenlik ve Erişim Kontrolü',
  'power adapters & chargers': 'Güç Adaptörleri ve Şarj Cihazları',
  'printers, scanners & faxes': 'Yazıcılar, Tarayıcılar ve Fakslar',
  'signage': 'Tabela ve İşaretleme',
  'tablets & ultraportable devices': 'Tabletler ve Taşınabilir Cihazlar',
  'tv & video streaming subscription services': 'TV ve Video Akış Abonelik Hizmetleri',
  'video chat software': 'Görüntülü Sohbet Yazılımı',
  'video game streaming services': 'Video Oyun Yayın Hizmetleri',
  'web design & development': 'Web Tasarım ve Geliştirme',
  'web hosting': 'Web Barındırma',
  'web services': 'Web Hizmetleri',

  /* IN-MARKET — Sports */
  'american football tickets': 'Amerikan Futbolu Biletleri',
  'baseball equipment': 'Beyzbol Ekipmanları',
  'baseball tickets': 'Beyzbol Biletleri',
  'basketball tickets': 'Basketbol Biletleri',
  'bbq & grill accessories': 'Mangal ve Izgara Aksesuarları',
  'bicycles & accessories': 'Bisikletler ve Aksesuarlar',
  'hockey equipment': 'Hokey Ekipmanları',
  'hockey tickets': 'Hokey Biletleri',
  'skateboarding equipment': 'Kaykay Ekipmanları',
  'soccer tickets': 'Futbol Biletleri',
  'water activities equipment & accessories': 'Su Aktiviteleri Ekipman ve Aksesuarları',
  'weights & strength training equipment': 'Ağırlık ve Güç Antrenmanı Ekipmanları',

  /* IN-MARKET — Services & Jobs */
  'architectural services': 'Mimarlık Hizmetleri',
  'arts & design education': 'Sanat ve Tasarım Eğitimi',
  'childcare': 'Çocuk Bakımı',
  'clerical & administrative jobs': 'Büro ve İdari İşler',
  'construction jobs': 'İnşaat İşleri',
  'credit reports & monitoring services': 'Kredi Raporlama Hizmetleri',
  'debit & checking services': 'Banka Hesap Hizmetleri',
  'early childhood education': 'Erken Çocukluk Eğitimi',
  'educational resources (preschool & kindergarten)': 'Eğitim Kaynakları (Okul Öncesi)',
  'educational resources (primary school)': 'Eğitim Kaynakları (İlkokul)',
  'educational resources (secondary school)': 'Eğitim Kaynakları (Ortaokul ve Lise)',
  'electrician services': 'Elektrikçi Hizmetleri',
  'estate planning': 'Miras Planlaması',
  'event photographers & studios': 'Etkinlik Fotoğrafçıları ve Stüdyoları',
  'fine art': 'Güzel Sanatlar',
  'glass repair & replacement': 'Cam Tamir ve Değiştirme',
  'manufacturing jobs': 'İmalat İşleri',
  'material handling equipment': 'Malzeme Taşıma Ekipmanları',
  'measuring tools & sensors': 'Ölçüm Araçları ve Sensörler',
  'painting services': 'Boyama Hizmetleri',
  'pest control services': 'Haşere Kontrol Hizmetleri',
  'pest control supplies': 'Haşere Kontrol Malzemeleri',
  'photo & video services': 'Fotoğraf ve Video Hizmetleri',
  'pro musician & dj equipment': 'Profesyonel Müzisyen ve DJ Ekipmanları',
  'school supplies': 'Okul Malzemeleri',
  'science education': 'Fen Bilimleri Eğitimi',
  'technology education': 'Teknoloji Eğitimi',
  'temporary & seasonal jobs': 'Geçici ve Mevsimsel İşler',

  /* IN-MARKET — Baby & Kids */
  'diapers & baby hygiene products': 'Bebek Bezi ve Hijyen Ürünleri',
  'infant feeding supplies': 'Bebek Besleme Malzemeleri',

  /* IN-MARKET — Seasonal */
  'after-christmas sale shopping': 'Yılbaşı Sonrası İndirim Alışverişi',
  'christmas items & decor': 'Yılbaşı Ürünleri ve Dekorasyonu',
  'halloween items & decor': 'Cadılar Bayramı Ürünleri ve Dekorasyonu',
  'in-store black friday shopping': 'Mağazada Black Friday Alışverişi',
  'in-store christmas shopping': 'Mağazada Yılbaşı Alışverişi',
  "mother's day dining": 'Anneler Günü Yemeği',
  "mother's day flowers & greeting cards": 'Anneler Günü Çiçek ve Kartları',
  'online black friday shopping': 'Online Black Friday Alışverişi',
  "valentine's day items & decor": 'Sevgililer Günü Ürünleri ve Dekorasyonu',

  /* IN-MARKET — Mixed TR/EN names from API */
  'back-to-school giyim ve aksesuarları': 'Okula Dönüş Giyim ve Aksesuarları',
  'bebek ve toddler giyim': 'Bebek ve Yürümeye Başlayan Çocuk Giyimi',
  'yemek pişirme ve fırıncılık ingredients': 'Yemek Pişirme ve Fırıncılık Malzemeleri',
  'cosmetology eğitim ve eğitimi': 'Kozmetoloji Eğitimi',
  'cat yiyecek ve malzemeleri': 'Kedi Yiyecek ve Malzemeleri',
  'dog yiyecek ve malzemeleri': 'Köpek Yiyecek ve Malzemeleri',
  'hair kaldırma hizmetleri': 'Tüy Alma Hizmetleri',
  'glass tamir ve değiştirme': 'Cam Tamir ve Değiştirme',
  'leisure ve konaklama işleri': 'Eğlence ve Konaklama İşleri',
  'winter spor ekipmanları ve aksesuarları': 'Kış Sporu Ekipmanları ve Aksesuarları',
  'open çevrimiçi kursları': 'Açık Çevrimiçi Kurslar',
  'çevrimiçi christmas alışverişi': 'Çevrimiçi Yılbaşı Alışverişi',
  'yiyecek ve grocery teslimat': 'Yiyecek ve Market Teslimatı',
  'yiyecek service ekipmanları': 'Yiyecek Hizmeti Ekipmanları',
  'fitness technology ürünleri': 'Fitness Teknoloji Ürünleri',
  'mutfak ve banyo cabinets': 'Mutfak ve Banyo Dolapları',
  'mutfak ve banyo counters': 'Mutfak ve Banyo Tezgahları',
  'mutfak appliance aksesuarları': 'Mutfak Cihazı Aksesuarları',
  'lawn ve bahçe bakım': 'Çim ve Bahçe Bakımı',
  'ev equity kredileri': 'Konut Teminatlı Krediler',
  'ev purchase kredileri': 'Ev Satın Alma Kredileri',
  'household temizlik malzemeleri': 'Ev Temizlik Malzemeleri',
  'avcılık ve shooting malzemeleri': 'Avcılık ve Atış Malzemeleri',
  'devlet ve kamu sector işleri': 'Devlet ve Kamu Sektörü İşleri',
  'career danışmanlığı hizmetleri': 'Kariyer Danışmanlığı Hizmetleri',
  'ulaşım ve utilities işleri': 'Ulaşım ve Kamu Hizmetleri İşleri',
  'power ve elektrik malzemeleri': 'Güç ve Elektrik Malzemeleri',
  'pet yiyecek ve malzemeleri': 'Evcil Hayvan Yiyecek ve Malzemeleri',
  'dış mekan mobilya sets': 'Dış Mekan Mobilya Setleri',
  'dış mekan oyuncaklar ve play ekipmanları': 'Dış Mekan Oyuncaklar ve Oyun Ekipmanları',
  'photo baskı hizmetleri': 'Fotoğraf Baskı Hizmetleri',
  'lüks araçlar (new)': 'Lüks Araçlar (Yeni)',
  'lüks araçlar (used)': 'Lüks Araçlar (İkinci El)',
  'ağ ekipmanları ve virtualization': 'Ağ Ekipmanları ve Sanallaştırma',
  'cardio eğitimi ekipmanları': 'Kardiyo Eğitimi Ekipmanları',
  'sağlık bakım eğitim': 'Sağlık Bakımı Eğitimi',
  'hemşirelik eğitim': 'Hemşirelik Eğitimi',
  'hukuk eğitim': 'Hukuk Eğitimi',
  'iş eğitim': 'İş Eğitimi',

  /* IN-MARKET — Top-level categories */
  'apparel & accessories': 'Giyim ve Aksesuarlar',
  'autos & vehicles': 'Otomobiller ve Araçlar',
  'baby & children\'s products': 'Bebek ve Çocuk Ürünleri',
  'beauty & personal care': 'Güzellik ve Kişisel Bakım',
  'business & industrial products': 'İş ve Endüstriyel Ürünler',
  'business services': 'İş Hizmetleri',
  'computers & peripherals': 'Bilgisayarlar ve Çevre Birimleri',
  'consumer electronics': 'Tüketici Elektroniği',
  'consumer software': 'Tüketici Yazılımı',
  'dating services': 'Tanışma Hizmetleri',
  'education': 'Eğitim',
  'employment': 'İstihdam',
  'financial services': 'Finansal Hizmetler',
  'food & groceries': 'Yiyecek ve Market Ürünleri',
  'gifts & occasions': 'Hediyeler ve Özel Günler',
  'health': 'Sağlık',
  'home & garden': 'Ev ve Bahçe',
  'household products': 'Ev Ürünleri',
  'media & entertainment': 'Medya ve Eğlence',
  'real estate': 'Gayrimenkul',
  'sports & fitness': 'Spor ve Fitness',
  'telecom': 'Telekomünikasyon',
  'travel': 'Seyahat',

  /* IN-MARKET — Apparel sub-categories */
  'activewear': 'Spor Giyim',
  'backpacks': 'Sırt Çantaları',
  'costumes': 'Kostümler',
  'dresses': 'Elbiseler',
  'eyewear': 'Gözlük',
  'formal wear': 'Resmi Giyim',
  'handbags': 'El Çantaları',
  'outerwear': 'Dış Giyim',
  'sleepwear': 'Gecelik ve Pijama',
  'sportswear': 'Spor Giyim',
  'swimwear': 'Mayo ve Bikini',
  'underwear': 'İç Giyim',
  'watches': 'Saatler',

  /* IN-MARKET — Technology sub-categories */
  'computers': 'Bilgisayarlar',
  'desktops': 'Masaüstü Bilgisayarlar',
  'laptops': 'Dizüstü Bilgisayarlar',
  'mobile phones': 'Cep Telefonları',
  'smartphones': 'Akıllı Telefonlar',
  'tablets': 'Tabletler',
  'cameras': 'Fotoğraf Makineleri',
  'televisions': 'Televizyonlar',
  'smart home devices': 'Akıllı Ev Cihazları',
  'speakers': 'Hoparlörler',
  'wearable technology': 'Giyilebilir Teknoloji',
  'video game consoles': 'Oyun Konsolları',
  'software': 'Yazılım',
  'antivirus & security software': 'Antivirüs ve Güvenlik Yazılımı',
  'operating systems': 'İşletim Sistemleri',
  'productivity software': 'Verimlilik Yazılımı',

  /* IN-MARKET — Financial services */
  'banking': 'Bankacılık',
  'credit cards': 'Kredi Kartları',
  'insurance': 'Sigorta',
  'auto insurance': 'Araç Sigortası',
  'health insurance': 'Sağlık Sigortası',
  'home insurance': 'Konut Sigortası',
  'life insurance': 'Hayat Sigortası',
  'travel insurance': 'Seyahat Sigortası',
  'investment services': 'Yatırım Hizmetleri',
  'loans': 'Krediler',
  'mortgages': 'İpotekli Krediler',
  'personal loans': 'Bireysel Krediler',
  'retirement planning': 'Emeklilik Planlaması',
  'tax services': 'Vergi Hizmetleri',

  /* IN-MARKET — Home & Garden sub-categories */
  'appliances': 'Ev Aletleri',
  'bathroom': 'Banyo',
  'countertops': 'Tezgahlar',
  'dishwashers': 'Bulaşık Makineleri',
  'flooring': 'Döşeme ve Zemin',
  'lighting': 'Aydınlatma',
  'ovens': 'Fırınlar',
  'patio furniture': 'Veranda Mobilyaları',
  'rugs & carpets': 'Halılar ve Kilimler',
  'storage & organization': 'Depolama ve Organizasyon',
  'garden tools': 'Bahçe Aletleri',
  'power tools': 'Elektrikli El Aletleri',
  'hand tools': 'El Aletleri',
  'cleaning supplies': 'Temizlik Malzemeleri',
  'laundry': 'Çamaşır',
  'kitchen appliances': 'Mutfak Aletleri',
  'large appliances': 'Büyük Ev Aletleri',

  /* IN-MARKET — Travel sub-categories */
  'air travel': 'Hava Yolculuğu',
  'bus & rail travel': 'Otobüs ve Tren Yolculuğu',
  'car rentals': 'Araç Kiralama',
  'cruises': 'Gemi Turları',
  'hotels & accommodations': 'Oteller ve Konaklama',
  'luggage': 'Bavul ve Valiz',
  'vacation packages': 'Tatil Paketleri',
  'vacation rentals': 'Tatil Evleri',
  'travel accessories': 'Seyahat Aksesuarları',

  /* IN-MARKET — Health */
  'fitness equipment': 'Fitness Ekipmanları',
  'fitness products': 'Fitness Ürünleri',
  'health products': 'Sağlık Ürünleri',
  'vitamins & supplements': 'Vitaminler ve Takviyeler',
  'weight management': 'Kilo Yönetimi',
  'weight loss programs': 'Kilo Verme Programları',
  'dental services': 'Diş Hizmetleri',
  'eye care': 'Göz Bakımı',
  'medical services': 'Tıbbi Hizmetler',
  'pharmacy': 'Eczane',

  /* IN-MARKET — Education */
  'college education': 'Üniversite Eğitimi',
  'mba programs': 'MBA Programları',
  'online education': 'Çevrimiçi Eğitim',
  'primary & secondary education': 'İlk ve Ortaöğretim',
  'study abroad': 'Yurt Dışında Eğitim',
  'test preparation': 'Sınav Hazırlık',
  'tutoring services': 'Özel Ders Hizmetleri',

  /* IN-MARKET — Employment */
  'accounting & finance jobs': 'Muhasebe ve Finans İşleri',
  'construction & extraction jobs': 'İnşaat ve Maden İşleri',
  'customer service jobs': 'Müşteri Hizmetleri İşleri',
  'education jobs': 'Eğitim İşleri',
  'engineering jobs': 'Mühendislik İşleri',
  'food & hospitality jobs': 'Yiyecek ve Konaklama İşleri',
  'healthcare jobs': 'Sağlık Sektörü İşleri',
  'installation & maintenance jobs': 'Kurulum ve Bakım İşleri',
  'it & technical jobs': 'Bilişim ve Teknik İşler',
  'legal jobs': 'Hukuk İşleri',
  'management jobs': 'Yöneticilik İşleri',
  'manufacturing & warehouse jobs': 'İmalat ve Depo İşleri',
  'marketing & advertising jobs': 'Pazarlama ve Reklam İşleri',
  'media & communications jobs': 'Medya ve İletişim İşleri',
  'protective services jobs': 'Koruma Hizmetleri İşleri',
  'retail jobs': 'Perakende İşleri',
  'sales jobs': 'Satış İşleri',
  'science & research jobs': 'Bilim ve Araştırma İşleri',
  'social services jobs': 'Sosyal Hizmetler İşleri',
  'transportation & logistics jobs': 'Taşımacılık ve Lojistik İşleri',

  /* IN-MARKET — Business services */
  'accounting & tax services': 'Muhasebe ve Vergi Hizmetleri',
  'advertising & marketing services': 'Reklam ve Pazarlama Hizmetleri',
  'business printing & document services': 'İş Baskı ve Belge Hizmetleri',
  'corporate events': 'Kurumsal Etkinlikler',
  'legal services': 'Hukuk Hizmetleri',
  'merchant services': 'Ticari Hizmetler',
  'office supplies': 'Ofis Malzemeleri',
  'shipping & logistics': 'Kargo ve Lojistik',

  /* IN-MARKET — Media & Entertainment */
  'books': 'Kitaplar',
  'concert & music festival tickets': 'Konser ve Müzik Festivali Biletleri',
  'movies': 'Filmler',
  'music': 'Müzik',
  'online video': 'Çevrimiçi Video',
  'sports memorabilia': 'Spor Koleksiyonu',
  'streaming services': 'Yayın Hizmetleri',
  'theater tickets': 'Tiyatro Biletleri',
  'video games': 'Video Oyunları',

  /* IN-MARKET — Sports */
  'exercise & fitness': 'Egzersiz ve Fitness',
  'golf equipment': 'Golf Ekipmanları',
  'running shoes & apparel': 'Koşu Ayakkabıları ve Giyim',
  'team sports equipment': 'Takım Sporları Ekipmanları',
  'tennis equipment': 'Tenis Ekipmanları',
  'yoga & pilates': 'Yoga ve Pilates',

  /* IN-MARKET — Gifts */
  'flowers': 'Çiçekler',
  'gift baskets': 'Hediye Sepetleri',
  'gift cards & certificates': 'Hediye Kartları ve Kuponları',
  'greeting cards': 'Tebrik Kartları',
  'party supplies': 'Parti Malzemeleri',

  /* IN-MARKET — Telecom */
  'cable & satellite tv': 'Kablo ve Uydu TV',
  'internet service providers': 'İnternet Servis Sağlayıcıları',
  'mobile phone service': 'Cep Telefonu Hizmeti',

  /* IN-MARKET — Baby & Kids */
  'baby clothing': 'Bebek Giyimi',
  'baby furniture': 'Bebek Mobilyası',
  'baby toys': 'Bebek Oyuncakları',
  'children\'s clothing': 'Çocuk Giyimi',
  'children\'s toys': 'Çocuk Oyuncakları',
  'strollers & car seats': 'Bebek Arabası ve Oto Koltuğu',

  /* IN-MARKET — Pets */
  'pet food & supplies': 'Evcil Hayvan Yiyecek ve Malzemeleri',
  'cat food & supplies': 'Kedi Yiyecek ve Malzemeleri',
  'dog food & supplies': 'Köpek Yiyecek ve Malzemeleri',
  'pet adoption': 'Evcil Hayvan Sahiplenme',

  /* AFFINITY — Top-level */
  'arts & theater aficionados': 'Sanat ve Tiyatro Meraklıları',
  'auto enthusiasts': 'Otomobil Tutkunları',
  'avid investors': 'Yatırım Meraklıları',
  'beauty mavens': 'Güzellik Uzmanları',
  'book lovers': 'Kitap Severler',
  'business professionals': 'İş Profesyonelleri',
  'cat lovers': 'Kedi Severler',
  'coffee shop regulars': 'Kahve Düşkünleri',
  'cooking enthusiasts': 'Yemek Meraklıları',
  'cycling enthusiasts': 'Bisiklet Tutkunları',
  'diy enthusiasts': 'Kendin Yap Tutkunları',
  'do-it-yourselfers': 'Kendin Yapçılar',
  'dog lovers': 'Köpek Severler',
  'fashionistas': 'Moda Tutkunları',
  'fast food cravers': 'Fast Food Meraklıları',
  'film buffs': 'Sinema Meraklıları',
  'fitness buffs': 'Fitness Meraklıları',
  'foodies': 'Gurme Yemek Severler',
  'frequent travelers': 'Sık Seyahat Edenler',
  'gamers': 'Oyuncular',
  'gardening enthusiasts': 'Bahçecilik Tutkunları',
  'green living enthusiasts': 'Çevreci Yaşam Tutkunları',
  'health & fitness buffs': 'Sağlık ve Fitness Meraklıları',
  'home decor enthusiasts': 'Ev Dekorasyonu Tutkunları',
  'horror movie fans': 'Korku Filmi Hayranları',
  'marathon runners': 'Maraton Koşucuları',
  'mobile gamers': 'Mobil Oyuncular',
  'music lovers': 'Müzik Severler',
  'news junkies': 'Haber Takipçileri',
  'nightlife enthusiasts': 'Gece Hayatı Tutkunları',
  'outdoor enthusiasts': 'Açık Hava Tutkunları',
  'pet lovers': 'Hayvan Severler',
  'photography enthusiasts': 'Fotoğrafçılık Tutkunları',
  'political junkies': 'Siyaset Meraklıları',
  'running enthusiasts': 'Koşu Tutkunları',
  'sci-fi fans': 'Bilim Kurgu Hayranları',
  'social media enthusiasts': 'Sosyal Medya Tutkunları',
  'sports fans': 'Spor Hayranları',
  'technophiles': 'Teknoloji Meraklıları',
  'thrill seekers': 'Macera Arayanlar',
  'travel buffs': 'Seyahat Meraklıları',
  'tv lovers': 'TV Severler',
  'value shoppers': 'Hesaplı Alışverişçiler',
  'wine enthusiasts': 'Şarap Tutkunları',
  'winter sports enthusiasts': 'Kış Sporu Tutkunları',

  /* AFFINITY — Media */
  'action movie & video fans': 'Aksiyon Filmi ve Video Hayranları',
  'comedy movie & tv fans': 'Komedi Film ve Dizi Hayranları',
  'drama movie & tv fans': 'Drama Film ve Dizi Hayranları',
  'documentary fans': 'Belgesel Hayranları',
  'family movie fans': 'Aile Filmi Hayranları',
  'indie & art film fans': 'Bağımsız ve Sanat Filmi Hayranları',
  'animation fans': 'Animasyon Hayranları',
  'bollywood fans': 'Bollywood Hayranları',
  'classical music enthusiasts': 'Klasik Müzik Meraklıları',
  'country music fans': 'Country Müzik Hayranları',
  'hip-hop & rap fans': 'Hip-Hop ve Rap Hayranları',
  'pop music fans': 'Pop Müzik Hayranları',
  'rock music fans': 'Rock Müzik Hayranları',

  /* AFFINITY — Sports */
  'baseball fans': 'Beyzbol Hayranları',
  'basketball fans': 'Basketbol Hayranları',
  'soccer fans': 'Futbol Hayranları',
  'tennis fans': 'Tenis Hayranları',
  'golf enthusiasts': 'Golf Tutkunları',
  'skiing enthusiasts': 'Kayak Tutkunları',
  'surfing enthusiasts': 'Sörf Tutkunları',
  'swimming enthusiasts': 'Yüzme Tutkunları',
  'martial arts fans': 'Dövüş Sanatları Hayranları',
  'volleyball fans': 'Voleybol Hayranları',

  /* AFFINITY — Family */
  'family-focused': 'Aile Odaklı',
  'new parents': 'Yeni Ebeveynler',
  'parents': 'Ebeveynler',
  'parents of infants (0-1 years)': 'Bebek Ebeveynleri (0-1 Yaş)',
  'parents of toddlers (1-3 years)': 'Küçük Çocuk Ebeveynleri (1-3 Yaş)',
  'parents of preschoolers (4-5 years)': 'Okul Öncesi Çocuk Ebeveynleri (4-5 Yaş)',
  'parents of elementary schoolers (6-12 years)': 'İlkokul Çocuk Ebeveynleri (6-12 Yaş)',
  'parents of teens (13-17 years)': 'Ergen Ebeveynleri (13-17 Yaş)',

  /* DETAILED DEMOGRAPHICS */
  'construction industry': 'İnşaat Sektörü',
  'education sector': 'Eğitim Sektörü',
  'financial industry': 'Finans Sektörü',
  'healthcare industry': 'Sağlık Sektörü',
  'highest level of educational attainment': 'En Yüksek Eğitim Düzeyi',
  'hospitality industry': 'Otelcilik ve Turizm Sektörü',
  'manufacturing industry': 'İmalat Sektörü',
  'parents of grade-schoolers (6-12 years)': 'İlkokul Çocuk Ebeveynleri (6-12 Yaş)',
  'real estate industry': 'Gayrimenkul Sektörü',
  'technology industry': 'Teknoloji Sektörü',

  /* LIFE EVENTS */
  'currently traveling': 'Şu Anda Seyahatte',
  'preparing for upcoming trip': 'Yaklaşan Seyahate Hazırlanıyor',
  'purchasing first home soon': 'Yakında İlk Evini Satın Alacak',
  'recently engaged': 'Yakın Zamanda Nişanlanmış',
  'recently purchased first home': 'Yakın Zamanda İlk Evini Satın Almış',
  'recently returned from trip': 'Yakın Zamanda Seyahatten Dönmüş',
  'researching destinations': 'Seyahat Destinasyonlarını Araştırıyor',
  'taking a trip': 'Seyahate Çıkıyor',
}

/* ================================================================== */
/*  TRIP DESTINATION TRANSLATIONS                                      */
/* ================================================================== */

const TRIP_DEST_TR: Record<string, string> = {
  'the uk': 'İngiltere', 'the us': 'ABD', 'the caribbean': 'Karayipler',
  'the middle east & africa': 'Ortadoğu ve Afrika', 'the philippines': 'Filipinler',
  'the dominican republic': 'Dominik Cumhuriyeti', 'the canary islands': 'Kanarya Adaları',
  'the big island': 'Büyük Ada (Hawaii)', 'the united arab emirates': 'Birleşik Arap Emirlikleri',
  'asia-pacific': 'Asya-Pasifik', 'north america': 'Kuzey Amerika', 'latin america': 'Latin Amerika',
  'europe': 'Avrupa', 'turkey': 'Türkiye', 'germany': 'Almanya', 'france': 'Fransa',
  'italy': 'İtalya', 'spain': 'İspanya', 'portugal': 'Portekiz', 'greece': 'Yunanistan',
  'croatia': 'Hırvatistan', 'hungary': 'Macaristan', 'poland': 'Polonya', 'romania': 'Romanya',
  'sweden': 'İsveç', 'denmark': 'Danimarka', 'switzerland': 'İsviçre', 'iceland': 'İzlanda',
  'ireland': 'İrlanda', 'australia': 'Avustralya', 'new zealand': 'Yeni Zelanda',
  'japan': 'Japonya', 'china': 'Çin', 'india': 'Hindistan', 'indonesia': 'Endonezya',
  'malaysia': 'Malezya', 'thailand': 'Tayland', 'vietnam': 'Vietnam',
  'brazil': 'Brezilya', 'mexico': 'Meksika', 'canada': 'Kanada', 'egypt': 'Mısır',
  'morocco': 'Fas', 'south africa': 'Güney Afrika', 'kenya': 'Kenya', 'israel': 'İsrail',
  'jordan': 'Ürdün', 'lebanon': 'Lübnan', 'kuwait': 'Kuveyt', 'nepal': 'Nepal',
  'sri lanka': 'Sri Lanka', 'costa rica': 'Kosta Rika', 'cuba': 'Küba', 'jamaica': 'Jamaika',
  'guatemala': 'Guatemala', 'panama': 'Panama', 'california': 'Kaliforniya',
  'florida': 'Florida', 'hawaii': 'Hawaii', 'alaska': 'Alaska',
  'london, uk': 'Londra', 'rome': 'Roma', 'venice': 'Venedik', 'florence': 'Floransa',
  'naples': 'Napoli', 'sicily': 'Sicilya', 'vienna': 'Viyana', 'prague': 'Prag',
  'brussels': 'Brüksel', 'copenhagen': 'Kopenhag', 'moscow': 'Moskova', 'warsaw': 'Varşova',
  'budapest': 'Budapeşte', 'lisbon': 'Lizbon', 'beijing': 'Pekin', 'singapore': 'Singapur',
  'manchester, uk': 'Manchester', 'birmingham, uk': 'Birmingham (İngiltere)',
  'birmingham, al': 'Birmingham (ABD)', 'washington, d.c.': 'Washington D.C.',
  'mallorca, ibiza & balearic islands': 'Mallorca, İbiza ve Balear Adaları',
  'ho chi minh city': 'Ho Chi Minh', 'kochi (india)': 'Koçi (Hindistan)',
  'san francisco bay area': 'San Francisco', 'new york city': 'New York',
  'mexico city': 'Meksika City', 'são paulo': 'São Paulo',
}

/* ================================================================== */
/*  TURKISH → ENGLISH SEARCH KEYWORDS                                  */
/*  When user searches in Turkish, these map to English API terms       */
/* ================================================================== */

const SEARCH_KEYWORDS_TR_TO_EN: Record<string, string[]> = {
  'mobilya': ['furniture', 'home furnishings', 'bedroom', 'living room', 'sofa', 'bed'],
  'araba': ['car', 'auto', 'vehicle', 'sedan', 'motor vehicle'],
  'araç': ['vehicle', 'car', 'auto', 'motor vehicle'],
  'otomobil': ['automobile', 'car', 'auto', 'vehicle'],
  'yemek': ['food', 'dining', 'restaurant', 'meal', 'cooking'],
  'spor': ['sport', 'fitness', 'gym', 'athletic', 'exercise'],
  'seyahat': ['travel', 'trip', 'tourism', 'vacation', 'hotel'],
  'tatil': ['vacation', 'holiday', 'travel', 'resort'],
  'eğitim': ['education', 'school', 'learning', 'training'],
  'sağlık': ['health', 'medical', 'healthcare', 'wellness'],
  'teknoloji': ['technology', 'tech', 'computer', 'software'],
  'moda': ['fashion', 'clothing', 'apparel', 'style'],
  'güzellik': ['beauty', 'cosmetic', 'skincare', 'makeup'],
  'kozmetik': ['cosmetic', 'beauty', 'makeup', 'skincare'],
  'finans': ['finance', 'banking', 'investment', 'financial'],
  'gayrimenkul': ['real estate', 'property', 'house', 'apartment'],
  'emlak': ['real estate', 'property', 'house'],
  'ev': ['home', 'house', 'household', 'residential'],
  'bebek': ['baby', 'infant', 'toddler', 'newborn'],
  'çocuk': ['children', 'kids', 'child'],
  'hayvan': ['pet', 'animal'],
  'evcil': ['pet', 'animal', 'dog', 'cat'],
  'bahçe': ['garden', 'lawn', 'outdoor', 'landscaping'],
  'mutfak': ['kitchen', 'cooking', 'cookware'],
  'banyo': ['bathroom', 'bath', 'shower'],
  'yatak': ['bed', 'bedroom', 'mattress', 'bedding'],
  'ofis': ['office', 'business', 'workspace'],
  'giyim': ['clothing', 'apparel', 'fashion', 'wear'],
  'ayakkabı': ['shoes', 'footwear', 'sneakers'],
  'elektronik': ['electronics', 'electronic', 'gadget'],
  'telefon': ['phone', 'mobile', 'smartphone'],
  'bilgisayar': ['computer', 'pc', 'laptop'],
  'oyun': ['game', 'gaming', 'video game'],
  'müzik': ['music', 'audio', 'concert'],
  'film': ['movie', 'film', 'cinema'],
  'kitap': ['book', 'reading', 'literature'],
  'sigorta': ['insurance'],
  'kredi': ['credit', 'loan', 'mortgage'],
  'banka': ['bank', 'banking', 'financial'],
  'düğün': ['wedding', 'bridal', 'engagement'],
  'nişan': ['engagement', 'wedding'],
  'restoran': ['restaurant', 'dining', 'food'],
  'otel': ['hotel', 'accommodation', 'lodging'],
  'uçak': ['flight', 'airline', 'air travel'],
  'kira': ['rent', 'rental', 'lease'],
  'satılık': ['sale', 'buy', 'purchase'],
  'kiralık': ['rent', 'rental'],
  'dekorasyon': ['decoration', 'decor', 'interior design'],
  'temizlik': ['cleaning', 'clean', 'hygiene'],
  'taşınma': ['moving', 'relocation'],
  'iş': ['job', 'business', 'work', 'employment'],
  'kariyer': ['career', 'job', 'employment'],
  'hukuk': ['legal', 'law', 'attorney'],
  'avukat': ['lawyer', 'attorney', 'legal'],
  'doktor': ['doctor', 'medical', 'healthcare'],
  'hastane': ['hospital', 'medical', 'healthcare'],
  'diş': ['dental', 'dentist', 'tooth'],
  'göz': ['eye', 'optical', 'vision'],
  'saç': ['hair', 'haircare', 'salon'],
  'cilt': ['skin', 'skincare', 'derma'],
  'parfüm': ['perfume', 'fragrance', 'cologne'],
  'takı': ['jewelry', 'jewellery', 'accessories'],
  'saat': ['watch', 'watches', 'timepiece'],
  'çanta': ['bag', 'handbag', 'luggage'],
  'spor giyim': ['sportswear', 'athletic wear', 'activewear'],
  'iç giyim': ['underwear', 'lingerie', 'innerwear'],
  'bisiklet': ['bicycle', 'cycling', 'bike'],
  'koşu': ['running', 'jogging', 'marathon'],
  'yüzme': ['swimming', 'swim', 'pool'],
  'yoga': ['yoga', 'meditation', 'wellness'],
  'kamp': ['camping', 'outdoor', 'hiking'],
  'balık': ['fishing', 'fish', 'angling'],
  'fotoğraf': ['photo', 'photography', 'camera'],
  'müzik aleti': ['musical instrument', 'music equipment'],
  'enstrüman': ['instrument', 'music equipment'],
  'resim': ['painting', 'art', 'drawing'],
  'oto': ['auto', 'car', 'vehicle', 'automotive'],
  'lastik': ['tire', 'tyre', 'wheel'],
  'akü': ['battery', 'car battery'],
  'yedek parça': ['auto parts', 'spare parts'],
  'kasko': ['auto insurance', 'car insurance'],
  'trafik': ['traffic', 'auto insurance'],
  'market': ['grocery', 'supermarket', 'shopping'],
  'alışveriş': ['shopping', 'retail', 'store'],
}

/* ================================================================== */
/*  DYNAMIC TRANSLATION CACHE (persistent)                             */
/* ================================================================== */

const CACHE_PATH = resolve(process.cwd(), 'data/audience-translation-cache.json')
const SEARCH_CACHE_PATH = resolve(process.cwd(), 'data/audience-search-term-cache.json')

/** In-memory cache: lowercase name → Turkish translation */
let dynamicCache: Record<string, string> = {}
let cacheLoaded = false

/** In-memory cache: lowercase Turkish search term → English search terms */
let searchTermCache: Record<string, string[]> = {}
let searchCacheLoaded = false

function loadCache(): void {
  if (cacheLoaded) return
  cacheLoaded = true
  try {
    if (existsSync(CACHE_PATH)) {
      dynamicCache = JSON.parse(readFileSync(CACHE_PATH, 'utf-8'))
      console.log(`[audience-translate] Cache loaded: ${Object.keys(dynamicCache).length} entries`)
    } else if (existsSync('/tmp/audience-translation-cache.json')) {
      // Fallback for Vercel/read-only filesystems
      dynamicCache = JSON.parse(readFileSync('/tmp/audience-translation-cache.json', 'utf-8'))
      console.log(`[audience-translate] Cache loaded from /tmp fallback: ${Object.keys(dynamicCache).length} entries`)
    }
  } catch {
    dynamicCache = {}
  }
}

function saveCache(): void {
  try {
    ensureCacheDir()
    const json = JSON.stringify(dynamicCache, null, 2)
    writeFileSync(CACHE_PATH, json)
    // Verify the write succeeded
    const verify = readFileSync(CACHE_PATH, 'utf-8')
    if (verify.length > 0) {
      console.log(`[audience-translate] Cache written & verified: ${CACHE_PATH} (${Object.keys(dynamicCache).length} entries)`)
    }
  } catch (e) {
    console.error('[audience-translate] Cache write failed:', e)
    // Try /tmp as fallback (works on Vercel)
    try {
      writeFileSync('/tmp/audience-translation-cache.json', JSON.stringify(dynamicCache, null, 2))
      console.log('[audience-translate] Cache written to /tmp fallback')
    } catch { /* ignore fallback failure */ }
  }
}

function ensureCacheDir(): void {
  const dir = CACHE_PATH.substring(0, CACHE_PATH.lastIndexOf('/'))
  if (!existsSync(dir)) {
    const { mkdirSync } = require('fs')
    mkdirSync(dir, { recursive: true })
  }
}

function loadSearchCache(): void {
  if (searchCacheLoaded) return
  searchCacheLoaded = true
  try {
    if (existsSync(SEARCH_CACHE_PATH)) {
      searchTermCache = JSON.parse(readFileSync(SEARCH_CACHE_PATH, 'utf-8'))
    }
  } catch {
    searchTermCache = {}
  }
}

function saveSearchCache(): void {
  try {
    ensureCacheDir()
    writeFileSync(SEARCH_CACHE_PATH, JSON.stringify(searchTermCache, null, 2))
    console.log(`[audience-translate] Search term cache written. Total: ${Object.keys(searchTermCache).length}`)
  } catch (e) {
    console.error('[audience-translate] Search term cache write failed:', e)
  }
}

/* ================================================================== */
/*  LANGUAGE DETECTION                                                 */
/* ================================================================== */

/** Check if text is already in Turkish (contains Turkish-specific chars or is mostly non-ASCII) */
function isAlreadyTurkish(text: string): boolean {
  // Turkish-specific characters
  if (/[çğıöşüÇĞİÖŞÜ]/.test(text)) return true
  // If >50% of words start with a non-ASCII character, likely Turkish
  const words = text.split(/\s+/)
  const nonAsciiWords = words.filter(w => /^[^\x00-\x7F]/.test(w))
  return nonAsciiWords.length > words.length * 0.5
}

/** Check if text looks like a brand name (short, no spaces, or known brands) */
function isBrandOrProperNoun(text: string): boolean {
  const brands = new Set([
    'acura', 'alfa romeo', 'audi', 'bmw', 'buick', 'cadillac', 'chevrolet',
    'chrysler', 'citroën', 'dodge', 'fiat', 'ford', 'gmc', 'honda', 'hyundai',
    'infiniti', 'isuzu', 'jaguar', 'jeep', 'kia', 'land rover', 'lexus',
    'lincoln', 'maserati', 'mazda', 'mercedes-benz', 'mini', 'mitsubishi',
    'nissan', 'peugeot', 'porsche', 'ram trucks', 'renault', 'saab', 'seat',
    'scion', 'subaru', 'suzuki', 'tesla motors', 'toyota', 'vauxhall-opel',
    'volkswagen', 'volvo', 'xbox', 'sony playstation', 'pizza',
  ])
  return brands.has(text.toLowerCase())
}

/* ================================================================== */
/*  DYNAMIC TRANSLATION VIA OPENAI                                     */
/* ================================================================== */

/** Batch translate English names to Turkish using OpenAI (with 15s timeout) */
async function translateViaOpenAI(names: string[]): Promise<Record<string, string>> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey || names.length === 0) return {}

  const baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini'

  const prompt = `Translate these Google Ads audience segment names from English to Turkish.
Return ONLY a JSON object with English names as keys and Turkish translations as values.
These are marketing/advertising category names. Keep brand names as-is.
Keep translations concise and natural for a Turkish advertising dashboard.

Names to translate:
${names.map((n, i) => `${i + 1}. ${n}`).join('\n')}`

  try {
    // 15 second timeout — never hang forever
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15_000)

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: 'You are a professional translator for Google Ads UI. Output only valid JSON.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.1,
        max_tokens: 4000,
      }),
      signal: controller.signal,
    })

    clearTimeout(timeout)

    if (!res.ok) {
      console.error('[audience-translate] OpenAI error:', res.status, await res.text().catch(() => ''))
      return {}
    }
    const data = await res.json()
    const content = data.choices?.[0]?.message?.content ?? ''

    // Parse JSON from response (handle markdown code blocks)
    const jsonStr = content.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
    const translations = JSON.parse(jsonStr)
    console.log(`[audience-translate] OpenAI translated ${Object.keys(translations).length} names`)
    return translations as Record<string, string>
  } catch (e: any) {
    if (e.name === 'AbortError') {
      console.error('[audience-translate] OpenAI timeout (15s) for batch of', names.length, 'names')
    } else {
      console.error('[audience-translate] OpenAI error:', e.message || e)
    }
    return {}
  }
}

/* ================================================================== */
/*  MAIN TRANSLATION FUNCTION                                          */
/* ================================================================== */

/**
 * Translate a single audience segment name.
 * Fast path: static map + trips pattern + cache.
 * Does NOT call OpenAI (that's done in batch via translateSegmentsBatch).
 */
export function translateAudienceName(name: string, locale: string): string {
  if (locale !== 'tr') return name

  const lower = name.toLowerCase()

  // 1. Static map (instant)
  const mapped = STATIC_TR[lower]
  if (mapped) return mapped

  // 2. "Trips to X" pattern
  if (lower.startsWith('trips to ')) {
    const dest = name.substring('Trips to '.length)
    const trDest = TRIP_DEST_TR[dest.toLowerCase()] || dest
    return `${trDest} Seyahatleri`
  }

  // 3. Dynamic cache
  loadCache()
  const cached = dynamicCache[lower]
  if (cached) return cached

  // 4. Already Turkish or brand name → return as-is
  if (isAlreadyTurkish(name) || isBrandOrProperNoun(name)) return name

  // 5. Unknown English — will be translated in batch by translateSegmentsBatch
  return name
}

/**
 * Batch translate segments: identifies untranslated English names,
 * translates them via OpenAI in one call, caches results.
 */
export async function translateSegmentsBatch(
  names: string[],
  locale: string,
): Promise<Record<string, string>> {
  if (locale !== 'tr') return {}

  loadCache()

  // Find names that need dynamic translation
  const needsTranslation: string[] = []

  for (const name of names) {
    const lower = name.toLowerCase()
    if (STATIC_TR[lower]) continue
    if (lower.startsWith('trips to ')) continue
    if (dynamicCache[lower]) continue
    if (isAlreadyTurkish(name)) continue
    if (isBrandOrProperNoun(name)) continue
    needsTranslation.push(name)
  }

  if (needsTranslation.length === 0) return dynamicCache

  console.log(`[audience-translate] ${needsTranslation.length} new names to translate:`, needsTranslation.slice(0, 5))

  // Batch translate via OpenAI (max 50 at a time, ALL batches in PARALLEL)
  const batches: string[][] = []
  for (let i = 0; i < needsTranslation.length; i += 50) {
    batches.push(needsTranslation.slice(i, i + 50))
  }

  console.log(`[audience-translate] Sending ${batches.length} parallel batch(es) to OpenAI...`)
  const batchResults = await Promise.all(
    batches.map(batch => translateViaOpenAI(batch).catch(() => ({} as Record<string, string>)))
  )

  for (const translations of batchResults) {
    for (const [en, tr] of Object.entries(translations)) {
      dynamicCache[en.toLowerCase()] = tr
    }
  }

  // Persist cache
  saveCache()
  console.log(`[audience-translate] Cache saved. Total cached: ${Object.keys(dynamicCache).length}`)

  return dynamicCache
}

/**
 * Translate a Turkish search term to English using OpenAI.
 * Returns an array of relevant English search terms for GAQL queries.
 * Results are cached persistently so the same term is never re-translated.
 */
async function translateSearchTermViaOpenAI(turkishTerm: string): Promise<string[]> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return []

  const baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini'

  const prompt = `You are a Google Ads audience targeting expert.
The user is searching for audience segments in Turkish. Translate the Turkish search term to English equivalents that would match Google Ads audience segment names.

Turkish search term: "${turkishTerm}"

Return a JSON array of 3-8 English search terms that would match Google Ads audience categories (Affinity, In-Market, Life Events, Demographics).
Think about what Google Ads categories exist and what English names they use.
Include both broad and specific terms.

Example: "mobilya" → ["furniture", "home furnishings", "bedroom", "living room", "sofa", "home decor"]
Example: "araba" → ["car", "auto", "vehicle", "motor vehicle", "automotive"]
Example: "koltuk" → ["sofa", "couch", "furniture", "living room", "seating"]

Return ONLY a JSON array of strings, no explanation.`

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10_000)

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: 'You are a Google Ads expert translator. Output only valid JSON arrays.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.1,
        max_tokens: 500,
      }),
      signal: controller.signal,
    })

    clearTimeout(timeout)

    if (!res.ok) {
      console.error('[audience-translate] OpenAI search term error:', res.status)
      return []
    }

    const data = await res.json()
    const content = data.choices?.[0]?.message?.content ?? ''
    const jsonStr = content.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
    const terms = JSON.parse(jsonStr)

    if (Array.isArray(terms) && terms.every((t: any) => typeof t === 'string')) {
      console.log(`[audience-translate] OpenAI translated search "${turkishTerm}" → [${terms.join(', ')}]`)
      return terms as string[]
    }
    return []
  } catch (e: any) {
    if (e.name === 'AbortError') {
      console.error('[audience-translate] OpenAI search term timeout (10s) for:', turkishTerm)
    } else {
      console.error('[audience-translate] OpenAI search term parse error:', e)
    }
    return []
  }
}

/**
 * Find English search terms matching a Turkish query.
 * Uses 4 sources:
 * 1. Direct keyword map (SEARCH_KEYWORDS_TR_TO_EN) — most reliable for common terms
 * 2. Reverse lookup in STATIC_TR (Turkish value → English key)
 * 3. Reverse lookup in dynamic cache
 * 4. Dynamic OpenAI translation (fallback for unknown terms, cached persistently)
 */
export async function findEnglishTermsForSearch(turkishQuery: string): Promise<string[]> {
  const q = turkishQuery.toLowerCase()
  const matches: string[] = []

  // 1. Direct keyword map — returns ready-to-search English terms
  for (const [trKeyword, enTerms] of Object.entries(SEARCH_KEYWORDS_TR_TO_EN)) {
    if (q.includes(trKeyword) || trKeyword.includes(q)) {
      matches.push(...enTerms)
    }
  }

  // 2. Reverse lookup in static map (Turkish value contains query → English key)
  for (const [en, tr] of Object.entries(STATIC_TR)) {
    if (tr.toLowerCase().includes(q)) matches.push(en)
  }

  // 3. Reverse lookup in dynamic cache
  loadCache()
  for (const [en, tr] of Object.entries(dynamicCache)) {
    if (tr.toLowerCase().includes(q)) matches.push(en)
  }

  // 4. Dynamic OpenAI fallback — only if static sources returned few results
  if (matches.length < 3) {
    loadSearchCache()
    const cached = searchTermCache[q]
    if (cached) {
      // Use cached OpenAI result
      matches.push(...cached)
    } else {
      // Call OpenAI to translate
      const aiTerms = await translateSearchTermViaOpenAI(turkishQuery)
      if (aiTerms.length > 0) {
        searchTermCache[q] = aiTerms
        saveSearchCache()
        matches.push(...aiTerms)
      }
    }
  }

  return [...new Set(matches)] // deduplicate
}

/**
 * Check if a query might be Turkish
 */
export function mightBeTurkish(query: string): boolean {
  if (/[çğıöşüÇĞİÖŞÜ]/.test(query)) return true
  const q = query.toLowerCase()
  for (const tr of Object.values(STATIC_TR)) {
    if (tr.toLowerCase().includes(q)) return true
  }
  return false
}
