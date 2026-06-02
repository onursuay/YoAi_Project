import { supabase } from '@/lib/supabase/client'

export const dynamic = 'force-dynamic'

const FALLBACK = process.env.NEXT_PUBLIC_APP_URL || 'https://yoai.yodijital.com'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const campaignId = url.searchParams.get('c')
  const email = url.searchParams.get('e')
  const queueItemId = url.searchParams.get('q')
  const targetUrl = url.searchParams.get('url')

  // Geçersiz veya tehlikeli hedef URL'leri reddet
  const isSafeUrl = targetUrl && /^https?:\/\//i.test(targetUrl)
  const destination = isSafeUrl ? targetUrl : FALLBACK

  if (supabase && isSafeUrl) {
    try {
      let sendId: string | null = null
      let userId: string | null = null

      if (campaignId && email) {
        const { data: send } = await supabase
          .from('email_sends')
          .select('id, user_id')
          .eq('campaign_id', campaignId)
          .eq('email', email)
          .maybeSingle()
        sendId = send?.id ?? null
        userId = send?.user_id ?? null
      } else if (queueItemId) {
        const { data: qi } = await supabase
          .from('email_drip_queue')
          .select('email_send_id, user_id')
          .eq('id', queueItemId)
          .maybeSingle()
        sendId = qi?.email_send_id ?? null
        userId = qi?.user_id ?? null
      }

      if (sendId && userId) {
        await supabase.from('email_events').insert({
          send_id: sendId,
          user_id: userId,
          type: 'clicked',
          at: new Date().toISOString(),
          meta: { url: targetUrl },
        })
      }
    } catch {
      // sessiz — click tracking hatası kullanıcıyı etkilemez
    }
  }

  return Response.redirect(destination, 302)
}
