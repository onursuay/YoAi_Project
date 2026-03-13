import type { MetaGraphClient } from '@/lib/meta/client'

export interface StepError {
  message?: string
  code?: number
  subcode?: number
  request_id?: string
}

export interface StepResult<T> {
  ok: boolean
  status?: number
  request_id?: string
  error?: StepError
  data?: T
}

export interface PhoneNumber {
  id: string
  display_phone_number?: string
  verified_name?: string
  quality_rating?: string
  code_verification_status?: string
}

export interface WhatsappSelfcheckResult {
  ok: boolean
  steps?: {
    page_business_mapping: StepResult<unknown>
    business_to_wabas: StepResult<{ id: string; name?: string }[]>
    waba_to_phone_numbers: Array<{
      waba_id: string
      waba_name?: string
      step: StepResult<PhoneNumber[]>
    }>
  }
  error?: string
}

export interface SelfcheckDebugContext {
  adAccountId?: string
  grantedScopes?: string[]
}

function buildStepResult<T>(res: {
  ok: boolean
  status?: number
  requestId?: string
  error?: { message?: string; code?: number; subcode?: number; error_subcode?: number; fbtrace_id?: string }
  data?: T
}): StepResult<T> {
  if (res.ok) {
    return {
      ok: true,
      status: res.status,
      request_id: res.requestId || res.error?.fbtrace_id,
      data: res.data,
    }
  }
  return {
    ok: false,
    status: res.status,
    request_id: res.requestId || res.error?.fbtrace_id,
    error: {
      message: res.error?.message,
      code: res.error?.code,
      subcode: res.error?.subcode ?? res.error?.error_subcode,
      request_id: res.requestId || res.error?.fbtrace_id,
    },
  }
}

export async function runWhatsappSelfcheck(
  client: MetaGraphClient,
  pageId: string,
  debugContext?: SelfcheckDebugContext,
  pageAccessToken?: string
): Promise<WhatsappSelfcheckResult> {
  const hasBusinessManagement = debugContext?.grantedScopes?.includes('business_management') ?? false

  try {
    // PRIMARY: ask the page directly for its linked WABA
    // If pageAccessToken is provided, use it (Page Access Token has access to page's own WABA)
    // Otherwise fall back to the user-level client
    let directWaba: { id: string; name?: string; phone_numbers?: { data?: PhoneNumber[] } } | undefined

    if (pageAccessToken) {
      const wabaUrl = `https://graph.facebook.com/v24.0/${pageId}?fields=id,name,whatsapp_business_account{id,name,phone_numbers{id,display_phone_number,verified_name}}&access_token=${pageAccessToken}`
      const wabaFetch = await fetch(wabaUrl, { cache: 'no-store' }).then(r => r.json()).catch(() => ({})) as {
        whatsapp_business_account?: { id: string; name?: string; phone_numbers?: { data?: PhoneNumber[] } }
        error?: { message?: string; code?: number }
      }
      directWaba = wabaFetch?.whatsapp_business_account
    } else {
      const pageWabaRes = await client.get<{
        id?: string
        name?: string
        whatsapp_business_account?: {
          id: string
          name?: string
          phone_numbers?: { data?: PhoneNumber[] }
        }
      }>(`/${pageId}`, {
        fields: 'id,name,whatsapp_business_account{id,name,phone_numbers{id,display_phone_number,verified_name}}',
      })
      directWaba = pageWabaRes.data?.whatsapp_business_account
    }

    if (directWaba) {
      const phones: PhoneNumber[] = Array.isArray(directWaba.phone_numbers?.data)
        ? directWaba.phone_numbers!.data!
        : []

      const pageMapping = buildStepResult({
        ok: true,
        status: undefined,
        data: { source: 'page_direct_waba', waba_id: directWaba.id },
      })
      const wabasResult = buildStepResult<{ id: string; name?: string }[]>({
        ok: true,
        data: [{ id: directWaba.id, name: directWaba.name }],
      })
      const waba_to_phone_numbers = [{
        waba_id: directWaba.id,
        waba_name: directWaba.name,
        step: buildStepResult<PhoneNumber[]>({ ok: true, data: phones }),
      }]

      return {
        ok: true,
        steps: { page_business_mapping: pageMapping, business_to_wabas: wabasResult, waba_to_phone_numbers },
      }
    }

    // FALLBACK: page direct WABA lookup failed — try business mapping chain
    // Step A: try /{pageId}?fields=business{id,name}  (needs business_management at runtime)
    // Step B: if Step A returns 403 OR grantedScopes doesn't include it → /me/businesses
    let businessIds: { id: string; name?: string }[] = []
    let pageMapping: StepResult<unknown>
    let mappingEndpointUsed = 'none'

    if (hasBusinessManagement) {
      const pageMapRes = await client.get<{
        business?: { id?: string; name?: string }
      }>(`/${pageId}`, {
        fields: 'id,name,business{id,name}',
      })

      mappingEndpointUsed = `/${pageId}?fields=business{id,name}`

      if (pageMapRes.ok) {
        pageMapping = buildStepResult(pageMapRes)
        const businessId = pageMapRes.data?.business?.id
        if (businessId) businessIds = [{ id: businessId }]
      } else {
        // Step A failed (likely 403 at runtime despite scope appearing granted) → Step B
        const bizRes = await client.get<{ data?: { id: string; name?: string }[] }>(
          '/me/businesses',
          { fields: 'id,name', limit: '50' }
        )
        const meBusinesses = Array.isArray(bizRes.data?.data) ? bizRes.data.data : []
        businessIds = meBusinesses
        mappingEndpointUsed = '/me/businesses (runtime-403-fallback)'
        pageMapping = buildStepResult({
          ok: bizRes.ok,
          status: bizRes.status,
          error: bizRes.error,
          data: { fallback: 'me_businesses_runtime_403', count: meBusinesses.length },
        })
      }
    } else {
      // grantedScopes doesn't include business_management → go directly to /me/businesses
      const bizRes = await client.get<{ data?: { id: string; name?: string }[] }>(
        '/me/businesses',
        { fields: 'id,name', limit: '50' }
      )
      const meBusinesses = Array.isArray(bizRes.data?.data) ? bizRes.data.data : []
      businessIds = meBusinesses
      mappingEndpointUsed = '/me/businesses (no-business_management-scope)'
      pageMapping = buildStepResult({
        ok: bizRes.ok,
        status: bizRes.status,
        error: bizRes.error,
        data: { fallback: 'me_businesses', count: meBusinesses.length, business_management_missing: true },
      })
    }

    let wabasResult: StepResult<{ id: string; name?: string }[]> = {
      ok: false,
      error: { message: 'Business mapping bulunamadı.' },
    }
    let wabas: { id: string; name?: string }[] = []

    for (const biz of businessIds) {
      const wabaRes = await client.get<{ data?: { id: string; name?: string }[] }>(
        `/${biz.id}/owned_whatsapp_business_accounts`,
        { fields: 'id,name', limit: '50' }
      )
      const found = Array.isArray(wabaRes.data?.data) ? wabaRes.data.data : []
      if (found.length > 0) {
        wabasResult = buildStepResult({ ...wabaRes, data: found })
        wabas = [...wabas, ...found]
      } else if (wabas.length === 0) {
        wabasResult = buildStepResult({ ...wabaRes, data: found })
      }
    }

    const waba_to_phone_numbers: Array<{
      waba_id: string
      waba_name?: string
      step: StepResult<PhoneNumber[]>
    }> = []

    for (const waba of wabas) {
      const phoneRes = await client.get<{ data?: PhoneNumber[] }>(
        `/${waba.id}/phone_numbers`,
        {
          fields: 'id,display_phone_number,verified_name,quality_rating,code_verification_status',
          limit: '50',
        }
      )
      waba_to_phone_numbers.push({
        waba_id: waba.id,
        waba_name: waba.name,
        step: buildStepResult({
          ...phoneRes,
          data: Array.isArray(phoneRes.data?.data) ? phoneRes.data.data : [],
        }),
      })
    }

    return {
      ok: true,
      steps: { page_business_mapping: pageMapping, business_to_wabas: wabasResult, waba_to_phone_numbers },
    }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    }
  }
}
