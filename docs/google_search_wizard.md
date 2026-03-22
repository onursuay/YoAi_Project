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
# Search Wizard Backend Parity Audit

> Trace: Wizard State → buildCreatePayload → create API route → createFullCampaign → Google Ads API

---

## 1. Fields Fully Connected End-to-End

| Wizard State | Payload Key | Backend Use | Google Ads API |
|--------------|-------------|-------------|----------------|
| campaignName | campaignName | ✓ | campaigns.create.name |
| campaignType | advertisingChannelType | ✓ | campaigns.create.advertisingChannelType |
| dailyBudget | dailyBudgetMicros | ✓ | campaignBudgets.amountMicros |
| biddingStrategy | biddingStrategy | ✓ | campaigns bidding field (manualCpc, targetCpa, etc.) |
| targetCpa | targetCpaMicros | ✓ | targetCpa.targetCpaMicros |
| targetRoas | targetRoas | ✓ | targetRoas.targetRoas |
| startDate | startDate | ✓ | campaigns.startDateTime |
| endDate | endDate | ✓ | campaigns.endDateTime |
| networkSettings | networkSettings | ✓ | campaigns.networkSettings |
| adGroupName | adGroupName | ✓ | adGroups.create.name |
| cpcBid | cpcBidMicros | ✓ | adGroups.cpcBidMicros, adGroupCriteria |
| keywordsRaw | keywords | ✓ | adGroupCriteria (keyword) |
| negativeKeywordsRaw | negativeKeywords | ✓ | campaignCriteria (negative keyword) |
| finalUrl | finalUrl | ✓ | adGroupAds.finalUrls |
| headlines | headlines | ✓ | responsiveSearchAd.headlines |
| descriptions | descriptions | ✓ | responsiveSearchAd.descriptions |
| path1 | path1 | ✓ | responsiveSearchAd.path1 |
| path2 | path2 | ✓ | responsiveSearchAd.path2 |
| locations | locationIds | ✓ | campaignCriteria (location) |
| locations (negative) | negativeLocationIds | ✓ | campaignCriteria (negative location) |
| languageIds | languageIds | ✓ | campaignCriteria (language) |
| selectedAudienceSegments | audienceResourceNames, userInterestIds, detailedDemographicIds, lifeEventIds, customAudienceIds, combinedAudienceIds | ✓ | campaignCriteria (audience) |
| audienceMode | audienceMode | ✓ | targeting_setting (if implemented) |
| adSchedule | adSchedule | ✓ | campaignCriteria (adSchedule) |

---

## 2. Fields Present in UI/State but NOT Sent to Payload

| Wizard State | Notes |
|--------------|-------|
| **selectedConversionGoalIds** | UI-only. See [Conversion goals audit](#9-conversion-goals-audit) below. |
| **primaryConversionGoalId** | UI-only. See [Conversion goals audit](#9-conversion-goals-audit) below. |
| ~~biddingFocus~~ | **Connected** for MAXIMIZE_CONVERSIONS and TARGET_IMPRESSION_SHARE. See biddingFocus implementation. |
| **bidOnlyForNewCustomers** | UI-only. See [bidOnlyForNewCustomers audit](#bidonlyfornewcustomers-audit) below. |
| **locationTargetingMode** | PRESENCE_OR_INTEREST vs PRESENCE_ONLY. Never added to buildCreatePayload. |
| **euPoliticalAdsDeclaration** | NOT_POLITICAL vs POLITICAL. **Backend already supports** `containsEuPoliticalAdvertising`; buildCreatePayload does not map it. |
| **aiMax.enabled** | AI Max master toggle. Never added. |
| **aiMax.broadMatchWithAI** | Broad match with AI. Never added. |
| **aiMax.targetingExpansion** | AI targeting expansion. Never added. |
| **aiMax.creativeOptimization** | AI creative optimization. Never added. |
| campaignGoal | Display-only; not required for create. |
| geoSearchCountry | UI helper for location search; not sent. |

---

## 3. Fields Sent to Payload but Ignored in Backend

None. All keys returned by buildCreatePayload are consumed by createFullCampaign.

---

## 4. Fields That Would Require New Google Ads API Mapping

| Field | Google Ads API Mapping | Complexity |
|-------|-------------------------|------------|
| ~~selectedConversionGoalIds~~ | **Audited: UI-only.** Mock IDs ≠ API. Requires conversion-actions API + post-create CampaignConversionGoal/CustomConversionGoal. | N/A |
| ~~primaryConversionGoalId~~ | **Audited: UI-only.** primary_for_goal is account-level. Campaign-specific primary needs CustomConversionGoal. | N/A |
| **biddingFocus** | For MAXIMIZE_CONVERSIONS: `maximize_conversions_value` vs `maximize_conversions`; value-based vs count-based. Different bidding field. | Medium |
| ~~bidOnlyForNewCustomers~~ | **Audited: remains UI-only.** `CampaignLifecycleGoal.optimization_mode` is read-only. | N/A |
| **locationTargetingMode** | `Campaign.geoTargetTypeSetting.positiveGeoTargetType` — `PRESENCE_OR_INTEREST` vs `PRESENCE_ONLY`. | Low |
| **aiMax.*** | Product-specific; not a standard Google Ads API field. YoAi custom logic or future Google feature. | N/A (custom) |

---

## 5. Quick Win: euPoliticalAdsDeclaration

**Backend already supports this.**

- `CreateCampaignParams` has `containsEuPoliticalAdvertising?: EuPoliticalAdvertising`
- `createFullCampaign` uses it (line 136–137)
- `buildCreatePayload` does **not** send it

**Change:** In `WizardHelpers.ts`:

```ts
...(state.euPoliticalAdsDeclaration === 'POLITICAL' && {
  containsEuPoliticalAdvertising: 'CONTAINS_EU_POLITICAL_ADVERTISING',
}),
```

Or map both values for clarity. CreateCampaignParams uses `DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING` as default when absent.

---

## 6. Exact Files That Must Change for Full Search Backend Parity

| File | Changes |
|------|---------|
| **components/google/wizard/shared/WizardHelpers.ts** | Add `containsEuPoliticalAdvertising` from `euPoliticalAdsDeclaration`. Optionally add `locationTargetingMode` → `geoTargetTypeSetting` if supported by create-campaign. |
| **lib/google-ads/create-campaign.ts** | Extend `CreateCampaignParams` with: `locationTargetingMode?`, `conversionActionIds?`, `primaryConversionActionId?`, `biddingFocus?`, `bidOnlyForNewCustomers?`, `aiMax?`. Add Google Ads API mapping for each. |
| **lib/google-ads/create-campaign.ts** | Add `geoTargetTypeSetting` to campaigns.create when `locationTargetingMode === 'PRESENCE_ONLY'` (positiveGeoTargetType: PRESENCE_ONLY). |
| **lib/google-ads/create-campaign.ts** | Map `biddingFocus` for MAXIMIZE_CONVERSIONS: use `maximize_conversions_value` when CONVERSION_VALUE, else `maximize_conversions`. |
| **app/api/integrations/google-ads/campaigns/create/route.ts** | Pass through new params; no validation changes needed for optional fields. |

---

## 7. Summary Table

| Field | In State | In Payload | In Backend | In GA API |
|-------|----------|------------|------------|-----------|
| selectedConversionGoalIds | ✓ | ✗ | ✗ | — (mock IDs; see audit) |
| primaryConversionGoalId | ✓ | ✗ | ✗ | — (see audit) |
| biddingFocus | ✓ | ✓ | ✓ (MAXIMIZE_CONVERSIONS, TARGET_IMPRESSION_SHARE) | maximizeConversionValue, targetImpressionShare.location |
| bidOnlyForNewCustomers | ✓ | ✗ | ✗ | — (API field read-only; see audit) |
| locationTargetingMode | ✓ | ✗ | ✗ | geoTargetTypeSetting |
| euPoliticalAdsDeclaration | ✓ | ✗ | ✓ (param exists) | containsEuPoliticalAdvertising |
| aiMax.* | ✓ | ✗ | ✗ | — (custom) |

---

## 8. bidOnlyForNewCustomers audit

**Conclusion: remains UI-only.**

| Check | Result |
|-------|--------|
| Google Ads field | `CampaignLifecycleGoal.customer_acquisition_goal_settings.optimization_mode` |
| Mutability | **Output only (read-only)** — cannot be set via API mutate. [campaign_lifecycle_goal fields v23](https://developers.google.com/google-ads/api/fields/v23/campaign_lifecycle_goal) |
| Prerequisites | `CustomerLifecycleGoal` at account level; `UserListCustomerType` to segment (Customer Match lists with 1000+ members); lifecycle goals configured in account. |
| Create flow support | Current `createFullCampaign()` does not create or configure `CustomerLifecycleGoal` or `UserListCustomerType`. |

**Reason:** The API field that would map to "bid only for new customers" (`optimization_mode = TARGET_NEW_CUSTOMERS`) is **read-only**. Customer acquisition lifecycle goals require account-level setup (CustomerLifecycleGoal, UserListCustomerType) that is outside the scope of the campaign create flow. Implementing would require pre-existing account configuration and may fail for accounts without it.

**Recommendation:** Keep `bidOnlyForNewCustomers` as UI-only. Users can enable "Bid only for new customers" manually in Google Ads after campaign creation if their account has lifecycle goals configured.

---

## 9. Conversion goals audit (selectedConversionGoalIds, primaryConversionGoalId)

**Conclusion: both remain UI-only.**

### Current architecture

| Aspect | Current state |
|--------|----------------|
| **UI data source** | `CONVERSION_GOALS_MOCK` — local config with IDs: `purchase`, `add_to_cart`, `signup`, `contact`, `phone_call`, `page_view` |
| **Conversion action API** | No wizard API. `attribution.ts` fetches `conversion_action` for attribution settings only, not for campaign create. |
| **Google Ads model** | `CampaignConversionGoal` = (category, origin) + biddable. `CustomConversionGoal` = specific `conversion_action` resource names. |

### Blockers

| Blocker | Detail |
|--------|--------|
| **Mock IDs ≠ API identifiers** | Mock IDs (`purchase`, `signup`, etc.) are not Google Ads `conversion_action` resource names (`customers/123/conversionActions/456`). Cannot be sent to API. |
| **No conversion fetch for wizard** | Wizard has no API to list account conversion actions with `resource_name`, `category`, `origin`. Required before any backend mapping. |
| **Post-create only** | `CampaignConversionGoal` and `ConversionGoalCampaignConfig` reference an existing campaign. Must be mutated after campaign create, not during. |
| **primary_for_goal is account-level** | `ConversionAction.primary_for_goal` is account-wide, not campaign-specific. Changing it affects all campaigns. |

### Google Ads resources (if implemented)

| Field | Resource | When |
|-------|----------|------|
| selectedConversionGoalIds | `CampaignConversionGoal` (biddable by category+origin) or `CustomConversionGoal` + `ConversionGoalCampaignConfig` | Post-create mutate |
| primaryConversionGoalId | `CustomConversionGoal.conversion_actions` (single action = primary) or leave to account default | Post-create |

### Recommended product decision

1. **Keep UI-only for now** — No safe backend connection without additional work.
2. **Phase 2 (if desired):**
   - Add `GET /api/integrations/google-ads/conversion-actions` to fetch `resource_name`, `category`, `origin`, `name` from the account.
   - Replace `CONVERSION_GOALS_MOCK` with real data in `StepConversionAndName`.
   - After campaign create: mutate `CampaignConversionGoal` (biddable by category+origin) or create `CustomConversionGoal` and set `ConversionGoalCampaignConfig`.
3. **primaryConversionGoalId:** For campaign-specific primary, use `CustomConversionGoal` with only the primary conversion action. Do not modify `ConversionAction.primary_for_goal`.

---

*End of audit.*
# YoAi Google Search Campaign Wizard — Refactor Plan (Planning Only)

> **CRITICAL:** Do not implement. Output only a strict refactor plan.

---

## 1. Proposed Search Step Map

| New Index | Step Name | Description |
|-----------|-----------|-------------|
| 0 | Goal + Campaign Type | Select goal and ensure campaign type is SEARCH |
| 1 | Conversion Goals + Campaign Name | Desired outcomes / conversion goals + campaign name |
| 2 | Bidding + Customer Acquisition | Bidding strategy, target CPA/ROAS, new vs existing customer focus |
| 3 | Campaign Settings | Networks, locations, languages, EU political ads, audience (embedded), ad schedule, dates |
| 4 | AI Max | Search-specific AI/automated features (placeholder) |
| 5 | Keywords and Ads | Merged: ad group, keywords, negative keywords + RSA (URL, headlines, descriptions) |
| 6 | Budget | Daily budget, start/end dates |
| 7 | Review | Summary + final control |

**Total: 8 steps** (indices 0–7)

---

## 2. Old Step → New Step Mapping

| Old Index | Old Step | Action | New Index(s) |
|-----------|----------|--------|-------------|
| 0 | StepGoalType | **STAY** (reuse) | 0 |
| 1 | StepCampaignSettings | **SPLIT** | 1 (campaignName), 2 (bidding), 6 (budget, dates), 3 (networks) |
| 2 | StepLocationLanguage | **MOVE** (merge into) | 3 |
| 3 | StepAudience | **MOVE** (embed unchanged) | 3 |
| 4 | StepAdGroupKeywords | **MERGE** | 5 |
| 5 | StepAdCreation | **MERGE** | 5 |
| 6 | StepAdSchedule | **MOVE** (merge into) | 3 |
| 7 | StepSummary | **STAY** (update non-audience display) | 7 |

---

## 3. Reusable Components

| Component | Reuse Strategy |
|-----------|----------------|
| **StepGoalType** | Reuse as-is for step 0. Optionally filter to SEARCH-only goals when wizard is Search-specific. |
| **StepAudience** | Reuse 1:1. Embed inside step 3 (Campaign Settings) with identical props (`state`, `update`, `t`). **Do not modify.** |
| **StepAdSchedule** | Reuse as sub-section or collapsible block inside step 3. Same props. |
| **StepSummary** | Reuse for step 7. Only non-audience sections may be reordered or extended; audience summary block must remain unchanged. |
| **StepLocationLanguage** | Reuse as sub-section inside step 3. Same props; no logic changes. |
| **NetworkSettings block** | Extract from StepCampaignSettings and reuse inside step 3 (already inline in StepCampaignSettings). |

---

## 4. Components to Modify (Safe-to-Change)

| Component | Change |
|-----------|--------|
| **StepCampaignSettings** | Split into three uses: campaign name → step 1; bidding + target CPA/ROAS → step 2; budget + dates → step 6; networks → step 3. Component may be dismantled or turned into smaller sub-components. |
| **StepAdGroupKeywords** | Merge with StepAdCreation into new **StepKeywordsAndAds** (step 5). Keep keyword planner integration. |
| **StepAdCreation** | Merge into StepKeywordsAndAds. |
| **StepLocationLanguage** | Used as sub-section in step 3; no internal logic change. |
| **StepAdSchedule** | Used as sub-section in step 3; no internal logic change. |
| **StepSummary** | Reorder rows to match new flow; add new fields (conversion goals, AI Max, etc.). Do not touch audience summary block. |
| **GoogleCampaignWizard** | Replace step order and render logic for Search flow; conditionally use Search step map. |
| **WizardValidation** | Remap validation by new step index. |
| **WizardTypes** | Add new state fields; do not modify audience-related types. |
| **WizardHelpers** | Update `buildCreatePayload` for new fields; do not touch audience mapping. |

---

## 5. New Components Required

| Component | Step | Purpose |
|-----------|------|---------|
| **StepConversionAndName** | 1 | Conversion goals / desired outcomes selection + campaign name input |
| **StepBiddingAcquisition** | 2 | Bidding strategy, target CPA/ROAS, customer acquisition mode (new vs existing) |
| **StepCampaignSettingsSearch** | 3 | Composite step: networks, locations, languages, EU political ads checkbox, embedded StepAudience, StepAdSchedule, start/end dates |
| **StepAIMax** | 4 | Search-specific AI features (e.g. broad match with AI, automated bidding toggles). Product definition TBD. |
| **StepKeywordsAndAds** | 5 | Merged keywords + ad creation (ad group, keywords, negative keywords, URL, headlines, descriptions, paths) |
| **StepBudget** | 6 | Daily budget input + optional start/end dates |

---

## 6. State Field Mapping per Step

### Step 0: Goal + Campaign Type
| Field | Source |
|-------|--------|
| `campaignGoal` | Existing |
| `campaignType` | Existing (constrained to SEARCH) |

### Step 1: Conversion Goals + Campaign Name
| Field | Source |
|-------|--------|
| `campaignName` | Existing (moved from old step 1) |
| `conversionGoalIds` | **NEW** (string[]) — optional |
| `primaryConversionAction` | **NEW** (string) — optional |

### Step 2: Bidding + Customer Acquisition
| Field | Source |
|-------|--------|
| `biddingStrategy` | Existing |
| `targetCpa` | Existing |
| `targetRoas` | Existing |
| `customerAcquisitionMode` | **NEW** ('NEW' \| 'EXISTING' \| 'ALL') — optional |

### Step 3: Campaign Settings
| Field | Source |
|-------|--------|
| `networkSettings` | Existing |
| `locations` | Existing |
| `geoSearchCountry` | Existing |
| `languageIds` | Existing |
| `euPoliticalAdsDeclared` | **NEW** (boolean) — EU compliance |
| `selectedAudienceIds` | Existing (protected) |
| `selectedAudienceSegments` | Existing (protected) |
| `audienceMode` | Existing (protected) |
| `adSchedule` | Existing |
| `startDate` | Existing |
| `endDate` | Existing |

### Step 4: AI Max
| Field | Source |
|-------|--------|
| `aiMaxEnabled` | **NEW** (boolean) — TBD |
| `broadMatchWithAI` | **NEW** (boolean) — TBD |

### Step 5: Keywords and Ads
| Field | Source |
|-------|--------|
| `adGroupName` | Existing |
| `keywordsRaw` | Existing |
| `negativeKeywordsRaw` | Existing |
| `defaultMatchType` | Existing |
| `cpcBid` | Existing |
| `finalUrl` | Existing |
| `headlines` | Existing |
| `descriptions` | Existing |
| `path1` | Existing |
| `path2` | Existing |

### Step 6: Budget
| Field | Source |
|-------|--------|
| `dailyBudget` | Existing |

### Step 7: Review
No direct state edits; display only.

---

## 7. Validation Mapping per Step

| New Step | Validation Rules | Source |
|----------|------------------|--------|
| 0 | None | Old step 0 |
| 1 | `campaignName` required | Old step 1 |
| 2 | `targetCpa` required if `biddingStrategy === 'TARGET_CPA'`; `targetRoas` required if `biddingStrategy === 'TARGET_ROAS'` | Old step 1 |
| 3 | `languageIds.length > 0` | Old step 2 |
| 4 | None (or TBD for AI Max) | New |
| 5 | `adGroupName` required; `keywordsRaw` required (SEARCH); `finalUrl` starts with http; headlines ≥3, descriptions ≥2; length/duplicate rules for RSA | Old steps 4, 5 |
| 6 | `dailyBudget` ≥ 1 | Old step 1 |
| 7 | None | Old step 7 |

---

## 8. Safe-to-Change Files

| File | Changes Allowed |
|------|-----------------|
| `components/google/wizard/GoogleCampaignWizard.tsx` | Step order, step render map, STEPS labels |
| `components/google/wizard/steps/StepGoalType.tsx` | Minor: optionally constrain to SEARCH |
| `components/google/wizard/steps/StepCampaignSettings.tsx` | Split/dismantle; extract sub-blocks |
| `components/google/wizard/steps/StepLocationLanguage.tsx` | Use as child; no internal changes |
| `components/google/wizard/steps/StepAdGroupKeywords.tsx` | Merge into StepKeywordsAndAds |
| `components/google/wizard/steps/StepAdCreation.tsx` | Merge into StepKeywordsAndAds |
| `components/google/wizard/steps/StepAdSchedule.tsx` | Use as child in step 3; no internal changes |
| `components/google/wizard/steps/StepSummary.tsx` | Reorder rows; add new fields; **do not modify audience summary block** |
| `components/google/wizard/shared/WizardTypes.ts` | Add new fields; **do not modify audience-related types** |
| `components/google/wizard/shared/WizardValidation.ts` | Remap by new step index; **do not modify audience step validation** |
| `components/google/wizard/shared/WizardHelpers.ts` | Extend buildCreatePayload for new fields; **do not modify audience payload mapping** |
| `app/api/integrations/google-ads/campaigns/create/route.ts` | Extend for new payload fields; **do not modify audience handling** |

---

## 9. Protected Files (Must Not Be Touched)

| File | Reason |
|------|--------|
| `components/google/wizard/steps/StepAudience.tsx` | Protected — audience functionality |
| `components/.../AudienceSegmentEditor.tsx` | Protected — audience UI |
| `lib/google-ads/audience-*.ts` | Protected — audience APIs |
| `lib/audience/*` | Protected — audience logic |
| Audience-related parts of `WizardHelpers.ts` (lines 47–64) | Protected — audience payload |
| Audience-related parts of `WizardTypes.ts` (SelectedAudienceSegment, audienceMode, etc.) | Protected |
| Audience-related parts of `StepSummary.tsx` (lines 86–98) | Protected — audience summary block |
| Audience create/edit/list/search/browse APIs | Protected |
| Any file containing `audience`, `selectedAudienceSegments`, `audienceMode`, `audienceResourceNames`, `userInterestIds`, `detailedDemographicIds`, `lifeEventIds`, `customAudienceIds`, `combinedAudienceIds` in audience-specific logic | Protected |

---

## 10. Search Flow Step Order (Wizard Shell)

```ts
// Pseudocode for GoogleCampaignWizard when campaignType === 'SEARCH'
const SEARCH_STEPS = [
  { label: 'steps.goal', component: StepGoalType },
  { label: 'steps.conversionAndName', component: StepConversionAndName },
  { label: 'steps.bidding', component: StepBiddingAcquisition },
  { label: 'steps.campaignSettings', component: StepCampaignSettingsSearch }, // contains StepAudience, StepLocationLanguage, StepAdSchedule
  { label: 'steps.aiMax', component: StepAIMax },
  { label: 'steps.keywordsAndAds', component: StepKeywordsAndAds },
  { label: 'steps.budget', component: StepBudget },
  { label: 'steps.summary', component: StepSummary },
]
```

---

## 11. Step 3 Internal Structure (Campaign Settings Composite)

Step 3 should render in order:
1. Network settings (from old StepCampaignSettings)
2. StepLocationLanguage (`<StepLocationLanguage {...stepProps} />`)
3. EU political ads checkbox (new)
4. **StepAudience** (`<StepAudience {...stepProps} />`) — **unchanged, same props**
5. StepAdSchedule (`<StepAdSchedule {...stepProps} />`)
6. Start/end dates (from old StepCampaignSettings)

---

## 12. New State Fields Summary

| Field | Type | Default | Used In |
|-------|------|---------|---------|
| `conversionGoalIds` | string[] | [] | Step 1 |
| `primaryConversionAction` | string | '' | Step 1 |
| `customerAcquisitionMode` | 'NEW' \| 'EXISTING' \| 'ALL' | 'ALL' | Step 2 |
| `euPoliticalAdsDeclared` | boolean | false | Step 3 |
| `aiMaxEnabled` | boolean | false | Step 4 |
| `broadMatchWithAI` | boolean | true | Step 4 |

---

## 13. Implementation Order (When Approved)

1. Add new state fields to `WizardTypes.ts` (non-audience only).
2. Create `StepConversionAndName`, `StepBiddingAcquisition`, `StepBudget`, `StepAIMax`.
3. Create `StepKeywordsAndAds` (merge AdGroupKeywords + AdCreation).
4. Create `StepCampaignSettingsSearch` (composite with embedded StepAudience, StepLocationLanguage, StepAdSchedule).
5. Update `GoogleCampaignWizard` to use Search step map.
6. Remap `WizardValidation` to new step indices.
7. Update `WizardHelpers.buildCreatePayload` for new fields.
8. Update `StepSummary` non-audience sections only.
9. Update create API route for new payload fields.

---

*End of refactor plan. Do not implement until approved.*
