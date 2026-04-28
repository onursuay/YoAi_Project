import { NextResponse } from 'next/server'

/** Google Drive Picker için client-side gerekli konfigürasyonu döner. */
export async function GET() {
  const apiKey = process.env.GOOGLE_PICKER_API_KEY?.trim()
  const clientId = process.env.GOOGLE_PICKER_CLIENT_ID?.trim()
  const appId = process.env.GOOGLE_PICKER_APP_ID?.trim()

  if (!apiKey || !clientId || !appId) {
    return NextResponse.json({ configured: false })
  }
  return NextResponse.json({
    configured: true,
    apiKey,
    clientId,
    appId,
  })
}
