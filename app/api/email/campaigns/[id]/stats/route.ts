import { NextResponse } from 'next/server'
import { checkEmailAccess } from '@/lib/email/guard'
import { getCampaign } from '@/lib/email/campaignStore'
import { supabase } from '@/lib/supabase/client'

export const dynamic = 'force-dynamic'

export async function GET(_r: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await checkEmailAccess()
  if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: access.status })

  const { id } = await params
  const campaign = await getCampaign(id, access.user.id)
  if (!campaign) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })

  if (!supabase) return NextResponse.json({ ok: false, error: 'db_unavailable' }, { status: 503 })

  // Tüm send kayıtları
  const { data: sends } = await supabase
    .from('email_sends')
    .select('id, email, sent_at, status')
    .eq('campaign_id', id)
    .order('sent_at', { ascending: true })

  const sendList = sends ?? []
  const sendIds = sendList.map((s: { id: string }) => s.id)

  // Tüm event kayıtları
  const { data: events } = sendIds.length
    ? await supabase.from('email_events').select('send_id, type, at').in('send_id', sendIds)
    : { data: [] }

  const eventList = events ?? []

  // Set bazlı tekilleştirme (unique opens/clicks)
  const openedSendIds = new Set<string>()
  const clickedSendIds = new Set<string>()
  const bouncedSendIds = new Set<string>()
  const deliveredSendIds = new Set<string>()

  for (const e of eventList as { send_id: string; type: string; at: string }[]) {
    if (e.type === 'opened') openedSendIds.add(e.send_id)
    if (e.type === 'clicked') clickedSendIds.add(e.send_id)
    if (e.type === 'bounced') bouncedSendIds.add(e.send_id)
    if (e.type === 'delivered') deliveredSendIds.add(e.send_id)
  }

  const total = sendList.length
  const sentCount = sendList.filter((s: { status: string }) => s.status !== 'failed').length
  const opens = openedSendIds.size
  const clicks = clickedSendIds.size
  const bounced = bouncedSendIds.size
  const delivered = deliveredSendIds.size

  // Saatlik açılma dağılımı (grafik için)
  const hourlyMap: Record<string, number> = {}
  for (const e of eventList as { send_id: string; type: string; at: string }[]) {
    if (e.type !== 'opened') continue
    const d = new Date(e.at)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:00`
    hourlyMap[key] = (hourlyMap[key] ?? 0) + 1
  }
  const hourlyOpens = Object.entries(hourlyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, count]) => ({ label: label.slice(11), count })) // "14:00" formatı

  // Alıcı bazlı liste
  const sendIdToEvents: Record<string, { opened: boolean; clicked: boolean; bounced: boolean }> = {}
  for (const s of sendList as { id: string }[]) {
    sendIdToEvents[s.id] = {
      opened: openedSendIds.has(s.id),
      clicked: clickedSendIds.has(s.id),
      bounced: bouncedSendIds.has(s.id),
    }
  }

  const recipientRows = sendList.map((s: { id: string; email: string; sent_at: string | null; status: string }) => ({
    email: s.email,
    sentAt: s.sent_at,
    status: s.status,
    opened: sendIdToEvents[s.id]?.opened ?? false,
    clicked: sendIdToEvents[s.id]?.clicked ?? false,
    bounced: sendIdToEvents[s.id]?.bounced ?? false,
  }))

  return NextResponse.json({
    ok: true,
    campaign: {
      id: campaign.id,
      name: campaign.name,
      subject: campaign.subject,
      status: campaign.status,
      sentAt: campaign.sent_at,
      stats: campaign.stats,
    },
    summary: { total, sent: sentCount, opens, clicks, bounced, delivered },
    hourlyOpens,
    recipients: recipientRows,
  })
}
