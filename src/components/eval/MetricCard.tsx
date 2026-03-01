import type { EvalMetric } from '../../lib/api'

const METRIC_LABELS: Record<string, string> = {
  faithfulness: 'Faithfulness',
  answer_relevancy: 'Answer Relevancy',
  context_precision: 'Context Precision',
  context_recall: 'Context Recall',
}

function scoreColor(value: number): string {
  if (value >= 0.8) return 'text-green-400'
  if (value >= 0.5) return 'text-yellow-400'
  return 'text-red-400'
}

function barColor(value: number): string {
  if (value >= 0.8) return 'bg-green-500'
  if (value >= 0.5) return 'bg-yellow-500'
  return 'bg-red-500'
}

interface MetricCardProps {
  metric: EvalMetric
}

export default function MetricCard({ metric }: MetricCardProps) {
  const label = METRIC_LABELS[metric.name] ?? metric.name
  const meanPct = Math.round(metric.mean * 100)
  const minPct = Math.round(metric.min * 100)
  const maxPct = Math.round(metric.max * 100)

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-3xl font-bold tabular-nums ${scoreColor(metric.mean)}`}>
        {meanPct}%
      </p>

      <div className="mt-3 h-2 rounded-full bg-gray-800 overflow-hidden">
        <div
          className={`h-full rounded-full ${barColor(metric.mean)}`}
          style={{ width: `${meanPct}%` }}
        />
      </div>

      <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
        <span>Min {minPct}%</span>
        <span>Max {maxPct}%</span>
      </div>
      <p className="mt-1 text-xs text-gray-600">{metric.count} samples</p>
    </div>
  )
}
