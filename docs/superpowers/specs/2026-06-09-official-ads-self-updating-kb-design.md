# Kendini Güncelleyen Resmi Reklam Bilgi Tabanı — Tasarım (Alt-Proje B)

**Tarih:** 2026-06-09 · **Durum:** Onaylandı (4 bölüm) · **Sıra:** C ✅ → **B (bu)** → A

## Amaç
Meta & Google resmi dokümanlarını aylık tarayıp değişiklikleri AI ile "eyleme dönük kural" taslaklarına çevirmek; admin onayından sonra bu bilgiyi tüm AI yüzeylerine (reklam üretimi + politika + analiz) canlı taşımak. Eksik olan **snapshot → knowledge_item köprüsü** tamamlanır.

## Mevcut durum (~%80 kurulu, DOKUNULMAYAN korunur)
- Aylık cron (`0 6 1 * *` → `/api/cron/official-ads-refresh`), `runOfficialAdsDocsRefresh` (fetch+SHA256+snapshot), 4 tablo (`official_ads_sources/knowledge_items/doc_snapshots/refresh_runs`), `officialAdsKnowledgeStore` (adCreator+proposalPolicyGuard tüketir), 12 mevcut test. **Kopukluk:** değişiklik snapshot'a yazılıyor ama knowledge_item'a dönüşmüyor; AI özeti/onay/bildirim yok; düz fetch JS-render dokümanlarda zayıf.

## Kararlar (kilitli)
1. **Güvenlik modeli:** AI taslak → admin onay → canlı. Hiçbir taslak otomatik canlıya geçmez (`review_status='review_required'`).
2. **Bilgi yüzeyi:** DB `knowledge_items` tek kaynak; mevcut adCreator+policyGuard'a EK olarak analiz prompt'larına da enjekte (hardcoded `.ts` küratörlü fallback olarak kalır).
3. **Çekme:** Firecrawl (JS-render) + düz fetch fallback. `fetch_strategy ∈ {html, markdown}` → Firecrawl; `rss/manual_review` → düz fetch.
4. **Onay yüzeyi:** Gözetim Merkezi'nde admin sayfası + best-effort owner e-posta.

## Mimari (eklenen halkalar)
```
cron → runOfficialAdsDocsRefresh
  [1] fetchOfficialAdsSource: Firecrawl(hazırsa)→else düz fetch
  [2] değişen snapshot → AI PARSER (parseSnapshotToKnowledge) → review_required TASLAK + parser_status/created_items_count
  [3] değişiklik varsa owner'a best-effort e-posta
  [4] admin onay (Gözetim Merkezi) → approved + eski versiyon effective_to
  [5] onaylı item → adCreator+policyGuard (mevcut) + analiz prompt'ları (yeni)
```

## Bileşenler
- **B1 (backend):** `lib/yoai/officialAdsKnowledgeParser.ts` (AI parser + versiyonlu/idempotent persist), `fetchOfficialAdsSource` Firecrawl entegrasyonu, `runOfficialAdsDocsRefresh` parser+email çağrısı (flag-gated), `lib/yoai/officialAdsChangeNotifier.ts` (best-effort e-posta).
- **B2 (UI + injection):** `lib/yoai/ai/docs/officialKnowledgeBlock.ts` (+ systemPrompt/perCampaignPrompt enjeksiyon), karar store + `/api/admin/gozetim-merkezi/official-ads/{pending,decision}`, Gözetim Merkezi admin sayfası (i18n).

## AI Parser
Girdi: değişen `normalized_text` (≤16k) + kaynak meta + platformun onaylı item özetleri + diff. `claudeJson` (temp 0.2) şema: `items[]{category,title,normalized_key,summary,rules_json,allowed_values,forbidden_values,change_type,change_explanation,confidence}`. Direktifler: yalnız verilen metinden (uydurma yok), Türkçe summary, ham enum yalnız rules_json'da, hepsi review_required. Versiyon: yeni key→v1; mevcut+farklı→v+1; idempotent (normalized_key+source_hash bekleyen taslak varsa atla). Hata→parser_status='failed' (job patlamaz).

## Onay
- approve: review_status='approved', approved_by/at, önceki onaylı versiyon `effective_to`=bugün, `clearKnowledgeCache()`.
- reject: review_status='deprecated' (audit izi).

## Güvenlik / flag / maliyet
- **`OFFICIAL_ADS_AI_PARSER=false`** (default-off): parser+email yalnız flag açıkken. Kapalı=mevcut davranış birebir (sıfır regresyon). Firecrawl ayrıca `FIRECRAWL_ENABLED`.
- **Migration ön-koşulu:** 4 tablo omddq'da uygulanmış olmalı (store graceful ama parser yazımı tablo ister).
- Maliyet: yalnız değişen snapshot; 1 Claude çağrısı/kaynak; `isClaudeReady()` false→atla.

## Test
Parser (claudeJson mock: çıkarım/versiyon/idempotent/boş/hata), Firecrawl-in-fetch (yol+fallback), karar mantığı (approve effective_to + reject deprecate), enjeksiyon blok (render/boş), regresyon (12 mevcut test + flag-off), admin sayfası i18n (tr+en).

## Kapsam dışı
A (uzman motor) ayrı. Hardcoded `.ts` oto-üretimi YOK (fallback kalır). Meta/Google publish/Apify/sosyal dokunulmaz.
