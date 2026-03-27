import type { InstanceStatus } from './types'

// Durum -> Aşama mapping
export const STATUS_PHASE_MAP: Record<InstanceStatus, 1 | 2 | 3> = {
  DRAFT: 1,
  COLLECTING: 1,
  ANALYZING: 2,
  GENERATING_PLAN: 2,
  READY_FOR_REVIEW: 2,
  APPLYING: 3,
  RUNNING: 3,
  NEEDS_ACTION: 3,
  FAILED: 3,
}

// Durum etiketleri (TR)
export const STATUS_LABELS: Record<InstanceStatus, string> = {
  DRAFT: 'Taslak',
  COLLECTING: 'Veri toplanıyor',
  ANALYZING: 'Analiz ediliyor',
  GENERATING_PLAN: 'Plan oluşturuluyor',
  READY_FOR_REVIEW: 'İncelemeye hazır',
  APPLYING: 'Uygulanıyor',
  RUNNING: 'Çalışıyor',
  NEEDS_ACTION: 'Aksiyon gerekli',
  FAILED: 'Hata oluştu',
}

// Durum renkleri (Tailwind class'ları)
export const STATUS_COLORS: Record<InstanceStatus, { bg: string; text: string; dot: string }> = {
  DRAFT: { bg: 'bg-gray-100', text: 'text-gray-700', dot: 'bg-gray-400' },
  COLLECTING: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-400' },
  ANALYZING: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-400' },
  GENERATING_PLAN: { bg: 'bg-purple-50', text: 'text-purple-700', dot: 'bg-purple-400' },
  READY_FOR_REVIEW: { bg: 'bg-green-50', text: 'text-green-700', dot: 'bg-green-500' },
  APPLYING: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-400' },
  RUNNING: { bg: 'bg-green-50', text: 'text-green-700', dot: 'bg-green-500' },
  NEEDS_ACTION: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  FAILED: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
}

// Hedef tipleri — Meta kampanya hedefleriyle birebir eşleşir
export const GOAL_TYPES = [
  { value: 'awareness', label: { tr: 'Bilinirlik', en: 'Awareness' }, description: { tr: 'Marka bilinirliği ve erişim', en: 'Brand awareness and reach' } },
  { value: 'traffic', label: { tr: 'Trafik', en: 'Traffic' }, description: { tr: 'Web sitesi veya uygulama trafiği', en: 'Website or app traffic' } },
  { value: 'engagement', label: { tr: 'Etkileşim', en: 'Engagement' }, description: { tr: 'Beğeni, yorum, paylaşım ve mesaj', en: 'Likes, comments, shares and messages' } },
  { value: 'leads', label: { tr: 'Potansiyel Müşteriler', en: 'Leads' }, description: { tr: 'Form, mesaj veya arama ile lead toplama', en: 'Collect leads via forms, messages or calls' } },
  { value: 'app', label: { tr: 'Uygulama Tanıtımı', en: 'App Promotion' }, description: { tr: 'Uygulama yükleme ve uygulama içi etkinlik', en: 'App installs and in-app activity' } },
  { value: 'sales', label: { tr: 'Satışlar', en: 'Sales' }, description: { tr: 'E-ticaret satışı ve dönüşüm', en: 'E-commerce sales and conversions' } },
] as const

// Sektörler
export const INDUSTRIES = [
  'E-Ticaret',
  'SaaS / Yazılım',
  'Eğitim',
  'Sağlık',
  'Finans',
  'Gayrimenkul',
  'Restoran / Yeme-İçme',
  'Moda / Giyim',
  'Otomotiv',
  'Turizm / Otelcilik',
  'Spor / Fitness',
  'Güzellik / Kozmetik',
  'Hukuk',
  'Danışmanlık',
  'Diğer',
] as const

// Zaman ufukları
export const TIME_HORIZONS = [
  { value: 7, label: '7 gün' },
  { value: 14, label: '14 gün' },
  { value: 30, label: '30 gün' },
  { value: 90, label: '90 gün' },
] as const

// Coğrafyalar
export const GEOGRAPHIES = [
  'Türkiye',
  'ABD',
  'Avrupa',
  'İngiltere',
  'Almanya',
  'Fransa',
  'Hollanda',
  'BAE',
  'Suudi Arabistan',
  'Küresel',
] as const

// Task kategorileri
export const TASK_CATEGORIES = [
  { value: 'setup', label: 'Kurulum' },
  { value: 'creative', label: 'Kreatif' },
  { value: 'audience', label: 'Hedef Kitle' },
  { value: 'campaign', label: 'Kampanya' },
  { value: 'measurement', label: 'Ölçümleme' },
  { value: 'optimization', label: 'Optimizasyon' },
] as const

// Periyodik metrik çekme aralığı (gün)
export const METRICS_PULL_INTERVAL_DAYS = 7

// Polling interval (ms)
export const POLL_INTERVAL = 3000

// Job runner concurrency limit
export const JOB_CONCURRENCY = 3

// Minimum günlük bütçe (TRY) — 1 USD fallback
export const MIN_DAILY_BUDGET_TRY = 35
export const USD_TRY_FALLBACK = 35
