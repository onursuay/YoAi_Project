import type { ObjectiveSpec, SpecField } from '../types'

export const appPromotionSpec: ObjectiveSpec = {
  objectiveKey: 'APP_PROMOTION',
  steps: [
    {
      stepKey: 'CAMPAIGN',
      fields: [
        { key: 'campaign.name', ui: { labelKey: 'field.campaign.name', control: 'text' }, map: { level: 'campaign', param: 'name' }, required: [{ exists: 'campaign.name' }] },
        { key: 'campaign.appId', ui: { labelKey: 'field.campaign.appId', control: 'text' }, map: { level: 'campaign', param: 'app_id' }, required: [{ exists: 'campaign.appId' }] },
        { key: 'campaign.appStoreUrl', ui: { labelKey: 'field.campaign.appStoreUrl', control: 'text' }, map: { level: 'campaign', param: 'app_store_url' }, required: [{ exists: 'campaign.appStoreUrl' }] },
        { key: 'campaign.ios14Campaign', ui: { labelKey: 'field.campaign.ios14Campaign', control: 'toggle' }, map: { level: 'campaign', param: 'is_skadnetwork_attribution' } },
        { key: 'campaign.advantagePlusApp', ui: { labelKey: 'field.campaign.advantagePlusApp', control: 'toggle' } },
      ],
    },
    {
      stepKey: 'ADSET',
      fields: [
        { key: 'adset.name', ui: { labelKey: 'field.adset.name', control: 'text' }, map: { level: 'adset', param: 'name' }, required: [{ exists: 'adset.name' }] },
        { key: 'adset.pageId', ui: { labelKey: 'field.adset.pageId', control: 'select' }, map: { level: 'adset', param: 'page_id' }, required: [{ exists: 'adset.pageId' }] },
        { key: 'adset.appStore', ui: { labelKey: 'field.adset.appStore', control: 'select' }, map: { level: 'adset', param: 'app_store' }, required: [{ exists: 'adset.appStore' }] },
        { key: 'adset.attributionModel', ui: { labelKey: 'field.adset.attributionModel', control: 'select' }, map: { level: 'adset', param: 'attribution_spec' } },
        { key: 'adset.budget', ui: { labelKey: 'field.adset.budget', control: 'number' }, map: { level: 'adset', param: 'daily_budget' } },
      ],
    },
    {
      stepKey: 'AD',
      fields: [
        { key: 'ad.name', ui: { labelKey: 'field.ad.name', control: 'text' }, required: [{ exists: 'ad.name' }] },
        { key: 'ad.primaryText', ui: { labelKey: 'field.ad.primaryText', control: 'text' }, required: [{ exists: 'ad.primaryText' }] },
        { key: 'ad.websiteUrl', ui: { labelKey: 'field.ad.websiteUrl', control: 'text' }, required: [{ exists: 'ad.websiteUrl' }] },
        { key: 'ad.media', ui: { labelKey: 'field.ad.media', control: 'text' }, required: [{ exists: 'ad.media' }] },
      ],
    },
  ],
}
