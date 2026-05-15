# YoAi Project — Claude Code Instructions

## Otomatik Commit + Push
Her değişiklik tamamlandıktan sonra otomatik olarak:
1. Değiştirilen dosyaları stage et
2. Kısa ve açıklayıcı commit mesajı ile commit at
3. `git push` ile remote'a gönder

Kullanıcı ayrıca "commit + push" demesine gerek yok.

## Değişiklik Günlüğü
Her başarılı değişiklik sonrasında `docs/CHANGELOG.md` dosyasını güncelle.
Şu formatta yeni bir giriş ekle (en üste):

```
## YYYY-MM-DD — [Kısa başlık]
- **Sorun:** Ne sorundu / ne istendi
- **Çözüm:** Ne yapıldı
- **Dosyalar:** Etkilenen dosyalar
```

Sadece net olumlu sonuçları kaydet: düzeltilen buglar, tamamlanan özellikler, çözülen sorunlar.
Başarısız denemeler, geçici fixler veya geri alınan değişiklikler eklenmez.

## UI Renk Kuralı (YASAK)
Bu projede **amber / sarı / hardal / bej ton uyarı renkleri KESİNLİKLE kullanılmaz**.
Şu Tailwind class'ları yasaktır:
- `bg-amber-*`, `text-amber-*`, `border-amber-*`
- `bg-yellow-*`, `text-yellow-*`, `border-yellow-*`

Uyarı / bilgi bantları için bunları kullan:
- **Bilgi / hazır:** `bg-gray-50` / `text-gray-700` / `border-gray-200`
- **Önemli uyarı / harekete geçir:** `bg-primary/5` + `text-primary` + `border-primary/20` (veya koyu yeşil)
- **Kritik / hata:** `bg-red-50` / `text-red-700` / `border-red-200`
- **Başarı:** `bg-emerald-50` / `text-emerald-700` / `border-emerald-200`

Tüm butonlar ve ikonlar için de aynı kural geçerli (no amber, no yellow).

## Kitle Hedefleme Picker UX (Dropdown davranışı) — Proje Geneli
Projedeki **TÜM "Kitle Hedefleme" picker'ları** (Arama / Göz at sekmeli kitle segmenti UI'ı) — kampanya türünden ve bağlamdan bağımsız olarak — aynı dropdown davranışına sahiptir:

1. **Default açık başlar** (kullanıcı seçim yapabilsin)
2. **Picker dışına tıklandığında otomatik kapanır** — `useEffect` + `mousedown` listener, `ref.current.contains(target)` kontrolü
3. **Kapalıyken tetikleyici buton** görünür: seçim sayısı (örn. "4 kitle segmenti seçildi") + chevron; tıklanınca yeniden açılır
4. **Seçili chip'ler picker durumundan bağımsız** her zaman görünür kalır

**Uygulama (istisnasız):**
- ✅ `components/google/wizard/steps/StepAudience.tsx` (Search + Display wizard ortak)
- ✅ `components/google/wizard/pmax/steps/PMaxStepAssetGroup.tsx` (PMax wizard — `CollapsibleSection` içinde olsa bile dropdown davranışı uygulanır)
- ✅ `components/google/detail/AudienceSegmentEditor.tsx` (modal içinde olsa bile dropdown davranışı uygulanır)

## İşletme Profili Tarama Kuralları (Otomatik Tarama)

### Tarama Ne Zaman Çalışır
1. **İlk kurulum tamamlandığında**: `POST /api/yoai/business-profile` → onboarding bitince `runProfileScansAndIntelligence` fire-and-forget olarak tetiklenir.
2. **Her revizyondan sonra**: Aynı POST endpoint'i edit modda da kullanılır → her kayıtta otomatik yeniden tarama başlar.

### Manuel Tara Butonu — YOK
UI'da "Tara", "Yeniden Tara" gibi bir buton **kesinlikle bulunmaz**. Tarama yalnızca otomatik tetiklenir.

### Tarama Nasıl Çalışır
- `businessSourceScanner.ts` + `socialSourceScanner.ts` ile HTTP scraping (LLM kullanılmaz)
- Kendi marka URL'leri (website, instagram, facebook, linkedin, youtube, tiktok, google_business, marketplace) + her rakibin URL'leri taranır
- Sonuçlar `user_business_source_scans` tablosuna yazılır — **her taramada eski kayıtlar silinir** (`deleteSourceScansForProfile` çağrılır), duplicate birikmez
- `buildBusinessIntelligenceRow` ile deterministic intelligence üretilir, `user_business_intelligence` tablosuna kaydedilir

### scan_status Değerleri (UI'da gösterim)
| Değer | Gösterim |
|-------|----------|
| `pending` | "Tarama bekleniyor" |
| `running` | "Taranıyor…" (spinner) |
| `completed` | "Tarandı" (yeşil) |
| `partial` | "Kısmi" (kaynak bir kısmı tarandı) |
| `failed` | "Tarama başarısız" (kırmızı) |

### Taramayı Etkileyen Dosyalar
- `app/api/yoai/business-profile/route.ts` — POST: kayıt + `runProfileScansAndIntelligence` fire-and-forget
- `app/api/yoai/business-profile/scan/route.ts` — programmatik tetikleyici (UI'a açık değil)
- `lib/yoai/businessProfileStore.ts` — `deleteSourceScansForProfile` + `insertSourceScans`
- `lib/yoai/businessSourceScanner.ts` — web/marketplace/google_business HTTP scraping
- `lib/yoai/socialSourceScanner.ts` — Instagram/Facebook/LinkedIn/YouTube/TikTok scraping
- `lib/yoai/businessIntelligenceBuilder.ts` — deterministic intelligence synthesis

## Kitle Segmenti Chip Renk Kuralı
Tüm kategori (AFFINITY, IN_MARKET, DETAILED_DEMOGRAPHIC, LIFE_EVENT, USER_LIST, CUSTOM_AUDIENCE, COMBINED_AUDIENCE) chip'leri tek tip `bg-emerald-50` + `text-emerald-700` kullanır. Kategoriye göre değişen mor/turuncu/pembe/mavi/teal/indigo renkler **kullanılmaz**.

Yeni bir kitle picker UI'ı eklenirse hem dropdown davranışını hem chip rengi kuralını uygula.
