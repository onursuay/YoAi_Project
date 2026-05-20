# Resmi Reklam Dokümanları — Index ve AI Engine Kullanım Rehberi

> Bu dosya, projeye konsolide edilen resmi Meta + Google reklam dokümanlarının **nerede** olduğunu ve YoAlgoritma AI engine'inin bunları **nasıl** kullanması gerektiğini tanımlar.
> Son güncelleme: 2026-05-20
> İlgili: [yoalgoritma_proje_amaci.md](yoalgoritma_proje_amaci.md) (Ayak 2 — platform kuralları) · [yoalgoritma_context_audit.md](yoalgoritma_context_audit.md)

---

## 1. Konsolide Dokümanlar

| Dosya | Platform | Kapsam | Boyut |
|-------|----------|--------|-------|
| [meta_resmi_reklam_dokumanlari.md](meta_resmi_reklam_dokumanlari.md) | Meta | Temel/orta + ileri seviye mühendislik + kaynakça | ~88 KB / 1093 satır |
| [google_ads_resmi_dokumanlari.md](google_ads_resmi_dokumanlari.md) | Google | Temel/orta + ileri seviye mühendislik + kaynakça | ~51 KB / 646 satır |

Kaynak (orijinal PDF/DOCX): `/Users/onursuay/Desktop/Onur Suay/Onur Şuay/Sponsorlu/Meta ve Google Ads Resmi Dökümanları/`

---

## 2. Hangi Doküman Hangi Durumda Referans Alınmalı

| Durum / AI görevi | Referans doküman + bölüm |
|-------------------|--------------------------|
| Meta hesabı taranıyor, kampanya türü uygunluğu | meta → "Kampanya Amaçları", "İleri Seviye → objective / mimari desenler" |
| Meta kreatif / asset önerisi (aspect ratio, format) | meta → "Yerleşimler/Kreatif", "Kreatif test" |
| Meta dönüşüm takibi sorunu (Pixel/CAPI) | meta → "Pixel/CAPI", "CAPI dedup şeması" |
| Meta başlık/metin önerisi karakter limiti | meta → "Reklam Seviyesi", "Şablonlar" |
| Google Search önerisi (RSA başlık/açıklama sayısı + limit) | google → "Search mühendisliği", "3. Search detay protokolü" |
| Google PMax asset grubu önerisi | google → "5. Performance Max mühendisliği", "23. PMax detay protokolü" |
| Google bidding strateji değişikliği önerisi | google → "Bidding sistemi", "12. Bidding strateji mühendisliği" |
| Google dönüşüm/feed sorunu (Merchant) | google → "8. Shopping ve Merchant Center", "25. Merchant Center ve feed mühendisliği" |
| Politika / reddedilme riski (her iki platform) | meta → "Policy", google → "16. Negatifler, brand safety ve kontrol" |

---

## 3. AI Engine'e Bağlama Stratejisi (Öneri)

> **Mevcut durum:** AI engine system prompt'unda ([lib/yoai/ai/systemPrompt.ts](../lib/yoai/ai/systemPrompt.ts)) bu dokümanlar **şu an yer almıyor**. Detaylı uyum analizi için bkz. [yoalgoritma_context_audit.md](yoalgoritma_context_audit.md) Bölüm 2.

İki dosyanın toplam boyutu ~140 KB (~35-40K token). Bağlama için iki seçenek:

### Seçenek A — Tümünü system prompt'a göm (cache'li) — KISA VADE
- Her iki `.md` dosyasını `AI_ENGINE_SYSTEM_PROMPT`'a, platforma göre koşullu olarak ekle:
  - Meta hesabı taranırken yalnızca `meta_resmi_reklam_dokumanlari.md`
  - Google hesabı taranırken yalnızca `google_ads_resmi_dokumanlari.md`
- `cache_control: { type: 'ephemeral' }` zaten kullanılıyor (agent.ts:65-70) → doküman bloğu cache'lenir, her batch item için tekrar ödeme olmaz.
- Tek platform dokümanı ~15-20K token → mevcut single-pass payload ile uyumlu.
- **Avantaj:** Basit, hızlı; RAG altyapısı gerektirmez.
- **Dezavantaj:** Tüm doküman her zaman yüklenir (ilgisiz bölümler dahil).

### Seçenek B — Bölümlere ayır + ilgili bölümü seç (RAG-lite) — ORTA VADE
- Dokümanları topic anchor'larına böl (kampanya tipi / asset spec / policy / bidding).
- Taranan hesabın kampanya türlerine göre yalnızca ilgili bölümleri payload'a ekle (örn. yalnızca Search + PMax kampanyası varsa Display/Video bölümlerini ekleme).
- **Avantaj:** Token tasarrufu, daha hedefli context.
- **Dezavantaj:** Bölüm seçim mantığı yazılmalı.

> **Öneri:** Önce Seçenek A (platforma göre koşullu, cache'li). Maliyet/token sorun olursa Seçenek B'ye geç.

### Batch payload'a eklenecek bölümler (Seçenek A için somut)
`buildBatchRequestParams` / `runAiEngineForAccount` içinde `system` array'ine ikinci bir cache'li text bloğu eklenir:

```
system: [
  { type: 'text', text: AI_ENGINE_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
  { type: 'text', text: <platforma göre meta VEYA google .md içeriği>, cache_control: { type: 'ephemeral' } },
]
```

Ve system prompt'a şu yönerge eklenir:
> "Önerdiğin her reklam spec'i (başlık/açıklama karakter limiti, asset oranı, kampanya türü uygunluğu, politika) aşağıdaki resmi platform dokümanlarına uymak zorundadır. Limit aşan veya politikaya aykırı öneri verme."

---

## 4. Bakım

- Orijinal PDF/DOCX güncellenirse, ilgili `.md` dosyası yeniden konsolide edilmeli (Part 2 akışı tekrar çalıştırılır).
- Yeni platform dokümanı eklenirse bu index'e satır eklenir + Bölüm 2 tablosu güncellenir.
