import type { ObjectiveSpec, SpecField } from '../types'

const campaignName: SpecField = {
  key: 'campaign.name',
  ui: { labelKey: 'field.campaign.name', control: 'text' },
  map: { level: 'campaign', param: 'name' },
  visibility: [{ exists: 'campaign.objective' }],
  required: [{ exists: 'campaign.name' }],
}

const performanceGoal: SpecField = {
  key: 'adset.optimizationGoal',
  ui: {
    labelKey: 'field.adset.optimizationGoal',
    control: 'select',
    options: [
      { value: 'REACH', labelKey: 'spec.awareness.reach' },
      { value: 'IMPRESSIONS', labelKey: 'spec.awareness.impressions' },
      { value: 'AD_RECALL_LIFT', labelKey: 'spec.awareness.ad_recall_lift' },
      { value: 'THRUPLAY', labelKey: 'spec.awareness.thruplay' },
    ],
  },
  map: { level: 'adset', param: 'optimization_goal' },
  required: [{ exists: 'adset.optimizationGoal' }],
}

export const awarenessSpec: ObjectiveSpec = {
  objectiveKey: 'AWARENESS',
  primaryDestinationKey: 'adset.optimizationGoal',
  primaryDestinationOptions: [
    { value: 'REACH', labelKey: 'spec.awareness.reach' },
    { value: 'IMPRESSIONS', labelKey: 'spec.awareness.impressions' },
    { value: 'AD_RECALL_LIFT', labelKey: 'spec.awareness.ad_recall_lift' },
    { value: 'THRUPLAY', labelKey: 'spec.awareness.thruplay' },
  ],
  steps: [
    {
      stepKey: 'CAMPAIGN',
      fields: [campaignName],
    },
    {
      stepKey: 'ADSET',
      fields: [
        { key: 'adset.name', ui: { labelKey: 'field.adset.name', control: 'text' }, map: { level: 'adset', param: 'name' }, required: [{ exists: 'adset.name' }] },
        { key: 'adset.pageId', ui: { labelKey: 'field.adset.pageId', control: 'select' }, map: { level: 'adset', param: 'page_id' }, required: [{ exists: 'adset.pageId' }] },
        performanceGoal,
        { key: 'adset.budget', ui: { labelKey: 'field.adset.budget', control: 'number' }, map: { level: 'adset', param: 'daily_budget' } },
      ],
    },
    {
      stepKey: 'AD',
      fields: [
        { key: 'ad.name', ui: { labelKey: 'field.ad.name', control: 'text' }, map: { level: 'ad', param: 'name' }, required: [{ exists: 'ad.name' }] },
        { key: 'ad.primaryText', ui: { labelKey: 'field.ad.primaryText', control: 'text' }, required: [{ exists: 'ad.primaryText' }] },
        { key: 'ad.media', ui: { labelKey: 'field.ad.media', control: 'text' }, required: [{ exists: 'ad.media' }] },
      ],
    },
  ],
}
