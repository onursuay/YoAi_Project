/**
 * Gözetim Merkezi keşif endpoint'i.
 *
 * İstemci yan tarafa yalnızca `{ ok: true, hasAccess: boolean }` döner.
 * Yetki yoksa hiçbir admin/gözetim ipucu sızdırılmaz; cevap herkes için
 * 200 olur. Bu sayede sidebar item yalnızca yetkili oturumda eklenebilir
 * ve normal kullanıcı admin alanının varlığını fark etmez.
 */
import { NextResponse } from 'next/server'
import { getIsCurrentUserSuperAdmin } from '@/lib/admin/superAdmin'

export const dynamic = 'force-dynamic'

export async function GET() {
  const hasAccess = await getIsCurrentUserSuperAdmin()
  return NextResponse.json({ ok: true, hasAccess })
}
