'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import Topbar from '@/components/Topbar'
import { Eye, EyeOff, Copy, Check, Users, BadgePercent } from 'lucide-react'

interface ProfileData {
  firstName: string
  lastName: string
  email: string
  referralCode: string
}

const HELP_KEY = 'yoai-help-access'

export default function HesabimPage() {
  const t = useTranslations('account')

  // Profile state — sunucudan (signups) gelir, localStorage değil
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [helpAccessEnabled, setHelpAccessEnabled] = useState(false)
  const [profileSaved, setProfileSaved] = useState(false)
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileError, setProfileError] = useState('')

  // Password state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrentPw, setShowCurrentPw] = useState(false)
  const [showNewPw, setShowNewPw] = useState(false)
  const [showConfirmPw, setShowConfirmPw] = useState(false)
  const [pwSaving, setPwSaving] = useState(false)
  const [pwMessage, setPwMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Referral state
  const [codeCopied, setCodeCopied] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)

  // Hesap silme (KVKK)
  const [deleting, setDeleting] = useState(false)
  async function handleDeleteAccount() {
    if (!confirm(t('delete.confirm1'))) return
    const typed = window.prompt(t('delete.confirm2'))
    if ((typed ?? '').trim().toUpperCase() !== 'SİL' && (typed ?? '').trim().toUpperCase() !== 'DELETE') return
    setDeleting(true)
    try {
      const res = await fetch('/api/account/delete', { method: 'POST', credentials: 'include' })
      const data = await res.json().catch(() => null)
      if (data?.ok) {
        alert(t('delete.success'))
        window.location.href = '/'
      } else {
        alert(t('delete.error'))
      }
    } catch {
      alert(t('delete.error'))
    } finally {
      setDeleting(false)
    }
  }

  useEffect(() => {
    fetch('/api/account/profile', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data || data.error) return
        setProfile(data as ProfileData)
        setFirstName(data.firstName || '')
        setLastName(data.lastName || '')
      })
      .catch(() => { /* sessizce yok say */ })
    try {
      setHelpAccessEnabled(localStorage.getItem(HELP_KEY) === '1')
    } catch { /* ignore */ }
  }, [])

  if (!profile) {
    return (
      <>
        <Topbar title={t('title')} description={t('description')} />
        <div className="flex-1 flex items-center justify-center bg-gray-50">
          <p className="text-sm text-gray-400">{t('loading')}</p>
        </div>
      </>
    )
  }

  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || '?'
  const fullName = `${firstName} ${lastName}`.trim()
  const referralLink = `https://yoai.yodijital.com/?referralCode=${profile.referralCode}`

  const handleSaveProfile = async () => {
    setProfileSaving(true)
    setProfileError('')
    try {
      const res = await fetch('/api/account/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName, lastName }),
      })
      if (!res.ok) throw new Error('save_failed')
      try {
        localStorage.setItem(HELP_KEY, helpAccessEnabled ? '1' : '0')
      } catch { /* ignore */ }
      setProfileSaved(true)
      setTimeout(() => setProfileSaved(false), 2000)
    } catch {
      setProfileError(t('saveError'))
    } finally {
      setProfileSaving(false)
    }
  }

  const handleChangePassword = async () => {
    setPwMessage(null)
    if (newPassword !== confirmPassword) {
      setPwMessage({ type: 'error', text: t('passwordMismatch') })
      return
    }
    if (newPassword.length < 6) {
      setPwMessage({ type: 'error', text: t('passwordWeak') })
      return
    }
    setPwSaving(true)
    try {
      const res = await fetch('/api/account/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setPwMessage({ type: 'success', text: t('passwordChanged') })
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
      } else if (data?.error === 'wrong_password') {
        setPwMessage({ type: 'error', text: t('passwordWrong') })
      } else if (data?.error === 'weak_password') {
        setPwMessage({ type: 'error', text: t('passwordWeak') })
      } else {
        setPwMessage({ type: 'error', text: t('passwordError') })
      }
    } catch {
      setPwMessage({ type: 'error', text: t('passwordError') })
    } finally {
      setPwSaving(false)
    }
  }

  const handleCopy = (text: string, type: 'code' | 'link') => {
    navigator.clipboard.writeText(text)
    if (type === 'code') {
      setCodeCopied(true)
      setTimeout(() => setCodeCopied(false), 2000)
    } else {
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 2000)
    }
  }

  return (
    <>
      <Topbar title={t('title')} description={t('description')} />
      <div className="flex-1 overflow-y-auto bg-gray-50 px-8 py-8">
        <div className="mx-auto space-y-6" style={{ maxWidth: '1400px' }}>

          {/* Top row: Profile + Password */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Profile Card */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <h3 className="text-base font-bold text-gray-900 mb-5">{t('profileInfo')}</h3>

              {/* Avatar + identity (real, from account) */}
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold text-lg">
                  {initials}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{fullName || profile.email}</p>
                  <p className="text-sm text-gray-400 truncate">{profile.email}</p>
                </div>
              </div>

              {/* Name fields */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1.5">{t('firstName')}</label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={e => setFirstName(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1.5">{t('lastName')}</label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={e => setLastName(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
              </div>

              {/* Email — login anahtarı, salt-okunur */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-600 mb-1.5">{t('email')}</label>
                <input
                  type="email"
                  value={profile.email}
                  readOnly
                  className="w-full px-3 py-2.5 border border-gray-200 bg-gray-50 text-gray-500 rounded-lg text-sm cursor-not-allowed"
                />
              </div>

              {/* Help access toggle (yerel tercih) */}
              <div className="flex items-center justify-between mb-6">
                <label className="text-sm text-gray-700">{t('helpAccess')}</label>
                <button
                  onClick={() => setHelpAccessEnabled(!helpAccessEnabled)}
                  className={`relative w-10 h-5 rounded-full transition-colors ${
                    helpAccessEnabled ? 'bg-primary' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                      helpAccessEnabled ? 'translate-x-5' : ''
                    }`}
                  />
                </button>
              </div>

              {profileError && (
                <p className="text-sm text-red-600 mb-3">{profileError}</p>
              )}

              {/* Save button */}
              <button
                onClick={handleSaveProfile}
                disabled={profileSaving}
                className="w-full py-2.5 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 transition-colors text-sm disabled:opacity-60"
              >
                {profileSaved ? t('saved') : t('save')}
              </button>
            </div>

            {/* Password Card */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <div className="space-y-4">
                {/* Current password */}
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1.5">{t('passwordChange')}</label>
                  <div className="relative">
                    <input
                      type={showCurrentPw ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={e => setCurrentPassword(e.target.value)}
                      placeholder={t('currentPassword')}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary pr-10"
                    />
                    <button
                      onClick={() => setShowCurrentPw(!showCurrentPw)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                    >
                      {showCurrentPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* New password */}
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1.5">{t('newPassword')}</label>
                  <div className="relative">
                    <input
                      type={showNewPw ? 'text' : 'password'}
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder={t('newPasswordPlaceholder')}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary pr-10"
                    />
                    <button
                      onClick={() => setShowNewPw(!showNewPw)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                    >
                      {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Confirm password */}
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1.5">{t('confirmPassword')}</label>
                  <div className="relative">
                    <input
                      type={showConfirmPw ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      placeholder={t('confirmPasswordPlaceholder')}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary pr-10"
                    />
                    <button
                      onClick={() => setShowConfirmPw(!showConfirmPw)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                    >
                      {showConfirmPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {pwMessage && (
                  <p className={`text-sm ${pwMessage.type === 'success' ? 'text-emerald-600' : 'text-red-600'}`}>
                    {pwMessage.text}
                  </p>
                )}

                <button
                  onClick={handleChangePassword}
                  disabled={pwSaving || !currentPassword || !newPassword || !confirmPassword}
                  className="w-full py-2.5 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 transition-colors text-sm disabled:opacity-60"
                >
                  {t('savePassword')}
                </button>
              </div>
            </div>
          </div>

          {/* Referral Section */}
          <div className="bg-gradient-to-r from-primary/5 to-primary/10 rounded-2xl border border-primary/20 p-6">
            <h3 className="text-center text-lg font-bold text-gray-900 mb-6">
              {t('referral.title')}
            </h3>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Referral Info */}
              <div>
                <h4 className="text-sm font-bold text-gray-900 mb-1">{t('referral.info')}</h4>
                <p className="text-sm text-gray-500 mb-4">{t('referral.infoDesc')}</p>

                {/* Referral code */}
                <div className="mb-3">
                  <label className="block text-sm font-medium text-gray-600 mb-1.5">{t('referral.code')}</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={profile.referralCode}
                      readOnly
                      className="flex-1 px-3 py-2.5 bg-white border border-gray-300 rounded-lg text-sm text-gray-700"
                    />
                    <button
                      onClick={() => handleCopy(profile.referralCode, 'code')}
                      className="px-4 py-2.5 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-1.5"
                    >
                      {codeCopied ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}
                      {codeCopied ? t('referral.copied') : t('referral.codeCopy')}
                    </button>
                  </div>
                </div>

                {/* Referral link */}
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1.5">{t('referral.link')}</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={referralLink}
                      readOnly
                      className="flex-1 px-3 py-2.5 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 truncate"
                    />
                    <button
                      onClick={() => handleCopy(referralLink, 'link')}
                      className="px-4 py-2.5 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-1.5"
                    >
                      {linkCopied ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}
                      {linkCopied ? t('referral.copied') : t('referral.copy')}
                    </button>
                  </div>
                </div>
              </div>

              {/* Earnings */}
              <div>
                <h4 className="text-sm font-bold text-gray-900 mb-1">{t('referral.earnings')}</h4>
                <p className="text-sm text-gray-500 mb-4">{t('referral.earningsDesc')}</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white rounded-xl p-4 text-center border border-gray-100">
                    <Users className="w-6 h-6 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-500 mb-1">{t('referral.referrals')}</p>
                    <p className="text-2xl font-bold text-gray-900">0</p>
                  </div>
                  <div className="bg-white rounded-xl p-4 text-center border border-gray-100">
                    <BadgePercent className="w-6 h-6 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-500 mb-1">{t('referral.discount')}</p>
                    <p className="text-2xl font-bold text-gray-900">₺0</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Hesap silme (KVKK) — tehlikeli bölge */}
          <div className="mt-6 bg-white rounded-2xl border border-red-200 p-6 animate-card-enter">
            <h3 className="text-base font-semibold text-gray-900 mb-1">{t('delete.title')}</h3>
            <p className="text-sm leading-relaxed text-gray-600 mb-4">{t('delete.desc')}</p>
            <button
              onClick={handleDeleteAccount}
              disabled={deleting}
              className="px-5 py-2.5 text-sm font-medium text-red-700 border border-red-200 bg-red-50 rounded-lg hover:bg-red-100 transition-colors active:scale-[0.97] disabled:opacity-50"
            >
              {deleting ? t('delete.deleting') : t('delete.button')}
            </button>
          </div>

        </div>
      </div>
    </>
  )
}
