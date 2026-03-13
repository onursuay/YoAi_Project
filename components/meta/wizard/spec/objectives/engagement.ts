import type { ObjectiveSpec, SpecField } from '../types'

const conversionLocation: SpecField = {
  key: 'adset.conversionLocation',
  ui: {
    labelKey: 'field.adset.conversionLocation',
    control: 'select',
    options: [
      { value: 'ON_AD', labelKey: 'spec.engagement.on_ad' },
      { value: 'WEBSITE', labelKey: 'destination.WEBSITE' },
      { value: 'APP', labelKey: 'destination.APP' },
      { value: 'MESSENGER', labelKey: 'destination.MESSENGER' },
      { value: 'WHATSAPP', labelKey: 'destination.WHATSAPP' },
      { value: 'INSTAGRAM_DIRECT', labelKey: 'destination.INSTAGRAM_DIRECT' },
      { value: 'CALL', labelKey: 'destination.CALL' },
      { value: 'ON_PAGE', labelKey: 'spec.engagement.on_page' },
    ],
  },
  map: { level: 'adset', param: 'destination_type' },
  required: [{ exists: 'adset.conversionLocation' }],
  resets: [
    { when: { exists: 'adset.conversionLocation' }, clear: ['adset.pixelId', 'adset.customEventType', 'adset.appId', 'adset.appStoreUrl', 'adset.instagramAccountId', 'ad.chatGreeting', 'ad.phoneNumber'] },
  ],
}

export const engagementSpec: ObjectiveSpec = {
  objectiveKey: 'ENGAGEMENT',
  primaryDestinationKey: 'adset.conversionLocation',
  primaryDestinationOptions: [
    { value: 'ON_AD', labelKey: 'spec.engagement.on_ad' },
    { value: 'WEBSITE', labelKey: 'destination.WEBSITE', capabilityGate: 'hasPixels' },
    { value: 'APP', labelKey: 'destination.APP', capabilityGate: 'hasApps' },
    { value: 'MESSENGER', labelKey: 'destination.MESSENGER', capabilityGate: 'hasMessaging' },
    { value: 'WHATSAPP', labelKey: 'destination.WHATSAPP', capabilityGate: 'hasWhatsApp' },
    { value: 'INSTAGRAM_DIRECT', labelKey: 'destination.INSTAGRAM_DIRECT', capabilityGate: 'hasIgAccounts' },
    { value: 'CALL', labelKey: 'destination.CALL' },
    { value: 'ON_PAGE', labelKey: 'spec.engagement.on_page' },
  ],
  steps: [
    { stepKey: 'CAMPAIGN', fields: [{ key: 'campaign.name', ui: { labelKey: 'field.campaign.name', control: 'text' }, map: { level: 'campaign', param: 'name' }, required: [{ exists: 'campaign.name' }] }] },
    {
      stepKey: 'ADSET',
      fields: [
        { key: 'adset.name', ui: { labelKey: 'field.adset.name', control: 'text' }, map: { level: 'adset', param: 'name' }, required: [{ exists: 'adset.name' }] },
        { key: 'adset.pageId', ui: { labelKey: 'field.adset.pageId', control: 'select' }, map: { level: 'adset', param: 'page_id' }, required: [{ exists: 'adset.pageId' }] },
        conversionLocation,
        { key: 'adset.optimizationGoal', ui: { labelKey: 'field.adset.optimizationGoal', control: 'select' }, map: { level: 'adset', param: 'optimization_goal' } },
        { key: 'adset.pixelId', ui: { labelKey: 'field.adset.pixelId', control: 'select' }, visibility: [{ eq: ['adset.conversionLocation', 'WEBSITE'] }] },
        { key: 'adset.appId', ui: { labelKey: 'field.adset.appId', control: 'text' }, visibility: [{ eq: ['adset.conversionLocation', 'APP'] }], required: [{ all: [{ eq: ['adset.conversionLocation', 'APP'] }] }] },
        { key: 'adset.appStoreUrl', ui: { labelKey: 'field.adset.appStoreUrl', control: 'text' }, visibility: [{ eq: ['adset.conversionLocation', 'APP'] }], required: [{ all: [{ eq: ['adset.conversionLocation', 'APP'] }] }] },
        { key: 'adset.budget', ui: { labelKey: 'field.adset.budget', control: 'number' }, map: { level: 'adset', param: 'daily_budget' } },
      ],
    },
    {
      stepKey: 'AD',
      fields: [
        { key: 'ad.name', ui: { labelKey: 'field.ad.name', control: 'text' }, required: [{ exists: 'ad.name' }] },
        { key: 'ad.primaryText', ui: { labelKey: 'field.ad.primaryText', control: 'text' }, required: [{ exists: 'ad.primaryText' }] },
        { key: 'ad.websiteUrl', ui: { labelKey: 'field.ad.websiteUrl', control: 'text' }, visibility: [{ in: ['adset.conversionLocation', ['WEBSITE', 'APP'] as const] }] },
        { key: 'ad.chatGreeting', ui: { labelKey: 'field.ad.chatGreeting', control: 'text' }, visibility: [{ in: ['adset.conversionLocation', ['MESSENGER', 'WHATSAPP'] as const] }] },
        { key: 'ad.phoneNumber', ui: { labelKey: 'field.ad.phoneNumber', control: 'text' }, visibility: [{ eq: ['adset.conversionLocation', 'CALL'] }] },
        { key: 'ad.media', ui: { labelKey: 'field.ad.media', control: 'text' }, required: [{ exists: 'ad.media' }] },
      ],
    },
  ],
}
