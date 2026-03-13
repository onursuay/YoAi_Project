/**
 * Teklif Stratejisi dropdown — tek kaynak.
 * BASE: AUTOMATIC_LOWEST_COST (payload'a bid_strategy gönderilmez).
 * CAP: LOWEST_COST_WITH_BID_CAP, COST_CAP.
 */

export const AUTOMATIC_LOWEST_COST = 'AUTOMATIC_LOWEST_COST' as const

export const BID_STRATEGY_OPTIONS = [
  { value: AUTOMATIC_LOWEST_COST },
  { value: 'LOWEST_COST_WITH_BID_CAP' },
  { value: 'COST_CAP' },
] as const

export const DEFAULT_BID_STRATEGY: typeof AUTOMATIC_LOWEST_COST = AUTOMATIC_LOWEST_COST

export type BidStrategyValue = (typeof BID_STRATEGY_OPTIONS)[number]['value']
