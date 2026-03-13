import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createMetaClient } from '@/lib/meta/client'
import { META_BASE_URL } from '@/lib/metaConfig'
import { getCached, setCached } from '@/lib/meta/cache'
import { runWhatsappSelfcheck } from '@/lib/meta/whatsappSelfcheck'

export const dynamic = 'force-dynamic'

const CAPABILITIES_CACHE_TTL = 60 * 1000 // 60s
const CAPABILITIES_CACHE_KEY_PREFIX = 'meta_capabilities_'

/** Requested OAuth scopes (single source: login route exports META_SCOPES) */
const REQUESTED_SCOPES = [
  'ads_read',
  'ads_management',
  'pages_show_list',
  'pages_read_engagement',
  'pages_manage_ads',
  'leads_retrieval',
  'pages_manage_metadata',
  'business_management',
  'instagram_basic',
  'instagram_manage_messages',
  'whatsapp_business_management',
  'whatsapp_business_messaging',
]

interface DebugTokenData {
  scopes?: string[]
  is_valid?: boolean
}

async function getGrantedScopes(accessToken: string): Promise<string[]> {
  const appId = process.env.META_APP_ID
  const appSecret = process.env.META_APP_SECRET
  if (!appId || !appSecret) return REQUESTED_SCOPES
  const appToken = `${appId}|${appSecret}`
  const url = `${META_BASE_URL}/debug_token?input_token=${encodeURIComponent(accessToken)}&access_token=${encodeURIComponent(appToken)}`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) return REQUESTED_SCOPES
  const json = (await res.json()) as { data?: DebugTokenData }
  const scopes = json?.data?.scopes
  if (Array.isArray(scopes)) return scopes
  return REQUESTED_SCOPES
}

export async function GET() {
  const requestId = crypto.randomUUID().slice(0, 8)
  const cookieStore = await cookies()
  const accessToken = cookieStore.get('meta_access_token')?.value
  const adAccountIdRaw = cookieStore.get('meta_selected_ad_account_id')?.value

  if (!accessToken) {
    return NextResponse.json({
      ok: true,
      connected: false,
      grantedScopes: [],
      adAccountId: null,
      assets: { pages: [], instagramAccounts: [], pixels: [], leadForms: [], whatsapp: { available: false, reason: 'Meta bağlantısı yok' } },
      features: {
        canCTWA: false,
        canLeadFormsCreate: false,
        canLeadRetrieval: false,
        canWebsite: false,
        canSalesWithPixel: false,
      },
      reasons: { not_connected: 'Meta bağlantısı yok' },
    })
  }

  const adAccountId = adAccountIdRaw?.startsWith('act_') ? adAccountIdRaw : adAccountIdRaw ? `act_${adAccountIdRaw.replace(/^act_/, '')}` : null
  const cacheKey = `${CAPABILITIES_CACHE_KEY_PREFIX}${adAccountId ?? 'no_account'}`
  const cached = getCached(cacheKey)
  if (cached && typeof cached === 'object' && cached.connected !== undefined) {
    return NextResponse.json(cached)
  }

  let metaClient: Awaited<ReturnType<typeof createMetaClient>> = null
  if (adAccountId) {
    metaClient = await createMetaClient()
  }

  const grantedScopes = await getGrantedScopes(accessToken)
  const hasLeadsRetrieval = grantedScopes.includes('leads_retrieval')
  const hasPagesManageMetadata = grantedScopes.includes('pages_manage_metadata')
  const hasPagesShowList = grantedScopes.includes('pages_show_list')
  const hasAdsManagement = grantedScopes.includes('ads_management')
  const hasWhatsAppManagement = grantedScopes.includes('whatsapp_business_management')
  const hasWhatsAppMessaging = grantedScopes.includes('whatsapp_business_messaging')

  const assets: {
    pages: { id: string; name: string; access_token?: string; picture?: { data?: { url?: string } }; instagram_business_account?: { id: string; username: string; profile_picture_url?: string } }[]
    instagramAccounts: { id: string; username: string; profile_picture_url?: string }[]
    pixels: { id: string; name: string }[]
    leadForms: { id: string; name: string; page_id: string }[]
    whatsapp: { available: boolean; reason?: string; phoneNumbers?: { phoneNumberId: string; displayPhone?: string; verifiedName?: string }[] }
  } = {
    pages: [],
    instagramAccounts: [],
    pixels: [],
    leadForms: [],
    whatsapp: { available: false, reason: undefined, phoneNumbers: [] },
  }

  const reasons: Record<string, string> = {}

  if (!metaClient) {
    const payload = {
      ok: true,
      connected: true,
      grantedScopes,
      adAccountId: null,
      assets,
      features: {
        canCTWA: false,
        canLeadFormsCreate: false,
        canLeadRetrieval: hasLeadsRetrieval,
        canWebsite: true,
        canSalesWithPixel: false,
      },
      reasons: { no_ad_account: 'Reklam hesabı seçilmedi' },
    }
    setCached(cacheKey, payload)
    return NextResponse.json(payload)
  }

  const client = metaClient.client
  const accountId = metaClient.accountId

  // Pages
  const userPagesRes = await client.get<{ data?: { id: string; name: string; access_token?: string; picture?: { data?: { url?: string } }; instagram_business_account?: { id: string; username: string; profile_picture_url?: string } }[] }>(
    '/me/accounts',
    { fields: 'id,name,access_token,picture{url},instagram_business_account{id,username,profile_picture_url}', limit: '100' }
  )
  if (userPagesRes.ok && userPagesRes.data?.data?.length) {
    assets.pages = userPagesRes.data.data
    const igSet = new Map<string, { id: string; username: string; profile_picture_url?: string }>()
    for (const p of assets.pages) {
      if (p.instagram_business_account) {
        const ig = p.instagram_business_account
        if (!igSet.has(ig.id)) igSet.set(ig.id, { id: ig.id, username: ig.username, profile_picture_url: ig.profile_picture_url })
      }
    }
    assets.instagramAccounts = Array.from(igSet.values())
  }

  // CTWA / WhatsApp: check scopes + attempt selfcheck for ALL pages (fix: was only checking pages[0])
  if (assets.pages.length > 0 && hasAdsManagement && hasWhatsAppManagement && hasWhatsAppMessaging) {
    let foundAvailable = false
    let lastReason = 'WhatsApp Business hesabı yapılandırılmamış'
    let matchedPageId: string | null = null
    let collectedPhones: { phoneNumberId: string; displayPhone?: string; verifiedName?: string }[] = []

    // Check only the selected page — not all pages — to avoid rate limiting
    const cookieSelectedPageId = cookieStore.get('meta_selected_page_id')?.value
    const pageToCheck = cookieSelectedPageId
      ? assets.pages.find(p => String(p.id) === String(cookieSelectedPageId)) ?? assets.pages[0]
      : assets.pages[0]

    if (pageToCheck) {
      const selfcheckRes = await runWhatsappSelfcheck(
        client,
        String(pageToCheck.id),
        { adAccountId: accountId, grantedScopes },
        pageToCheck.access_token
      )
      const wabaPhones = selfcheckRes.steps?.waba_to_phone_numbers ?? []
      collectedPhones = []
      for (const w of wabaPhones) {
        if (w.step.ok && Array.isArray(w.step.data)) {
          for (const p of w.step.data) {
            if (p.id) {
              collectedPhones.push({
                phoneNumberId: String(p.id),
                displayPhone: p.display_phone_number ?? undefined,
                verifiedName: p.verified_name ?? undefined,
              })
            }
          }
        }
      }
      const hasPhones = collectedPhones.length > 0
      if (hasPhones) {
        foundAvailable = true
        matchedPageId = String(pageToCheck.id)
      } else {
        lastReason = 'WhatsApp Business hesabı yapılandırılmamış'
      }
    }

    assets.whatsapp = foundAvailable
      ? { available: true, phoneNumbers: collectedPhones }
      : { available: false, reason: lastReason, phoneNumbers: [] }
  } else if (assets.pages.length === 0) {
    assets.whatsapp = { available: false, reason: 'Bağlı sayfa yok' }
  } else if (!hasWhatsAppManagement || !hasWhatsAppMessaging) {
    assets.whatsapp = { available: false, reason: 'WhatsApp izinleri onaysız (whatsapp_business_management / whatsapp_business_messaging)' }
  } else {
    assets.whatsapp = { available: false, reason: 'Gerekli izin yok' }
  }
  if (!assets.whatsapp.available) reasons.ctwa = assets.whatsapp.reason ?? 'WhatsApp reklamları kullanılamıyor'

  // Pixels
  const pixelsRes = await client.get<{ data?: { id: string; name: string }[] }>(`/${accountId}/adspixels`, { fields: 'id,name', limit: '50' })
  if (pixelsRes.ok && pixelsRes.data?.data?.length) {
    assets.pixels = pixelsRes.data.data
  }

  // Lead forms (from pages)
  const leadFormsList: { id: string; name: string; page_id: string }[] = []
  for (let i = 0; i < Math.min(assets.pages.length, 10); i++) {
    const page = assets.pages[i]
    const formsRes = await client.get<{ data?: { id: string; name: string; page_id?: string }[] }>(
      `/${page.id}/leadgen_forms`,
      { fields: 'id,name,page_id', limit: '25' }
    )
    if (formsRes.ok && formsRes.data?.data?.length) {
      for (const f of formsRes.data.data) {
        leadFormsList.push({ id: f.id, name: f.name ?? f.id, page_id: f.page_id ?? page.id })
      }
    }
  }
  assets.leadForms = leadFormsList

  const canLeadFormsCreate = (hasLeadsRetrieval || hasPagesManageMetadata) && (assets.pages.length > 0)
  const canLeadRetrieval = hasLeadsRetrieval

  const payload = {
    ok: true,
    connected: true,
    grantedScopes,
    adAccountId: accountId,
    assets,
    features: {
      canCTWA: assets.whatsapp.available,
      canLeadFormsCreate,
      canLeadRetrieval,
      canWebsite: true,
      canSalesWithPixel: assets.pixels.length > 0,
    },
    reasons,
  }

  setCached(cacheKey, payload)
  return NextResponse.json(payload)
}
