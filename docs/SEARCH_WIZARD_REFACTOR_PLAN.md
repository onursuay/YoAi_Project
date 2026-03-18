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
