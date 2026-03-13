import type { KpiTemplate, KpiMetricDef, AlertRule, CorrectiveAction, CampaignTriple, NormalizedInsights } from './types'

// ═══════════════════════════════════════════════════════════════════════════
// Reusable Metric Definitions
// ═══════════════════════════════════════════════════════════════════════════

function m(key: string, format: KpiMetricDef['format'], higherIsBetter: boolean, labelKey: string, actionType?: string): KpiMetricDef {
  return { key, format, higherIsBetter, labelKey, ...(actionType ? { actionType } : {}) }
}

const M = {
  // Base delivery
  spend:        m('spend', 'currency', false, 'metrics.spend'),
  impressions:  m('impressions', 'number', true, 'metrics.impressions'),
  reach:        m('reach', 'number', true, 'metrics.reach'),
  frequency:    m('frequency', 'ratio', false, 'metrics.frequency'),
  cpm:          m('cpm', 'currency', false, 'metrics.cpm'),
  cpc:          m('cpc', 'currency', false, 'metrics.cpc'),
  ctr:          m('ctr', 'percentage', true, 'metrics.ctr'),
  clicks:       m('clicks', 'number', true, 'metrics.clicks'),
  linkClicks:   m('inlineLinkClicks', 'number', true, 'metrics.linkClicks'),
  uniqueCtr:    m('uniqueCtr', 'percentage', true, 'metrics.uniqueCtr'),

  // ROAS
  roas:         m('websitePurchaseRoas', 'ratio', true, 'metrics.roas'),

  // Rankings
  qualityRanking:     m('qualityRanking', 'ranking', true, 'metrics.qualityRanking'),
  engagementRanking:  m('engagementRateRanking', 'ranking', true, 'metrics.engagementRanking'),
  conversionRanking:  m('conversionRateRanking', 'ranking', true, 'metrics.conversionRanking'),

  // Video
  thruplay:         m('videoThruplayWatched', 'number', true, 'metrics.thruplay'),
  videoAvgWatch:    m('videoAvgTimeWatched', 'number', true, 'metrics.videoAvgWatch'),
  videoP25:         m('videoP25', 'number', true, 'metrics.videoP25'),
  videoP50:         m('videoP50', 'number', true, 'metrics.videoP50'),
  videoP75:         m('videoP75', 'number', true, 'metrics.videoP75'),
  videoP100:        m('videoP100', 'number', true, 'metrics.videoP100'),

  // Brand
  adRecallLift:     m('estimatedAdRecallers', 'number', true, 'metrics.adRecallLift'),
  costPerRecall:    m('costPerEstimatedAdRecaller', 'currency', false, 'metrics.costPerRecall'),

  // Action-based (dynamic: look up in actions/costPerAction maps)
  purchases:        m('actions', 'number', true, 'metrics.purchases', 'offsite_conversion.fb_pixel_purchase'),
  costPerPurchase:  m('costPerAction', 'currency', false, 'metrics.costPerPurchase', 'offsite_conversion.fb_pixel_purchase'),
  purchaseValue:    m('actionValues', 'currency', true, 'metrics.purchaseValue', 'offsite_conversion.fb_pixel_purchase'),

  leads:            m('actions', 'number', true, 'metrics.leads', 'lead'),
  costPerLead:      m('costPerAction', 'currency', false, 'metrics.costPerLead', 'lead'),

  websiteLeads:     m('actions', 'number', true, 'metrics.leads', 'offsite_conversion.fb_pixel_lead'),
  costPerWebLead:   m('costPerAction', 'currency', false, 'metrics.costPerLead', 'offsite_conversion.fb_pixel_lead'),

  registrations:      m('actions', 'number', true, 'metrics.registrations', 'offsite_conversion.fb_pixel_complete_registration'),
  costPerRegistration: m('costPerAction', 'currency', false, 'metrics.costPerRegistration', 'offsite_conversion.fb_pixel_complete_registration'),

  conversations:      m('actions', 'number', true, 'metrics.conversations', 'onsite_conversion.messaging_conversation_started_7d'),
  costPerConversation: m('costPerAction', 'currency', false, 'metrics.costPerConversation', 'onsite_conversion.messaging_conversation_started_7d'),

  postEngagement:     m('actions', 'number', true, 'metrics.postEngagement', 'post_engagement'),
  costPerEngagement:  m('costPerAction', 'currency', false, 'metrics.costPerEngagement', 'post_engagement'),

  pageLikes:          m('actions', 'number', true, 'metrics.pageLikes', 'like'),
  costPerPageLike:    m('costPerAction', 'currency', false, 'metrics.costPerPageLike', 'like'),

  eventResponses:     m('actions', 'number', true, 'metrics.eventResponses', 'rsvp'),
  costPerEventResponse: m('costPerAction', 'currency', false, 'metrics.costPerEventResponse', 'rsvp'),

  appInstalls:        m('actions', 'number', true, 'metrics.appInstalls', 'mobile_app_install'),
  costPerInstall:     m('costPerAction', 'currency', false, 'metrics.costPerInstall', 'mobile_app_install'),

  linkClickActions:   m('actions', 'number', true, 'metrics.linkClicks', 'link_click'),
  costPerLinkClick:   m('costPerAction', 'currency', false, 'metrics.cpc', 'link_click'),

  landingPageViews:   m('actions', 'number', true, 'metrics.landingPageViews', 'landing_page_view'),
  costPerLpv:         m('costPerAction', 'currency', false, 'metrics.costPerLpv', 'landing_page_view'),

  // Funnel (sales)
  viewContent:        m('actions', 'number', true, 'metrics.viewContent', 'offsite_conversion.fb_pixel_view_content'),
  addToCart:          m('actions', 'number', true, 'metrics.addToCart', 'offsite_conversion.fb_pixel_add_to_cart'),
  initiateCheckout:   m('actions', 'number', true, 'metrics.initiateCheckout', 'offsite_conversion.fb_pixel_initiate_checkout'),

  calls:              m('actions', 'number', true, 'metrics.calls', 'onsite_conversion.lead_grouped'),
  costPerCall:        m('costPerAction', 'currency', false, 'metrics.costPerCall', 'onsite_conversion.lead_grouped'),
} as const

// ═══════════════════════════════════════════════════════════════════════════
// Alert Rules (reusable)
// ═══════════════════════════════════════════════════════════════════════════

const ALERTS = {
  roasBelow1: { id: 'roas_below_1', condition: 'below_threshold' as const, metricKey: 'websitePurchaseRoas', threshold: 1.0, severity: 'critical' as const, messageKey: 'alerts.roasBelow1' },
  roasBelow2: { id: 'roas_below_2', condition: 'below_threshold' as const, metricKey: 'websitePurchaseRoas', threshold: 2.0, severity: 'warning' as const, messageKey: 'alerts.roasBelow2' },
  frequencyHigh: { id: 'freq_high', condition: 'above_threshold' as const, metricKey: 'frequency', threshold: 4.0, severity: 'warning' as const, messageKey: 'alerts.frequencyHigh' },
  frequencyVeryHigh: { id: 'freq_very_high', condition: 'above_threshold' as const, metricKey: 'frequency', threshold: 6.0, severity: 'critical' as const, messageKey: 'alerts.frequencyVeryHigh' },
  ctrLow: { id: 'ctr_low', condition: 'below_threshold' as const, metricKey: 'ctr', threshold: 0.5, severity: 'warning' as const, messageKey: 'alerts.ctrLow' },
  qualityPoor: { id: 'quality_poor', condition: 'ranking_poor' as const, metricKey: 'qualityRanking', severity: 'warning' as const, messageKey: 'alerts.qualityPoor' },
  engagementPoor: { id: 'engagement_poor', condition: 'ranking_poor' as const, metricKey: 'engagementRateRanking', severity: 'warning' as const, messageKey: 'alerts.engagementPoor' },
  conversionPoor: { id: 'conversion_poor', condition: 'ranking_poor' as const, metricKey: 'conversionRateRanking', severity: 'warning' as const, messageKey: 'alerts.conversionPoor' },
}

// ═══════════════════════════════════════════════════════════════════════════
// Corrective Actions (reusable)
// ═══════════════════════════════════════════════════════════════════════════

const ACTIONS: Record<string, CorrectiveAction> = {
  pauseLowRoas: { id: 'pause_low_roas', triggerAlertId: 'roas_below_1', scope: 'campaign', actionType: 'pause', labelKey: 'actions.pauseCampaign', descriptionKey: 'actions.pauseCampaignDesc', riskLevel: 'low' },
  reduceBudget: { id: 'reduce_budget', triggerAlertId: 'roas_below_2', scope: 'campaign', actionType: 'reduce_budget', labelKey: 'actions.reduceBudget', descriptionKey: 'actions.reduceBudgetDesc', riskLevel: 'medium' },
  refreshCreative: { id: 'refresh_creative', triggerAlertId: 'freq_high', scope: 'ad', actionType: 'refresh_creative', labelKey: 'actions.refreshCreative', descriptionKey: 'actions.refreshCreativeDesc', riskLevel: 'low' },
  broadenAudience: { id: 'broaden_audience', triggerAlertId: 'freq_very_high', scope: 'adset', actionType: 'broaden_audience', labelKey: 'actions.broadenAudience', descriptionKey: 'actions.broadenAudienceDesc', riskLevel: 'medium' },
}

// ═══════════════════════════════════════════════════════════════════════════
// Template Definitions
// Key format: "OBJECTIVE:OPTIMIZATION_GOAL:DESTINATION"
// Use "*" as wildcard for destination when the same template applies to all.
// ═══════════════════════════════════════════════════════════════════════════

const TEMPLATES: Record<string, KpiTemplate> = {
  // ── OUTCOME_SALES ──────────────────────────────────────────────────────

  'OUTCOME_SALES:OFFSITE_CONVERSIONS:WEBSITE': {
    id: 'sales_website_conversions',
    northStar: M.purchases,
    efficiency: [M.roas, M.costPerPurchase, M.cpc],
    volume: [M.purchaseValue, M.spend, M.impressions],
    diagnostics: [M.ctr, M.qualityRanking, M.conversionRanking, M.frequency, M.viewContent, M.addToCart, M.initiateCheckout],
    alerts: [ALERTS.roasBelow1, ALERTS.roasBelow2, ALERTS.frequencyHigh, ALERTS.qualityPoor, ALERTS.conversionPoor],
    correctiveActions: [ACTIONS.pauseLowRoas, ACTIONS.reduceBudget, ACTIONS.refreshCreative],
  },

  'OUTCOME_SALES:OFFSITE_CONVERSIONS:CATALOG': {
    id: 'sales_catalog',
    northStar: M.purchases,
    efficiency: [M.roas, M.costPerPurchase],
    volume: [M.purchaseValue, M.spend, M.impressions],
    diagnostics: [M.ctr, M.frequency, M.conversionRanking, M.viewContent, M.addToCart],
    alerts: [ALERTS.roasBelow1, ALERTS.roasBelow2, ALERTS.frequencyHigh],
    correctiveActions: [ACTIONS.pauseLowRoas, ACTIONS.reduceBudget],
  },

  'OUTCOME_SALES:LINK_CLICKS:WEBSITE': {
    id: 'sales_link_clicks',
    northStar: M.linkClickActions,
    efficiency: [M.costPerLinkClick, M.ctr, M.cpm],
    volume: [M.clicks, M.spend, M.impressions],
    diagnostics: [M.qualityRanking, M.engagementRanking, M.frequency],
    alerts: [ALERTS.ctrLow, ALERTS.frequencyHigh, ALERTS.qualityPoor],
    correctiveActions: [ACTIONS.refreshCreative],
  },

  'OUTCOME_SALES:CONVERSATIONS:*': {
    id: 'sales_conversations',
    northStar: M.conversations,
    efficiency: [M.costPerConversation, M.cpm],
    volume: [M.spend, M.impressions],
    diagnostics: [M.ctr, M.qualityRanking, M.frequency],
    alerts: [ALERTS.frequencyHigh, ALERTS.qualityPoor],
    correctiveActions: [ACTIONS.refreshCreative],
  },

  'OUTCOME_SALES:OFFSITE_CONVERSIONS:APP': {
    id: 'sales_app_conversions',
    northStar: M.purchases,
    efficiency: [M.roas, M.costPerPurchase],
    volume: [M.purchaseValue, M.spend],
    diagnostics: [M.ctr, M.conversionRanking, M.frequency],
    alerts: [ALERTS.roasBelow1, ALERTS.conversionPoor],
    correctiveActions: [ACTIONS.pauseLowRoas],
  },

  'OUTCOME_SALES:APP_INSTALLS:APP': {
    id: 'sales_app_installs',
    northStar: M.appInstalls,
    efficiency: [M.costPerInstall, M.cpm],
    volume: [M.spend, M.impressions],
    diagnostics: [M.ctr, M.frequency],
    alerts: [ALERTS.frequencyHigh],
    correctiveActions: [ACTIONS.refreshCreative],
  },

  // ── OUTCOME_TRAFFIC ────────────────────────────────────────────────────

  'OUTCOME_TRAFFIC:LINK_CLICKS:WEBSITE': {
    id: 'traffic_link_clicks_website',
    northStar: M.linkClickActions,
    efficiency: [M.costPerLinkClick, M.ctr, M.cpm],
    volume: [M.clicks, M.spend, M.impressions],
    diagnostics: [M.qualityRanking, M.engagementRanking, M.frequency, M.landingPageViews],
    alerts: [ALERTS.ctrLow, ALERTS.frequencyHigh, ALERTS.qualityPoor, ALERTS.engagementPoor],
    correctiveActions: [ACTIONS.refreshCreative, ACTIONS.broadenAudience],
  },

  'OUTCOME_TRAFFIC:LINK_CLICKS:APP': {
    id: 'traffic_link_clicks_app',
    northStar: M.linkClickActions,
    efficiency: [M.costPerLinkClick, M.ctr, M.cpm],
    volume: [M.clicks, M.spend, M.impressions],
    diagnostics: [M.qualityRanking, M.frequency],
    alerts: [ALERTS.ctrLow, ALERTS.frequencyHigh],
    correctiveActions: [ACTIONS.refreshCreative],
  },

  'OUTCOME_TRAFFIC:LANDING_PAGE_VIEWS:WEBSITE': {
    id: 'traffic_lpv_website',
    northStar: M.landingPageViews,
    efficiency: [M.costPerLpv, M.cpc, M.cpm],
    volume: [M.clicks, M.spend, M.impressions],
    diagnostics: [M.ctr, M.qualityRanking, M.engagementRanking, M.frequency],
    alerts: [ALERTS.ctrLow, ALERTS.frequencyHigh, ALERTS.qualityPoor],
    correctiveActions: [ACTIONS.refreshCreative, ACTIONS.broadenAudience],
  },

  'OUTCOME_TRAFFIC:IMPRESSIONS:WEBSITE': {
    id: 'traffic_impressions_website',
    northStar: M.impressions,
    efficiency: [M.cpm, M.cpc],
    volume: [M.reach, M.spend],
    diagnostics: [M.frequency, M.ctr, M.qualityRanking],
    alerts: [ALERTS.frequencyHigh],
    correctiveActions: [ACTIONS.broadenAudience],
  },

  'OUTCOME_TRAFFIC:REACH:WEBSITE': {
    id: 'traffic_reach_website',
    northStar: M.reach,
    efficiency: [M.cpm, M.cpc],
    volume: [M.impressions, M.spend],
    diagnostics: [M.frequency, M.uniqueCtr, M.qualityRanking],
    alerts: [ALERTS.frequencyHigh],
    correctiveActions: [ACTIONS.broadenAudience],
  },

  'OUTCOME_TRAFFIC:CONVERSATIONS:*': {
    id: 'traffic_conversations',
    northStar: M.conversations,
    efficiency: [M.costPerConversation, M.cpm],
    volume: [M.spend, M.impressions],
    diagnostics: [M.ctr, M.qualityRanking, M.frequency],
    alerts: [ALERTS.frequencyHigh, ALERTS.qualityPoor],
    correctiveActions: [ACTIONS.refreshCreative],
  },

  // ── OUTCOME_ENGAGEMENT ─────────────────────────────────────────────────

  'OUTCOME_ENGAGEMENT:POST_ENGAGEMENT:ON_AD': {
    id: 'engagement_post',
    northStar: M.postEngagement,
    efficiency: [M.costPerEngagement, M.cpm],
    volume: [M.impressions, M.spend, M.reach],
    diagnostics: [M.ctr, M.engagementRanking, M.qualityRanking, M.frequency],
    alerts: [ALERTS.frequencyHigh, ALERTS.engagementPoor, ALERTS.qualityPoor],
    correctiveActions: [ACTIONS.refreshCreative, ACTIONS.broadenAudience],
  },

  'OUTCOME_ENGAGEMENT:THRUPLAY:ON_AD': {
    id: 'engagement_video',
    northStar: M.thruplay,
    efficiency: [{ ...M.costPerEngagement, actionType: 'video_view', labelKey: 'metrics.costPerThruplay' }, M.cpm],
    volume: [M.impressions, M.spend, M.reach],
    diagnostics: [M.videoAvgWatch, M.videoP25, M.videoP50, M.videoP75, M.videoP100, M.frequency],
    alerts: [ALERTS.frequencyHigh],
    correctiveActions: [ACTIONS.refreshCreative],
  },

  'OUTCOME_ENGAGEMENT:TWO_SECOND_CONTINUOUS_VIDEO_VIEWS:ON_AD': {
    id: 'engagement_2s_video',
    northStar: M.thruplay,
    efficiency: [M.cpm],
    volume: [M.impressions, M.spend],
    diagnostics: [M.videoAvgWatch, M.frequency],
    alerts: [ALERTS.frequencyHigh],
    correctiveActions: [ACTIONS.refreshCreative],
  },

  'OUTCOME_ENGAGEMENT:CONVERSATIONS:*': {
    id: 'engagement_conversations',
    northStar: M.conversations,
    efficiency: [M.costPerConversation, M.cpm],
    volume: [M.spend, M.impressions],
    diagnostics: [M.ctr, M.qualityRanking, M.frequency],
    alerts: [ALERTS.frequencyHigh, ALERTS.qualityPoor],
    correctiveActions: [ACTIONS.refreshCreative],
  },

  'OUTCOME_ENGAGEMENT:PAGE_LIKES:ON_PAGE': {
    id: 'engagement_page_likes',
    northStar: M.pageLikes,
    efficiency: [M.costPerPageLike, M.cpm],
    volume: [M.spend, M.impressions],
    diagnostics: [M.ctr, M.frequency],
    alerts: [ALERTS.frequencyHigh],
    correctiveActions: [ACTIONS.broadenAudience],
  },

  'OUTCOME_ENGAGEMENT:QUALITY_CALL:CALL': {
    id: 'engagement_calls',
    northStar: M.calls,
    efficiency: [M.costPerCall, M.cpm],
    volume: [M.spend, M.impressions],
    diagnostics: [M.ctr, M.frequency],
    alerts: [ALERTS.frequencyHigh],
    correctiveActions: [],
  },

  'OUTCOME_ENGAGEMENT:LANDING_PAGE_VIEWS:WEBSITE': {
    id: 'engagement_lpv_website',
    northStar: M.landingPageViews,
    efficiency: [M.costPerLpv, M.cpc],
    volume: [M.clicks, M.spend, M.impressions],
    diagnostics: [M.ctr, M.qualityRanking, M.frequency],
    alerts: [ALERTS.ctrLow, ALERTS.frequencyHigh],
    correctiveActions: [ACTIONS.refreshCreative],
  },

  'OUTCOME_ENGAGEMENT:LINK_CLICKS:WEBSITE': {
    id: 'engagement_link_clicks_website',
    northStar: M.linkClickActions,
    efficiency: [M.costPerLinkClick, M.ctr],
    volume: [M.clicks, M.spend, M.impressions],
    diagnostics: [M.qualityRanking, M.frequency],
    alerts: [ALERTS.ctrLow, ALERTS.frequencyHigh],
    correctiveActions: [ACTIONS.refreshCreative],
  },

  'OUTCOME_ENGAGEMENT:REACH:WEBSITE': {
    id: 'engagement_reach_website',
    northStar: M.reach,
    efficiency: [M.cpm],
    volume: [M.impressions, M.spend],
    diagnostics: [M.frequency, M.qualityRanking],
    alerts: [ALERTS.frequencyHigh],
    correctiveActions: [ACTIONS.broadenAudience],
  },

  'OUTCOME_ENGAGEMENT:OFFSITE_CONVERSIONS:WEBSITE': {
    id: 'engagement_offsite_website',
    northStar: M.purchases,
    efficiency: [M.costPerPurchase, M.cpc],
    volume: [M.spend, M.clicks, M.impressions],
    diagnostics: [M.ctr, M.conversionRanking, M.frequency],
    alerts: [ALERTS.conversionPoor, ALERTS.frequencyHigh],
    correctiveActions: [ACTIONS.refreshCreative],
  },

  'OUTCOME_ENGAGEMENT:APP_INSTALLS:APP': {
    id: 'engagement_app_installs',
    northStar: M.appInstalls,
    efficiency: [M.costPerInstall, M.cpm],
    volume: [M.spend, M.impressions],
    diagnostics: [M.ctr, M.frequency],
    alerts: [ALERTS.frequencyHigh],
    correctiveActions: [ACTIONS.refreshCreative],
  },

  // ── OUTCOME_LEADS ──────────────────────────────────────────────────────

  'OUTCOME_LEADS:LEAD_GENERATION:ON_AD': {
    id: 'leads_instant_form',
    northStar: M.leads,
    efficiency: [M.costPerLead, M.cpm],
    volume: [M.spend, M.impressions],
    diagnostics: [M.ctr, M.qualityRanking, M.engagementRanking, M.frequency],
    alerts: [ALERTS.frequencyHigh, ALERTS.qualityPoor, ALERTS.engagementPoor],
    correctiveActions: [ACTIONS.refreshCreative, ACTIONS.broadenAudience],
  },

  'OUTCOME_LEADS:LEAD_GENERATION:*': {
    id: 'leads_messaging_form',
    northStar: M.leads,
    efficiency: [M.costPerLead, M.cpm],
    volume: [M.spend, M.impressions],
    diagnostics: [M.ctr, M.qualityRanking, M.frequency],
    alerts: [ALERTS.frequencyHigh, ALERTS.qualityPoor],
    correctiveActions: [ACTIONS.refreshCreative],
  },

  'OUTCOME_LEADS:OFFSITE_CONVERSIONS:WEBSITE': {
    id: 'leads_website',
    northStar: M.websiteLeads,
    efficiency: [M.costPerWebLead, M.cpc, M.cpm],
    volume: [M.spend, M.clicks, M.impressions],
    diagnostics: [M.ctr, M.conversionRanking, M.qualityRanking, M.frequency, M.landingPageViews],
    alerts: [ALERTS.ctrLow, ALERTS.conversionPoor, ALERTS.frequencyHigh],
    correctiveActions: [ACTIONS.refreshCreative, ACTIONS.broadenAudience],
  },

  'OUTCOME_LEADS:CONVERSATIONS:*': {
    id: 'leads_conversations',
    northStar: M.conversations,
    efficiency: [M.costPerConversation, M.cpm],
    volume: [M.spend, M.impressions],
    diagnostics: [M.ctr, M.qualityRanking, M.frequency],
    alerts: [ALERTS.frequencyHigh, ALERTS.qualityPoor],
    correctiveActions: [ACTIONS.refreshCreative],
  },

  'OUTCOME_LEADS:QUALITY_CALL:CALL': {
    id: 'leads_calls',
    northStar: M.calls,
    efficiency: [M.costPerCall, M.cpm],
    volume: [M.spend, M.impressions],
    diagnostics: [M.ctr, M.frequency],
    alerts: [ALERTS.frequencyHigh],
    correctiveActions: [],
  },

  // ── OUTCOME_AWARENESS ──────────────────────────────────────────────────

  'OUTCOME_AWARENESS:REACH:*': {
    id: 'awareness_reach',
    northStar: M.reach,
    efficiency: [M.cpm],
    volume: [M.impressions, M.spend],
    diagnostics: [M.frequency, M.qualityRanking],
    alerts: [ALERTS.frequencyHigh, ALERTS.frequencyVeryHigh, ALERTS.qualityPoor],
    correctiveActions: [ACTIONS.refreshCreative, ACTIONS.broadenAudience],
  },

  'OUTCOME_AWARENESS:IMPRESSIONS:*': {
    id: 'awareness_impressions',
    northStar: M.impressions,
    efficiency: [M.cpm],
    volume: [M.reach, M.spend],
    diagnostics: [M.frequency, M.qualityRanking],
    alerts: [ALERTS.frequencyHigh, ALERTS.qualityPoor],
    correctiveActions: [ACTIONS.broadenAudience],
  },

  'OUTCOME_AWARENESS:AD_RECALL_LIFT:*': {
    id: 'awareness_recall',
    northStar: M.adRecallLift,
    efficiency: [M.costPerRecall, M.cpm],
    volume: [M.reach, M.impressions, M.spend],
    diagnostics: [M.frequency, M.qualityRanking],
    alerts: [ALERTS.frequencyHigh, ALERTS.qualityPoor],
    correctiveActions: [ACTIONS.refreshCreative, ACTIONS.broadenAudience],
  },

  'OUTCOME_AWARENESS:THRUPLAY:*': {
    id: 'awareness_video',
    northStar: M.thruplay,
    efficiency: [{ ...M.costPerEngagement, actionType: 'video_view', labelKey: 'metrics.costPerThruplay' }, M.cpm],
    volume: [M.impressions, M.spend, M.reach],
    diagnostics: [M.videoAvgWatch, M.videoP25, M.videoP50, M.videoP75, M.videoP100, M.frequency],
    alerts: [ALERTS.frequencyHigh],
    correctiveActions: [ACTIONS.refreshCreative],
  },

  // ── OUTCOME_APP_PROMOTION ──────────────────────────────────────────────

  'OUTCOME_APP_PROMOTION:APP_INSTALLS:APP': {
    id: 'app_installs',
    northStar: M.appInstalls,
    efficiency: [M.costPerInstall, M.cpm],
    volume: [M.spend, M.impressions],
    diagnostics: [M.ctr, M.frequency],
    alerts: [ALERTS.frequencyHigh, ALERTS.ctrLow],
    correctiveActions: [ACTIONS.refreshCreative],
  },

  'OUTCOME_APP_PROMOTION:LINK_CLICKS:WEBSITE': {
    id: 'app_link_clicks',
    northStar: M.linkClickActions,
    efficiency: [M.costPerLinkClick, M.ctr, M.cpm],
    volume: [M.clicks, M.spend, M.impressions],
    diagnostics: [M.qualityRanking, M.frequency],
    alerts: [ALERTS.ctrLow, ALERTS.frequencyHigh],
    correctiveActions: [ACTIONS.refreshCreative],
  },
}

// ═══════════════════════════════════════════════════════════════════════════
// Fallback template for unknown combinations
// ═══════════════════════════════════════════════════════════════════════════

const FALLBACK_TEMPLATE: KpiTemplate = {
  id: 'fallback_generic',
  northStar: M.clicks,
  efficiency: [M.cpc, M.ctr, M.cpm],
  volume: [M.impressions, M.spend, M.reach],
  diagnostics: [M.qualityRanking, M.frequency],
  alerts: [ALERTS.frequencyHigh, ALERTS.qualityPoor],
  correctiveActions: [ACTIONS.refreshCreative],
}

// ═══════════════════════════════════════════════════════════════════════════
// Resolver: (objective + optimizationGoal + destination) → KpiTemplate
// ═══════════════════════════════════════════════════════════════════════════

export function resolveKpiTemplate(triple: CampaignTriple): KpiTemplate {
  // 1. Exact match
  const exactKey = `${triple.objective}:${triple.optimizationGoal}:${triple.destination}`
  if (TEMPLATES[exactKey]) return TEMPLATES[exactKey]

  // 2. Wildcard destination
  const wildcardKey = `${triple.objective}:${triple.optimizationGoal}:*`
  if (TEMPLATES[wildcardKey]) return TEMPLATES[wildcardKey]

  // 3. Return fallback
  return FALLBACK_TEMPLATE
}

// ═══════════════════════════════════════════════════════════════════════════
// Metric Value Resolver: resolve a KpiMetricDef against NormalizedInsights
// ═══════════════════════════════════════════════════════════════════════════

export function resolveMetricValue(metric: KpiMetricDef, insights: NormalizedInsights): number {
  if (metric.actionType) {
    if (metric.key === 'actions') return insights.actions[metric.actionType] ?? 0
    if (metric.key === 'costPerAction') return insights.costPerAction[metric.actionType] ?? 0
    if (metric.key === 'actionValues') return insights.actionValues[metric.actionType] ?? 0
  }
  const val = (insights as any)[metric.key]
  if (typeof val === 'number') return val
  if (typeof val === 'string') return parseFloat(val) || 0
  return 0
}

/** Export metric definitions for UI components */
export { M as METRIC_DEFS }
