import { useNavigate } from 'react-router-dom'
import type { EvalExperiment } from '../../lib/api'

interface EvalHeaderProps {
  experiment: EvalExperiment | null
}

export default function EvalHeader({ experiment }: EvalHeaderProps) {
  const navigate = useNavigate()

  return (
    <header className="shrink-0 border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <button
              onClick={() => navigate('/ai-engineering')}
              className="text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-1 shrink-0"
            >
              <span>&larr;</span> <span className="hidden sm:inline">Back to Chat</span><span className="sm:hidden">Back</span>
            </button>
            <div className="h-5 w-px bg-gray-700 shrink-0" />
            <div className="min-w-0">
              <h1 className="text-sm sm:text-lg font-semibold text-white truncate">Evaluation Dashboard</h1>
              {experiment && (
                <p className="text-xs text-gray-500 truncate">
                  {experiment.name}
                  {experiment.runTimestamp && (
                    <> &middot; {new Date(experiment.runTimestamp).toLocaleDateString()}</>
                  )}
                </p>
              )}
            </div>
          </div>

          {experiment?.langfuseUrl && (
            <a
              href={experiment.langfuseUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-400 hover:text-blue-300 transition-colors shrink-0 ml-3"
            >
              Langfuse &nearr;
            </a>
          )}
        </div>

        {experiment && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-gray-500">
            <span>Retriever: <span className="text-gray-300">{experiment.retriever}</span></span>
            <span>Model: <span className="text-gray-300">{experiment.model}</span></span>
            <span>Top-K: <span className="text-gray-300">{experiment.topK}</span></span>
          </div>
        )}
      </div>
    </header>
  )
}
