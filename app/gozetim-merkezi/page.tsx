/**
 * Gözetim Merkezi sayfası — server component.
 *
 * Yetki kontrolü:
 *   - Oturum e-postası allowlist'inde değilse `redirect('/dashboard')`
 *     ile sessizce yönlendirilir.
 *   - Hata ekranı gösterilmez; bu alanın varlığı normal kullanıcıya
 *     ipucu vermez.
 */
import { redirect } from 'next/navigation'
import { getIsCurrentUserSuperAdmin } from '@/lib/admin/superAdmin'
import GozetimMerkeziClient from './GozetimMerkeziClient'

export const dynamic = 'force-dynamic'

export default async function GozetimMerkeziPage() {
  const hasAccess = await getIsCurrentUserSuperAdmin()
  if (!hasAccess) {
    redirect('/dashboard')
  }
  return <GozetimMerkeziClient />
}
