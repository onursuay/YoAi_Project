import { NextResponse } from 'next/server'
import { resolveMetaContext } from '@/lib/meta/context'
// MetaContext already provides a .client instance
import { supabase } from '@/lib/supabase/client'

export const dynamic = 'force-dynamic'

interface Notification {
  id: string
  icon: string
  text: string
  textEn: string
  color: string
}

export async function GET() {
  const notifications: Notification[] = []

  // 1. Meta Ads — real performance data
  try {
    const ctx = await resolveMetaContext()
    if (ctx) {
      const client = ctx.client

      // Last 7 days vs previous 7 days
      const now = new Date()
      const weekAgo = new Date(now.getTime() - 7 * 86400000)
      const twoWeeksAgo = new Date(now.getTime() - 14 * 86400000)
      const fmt = (d: Date) => d.toISOString().split('T')[0]

      const [current, previous] = await Promise.all([
        client.get(`/${ctx.accountId}/insights`, {
          fields: 'spend,impressions,clicks,ctr,cpc,reach,frequency,actions',
          time_range: JSON.stringify({ since: fmt(weekAgo), until: fmt(now) }),
        }),
        client.get(`/${ctx.accountId}/insights`, {
          fields: 'spend,impressions,clicks,ctr,cpc,reach,frequency',
          time_range: JSON.stringify({ since: fmt(twoWeeksAgo), until: fmt(weekAgo) }),
        }),
      ])

      if (current.ok && current.data?.data?.[0]) {
        const c = current.data.data[0]
        const p = previous.ok ? previous.data?.data?.[0] : null

        const spend = parseFloat(c.spend || '0')
        const impressions = parseInt(c.impressions || '0')
        const clicks = parseInt(c.clicks || '0')
        const ctr = parseFloat(c.ctr || '0')
        const frequency = parseFloat(c.frequency || '0')
        const reach = parseInt(c.reach || '0')

        // Spend notification
        if (spend > 0) {
          const prevSpend = p ? parseFloat(p.spend || '0') : 0
          if (prevSpend > 0) {
            const change = ((spend - prevSpend) / prevSpend * 100).toFixed(0)
            const up = spend > prevSpend
            notifications.push({
              id: 'meta-spend',
              icon: 'TrendingUp',
              text: up
                ? `Haftalık harcama %${change} arttı — ₺${spend.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}`
                : `Haftalık harcama %${Math.abs(Number(change))} azaldı — ₺${spend.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}`,
              textEn: up
                ? `Weekly spend increased ${change}% — ₺${spend.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
                : `Weekly spend decreased ${Math.abs(Number(change))}% — ₺${spend.toLocaleString('en-US', { maximumFractionDigits: 0 })}`,
              color: up ? 'text-amber-500' : 'text-emerald-500',
            })
          }
        }

        // CTR notification
        if (ctr > 0) {
          const prevCtr = p ? parseFloat(p.ctr || '0') : 0
          if (prevCtr > 0) {
            const ctrChange = ((ctr - prevCtr) / prevCtr * 100).toFixed(0)
            if (Math.abs(Number(ctrChange)) > 10) {
              const up = ctr > prevCtr
              notifications.push({
                id: 'meta-ctr',
                icon: 'BarChart3',
                text: up
                  ? `CTR oranı %${ctrChange} yükseldi — şu an %${ctr.toFixed(2)}`
                  : `CTR oranı %${Math.abs(Number(ctrChange))} düştü — şu an %${ctr.toFixed(2)}`,
                textEn: up
                  ? `CTR increased ${ctrChange}% — now at ${ctr.toFixed(2)}%`
                  : `CTR decreased ${Math.abs(Number(ctrChange))}% — now at ${ctr.toFixed(2)}%`,
                color: up ? 'text-emerald-500' : 'text-red-500',
              })
            }
          }
        }

        // Frequency warning
        if (frequency > 4) {
          notifications.push({
            id: 'meta-frequency',
            icon: 'AlertTriangle',
            text: `Frekans ${frequency.toFixed(1)}'e ulaştı — hedef kitle yorgunluğu riski`,
            textEn: `Frequency reached ${frequency.toFixed(1)} — audience fatigue risk`,
            color: 'text-orange-500',
          })
        }

        // Reach milestone
        if (reach > 10000) {
          notifications.push({
            id: 'meta-reach',
            icon: 'Target',
            text: `Bu hafta ${(reach / 1000).toFixed(1)}K kişiye ulaştınız`,
            textEn: `Reached ${(reach / 1000).toFixed(1)}K people this week`,
            color: 'text-blue-500',
          })
        }

        // Clicks milestone
        if (clicks > 1000) {
          notifications.push({
            id: 'meta-clicks',
            icon: 'TrendingUp',
            text: `Bu hafta ${clicks.toLocaleString('tr-TR')} tıklama alındı`,
            textEn: `${clicks.toLocaleString('en-US')} clicks received this week`,
            color: 'text-emerald-500',
          })
        }

        // Leads from actions
        const leads = c.actions?.find((a: { action_type: string; value: string }) => a.action_type === 'lead')
        if (leads) {
          notifications.push({
            id: 'meta-leads',
            icon: 'Target',
            text: `Bu hafta ${leads.value} yeni potansiyel müşteri geldi`,
            textEn: `${leads.value} new leads received this week`,
            color: 'text-purple-500',
          })
        }
      }
    }
  } catch { /* Meta not connected or API error — skip silently */ }

  // 2. Strategy instances — real status from Supabase
  try {
    const ctx2 = await resolveMetaContext()
    if (supabase && ctx2) {
      const { data: failed } = await supabase
        .from('strategy_instances')
        .select('id, title, status')
        .eq('ad_account_id', ctx2.accountId)
        .eq('status', 'FAILED')
        .limit(3)

      if (failed && failed.length > 0) {
        notifications.push({
          id: 'strategy-failed',
          icon: 'AlertTriangle',
          text: `${failed.length} strateji başarısız oldu — tekrar deneyin`,
          textEn: `${failed.length} strategy failed — retry needed`,
          color: 'text-red-500',
        })
      }

      const { data: ready } = await supabase
        .from('strategy_instances')
        .select('id, title')
        .eq('ad_account_id', ctx2.accountId)
        .eq('status', 'READY_FOR_REVIEW')
        .limit(3)

      if (ready && ready.length > 0) {
        notifications.push({
          id: 'strategy-ready',
          icon: 'Lightbulb',
          text: `${ready.length} strateji planı incelemeye hazır`,
          textEn: `${ready.length} strategy plan ready for review`,
          color: 'text-emerald-500',
        })
      }

      const { data: running } = await supabase
        .from('strategy_instances')
        .select('id, title')
        .eq('ad_account_id', ctx2.accountId)
        .eq('status', 'RUNNING')
        .limit(5)

      if (running && running.length > 0) {
        notifications.push({
          id: 'strategy-running',
          icon: 'Zap',
          text: `${running.length} aktif strateji çalışıyor`,
          textEn: `${running.length} active strategies running`,
          color: 'text-blue-500',
        })
      }
    }
  } catch { /* Supabase error — skip */ }

  // If no real notifications, return a welcome message
  if (notifications.length === 0) {
    notifications.push({
      id: 'welcome',
      icon: 'Lightbulb',
      text: 'Hoş geldiniz! Kampanyalarınızı bağlayarak gerçek zamanlı bildirimleri aktifleştirin.',
      textEn: 'Welcome! Connect your campaigns to activate real-time notifications.',
      color: 'text-emerald-500',
    })
  }

  return NextResponse.json({ ok: true, notifications })
}
