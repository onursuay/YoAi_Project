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
