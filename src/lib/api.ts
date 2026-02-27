const API_BASE = '/api/ai-engineering'

function getStoredToken(): string | null {
  try {
    const data = localStorage.getItem('ai-engineering-auth')
    if (!data) return null
    const parsed = JSON.parse(data) as { token: string; expiresAt: string }
    if (new Date(parsed.expiresAt) < new Date()) {
      localStorage.removeItem('ai-engineering-auth')
      return null
    }
    return parsed.token
  } catch {
    return null
  }
}

function storeToken(token: string, expiresAt: string): void {
  localStorage.setItem('ai-engineering-auth', JSON.stringify({ token, expiresAt }))
}

export function clearAuth(): void {
  localStorage.removeItem('ai-engineering-auth')
}

export function isAuthenticated(): boolean {
  return getStoredToken() !== null
}

export async function authenticate(secretKey: string): Promise<{ success: boolean; error?: string }> {
  const res = await fetch(`${API_BASE}/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secretKey }),
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: 'Authentication failed' }))
    return { success: false, error: (data as { error: string }).error }
  }

  const data = await res.json() as { token: string; expiresAt: string }
  storeToken(data.token, data.expiresAt)
  return { success: true }
}

export interface EventData {
  title: string
  description: string
  date: string
  time?: string
  url: string
  source: string
  venue?: string
  city: string
  confidenceScore: number
  matchExplanation: string
}

export interface ChatResponseData {
  response: string
  events?: Record<string, EventData[]>
  rejectedEvents?: EventData[]
  threadId: string
  searchDurationMs?: number
}

export async function sendChatMessage(
  message: string,
  threadId?: string
): Promise<{ success: boolean; data?: ChatResponseData; error?: string }> {
  const token = getStoredToken()
  if (!token) {
    return { success: false, error: 'Not authenticated' }
  }

  const res = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ message, threadId }),
  })

  if (res.status === 401) {
    clearAuth()
    return { success: false, error: 'Session expired. Please re-enter your access key.' }
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: 'Request failed' }))
    return { success: false, error: (data as { error: string }).error }
  }

  const data = await res.json() as ChatResponseData
  return { success: true, data }
}
