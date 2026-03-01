import { useState, useEffect, useCallback } from 'react'
import { isAuthenticated, fetchEvalResults, fetchEvalDataset } from '../lib/api'
import type { EvalResultsResponse, EvalDatasetResponse } from '../lib/api'
import SecretKeyGate from '../components/SecretKeyGate'
import EvalHeader from '../components/eval/EvalHeader'
import MetricCard from '../components/eval/MetricCard'
import ResultsTable from '../components/eval/ResultsTable'

type LoadState = 'idle' | 'loading' | 'loaded' | 'error'

export default function EvalDashboardPage() {
  const [authed, setAuthed] = useState(false)
  const [loadState, setLoadState] = useState<LoadState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<EvalResultsResponse | null>(null)
  const [dataset, setDataset] = useState<EvalDatasetResponse | null>(null)

  useEffect(() => {
    setAuthed(isAuthenticated())
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

    if (resultsRes.data) setResults(resultsRes.data)
    if (datasetRes.data) setDataset(datasetRes.data)
    setLoadState('loaded')
  }, [])

  useEffect(() => {
    if (authed && loadState === 'idle') {
      loadData()
    }
  }, [authed, loadState, loadData])

  if (!authed) {
    return <SecretKeyGate onAuthenticated={() => setAuthed(true)} />
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-950 text-gray-100">
      <EvalHeader experiment={results?.experiment ?? null} />

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

        {loadState === 'loaded' && results && (
          <>
            {/* Metrics Summary */}
            <section>
              <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide mb-4">
                RAGAS Metrics Summary
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {results.metrics.map(metric => (
                  <MetricCard key={metric.name} metric={metric} />
                ))}
              </div>
            </section>

            {/* Experiment Metadata */}
            {results.experiment && (
              <section className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide mb-3">
                  Experiment Details
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500 text-xs">Retriever</p>
                    <p className="text-gray-200">{results.experiment.retriever}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs">Model</p>
                    <p className="text-gray-200">{results.experiment.model}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs">Top-K</p>
                    <p className="text-gray-200">{results.experiment.topK}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs">Run Timestamp</p>
                    <p className="text-gray-200">
                      {results.experiment.runTimestamp
                        ? new Date(results.experiment.runTimestamp).toLocaleString()
                        : 'N/A'}
                    </p>
                  </div>
                </div>
              </section>
            )}

            {/* Per-Test-Case Results */}
            <section>
              <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide mb-4">
                Per-Test-Case Results
                <span className="ml-2 text-gray-600 normal-case">
                  ({results.items.length} items — click a row to expand)
                </span>
              </h2>
              <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <ResultsTable items={results.items} datasetItems={dataset?.items ?? []} />
              </div>
            </section>
          </>
        )}

        {loadState === 'loaded' && results && results.items.length === 0 && (
          <div className="text-center py-20 text-gray-500">
            <p className="mb-2">No evaluation data found.</p>
            <p className="text-sm">Run the baseline evaluation first: <code className="text-gray-400">npm run eval:baseline</code></p>
          </div>
        )}
      </main>
    </div>
  )
}
