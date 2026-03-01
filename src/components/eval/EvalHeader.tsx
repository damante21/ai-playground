import { useNavigate } from 'react-router-dom'
import type { EvalExperiment } from '../../lib/api'

interface EvalHeaderProps {
  experiment: EvalExperiment | null
}

export default function EvalHeader({ experiment }: EvalHeaderProps) {
  const navigate = useNavigate()

  return (
    <header className="shrink-0 border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/ai-engineering')}
            className="text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-1"
          >
            <span>&larr;</span> Back to Chat
          </button>
          <div className="h-5 w-px bg-gray-700" />
          <div>
            <h1 className="text-lg font-semibold text-white">RAGAS Evaluation Dashboard</h1>
            {experiment && (
              <p className="text-xs text-gray-500">
                {experiment.name}
                {experiment.runTimestamp && (
                  <> &middot; {new Date(experiment.runTimestamp).toLocaleDateString()}</>
                )}
              </p>
            )}
          </div>
        </div>

        {experiment && (
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span>Retriever: <span className="text-gray-300">{experiment.retriever}</span></span>
            <span>Model: <span className="text-gray-300">{experiment.model}</span></span>
            <span>Top-K: <span className="text-gray-300">{experiment.topK}</span></span>
            {experiment.langfuseUrl && (
              <a
                href={experiment.langfuseUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 transition-colors"
              >
                Langfuse &nearr;
              </a>
            )}
          </div>
        )}
      </div>
    </header>
  )
}
