import { NextResponse } from 'next/server'
import { SECTOR_CATALOG } from '@/lib/yoai/sectorCatalog'

export const dynamic = 'force-static'

export async function GET() {
  return NextResponse.json({ ok: true, data: SECTOR_CATALOG })
}
