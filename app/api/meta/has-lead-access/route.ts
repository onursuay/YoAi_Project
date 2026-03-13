import { NextResponse } from 'next/server'
import { createMetaClient } from '@/lib/meta/client'

export const dynamic = 'force-dynamic'

const TOKEN_INVALID_CODES = [190, 102, 104]

/**
 * GET /api/meta/has-lead-access?formId=xxx
 * Meta: /{form-id}/has_lead_access
 * Returns { hasAccess: boolean, reason?: string }
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const formId = searchParams.get('formId')

  if (!formId?.trim()) {
    return NextResponse.json(
      { ok: false, error: 'missing_param', message: 'formId zorunludur' },
      { status: 400 }
    )
  }

  const metaClient = await createMetaClient()
  if (!metaClient) {
    return NextResponse.json(
      { ok: false, error: 'missing_token', message: 'Meta bağlantısı bulunamadı' },
      { status: 401 }
    )
  }

  const result = await metaClient.client.get<{ has_lead_access?: boolean }>(
    `/${formId.trim()}/has_lead_access`
  )

  if (!result.ok) {
    const errorCode = result.error?.code

    if (errorCode === 403 || result.error?.type === 'OAuthException') {
      return NextResponse.json(
        {
          ok: false,
          hasAccess: false,
          reason: 'Lead form erişim izni yok. Facebook App ayarlarından leads_retrieval iznini aktifleştirin ve App Review\'dan geçirin.',
          code: errorCode,
        },
        { status: 403 }
      )
    }

    if (errorCode && TOKEN_INVALID_CODES.includes(errorCode)) {
      return NextResponse.json(
        {
          ok: false,
          hasAccess: false,
          reason: 'Meta oturumunuz sonlanmış. Lütfen tekrar bağlanın.',
          code: errorCode,
          requires_reauth: true,
        },
        { status: 401 }
      )
    }

    return NextResponse.json(
      {
        ok: false,
        hasAccess: false,
        reason: result.error?.message ?? 'has_lead_access sorgulanamadı',
        code: errorCode,
      },
      { status: 400 }
    )
  }

  const hasAccess = result.data?.has_lead_access === true
  return NextResponse.json({
    ok: true,
    hasAccess,
    reason: hasAccess ? undefined : 'Bu form için lead erişiminiz bulunmuyor.',
  })
}
