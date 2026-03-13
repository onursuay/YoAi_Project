'use client'

interface Column {
  key: string
  label: string
  align?: 'left' | 'right' | 'center'
}

interface Row {
  [key: string]: React.ReactNode
}

interface DataTableProps {
  columns: Column[]
  data: Row[]
  actions?: (row: Row, index: number) => React.ReactNode
}

export default function DataTable({ columns, data, actions }: DataTableProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`px-4 py-3 text-left text-ui font-semibold text-gray-700 uppercase tracking-wider ${
                    column.align === 'right' ? 'text-right' : ''
                  }`}
                >
                  {column.label}
                </th>
              ))}
              {actions && <th className="px-4 py-3 text-left text-ui font-semibold text-gray-700 uppercase tracking-wider">İşlemler</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {data.map((row, index) => (
              <tr key={index} className="hover:bg-gray-50 transition-colors">
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={`px-4 py-3 text-sm text-gray-900 ${
                      column.align === 'right' ? 'text-right' : ''
                    }`}
                  >
                    {row[column.key]}
                  </td>
                ))}
                {actions && (
                  <td className="px-4 py-3 text-sm">
                    {actions(row, index)}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

