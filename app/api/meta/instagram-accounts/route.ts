import { NextResponse } from "next/server"
import { createMetaClient } from "@/lib/meta/client"

const DEBUG = process.env.NODE_ENV !== 'production'
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const pageId = searchParams.get("pageId")

    if (!pageId) {
      return NextResponse.json(
        { ok: false, error: "missing_param", message: "pageId gerekli" },
        { status: 400 }
      )
    }

    const metaClient = await createMetaClient()
    if (!metaClient) {
      return NextResponse.json(
        { ok: false, error: "missing_token", message: "Meta bağlantısı bulunamadı" },
        { status: 401 }
      )
    }

    const result = await metaClient.client.get(`/${pageId}`, {
      fields: "instagram_business_account{id,username,profile_picture_url}"
    })

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: "meta_api_error", message: result.error?.message || "Instagram hesabı alınamadı" },
        { status: 502 }
      )
    }

    const igAccount = result.data?.instagram_business_account || null
    return NextResponse.json({ ok: true, data: igAccount })
  } catch (error) {
    if (DEBUG) console.error("Instagram accounts fetch error:", error)
    return NextResponse.json(
      { ok: false, error: "server_error", message: "Sunucu hatası" },
      { status: 500 }
    )
  }
}
