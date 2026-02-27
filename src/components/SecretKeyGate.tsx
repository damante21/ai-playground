import { useState, type FormEvent } from 'react'
import { authenticate } from '../lib/api'

interface SecretKeyGateProps {
  onAuthenticated: () => void
}

export default function SecretKeyGate({ onAuthenticated }: SecretKeyGateProps) {
  const [key, setKey] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!key.trim() || isLoading) return

    setError(null)
    setIsLoading(true)

    const result = await authenticate(key.trim())

    if (result.success) {
      onAuthenticated()
    } else {
      setError(result.error ?? 'Invalid key')
    }

    setIsLoading(false)
  }

  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-gray-950 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white mb-2">AI Powered Event Sourcer</h1>
          <p className="text-gray-400 text-sm">AI-powered community event discovery</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-gray-900 rounded-xl border border-gray-800 p-6 shadow-lg">
          <label htmlFor="secret-key" className="block text-sm font-medium text-gray-300 mb-2">
            Access Key
          </label>
          <input
            id="secret-key"
            type="password"
            value={key}
            onChange={e => setKey(e.target.value)}
            placeholder="Enter your access key"
            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isLoading}
            autoFocus
          />

          {error && (
            <p className="mt-3 text-sm text-red-400">{error}</p>
          )}

          <button
            type="submit"
            disabled={isLoading || !key.trim()}
            className="mt-4 w-full px-4 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? 'Verifying...' : 'Enter'}
          </button>
        </form>
      </div>
    </div>
  )
}
