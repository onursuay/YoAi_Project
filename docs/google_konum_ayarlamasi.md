# Konum Sistemi — YoAI Google Ads Teknik Referansı

**Son güncelleme:** 23 Mart 2026

---

## Mimari

```
PMaxLocationPicker.tsx          → Referans implementasyon (PMax)
StepLocationLanguage.tsx        → Search/Display/Video için (PMaxLocationPicker kopyası)
LocationAdvancedModal.tsx       → Shared generic modal (konum + yarıçap)
PMaxLocationMap.tsx             → Leaflet harita (renderMap prop ile geçilir)
```

---

## Bileşenler

### PMaxLocationPicker / StepLocationLanguage

İkisi aynı yapı, sadece prop tipleri farklı:
- PMax: `PMaxStepProps`
- Search/diğerleri: `StepProps`

**UI sırası:**
1. Açıklama metni (`settings.locationsLabel`)
2. 3 radyo: Tüm ülkeler / Türkiye / Başka bir yer girin
3. "Başka bir yer girin" seçilince: arama input + dropdown
4. Gelişmiş arama butonu (`<MapPin>`)
5. Seçilen konumlar (mavi=dahil, kırmızı=hariç, toggle + X)
6. Yer seçenekleri `<details>` accordion (PRESENCE_OR_INTEREST / PRESENCE_ONLY)

**Arama:**
- Debounce: 300ms, min 2 karakter
- API: `GET /api/integrations/google-ads/geo-targets?q=...`
- Dropdown: absolute, z-[100], shadow-lg, max-h-60
- Her satır: "Dahil et" (mavi) + "Hariç Tut" (kırmızı) — eklenince "Eklendi"

---

### LocationAdvancedModal (`shared/`)

Generic modal. İki sekme:
- **Konum** — arama + Dahil/Hariç + seçilen liste
- **Yarıçap** — sadece `renderMap` prop verilirse görünür

```tsx
<LocationAdvancedModal
  isOpen={advancedOpen}
  onClose={() => setAdvancedOpen(false)}
  state={state}
  update={update}
  t={t}
  renderMap={(props) => <PMaxLocationMap {...props} />}  // opsiyonel
/>
```

---

## State Alanları

```typescript
locations: SelectedLocation[]        // default: []
proximityTargets: ProximityTarget[]  // default: []
geoSearchCountry: string             // default: ''
locationTargetingMode: 'PRESENCE_OR_INTEREST' | 'PRESENCE_ONLY'

interface SelectedLocation {
  id: string
  name: string
  countryCode: string
  targetType: string
  isNegative: boolean
}

interface ProximityTarget {
  lat: number
  lng: number
  radiusMeters: number
  label?: string
}
```

---

## Layout Kuralı

Search ve diğer kampanyalarda konum + dil ayrı `CollapsibleSection`:

```tsx
<CollapsibleSection title={t('settings.locationsTitle')}>
  <StepLocationLanguage state={state} update={update} t={t} />
</CollapsibleSection>

<CollapsibleSection title={t('settings.languagesTitle')}>
  {/* LANGUAGE_OPTIONS chip seçimi */}
</CollapsibleSection>
```

---

## Kampanya Durumu

| Kampanya | Bileşen | Harita | Durum |
|----------|---------|--------|-------|
| PERFORMANCE_MAX | `PMaxLocationPicker` | ✅ | ✅ |
| SEARCH | `StepLocationLanguage` | ✅ | ✅ |
| DISPLAY | `StepLocationLanguage` | opsiyonel | ⏳ |
| VIDEO | `StepLocationLanguage` | opsiyonel | ⏳ |
| DEMAND_GEN | `StepLocationLanguage` | opsiyonel | ⏳ |

---

## Yeni Kampanya Eklerken

1. `StepLocationLanguage` import et
2. `CollapsibleSection` içine al
3. Dil seçimini ayrı `CollapsibleSection` olarak ekle
4. Harita isteniyorsa `renderMap` prop'unu geç
