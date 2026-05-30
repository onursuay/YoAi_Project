'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { X, Loader2, Mail, Phone, User, Megaphone, Clock } from 'lucide-react'

interface FieldEntry { name?: string; values?: string[] }
interface LeadDetail {
  id: string
  fullName: string | null
  email: string | null
  phone: string | null
  campaignName: string | null
  formName: string | null
  status: string
  note: string | null
  fieldData: FieldEntry[]
  createdAt: string
  leadCreatedTime: string | null
}

export default function CrmLeadDetailModal({ leadId, onClose }: { leadId: string; onClose: () => void }) {
  const t = useTranslations('crm')
  const [lead, setLead] = useState<LeadDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    fetch(`/api/crm/leads/${leadId}`)
      .then((r) => r.json())
      .then((d) => { if (active && d.ok) setLead(d.lead) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [leadId])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const fmtDate = (iso: string | null) => {
    if (!iso) return '—'
    try {
      return new Date(iso).toLocaleString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    } catch {
      return iso
    }
  }

  // Standart alanlar dışında kalan ham form alanları (tekrar göstermemek için filtrele)
  const STANDARD = new Set(['full_name', 'name', 'first_name', 'last_name', 'email', 'phone_number', 'phone'])
  const extraFields = (lead?.fieldData ?? []).filter((f) => !STANDARD.has((f.name ?? '').toLowerCase()))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white">
          <h2 className="text-base font-semibold text-gray-900">{t('detail.title')}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : !lead ? (
          <div className="py-16 text-center text-sm text-gray-500">{t('detail.notFound')}</div>
        ) : (
          <div className="p-6 space-y-5">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{lead.fullName || t('list.noName')}</h3>
            </div>

            <div className="space-y-3">
              <Row icon={<User className="w-4 h-4" />} label={t('detail.name')} value={lead.fullName} />
              <Row icon={<Mail className="w-4 h-4" />} label={t('detail.email')} value={lead.email} copyable />
              <Row icon={<Phone className="w-4 h-4" />} label={t('detail.phone')} value={lead.phone} copyable />
              <Row icon={<Megaphone className="w-4 h-4" />} label={t('detail.campaign')} value={lead.campaignName} />
              <Row icon={<Clock className="w-4 h-4" />} label={t('detail.receivedAt')} value={fmtDate(lead.leadCreatedTime || lead.createdAt)} />
            </div>

            {extraFields.length > 0 && (
              <div className="border-t border-gray-100 pt-4">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">{t('detail.formData')}</p>
                <div className="space-y-3">
                  {extraFields.map((f, i) => (
                    <div key={i}>
                      <p className="text-xs text-gray-500">{f.name}</p>
                      <p className="text-sm text-gray-800">{(f.values ?? []).join(', ') || '—'}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function Row({ icon, label, value, copyable }: { icon: React.ReactNode; label: string; value: string | null; copyable?: boolean }) {
  if (!value) return null
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-gray-400 shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500">{label}</p>
        {copyable ? (
          <a
            href={label.toLowerCase().includes('mail') ? `mailto:${value}` : `tel:${value}`}
            className="text-sm text-primary hover:underline break-all"
          >
            {value}
          </a>
        ) : (
          <p className="text-sm text-gray-800 break-words">{value}</p>
        )}
      </div>
    </div>
  )
}
