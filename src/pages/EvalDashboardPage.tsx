import { useState, useEffect, useCallback } from 'react'
import { isAuthenticated, verifyAuth, fetchEvalResults, fetchEvalDataset } from '../lib/api'
import type { EvalResultsResponse, EvalDatasetResponse, EvalRun, AgentEvalData } from '../lib/api'
import AuthGate from '../components/AuthGate'
import EvalHeader from '../components/eval/EvalHeader'
import MetricCard from '../components/eval/MetricCard'
import ResultsTable from '../components/eval/ResultsTable'
import RetrieverComparison from '../components/eval/RetrieverComparison'

const RETRIEVER_LABELS: Record<string, string> = {
  naive: 'Naive',
  bm25: 'BM25',
  multiQuery: 'Multi-Query',
  hybrid: 'Hybrid',
}

const AGENT_METRIC_LABELS: Record<string, string> = {
  tool_call_accuracy: 'Tool Call Accuracy',
  agent_goal_accuracy: 'Agent Goal Accuracy',
  topic_adherence: 'Topic Adherence',
}

const ROUTING_COLORS: Record<string, string> = {
  search: 'text-blue-400',
  refinement: 'text-amber-400',
  direct_response: 'text-gray-400',
}

function AgentEvalSection({ data }: { data: AgentEvalData }) {
  const [expandedRow, setExpandedRow] = useState<number | null>(null)

  return (
    <div className="space-y-6">
      <div className="border-t border-gray-800 pt-8">
        <h2 className="text-lg font-semibold text-gray-200 mb-1">Agent Evaluation</h2>
        <p className="text-sm text-gray-500 mb-6">
          Supervisor routing, goal accuracy, and topic adherence across {data.experiment.testCases} test scenarios
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {data.metrics.map(metric => (
          <MetricCard key={metric.name} metric={{ ...metric, name: AGENT_METRIC_LABELS[metric.name] ?? metric.name }} />
        ))}
      </div>

      <section className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide mb-3">
          Experiment Details
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-gray-500 text-xs">Experiment</p>
            <p className="text-gray-200">{data.experiment.name}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs">Model</p>
            <p className="text-gray-200">{data.experiment.model}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs">Run Timestamp</p>
            <p className="text-gray-200">
              {data.experiment.runTimestamp
                ? new Date(data.experiment.runTimestamp).toLocaleString()
                : 'N/A'}
            </p>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide mb-4">
          Per-Test-Case Results
          <span className="ml-2 text-gray-600 normal-case">
            ({data.items.length} items)
          </span>
        </h2>
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-gray-500 text-xs uppercase tracking-wide">
                  <th className="py-3 px-4 text-left">User Message</th>
                  <th className="py-3 px-4 text-center">Routing</th>
                  <th className="py-3 px-4 text-center">Tool Call</th>
                  <th className="py-3 px-4 text-center">Goal</th>
                  <th className="py-3 px-4 text-center">Topic</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item, i) => {
                  const isExpanded = expandedRow === i
                  return (
                    <tr
                      key={i}
                      className="border-b border-gray-800/50 cursor-pointer hover:bg-gray-800/30 transition-colors"
                      onClick={() => setExpandedRow(isExpanded ? null : i)}
                    >
                      <td className="py-3 px-4">
                        <p className="text-gray-300 truncate max-w-xs">{item.userMessage}</p>
                        {isExpanded && (
                          <div className="mt-2 space-y-1 text-xs">
                            <p className="text-gray-500">
                              Actual routing: <span className={ROUTING_COLORS[item.actualRouting] ?? 'text-gray-300'}>{item.actualRouting}</span>
                            </p>
                            {item.city && <p className="text-gray-500">City: <span className="text-gray-300">{item.city}</span></p>}
                            {item.searchQueries.length > 0 && (
                              <p className="text-gray-500">Queries: <span className="text-gray-300">{item.searchQueries.join('; ')}</span></p>
                            )}
                            {Object.entries(item.comments).map(([metric, comment]) => (
                              <p key={metric} className="text-gray-600">
                                <span className="text-gray-500">{AGENT_METRIC_LABELS[metric] ?? metric}:</span> {comment}
                              </p>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`text-xs font-mono ${ROUTING_COLORS[item.actualRouting] ?? 'text-gray-300'}`}>
                          {item.actualRouting}
                        </span>
                      </td>
                      {(['tool_call_accuracy', 'agent_goal_accuracy', 'topic_adherence'] as const).map(metric => {
                        const val = item.scores[metric]
                        const pct = val != null ? Math.round(val * 100) : null
                        const color = pct == null ? 'text-gray-600' : pct >= 80 ? 'text-green-400' : pct >= 50 ? 'text-yellow-400' : 'text-red-400'
                        return (
                          <td key={metric} className="py-3 px-4 text-center">
                            <span className={`font-mono ${color}`}>{pct != null ? `${pct}%` : '—'}</span>
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  )
}

type LoadState = 'idle' | 'loading' | 'loaded' | 'error'

export default function EvalDashboardPage() {
  const [authed, setAuthed] = useState(false)
  const [checking, setChecking] = useState(true)
  const [loadState, setLoadState] = useState<LoadState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<EvalResultsResponse | null>(null)
  const [dataset, setDataset] = useState<EvalDatasetResponse | null>(null)
  const [selectedRetriever, setSelectedRetriever] = useState<string | null>(null)

  useEffect(() => {
    if (isAuthenticated()) {
      verifyAuth().then(valid => {
        setAuthed(valid)
        setChecking(false)
      })
    } else {
      setChecking(false)
    }
  }, [])

  useEffect(() => {
    document.body.style.backgroundColor = '#030712'
    document.body.style.color = '#f9fafb'
    return () => {
      document.body.style.backgroundColor = ''
      document.body.style.color = ''
    }
  }, [])

  const loadData = useCallback(async () => {
    setLoadState('loading')
    setError(null)

    const [resultsRes, datasetRes] = await Promise.all([
      fetchEvalResults(),
      fetchEvalDataset(),
    ])

    if (!resultsRes.success) {
      setError(resultsRes.error ?? 'Failed to load evaluation results')
      setLoadState('error')
      return
    }

    if (resultsRes.data) {
      setResults(resultsRes.data)
      if (resultsRes.data.runs.length > 0 && !selectedRetriever) {
        setSelectedRetriever(resultsRes.data.runs[0]!.experiment.retriever)
      }
    }
    if (datasetRes.data) setDataset(datasetRes.data)
    setLoadState('loaded')
  }, [selectedRetriever])

  useEffect(() => {
    if (authed && loadState === 'idle') {
      loadData()
    }
  }, [authed, loadState, loadData])

  if (checking) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gray-950">
        <div className="text-gray-400 text-sm">Loading...</div>
      </div>
    )
  }

  if (!authed) {
    return <AuthGate onAuthenticated={() => setAuthed(true)} />
  }

  const runs = results?.runs ?? []
  const activeRun: EvalRun | undefined = runs.find(r => r.experiment.retriever === selectedRetriever)

  return (
    <div className="flex flex-col min-h-screen bg-gray-950 text-gray-100">
      <EvalHeader experiment={activeRun?.experiment ?? null} />

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-8 space-y-8">
        {loadState === 'loading' && (
          <div className="flex items-center justify-center py-20">
            <div className="flex items-center gap-3 text-gray-400">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span>Loading evaluation data from Langfuse...</span>
            </div>
          </div>
        )}

        {loadState === 'error' && (
          <div className="text-center py-20">
            <p className="text-red-400 mb-4">{error}</p>
            <button
              onClick={loadData}
              className="px-4 py-2 text-sm bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {loadState === 'loaded' && runs.length > 0 && (
          <>
            <RetrieverComparison
              runs={runs}
              selectedRetriever={selectedRetriever}
              onSelectRetriever={setSelectedRetriever}
            />

            {runs.length > 1 && (
              <div className="flex gap-2">
                {runs.map(run => {
                  const r = run.experiment.retriever
                  const isActive = r === selectedRetriever
                  return (
                    <button
                      key={r}
                      onClick={() => setSelectedRetriever(r)}
                      className={`px-4 py-2 text-sm rounded-lg transition-colors
                        ${isActive
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-300'}`}
                    >
                      {RETRIEVER_LABELS[r] ?? r}
                    </button>
                  )
                })}
              </div>
            )}

            {activeRun && (
              <>
                <section>
                  <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide mb-4">
                    RAGAS Metrics &mdash; {RETRIEVER_LABELS[activeRun.experiment.retriever] ?? activeRun.experiment.retriever}
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {activeRun.metrics.map(metric => (
                      <MetricCard key={metric.name} metric={metric} />
                    ))}
                  </div>
                </section>

                <section className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                  <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide mb-3">
                    Experiment Details
                  </h2>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500 text-xs">Retriever</p>
                      <p className="text-gray-200">{activeRun.experiment.retriever}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Model</p>
                      <p className="text-gray-200">{activeRun.experiment.model}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Top-K</p>
                      <p className="text-gray-200">{activeRun.experiment.topK}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Run Timestamp</p>
                      <p className="text-gray-200">
                        {activeRun.experiment.runTimestamp
                          ? new Date(activeRun.experiment.runTimestamp).toLocaleString()
                          : 'N/A'}
                      </p>
                    </div>
                  </div>
                </section>

                <section>
                  <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide mb-4">
                    Per-Test-Case Results
                    <span className="ml-2 text-gray-600 normal-case">
                      ({activeRun.items.length} items &mdash; click a row to expand)
                    </span>
                  </h2>
                  <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                    <ResultsTable items={activeRun.items} datasetItems={dataset?.items ?? []} />
                  </div>
                </section>
              </>
            )}
          </>
        )}

        {loadState === 'loaded' && results?.agentEval && (
          <AgentEvalSection data={results.agentEval} />
        )}

        {loadState === 'loaded' && runs.length === 0 && !results?.agentEval && (
          <div className="text-center py-20 text-gray-500">
            <p className="mb-2">No evaluation data found.</p>
            <p className="text-sm">
              Run evaluations first: <code className="text-gray-400">docker compose exec server npm run eval:all</code>
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
