import { useState } from 'react'
import type { EvalItem, DatasetItem } from '../../lib/api'

const METRIC_ORDER = ['faithfulness', 'answer_relevancy', 'context_precision', 'context_recall']
const METRIC_SHORT: Record<string, string> = {
  faithfulness: 'Faith.',
  answer_relevancy: 'Ans. Rel.',
  context_precision: 'Ctx. Prec.',
  context_recall: 'Ctx. Recall',
}

function scoreCell(value: number | undefined) {
  if (value === undefined) return <span className="text-gray-600">—</span>
  const pct = Math.round(value * 100)
  let color = 'text-red-400'
  if (value >= 0.8) color = 'text-green-400'
  else if (value >= 0.5) color = 'text-yellow-400'
  return <span className={`font-mono text-sm ${color}`}>{pct}%</span>
}

interface ResultsTableProps {
  items: EvalItem[]
  datasetItems: DatasetItem[]
}

export default function ResultsTable({ items, datasetItems }: ResultsTableProps) {
  const [expandedRow, setExpandedRow] = useState<number | null>(null)

  const merged = items.map((item, idx) => {
    const ds = datasetItems.find(d => d.userQuery === item.userQuery) ?? datasetItems[idx]
    return { ...item, dataset: ds }
  })

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left">
        <thead>
          <tr className="border-b border-gray-800 text-gray-500 text-xs uppercase tracking-wide">
            <th className="py-3 px-3 w-8">#</th>
            <th className="py-3 px-3">Query</th>
            <th className="py-3 px-3">Filters</th>
            {METRIC_ORDER.map(m => (
              <th key={m} className="py-3 px-3 text-center">{METRIC_SHORT[m]}</th>
            ))}
            <th className="py-3 px-3 text-center">Match</th>
          </tr>
        </thead>
          {merged.map((row, idx) => {
            const expectedPass = row.dataset?.expectedPass ?? []
            const expectedReject = row.dataset?.expectedReject ?? []
            const passMatch = expectedPass.length === 0 ||
              expectedPass.every(t => row.actualPass.includes(t))
            const rejectMatch = expectedReject.length === 0 ||
              expectedReject.every(t => row.actualReject.includes(t))
            const fullMatch = passMatch && rejectMatch
            const isExpanded = expandedRow === idx

            const rowBorder = fullMatch
              ? 'border-l-2 border-l-green-600'
              : (passMatch || rejectMatch)
                ? 'border-l-2 border-l-yellow-600'
                : 'border-l-2 border-l-red-600'

            return (
              <tbody key={idx}>
                <tr
                  className={`border-b border-gray-800/50 hover:bg-gray-900/50 cursor-pointer ${rowBorder}`}
                  onClick={() => setExpandedRow(isExpanded ? null : idx)}
                >
                  <td className="py-3 px-3 text-gray-600">{idx + 1}</td>
                  <td className="py-3 px-3 text-gray-300 max-w-xs truncate">
                    {row.userQuery}
                  </td>
                  <td className="py-3 px-3">
                    <div className="flex flex-wrap gap-1">
                      {row.activeFilters.map(f => (
                        <span key={f} className="text-xs px-2 py-0.5 bg-gray-800 text-gray-400 rounded-full">
                          {f}
                        </span>
                      ))}
                    </div>
                  </td>
                  {METRIC_ORDER.map(m => (
                    <td key={m} className="py-3 px-3 text-center">
                      {scoreCell(row.scores[m])}
                    </td>
                  ))}
                  <td className="py-3 px-3 text-center">
                    {fullMatch
                      ? <span className="text-green-400 text-lg">&#10003;</span>
                      : <span className="text-red-400 text-lg">&#10007;</span>}
                  </td>
                </tr>
                {isExpanded && (
                  <tr className="border-b border-gray-800/50">
                    <td colSpan={8} className="py-4 px-6 bg-gray-900/30">
                      <ExpandedDetails row={row} expectedPass={expectedPass} expectedReject={expectedReject} />
                    </td>
                  </tr>
                )}
              </tbody>
            )
          })}
      </table>
    </div>
  )
}

interface ExpandedProps {
  row: EvalItem
  expectedPass: string[]
  expectedReject: string[]
}

function ExpandedDetails({ row, expectedPass, expectedReject }: ExpandedProps) {
  return (
    <div className="space-y-4 text-sm">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-gray-500 text-xs uppercase mb-1">Expected Pass</p>
          <ul className="space-y-1">
            {expectedPass.map(t => (
              <li key={t} className={`text-xs ${row.actualPass.includes(t) ? 'text-green-400' : 'text-red-400'}`}>
                {row.actualPass.includes(t) ? '✓' : '✗'} {t}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-gray-500 text-xs uppercase mb-1">Expected Reject</p>
          <ul className="space-y-1">
            {expectedReject.map(t => (
              <li key={t} className={`text-xs ${row.actualReject.includes(t) ? 'text-green-400' : 'text-red-400'}`}>
                {row.actualReject.includes(t) ? '✓' : '✗'} {t}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div>
        <p className="text-gray-500 text-xs uppercase mb-1">Actual Passed Events</p>
        <div className="flex flex-wrap gap-1">
          {row.actualPass.length > 0
            ? row.actualPass.map(t => (
                <span key={t} className="text-xs px-2 py-0.5 bg-green-900/30 text-green-400 rounded-full">{t}</span>
              ))
            : <span className="text-xs text-gray-600">None</span>}
        </div>
      </div>

      <div>
        <p className="text-gray-500 text-xs uppercase mb-1">Actual Rejected Events</p>
        <div className="flex flex-wrap gap-1">
          {row.actualReject.length > 0
            ? row.actualReject.map(t => (
                <span key={t} className="text-xs px-2 py-0.5 bg-red-900/30 text-red-400 rounded-full">{t}</span>
              ))
            : <span className="text-xs text-gray-600">None</span>}
        </div>
      </div>

      {Object.keys(row.comments).length > 0 && (
        <div>
          <p className="text-gray-500 text-xs uppercase mb-1">Judge Reasoning</p>
          <div className="space-y-2">
            {Object.entries(row.comments).map(([metric, comment]) => (
              <div key={metric} className="bg-gray-800/50 rounded-lg p-3">
                <p className="text-xs text-gray-400 font-medium mb-1">{METRIC_SHORT[metric] ?? metric}</p>
                <p className="text-xs text-gray-300 whitespace-pre-wrap">{comment}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
