/**
 * Temporary admin diagnostic: verify Edge Config API auth from production runtime.
 * Protected by x-admin-secret. Never returns token values.
 * Remove after debugging complete.
 */

import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const adminSecret = process.env.ADMIN_SECRET
  if (!adminSecret?.trim()) {
    return NextResponse.json({ error: 'ADMIN_SECRET not configured' }, { status: 503 })
  }
  const headerSecret = req.headers.get('x-admin-secret')
  if (headerSecret !== adminSecret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const token = process.env.VERCEL_API_TOKEN?.trim()
  const teamId = process.env.VERCEL_TEAM_ID?.trim()
  const configId = process.env.AUDIENCE_EDGE_CONFIG_ID?.trim()

  const tokenPresent = !!token
  const tokenLength = token?.length ?? 0
  const tokenStartsWithVcp = !!(token && token.startsWith('vcp_'))

  let listStatus = 0
  let detailStatus = 0
  let targetFoundInList = false
  let listError: string | null = null
  let detailError: string | null = null

  if (token && teamId) {
    const listUrl = `https://api.vercel.com/v1/edge-config?teamId=${teamId}`
    const listRes = await fetch(listUrl, { headers: { Authorization: `Bearer ${token}` } })
    listStatus = listRes.status
    const listBody = await listRes.json().catch(() => ({}))
    if (!listRes.ok) {
      listError = (listBody as { error?: { code?: string; message?: string } })?.error?.message ?? JSON.stringify(listBody).slice(0, 200)
    } else {
      const configs = Array.isArray(listBody) ? listBody : (listBody as { edgeConfigs?: unknown[] })?.edgeConfigs ?? []
      targetFoundInList = configId ? configs.some((c: { id?: string }) => c.id === configId) : false
    }
  }

  if (token && teamId && configId) {
    const detailUrl = `https://api.vercel.com/v1/edge-config/${configId}?teamId=${teamId}`
    const detailRes = await fetch(detailUrl, { headers: { Authorization: `Bearer ${token}` } })
    detailStatus = detailRes.status
    const detailBody = await detailRes.json().catch(() => ({}))
    if (!detailRes.ok) {
      detailError = (detailBody as { error?: { code?: string; message?: string } })?.error?.message ?? JSON.stringify(detailBody).slice(0, 200)
    }
  }

  return NextResponse.json({
    tokenPresent,
    tokenLength,
    tokenStartsWithVcp,
    listStatus,
    detailStatus,
    targetFoundInList,
    listError: listError ?? undefined,
    detailError: detailError ?? undefined,
  })
}
