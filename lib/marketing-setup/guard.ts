import 'server-only'
import { getCurrentUser } from '@/lib/billing/user'
import { isMarketingSetupVisible } from './visibility'

/**
 * Marketing Kurulumu aksiyon route'ları için ortak erişim guard'ı.
 *
 * Görünürlük gate'i (flag açık VEYA owner) eskiden YALNIZ sayfa/visibility
 * katmanındaydı; aksiyon API'leri sadece auth kontrol ediyordu → owner olmayan +
 * flag kapalı bir kullanıcı doğrudan API çağırıp gerçek tarama/kurulum tetikleyebiliyordu.
 * CLAUDE.md: "Backend guard ayrıca korunur — modal sadece UX katmanı." Bu helper o
 * kuralı tüm marketing-setup write/read route'larına taşır. Owner bypass'ı korunur.
 */
export type MarketingSetupAccess =
  | { ok: true; user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>> }
  | { ok: false; status: 401 | 403; error: string }

export async function checkMarketingSetupAccess(): Promise<MarketingSetupAccess> {
  const user = await getCurrentUser()
  if (!user) return { ok: false, status: 401, error: 'unauthorized' }
  if (!(await isMarketingSetupVisible())) return { ok: false, status: 403, error: 'not_available' }
  return { ok: true, user }
}
