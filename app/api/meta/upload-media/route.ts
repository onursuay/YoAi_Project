import { NextResponse } from 'next/server'
import { createMetaClient } from '@/lib/meta/client'

const DEBUG = process.env.NODE_ENV !== 'production'
export const dynamic = 'force-dynamic'

export const maxDuration = 60

export async function POST(request: Request) {
  try {
    const metaClient = await createMetaClient()
    if (!metaClient) {
      return NextResponse.json(
        { ok: false, error: 'missing_token', message: 'Meta bağlantısı bulunamadı' },
        { status: 401 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const type = formData.get('type') as string || 'image'

    if (!file) {
      return NextResponse.json(
        { ok: false, error: 'missing_file', message: 'Dosya gerekli' },
        { status: 400 }
      )
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const base64 = buffer.toString('base64')

    if (type === 'video') {
      // Video upload - advideos endpoint
      const videoFormData = new URLSearchParams()
      videoFormData.append('source', base64)
      videoFormData.append('title', file.name)

      const result = await metaClient.client.postForm(
        `/${metaClient.accountId}/advideos`,
        videoFormData
      )

      if (!result.ok) {
        return NextResponse.json(
          { ok: false, error: 'upload_failed', message: result.error?.message || 'Video yüklenemedi' },
          { status: 502 }
        )
      }

      return NextResponse.json({
        ok: true,
        videoId: result.data?.id,
        data: result.data
      })
    } else {
      // Image upload - adimages endpoint
      const imageFormData = new URLSearchParams()
      imageFormData.append('bytes', base64)
      imageFormData.append('name', file.name)

      const result = await metaClient.client.postForm(
        `/${metaClient.accountId}/adimages`,
        imageFormData
      )

      if (!result.ok) {
        return NextResponse.json(
          { ok: false, error: 'upload_failed', message: result.error?.message || 'Görsel yüklenemedi' },
          { status: 502 }
        )
      }

      // adimages response: { images: { [filename]: { hash, url } } }
      const images = result.data?.images
      const imageData = images ? Object.values(images)[0] as { hash: string; url: string } : null

      return NextResponse.json({
        ok: true,
        hash: imageData?.hash,
        url: imageData?.url,
        data: result.data
      })
    }
  } catch (error) {
    if (DEBUG) console.error('Media upload error:', error)
    return NextResponse.json(
      { ok: false, error: 'server_error', message: 'Sunucu hatası' },
      { status: 500 }
    )
  }
}
