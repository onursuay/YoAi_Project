'use client'

export interface MetaTableSkeletonProps {
  columns: { key: string; label: string }[]
}

export default function MetaTableSkeleton({ columns }: MetaTableSkeletonProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-4 py-4 text-ui font-medium text-gray-500 uppercase whitespace-nowrap ${
                  ['budget', 'spent', 'impressions', 'clicks', 'ctr', 'cpc', 'results'].includes(col.key)
                    ? 'text-right'
                    : 'text-left'
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
