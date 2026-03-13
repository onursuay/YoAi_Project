/**
 * Error Router — Maps Meta API error codes/subcodes to wizard step + field + message.
 *
 * Usage:
 *   const route = routeMetaError(errorCode, errorSubcode, errorMessage, objective)
 *   setState(prev => ({ ...prev, currentStep: route.step }))
 *   setStepErrors({ [route.field]: route.message })
 */

export interface ErrorRoute {
  /** Wizard step to navigate to (1=Campaign, 2=AdSet, 3=Ad, 4=Summary) */
  step: 1 | 2 | 3 | 4
  /** Field key for setStepErrors */
  field?: string
  /** Human-readable message to display */
  message: string
  /** UI action hint */
  action?: 'show_field' | 'focus_input' | 'show_link' | 'retry'
  /** Optional link (e.g. Lead Terms acceptance page) */
  linkUrl?: string
  /** Whether this is a retryable error */
  retryable?: boolean
}

/**
 * Route a Meta API error to the appropriate wizard step and field.
 *
 * @param errorCode    - Meta error code (top-level `code` field)
 * @param errorSubcode - Meta error subcode (`error_subcode` field)
 * @param errorMessage - Meta error message (`error_user_msg` or `message`)
 * @param objective    - Current campaign objective (for context-aware routing)
 */
export function routeMetaError(
  errorCode: number | undefined,
  errorSubcode: number | undefined,
  errorMessage: string,
  objective: string
): ErrorRoute {
  // ── Subcode-based routing (most specific) ──

  // 1815857: Missing bid_amount or bid_strategy
  if (errorCode === 100 && errorSubcode === 1815857) {
    return {
      step: 2,
      field: 'bidAmount',
      message: 'Bu kampanya tipi için teklif stratejisi ve teklif tutarı zorunludur. Lütfen teklif stratejisi seçip teklif tutarı girin.',
      action: 'show_field',
    }
  }

  // 1870227: targeting_automation (advantage_audience) missing
  if (errorSubcode === 1870227) {
    return {
      step: 2,
      field: 'targeting',
      message: 'Hedef kitle ayarlarını kontrol edin. Advantage Audience seçimi zorunludur.',
      action: 'show_field',
    }
  }

  // 1885272: Minimum budget violation
  if (errorSubcode === 1885272) {
    return {
      step: 2,
      field: 'budget',
      message: 'Bütçe minimum tutarın altında. Lütfen bütçeyi artırın.',
      action: 'focus_input',
    }
  }

  // 1815089: Lead Terms not accepted
  if (errorSubcode === 1815089) {
    return {
      step: 2,
      field: 'page',
      message: 'Bu sayfa için Potansiyel Müşteri (Lead) reklam koşulları kabul edilmemiş. Lütfen Meta Business Suite\'ten koşulları kabul edin.',
      action: 'show_link',
      linkUrl: 'https://www.facebook.com/ads/leadgen/tos',
    }
  }

  // ── Code-based routing ──

  // Temporary failure → retry
  if (errorCode === 2) {
    return {
      step: 2,
      message: 'Geçici bir hata oluştu. Lütfen birkaç saniye bekleyip tekrar deneyin.',
      action: 'retry',
      retryable: true,
    }
  }

  // Rate limiting
  if (errorCode === 429 || errorCode === 32) {
    return {
      step: 2,
      message: 'Çok fazla istek gönderildi. Lütfen birkaç dakika bekleyip tekrar deneyin.',
      action: 'retry',
      retryable: true,
    }
  }

  // Token invalid
  if (errorCode === 190 || errorCode === 102 || errorCode === 104) {
    return {
      step: 1,
      message: 'Meta oturumunuz sonlanmış. Lütfen tekrar bağlanın.',
    }
  }

  // ── Message-based heuristics ──

  const msgLower = (errorMessage || '').toLowerCase()

  // promoted_object / leadgen_form_id (Leads Instant Forms)
  if (/leadgen_form_id|leadgen form|lead form|potansiyel müşteri formu/i.test(msgLower)) {
    return {
      step: 2,
      field: 'lead_form',
      message: errorMessage || 'Potansiyel müşteri formu seçilmeli.',
      action: 'show_field',
    }
  }

  // pixel_id / custom_event_type (Sales/Leads/Engagement + Website)
  if (/pixel_id|pixel id|custom_event_type|conversion event|dönüşüm olayı/i.test(msgLower)) {
    return {
      step: 2,
      field: /pixel/i.test(msgLower) ? 'pixel_id' : 'conversion_event',
      message: errorMessage || 'Pixel ve dönüşüm olayı seçilmeli.',
      action: 'show_field',
    }
  }

  // object_story_spec / call_to_action (Ad creative CTA)
  if (/object_story_spec|call_to_action|call to action|cta|button/i.test(msgLower)) {
    return {
      step: 3,
      field: 'callToAction',
      message: errorMessage || 'Reklam çağrı aksiyonu (CTA) ile ilgili bir hata oluştu.',
      action: 'show_field',
    }
  }

  // Budget-related
  if (/bütçe|budget|minimum/i.test(msgLower)) {
    return {
      step: 2,
      field: 'budget',
      message: errorMessage || 'Bütçe ile ilgili bir hata oluştu.',
      action: 'focus_input',
    }
  }

  // URL-related
  if (/url|link|website/i.test(msgLower)) {
    return {
      step: 3,
      field: 'websiteUrl',
      message: errorMessage || 'URL ile ilgili bir hata oluştu.',
      action: 'focus_input',
    }
  }

  // Creative-related
  if (/creative|image|video|media/i.test(msgLower)) {
    return {
      step: 3,
      field: 'media',
      message: errorMessage || 'Reklam görseli/videosu ile ilgili bir hata oluştu.',
    }
  }

  // Targeting-related
  if (/targeting|audience|hedef/i.test(msgLower)) {
    return {
      step: 2,
      field: 'targeting',
      message: errorMessage || 'Hedef kitle ile ilgili bir hata oluştu.',
    }
  }

  // ── Fallback: AdSet step with raw message ──
  return {
    step: 2,
    message: errorMessage || 'Bilinmeyen bir hata oluştu. Lütfen ayarlarınızı kontrol edin.',
  }
}
