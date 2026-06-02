# YoAlgoritma İyileştirmeleri — Tasarım Dokümanı

**Tarih:** 2026-06-02
**Kapsam:** YoAlgoritma sayfası (`app/yoai/`) ve ilişkili bileşenler için 5 maddelik iyileştirme seti.
**Standartlar:** EN/TR i18n zorunlu · amber/sarı yasak · Meta/Google API koruması · sahte veri yasak · otomatik commit+push+CHANGELOG.

---

## Onaylanan Kararlar (kullanıcı)

| Karar | Seçim |
|------|-------|
| Madde 1 URL kapsamı | Tüm route'lar denetlenir; same-slug EN route'ları çevrilir |
| YoAlgoritma EN slug | `yoalgorithm` (TR `/yoalgoritma`, EN `/en/yoalgorithm`) |
| Diğer same-slug route'lar | **Hepsi şimdi çevrilir** (subscription/account/invoices + crm/email-marketing prefix tutarlılığı) |
| Madde 4 boş-kart çözümü | **Otomatik ilk tarama** (gerçek veri, owner dahil herkes, "Hazırlanıyor…" durumu) |

---

## Madde 1 — URL yapısı sayfa başlığına uygun olsun

### Sorun
- `app/yoai/` klasörü → URL `/yoai`, fakat sayfa başlığı **"YoAlgoritma"**. Tek gerçek uyumsuzluk.
- EN tarafında `abonelik`, `hesabim`, `faturalarim` "same-slug" (çevrilmemiş); `crm`, `email-marketing` `APP_SLUGS` setinde yok → locale=en iken `/en` prefix tutarsızlığı.

### Çözüm — Route denetim tablosu

| Klasör (TR slug) | Başlık | Mevcut EN | Yeni EN slug | Aksiyon |
|---|---|---|---|---|
| `yoai` | YoAlgoritma | yoai (same) | **yoalgorithm** | **Klasör → `yoalgoritma`**; TR `/yoalgoritma`, EN `/en/yoalgorithm`; eski `/yoai`→`/yoalgoritma` kalıcı redirect |
| `abonelik` | Abonelik | abonelik (same) | **subscription** | middleware EN_TO_TR/TR_TO_EN + APP_SLUGS (klasör adı TR kalır) |
| `hesabim` | Hesabım | hesabim (same) | **account** | middleware haritası |
| `faturalarim` | Faturalarım | faturalarim (same) | **invoices** | middleware haritası |
| `crm` | CRM Sistemi | (APP_SLUGS yok) | crm | APP_SLUGS'a ekle (prefix tutarlılığı) |
| `email-marketing` | Email Marketing | (APP_SLUGS yok) | email-marketing | APP_SLUGS'a ekle |
| `strateji` | Strateji | strategy ✓ | — | Değişiklik yok |
| `optimizasyon` | Optimizasyon | optimization ✓ | — | Değişiklik yok |
| `hedef-kitle` | Hedef Kitle | target-audience ✓ | — | Değişiklik yok |
| `tasarim` | Tasarım | design ✓ | — | Değişiklik yok |
| `raporlar` | Raporlar | reports ✓ | — | Değişiklik yok |
| `entegrasyon` | Entegrasyon | integration ✓ | — | Değişiklik yok |
| `seo` | SEO Plus | seo (same) | seo | Kısaltma — değişmez |
| `dashboard` | — | dashboard (same) | dashboard | EN kelime — değişmez |
| `meta-ads` / `google-ads` / `tiktok-ads` | (Reklam) | same | same | Marka adı — değişmez |

**Owner/admin route'ları** (`gozetim-merkezi`, `marketing-kurulumu`): EN slug eşlemesi opsiyonel/düşük öncelik (owner-only, görünürlük dar). Bu işte `marketing-kurulumu→marketing-setup`, `gozetim-merkezi→oversight-center` eklenir ama ayrı bir alt-adımda.
**Kapsam dışı:** auth/public flow sayfaları (`login`, `signup`, `connect`, `basvuru-durumu`, `unsubscribe`, `review`) ve legal sayfalar (zaten EN/TR slug çiftli).

### Etkilenen dosyalar
- `app/yoai/` → `app/yoalgoritma/` (git mv — tüm alt dosyalar taşınır)
- [middleware.ts](middleware.ts) — `EN_TO_TR`, `TR_TO_EN`, `APP_SLUGS` güncellenir
- [lib/nav.ts](lib/nav.ts):74-76 — `id: 'yoalgoritma'`, `href: '/yoalgoritma'`
- `lib/routes.ts` (ROUTES sabiti) — `YOAI` varsa `/yoalgoritma`'ya güncellenir
- [components/SidebarNav.tsx](components/SidebarNav.tsx) — `getTranslationKey` eşlemesi (`yoai`→`yoalgoritma`)
- [components/seo/SeoSitesPanel.tsx](components/seo/SeoSitesPanel.tsx):253 — `href="/yoai"` → `/yoalgoritma`
- `next.config.js` — `redirects()`: `/yoai` → `/yoalgoritma` (kalıcı, 308)
- `locales/tr.json` + `locales/en.json` — sidebar nav key `yoai`→`yoalgoritma` ("YoAlgoritma" / "YoAlgorithm")
- Grep ile kalan `'/yoai'` route literal'leri (api/yoai HARİÇ) taranır

### EN/TR notu
URL slug'ları locale'e göre middleware ile çözülür (klasör adı TR kalır, EN slug rewrite edilir) — mevcut `strateji↔strategy` deseni birebir izlenir. Sidebar etiketi çeviriden gelir.

---

## Madde 2 — Header düzeni (ticker + AI Analiz + son güncelleme)

### 2a. Öneri ticker'ı ortalansın
**Sorun:** [YoAlgoritmaHeader.tsx](components/yoai/YoAlgoritmaHeader.tsx):42-60 — `flex justify-between` ile ticker sağda, hesap seçici dropdown'a sıkışıp truncate oluyor ("…dropdown altında kalıyor").
**Çözüm:** 3 bölgeli layout — `sol başlık (shrink-0) | orta ticker (flex-1 justify-center) | sağ hesap seçici (shrink-0)`. Ticker `max-w` ortada nefes alır, çakışma biter. `overflow-hidden` + `truncate` korunur.

### 2b. "AI Analiz" rozetini kaldır, son güncellemeyi renkli pill yap
**Sorun:** [CommandCenterHeader.tsx](components/yoai/CommandCenterHeader.tsx):70-83 — "AI Analiz" rozeti renkli pill; "Son: …" düz gri yazı.
**Çözüm:**
- "AI Analiz/Kural Motoru/Hazır" rozeti (satır 71-77) **kaldırılır**.
- "Son: {formattedTime}" (satır 79-83) eski rozet stiline taşınır: `text-primary bg-primary/10 border border-primary/20 rounded-full px-3 py-1` + `Clock` ikonu + pulse noktası. Veri yoksa nötr gri pill ("—").
- `aiGenerated` prop'u CommandCenterHeader'da artık görsel olarak kullanılmaz (interface'te kalabilir; kullanılmıyorsa temizlenir).

### EN/TR notu
`t('aiAnalysis')`/`t('ruleEngine')`/`t('ready')` anahtarları başka yerde kullanılmıyorsa korunur (silme zorunlu değil). "Son" etiketi (`t('last')`) mevcut çeviriden gelmeye devam eder.

---

## Madde 3 — AI Reklam Oluştur (hata + logolar)

### 3a. "AI reklam önerisi üretilemedi" hatası (kök neden)
**Kök neden:** [AdCreationWizard.tsx](components/yoai/AdCreationWizard.tsx) platform seçince `/api/yoai/generate-ad`'i `forceGenerate` olmadan çağırıyor. Tarama hiç çalışmadığı için route persisted veri bulamıyor ve [generate-ad/route.ts](app/api/yoai/generate-ad/route.ts):360-369 `{ ok:true, proposals:[], empty:true }` (boş, hata değil) dönüyor. Wizard `proposals.length === 0`'ı hata sanıyor.
**Çözüm:** `handleSelectPlatform` akışı iki aşamalı olur:
1. Normal çağrı (persisted varsa hızlı döner).
2. Yanıt `empty:true` (veya `proposals` boş) ise → **otomatik `forceGenerate:true` ile yeniden çağır** (canlı AI üretimi; "Üretiliyor…" durumu). `maxDuration=300` mevcut.
3. Canlı üretim de boşsa → route'un gerçek mesajını göster ("Aktif kampanya bulunamadı" / "AI üretimi başarısız"), genel "üretilemedi" yerine.

### 3b. M/G harfleri → kurumsal logolar
**Sorun:** [AdCreationWizard.tsx](components/yoai/AdCreationWizard.tsx):192,204 — `<span>M</span>` / `<span>G</span>` hardcoded.
**Çözüm:** Hazır SVG'ler kullanılır: `/platform-icons/meta.svg`, `/platform-icons/google-ads.svg` (sidebar'ın kullandığı dosyalar). Renkli kutu sadeleştirilir/korunur, logo `<img>` ile gelir.

### 3c. Boy scout — i18n
Modaldaki hardcoded TR metinler (`'AI Reklam Oluştur'`, `'Öneri Onayı'`, `'Reklamlarınız + Rakip analizi → Tam kampanya yapısı'`, hata stringleri) `tr.json`+`en.json`'a taşınır.

### Koruma
`AdCreationWizard` Meta/Google **publish** akışını ve `generate-ad` entegrasyon kodunu DEĞİŞTİRMEZ — yalnız wizard'ın istek parametresi (`forceGenerate`) ve sunum katmanı dokunulur.

---

## Madde 4 — Geliştirme kartları boş kalmasın (otomatik ilk tarama)

### Sorun
[HierarchicalImprovements.tsx](components/yoai/hierarchy/HierarchicalImprovements.tsx):115-119 — kartlar yalnızca haftalık cron'dan (Pazar 03:00 UTC) gelir. Yeni kullanıcı/owner için ilk tarama tetikleyicisi YOK → "Henüz geliştirme kartı yok. Haftalık analiz Pazar gece otomatik çalışır." uyarısı çıkıyor.

### Çözüm — mevcut Command Center bootstrap deseninin kartlara uyarlanması
Referans desen: [page.tsx](app/yoai/page.tsx):116-162 — CC boşsa `triggerBackgroundBootstrap()` → `POST /api/yoai/daily-run` otomatik tetikleniyor. Aynısı kartlar için kurulur:

1. **Yeni endpoint** `POST /api/yoai/improvements/bootstrap`
   - Oturum kullanıcısı (cookie `user_id`) için `yoalgoritma/campaign-improvements.user` Inngest event'ini tetikler (gerekirse `yoalgoritma/scan.user` ile birlikte).
   - **Idempotent / cooldown:** Son tetiklemeden bu yana kısa süre (örn. 30 dk) içinde tekrar tetiklemez (sunucu tarafı marker — örn. `daily_run` veya hafif bir kayıt üstünden). "Tek sefere mahsus" gereksinimi.
   - Backend guard: zaten kart varsa veya aktif kampanya yoksa no-op döner.

2. **UI** [HierarchicalImprovements.tsx](components/yoai/hierarchy/HierarchicalImprovements.tsx)
   - `fetchData` boş döndü (campaigns.length===0, scopePending değil), aktif kampanya var (prop ile geçilir) ve bu oturumda tetiklenmedi → **bootstrap çağır**, `pending`/"hazırlanıyor" durumuna gir.
   - Boş-durum metni iki ayrışır:
     - Tarama tetiklendi/sürüyor → **"İlk analiziniz hazırlanıyor… birkaç dakika içinde kartlar görünecek"** (yeni i18n key).
     - Aktif kampanya yok → uygun nötr mesaj (ör. "Aktif kampanya bulunmuyor").
   - **Periyodik refresh:** bootstrap sonrası birkaç kez (örn. 30 sn aralık, ~birkaç deneme) `fetchData` çağrılır; kartlar gelince durur. (Mevcut `refreshKey` mekanizması kullanılır.)

3. **Aktif kampanya bilgisi:** `page.tsx`'teki `ccData.health.activeCampaigns` HierarchicalImprovements'a prop olarak geçilir (gereksiz bootstrap'ı önlemek için).

4. **Owner:** Ekstra owner-only kod yok. Owner enterprise bypass'ta (abonelik/kredi engeli yok) + gerçek kampanyası var → aynı otomatik tarama doldurur. Genel kullanıcı da yeni hesap/abonelik sonrası ilk girişte aynı akıştan faydalanır. Haftalık cron yine her Pazar yeniler.

### Sahte veri yasağına uyum
Bootstrap **gerçek Inngest tarama akışını** (gerçek kampanya verisi → Batch API → gerçek kartlar) tetikler. Hiçbir mock/placeholder kart yazılmaz. Tarama Batch API olduğundan sonuç anlık değil (genelde dakikalar) — "hazırlanıyor" durumu bu bekleme içindir.

### Etkilenen dosyalar
- `app/api/yoai/improvements/bootstrap/route.ts` (YENİ) — event tetikleyici + cooldown
- [components/yoai/hierarchy/HierarchicalImprovements.tsx](components/yoai/hierarchy/HierarchicalImprovements.tsx) — bootstrap çağrısı + durumlar + periyodik refresh
- [app/yoai/page.tsx](app/yoai/page.tsx) — `activeCampaigns` prop geçişi
- `locales/tr.json` + `locales/en.json` — yeni boş/hazırlanıyor metinleri

### Inngest dosyalarına dokunma
[perCampaignImprovements.ts](inngest/functions/perCampaignImprovements.ts) ve cron mantığı DEĞİŞMEZ — yalnız yeni bir tetikleme noktası (bootstrap endpoint) eklenir.

---

## Madde 5 — İşletme dropdown'da yazı yerine logo

### Sorun
[BusinessSwitcherDropdown.tsx](components/account/BusinessSwitcherDropdown.tsx):30-34,61 — `platformLabel` "Meta + Google" / "Yalnızca Meta" / "Yalnızca Google" alt yazısı basıyor.

### Çözüm
- `platformLabel` fonksiyonu kaldırılır.
- Alt açıklama `<p>` (satır 61) kaldırılır; hesap adının **yanında** bağlı platform logoları:
  ```tsx
  <div className="min-w-0 flex items-center gap-1.5">
    <p className="text-sm font-medium text-gray-900 truncate">{b.name}</p>
    {b.meta && <img src="/platform-icons/meta.svg" alt="Meta" className="w-3.5 h-3.5 shrink-0" />}
    {b.google && <img src="/platform-icons/google-ads.svg" alt="Google" className="w-3.5 h-3.5 shrink-0" />}
  </div>
  ```
- Logo boyutu `w-3.5 h-3.5` (14px) = hesap adı font boyutu (`text-sm`/14px) ile aynı → "fonttan büyük olmasın" şartı sağlanır.

### EN/TR notu
Logo `alt` metinleri marka adı (Meta/Google — çevrilmez, erişilebilirlik için). `bothPlatforms`/`metaOnly`/`googleOnly` çevirileri bu dosyada kullanılmaz; başka kullanım yoksa kaldırılır, varsa korunur.

---

## Genel Kısıtlar ve Doğrulama

- **Meta/Google API koruması:** Hiçbir maddede `lib/meta/*`, `lib/google/*`, publish akışları veya reklam wizard entegrasyonu değiştirilmez. Yalnız sunum + tetikleme katmanı.
- **EN/TR:** Her yeni metin `tr.json` + `en.json`'a aynı key path ile eklenir; locale değişince doğru dilde görünür.
- **Renk:** amber/sarı yok; primary/emerald/gray/red paleti.
- **UI standardı:** `animate-card-enter`, `hover:shadow-md`, `max-w-7xl` (sayfa istisnaları korunur).
- **Commit:** Her madde tamamlanınca stage→commit→push + `docs/CHANGELOG.md` güncellenir.

### Doğrulama adımları
1. `/yoalgoritma` açılır; `/yoai` 308 ile yönlenir; `/en/yoalgorithm` çalışır; EN'de `/en/subscription`, `/en/account`, `/en/invoices` çözülür.
2. Header: ticker ortada, dropdown'a sıkışmaz; "AI Analiz" yok; son güncelleme renkli pill.
3. AI Reklam Oluştur: tarama yokken bile platform seçince canlı üretim → öneri gelir (boş hata değil); Meta/Google logoları görünür.
4. Geliştirme kartları: ilk girişte "hazırlanıyor" → tarama bitince gerçek kartlar; boş uyarı görünmez (aktif kampanya varken).
5. Dropdown: hesap adı yanında küçük Meta/Google logoları; yazı yok.
6. `tr`↔`en` geçişinde tüm yeni metinler doğru dilde.

---

## Açık Riskler / Notlar
- **Klasör rename (yoai→yoalgoritma):** Next.js route segment değişimi; build cache temizliği + deploy sonrası CDN cache gözlenmeli. Eski link redirect ile korunur.
- **Batch API gecikmesi (Madde 4):** İlk tarama anlık değil; "hazırlanıyor" beklentisi UI'da net verilir.
- **EN slug çoğaltma (subscription/account/invoices):** locale=en kullanıcıları için yeni redirect'ler; mevcut TR linkler bozulmaz (TR slug klasör adı değişmez).
