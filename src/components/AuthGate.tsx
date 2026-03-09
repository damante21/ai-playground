import { useState, type FormEvent } from 'react'
import { login, signup } from '../lib/api'

interface AuthGateProps {
  onAuthenticated: () => void
}

type AuthMode = 'login' | 'signup'

export default function AuthGate({ onAuthenticated }: AuthGateProps) {
  const [mode, setMode] = useState<AuthMode>('login')
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [secretKey, setSecretKey] = useState('')

  function switchMode(newMode: AuthMode) {
    setMode(newMode)
    setError(null)
    setSuccessMessage(null)
  }

  async function handleLogin(e: FormEvent) {
    e.preventDefault()
    if (!username.trim() || !password || isLoading) return

    setError(null)
    setIsLoading(true)

    const result = await login(username.trim(), password)
    if (result.success) {
      onAuthenticated()
    } else {
      setError(result.error ?? 'Login failed')
    }

    setIsLoading(false)
  }

  async function handleSignup(e: FormEvent) {
    e.preventDefault()
    if (!username.trim() || !email.trim() || !password || !secretKey || isLoading) return

    setError(null)
    setIsLoading(true)

    const result = await signup(username.trim(), email.trim(), password, secretKey)
    if (result.success) {
      setSuccessMessage('Account created. Please log in.')
      setPassword('')
      setSecretKey('')
      setMode('login')
    } else {
      setError(result.error ?? 'Signup failed')
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

        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 shadow-lg">
          {mode === 'login' ? (
            <form onSubmit={handleLogin}>
              <h2 className="text-lg font-semibold text-white mb-4">Log In</h2>

              {successMessage && (
                <p className="mb-4 text-sm text-green-400 bg-green-400/10 rounded-lg px-3 py-2">
                  {successMessage}
                </p>
              )}

              <label htmlFor="login-username" className="block text-sm font-medium text-gray-300 mb-1">
                Username or Email
              </label>
              <input
                id="login-username"
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Enter username or email"
                className="w-full px-4 py-3 mb-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isLoading}
                autoFocus
              />

              <label htmlFor="login-password" className="block text-sm font-medium text-gray-300 mb-1">
                Password
              </label>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isLoading}
              />

              {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

              <button
                type="submit"
                disabled={isLoading || !username.trim() || !password}
                className="mt-4 w-full px-4 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? 'Logging in...' : 'Log In'}
              </button>

              <p className="mt-4 text-center text-sm text-gray-400">
                Don&apos;t have an account?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('signup')}
                  className="text-blue-400 hover:text-blue-300 font-medium"
                >
                  Create Account
                </button>
              </p>
            </form>
          ) : (
            <form onSubmit={handleSignup}>
              <h2 className="text-lg font-semibold text-white mb-4">Create Account</h2>

              <label htmlFor="signup-username" className="block text-sm font-medium text-gray-300 mb-1">
                Username
              </label>
              <input
                id="signup-username"
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Choose a username"
                className="w-full px-4 py-3 mb-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isLoading}
                autoFocus
              />

              <label htmlFor="signup-email" className="block text-sm font-medium text-gray-300 mb-1">
                Email
              </label>
              <input
                id="signup-email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="w-full px-4 py-3 mb-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isLoading}
              />

              <label htmlFor="signup-password" className="block text-sm font-medium text-gray-300 mb-1">
                Password
              </label>
              <input
                id="signup-password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Choose a password (min 6 characters)"
                className="w-full px-4 py-3 mb-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isLoading}
              />

              <label htmlFor="signup-secret" className="block text-sm font-medium text-gray-300 mb-1">
                Access Key
              </label>
              <input
                id="signup-secret"
                type="password"
                value={secretKey}
                onChange={e => setSecretKey(e.target.value)}
                placeholder="Enter the access key"
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isLoading}
              />

              {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

              <button
                type="submit"
                disabled={isLoading || !username.trim() || !email.trim() || !password || !secretKey}
                className="mt-4 w-full px-4 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? 'Creating account...' : 'Create Account'}
              </button>

              <p className="mt-4 text-center text-sm text-gray-400">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className="text-blue-400 hover:text-blue-300 font-medium"
                >
                  Log In
                </button>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
