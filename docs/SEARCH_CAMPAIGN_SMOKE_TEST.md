# Search Campaign Creation — Smoke Test Checklist

Production smoke tests for the Search campaign wizard. Run these before release.

---

## 1. Full Success

**Steps:**
1. Open the Search campaign wizard from the Google Ads dashboard.
2. Complete all steps with valid data:
   - Goal: Search
   - Conversion goals: select ≥1
   - Campaign name, ad group name, valid URL
   - Bidding, budget ≥1 TRY, keywords (≥1), headlines (≥3), descriptions (≥2)
3. Submit.

**Expected:**
- Green success result panel: "Kampanya oluşturuldu"
- Success toast
- Click "Tamam" → wizard closes, campaign list refreshes
- New campaign visible in list
- Wizard state resets on next open

---

## 2. Partial Success (Conversion Goals Not Applied)

**Setup:** Mock `attachConversionGoalToCampaign` to return `{ ok: false }`, or use a scenario where the Google API rejects the config attach.

**Steps:**
1. Create a Search campaign with conversion goals selected.
2. Submit.

**Expected:**
- Amber result panel: "Kampanya oluşturuldu" + warning about conversion goals
- Partial-success toast
- Click "Tamam" → wizard closes, list refreshes
- Campaign exists in Google Ads (partial success, not total failure)
- Conversion goals not attached; user instructed to configure manually

---

## 3. Custom Conversion Goal Failure

**Setup:** Use invalid/non-existent conversion action IDs, or disconnect conversion actions API.

**Steps:**
1. Create a Search campaign with conversion goals selected.
2. Submit.

**Expected:**
- Wizard stays open
- Error banner with user-friendly message (no raw API dump)
- Toast (error type)
- No campaign created
- Wizard state preserved; user can fix and retry

---

## 4. Invalid Budget

**Steps:**
1. Complete wizard with budget &lt; 1 TRY (e.g. 0 or empty).
2. Submit.

**Expected:**
- Validation error before API call, or API returns 400
- Error: "Minimum günlük bütçe 1 TRY"
- Wizard stays open, state preserved

---

## 5. Invalid URL

**Steps:**
1. Enter invalid URL (e.g. "abc", no protocol).
2. Try to proceed / submit.

**Expected:**
- Validation error or API 400
- User-friendly URL error message
- Wizard stays open, state preserved

---

## 6. No Conversion Actions

**Steps:**
1. Proceed to conversion step without selecting any conversion goal (where required).
2. Submit.

**Expected:**
- Validation error: "En az 1 dönüşüm hedefi seçin" (or similar)
- Wizard stays open at conversion step
- State preserved

---

## 7. Audience Preserved Behavior

**Scope:** Do NOT modify audience code. Verify existing behavior is intact.

**Steps:**
1. Create campaign with audience targeting (e.g. user list).
2. Submit successfully.

**Expected:**
- Campaign created with audience criteria
- Audience summary correct on summary step
- No regressions in audience selection/display

**Negative:** Do not touch audience components, state, payload mapping, APIs, or summary rendering.

---

## Result Handling Summary

| Result          | Wizard state | Panel/Toast                    | Close/refresh  |
|-----------------|-------------|---------------------------------|----------------|
| Full success    | Resets      | Green panel + success toast     | On "Tamam"    |
| Partial success | Resets      | Amber panel + partial toast    | On "Tamam"    |
| Hard failure    | Preserved   | Red banner + error toast        | No close      |

---

## Manual Test Steps (Quick Reference)

1. **Full success:** Valid data → submit → green panel → Tamam → close + refresh
2. **Partial:** Conversion goals selected, mock config attach fail → amber panel → Tamam → close + refresh
3. **Custom goal fail:** Invalid conversion action → error banner → no campaign → stay open
4. **Invalid budget:** &lt; 1 TRY → error → stay open
5. **Invalid URL:** Bad URL → error → stay open
6. **No conversions:** No goal selected (if required) → validation error → stay open
7. **Audience:** With audience → success → audience applied, no regressions
