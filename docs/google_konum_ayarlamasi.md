# Konum Sistemi — YoAI Google Ads Standart Referansı

Bu dosya tüm kampanya tiplerinde kullanılan konum hedefleme UI'ının standart yapısını tanımlar. Referans implementasyon: `PMaxLocationPicker.tsx`. Yeni kampanya tipi eklenirken bu standart birebir uygulanır.

**Son güncelleme:** 22 Mart 2026

---

## Standart Konum UI — Tam Yapı

### 1. Kapsam Radyo Butonları

3 seçenek, her zaman gösterilir:

- **Tüm ülkeler ve bölgeler** → `locations: [], geoSearchCountry: ''`
- **Türkiye** → `geoSearchCountry: 'TR', locations: []`
- **Başka bir yer girin** → arama input açılır

### 2. Arama Input (sadece "Başka bir yer girin" seçilince)

- Search ikonu solda, Loader2 sağda
- Debounce: 300ms, min 2 karakter
- API: `GET /api/integrations/google-ads/geo-targets?q=...`
- Placeholder: "Hedeflenecek veya hariç tutulacak konumları girin"
- Alt not: "Örneğin; ülke, şehir, bölge veya posta kodu"

### 3. Dropdown Sonuçları

```
absolute, z-[100], bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto
Her satır: px-4 py-2.5 border-b border-gray-100 hover:bg-gray-50
Eklendi: bg-blue-50/50 + "Eklendi" text-xs text-blue-600
Eklenmedi: "Dahil et" (text-blue-600 hover:bg-blue-50) + "Hariç Tut" (text-red-600 hover:bg-red-50)
```

### 4. Gelişmiş Arama Butonu

```
<MapPin> Gelişmiş arama
text-sm text-blue-600 hover:underline
```

Not: Harita/yarıçap sadece PMax'te aktiftir.

### 5. Seçilen Konumlar

```
flex flex-wrap gap-2
Dahil: bg-blue-100 text-blue-800 rounded-full px-3 py-1 text-xs
Hariç: bg-red-100 text-red-800 rounded-full px-3 py-1 text-xs
İçinde: isim + (Hariç) + "Dahil et"/"Hariç tut" toggle + X butonu
```

### 6. Yer Seçenekleri

`<details>` accordion, `<summary>` = "Yer seçenekleri" (text-blue-600 + ChevronDown):

- `PRESENCE_OR_INTEREST` → "Hedef konumlarda olan veya düzenli burada bulunan kullanıcılar"
- `PRESENCE_ONLY` → "Hedef konumlarda olan kullanıcılar"

Her seçenek: `p-2.5 rounded-lg border`, aktif: `border-blue-500 bg-blue-50`

---

## State Alanları

```typescript
locations: SelectedLocation[]       // default: []
geoSearchCountry: string            // default: ''
locationTargetingMode: 'PRESENCE_OR_INTEREST' | 'PRESENCE_ONLY'

interface SelectedLocation {
  id: string
  name: string
  countryCode: string
  targetType: string
  isNegative: boolean
}
```

---

## Kampanya Tipi Durumu

| Kampanya | Dosya | Durum |
|----------|-------|-------|
| PERFORMANCE_MAX | `pmax/PMaxLocationPicker.tsx` | ✅ Referans |
| SEARCH | `steps/StepCampaignSettingsSearch.tsx` | ✅ Tamamlandı |
| DISPLAY | `display/steps/DisplayStepCampaignSettings.tsx` | ⚠️ Güncellenmeli |
| VIDEO | — | ⏳ Bekliyor |
| DEMAND_GEN | — | ⏳ Bekliyor |

---

## PMax'e Özel (Diğerleri için gerekli değil)

- Yarıçap hedefleme (`proximityTargets`)
- Harita (Leaflet, OpenStreetMap)
- `PMaxLocationAdvancedModal`
