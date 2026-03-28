'use client'

export interface TikTokTableSkeletonProps {
  columns: { key: string; label: string }[]
}

const rightAlignKeys = ['budget', 'spent', 'impressions', 'clicks', 'ctr', 'cpc', 'conversions', 'reach']

export default function TikTokTableSkeleton({ columns }: TikTokTableSkeletonProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="bg-rose-50/60">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-4 py-3 text-xs font-semibold text-rose-800/70 uppercase whitespace-nowrap ${
                  rightAlignKeys.includes(col.key) ? 'text-right' : 'text-left'
                }`}
              >
                {col.label}
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
