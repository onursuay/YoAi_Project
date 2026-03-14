/**
 * Meta Campaign objective spec — 3D (objective + destination + optimizationGoal).
 * Single source of truth for UI and server validation.
 * v24+ campaign create requires is_adset_budget_sharing_enabled (true/false).
 *
 * FAZ 1 — destination_type değerleri Meta API enum'larına (UPPERCASE) çevrildi.
 * Frontend state ve API payload'larda aynı değerler kullanılır.
 */

export const OBJECTIVE_IDS = [
  'OUTCOME_TRAFFIC',
  'OUTCOME_AWARENESS',
  'OUTCOME_ENGAGEMENT',
  'OUTCOME_LEADS',
  'OUTCOME_SALES',
  'OUTCOME_APP_PROMOTION',
] as const

export type ObjectiveId = (typeof OBJECTIVE_IDS)[number]

// ── Destination Types — Meta API enum değerleri (UPPERCASE) ──────────────
export const DESTINATION_WEBSITE = 'WEBSITE'
export const DESTINATION_APP = 'APP'
export const DESTINATION_MESSENGER = 'MESSENGER'
export const DESTINATION_WHATSAPP = 'WHATSAPP'
export const DESTINATION_ON_AD = 'ON_AD'
export const DESTINATION_INSTAGRAM_DIRECT = 'INSTAGRAM_DIRECT'
export const DESTINATION_PHONE_CALL = 'PHONE_CALL'
export const DESTINATION_CALL = 'CALL'
export const DESTINATION_ON_PAGE = 'ON_PAGE'
export const DESTINATION_CATALOG = 'CATALOG'

export type DestinationId =
  | typeof DESTINATION_WEBSITE
  | typeof DESTINATION_APP
  | typeof DESTINATION_MESSENGER
  | typeof DESTINATION_WHATSAPP
  | typeof DESTINATION_ON_AD
  | typeof DESTINATION_INSTAGRAM_DIRECT
  | typeof DESTINATION_PHONE_CALL
  | typeof DESTINATION_CALL
  | typeof DESTINATION_ON_PAGE
  | typeof DESTINATION_CATALOG

// ── CTA Types ────────────────────────────────────────────────────────────
export const CTA_LEARN_MORE = 'LEARN_MORE'
export const CTA_SHOP_NOW = 'SHOP_NOW'
export const CTA_SIGN_UP = 'SIGN_UP'
export const CTA_CONTACT_US = 'CONTACT_US'
export const CTA_APPLY_NOW = 'APPLY_NOW'
export const CTA_GET_OFFER = 'GET_OFFER'
export const CTA_BOOK_NOW = 'BOOK_NOW'
export const CTA_DOWNLOAD = 'DOWNLOAD'
export const CTA_SEND_WHATSAPP_MESSAGE = 'WHATSAPP_MESSAGE'
export const CTA_SEND_MESSAGE = 'SEND_MESSAGE'
export const CTA_SUBSCRIBE = 'SUBSCRIBE'
export const CTA_GET_QUOTE = 'GET_QUOTE'
export const CTA_NO_BUTTON = 'NO_BUTTON'
export const CTA_INSTALL_MOBILE_APP = 'INSTALL_MOBILE_APP'
export const CTA_USE_APP = 'USE_APP'
export const CTA_PLAY_GAME = 'PLAY_GAME'
export const CTA_CALL_NOW = 'CALL_NOW'
export const CTA_LIKE_PAGE = 'LIKE_PAGE'

// ── Optimization Goals ───────────────────────────────────────────────────
const LINK_CLICKS = 'LINK_CLICKS'
const LANDING_PAGE_VIEWS = 'LANDING_PAGE_VIEWS'
const IMPRESSIONS = 'IMPRESSIONS'
const REACH = 'REACH'
const AD_RECALL_LIFT = 'AD_RECALL_LIFT'
const POST_ENGAGEMENT = 'POST_ENGAGEMENT'
const THRUPLAY = 'THRUPLAY'
const LEAD_GENERATION = 'LEAD_GENERATION'
const OFFSITE_CONVERSIONS = 'OFFSITE_CONVERSIONS'
const VALUE = 'VALUE'
const CONVERSATIONS = 'CONVERSATIONS'
const REPLIES = 'REPLIES'
const TWO_SECOND_CONTINUOUS_VIDEO_VIEWS = 'TWO_SECOND_CONTINUOUS_VIDEO_VIEWS'
const QUALITY_CALL = 'QUALITY_CALL'
const PAGE_LIKES = 'PAGE_LIKES'
const APP_INSTALLS = 'APP_INSTALLS'

// ── Interfaces ───────────────────────────────────────────────────────────
export interface LeafSpec {
  requiredFields: { campaign: string[]; adset: string[]; ad: string[] }
  allowedCTAs: string[]
  defaultCTA: string
  defaultOptimizationGoal: string
  defaults: { buying_type: string; is_adset_budget_sharing_enabled: boolean }
  /** true ise ad seviyesinde websiteUrl zorunlu */
  requiresWebsiteUrl: boolean
  /** true ise promoted_object'te pixel_id zorunlu */
  requiresPixel: boolean
}

export interface DestinationSpec {
  optimizationGoals: Record<string, LeafSpec>
  defaultOptimizationGoal: string
}

export interface ObjectiveSpec3D {
  destinations: Record<string, DestinationSpec>
}

const CAMPAIGN_DEFAULTS = { buying_type: 'AUCTION', is_adset_budget_sharing_enabled: false } as const

function leaf(
  requiredFields: LeafSpec['requiredFields'],
  allowedCTAs: string[],
  defaultCTA: string,
  defaultOptimizationGoal: string,
  options?: { requiresWebsiteUrl?: boolean; requiresPixel?: boolean }
): LeafSpec {
  return {
    requiredFields,
    allowedCTAs,
    defaultCTA,
    defaultOptimizationGoal,
    defaults: { ...CAMPAIGN_DEFAULTS },
    requiresWebsiteUrl: options?.requiresWebsiteUrl ?? false,
    requiresPixel: options?.requiresPixel ?? false,
  }
}

// ── SPEC — Destination key'leri Meta API enum'ları (UPPERCASE) ───────────
const SPEC: Record<ObjectiveId, ObjectiveSpec3D> = {
  OUTCOME_TRAFFIC: {
    destinations: {
      WEBSITE: {
        defaultOptimizationGoal: LINK_CLICKS,
        optimizationGoals: {
          [LINK_CLICKS]: leaf(
            { campaign: ['name', 'objective'], adset: ['name', 'pageId', 'optimizationGoal'], ad: ['name', 'primaryText', 'websiteUrl'] },
            [CTA_LEARN_MORE, CTA_SHOP_NOW, CTA_SIGN_UP, CTA_CONTACT_US, CTA_APPLY_NOW, CTA_GET_OFFER, CTA_BOOK_NOW, CTA_DOWNLOAD],
            CTA_LEARN_MORE,
            LINK_CLICKS,
            { requiresWebsiteUrl: true }
          ),
          [LANDING_PAGE_VIEWS]: leaf(
            { campaign: ['name', 'objective'], adset: ['name', 'pageId', 'optimizationGoal'], ad: ['name', 'primaryText', 'websiteUrl'] },
            [CTA_LEARN_MORE, CTA_SHOP_NOW, CTA_SIGN_UP, CTA_CONTACT_US],
            CTA_LEARN_MORE,
            LANDING_PAGE_VIEWS,
            { requiresWebsiteUrl: true }
          ),
          [IMPRESSIONS]: leaf(
            { campaign: ['name', 'objective'], adset: ['name', 'pageId', 'optimizationGoal'], ad: ['name', 'primaryText', 'websiteUrl'] },
            [CTA_LEARN_MORE, CTA_SHOP_NOW, CTA_NO_BUTTON],
            CTA_LEARN_MORE,
            IMPRESSIONS,
            { requiresWebsiteUrl: true }
          ),
          [REACH]: leaf(
            { campaign: ['name', 'objective'], adset: ['name', 'pageId', 'optimizationGoal'], ad: ['name', 'primaryText', 'websiteUrl'] },
            [CTA_LEARN_MORE, CTA_NO_BUTTON],
            CTA_LEARN_MORE,
            REACH,
            { requiresWebsiteUrl: true }
          ),
        },
      },
      APP: {
        defaultOptimizationGoal: LINK_CLICKS,
        optimizationGoals: {
          [LINK_CLICKS]: leaf(
            { campaign: ['name', 'objective'], adset: ['name', 'pageId', 'optimizationGoal'], ad: ['name', 'primaryText', 'websiteUrl'] },
            [CTA_INSTALL_MOBILE_APP, CTA_USE_APP, CTA_LEARN_MORE],
            CTA_INSTALL_MOBILE_APP,
            LINK_CLICKS,
            { requiresWebsiteUrl: true }
          ),
          APP_INSTALLS: leaf(
            { campaign: ['name', 'objective'], adset: ['name', 'pageId', 'optimizationGoal'], ad: ['name', 'primaryText', 'websiteUrl'] },
            [CTA_INSTALL_MOBILE_APP, CTA_USE_APP, CTA_LEARN_MORE],
            CTA_INSTALL_MOBILE_APP,
            'APP_INSTALLS',
            { requiresWebsiteUrl: true }
          ),
        },
      },
      MESSENGER: {
        defaultOptimizationGoal: CONVERSATIONS,
        optimizationGoals: {
          [CONVERSATIONS]: leaf(
            { campaign: ['name', 'objective'], adset: ['name', 'pageId', 'optimizationGoal'], ad: ['name', 'primaryText'] },
            [CTA_SEND_MESSAGE, CTA_LEARN_MORE],
            CTA_SEND_MESSAGE,
            CONVERSATIONS
          ),
          [LINK_CLICKS]: leaf(
            { campaign: ['name', 'objective'], adset: ['name', 'pageId', 'optimizationGoal'], ad: ['name', 'primaryText', 'websiteUrl'] },
            [CTA_SEND_MESSAGE, CTA_LEARN_MORE],
            CTA_SEND_MESSAGE,
            LINK_CLICKS,
            { requiresWebsiteUrl: true }
          ),
        },
      },
      INSTAGRAM_DIRECT: {
        defaultOptimizationGoal: CONVERSATIONS,
        optimizationGoals: {
          [CONVERSATIONS]: leaf(
            { campaign: ['name', 'objective'], adset: ['name', 'pageId', 'optimizationGoal'], ad: ['name', 'primaryText'] },
            [CTA_SEND_MESSAGE],
            CTA_SEND_MESSAGE,
            CONVERSATIONS,
            { requiresWebsiteUrl: true }
          ),
        },
      },
      WHATSAPP: {
        defaultOptimizationGoal: LINK_CLICKS,
        optimizationGoals: {
          [LINK_CLICKS]: leaf(
            { campaign: ['name', 'objective'], adset: ['name', 'pageId', 'optimizationGoal'], ad: ['name', 'primaryText'] },
            [CTA_SEND_WHATSAPP_MESSAGE, CTA_CONTACT_US, CTA_LEARN_MORE],
            CTA_SEND_WHATSAPP_MESSAGE,
            LINK_CLICKS
          ),
        },
      },
      CALL: {
        defaultOptimizationGoal: QUALITY_CALL,
        optimizationGoals: {
          [QUALITY_CALL]: leaf(
            { campaign: ['name', 'objective'], adset: ['name', 'pageId', 'optimizationGoal'], ad: ['name', 'primaryText', 'phoneNumber'] },
            [CTA_CALL_NOW, CTA_LEARN_MORE],
            CTA_CALL_NOW,
            QUALITY_CALL
          ),
        },
      },
    },
  },
  OUTCOME_AWARENESS: {
    destinations: {
      WEBSITE: {
        defaultOptimizationGoal: REACH,
        optimizationGoals: {
          [REACH]: leaf(
            { campaign: ['name', 'objective'], adset: ['name', 'pageId', 'optimizationGoal'], ad: ['name', 'primaryText'] },
            [CTA_LEARN_MORE, CTA_NO_BUTTON],
            CTA_LEARN_MORE,
            REACH
          ),
          [IMPRESSIONS]: leaf(
            { campaign: ['name', 'objective'], adset: ['name', 'pageId', 'optimizationGoal'], ad: ['name', 'primaryText'] },
            [CTA_LEARN_MORE, CTA_NO_BUTTON],
            CTA_NO_BUTTON,
            IMPRESSIONS
          ),
          [AD_RECALL_LIFT]: leaf(
            { campaign: ['name', 'objective'], adset: ['name', 'pageId', 'optimizationGoal'], ad: ['name', 'primaryText'] },
            [CTA_LEARN_MORE, CTA_NO_BUTTON],
            CTA_LEARN_MORE,
            AD_RECALL_LIFT
          ),
          [THRUPLAY]: leaf(
            { campaign: ['name', 'objective'], adset: ['name', 'pageId', 'optimizationGoal'], ad: ['name', 'primaryText'] },
            [CTA_LEARN_MORE, CTA_NO_BUTTON],
            CTA_LEARN_MORE,
            THRUPLAY
          ),
        },
      },
      APP: {
        defaultOptimizationGoal: REACH,
        optimizationGoals: {
          [REACH]: leaf(
            { campaign: ['name', 'objective'], adset: ['name', 'pageId', 'optimizationGoal'], ad: ['name', 'primaryText'] },
            [CTA_LEARN_MORE, CTA_NO_BUTTON],
            CTA_LEARN_MORE,
            REACH
          ),
          [IMPRESSIONS]: leaf(
            { campaign: ['name', 'objective'], adset: ['name', 'pageId', 'optimizationGoal'], ad: ['name', 'primaryText'] },
            [CTA_LEARN_MORE, CTA_NO_BUTTON],
            CTA_NO_BUTTON,
            IMPRESSIONS
          ),
          [AD_RECALL_LIFT]: leaf(
            { campaign: ['name', 'objective'], adset: ['name', 'pageId', 'optimizationGoal'], ad: ['name', 'primaryText'] },
            [CTA_LEARN_MORE, CTA_NO_BUTTON],
            CTA_LEARN_MORE,
            AD_RECALL_LIFT
          ),
          [THRUPLAY]: leaf(
            { campaign: ['name', 'objective'], adset: ['name', 'pageId', 'optimizationGoal'], ad: ['name', 'primaryText'] },
            [CTA_LEARN_MORE, CTA_NO_BUTTON],
            CTA_LEARN_MORE,
            THRUPLAY
          ),
        },
      },
      MESSENGER: {
        defaultOptimizationGoal: REACH,
        optimizationGoals: {
          [REACH]: leaf(
            { campaign: ['name', 'objective'], adset: ['name', 'pageId', 'optimizationGoal'], ad: ['name', 'primaryText'] },
            [CTA_LEARN_MORE, CTA_NO_BUTTON],
            CTA_LEARN_MORE,
            REACH
          ),
          [IMPRESSIONS]: leaf(
            { campaign: ['name', 'objective'], adset: ['name', 'pageId', 'optimizationGoal'], ad: ['name', 'primaryText'] },
            [CTA_LEARN_MORE, CTA_NO_BUTTON],
            CTA_NO_BUTTON,
            IMPRESSIONS
          ),
          [AD_RECALL_LIFT]: leaf(
            { campaign: ['name', 'objective'], adset: ['name', 'pageId', 'optimizationGoal'], ad: ['name', 'primaryText'] },
            [CTA_LEARN_MORE, CTA_NO_BUTTON],
            CTA_LEARN_MORE,
            AD_RECALL_LIFT
          ),
          [THRUPLAY]: leaf(
            { campaign: ['name', 'objective'], adset: ['name', 'pageId', 'optimizationGoal'], ad: ['name', 'primaryText'] },
            [CTA_LEARN_MORE, CTA_NO_BUTTON],
            CTA_LEARN_MORE,
            THRUPLAY
          ),
        },
      },
      WHATSAPP: {
        defaultOptimizationGoal: REACH,
        optimizationGoals: {
          [REACH]: leaf(
            { campaign: ['name', 'objective'], adset: ['name', 'pageId', 'optimizationGoal'], ad: ['name', 'primaryText'] },
            [CTA_SEND_WHATSAPP_MESSAGE, CTA_LEARN_MORE],
            CTA_LEARN_MORE,
            REACH
          ),
          [IMPRESSIONS]: leaf(
            { campaign: ['name', 'objective'], adset: ['name', 'pageId', 'optimizationGoal'], ad: ['name', 'primaryText'] },
            [CTA_LEARN_MORE, CTA_NO_BUTTON],
            CTA_NO_BUTTON,
            IMPRESSIONS
          ),
          [AD_RECALL_LIFT]: leaf(
            { campaign: ['name', 'objective'], adset: ['name', 'pageId', 'optimizationGoal'], ad: ['name', 'primaryText'] },
            [CTA_LEARN_MORE, CTA_NO_BUTTON],
            CTA_LEARN_MORE,
            AD_RECALL_LIFT
          ),
          [THRUPLAY]: leaf(
            { campaign: ['name', 'objective'], adset: ['name', 'pageId', 'optimizationGoal'], ad: ['name', 'primaryText'] },
            [CTA_LEARN_MORE, CTA_NO_BUTTON],
            CTA_LEARN_MORE,
            THRUPLAY
          ),
        },
      },
    },
  },
  OUTCOME_ENGAGEMENT: {
    destinations: {
      // MVP: Reklamınızda (ON_AD) — post/video etkileşimi
      ON_AD: {
        defaultOptimizationGoal: POST_ENGAGEMENT,
        optimizationGoals: {
          [POST_ENGAGEMENT]: leaf(
            { campaign: ['name', 'objective'], adset: ['name', 'pageId', 'optimizationGoal'], ad: ['name', 'primaryText'] },
            [CTA_LEARN_MORE, CTA_SEND_MESSAGE, CTA_NO_BUTTON],
            CTA_LEARN_MORE,
            POST_ENGAGEMENT
          ),
          [THRUPLAY]: leaf(
            { campaign: ['name', 'objective'], adset: ['name', 'pageId', 'optimizationGoal'], ad: ['name', 'primaryText'] },
            [CTA_LEARN_MORE, CTA_NO_BUTTON],
            CTA_LEARN_MORE,
            THRUPLAY
          ),
          [TWO_SECOND_CONTINUOUS_VIDEO_VIEWS]: leaf(
            { campaign: ['name', 'objective'], adset: ['name', 'pageId', 'optimizationGoal'], ad: ['name', 'primaryText'] },
            [CTA_LEARN_MORE, CTA_NO_BUTTON],
            CTA_LEARN_MORE,
            TWO_SECOND_CONTINUOUS_VIDEO_VIEWS
          ),
        },
      },
      WEBSITE: {
        defaultOptimizationGoal: LANDING_PAGE_VIEWS,
        optimizationGoals: {
          [LANDING_PAGE_VIEWS]: leaf(
            { campaign: ['name', 'objective'], adset: ['name', 'pageId', 'optimizationGoal'], ad: ['name', 'primaryText', 'websiteUrl'] },
            [CTA_LEARN_MORE, CTA_SHOP_NOW, CTA_SIGN_UP],
            CTA_LEARN_MORE,
            LANDING_PAGE_VIEWS,
            { requiresWebsiteUrl: true }
          ),
          [LINK_CLICKS]: leaf(
            { campaign: ['name', 'objective'], adset: ['name', 'pageId', 'optimizationGoal'], ad: ['name', 'primaryText', 'websiteUrl'] },
            [CTA_LEARN_MORE, CTA_SHOP_NOW, CTA_SIGN_UP],
            CTA_LEARN_MORE,
            LINK_CLICKS,
            { requiresWebsiteUrl: true }
          ),
          [REACH]: leaf(
            { campaign: ['name', 'objective'], adset: ['name', 'pageId', 'optimizationGoal'], ad: ['name', 'primaryText', 'websiteUrl'] },
            [CTA_LEARN_MORE, CTA_SHOP_NOW, CTA_SIGN_UP],
            CTA_LEARN_MORE,
            REACH,
            { requiresWebsiteUrl: true }
          ),
        },
      },
      APP: {
        defaultOptimizationGoal: APP_INSTALLS,
        optimizationGoals: {
          [APP_INSTALLS]: leaf(
            { campaign: ['name', 'objective'], adset: ['name', 'pageId', 'optimizationGoal', 'appId', 'appStoreUrl'], ad: ['name', 'primaryText', 'websiteUrl'] },
            [CTA_INSTALL_MOBILE_APP, CTA_USE_APP],
            CTA_INSTALL_MOBILE_APP,
            APP_INSTALLS,
            { requiresWebsiteUrl: true }
          ),
          [OFFSITE_CONVERSIONS]: leaf(
            { campaign: ['name', 'objective'], adset: ['name', 'pageId', 'optimizationGoal', 'appId', 'appStoreUrl'], ad: ['name', 'primaryText', 'websiteUrl'] },
            [CTA_INSTALL_MOBILE_APP, CTA_USE_APP],
            CTA_INSTALL_MOBILE_APP,
            OFFSITE_CONVERSIONS,
            { requiresWebsiteUrl: true }
          ),
        },
      },
      INSTAGRAM_DIRECT: {
        defaultOptimizationGoal: CONVERSATIONS,
        optimizationGoals: {
          [CONVERSATIONS]: leaf(
            { campaign: ['name', 'objective'], adset: ['name', 'pageId', 'instagramAccountId', 'optimizationGoal'], ad: ['name', 'primaryText'] },
            [CTA_SEND_MESSAGE, CTA_LEARN_MORE],
            CTA_SEND_MESSAGE,
            CONVERSATIONS,
            { requiresWebsiteUrl: true }
          ),
        },
      },
      CALL: {
        defaultOptimizationGoal: QUALITY_CALL,
        optimizationGoals: {
          [QUALITY_CALL]: leaf(
            { campaign: ['name', 'objective'], adset: ['name', 'pageId', 'optimizationGoal'], ad: ['name', 'primaryText', 'phoneNumber'] },
            [CTA_CALL_NOW, CTA_LEARN_MORE],
            CTA_CALL_NOW,
            QUALITY_CALL
          ),
        },
      },
      ON_PAGE: {
        defaultOptimizationGoal: PAGE_LIKES,
        optimizationGoals: {
          [PAGE_LIKES]: leaf(
            { campaign: ['name', 'objective'], adset: ['name', 'pageId', 'optimizationGoal'], ad: ['name', 'primaryText'] },
            [CTA_LIKE_PAGE, CTA_LEARN_MORE],
            CTA_LIKE_PAGE,
            PAGE_LIKES
          ),
        },
      },
      MESSENGER: {
        defaultOptimizationGoal: CONVERSATIONS,
        optimizationGoals: {
          [CONVERSATIONS]: leaf(
            { campaign: ['name', 'objective'], adset: ['name', 'pageId', 'optimizationGoal'], ad: ['name', 'primaryText'] },
            [CTA_SEND_MESSAGE, CTA_LEARN_MORE, CTA_CONTACT_US],
            CTA_SEND_MESSAGE,
            CONVERSATIONS
          ),
        },
      },
      WHATSAPP: {
        defaultOptimizationGoal: CONVERSATIONS,
        optimizationGoals: {
          [CONVERSATIONS]: leaf(
            { campaign: ['name', 'objective'], adset: ['name', 'pageId', 'optimizationGoal'], ad: ['name', 'primaryText'] },
            [CTA_SEND_WHATSAPP_MESSAGE, CTA_LEARN_MORE],
            CTA_SEND_WHATSAPP_MESSAGE,
            CONVERSATIONS
          ),
          [REPLIES]: leaf(
            { campaign: ['name', 'objective'], adset: ['name', 'pageId', 'optimizationGoal'], ad: ['name', 'primaryText'] },
            [CTA_SEND_WHATSAPP_MESSAGE, CTA_LEARN_MORE],
            CTA_SEND_WHATSAPP_MESSAGE,
            REPLIES
          ),
        },
      },
    },
  },
  OUTCOME_LEADS: {
    destinations: {
      ON_AD: {
        defaultOptimizationGoal: LEAD_GENERATION,
        optimizationGoals: {
          [LEAD_GENERATION]: leaf(
            { campaign: ['name', 'objective'], adset: ['name', 'pageId', 'optimizationGoal'], ad: ['name', 'primaryText'] },
            [CTA_SIGN_UP, CTA_SUBSCRIBE, CTA_APPLY_NOW, CTA_GET_QUOTE, CTA_LEARN_MORE],
            CTA_SIGN_UP,
            LEAD_GENERATION
          ),
        },
      },
      WEBSITE: {
        defaultOptimizationGoal: OFFSITE_CONVERSIONS,
        optimizationGoals: {
          [OFFSITE_CONVERSIONS]: leaf(
            { campaign: ['name', 'objective'], adset: ['name', 'pageId', 'optimizationGoal', 'pixelId', 'customEventType'], ad: ['name', 'primaryText', 'websiteUrl'] },
            [CTA_LEARN_MORE, CTA_SIGN_UP, CTA_SUBSCRIBE, CTA_GET_QUOTE],
            CTA_LEARN_MORE,
            OFFSITE_CONVERSIONS,
            { requiresWebsiteUrl: true, requiresPixel: true }
          ),
        },
      },
      MESSENGER: {
        defaultOptimizationGoal: LEAD_GENERATION,
        optimizationGoals: {
          [LEAD_GENERATION]: leaf(
            { campaign: ['name', 'objective'], adset: ['name', 'pageId', 'optimizationGoal'], ad: ['name', 'primaryText', 'chatGreeting'] },
            [CTA_SEND_MESSAGE],
            CTA_SEND_MESSAGE,
            LEAD_GENERATION
          ),
        },
      },
      WHATSAPP: {
        defaultOptimizationGoal: REPLIES,
        optimizationGoals: {
          [LEAD_GENERATION]: leaf(
            { campaign: ['name', 'objective'], adset: ['name', 'pageId', 'optimizationGoal'], ad: ['name', 'primaryText', 'chatGreeting'] },
            [CTA_SEND_WHATSAPP_MESSAGE],
            CTA_SEND_WHATSAPP_MESSAGE,
            LEAD_GENERATION
          ),
          [REPLIES]: leaf(
            { campaign: ['name', 'objective'], adset: ['name', 'pageId', 'optimizationGoal'], ad: ['name', 'primaryText', 'chatGreeting'] },
            [CTA_SEND_WHATSAPP_MESSAGE],
            CTA_SEND_WHATSAPP_MESSAGE,
            REPLIES
          ),
        },
      },
      CALL: {
        defaultOptimizationGoal: QUALITY_CALL,
        optimizationGoals: {
          [QUALITY_CALL]: leaf(
            { campaign: ['name', 'objective'], adset: ['name', 'pageId', 'optimizationGoal'], ad: ['name', 'primaryText', 'phoneNumber'] },
            [CTA_CALL_NOW, CTA_LEARN_MORE],
            CTA_CALL_NOW,
            QUALITY_CALL
          ),
        },
      },
    },
  },
  OUTCOME_SALES: {
    destinations: {
      WEBSITE: {
        defaultOptimizationGoal: OFFSITE_CONVERSIONS,
        optimizationGoals: {
          [OFFSITE_CONVERSIONS]: leaf(
            { campaign: ['name', 'objective'], adset: ['name', 'pageId', 'optimizationGoal', 'pixelId', 'customEventType'], ad: ['name', 'primaryText', 'websiteUrl'] },
            [CTA_SHOP_NOW, CTA_LEARN_MORE, CTA_GET_OFFER, CTA_BOOK_NOW, CTA_CONTACT_US],
            CTA_SHOP_NOW,
            OFFSITE_CONVERSIONS,
            { requiresWebsiteUrl: true, requiresPixel: true }
          ),
          [LINK_CLICKS]: leaf(
            { campaign: ['name', 'objective'], adset: ['name', 'pageId', 'optimizationGoal'], ad: ['name', 'primaryText', 'websiteUrl'] },
            [CTA_SHOP_NOW, CTA_LEARN_MORE, CTA_GET_OFFER, CTA_CONTACT_US],
            CTA_SHOP_NOW,
            LINK_CLICKS,
            { requiresWebsiteUrl: true }
          ),
        },
      },
      CATALOG: {
        defaultOptimizationGoal: OFFSITE_CONVERSIONS,
        optimizationGoals: {
          [OFFSITE_CONVERSIONS]: leaf(
            { campaign: ['name', 'objective'], adset: ['name', 'pageId', 'optimizationGoal', 'catalogId', 'productSetId'], ad: ['name', 'primaryText'] },
            [CTA_SHOP_NOW, CTA_LEARN_MORE],
            CTA_SHOP_NOW,
            OFFSITE_CONVERSIONS
          ),
        },
      },
      APP: {
        defaultOptimizationGoal: OFFSITE_CONVERSIONS,
        optimizationGoals: {
          [OFFSITE_CONVERSIONS]: leaf(
            { campaign: ['name', 'objective'], adset: ['name', 'pageId', 'optimizationGoal', 'appId', 'appStoreUrl'], ad: ['name', 'primaryText', 'websiteUrl'] },
            [CTA_INSTALL_MOBILE_APP, CTA_SHOP_NOW, CTA_USE_APP],
            CTA_INSTALL_MOBILE_APP,
            OFFSITE_CONVERSIONS,
            { requiresWebsiteUrl: true }
          ),
          [APP_INSTALLS]: leaf(
            { campaign: ['name', 'objective'], adset: ['name', 'pageId', 'optimizationGoal', 'appId', 'appStoreUrl'], ad: ['name', 'primaryText', 'websiteUrl'] },
            [CTA_INSTALL_MOBILE_APP, CTA_USE_APP],
            CTA_INSTALL_MOBILE_APP,
            APP_INSTALLS,
            { requiresWebsiteUrl: true }
          ),
        },
      },
      MESSENGER: {
        defaultOptimizationGoal: CONVERSATIONS,
        optimizationGoals: {
          [CONVERSATIONS]: leaf(
            { campaign: ['name', 'objective'], adset: ['name', 'pageId', 'optimizationGoal'], ad: ['name', 'primaryText', 'chatGreeting'] },
            [CTA_SEND_MESSAGE, CTA_SHOP_NOW],
            CTA_SEND_MESSAGE,
            CONVERSATIONS
          ),
        },
      },
      WHATSAPP: {
        defaultOptimizationGoal: REPLIES,
        optimizationGoals: {
          [CONVERSATIONS]: leaf(
            { campaign: ['name', 'objective'], adset: ['name', 'pageId', 'optimizationGoal'], ad: ['name', 'primaryText', 'chatGreeting'] },
            [CTA_SEND_WHATSAPP_MESSAGE, CTA_SHOP_NOW],
            CTA_SEND_WHATSAPP_MESSAGE,
            CONVERSATIONS
          ),
          [REPLIES]: leaf(
            { campaign: ['name', 'objective'], adset: ['name', 'pageId', 'optimizationGoal'], ad: ['name', 'primaryText', 'chatGreeting'] },
            [CTA_SEND_WHATSAPP_MESSAGE, CTA_SHOP_NOW],
            CTA_SEND_WHATSAPP_MESSAGE,
            REPLIES
          ),
        },
      },
    },
  },
  OUTCOME_APP_PROMOTION: {
    destinations: {
      APP: {
        defaultOptimizationGoal: 'APP_INSTALLS',
        optimizationGoals: {
          APP_INSTALLS: leaf(
            { campaign: ['name', 'objective'], adset: ['name', 'pageId', 'optimizationGoal'], ad: ['name', 'primaryText', 'websiteUrl'] },
            [CTA_INSTALL_MOBILE_APP, CTA_USE_APP, CTA_PLAY_GAME],
            CTA_INSTALL_MOBILE_APP,
            'APP_INSTALLS',
            { requiresWebsiteUrl: true }
          ),
        },
      },
      WEBSITE: {
        defaultOptimizationGoal: LINK_CLICKS,
        optimizationGoals: {
          [LINK_CLICKS]: leaf(
            { campaign: ['name', 'objective'], adset: ['name', 'pageId', 'optimizationGoal'], ad: ['name', 'primaryText'] },
            [CTA_DOWNLOAD, CTA_LEARN_MORE, CTA_NO_BUTTON],
            CTA_DOWNLOAD,
            LINK_CLICKS
          ),
        },
      },
    },
  },
}

export const CAMPAIGN_CREATE_REQUIRED_FLAGS = { is_adset_budget_sharing_enabled: true } as const

// ── Helper: Destination websiteUrl gerektiriyor mu? ──────────────────────
/** Verilen kombinasyon için websiteUrl zorunlu mu kontrol eder */
export function requiresWebsiteUrl(objective: string, destination: string, optimizationGoal?: string): boolean {
  const s = getSpec(objective)
  const dest = s?.destinations?.[destination]
  if (!dest) return false
  const goal = optimizationGoal ?? dest.defaultOptimizationGoal
  const leafSpec = dest.optimizationGoals[goal] ?? dest.optimizationGoals[Object.keys(dest.optimizationGoals)[0]]
  return leafSpec?.requiresWebsiteUrl ?? false
}

// ── Spec lookup helpers ──────────────────────────────────────────────────
function getSpec(objective: string): ObjectiveSpec3D | null {
  return OBJECTIVE_IDS.includes(objective as ObjectiveId) ? SPEC[objective as ObjectiveId] : null
}

export function getAllowedDestinations(objective: string): DestinationId[] {
  const s = getSpec(objective)
  if (!s?.destinations) return [DESTINATION_WEBSITE]
  return Object.keys(s.destinations) as DestinationId[]
}

export function getAllowedOptimizationGoals(objective: string, destination: string): string[] {
  const s = getSpec(objective)
  const dest = s?.destinations?.[destination]
  if (!dest?.optimizationGoals) return [LINK_CLICKS]
  return Object.keys(dest.optimizationGoals)
}

export function getAllowedCTAs(objective: string, destination: string, optimizationGoal: string): string[] {
  const s = getSpec(objective)
  const dest = s?.destinations?.[destination]
  const goals = dest?.optimizationGoals
  const leafSpec = goals?.[optimizationGoal] ?? (dest ? goals?.[Object.keys(goals)[0]] : null)
  return leafSpec?.allowedCTAs ?? [CTA_LEARN_MORE]
}

export function getDefaults(objective: string, destination: string, optimizationGoal: string): LeafSpec | null {
  const s = getSpec(objective)
  const dest = s?.destinations?.[destination]
  const goals = dest?.optimizationGoals
  const leafSpec = goals?.[optimizationGoal] ?? (dest ? goals?.[Object.keys(goals)[0]] : null)
  return leafSpec ?? null
}

export function getDefaultCTA(objective: string, destination: string, optimizationGoal: string): string {
  const d = getDefaults(objective, destination, optimizationGoal)
  return d?.defaultCTA ?? CTA_LEARN_MORE
}

export function getDefaultOptimizationGoal(objective: string, destination: string): string {
  const s = getSpec(objective)
  const dest = s?.destinations?.[destination]
  const result = dest?.defaultOptimizationGoal ?? LINK_CLICKS
  console.log('[DIAG][objectiveSpec] getDefaultOptimizationGoal:', { objective, destination, result })
  return result
}

export function isDestinationAllowed(objective: string, destination: string): boolean {
  return getAllowedDestinations(objective).includes(destination as DestinationId)
}

export function isOptimizationGoalAllowed(objective: string, destination: string, goal: string): boolean {
  return getAllowedOptimizationGoals(objective, destination).includes(goal)
}

export function isCTAAllowed(objective: string, destination: string, optimizationGoal: string, cta: string): boolean {
  return getAllowedCTAs(objective, destination, optimizationGoal).includes(cta)
}

export function validateCampaignPayload(payload: Record<string, unknown>): { ok: true } | { ok: false; message: string } {
  const name = payload.name
  const objective = payload.objective
  if (!name || typeof name !== 'string' || !String(name).trim()) {
    return { ok: false, message: 'name zorunludur' }
  }
  if (!objective || typeof objective !== 'string') {
    return { ok: false, message: 'objective zorunludur' }
  }
  if (!getSpec(String(objective))) {
    return { ok: false, message: `Geçersiz objective: ${objective}. İzin verilen: ${OBJECTIVE_IDS.join(', ')}` }
  }
  return { ok: true }
}

export function validateAdsetPayload(payload: Record<string, unknown>, objective: string): { ok: true } | { ok: false; message: string } {
  if (!getSpec(objective)) {
    return { ok: false, message: `Geçersiz objective: ${objective}` }
  }
  const name = payload.name
  if (!name || typeof name !== 'string' || !String(name).trim()) {
    return { ok: false, message: 'Reklam seti adı zorunludur' }
  }
  // destination_type kontrolü — body'den gelen conversionLocation veya destination_type
  const destination = payload.destination_type ?? payload.conversionLocation ?? 'WEBSITE'
  if (!isDestinationAllowed(objective, String(destination))) {
    return { ok: false, message: `Bu kampanya hedefi için geçersiz destination_type: ${destination}` }
  }
  const optimizationGoal = payload.optimizationGoal
  if (optimizationGoal && !isOptimizationGoalAllowed(objective, String(destination), String(optimizationGoal))) {
    return { ok: false, message: `Bu kampanya hedefi ve dönüşüm konumu için geçersiz optimizasyon hedefi: ${optimizationGoal}` }
  }
  return { ok: true }
}

export function validateAdPayload(
  payload: Record<string, unknown>,
  objective: string,
  destination: string,
  optimizationGoal?: string
): { ok: true } | { ok: false; message: string } {
  if (!getSpec(objective)) {
    return { ok: false, message: `Geçersiz objective: ${objective}` }
  }
  const name = payload.name
  if (!name || typeof name !== 'string' || !String(name).trim()) {
    return { ok: false, message: 'Reklam adı zorunludur' }
  }
  const goal = optimizationGoal ?? getDefaultOptimizationGoal(objective, destination)
  const creative = payload.creative as Record<string, unknown> | undefined
  if (creative && typeof creative === 'object' && creative.callToAction) {
    const cta = String(creative.callToAction)
    if (!isCTAAllowed(objective, destination, goal, cta)) {
      return { ok: false, message: `Bu hedef, dönüşüm konumu ve optimizasyon hedefi için geçersiz CTA: ${cta}` }
    }
  }
  return { ok: true }
}

/** objective'in conversion location select'i gösterip göstermeyeceğini belirler */
export function hasConversionLocation(objective: string): boolean {
  return objective !== 'OUTCOME_AWARENESS' && objective !== 'OUTCOME_APP_PROMOTION'
}

/** objective'e göre izin verilen buying type'ları döndürür */
export function getAllowedBuyingTypes(objective: string): ('AUCTION' | 'REACH_AND_FREQUENCY')[] {
  if (
    objective === 'OUTCOME_AWARENESS' ||
    objective === 'OUTCOME_TRAFFIC' ||
    objective === 'OUTCOME_ENGAGEMENT'
  ) {
    return ['AUCTION', 'REACH_AND_FREQUENCY']
  }
  return ['AUCTION']
}

export default SPEC
