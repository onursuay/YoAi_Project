/**
 * Optimizasyon — sunucu-otoriter günlük AI scan kotası.
 *
 * Yalnızca optimization API route'larından çağrılır (server-only). Günlük
 * ücretsiz kotayı atomik `consume_ai_scan` RPC ile tüketir; kota dolunca
 * overage kredi düşer. Client-side localStorage sayacının yerini alan
 * otoriter kapı budur.
 */

import 'server-only'
import { supabase } from '@/lib/supabase/client'

export interface ConsumeAiScanResult {
  allowed: boolean
  used: number
  source: 'free' | 'credit' | 'unlimited' | 'insufficient_credit' | 'unknown'
  balance: number
}

/**
 * Bir AI scan'i kotaya işler.
 * @param userId       signups.id (uuid)
 * @param dailyLimit   plan günlük ücretsiz kota (-1 = sınırsız)
 * @param overageCost  kota aşımında düşülecek kredi
 * @returns allowed=false → kota dolu + yeterli kredi yok (çağıran 402 dönmeli)
 */
export async function consumeAiScan(
  userId: string,
  dailyLimit: number,
  overageCost: number,
): Promise<ConsumeAiScanResult> {
  if (!supabase) {
    // DB yoksa kapıyı kapat — sessizce bedava AI çağrısı yaptırma.
    return { allowed: false, used: 0, source: 'unknown', balance: 0 }
  }

  const { data, error } = await supabase.rpc('consume_ai_scan', {
    p_user_id: userId,
    p_daily_limit: dailyLimit,
    p_overage_cost: overageCost,
  })

  if (error) {
    console.error('[aiScanUsage] consume_ai_scan RPC hatası:', error.message)
    // Migration uygulanmadıysa burada düşer — güvenli taraf: izin verme.
    return { allowed: false, used: 0, source: 'unknown', balance: 0 }
  }

  const row = (Array.isArray(data) ? data[0] : data) as
    | { allowed?: boolean; used?: number; source?: string; balance?: number | null }
    | undefined

  return {
    allowed: Boolean(row?.allowed),
    used: row?.used ?? 0,
    source: (row?.source as ConsumeAiScanResult['source']) ?? 'unknown',
    balance: row?.balance ?? 0,
  }
}
