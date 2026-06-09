# Kendini Güncelleyen Resmi Reklam Bilgi Tabanı — Implementation Plan (Alt-Proje B)

**Goal:** Resmi doküman değişikliklerini AI ile knowledge_item taslaklarına çevir, admin onayından sonra tüm AI yüzeylerine canlı taşı. Mevcut fetch+hash+snapshot korunur; eksik köprü + Firecrawl + onay/UI eklenir.

**Tech:** TypeScript, Next.js, Supabase, Claude (`claudeJson`), Firecrawl (`lib/firecrawl`), `npx tsx` test harness, next-intl.

**Flag:** `OFFICIAL_ADS_AI_PARSER` (default-off) — parser+email yalnız açıkken. `FIRECRAWL_ENABLED` (mevcut) — fetch derinliği.

---

## FAZ B1 — Backend

### Task 1: AI Parser + versiyonlu/idempotent persist
**Files:** Create `lib/yoai/officialAdsKnowledgeParser.ts`; Test `src/tests/officialAdsKnowledgeParser.test.ts`

- `buildParserPrompt(snapshotText, source, existingApproved)` → ClaudeTextArgs (system+user). Katı direktifler: yalnız verilen metinden, Türkçe, ham enum yalnız rules_json, hepsi review_required.
- `parseSnapshotToKnowledge({ normalizedText, source, existingApproved })` → `ParsedKnowledgeItem[]` (claudeJson çağrısı; isClaudeReady false → []).
- `persistKnowledgeDrafts(supabase, source, snapshotId, items)` → versiyonlama (yeni key→v1; mevcut onaylı+farklı→maxVersion+1) + idempotency (aynı normalized_key+source_hash review_required taslak varsa atla) → eklenen sayı.
- Tests (claudeJson + supabase mock): çıkarım, boş items, versiyon artışı, idempotent skip, isClaudeReady false → [].

### Task 2: Firecrawl'ı fetch'e bağla
**Files:** Modify `lib/yoai/officialAdsDocsRefresh.ts`; Test `src/tests/officialAdsFirecrawlFetch.test.ts`
- `fetchOfficialAdsSource`: `fetch_strategy ∈ {html, markdown}` ve `isFirecrawlReady()` → `scrapeSite(url)` markdown; null/throw → mevcut düz fetch. `rss/manual_review` değişmez.
- Tests: Firecrawl yolu (markdown normalize+hash), Firecrawl null → fallback, rss düz fetch (regresyon).

### Task 3: Parser+email'i refresh akışına entegre (flag-gated)
**Files:** Modify `lib/yoai/officialAdsDocsRefresh.ts`; Create `lib/yoai/officialAdsChangeNotifier.ts`; Test `src/tests/officialAdsRefreshParserIntegration.test.ts`
- Snapshot insert `parser_status:'pending'` + dönen id al; `OFFICIAL_ADS_AI_PARSER` açıksa parseSnapshotToKnowledge→persistKnowledgeDrafts; snapshot `parser_status:'success'/'failed'` + `created_items_count`. Hata job'ı patlatmaz.
- Run sonunda `changedSources>0` ise `notifyOwnerOfficialAdsChanges(result)` (best-effort; SMTP env yoksa log).
- Tests: flag-off → parser çağrılmaz (regresyon, snapshot eskisi gibi); flag-on → draft üretir + parser_status success; parser hata → failed, job devam.

---

## FAZ B2 — UI + Enjeksiyon

### Task 4: Onaylı bilgiyi analiz prompt'larına enjekte
**Files:** Create `lib/yoai/ai/docs/officialKnowledgeBlock.ts`; Modify `lib/yoai/ai/systemPrompt.ts` + `lib/yoai/ai/perCampaignPrompt.ts`; Test `src/tests/officialKnowledgeBlock.test.ts`
- `officialKnowledgeBlock(platform)` → onaylı item'leri kompakt metne render; ephemeral-cache system block; item yoksa boş. "GÜNCEL ONAYLI RESMİ BİLGİ" etiketli.
- systemPrompt/perCampaignPrompt'a mevcut blokların yanına ekle (async pre-fetch).
- Tests: item render, boş liste → boş blok, platform filtresi.

### Task 5: Karar store + onay endpoint'leri
**Files:** Modify `lib/yoai/officialAdsKnowledgeStore.ts` (decision fns) ; Create `app/api/admin/gozetim-merkezi/official-ads/pending/route.ts` + `.../decision/route.ts`; Test `src/tests/officialAdsKnowledgeDecision.test.ts`
- `listPendingKnowledge()` (review_required + önceki onaylı versiyon diff için), `approveKnowledgeItem(id, byEmail)` (approved + önceki versiyon effective_to + clearCache), `rejectKnowledgeItem(id)` (deprecated).
- Endpoint'ler super-admin guard (`getIsCurrentUserSuperAdmin`).
- Tests (supabase mock): approve önceki versiyonu emekliye ayırır + cache temizler; reject deprecated; pending listesi.

### Task 6: Gözetim Merkezi admin sayfası + i18n
**Files:** Gözetim Merkezi'ne "Resmi Döküman Güncellemeleri" bölümü/component; `locales/tr.json` + `locales/en.json`
- Bekleyen taslaklar: AI özeti + change_explanation + diff + confidence + kaynak link + Onayla/Reddet. Son refresh_run özeti. Proje UI standardı (text-base, animate-card-enter, amber yok).
- Tüm metinler i18n (tr+en).

### Task 7: Env + CHANGELOG + migration doğrulama + merge
**Files:** `.env.example`, `docs/CHANGELOG.md`
- `OFFICIAL_ADS_AI_PARSER=false` + (varsa) notify SMTP env dokümante.
- Migration omddq doğrulama notu. CHANGELOG. Tüm testler + tsc. Merge→main.

---

## Self-Review
- Kapsam: parser(T1), firecrawl(T2), entegrasyon+email(T3), enjeksiyon(T4), onay(T5), UI(T6), env/doc(T7) → 4 bölüm karşılandı.
- Güvenlik: parser flag-off default; taslaklar review_required; onaysız canlı yok.
- Regresyon: 12 mevcut test + flag-off davranışı korunur.
- Dokunulmaz: Meta/Google publish, Apify, sosyal, hardcoded .ts fallback.
