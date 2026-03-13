import type { ObjectiveSpec, SpecField } from '../types'

const conversionLocation: SpecField = {
  key: 'adset.conversionLocation',
  ui: {
    labelKey: 'field.adset.conversionLocation',
    control: 'select',
    options: [
      { value: 'ON_AD', labelKey: 'destination.ON_AD' },
      { value: 'WEBSITE', labelKey: 'destination.WEBSITE' },
      { value: 'MESSENGER', labelKey: 'destination.MESSENGER' },
      { value: 'WHATSAPP', labelKey: 'destination.WHATSAPP' },
      { value: 'CALL', labelKey: 'destination.CALL' },
    ],
  },
  map: { level: 'adset', param: 'destination_type' },
  required: [{ exists: 'adset.conversionLocation' }],
}

export const leadsSpec: ObjectiveSpec = {
  objectiveKey: 'LEADS',
  primaryDestinationKey: 'adset.conversionLocation',
  primaryDestinationOptions: [
    { value: 'ON_AD', labelKey: 'destination.ON_AD', capabilityGate: 'hasLeadForms' },
    { value: 'WEBSITE', labelKey: 'destination.WEBSITE', capabilityGate: 'hasPixels' },
    { value: 'MESSENGER', labelKey: 'destination.MESSENGER', capabilityGate: 'hasMessaging' },
    { value: 'WHATSAPP', labelKey: 'destination.WHATSAPP', capabilityGate: 'hasWhatsApp' },
    { value: 'CALL', labelKey: 'destination.CALL' },
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
        { key: 'adset.pixelId', ui: { labelKey: 'field.adset.pixelId', control: 'select' }, visibility: [{ eq: ['adset.conversionLocation', 'WEBSITE'] }], required: [{ all: [{ eq: ['adset.conversionLocation', 'WEBSITE'] }] }] },
        { key: 'adset.customEventType', ui: { labelKey: 'field.adset.customEventType', control: 'select' }, visibility: [{ eq: ['adset.conversionLocation', 'WEBSITE'] }] },
        { key: 'adset.budget', ui: { labelKey: 'field.adset.budget', control: 'number' }, map: { level: 'adset', param: 'daily_budget' } },
      ],
    },
    {
      stepKey: 'AD',
      fields: [
        { key: 'ad.name', ui: { labelKey: 'field.ad.name', control: 'text' }, required: [{ exists: 'ad.name' }] },
        { key: 'ad.primaryText', ui: { labelKey: 'field.ad.primaryText', control: 'text' }, required: [{ exists: 'ad.primaryText' }] },
        { key: 'ad.leadFormId', ui: { labelKey: 'field.ad.leadFormId', control: 'select' }, visibility: [{ eq: ['adset.conversionLocation', 'ON_AD'] }], required: [{ all: [{ eq: ['adset.conversionLocation', 'ON_AD'] }] }] },
        { key: 'ad.websiteUrl', ui: { labelKey: 'field.ad.websiteUrl', control: 'text' }, visibility: [{ eq: ['adset.conversionLocation', 'WEBSITE'] }], required: [{ all: [{ eq: ['adset.conversionLocation', 'WEBSITE'] }] }] },
        { key: 'ad.chatGreeting', ui: { labelKey: 'field.ad.chatGreeting', control: 'text' }, visibility: [{ in: ['adset.conversionLocation', ['MESSENGER', 'WHATSAPP'] as const] }] },
        { key: 'ad.phoneNumber', ui: { labelKey: 'field.ad.phoneNumber', control: 'text' }, visibility: [{ eq: ['adset.conversionLocation', 'CALL'] }], required: [{ all: [{ eq: ['adset.conversionLocation', 'CALL'] }] }] },
        { key: 'ad.media', ui: { labelKey: 'field.ad.media', control: 'text' }, required: [{ exists: 'ad.media' }] },
      ],
    },
  ],
}
