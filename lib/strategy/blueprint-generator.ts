import type { InputPayload, Blueprint, GoalType } from './types'

// ════════════════════════════════════════════════════════════
// Blueprint Generator — Sektör × Hedef × Bütçe × Ürün bazlı
// ════════════════════════════════════════════════════════════

export function generateBlueprint(input: InputPayload): Blueprint {
  const goal = input.goal_type
  const budget = input.monthly_budget_try
  const hasGoogle = input.channels.google
  const hasMeta = input.channels.meta
  const industry = input.industry || 'Diğer'
  const product = input.product || 'ürün'

  return {
    kpi_targets: getKPITargets(goal, budget, industry),
    funnel_split: getFunnelSplit(goal, industry, budget),
    channel_mix: getChannelMix(hasMeta, hasGoogle, goal, industry),
    personas: generatePersonas(industry, goal, product),
    creative_themes: generateCreativeThemes(goal, industry, product),
    experiment_backlog: generateExperiments(goal, budget, industry, hasMeta, hasGoogle, product),
    risks: generateRisks(input),
    tasks_seed: generateTaskSeeds(input),
  }
}

// ── Sektör bazlı KPI benchmark multipliers ──────────────────
const INDUSTRY_KPI_MULTIPLIERS: Record<string, { cpa: number; roas: number; ctr: number; cvr: number }> = {
  'E-Ticaret':           { cpa: 1.0, roas: 1.0, ctr: 1.0, cvr: 1.0 },
  'SaaS / Yazılım':     { cpa: 1.4, roas: 1.3, ctr: 0.8, cvr: 0.7 },
  'Eğitim':              { cpa: 0.7, roas: 0.9, ctr: 1.2, cvr: 1.1 },
  'Sağlık':              { cpa: 1.6, roas: 1.1, ctr: 0.9, cvr: 0.8 },
  'Finans':              { cpa: 1.8, roas: 1.4, ctr: 0.7, cvr: 0.6 },
  'Gayrimenkul':         { cpa: 1.5, roas: 1.2, ctr: 0.8, cvr: 0.5 },
  'Restoran / Yeme-İçme': { cpa: 0.6, roas: 0.8, ctr: 1.4, cvr: 1.3 },
  'Moda / Giyim':        { cpa: 0.9, roas: 1.1, ctr: 1.3, cvr: 1.0 },
  'Otomotiv':            { cpa: 2.0, roas: 1.5, ctr: 0.7, cvr: 0.4 },
  'Turizm / Otelcilik':  { cpa: 1.1, roas: 1.2, ctr: 1.1, cvr: 0.9 },
  'Spor / Fitness':      { cpa: 0.8, roas: 0.9, ctr: 1.3, cvr: 1.2 },
  'Güzellik / Kozmetik': { cpa: 0.8, roas: 1.0, ctr: 1.4, cvr: 1.1 },
  'Hukuk':               { cpa: 2.2, roas: 1.6, ctr: 0.6, cvr: 0.5 },
  'Danışmanlık':         { cpa: 1.3, roas: 1.2, ctr: 0.9, cvr: 0.7 },
}

function getIndustryMultiplier(industry: string) {
  return INDUSTRY_KPI_MULTIPLIERS[industry] || { cpa: 1.0, roas: 1.0, ctr: 1.0, cvr: 1.0 }
}

function getKPITargets(goal: GoalType, budget: number, industry: string) {
  const base = {
    awareness:  { cpa: [1, 5],     roas: [0, 0],    ctr: [0.5, 2],  cvr: [0, 0] },    // CPM odaklı — CPA burada "1000 gösterim maliyeti" gibi düşün
    traffic:    { cpa: [2, 10],    roas: [1, 3],    ctr: [3, 8],    cvr: [0.5, 2] },
    engagement: { cpa: [1, 8],     roas: [0, 0],    ctr: [2, 6],    cvr: [0, 0] },     // Etkileşim başına maliyet
    leads:      { cpa: [20, 80],   roas: [2, 6],    ctr: [2, 5],    cvr: [3, 8] },
    app:        { cpa: [10, 50],   roas: [2, 5],    ctr: [2, 6],    cvr: [2, 6] },
    sales:      { cpa: [50, 150],  roas: [3, 8],    ctr: [1.5, 4],  cvr: [1.5, 4] },
  }
  const t = base[goal] || base.sales
  const m = getIndustryMultiplier(industry)

  // Bütçe faktörü
  const bf = budget < 3000 ? 1.6 : budget < 5000 ? 1.4 : budget < 10000 ? 1.2 : budget < 20000 ? 1.1 : 1.0

  return {
    cpa_range: [Math.round(t.cpa[0] * m.cpa * bf), Math.round(t.cpa[1] * m.cpa * bf)] as [number, number],
    roas_range: [round1(t.roas[0] * m.roas), round1(t.roas[1] * m.roas)] as [number, number],
    ctr_range: [round1(t.ctr[0] * m.ctr), round1(t.ctr[1] * m.ctr)] as [number, number],
    cvr_range: [round1(t.cvr[0] * m.cvr), round1(t.cvr[1] * m.cvr)] as [number, number],
  }
}

function round1(n: number): number { return Math.round(n * 10) / 10 }

// ── Funnel Split — Sektör + Hedef + Bütçe bazlı ─────────────
function getFunnelSplit(goal: GoalType, industry: string, budget: number) {
  // Temel split — hedefe göre
  const base = {
    awareness:  { tofu: 70, mofu: 20, bofu: 10 },  // Farkındalık ağırlıklı
    traffic:    { tofu: 55, mofu: 30, bofu: 15 },
    engagement: { tofu: 50, mofu: 35, bofu: 15 },  // İlişki kurma ağırlıklı
    leads:      { tofu: 35, mofu: 40, bofu: 25 },
    app:        { tofu: 40, mofu: 35, bofu: 25 },
    sales:      { tofu: 30, mofu: 35, bofu: 35 },
  }
  const split = { ...(base[goal] || base.sales) }

  // Sektör ayarlamaları
  const highConsideration = ['SaaS / Yazılım', 'Finans', 'Gayrimenkul', 'Otomotiv', 'Hukuk']
  const impulse = ['E-Ticaret', 'Moda / Giyim', 'Güzellik / Kozmetik', 'Restoran / Yeme-İçme']

  if (highConsideration.includes(industry)) {
    // Uzun karar süreci → daha fazla MOFU
    split.tofu -= 5; split.mofu += 10; split.bofu -= 5
  } else if (impulse.includes(industry)) {
    // Hızlı karar → daha fazla BOFU
    split.tofu -= 5; split.mofu -= 5; split.bofu += 10
  }

  // Düşük bütçe → BOFU ağırlıklı (hızlı dönüşüm)
  if (budget < 5000) {
    split.tofu -= 10; split.bofu += 10
  }

  // Normalize (toplam 100 olsun)
  const total = split.tofu + split.mofu + split.bofu
  split.tofu = Math.round(split.tofu / total * 100)
  split.mofu = Math.round(split.mofu / total * 100)
  split.bofu = 100 - split.tofu - split.mofu

  return split
}

// ── Kanal Karması — Sektör + Hedef bazlı ─────────────────────
function getChannelMix(hasMeta: boolean, hasGoogle: boolean, goal: GoalType, industry: string) {
  if (!hasMeta && !hasGoogle) return { meta: 60, google: 40 }
  if (!hasGoogle) return { meta: 100, google: 0 }
  if (!hasMeta) return { meta: 0, google: 100 }

  // Her iki kanal aktif — sektöre göre ağırlık
  const googleStrong = ['SaaS / Yazılım', 'Hukuk', 'Sağlık', 'Finans', 'Gayrimenkul']
  const metaStrong = ['E-Ticaret', 'Moda / Giyim', 'Güzellik / Kozmetik', 'Restoran / Yeme-İçme', 'Spor / Fitness', 'Turizm / Otelcilik']

  if (goal === 'awareness' || goal === 'engagement') return { meta: 80, google: 20 }  // Meta sosyal medya odaklı
  if (goal === 'traffic') return { meta: 70, google: 30 }
  if (goal === 'leads' && googleStrong.includes(industry)) return { meta: 35, google: 65 }
  if (metaStrong.includes(industry)) return { meta: 65, google: 35 }
  if (googleStrong.includes(industry)) return { meta: 40, google: 60 }

  return { meta: 55, google: 45 }
}

// ── Persona Seti — Sektör × Hedef × Ürün bazlı ─────────────
function generatePersonas(industry: string, goal: GoalType, product: string): Blueprint['personas'] {
  const p: Record<string, Blueprint['personas']> = {
    'E-Ticaret': [
      { name: 'Planlı Alıcı', pain: 'Araştırma yapıyor ama karar veremiyor', promise: 'Net karşılaştırma ve güven', proof: 'Müşteri yorumları ve iade garantisi' },
      { name: 'İmpulsif Alıcı', pain: 'Fırsatı kaçırmak istemiyor', promise: 'Sınırlı süre teklifleri', proof: 'Stok sayacı ve sosyal kanıt' },
      { name: 'Sadık Müşteri', pain: 'Aynı kaliteyi tekrar bulmak istiyor', promise: 'Sadakat avantajları', proof: 'Özel indirimler ve erken erişim' },
      { name: 'Fiyat Avcısı', pain: 'En iyi fiyatı arıyor', promise: 'Fiyat eşleştirme garantisi', proof: 'Fiyat karşılaştırma ve kupon' },
    ],
    'SaaS / Yazılım': [
      { name: 'Teknik Karar Verici (CTO/IT)', pain: 'Entegrasyon karmaşıklığı ve güvenlik endişesi', promise: 'Kolay entegrasyon, enterprise güvenlik', proof: 'Teknik dokümantasyon ve SOC2 sertifikası' },
      { name: 'İş Birimi Yöneticisi', pain: 'Manuel süreçler zaman kaybettiriyor', promise: 'Otomasyon ile %X verimlilik artışı', proof: 'ROI hesaplaması ve vaka çalışmaları' },
      { name: 'Startup Kurucusu', pain: 'Sınırlı bütçe ile hızlı büyüme', promise: 'Startup-dostu fiyatlandırma', proof: 'Ücretsiz deneme ve başarı hikayeleri' },
    ],
    'Eğitim': [
      { name: 'Kariyer Değiştirici', pain: 'Mevcut işinden memnun değil, yeni beceri lazım', promise: 'Sertifikalı eğitim ile kariyer dönüşümü', proof: 'Mezun başarı hikayeleri ve iş bulma oranları' },
      { name: 'Veli', pain: 'Çocuğunun geleceği için doğru eğitim', promise: 'Kanıtlanmış öğrenme metodolojisi', proof: 'Akademik başarı istatistikleri' },
      { name: 'Kurumsal Eğitim Müdürü', pain: 'Çalışan yetkinlik açığı', promise: 'Ölçülebilir yetkinlik gelişimi', proof: 'Kurumsal referanslar ve öncesi-sonrası verileri' },
    ],
    'Sağlık': [
      { name: 'Hasta / Birey', pain: 'Sağlık sorunu çözümü arıyor, güvensiz', promise: 'Uzman kadro ve modern tedavi', proof: 'Doktor profilleri ve hasta yorumları' },
      { name: 'Sağlık Bilinci Yüksek', pain: 'Önleyici sağlık hizmeti arıyor', promise: 'Check-up paketleri ve düzenli takip', proof: 'Sağlık göstergeleri ve tarama sonuçları' },
      { name: 'Acil İhtiyaç', pain: 'Hemen randevu ve tedavi lazım', promise: 'Aynı gün randevu', proof: 'Konum yakınlığı ve 7/24 hizmet' },
    ],
    'Finans': [
      { name: 'Yatırımcı Adayı', pain: 'Birikimini değerlendirmek istiyor ama bilgisi yok', promise: 'Uzman rehberliğinde güvenli yatırım', proof: 'Geçmiş performans verileri ve lisanslar' },
      { name: 'KOBİ Sahibi', pain: 'Finansman / kredi ihtiyacı', promise: 'Hızlı onay ve uygun faiz', proof: 'Onay süreleri ve müşteri memnuniyeti' },
      { name: 'Dijital Bankacılık Kullanıcısı', pain: 'Şubeye gitmek istemiyor', promise: 'Tüm işlemler mobilde', proof: 'App store puanları ve kullanıcı sayısı' },
    ],
    'Gayrimenkul': [
      { name: 'İlk Ev Alıcısı', pain: 'Süreç karmaşık, bütçe kısıtlı', promise: 'Adım adım rehberlik', proof: 'Teslim edilen proje görselleri' },
      { name: 'Yatırımcı', pain: 'Doğru lokasyon ve değer artışı', promise: 'Yatırım getirisi analizi', proof: 'Bölge değer artış verileri' },
      { name: 'Kiracı', pain: 'Güvenilir ve uygun fiyatlı konut', promise: 'Doğrulanmış ilanlar', proof: 'Sanal tur ve gerçek fotoğraflar' },
    ],
    'Restoran / Yeme-İçme': [
      { name: 'Yemek Keşfedicisi', pain: 'Yeni lezzetler denemek istiyor', promise: 'Benzersiz menü deneyimi', proof: 'Yemek fotoğrafları ve şef hikayesi' },
      { name: 'Aile / Grup', pain: 'Herkesin beğeneceği bir yer arıyor', promise: 'Geniş menü ve çocuk dostu', proof: 'Google yorumları ve ambiyans fotoğrafları' },
      { name: 'Online Sipariş', pain: 'Hızlı ve sıcak teslimat', promise: 'X dakikada kapında', proof: 'Teslimat süresi ve paketleme kalitesi' },
    ],
    'Moda / Giyim': [
      { name: 'Trend Takipçisi', pain: 'Her sezon yeni parçalar istiyor', promise: 'Sezonun en trend parçaları', proof: 'Influencer giyimleri ve sosyal medya' },
      { name: 'Kalite Odaklı', pain: 'Dayanıklı ve iyi kumaş arıyor', promise: 'Premium malzeme ve işçilik', proof: 'Kumaş detayları ve müşteri yorumları' },
      { name: 'Bütçe Bilinçli', pain: 'Şık giyinmek istiyor ama bütçesi sınırlı', promise: 'Stil/fiyat dengesi', proof: 'İndirim kampanyaları ve kombin önerileri' },
    ],
    'Otomotiv': [
      { name: 'İlk Araç Alıcısı', pain: 'Hangi aracı alacağını bilmiyor', promise: 'Kişiselleştirilmiş araç önerisi', proof: 'Karşılaştırma tablosu ve test sürüşü' },
      { name: 'Araç Değiştirici', pain: 'Mevcut aracını satıp yenisini almak istiyor', promise: 'Takas kolaylığı ve değerleme', proof: 'Anında takas fiyatı ve süreç basitliği' },
      { name: 'Filo Yöneticisi', pain: 'Maliyet optimizasyonu ve bakım', promise: 'Toplu fiyat avantajı ve bakım paketi', proof: 'Filo müşteri referansları' },
    ],
    'Turizm / Otelcilik': [
      { name: 'Tatilci Aile', pain: 'Çocuklu güvenli ve eğlenceli tatil', promise: 'Aile dostu tesis ve aktiviteler', proof: 'Aile yorumları ve çocuk kulübü görselleri' },
      { name: 'Kaçamak Çift', pain: 'Romantik ve huzurlu ortam', promise: 'Özel deneyimler (spa, akşam yemeği)', proof: 'Atmosfer görselleri ve çift yorumları' },
      { name: 'İş Seyahati', pain: 'Konfor ve lokasyon öncelikli', promise: 'Merkezi konum ve iş donatıları', proof: 'Business yorumları ve Wi-Fi hızı' },
    ],
    'Spor / Fitness': [
      { name: 'Başlangıç Seviye', pain: 'Spora başlamak istiyor ama korkuyor', promise: 'Kişisel eğitmen ve başlangıç programı', proof: 'Dönüşüm hikayeleri (before-after)' },
      { name: 'Düzenli Sporcu', pain: 'Platoya ulaştı, gelişmek istiyor', promise: 'İleri seviye programlar', proof: 'Performans verileri ve uzman kadro' },
      { name: 'Online Fitness', pain: 'Salona gidemiyorum ama fit kalmak istiyorum', promise: 'Evden canlı/kayıtlı antrenman', proof: 'App özellikleri ve kullanıcı sonuçları' },
    ],
    'Güzellik / Kozmetik': [
      { name: 'Cilt Bakım Meraklısı', pain: 'Cilt sorunları (akne, leke, kırışıklık)', promise: 'Klinik olarak kanıtlanmış sonuçlar', proof: 'Dermatolog onayı ve öncesi-sonrası' },
      { name: 'Doğal/Organik Tercih', pain: 'Kimyasal içeriklerden kaçınıyor', promise: '%100 doğal formül', proof: 'İçerik şeffaflığı ve sertifikalar' },
      { name: 'Makyaj Tutkunu', pain: 'Yeni ürünleri denemek istiyor', promise: 'Trend renkler ve koleksiyonlar', proof: 'Influencer denemeleri ve swatchlar' },
    ],
    'Hukuk': [
      { name: 'Bireysel Müvekkil', pain: 'Hukuki sorun var ama avukata güvenmiyor', promise: 'İlk görüşme ücretsiz, şeffaf ücret', proof: 'Kazanılan dava oranı ve müvekkil yorumları' },
      { name: 'Kurumsal Müvekkil', pain: 'Sürekli hukuk danışmanlığı gerekiyor', promise: 'Retainer model ile maliyet avantajı', proof: 'Kurumsal referanslar ve uzmanlık alanları' },
      { name: 'Acil Hukuki Destek', pain: 'İcra, tutuklama veya acil durum', promise: '7/24 ulaşılabilir avukat', proof: 'Acil durum müdahale süreleri' },
    ],
    'Danışmanlık': [
      { name: 'KOBİ Sahibi', pain: 'İşi büyütmek istiyor ama nasıl bilmiyor', promise: 'Stratejik yol haritası ve mentorluk', proof: 'Müşteri büyüme verileri' },
      { name: 'Kurumsal Yönetici', pain: 'Organizasyonel dönüşüm gerekiyor', promise: 'Kanıtlanmış metodoloji ve uygulama desteği', proof: 'Fortune 500 referansları ve vaka çalışmaları' },
      { name: 'Startup', pain: 'Hızlı ölçeklenmek istiyor', promise: 'Growth hacking ve pivot stratejileri', proof: 'Yatırım alan müşteri hikayeleri' },
    ],
  }

  // Sektör eşleşmesi varsa kullan, yoksa hedefe göre generic üret
  if (p[industry]) return p[industry]

  // Generic — hizmete uygun doğal dilde
  return [
    { name: 'Karar Verici', pain: 'Güvenilir ve kaliteli bir hizmet arıyor', promise: 'Kanıtlanmış sonuçlar ve güven', proof: 'Müşteri referansları ve vaka çalışmaları' },
    { name: 'Araştırmacı', pain: 'Farklı seçenekleri karşılaştırıp en iyisini bulmak istiyor', promise: 'Net avantaj ve fark', proof: 'Karşılaştırma ve müşteri yorumları' },
    { name: 'Acil İhtiyaç', pain: 'Hızlı bir şekilde çözüme ulaşmak istiyor', promise: 'Hızlı sonuç ve kolay süreç', proof: 'Hızlı hizmet garantisi ve müşteri memnuniyeti' },
    { name: 'Fiyat Hassasiyeti', pain: 'Bütçe kısıtlı ama kaliteden ödün vermek istemiyor', promise: 'En iyi değer/fiyat oranı', proof: 'Şeffaf fiyatlandırma ve ödeme seçenekleri' },
  ]
}

// ── Kreatif Temalar — Sektör × Hedef × Ürün bazlı ──────────
function generateCreativeThemes(goal: GoalType, industry: string, product: string): Blueprint['creative_themes'] {
  const themes: Blueprint['creative_themes'] = []

  // Sektöre özgü hook'lar
  const hooks: Record<string, string[]> = {
    'E-Ticaret': [`${product} alırken herkesin yaptığı 3 hata`, `Bu hafta ${product} siparişlerinde %30 indirim`, `${product} koleksiyonumuz yenilendi`],
    'SaaS / Yazılım': [`${product} olmadan geçirdiğiniz her gün size X TL\'ye mal oluyor`, `${product} ile 10 dakikada kurulum`, `Neden 5000+ şirket ${product} kullanıyor?`],
    'Eğitim': [`3 ayda ${product} uzmanı olun`, `"Bu eğitim hayatımı değiştirdi" — Mezun hikayesi`, `${product} sertifikanızı hemen alın`],
    'Sağlık': [`Sağlığınız için ${product} hakkında bilmeniz gereken 5 şey`, `Uzman doktorlarımız ${product} hakkında uyarıyor`, `Online randevu — beklemeden tedavi`],
    'Finans': [`Paranızı ${product} ile büyütmenin 3 yolu`, `Aylık X TL birikim ile finansal özgürlük`, `Başvurunuz 2 dakikada onaylanıyor`],
    'Moda / Giyim': [`Bu sezonun must-have parçası: ${product}`, `Stilinizi yansıtan ${product} kombinleri`, `İlk alışverişe %20 hoş geldin indirimi`],
    'Güzellik / Kozmetik': [`Cildinizdeki farkı 7 günde görün`, `Dermatolog onaylı ${product} formülü`, `${product} rutinim — adım adım rehber`],
    'Restoran / Yeme-İçme': [`Bu lezzeti denemelisiniz: ${product}`, `Şefimizin özel tarifi ile hazırlanan ${product}`, `Online sipariş — 30 dk\'da kapında`],
    'Gayrimenkul': [`Hayalinizdeki ev ${product} lokasyonunda`, `${product} bölgesinde yatırım fırsatı`, `Sanal tur ile evinizi keşfedin`],
    'Turizm / Otelcilik': [`Bu yaz ${product} sizi bekliyor`, `Erken rezervasyonda %40\'a varan indirim`, `Sadece bizde: ${product} özel deneyimi`],
  }

  const industryHooks = hooks[industry] || [
    `Doğru hizmeti seçmenin en kolay yolu`,
    `Müşterilerimiz neden bizi tercih ediyor?`,
    `Hizmetimizi deneyenler ne diyor?`,
  ]

  // 1. Problem-Çözüm (her sektör)
  themes.push({ theme: 'Problem-Çözüm', hook: industryHooks[0], offer: goal === 'leads' ? 'Ücretsiz danışmanlık' : 'Özel fiyat teklifi', format: 'video' })

  // 2. Sosyal Kanıt
  themes.push({ theme: 'Sosyal Kanıt', hook: industryHooks[2], offer: 'Müşteri hikayeleri', format: 'ugc' })

  // 3. Sektöre özgü format
  const visualIndustries = ['E-Ticaret', 'Moda / Giyim', 'Güzellik / Kozmetik', 'Restoran / Yeme-İçme', 'Turizm / Otelcilik', 'Gayrimenkul']
  if (visualIndustries.includes(industry)) {
    themes.push({ theme: 'Before-After / Görsel', hook: `Öncesi ve sonrası — farkı görün`, offer: 'Görsel dönüşüm', format: 'image' })
  } else {
    themes.push({ theme: 'Hizmet Tanıtımı', hook: `Sizin için nasıl çalışıyor? Adım adım süreç`, offer: 'Süreç videosu', format: 'video' })
  }

  // 4. Eğitim içerik
  themes.push({ theme: 'Eğitim İçerik', hook: industryHooks[1], offer: goal === 'leads' ? 'Ücretsiz rehber' : 'Bilgilendirici içerik', format: 'video' })

  // 5. Hedefe göre özel tema
  if (goal === 'sales' || goal === 'app') {
    themes.push({ theme: 'FOMO / Aciliyet', hook: 'Sınırlı süre — bu fırsatı kaçırmayın', offer: 'Zamanlı kampanya', format: 'image' })
  } else if (goal === 'awareness') {
    themes.push({ theme: 'Marka Hikayesi', hook: 'Bizi tanıyın — hikayemiz burada başlıyor', offer: 'Marka tanıtım videosu', format: 'video' })
  } else if (goal === 'engagement') {
    themes.push({ theme: 'Etkileşim / Soru-Cevap', hook: 'Sizce hangisi? Yorumlarda tartışalım', offer: 'İnteraktif içerik', format: 'image' })
  } else {
    themes.push({ theme: 'Değer Teklifi', hook: 'Neden bizi tercih etmelisiniz? İşte 3 neden', offer: 'Değer karşılaştırması', format: 'image' })
  }

  // 6. Otorite / UGC — sektöre göre
  const authorityMap: Record<string, string> = {
    'Sağlık': 'Uzman doktor görüşü',
    'Hukuk': 'Kıdemli avukat değerlendirmesi',
    'Finans': 'Finansal danışman tavsiyesi',
    'Eğitim': 'Eğitimci perspektifi',
    'Güzellik / Kozmetik': 'Dermatolog / uzman onayı',
  }
  themes.push({
    theme: 'Otorite / Uzman',
    hook: authorityMap[industry] || 'Gerçek müşteri deneyimleri ve uzman değerlendirmeleri',
    offer: 'Uzman içeriği',
    format: 'ugc',
  })

  return themes
}

// ── Deneyler — Sektör × Hedef × Bütçe × Kanal × Ürün bazlı ────────
function generateExperiments(goal: GoalType, budget: number, industry: string, hasMeta: boolean, hasGoogle: boolean, product?: string): Blueprint['experiment_backlog'] {
  const experiments: Blueprint['experiment_backlog'] = []
  const p = product || 'ürün'

  // Her zaman: Kreatif format testi (ürün bağlamında)
  experiments.push({ hypothesis: `${p} için video kreatifler statik görsellere göre daha yüksek CTR getirir`, metric: 'CTR', test: `A/B: ${p} video vs statik görsel`, priority: 'high' })

  // Meta varsa
  if (hasMeta) {
    experiments.push({ hypothesis: `${p} hedef kitlesi için broad targeting, interest targeting'e göre daha düşük CPA sağlar`, metric: 'CPA', test: `Meta: ${p} — Broad vs Interest targeting`, priority: 'high' })
    if (goal === 'sales' || goal === 'app') {
      experiments.push({ hypothesis: `${p} için Advantage+ kampanya manuel kampanyaya göre daha iyi ROAS verir`, metric: 'ROAS', test: `Meta: ${p} — ASC vs Manuel kampanya`, priority: 'med' })
    }
    if (goal === 'engagement') {
      experiments.push({ hypothesis: `${p} için carousel format tekli görsele göre daha fazla etkileşim alır`, metric: 'Engagement Rate', test: `Meta: Carousel vs Tekli görsel — ${p}`, priority: 'high' })
    }
    if (goal === 'leads') {
      experiments.push({ hypothesis: `${p} için Instant Form, web sitesi formuna göre daha düşük CPL sağlar`, metric: 'CPL', test: `Meta: Lead Ads Instant Form vs Web Form — ${p}`, priority: 'high' })
    }
  }

  // Google varsa
  if (hasGoogle) {
    experiments.push({ hypothesis: `${p} için Performance Max, Search kampanyasından daha iyi dönüşüm sağlar`, metric: 'Conversions', test: `Google: ${p} — PMax vs Search`, priority: 'high' })
    if (goal === 'sales') {
      experiments.push({ hypothesis: `${p} Shopping kampanyası standart Search'e göre daha düşük CPA sağlar`, metric: 'CPA', test: `Google: ${p} Shopping vs Search`, priority: 'med' })
    }
  }

  // Sektöre özgü
  const visualIndustries = ['E-Ticaret', 'Moda / Giyim', 'Güzellik / Kozmetik', 'Restoran / Yeme-İçme']
  if (visualIndustries.includes(industry)) {
    experiments.push({ hypothesis: `${p} UGC içeriği profesyonel içeriğe göre daha yüksek engagement sağlar`, metric: 'CTR', test: `A/B: ${p} UGC vs Profesyonel kreatif`, priority: 'high' })
  }

  const b2bIndustries = ['SaaS / Yazılım', 'Danışmanlık', 'Finans', 'Hukuk']
  if (b2bIndustries.includes(industry)) {
    experiments.push({ hypothesis: `${p} hakkında lead magnet (e-kitap/webinar) doğrudan forma göre daha kaliteli lead getirir`, metric: 'Lead Quality', test: `${p} Lead magnet vs Doğrudan form`, priority: 'high' })
  }

  // Hedefe özgü deneyler
  if (goal === 'awareness') {
    experiments.push({ hypothesis: `${p} marka tanıtım videosu 15sn vs 30sn — hangisi daha yüksek Ad Recall sağlar`, metric: 'Ad Recall Lift', test: `${p} video uzunluğu testi: 15sn vs 30sn`, priority: 'high' })
  }
  if (goal === 'traffic') {
    experiments.push({ hypothesis: `${p} için farklı açılış sayfası tasarımları bounce rate'i etkiler`, metric: 'Bounce Rate', test: `${p} landing page A/B — uzun vs kısa sayfa`, priority: 'med' })
  }

  // Retargeting (yeterli bütçe varsa)
  if (budget >= 5000) {
    experiments.push({ hypothesis: `${p} retargeting kampanyası ROAS'ı %50+ artırır`, metric: 'ROAS', test: `${p} retargeting segment oluştur ve test et`, priority: 'med' })
    experiments.push({ hypothesis: `${p} Lookalike %1 vs %3 audience CPA farkı`, metric: 'CPA', test: `${p} LAL 1% vs 3% karşılaştırma`, priority: 'med' })
  }

  // Düşük bütçe için
  if (budget < 5000) {
    experiments.push({ hypothesis: `${p} için tek kampanya ile fokuslanmak bölünmüş bütçeden daha iyi sonuç verir`, metric: 'CPA', test: `${p} — Tek kampanya vs çoklu kampanya`, priority: 'high' })
  }

  // Genel — ürüne özel CTA
  const ctaExamples = goal === 'leads' ? 'Ücretsiz Bilgi Al vs Hemen Başvur vs Teklif İste' :
    goal === 'sales' ? 'Şimdi Al vs Sepete Ekle vs Fırsatı Kaçırma' :
    goal === 'awareness' ? 'Daha Fazla Bilgi vs Keşfet vs Hikayemizi İzle' :
    'Detaylı Bilgi vs Şimdi İncele vs Ücretsiz Dene'
  experiments.push({ hypothesis: `${p} için farklı CTA'ler dönüşüm oranını etkiler`, metric: 'CVR', test: `A/B: CTA varyasyonları (${ctaExamples})`, priority: 'low' })

  return experiments
}

// ── Riskler — Sektör + Input + Ürün bazlı ──────────────────────────
function generateRisks(input: InputPayload): Blueprint['risks'] {
  const risks: Blueprint['risks'] = []
  const industry = input.industry || ''
  const p = input.product || 'ürün'
  const goal = input.goal_type

  if (input.integrations.pixel === 'red') {
    risks.push({ risk: `Pixel/Tag kurulu değil — ${p} dönüşüm takibi yapılamaz`, mitigation: 'Öncelikli olarak pixel kurulumu yapılmalı' })
  }
  if (input.integrations.analytics === 'red') {
    risks.push({ risk: `Analytics entegrasyonu eksik — ${p} trafik analizi kör nokta`, mitigation: 'GA4 veya benzeri analytics kurun' })
  }

  if (input.monthly_budget_try < 3000) {
    risks.push({ risk: `${p} için çok düşük bütçe (${input.monthly_budget_try.toLocaleString('tr-TR')} TL) — öğrenme fazı çok uzayabilir`, mitigation: `${p} için tek kampanya + tek hedef kitle ile başla. Minimum 2 hafta sabır.` })
  } else if (input.monthly_budget_try < 5000) {
    risks.push({ risk: `${p} için düşük bütçe (${input.monthly_budget_try.toLocaleString('tr-TR')} TL) — öğrenme fazı uzayabilir`, mitigation: `${p} için maksimum 2 kampanya ile başla` })
  } else if (input.monthly_budget_try >= 20000) {
    risks.push({ risk: `Yüksek bütçe (${input.monthly_budget_try.toLocaleString('tr-TR')} TL) — bütçe verimsiz harcama riski`, mitigation: `${p} kampanyalarını kademeli artır, günlük harcama limitlerini kontrol et` })
  }

  // Sektöre özgü riskler
  const highCPC = ['Finans', 'Hukuk', 'Sağlık', 'Gayrimenkul', 'Otomotiv', 'SaaS / Yazılım']
  if (highCPC.includes(industry)) {
    risks.push({ risk: `${industry} sektöründe ${p} için CPC ortalaması yüksek — bütçe hızla tükenebilir`, mitigation: `${p} özelinde long-tail keyword ve niş kitle segmentleri kullan. Negatif liste hazırla.` })
  }

  const seasonal = ['Turizm / Otelcilik', 'E-Ticaret', 'Moda / Giyim']
  if (seasonal.includes(industry)) {
    risks.push({ risk: `${p} — sezonsellik etkisi, düşük sezonda performans düşebilir`, mitigation: `${p} için sezon öncesi bütçe artır, düşük sezonda retargeting ağırlıklı çalış` })
  }

  const regulated = ['Sağlık', 'Finans', 'Hukuk']
  if (regulated.includes(industry)) {
    risks.push({ risk: `${industry} sektöründe ${p} reklamı — platform politikaları sıkı, onay reddi riski`, mitigation: `${p} kreatiflerinde platform reklam politikalarını önceden incele, uyumlu içerik hazırla` })
  }

  // Hedefe özgü riskler
  if (goal === 'awareness') {
    risks.push({ risk: `${p} bilinirlik kampanyası — doğrudan satış/lead dönüşümü beklentisi hayal kırıklığı yaratabilir`, mitigation: 'Bilinirlik KPI\'ları (CPM, Reach, Ad Recall) takip et, dönüşüm bekleme' })
  }
  if (goal === 'leads' && input.integrations.crm === 'red') {
    risks.push({ risk: `${p} lead toplama hedefi var ama CRM entegrasyonu yok — leadler kaybolabilir`, mitigation: 'CRM bağlantısını kurarak lead takibi ve kalite skorlaması yap' })
  }
  if (goal === 'app') {
    risks.push({ risk: `${p} uygulama tanıtımı — SDK entegrasyonu eksikse yükleme ve uygulama içi olay takibi yapılamaz`, mitigation: 'Facebook SDK / CAPI kurulumunu doğrula, app event\'leri test et' })
  }

  // Coğrafya riski
  if (input.geographies && input.geographies.length > 1) {
    risks.push({ risk: `${p} için ${input.geographies.length} farklı coğrafyada yayın — bütçe dağılımı verimsiz olabilir`, mitigation: `Öncelikli coğrafya belirle, ardından genişlet. ${input.geographies.join(', ')} için ayrı kampanyalar kur.` })
  }

  // Genel riskler (ürüne özgü)
  risks.push({ risk: `${p} kreatif yorgunluğu (genellikle 2-3 hafta sonra)`, mitigation: `${p} için haftalık yeni kreatif rotasyonu planla, minimum 3-4 varyasyon hazır tut` })

  if (input.channels.meta && input.channels.google) {
    risks.push({ risk: `${p} çok kanallı (Meta + Google) attribution karmaşıklığı`, mitigation: `${p} kampanyalarında UTM parametreleri ve cross-channel attribution modeli kur` })
  }

  // Margin riski
  if (input.margin_pct && input.margin_pct < 20 && (goal === 'sales' || goal === 'leads')) {
    risks.push({ risk: `${p} marjı düşük (%${input.margin_pct}) — yüksek CPA kârlılığı sıfırlayabilir`, mitigation: `CPA hedefini ${Math.round(input.margin_pct * (input.avg_basket || 100) / 100)} TL altında tutmayı hedefle` })
  }

  return risks
}

// ── Görev Tohumları — Sektör + Input + Ürün + Hedef bazlı ───────────────────
function generateTaskSeeds(input: InputPayload): Blueprint['tasks_seed'] {
  const tasks: Blueprint['tasks_seed'] = []
  const p = input.product || 'ürün'
  const goal = input.goal_type
  const budget = input.monthly_budget_try

  // Ölçümleme — entegrasyon durumuna göre
  if (input.integrations.pixel !== 'green') {
    tasks.push({ title: `${p} için Pixel / Conversion Tag kurulumu ve doğrulaması`, category: 'measurement', priority: 'high' })
  }
  if (input.integrations.analytics !== 'green') {
    tasks.push({ title: `${p} Analytics (GA4) kurulumu ve hedef tanımlama`, category: 'measurement', priority: 'high' })
  }

  // Hedefe özgü ölçümleme görevleri
  if (goal === 'sales') {
    tasks.push({ title: `${p} satış dönüşüm olaylarını tanımla (Purchase, AddToCart, InitiateCheckout)`, category: 'measurement', priority: 'high' })
  } else if (goal === 'leads') {
    tasks.push({ title: `${p} lead dönüşüm olaylarını tanımla (Lead, CompleteRegistration)`, category: 'measurement', priority: 'high' })
  } else if (goal === 'awareness') {
    tasks.push({ title: `${p} marka bilinirliği KPI'larını tanımla (Reach, Impression, Ad Recall)`, category: 'measurement', priority: 'high' })
  } else if (goal === 'engagement') {
    tasks.push({ title: `${p} etkileşim metriklerini tanımla (Post Engagement, ThruPlay, Messages)`, category: 'measurement', priority: 'high' })
  } else if (goal === 'traffic') {
    tasks.push({ title: `${p} trafik metriklerini tanımla (Landing Page Views, CPC, Bounce Rate)`, category: 'measurement', priority: 'high' })
  } else if (goal === 'app') {
    tasks.push({ title: `${p} uygulama SDK entegrasyonunu kur (App Install, App Event)`, category: 'measurement', priority: 'high' })
  }

  // Kitle — hedefe ve bütçeye göre
  tasks.push({ title: `${p} hedef kitle araştırması ve core audience segmentleri oluştur`, category: 'audience', priority: 'high' })
  if (budget >= 5000) {
    tasks.push({ title: `${p} müşteri verilerinden Lookalike audience oluştur (%1 ve %3)`, category: 'audience', priority: 'med' })
    if (goal === 'sales' || goal === 'leads') {
      tasks.push({ title: `${p} retargeting audience oluştur (site ziyaretçileri + sepet/form terk)`, category: 'audience', priority: 'med' })
    }
  }

  // Coğrafya özel
  if (input.geographies && input.geographies.length > 1) {
    tasks.push({ title: `${p} için ${input.geographies.join(', ')} coğrafya hedeflemelerini ayarla`, category: 'audience', priority: 'med' })
  }

  // Kreatif — sektöre ve ürüne göre
  const visualIndustries = ['E-Ticaret', 'Moda / Giyim', 'Güzellik / Kozmetik', 'Restoran / Yeme-İçme', 'Turizm / Otelcilik']
  if (visualIndustries.includes(input.industry)) {
    tasks.push({ title: `${p} fotoğraf çekimi / görsel hazırlığı (min 5 görsel)`, category: 'creative', priority: 'high' })
    tasks.push({ title: `${p} UGC / kullanıcı içeriği topla veya üret`, category: 'creative', priority: 'med' })
  }
  tasks.push({ title: `${p} ilk kreatif setini hazırla (min 3 varyasyon)`, category: 'creative', priority: 'high' })
  tasks.push({ title: `${p} video kreatif üret (15-30sn)`, category: 'creative', priority: 'med' })

  // Kampanya — hedefe özel
  if (goal === 'awareness') {
    tasks.push({ title: `${p} Reach & Frequency kampanya yapısını kur (${budget.toLocaleString('tr-TR')} TL/ay)`, category: 'campaign', priority: 'high' })
  } else if (goal === 'traffic') {
    tasks.push({ title: `${p} trafik kampanyasını kur — landing page optimize et`, category: 'campaign', priority: 'high' })
  } else if (goal === 'engagement') {
    tasks.push({ title: `${p} etkileşim kampanyasını kur — Messenger/DM akışı hazırla`, category: 'campaign', priority: 'high' })
  } else if (goal === 'leads') {
    tasks.push({ title: `${p} lead kampanyası kur — Instant Form veya landing page hazırla`, category: 'campaign', priority: 'high' })
  } else if (goal === 'app') {
    tasks.push({ title: `${p} uygulama yükleme kampanyasını kur — deep link ve app event ayarla`, category: 'campaign', priority: 'high' })
  } else {
    tasks.push({ title: `${p} satış kampanya yapısını kur ve bütçe dağılımını ayarla (${budget.toLocaleString('tr-TR')} TL/ay)`, category: 'campaign', priority: 'high' })
  }

  if (input.channels.google) {
    tasks.push({ title: `${p} Google Ads anahtar kelime araştırması ve negatif liste`, category: 'campaign', priority: 'high' })
  }

  // Kurulum
  if (input.integrations.crm !== 'green' && (goal === 'leads' || goal === 'sales')) {
    tasks.push({ title: `${p} CRM entegrasyonu (lead/müşteri takibi için)`, category: 'setup', priority: 'high' })
  }

  // LTV varsa
  if (input.ltv && input.ltv > 0) {
    tasks.push({ title: `${p} LTV bazlı bid stratejisi belirle (LTV: ${input.ltv} TL)`, category: 'campaign', priority: 'med' })
  }

  // Sepet değeri varsa
  if (input.avg_basket && input.avg_basket > 0 && goal === 'sales') {
    tasks.push({ title: `${p} ortalama sepet değerini (${input.avg_basket} TL) artırmak için cross-sell kampanyası planla`, category: 'campaign', priority: 'low' })
  }

  return tasks
}

// ── Veri Kalitesi Skoru ──────────────────────────────────────
export function calculateDataQuality(input: InputPayload): { score: number; missing: string[] } {
  let score = 0
  const missing: string[] = []

  if (input.goal_type) score += 10; else missing.push('İş hedefi seçilmeli')
  if (input.product?.trim()) score += 10; else missing.push('Ürün/hizmet girilmeli')
  if (input.industry) score += 10; else missing.push('Sektör seçilmeli')
  if (input.monthly_budget_try > 0) score += 10; else missing.push('Bütçe girilmeli')
  if (input.geographies?.length > 0) score += 10; else missing.push('Coğrafya seçilmeli')
  if (input.time_horizon_days > 0) score += 5; else missing.push('Zaman ufku seçilmeli')
  if (input.channels.meta || input.channels.google) score += 10; else missing.push('En az bir kanal seçilmeli')

  if (input.avg_basket && input.avg_basket > 0) score += 10
  if (input.margin_pct && input.margin_pct > 0) score += 5
  if (input.ltv && input.ltv > 0) score += 5

  if (input.integrations.pixel === 'green') score += 5
  else if (input.integrations.pixel === 'yellow') score += 2
  if (input.integrations.analytics === 'green') score += 5
  else if (input.integrations.analytics === 'yellow') score += 2
  if (input.integrations.crm === 'green') score += 5
  else if (input.integrations.crm === 'yellow') score += 2

  return { score: Math.min(score, 100), missing }
}
