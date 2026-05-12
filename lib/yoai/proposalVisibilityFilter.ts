import { isGenericProposalContent } from './competitorDisplay'
import type { FullAdProposal } from './adCreator'

export interface FilterOptions {
  expiredIds?: Set<string>
}

/**
 * Server ve UI arasında paylaşılan tek kaynak filtresi.
 * generate-ad route'u ve AiAdSuggestions isVisible fonksiyonu aynı kuralı uygular.
 */
export function filterVisibleYoaiProposals(
  proposals: FullAdProposal[],
  options: FilterOptions = {},
): FullAdProposal[] {
  return proposals.filter(p => {
    if (p.policyStatus === 'rejected') return false
    if (options.expiredIds && p.id && options.expiredIds.has(p.id)) return false
    if (isGenericProposalContent(p)) return false
    return true
  })
}
