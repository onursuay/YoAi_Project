# Fix: Meta Traffic Wizard State Reset Issue

**Date:** 2026-03-11
**Type:** Bug Fix
**Scope:** Meta Traffic Wizard

## Problem Statement

### Symptom
Users reported that after successfully publishing a Meta Traffic campaign, attempting to create a **second new campaign** would fail or behave incorrectly:
- Sometimes publish would fail
- Sometimes user would be redirected back to Ad Set step
- Sometimes only ad set would be processed, but creative/ad would not complete
- Issue was NOT about re-publishing the same campaign, but creating a **brand new** campaign after the first one

### Root Cause

The issue was **stale local state persisting across campaign creation sessions**:

1. **First campaign publish succeeds** → Success screen displays
2. **User closes the wizard** → `onClose()` called → Modal closes
3. **User creates a new campaign** → Wizard reopens → `isOpen` changes from `false` to `true`
4. **TrafficWizardState resets** ✅ (campaign/adset/ad data)
5. **BUT: TWStepSummary local state does NOT reset** ❌

The problem: `TWStepSummary` component maintains its own local state:
- `publishStatus` ('idle' | 'publishing' | 'success' | 'error')
- `publishResult` (contains previous campaignId, adsetId, adId)
- `publishError`
- `publishStep`
- `minDailyBudgetTry`

If the React component doesn't unmount between wizard open/close cycles, this state persists, causing:
- UI confusion (success state from previous campaign)
- Potential payload contamination
- Validation state leakage

## Solution

### Implemented Fix

**Force component remount using React `key` prop:**

#### 1. Added `resetKey` state to TrafficWizard ([TrafficWizard.tsx:24-36](components/meta/TrafficWizard.tsx#L24-L36))

```typescript
const [resetKey, setResetKey] = useState(0)

useEffect(() => {
  if (isOpen) {
    setState({ ...initialTrafficWizardState })
    setResetKey(prev => {
      const newKey = prev + 1
      console.log('[TrafficWizard] Reset triggered, new key:', newKey)
      return newKey
    })
  }
}, [isOpen])
```

#### 2. Applied `key` to all wizard step components ([TrafficWizard.tsx:108-113](components/meta/TrafficWizard.tsx#L108-L113))

```typescript
{currentStep === 1 && (
  <TWStepCampaign key={`campaign-${resetKey}`} state={state} onChange={updateState} />
)}
{currentStep === 2 && <TWStepAdSet key={`adset-${resetKey}`} state={state} onChange={updateState} />}
{currentStep === 3 && <TWStepCreative key={`creative-${resetKey}`} state={state} onChange={updateState} />}
{currentStep === 4 && <TWStepSummary key={`summary-${resetKey}`} state={state} onGoToStep={goToStep} onClose={onClose} />}
```

**Result:** Every time the wizard opens, `resetKey` increments, forcing React to:
- Unmount all previous step component instances
- Mount fresh component instances with clean initial state
- Guarantee NO state leakage between campaigns

#### 3. Added debug logging ([TWStepSummary.tsx:166-168](components/meta/traffic-wizard/TWStepSummary.tsx#L166-L168), [TWStepSummary.tsx:220-231](components/meta/traffic-wizard/TWStepSummary.tsx#L220-L231))

```typescript
// Component mount verification
useEffect(() => {
  console.log('[TWStepSummary] Component mounted with fresh state')
}, [])

// Publish payload inspection
console.log('[TWStepSummary] Publishing with payload:', {
  campaignName: payload.campaign.name,
  adsetName: payload.adset.name,
  adName: payload.ad.name,
  hasStaleIds: {
    campaignId: 'campaignId' in payload.campaign,
    adsetId: 'adsetId' in payload.adset,
    adId: 'adId' in payload.ad,
    creativeId: 'creativeId' in payload.ad,
  }
})
```

## Verification & Testing

### Test Scenario

1. **Create first campaign**
   - Open Traffic Wizard
   - Fill all steps (Campaign → Ad Set → Creative → Summary)
   - Click "Publish"
   - Verify success screen shows
   - Close wizard

2. **Create second campaign (immediate)**
   - Open Traffic Wizard again
   - **Expected:** All fields empty, no success state
   - **Check console logs:**
     - `[TrafficWizard] Reset triggered, new key: 2`
     - `[TWStepSummary] Component mounted with fresh state`
   - Fill all steps with **different data**
   - Click "Publish"
   - **Expected:** Publish succeeds independently
   - **Check console logs:**
     - `hasStaleIds` should all be `false`
     - New campaignId/adsetId/adId should be different from first campaign

3. **Repeat for third campaign**
   - Same flow
   - Verify `new key: 3` in logs
   - Verify fresh component mount

### Console Log Verification

Expected console output for sequential campaigns:

```
// First publish
[TrafficWizard] Reset triggered, new key: 1
[TWStepSummary] Component mounted with fresh state
[TWStepSummary] Publishing with payload: { campaignName: "Test 1", hasStaleIds: { all false } }
[TWStepSummary] Publish successful: { campaignId: "123...", adsetId: "456...", adId: "789..." }

// Close and reopen
[TrafficWizard] Reset triggered, new key: 2
[TWStepSummary] Component mounted with fresh state
[TWStepSummary] Publishing with payload: { campaignName: "Test 2", hasStaleIds: { all false } }
[TWStepSummary] Publish successful: { campaignId: "ABC...", adsetId: "DEF...", adId: "GHI..." }
```

## Files Changed

1. **[components/meta/TrafficWizard.tsx](components/meta/TrafficWizard.tsx)**
   - Added `resetKey` state
   - Applied `key` prop to all step components
   - Added debug logging for reset events

2. **[components/meta/traffic-wizard/TWStepSummary.tsx](components/meta/traffic-wizard/TWStepSummary.tsx)**
   - Added mount verification logging
   - Added publish payload inspection logging
   - Added success response logging

## Impact

- ✅ **Fixes:** Sequential campaign creation now works correctly
- ✅ **Ensures:** Complete state isolation between campaigns
- ✅ **Prevents:** Stale ID/state contamination in publish flow
- ✅ **Improves:** User experience — no unexpected errors or redirects
- ✅ **No Breaking Changes:** Existing single-campaign flow unchanged

## Related Issues

This fix also prevents potential issues with:
- Min budget state leaking between campaigns
- Validation errors persisting across sessions
- Success/error UI states appearing incorrectly

## Related: TRY/USD Minimum Budget Flow Verification

As part of this investigation, we also verified the **minimum budget enforcement** mechanism is working correctly:

### USD/TRY Exchange Rate ✅
- Live fetch from dual APIs (exchangerate.host, er-api.com)
- 15-minute cache with deterministic TTL
- Env override/fallback support
- **Never silently defaults to 1** — explicit warnings/errors

### Minimum Budget Calculation ✅
Located in [lib/meta/minDailyBudget.ts](lib/meta/minDailyBudget.ts):

```
Meta API → metaMinRaw (minor unit)
→ metaMinMain = metaMinRaw / factor
→ metaMinTry = metaMinMain × fxRate
→ metaMinTryBuffered = ceil(metaMinTry × 1.02 × 100) / 100  (+2% safety buffer)
→ usdFloorTryBuffered = ceil(usdTryRate × 1.02 × 100) / 100 (1 USD floor +2%)
→ finalMinTry = max(metaMinTryBuffered, usdFloorTryBuffered)
```

**Key guarantees:**
- ✅ 1 USD floor enforced (never below 1 USD equivalent in TRY)
- ✅ 2% safety buffer applied
- ✅ No hardcoded fallback values
- ✅ Account currency conversion support

### Publish Flow Budget Validation ✅
Located in [app/api/meta/traffic-wizard/publish/route.ts](app/api/meta/traffic-wizard/publish/route.ts):

**Pre-flight validation** (lines 57-152):
- Fetches exchange rates before any Meta API call
- Calculates minimum budget for current optimization goal
- Validates CBO (campaign budget) or ABO (ad set budget)
- Returns structured error **before** creating any entities

**Meta API error fallback** (lines 206-246, 441-482):
- Detects Meta budget error (subcode 1885272)
- Regex-based message parsing for Turkish/English
- Extracts minimum value from error if not already known
- Returns standardized error response

### Error Response Format ✅

All budget errors follow this structure:

```json
{
  "ok": false,
  "requiresMinBudget": true,
  "minBudgetTry": 35.72,
  "minDailyBudgetTry": 35.72,
  "enteredBudgetTry": 20,
  "usdTryRate": 35.02,
  "budgetLevel": "campaign" | "adset",
  "message": "Minimum günlük bütçe: 36 TRY (≈ 1 USD)",
  "error": "MIN_DAILY_BUDGET",
  "step": "campaign" | "adset"
}
```

### UI Integration ✅

Frontend ([TWStepSummary.tsx](components/meta/traffic-wizard/TWStepSummary.tsx)):
- Fetches minimum budget on Summary step mount
- Uses same calculation as backend (same API endpoint)
- Validates before allowing publish
- Displays user-friendly error messages

**Result:** Double validation layer (frontend + backend) ensures budget requirements are enforced consistently.

## Future Considerations

**Option to remove debug logs in production:**

If console logs are too verbose for production, can add environment check:

```typescript
if (process.env.NODE_ENV === 'development') {
  console.log('[TrafficWizard] Reset triggered, new key:', newKey)
}
```

However, recommended to keep logs as they help diagnose issues in production without needing to reproduce locally.

**Potential UX improvement:**

Currently, minimum budget is shown as validation error on Summary step. Could enhance UX by:
- Displaying minimum budget hint on budget input fields (Step 1 for CBO, Step 2 for ABO)
- Real-time validation feedback as user types
- Auto-suggest minimum value button
