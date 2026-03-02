import type { EvalRun } from '../../lib/api'

const METRIC_LABELS: Record<string, string> = {
  faithfulness: 'Faithfulness',
  answer_relevancy: 'Ans. Relevancy',
  context_precision: 'Ctx. Precision',
  context_recall: 'Ctx. Recall',
}

const RETRIEVER_LABELS: Record<string, string> = {
  naive: 'Naive (pgvector)',
  bm25: 'BM25 (tsvector)',
  multiQuery: 'Multi-Query',
  hybrid: 'Hybrid (RRF)',
}

const METRIC_ORDER = ['faithfulness', 'answer_relevancy', 'context_precision', 'context_recall']

function cellColor(value: number, isBest: boolean): string {
  const base = value >= 0.8
    ? 'text-green-400'
    : value >= 0.5
      ? 'text-yellow-400'
      : 'text-red-400'
  return isBest ? `${base} font-bold` : base
}

interface RetrieverComparisonProps {
  runs: EvalRun[]
  selectedRetriever: string | null
  onSelectRetriever: (retriever: string) => void
}

export default function RetrieverComparison({ runs, selectedRetriever, onSelectRetriever }: RetrieverComparisonProps) {
  if (runs.length === 0) return null

  const bestByMetric: Record<string, number> = {}
  for (const metric of METRIC_ORDER) {
    let best = -1
    for (const run of runs) {
      const m = run.metrics.find(m => m.name === metric)
      if (m && m.mean > best) best = m.mean
    }
    bestByMetric[metric] = best
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-800">
        <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide">
          Retriever Comparison
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-500 text-xs uppercase tracking-wide">
              <th className="py-3 px-4 text-left">Retriever</th>
              {METRIC_ORDER.map(m => (
                <th key={m} className="py-3 px-4 text-center">{METRIC_LABELS[m]}</th>
              ))}
              <th className="py-3 px-4 text-center">Samples</th>
            </tr>
          </thead>
          <tbody>
            {runs.map(run => {
              const retriever = run.experiment.retriever
              const isSelected = retriever === selectedRetriever
              return (
                <tr
                  key={retriever}
                  className={`border-b border-gray-800/50 cursor-pointer transition-colors
                    ${isSelected ? 'bg-gray-800/60' : 'hover:bg-gray-900/50'}`}
                  onClick={() => onSelectRetriever(retriever)}
                >
                  <td className="py-3 px-4">
                    <span className={`font-medium ${isSelected ? 'text-white' : 'text-gray-300'}`}>
                      {RETRIEVER_LABELS[retriever] ?? retriever}
                    </span>
                  </td>
                  {METRIC_ORDER.map(metricName => {
                    const m = run.metrics.find(m => m.name === metricName)
                    const val = m?.mean ?? 0
                    const isBest = val > 0 && Math.abs(val - bestByMetric[metricName]!) < 0.001
                    return (
                      <td key={metricName} className="py-3 px-4 text-center">
                        <span className={`font-mono ${cellColor(val, isBest)}`}>
                          {Math.round(val * 100)}%
                        </span>
                      </td>
                    )
                  })}
                  <td className="py-3 px-4 text-center text-gray-500">
                    {run.metrics[0]?.count ?? 0}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
