'use client'

import { useState } from 'react'
import { CheckCircle, Circle, Clock, AlertCircle, Sparkles } from 'lucide-react'
import type { StrategyTask, TaskStatus } from '@/lib/strategy/types'
import { TASK_CATEGORIES } from '@/lib/strategy/constants'

interface TaskPanelProps {
  tasks: StrategyTask[]
  onUpdateStatus: (taskId: string, status: TaskStatus) => void
}

const STATUS_ICONS: Record<TaskStatus, React.ReactNode> = {
  todo: <Circle className="w-4 h-4 text-gray-300" />,
  in_progress: <Clock className="w-4 h-4 text-blue-500" />,
  done: <CheckCircle className="w-4 h-4 text-green-500" />,
  blocked: <AlertCircle className="w-4 h-4 text-red-500" />,
}

const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'Yapılacak',
  in_progress: 'Devam ediyor',
  done: 'Tamamlandı',
  blocked: 'Engelli',
}

export default function TaskPanel({ tasks, onUpdateStatus }: TaskPanelProps) {
  const [filter, setFilter] = useState<string>('all')

  const categoryMap = new Map(TASK_CATEGORIES.map((c) => [c.value, c.label]))
  const filtered = filter === 'all' ? tasks : tasks.filter((t) => t.category === filter)

  const stats = {
    total: tasks.length,
    done: tasks.filter((t) => t.status === 'done').length,
    blocked: tasks.filter((t) => t.status === 'blocked').length,
  }

  const nextStatus = (current: TaskStatus): TaskStatus => {
    const cycle: TaskStatus[] = ['todo', 'in_progress', 'done']
    const idx = cycle.indexOf(current)
    return cycle[(idx + 1) % cycle.length]
  }

  return (
    <div className="space-y-4">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-amber-800 mb-1">Aşama 3: Uygulama & Görevler</h3>
        <p className="text-xs text-amber-700">Stratejinin hayata geçmesi için görevleri takip edin.</p>
      </div>

      {/* İlerleme */}
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
            <span>{stats.done}/{stats.total} tamamlandı</span>
            {stats.blocked > 0 && <span className="text-red-500">{stats.blocked} engelli</span>}
          </div>
          <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all"
              style={{ width: `${stats.total ? (stats.done / stats.total) * 100 : 0}%` }}
            />
          </div>
        </div>
      </div>

      {/* Filtre */}
      <div className="flex gap-1.5 flex-wrap">
        <button
          onClick={() => setFilter('all')}
          className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
            filter === 'all' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
          }`}
        >
          Tümü ({tasks.length})
        </button>
        {TASK_CATEGORIES.map((cat) => {
          const count = tasks.filter((t) => t.category === cat.value).length
          if (count === 0) return null
          return (
            <button
              key={cat.value}
              onClick={() => setFilter(cat.value)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                filter === cat.value ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              }`}
            >
              {cat.label} ({count})
            </button>
          )
        })}
      </div>

      {/* Task listesi */}
      <div className="space-y-1.5">
        {filtered.length === 0 ? (
          <div className="text-center py-8 text-sm text-gray-400">
            Henüz görev yok. Plan onaylandığında görevler oluşturulacak.
          </div>
        ) : (
          filtered.map((task) => (
            <div
              key={task.id}
              className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                task.category === 'optimization' && task.status !== 'done'
                  ? 'bg-purple-50/50 border-purple-200 hover:border-purple-300'
                  : task.status === 'done'
                    ? 'bg-green-50/50 border-green-100'
                    : task.status === 'blocked'
                      ? 'bg-red-50/50 border-red-100'
                      : 'bg-white border-gray-200 hover:border-gray-300'
              }`}
            >
              <button
                onClick={() => onUpdateStatus(task.id, nextStatus(task.status))}
                className="flex-shrink-0 hover:scale-110 transition-transform"
                title={`Durum: ${STATUS_LABELS[task.status]} — tıklayın`}
              >
                {task.category === 'optimization' && task.status !== 'done'
                  ? <Sparkles className="w-4 h-4 text-purple-500" />
                  : STATUS_ICONS[task.status]}
              </button>
              <div className="flex-1 min-w-0">
                <span className={`text-sm ${task.status === 'done' ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                  {task.title}
                </span>
              </div>
              <span className={`text-[10px] px-1.5 py-0.5 rounded flex-shrink-0 ${
                task.category === 'optimization'
                  ? 'bg-purple-100 text-purple-600'
                  : 'bg-gray-100 text-gray-500'
              }`}>
                {categoryMap.get(task.category) || task.category}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
