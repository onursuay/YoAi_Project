import { supabase } from '@/lib/supabase/client'

export const dynamic = 'force-dynamic'

// 1x1 transparent GIF
const PIXEL = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64')

export async function GET(req: Request) {
  const url = new URL(req.url)
  const campaignId = url.searchParams.get('c')
  const email = url.searchParams.get('e')

  if (campaignId && email && supabase) {
    try {
      const { data: send } = await supabase
        .from('email_sends')
        .select('id, user_id')
        .eq('campaign_id', campaignId)
        .eq('email', email)
        .maybeSingle()

      if (send) {
        await supabase.from('email_events').insert({
          send_id: send.id,
          user_id: send.user_id,
          type: 'opened',
          at: new Date().toISOString(),
        })
      }
    } catch {
      // sessiz — tracking hatası mail akışını bozmamalı
    }
  }

  return new Response(PIXEL, {
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache',
    },
  })
}
