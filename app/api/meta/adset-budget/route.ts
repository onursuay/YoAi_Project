import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { metaGraphFetch, metaGraphFetchJSON } from '@/lib/metaGraph'
import { toMetaMinorUnits } from '@/lib/meta/currency'

const DEBUG = process.env.NODE_ENV !== 'production'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies()
    const accessToken = cookieStore.get('meta_access_token')
    const selectedAdAccountId = cookieStore.get('meta_selected_ad_account_id')

    if (!accessToken?.value) {
      return NextResponse.json({ error: 'missing_token' }, { status: 401 })
    }

    if (!selectedAdAccountId?.value) {
      return NextResponse.json({ error: 'no_ad_account_selected' }, { status: 400 })
    }

    // Check token expiration
    const expiresAtCookie = cookieStore.get('meta_access_expires_at')
    if (expiresAtCookie) {
      const expiresAt = parseInt(expiresAtCookie.value, 10)
      if (Date.now() >= expiresAt) {
        return NextResponse.json({ error: 'token_expired' }, { status: 401 })
      }
    }

    const body = await request.json()
    const { account_id, adset_id, adsetId, budgetTL, dailyBudget, budgetType } = body

    // Support both old format (adsetId, dailyBudget) and new format (adset_id, budgetTL, budgetType)
    const finalAdsetId = adset_id || adsetId
    const finalBudgetTL = budgetTL != null ? Number(budgetTL) : (dailyBudget != null ? Number(dailyBudget) : null)
    const finalBudgetType = budgetType || (dailyBudget != null ? 'daily' : 'daily') // Default to 'daily' for backward compatibility

    if (!finalAdsetId || typeof finalAdsetId !== 'string') {
      return NextResponse.json(
        { error: 'invalid_input', message: 'adset_id or adsetId is required' },
        { status: 400 }
      )
    }

    if (finalBudgetTL === null || finalBudgetTL === undefined || !Number.isFinite(finalBudgetTL) || finalBudgetTL <= 0) {
      return NextResponse.json(
        { error: 'invalid_input', message: 'budgetTL or dailyBudget is required and must be a positive number' },
        { status: 400 }
      )
    }

    if (finalBudgetType !== 'daily' && finalBudgetType !== 'lifetime') {
      return NextResponse.json(
        { error: 'invalid_input', message: 'budgetType must be "daily" or "lifetime"' },
        { status: 400 }
      )
    }

    // Fetch account currency for correct minor unit conversion
    const normalizedAccountId = selectedAdAccountId.value.startsWith('act_') ? selectedAdAccountId.value : `act_${selectedAdAccountId.value}`
    const { data: acctData } = await metaGraphFetchJSON(`/${normalizedAccountId}`, accessToken.value, { params: { fields: 'currency' } })
    const acctCurrency = typeof acctData?.currency === 'string' ? acctData.currency : 'USD'
    const budgetMinor = toMetaMinorUnits(finalBudgetTL, acctCurrency)

    // Update budget via Meta Graph API
    const formData = new URLSearchParams()
    if (finalBudgetType === 'daily') {
      formData.append('daily_budget', budgetMinor)
    } else {
      formData.append('lifetime_budget', budgetMinor)
    }

    const response = await metaGraphFetch(`/${finalAdsetId}`, accessToken.value, {
      method: 'POST',
      body: formData.toString(),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      const errorMessage = errorData.error?.message || `HTTP ${response.status}`

      if (response.status === 403) {
        return NextResponse.json(
          {
            error: 'permission_denied',
            message: 'Bu reklam setinin bütçesini güncellemek için yetkiniz yok.',
            details: errorMessage,
          },
          { status: 403 }
        )
      }

      if (response.status === 400) {
        return NextResponse.json(
          {
            error: 'validation_error',
            message: 'Geçersiz bütçe değeri.',
            details: errorMessage,
          },
          { status: 400 }
        )
      }

      if (response.status === 429) {
        return NextResponse.json(
          {
            error: 'rate_limit_exceeded',
            message: 'Çok fazla istek gönderildi. Lütfen bekleyin.',
            details: errorMessage,
          },
          { status: 429 }
        )
      }

      return NextResponse.json(
        {
          error: 'meta_api_error',
          message: 'Bütçe güncellenemedi.',
          details: errorMessage,
        },
        { status: 502 }
      )
    }

    const data = await response.json()

    return NextResponse.json({
      success: true,
      adset_id: finalAdsetId,
      budgetType: finalBudgetType,
      [finalBudgetType === 'daily' ? 'daily_budget' : 'lifetime_budget']: Number(budgetMinor),
      data,
    }, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' }
    })
  } catch (error) {
    if (DEBUG) console.error('Adset budget update error:', error)
    return NextResponse.json(
      {
        error: 'server_error',
        message: 'Sunucu hatası oluştu.',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
