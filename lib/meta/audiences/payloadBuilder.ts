/**
 * Meta Audience Payload Builder
 * Transforms YoAi wizard spec into Meta Graph API payload
 */

/* ── Custom Audience (Retargeting) ── */

interface PixelRule {
  retention_seconds: number
  filter?: { field: string; operator: string; value: unknown }[]
}

interface CustomAudiencePayload {
  name: string
  description?: string
  subtype: string
  rule?: string // JSON string of rule object
  customer_file_source?: string
  // Source-specific
  pixel_id?: string
  prefill?: boolean
  // IG / Page
  object_id?: string
  // Engagement subtype
  content_type?: string
  event_source_ids?: string[]
}

export function buildCustomAudiencePayload(
  name: string,
  description: string | null,
  spec: Record<string, unknown>
): CustomAudiencePayload {
  const source = spec.source as string | undefined
  const rule = spec.rule as Record<string, unknown> | undefined
  if (!rule) throw new Error('rule is required for Custom Audience')

  const retention = ((rule.retention as number) ?? 30) * 86400 // days → seconds

  const payload: CustomAudiencePayload = {
    name,
    description: description ?? undefined,
    subtype: 'CUSTOM', // default, overridden below per source
    prefill: true,
  }

  switch (source) {
    case 'PIXEL': {
      payload.subtype = 'WEBSITE'
      payload.pixel_id = rule.pixelId as string

      const ruleType = rule.ruleType as string
      const ruleObj: { inclusions: { operator: string; rules: PixelRule[] }[] } = {
        inclusions: [{ operator: 'or', rules: [] }],
      }

      if (ruleType === 'ALL_VISITORS' || !ruleType) {
        ruleObj.inclusions[0].rules.push({ retention_seconds: retention })
      } else if (ruleType === 'SPECIFIC_PAGES') {
        const op = rule.urlOperator === 'equals' ? 'eq' : 'i_contains'
        ruleObj.inclusions[0].rules.push({
          retention_seconds: retention,
          filter: [{ field: 'url', operator: op, value: rule.urlValue ?? '' }],
        })
      } else if (ruleType === 'EVENTS') {
        ruleObj.inclusions[0].rules.push({
          retention_seconds: retention,
          filter: [{ field: 'event', operator: 'eq', value: rule.eventName ?? 'ViewContent' }],
        })
      }

      // Add exclusions if present
      const excludeRules = (spec.excludeRules ?? []) as Array<Record<string, unknown>>
      if (excludeRules.length > 0) {
        const exclusions = excludeRules.map((er) => {
          const erRule = er.rule as Record<string, unknown>
          const erRetention = ((erRule?.retention as number) ?? 30) * 86400
          return { operator: 'or', rules: [{ retention_seconds: erRetention }] }
        })
        ;(ruleObj as Record<string, unknown>).exclusions = exclusions
      }

      payload.rule = JSON.stringify(ruleObj)
      break
    }
    case 'IG': {
      payload.subtype = 'ENGAGEMENT'
      payload.object_id = rule.igAccountId as string
      const igType = (rule.igEngagementType as string) ?? 'ig_business_profile_all'
      // Map YoAi engagement type to Meta rule
      const ruleObj = {
        inclusions: [{
          operator: 'or',
          rules: [{
            event_sources: [{ id: rule.igAccountId, type: 'ig_business' }],
            retention_seconds: retention,
            filter: { field: 'event', operator: 'eq', value: igType },
          }],
        }],
      }
      payload.rule = JSON.stringify(ruleObj)
      break
    }
    case 'PAGE': {
      payload.subtype = 'ENGAGEMENT'
      payload.object_id = rule.pageId as string
      const pageType = (rule.pageEngagementType as string) ?? 'page_engaged'
      const ruleObj = {
        inclusions: [{
          operator: 'or',
          rules: [{
            event_sources: [{ id: rule.pageId, type: 'page' }],
            retention_seconds: retention,
            filter: { field: 'event', operator: 'eq', value: pageType },
          }],
        }],
      }
      payload.rule = JSON.stringify(ruleObj)
      break
    }
    case 'VIDEO': {
      payload.subtype = 'ENGAGEMENT'
      const videoAction = (rule.videoRetentionType as string) ?? 'video_watched_3s'
      const ruleObj = {
        inclusions: [{
          operator: 'or',
          rules: [{
            retention_seconds: retention,
            filter: { field: 'event', operator: 'eq', value: videoAction },
          }],
        }],
      }
      payload.rule = JSON.stringify(ruleObj)
      break
    }
    case 'LEADFORM': {
      payload.subtype = 'ENGAGEMENT'
      if (rule.leadFormId) {
        payload.object_id = rule.leadFormId as string
      }
      const interaction = (rule.leadFormInteraction as string) ?? 'opened'
      const ruleObj = {
        inclusions: [{
          operator: 'or',
          rules: [{
            retention_seconds: retention,
            filter: { field: 'event', operator: 'eq', value: interaction === 'submitted' ? 'lead_submitted' : 'lead_opened' },
          }],
        }],
      }
      payload.rule = JSON.stringify(ruleObj)
      break
    }
    default: {
      // APP, OFFLINE, CATALOG, CUSTOMER_LIST — basic engagement subtype
      payload.subtype = 'ENGAGEMENT'
      const ruleObj = {
        inclusions: [{
          operator: 'or',
          rules: [{ retention_seconds: retention }],
        }],
      }
      payload.rule = JSON.stringify(ruleObj)
      break
    }
  }

  return payload
}

/* ── Lookalike Audience ── */

interface LookalikePayload {
  name: string
  description?: string
  subtype: 'LOOKALIKE'
  origin_audience_id: string
  lookalike_spec: string // JSON string
}

export function buildLookalikePayload(
  name: string,
  description: string | null,
  spec: Record<string, unknown>
): LookalikePayload {
  const seedAudienceId = spec.seedAudienceId as string
  const countries = (spec.countries ?? []) as string[]
  const sizePercent = (spec.sizePercent as number) ?? 1

  if (!seedAudienceId) throw new Error('seedAudienceId is required for Lookalike')
  if (countries.length === 0) throw new Error('At least one country is required for Lookalike')
  if (sizePercent < 1 || sizePercent > 10) throw new Error('sizePercent must be 1-10')

  // Meta expects ratio 0.01 - 0.10 (where 0.01 = 1%)
  const ratio = sizePercent / 100

  return {
    name,
    description: description ?? undefined,
    subtype: 'LOOKALIKE',
    origin_audience_id: seedAudienceId,
    lookalike_spec: JSON.stringify({
      type: 'similarity',
      country: countries[0], // Primary country
      ratio,
      ...(countries.length > 1 ? { target_countries: countries } : {}),
    }),
  }
}

/* ── Saved Audience ── */

interface SavedAudiencePayload {
  name: string
  description?: string
  targeting: Record<string, unknown>
}

export function buildSavedAudiencePayload(
  name: string,
  description: string | null,
  spec: Record<string, unknown>
): SavedAudiencePayload {
  const locations = (spec.locations ?? []) as Array<{ type: string; key: string }>
  const ageMin = (spec.ageMin as number) ?? 18
  const ageMax = (spec.ageMax as number) ?? 65
  const genders = (spec.genders ?? []) as number[]
  const locales = (spec.locales ?? []) as number[]
  const interests = (spec.interests ?? []) as Array<{ id: string; name: string }>
  const excludeInterests = (spec.excludeInterests ?? []) as Array<{ id: string; name: string }>
  const advantageAudience = spec.advantageAudience as boolean | undefined

  // Build geo_locations
  const countries = locations.filter((l) => l.type === 'country').map((l) => l.key)
  const cities = locations.filter((l) => l.type === 'city').map((l) => ({ key: l.key }))
  const regions = locations.filter((l) => l.type === 'region').map((l) => ({ key: l.key }))
  const geoLocations: Record<string, unknown> = {}
  if (countries.length) geoLocations.countries = countries
  if (cities.length) geoLocations.cities = cities
  if (regions.length) geoLocations.regions = regions
  if (Object.keys(geoLocations).length === 0) geoLocations.countries = ['TR']

  const targeting: Record<string, unknown> = {
    geo_locations: geoLocations,
    age_min: ageMin,
    age_max: ageMax,
  }

  if (genders.length > 0) targeting.genders = genders
  if (locales.length > 0) targeting.locales = locales
  if (interests.length > 0) {
    targeting.flexible_spec = [{ interests: interests.map((i) => ({ id: i.id, name: i.name })) }]
  }
  if (excludeInterests.length > 0) {
    targeting.exclusions = { interests: excludeInterests.map((i) => ({ id: i.id, name: i.name })) }
  }
  if (advantageAudience !== undefined) {
    targeting.targeting_automation = { advantage_audience: advantageAudience ? 1 : 0 }
  }

  return {
    name,
    description: description ?? undefined,
    targeting,
  }
}
