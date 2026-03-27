import { NextRequest, NextResponse } from 'next/server'
import { fal } from '@fal-ai/client'

fal.config({ credentials: process.env.FAL_KEY! })

export async function POST(req: NextRequest) {
  try {
    const { dataUrl } = await req.json()

    if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) {
      return NextResponse.json({ error: 'Valid data URL is required' }, { status: 400 })
    }

    if (!process.env.FAL_KEY) {
      return NextResponse.json({ error: 'FAL_KEY not configured' }, { status: 500 })
    }

    const [meta, base64] = dataUrl.split(',')
    const mime = meta.match(/:(.*?);/)?.[1] || 'image/jpeg'
    const buffer = Buffer.from(base64, 'base64')
    const blob = new Blob([buffer], { type: mime })
    const file = new File([blob], 'overlay.jpg', { type: mime })
    const url = await fal.storage.upload(file)

    return NextResponse.json({ url })
  } catch (err) {
    console.error('[upload]', err)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
