import type { SubscriptionPlan, CreditPackage } from './types'

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'basic',
    name: 'Basic',
    monthlyPrice: 34.30,
    yearlyPrice: 411.60,
    features: [
      'Meta Reklamları',
      'Meta Hedef Kitle (AI)',
      'Google Reklamları',
      'Meta Raporları',
      'Google Raporları',
      'Tasarım',
    ],
    adAccountLimit: 2,
    includesOptimization: false,
    aiScanDailyLimit: 3,
    strategyMonthlyLimit: 1,  // Aylık 1 AI strateji (sonrası kredi)
    trialDays: 14,
  },
  {
    id: 'starter',
    name: 'Starter',
    monthlyPrice: 69.30,
    yearlyPrice: 831.60,
    features: [
      'Optimizasyon',
      'AI Strateji (3/ay)',
      'Meta Reklamları',
      'Meta Hedef Kitle (AI)',
      'Google Reklamları',
      'Meta Raporları',
      'Google Raporları',
      'Tasarım',
    ],
    adAccountLimit: 2,
    includesOptimization: true,
    aiScanDailyLimit: 3,
    strategyMonthlyLimit: 3,  // Aylık 3 AI strateji (sonrası kredi)
    trialDays: 14,
  },
  {
    id: 'premium',
    name: 'Premium',
    monthlyPrice: 139.30,
    yearlyPrice: 1671.60,
    features: [
      'AI Strateji (10/ay)',
      'Optimizasyon',
      'Meta Reklamları',
      'Google Reklamları',
      'Meta Raporları',
      'Google Raporları',
      'Tasarım',
    ],
    adAccountLimit: 2,
    includesOptimization: true,
    aiScanDailyLimit: 10,
    strategyMonthlyLimit: 10, // Aylık 10 AI strateji (sonrası kredi)
    trialDays: 14,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    monthlyPrice: 0, // Custom pricing
    yearlyPrice: 0,
    features: [
      'AI Strateji (Sınırsız)',
      'Optimizasyon',
      'Meta Reklamları',
      'Google Reklamları',
      'Meta Raporları',
      'Google Raporları',
      'Tasarım',
    ],
    adAccountLimit: 6,
    includesOptimization: true,
    aiScanDailyLimit: -1, // unlimited
    strategyMonthlyLimit: -1, // unlimited
    trialDays: 14,
  },
]

export const CREDIT_PACKAGES: CreditPackage[] = [
  { id: 'pkg-100', credits: 100, price: 49, label: '100 Kredi' },
  { id: 'pkg-500', credits: 500, price: 199, label: '500 Kredi', popular: true },
  { id: 'pkg-1000', credits: 1000, price: 349, label: '1.000 Kredi' },
]
