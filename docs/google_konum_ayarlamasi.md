# PMax Konum Sistemi — Teknik Dokümantasyon

**Son güncelleme:** 22 Mart 2026  
**İlgili dosyalar:**
- `components/google/wizard/pmax/PMaxLocationAdvancedModal.tsx`
- `components/google/wizard/pmax/PMaxLocationMap.tsx`
- `public/location-pin.png`

---

## Genel Yapı

Modal iki sekmeden oluşur: **Konum** ve **Yarıçap**. Her sekme kendi arama state'ini ve harita davranışını yönetir.

---

## Konum Sekmesi

### Arama
- Input: `locQuery` state
- Debounce: 300ms, min 2 karakter
- API: `GET /api/integrations/google-ads/geo-targets?q=...`
- Sonuçlar `locResults` state'ine yazılır

### Seçim
- Her sonuçta **Dahil et** / **Hariç Tut** butonu
- `addLocation(geo, isNegative)` fonksiyonu çalışır
- `PMaxSelectedLocation` objesi: `{ id, name, countryCode, targetType, isNegative }`
- `updateRef.current({ locations: [...] })` ile state güncellenir
- Input temizlenir, sonuçlar kapanır

### Seçilen Konumlar Listesi
- `state.locations.length > 0` ise sol panelde gösterilir
- Dahil: mavi badge, Hariç: kırmızı badge
- X butonu → `removeLocation(id)` → state'ten çıkarır

---

## Yarıçap Sekmesi

### Arama
- Input: `radQuery` state
- Debounce: 300ms, min 2 karakter
- API: `GET /api/integrations/google-ads/geo-targets?q=...`
- **Re-search koruması:** `radLockedRef` — konum seçilince debounce tekrar tetiklenmez

### Konum Seçimi (`selectRadiusLocation`)
```
1. radLockedRef.current = true
2. setRadQuery(geo.name)
3. setRadResults([])
4. setPinLabel(geo.name)
5. Nominatim geocode: geo.name → { lat, lng }
6. setPinCoords({ lat, lng }) → haritaya pin + circle
```

### Kaydetme
- Arama ile seçilen konum: `pinCoords` set edilir, sol panelde yeşil kutu + "Yarıçap hedeflemesini kaydet" butonu çıkar
- Sabitleme modu ile seçilen konum: Dahil et = direkt kayıt (ikinci onay yok, sol panel çıkmaz)

### Kaydedilen Hedefler Listesi
- Sol panelde yeşil badge ile listelenir
- X butonu ile silinebilir

---

## Sabitleme Modu

### Buton
- Sadece Yarıçap sekmesinde, harita üstünde ortalanmış
- Toggle: `setPinModeActive(v => !v)`
- Aktif: mavi, Pasif: beyaz

### Harita Davranışı
Sabitleme modu **aktifken**:
- `cursor: 'none'` — fare imleci gizlenir
- `mousemove` → **sadece icon** takip eder (circle YOK — Google Ads davranışı)
- `mouseout` → preview icon kaldırılır
- `click` → popup açılır: `(lat, lng) (özel) yerinin X km çevresi` + **Dahil et** butonu

**Dahil et tıklanınca:**
1. Popup kapanır
2. Haritaya kalıcı circle çizilir (gerçek km'ye göre ölçeklenmiş)
3. `map.fitBounds(circle.getBounds(), { padding: [40,40], maxZoom: 13 })` → harita circle'a fit olur
4. `onPinPlaceRef.current({ lat, lng })` çağrılır
5. Modal handler direkt `proximityTargets`'a ekler — `setPinCoords` çağrılmaz, sol panelde ikinci onay istenmez
6. `pinModeActive` açık kalır → kullanıcı tekrar tıklayarak yeni nokta ekleyebilir

Sabitleme modu **kapatılınca:**
- `useEffect([pinModeActive])` → preview icon temizlenir

---

## PMaxLocationMap Props

| Prop | Tip | Açıklama |
|------|-----|----------|
| `mode` | `'location' \| 'radius'` | Aktif sekme |
| `pinCoords` | `{lat, lng} \| null` | Arama ile seçilen koordinat |
| `onPinPlace` | `(coords) => void` | Popup Dahil et tıklanınca çağrılır |
| `proximityTargets` | `PMaxProximityTarget[]` | Kaydedilmiş yarıçaplar |
| `radiusMeters` | `number` | Yarıçap (metre) |
| `radiusLabel` | `string` | Popup'ta gösterilir: "10 km" |
| `pinModeActive` | `boolean` | Sabitleme modu durumu |

---

## Harita Teknik Detaylar

- **Kütüphane:** Leaflet 1.9.4 (dinamik import, SSR-safe)
- **Tiles:** OpenStreetMap
- **Varsayılan merkez:** Ankara `{ lat: 39.9334, lng: 32.8597 }`, zoom 6
- **Custom icon:** `/public/location-pin.png`, 40×40px, anchor 20×40

### useEffect Sırası
1. `[mounted, mode]` → Map init + event handler'lar
2. `[pinModeActive]` → Preview icon temizle
3. `[pinCoords]` → Arama seçiminde marker + circle (zoom yok)
4. `[radiusMeters]` → Sadece circle güncelle (çift circle önlenir)

### Popup Ayarları
```js
L.popup({ closeOnClick: false, autoPan: true, autoPanPadding: [20, 20], offset: [0, -10] })
```

---

## Önemli Notlar

1. **Çift circle sorunu çözüldü:** `[pinCoords]` effect'i `radiusMetersRef.current` kullanır, dependency array'e girmez.
2. **Sabitleme modunda ikinci onay yok:** `onPinPlace` direkt `updateRef.current({ proximityTargets: [...] })` çağırır.
3. **Preview'da circle yok:** Sadece icon takip eder — Google Ads ile aynı davranış.
4. **radLockedRef:** `setRadQuery(geo.name)` debounce'u tetikler, `radLockedRef.current = true` ile bir kez engellenir.
