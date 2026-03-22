# PMax Konum Sistemi — Teknik Dokümantasyon

**Son güncelleme:** 21 Mart 2026  
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
- `PMaxSelectedLocation` objesi oluşturulur: `{ id, name, countryCode, targetType, isNegative }`
- `updateRef.current({ locations: [...] })` ile state güncellenir
- Input temizlenir, sonuçlar kapanır

### Seçilen Konumlar Listesi
- `state.locations.length > 0` ise sol panelde gösterilir
- Dahil: mavi badge, Hariç: kırmızı badge
- X butonu → `removeLocation(id)` → state'ten çıkarır

### Stale Closure Koruması
```tsx
const stateRef = useRef(state)
stateRef.current = state
const updateRef = useRef(update)
updateRef.current = update
```
Tüm callback'lerde `stateRef.current` ve `updateRef.current` kullanılır.

---

## Yarıçap Sekmesi

### Arama
- Input: `radQuery` state
- Debounce: 300ms, min 2 karakter
- API: `GET /api/integrations/google-ads/geo-targets?q=...` (Konum sekmesiyle aynı API)
- Sonuçlar `radResults` state'ine yazılır
- **Re-search koruması:** `radLockedRef` — konum seçildikten sonra debounce effect'inin tekrar aramayı tetiklemesini engeller

### Konum Seçimi (`selectRadiusLocation`)
```
1. radLockedRef.current = true  (re-search'ü engelle)
2. setRadQuery(geo.name)         (input'a yaz)
3. setRadResults([])             (dropdown'ı kapat)
4. setPinLabel(geo.name)         (yeşil kutu için etiket)
5. Nominatim geocode: geo.name → { lat, lng }
6. setPinCoords({ lat, lng })    (haritaya pin at)
```

### Nominatim Geocoding
- URL: `https://nominatim.openstreetmap.org/search?q=...&format=json&limit=1`
- Google Ads API sadece konum adı döndürür, koordinat vermez → Nominatim ile çözülür

### Yarıçap Değerleri
- `radiusValue`: sayısal değer (1–500)
- `radiusUnit`: `'km'` | `'mi'`
- Metre cinsinden hesap: `km × 1000` veya `mi × 1609.34`

### Kaydetme (`saveProximity`)
```
PMaxProximityTarget: {
  lat, lng,
  radiusMeters: Math.round(meters),
  label: "İstanbul,Turkiye (10 km)"
}
```
Kaydedildikten sonra: `pinCoords`, `pinLabel`, `radQuery`, `pinModeActive` sıfırlanır.

### Kaydedilen Hedefler Listesi
- `state.proximityTargets.length > 0` ise sol panelde gösterilir
- Yeşil badge, MapPin ikonu
- X butonu → `removeProximity(idx)` → state'ten çıkarır

---

## Sabitleme Modu

### Buton
- Sadece Yarıçap sekmesinde görünür
- Toggle: `setPinModeActive(v => !v)`
- Aktif: mavi arka plan, Pasif: beyaz arka plan

### Harita Davranışı (PMaxLocationMap)
Sabitleme modu **aktifken**:
- `cursor: 'none'` (fare imleci gizlenir)
- `mousemove` → preview marker + preview circle fare ile birlikte hareket eder (opacity: 0.6, dashed border)
- `click` → preview temizlenir, kalıcı marker + circle yerleştirilir, `onPinPlaceRef.current({ lat, lng })` çağrılır
- `mouseout` → preview marker + circle kaldırılır

Sabitleme modu **kapatılınca**:
- `useEffect([pinModeActive])` → preview marker + circle temizlenir

---

## PMaxLocationMap Props

| Prop | Tip | Açıklama |
|------|-----|----------|
| `mode` | `'location' \| 'radius'` | Aktif sekme |
| `pinCoords` | `{lat, lng} \| null` | Seçilen koordinat |
| `onPinPlace` | `(coords) => void` | Haritaya tıklanınca çağrılır |
| `proximityTargets` | `PMaxProximityTarget[]` | Kaydedilmiş yarıçaplar |
| `addressQuery` | `string` | (kullanılmıyor, ilerisi için) |
| `radiusMeters` | `number` | Çizilecek yarıçap |
| `pinModeActive` | `boolean` | Sabitleme modu durumu |

---

## Harita Teknik Detaylar

- **Kütüphane:** Leaflet 1.9.4 (dinamik import, SSR-safe)
- **Tiles:** OpenStreetMap
- **Varsayılan merkez:** Ankara `{ lat: 39.9334, lng: 32.8597 }`, zoom 6
- **Custom icon:** `/public/location-pin.png`, 40×40px, anchor 20×40
- **Map init:** Yalnızca `[mounted, mode]` değişince — `onPinPlace` dependency array'den çıkarıldı (stale closure sorunundan dolayı, `onPinPlaceRef` ref ile yönetilir)

### Ref Yönetimi (Map)
```tsx
const onPinPlaceRef = useRef(onPinPlace)
const radiusMetersRef = useRef(radiusMeters)
const pinModeActiveRef = useRef(pinModeActive)
// Her render'da güncellenir:
onPinPlaceRef.current = onPinPlace
radiusMetersRef.current = radiusMeters
pinModeActiveRef.current = pinModeActive
```

### useEffect Sırası
1. `[mounted, mode]` → Map init + event handler'lar
2. `[pinModeActive]` → Preview temizle
3. `[pinCoords, radiusMeters]` → Arama ile seçilen konumu haritaya çiz
4. `[radiusMeters]` → Sadece yarıçap değişince circle'ı yeniden çiz

---

## Dosya Yapısı
```
components/google/wizard/pmax/
├── PMaxLocationAdvancedModal.tsx   ← Modal + sol panel (arama, listeler)
├── PMaxLocationMap.tsx             ← Leaflet harita bileşeni
├── PMaxLocationPicker.tsx          ← Dış wizard adımındaki konum seçici
└── shared/
    └── PMaxWizardTypes.ts          ← PMaxSelectedLocation, PMaxProximityTarget tipleri
```

---

## Önemli Notlar

1. **radLockedRef:** `selectRadiusLocation` sonrası `setRadQuery(geo.name)` çağrısı debounce'u tetikler. `radLockedRef.current = true` ile bu tetiklenme bir kez engellenir.
2. **Nominatim rate limit:** Arama başına 1 istek. Yoğun kullanımda throttle eklenebilir.
3. **pinCoords + radiusMeters** aynı anda değişince her iki effect (`[pinCoords, radiusMeters]` ve `[radiusMeters]`) çalışır — bu kasıtlı ve circle'ın doğru çizilmesi için gereklidir.
4. **Preview marker className:** `leaflet-preview-marker` CSS class'ı ile opacity kontrolü sağlanır.
