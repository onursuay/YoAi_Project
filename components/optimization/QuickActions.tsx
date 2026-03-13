'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Pause, Play, DollarSign, Loader2 } from 'lucide-react'
import { createChangeSet, executeChangeSet } from '@/lib/meta/optimization/changeSetManager'

interface QuickActionsProps {
  entityType: 'campaign' | 'adset'
  entityId: string
  entityName: string
  currentStatus: string
  currentBudget: number | null
  budgetType: 'daily' | 'lifetime'
  onSuccess?: (action: string) => void
  onError?: (message: string) => void
}

export default function QuickActions({
  entityType,
  entityId,
  entityName,
  currentStatus,
  currentBudget,
  budgetType,
  onSuccess,
  onError,
}: QuickActionsProps) {
  const t = useTranslations('dashboard.optimizasyon.actions')
  const [loading, setLoading] = useState<string | null>(null)
  const [editingBudget, setEditingBudget] = useState(false)
  const [newBudget, setNewBudget] = useState(String(currentBudget || ''))
  const [showConfirm, setShowConfirm] = useState<'pause' | 'resume' | null>(null)

  const isActive = currentStatus === 'ACTIVE'

  const handleStatusToggle = async () => {
    const action = isActive ? 'PAUSED' : 'ACTIVE'
    setShowConfirm(null)
    setLoading('status')

    const changeSet = createChangeSet(entityType, entityId, entityName, 'status', currentStatus, action)
    const result = await executeChangeSet(changeSet)

    setLoading(null)
    if (result.ok) {
      onSuccess?.(isActive ? 'paused' : 'resumed')
    } else {
      onError?.(result.error || 'Unknown error')
    }
  }

  const handleBudgetSave = async () => {
    const numBudget = parseFloat(newBudget)
    if (!numBudget || numBudget <= 0) return

    setLoading('budget')
    const changeSet = createChangeSet(entityType, entityId, entityName, 'budget', currentBudget || 0, numBudget)
    const result = await executeChangeSet(changeSet)

    setLoading(null)
    setEditingBudget(false)
    if (result.ok) {
      onSuccess?.('budget_updated')
    } else {
      onError?.(result.error || 'Unknown error')
    }
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Status Toggle */}
      <div className="relative">
        {showConfirm ? (
          <div className="flex items-center gap-1">
            <span className="text-ui text-gray-600">
              {showConfirm === 'pause' ? t('confirmPause') : t('confirmResume')}
            </span>
            <button
              onClick={handleStatusToggle}
              disabled={loading === 'status'}
              className="px-2 py-1 text-ui font-medium text-white bg-green-600 rounded hover:bg-green-700 disabled:opacity-50"
            >
              {loading === 'status' ? <Loader2 className="w-3 h-3 animate-spin" /> : 'OK'}
            </button>
            <button
              onClick={() => setShowConfirm(null)}
              className="px-2 py-1 text-ui text-gray-500 hover:text-gray-700"
            >
              {t('cancelBudget')}
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowConfirm(isActive ? 'pause' : 'resume')}
            disabled={loading !== null}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-ui font-medium rounded-lg transition ${
              isActive
                ? 'text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200'
                : 'text-green-700 bg-green-50 hover:bg-green-100 border border-green-200'
            } disabled:opacity-50`}
          >
            {isActive ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            {isActive ? t('pause') : t('resume')}
          </button>
        )}
      </div>

      {/* Budget Edit */}
      {currentBudget !== null && (
        <>
          {editingBudget ? (
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={newBudget}
                onChange={(e) => setNewBudget(e.target.value)}
                className="w-24 px-2 py-1 text-ui border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-green-500"
                min={1}
                step={0.01}
                autoFocus
              />
              <button
                onClick={handleBudgetSave}
                disabled={loading === 'budget'}
                className="px-2 py-1 text-ui font-medium text-white bg-green-600 rounded hover:bg-green-700 disabled:opacity-50"
              >
                {loading === 'budget' ? <Loader2 className="w-3 h-3 animate-spin" /> : t('saveBudget')}
              </button>
              <button
                onClick={() => { setEditingBudget(false); setNewBudget(String(currentBudget)) }}
                className="px-2 py-1 text-ui text-gray-500 hover:text-gray-700"
              >
                {t('cancelBudget')}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setEditingBudget(true)}
              disabled={loading !== null}
              className="flex items-center gap-1.5 px-3 py-1.5 text-ui font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg transition disabled:opacity-50"
            >
              <DollarSign className="w-3 h-3" />
              {t('editBudget')}
            </button>
          )}
        </>
      )}
    </div>
  )
}
