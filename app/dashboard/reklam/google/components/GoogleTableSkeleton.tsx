'use client'

export interface GoogleTableSkeletonProps {
  columns: { key: string; label: string }[]
}

const rightAlignKeys = ['budget', 'spent', 'impressions', 'clicks', 'ctr', 'cpc', 'roas']

export default function GoogleTableSkeleton({ columns }: GoogleTableSkeletonProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="bg-green-50/60">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-4 py-3 text-xs font-semibold text-green-800/70 uppercase whitespace-nowrap ${
                  rightAlignKeys.includes(col.key) ? 'text-right' : 'text-left'
                }`}
              >
                {col.key === 'checkbox' ? (
                  <input type="checkbox" disabled className="w-4 h-4 rounded border-gray-300 accent-blue-600 opacity-50" />
                ) : col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 5 }).map((_, i) => (
            <tr key={`skeleton-${i}`} className="animate-pulse">
              {columns.map((col) => (
                <td key={col.key} className="px-4 py-4">
                  <div className="h-4 bg-gray-200/60 rounded w-full max-w-[80%]" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
