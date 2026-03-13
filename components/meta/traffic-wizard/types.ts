/* ── Traffic Campaign Wizard — Types ── */

export interface TrafficWizardState {
  currentStep: 1 | 2 | 3 | 4
  campaign: {
    name: string
    specialAdCategories: string[]
    budgetOptimization: 'adset' | 'campaign'
    /** CBO: kampanya seviyesinde bütçe tipi */
    campaignBudgetType?: 'daily' | 'lifetime'
    /** CBO: kampanya seviyesinde bütçe tutarı (TRY) */
    campaignBudget?: number
    /** CBO: strateji — MAX_VOLUME | BID_CAP | COST_CAP */
    campaignBidStrategy?: string
  }
  adset: {
    name: string
    /** Traffic destination */
    destination: 'WEBSITE' | 'APP' | 'MESSAGING' | 'INSTAGRAM_PROFILE' | 'PHONE_CALL'
    /** Website URL (when destination=WEBSITE) */
    websiteUrl: string
    /** Messaging platforms (when destination=MESSAGING) */
    messagingApps?: ('MESSENGER' | 'WHATSAPP' | 'INSTAGRAM')[]
    /** Phone number with country code (when destination=PHONE_CALL) */
    phoneNumber?: string
    /** Budget type — only used when ABO (adset-level budget) */
    budgetType: 'daily' | 'lifetime'
    /** Budget amount (TRY) — only used when ABO */
    budget: number | undefined
    /** Schedule: start type */
    startType: 'now' | 'schedule'
    /** Schedule: start datetime ISO */
    startTime: string
    /** Schedule: end type */
    endType: 'unlimited' | 'schedule'
    /** Schedule: end datetime ISO (null = ongoing) */
    endTime: string | null
    /** Audience — locations */
    locations: { type: string; key: string; name: string }[]
    /** Audience — age range */
    ageMin: number
    ageMax: number
    /** Audience — genders: []=All, [1]=Male, [2]=Female */
    genders: number[]
    /** Audience — language locales (Meta ad locale key + display name) */
    locales: { id: number; name: string }[]
    /** Audience — custom audiences to include */
    customAudiences: { id: string; name: string }[]
    /** Audience — custom audiences to exclude */
    excludedCustomAudiences: { id: string; name: string }[]
    /** Audience — detailed targeting (interests + behaviors + demographics) */
    detailedTargeting: { id: string; name: string; type: 'interest' | 'behavior' | 'demographic'; path?: string[] }[]
    /** CBO: optional ad set spending limits */
    cboSpendingMin?: number
    cboSpendingMax?: number
    /** Placements mode: advantage+ or manual */
    placementsMode: 'advantage' | 'manual'
    /** Manual placements selection (when manual) */
    manualPlacements: string[]
    /** Optimization goal */
    optimizationGoal: string
    /** Bid strategy — undefined = lowest cost (auto) */
    bidStrategy?: 'LOWEST_COST_WITH_BID_CAP' | 'COST_CAP'
    /** Bid amount (TRY) when bid cap/cost cap selected */
    bidAmount?: number
    /** ID of loaded saved audience (for "Kaydedilen hedef kitleyi kullan") */
    savedAudienceId?: string
    /** Whether Advantage+ detailed targeting is enabled */
    advantageDetailedTargeting?: boolean
  }
  ad: {
    name: string
    /** Creative format */
    format: 'single_image' | 'single_video' | 'carousel'
    /** Identity — Facebook Page */
    pageId: string
    pageName: string
    pageImage: string
    /** Identity — Instagram account (optional) */
    instagramAccountId: string
    instagramUsername: string
    /** Media — uploaded image hash (for single_image) */
    imageHash: string
    /** Media — uploaded image preview URL */
    imageUrl: string
    /** Media — uploaded video ID (for single_video) */
    videoId: string
    /** Media — original file name */
    mediaFileName: string
    /** Primary text (body) */
    primaryText: string
    /** Headline */
    headline: string
    /** Description */
    description: string
    /** Destination URL */
    destinationUrl: string
    /** Display URL (shown on ad) */
    displayUrl: string
    /** Call-to-Action type */
    callToAction: string
  }
}

export const initialTrafficWizardState: TrafficWizardState = {
  currentStep: 1,
  campaign: {
    name: '',
    specialAdCategories: [],
    budgetOptimization: 'adset',
    campaignBudgetType: 'daily',
    campaignBudget: undefined,
    campaignBidStrategy: 'MAX_VOLUME',
  },
  adset: {
    name: '',
    destination: 'WEBSITE',
    websiteUrl: '',
    budgetType: 'daily',
    budget: undefined,
    startType: 'now',
    startTime: '',
    endType: 'unlimited',
    endTime: null,
    locations: [],
    ageMin: 18,
    ageMax: 65,
    genders: [],
    locales: [],
    customAudiences: [],
    excludedCustomAudiences: [],
    detailedTargeting: [],
    cboSpendingMin: undefined,
    cboSpendingMax: undefined,
    placementsMode: 'advantage',
    manualPlacements: [],
    optimizationGoal: 'LINK_CLICKS',
    bidStrategy: undefined,
    bidAmount: undefined,
    savedAudienceId: undefined,
    advantageDetailedTargeting: true,
  },
  ad: {
    name: '',
    format: 'single_image',
    pageId: '',
    pageName: '',
    pageImage: '',
    instagramAccountId: '',
    instagramUsername: '',
    imageHash: '',
    imageUrl: '',
    videoId: '',
    mediaFileName: '',
    primaryText: '',
    headline: '',
    description: '',
    destinationUrl: '',
    displayUrl: '',
    callToAction: 'LEARN_MORE',
  },
}

/** Fixed objective — not in state */
export const TRAFFIC_OBJECTIVE = 'OUTCOME_TRAFFIC'
