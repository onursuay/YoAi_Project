import { NextRequest, NextResponse } from 'next/server'
import { getGoogleAdsContext } from '@/lib/googleAdsAuth'
import { listKeywords, addKeywords, addAdGroupNegativeKeywords, updateKeyword, removeKeyword } from '@/lib/google-ads/keywords'

export async function GET(_req: NextRequest, { params }: { params: { adGroupId: string } }) {
  try {
    const ctx = await getGoogleAdsContext()
    const keywords = await listKeywords(ctx, params.adGroupId)
    return NextResponse.json({ keywords }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await getGoogleAdsContext()
    const body = await req.json()
    if (body.type === 'negative') {
      await addAdGroupNegativeKeywords(ctx, body.adGroupResourceName, body.keywords)
    } else {
      await addKeywords(ctx, body.adGroupResourceName, body.keywords)
    }
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const ctx = await getGoogleAdsContext()
    const { resourceName, status, cpcBidMicros } = await req.json()
    await updateKeyword(ctx, resourceName, { status, cpcBidMicros })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const ctx = await getGoogleAdsContext()
    const { resourceName } = await req.json()
    await removeKeyword(ctx, resourceName)
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 })
  }
}
