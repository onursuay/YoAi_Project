import type { DisplayAssetKind } from '../../shared/WizardTypes'

/** Google Ads Responsive Display Ad image specs — resmi min/ratio kuralları */
export interface ImageSpec {
  kind: DisplayAssetKind
  /** Oran: width / height */
  ratio: number
  /** Tolerans (±) */
  tolerance: number
  minWidth: number
  minHeight: number
  recommendedWidth: number
  recommendedHeight: number
  maxWidth: number
  maxHeight: number
}

export const IMAGE_SPECS: Record<Exclude<DisplayAssetKind, 'YOUTUBE_VIDEO'>, ImageSpec> = {
  MARKETING_IMAGE: {
    kind: 'MARKETING_IMAGE',
    ratio: 1.91,
    tolerance: 0.04,
    minWidth: 600,
    minHeight: 314,
    recommendedWidth: 1200,
    recommendedHeight: 628,
    maxWidth: 5120,
    maxHeight: 5120,
  },
  SQUARE_MARKETING_IMAGE: {
    kind: 'SQUARE_MARKETING_IMAGE',
    ratio: 1.0,
    tolerance: 0.02,
    minWidth: 300,
    minHeight: 300,
    recommendedWidth: 1200,
    recommendedHeight: 1200,
    maxWidth: 5120,
    maxHeight: 5120,
  },
  PORTRAIT_MARKETING_IMAGE: {
    kind: 'PORTRAIT_MARKETING_IMAGE',
    ratio: 4 / 5,
    tolerance: 0.04,
    minWidth: 480,
    minHeight: 600,
    recommendedWidth: 960,
    recommendedHeight: 1200,
    maxWidth: 5120,
    maxHeight: 5120,
  },
  LOGO: {
    kind: 'LOGO',
    ratio: 4.0,
    tolerance: 0.04,
    minWidth: 512,
    minHeight: 128,
    recommendedWidth: 1200,
    recommendedHeight: 300,
    maxWidth: 5120,
    maxHeight: 1200,
  },
  SQUARE_LOGO: {
    kind: 'SQUARE_LOGO',
    ratio: 1.0,
    tolerance: 0.02,
    minWidth: 128,
    minHeight: 128,
    recommendedWidth: 1200,
    recommendedHeight: 1200,
    maxWidth: 5120,
    maxHeight: 5120,
  },
}

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024

export interface ValidationOk { ok: true }
export interface ValidationFail { ok: false; code: string }
export type ValidationResult = ValidationOk | ValidationFail

export function validateImageForKind(
  width: number,
  height: number,
  bytes: number,
  kind: Exclude<DisplayAssetKind, 'YOUTUBE_VIDEO'>
): ValidationResult {
  if (bytes > MAX_IMAGE_BYTES) return { ok: false, code: 'tooLarge' }
  const spec = IMAGE_SPECS[kind]
  if (width < spec.minWidth || height < spec.minHeight) return { ok: false, code: 'tooSmall' }
  if (width > spec.maxWidth || height > spec.maxHeight) return { ok: false, code: 'tooBig' }
  const actualRatio = width / height
  const diff = Math.abs(actualRatio - spec.ratio) / spec.ratio
  if (diff > spec.tolerance) return { ok: false, code: 'wrongRatio' }
  return { ok: true }
}

/** Auto-detect the best matching kind from width/height. null = uyumsuz */
export function detectBestKind(width: number, height: number): Exclude<DisplayAssetKind, 'YOUTUBE_VIDEO'> | null {
  const ratio = width / height
  const candidates: Array<Exclude<DisplayAssetKind, 'YOUTUBE_VIDEO'>> = [
    'MARKETING_IMAGE',
    'SQUARE_MARKETING_IMAGE',
    'PORTRAIT_MARKETING_IMAGE',
    'LOGO',
    'SQUARE_LOGO',
  ]
  let best: Exclude<DisplayAssetKind, 'YOUTUBE_VIDEO'> | null = null
  let bestDiff = Infinity
  for (const kind of candidates) {
    const spec = IMAGE_SPECS[kind]
    const diff = Math.abs(ratio - spec.ratio) / spec.ratio
    if (diff <= spec.tolerance && width >= spec.minWidth && height >= spec.minHeight) {
      if (diff < bestDiff) {
        bestDiff = diff
        best = kind
      }
    }
  }
  return best
}

/** File → {width, height} via Image element */
export function readImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve({ width: img.naturalWidth, height: img.naturalHeight })
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('readImageDimensions failed'))
    }
    img.src = url
  })
}
