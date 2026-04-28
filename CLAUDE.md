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

## Kitle Hedefleme Picker UX (Dropdown davranışı)
Wizard adımı içindeki "Kitle Hedefleme" alanları (Arama / Göz at sekmeli kitle segmenti picker'ı) **dropdown gibi davranır**:

1. **Default açık başlar** (kullanıcı seçim yapabilsin)
2. **Picker dışına tıklandığında otomatik kapanır** — `useEffect` + `mousedown` listener, `ref.current.contains(target)` kontrolü
3. **Kapalıyken tetikleyici buton** görünür: seçim sayısı (örn. "4 kitle segmenti seçildi") + chevron; tıklanınca yeniden açılır
4. **Seçili chip'ler picker durumundan bağımsız** her zaman görünür kalır

**Uygulama scope'u:**
- ✅ Wizard step içindeki inline picker'lar (StepAudience.tsx — Display + Search wizard'ları için ortak)
- ❌ Modal içindeki picker'lar (modal'ın kendi outside-click davranışı zaten kapatıyor)
- ❌ Zaten `CollapsibleSection` ile sarılı picker'lar (PMax sinyal panelleri — kendi expand/collapse'ı var)

Yeni bir kitle picker UI'ı eklenirse bu pattern'i uygula (ref + outside-click + trigger button).
