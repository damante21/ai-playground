const API_BASE = '/api/ai-engineering'
const AUTH_STORAGE_KEY = 'ai-engineering-auth'

export interface AuthUser {
  id: string
  username: string
  email: string
}

interface StoredAuth {
  token: string
  user: AuthUser
}

function getStoredAuth(): StoredAuth | null {
  try {
    const data = localStorage.getItem(AUTH_STORAGE_KEY)
    if (!data) return null
    return JSON.parse(data) as StoredAuth
  } catch {
    return null
  }
}

function getStoredToken(): string | null {
  return getStoredAuth()?.token ?? null
}

function storeAuth(token: string, user: AuthUser): void {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ token, user }))
}

export function clearAuth(): void {
  localStorage.removeItem(AUTH_STORAGE_KEY)
}

export function isAuthenticated(): boolean {
  return getStoredToken() !== null
}

export function getUser(): AuthUser | null {
  return getStoredAuth()?.user ?? null
}

export async function login(
  emailOrUsername: string,
  password: string
): Promise<{ success: boolean; user?: AuthUser; error?: string }> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ emailOrUsername, password }),
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: 'Login failed' }))
    return { success: false, error: (data as { error: string }).error }
  }

  const data = await res.json() as { token: string; user: AuthUser }
  storeAuth(data.token, data.user)
  return { success: true, user: data.user }
}

export async function signup(
  username: string,
  email: string,
  password: string,
  secretKey: string
): Promise<{ success: boolean; error?: string }> {
  const res = await fetch(`${API_BASE}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email, password, secretKey }),
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: 'Signup failed' }))
    const errorData = data as { error: string; details?: Array<{ msg: string }> }
    const message = errorData.details?.[0]?.msg ?? errorData.error
    return { success: false, error: message }
  }

  return { success: true }
}

export async function verifyAuth(): Promise<boolean> {
  const token = getStoredToken()
  if (!token) return false

  try {
    const res = await fetch(`${API_BASE}/auth/verify`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      clearAuth()
      return false
    }
    return true
  } catch {
    return false
  }
}

/**
 * Attempt auto-login via the standalone /auth/auto endpoint.
 * Returns true if the server supports it (AUTH_DISABLED mode).
 * Returns false (silently) in production where the endpoint doesn't exist.
 */
export async function autoLogin(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/auth/auto`)
    if (!res.ok) return false
    const data = await res.json() as { success: boolean; token: string; user: AuthUser }
    if (data.success && data.token) {
      storeAuth(data.token, data.user)
      return true
    }
    return false
  } catch {
    return false
  }
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

export interface EvalMetric {
  name: string
  mean: number
  min: number
  max: number
  count: number
}

export interface EvalExperiment {
  name: string
  retriever: string
  model: string
  topK: number
  runTimestamp: string | null
  langfuseUrl?: string
}

export interface EvalItem {
  userQuery: string
  activeFilters: string[]
  actualPass: string[]
  actualReject: string[]
  scores: Record<string, number>
  comments: Record<string, string>
}

export interface EvalRun {
  experiment: EvalExperiment
  metrics: EvalMetric[]
  items: EvalItem[]
}

export interface AgentEvalExperiment {
  name: string
  model: string
  testCases: number
  runTimestamp: string | null
}

export interface AgentEvalItem {
  userMessage: string
  expectedRouting: string
  actualRouting: string
  city: string | null
  searchQueries: string[]
  scores: Record<string, number>
  comments: Record<string, string>
}

export interface AgentEvalData {
  experiment: AgentEvalExperiment
  metrics: EvalMetric[]
  items: AgentEvalItem[]
}

export interface EvalResultsResponse {
  runs: EvalRun[]
  agentEval: AgentEvalData | null
}

export interface DatasetItem {
  id: number
  userQuery: string
  activeFilters: string[]
  eventCount: number
  expectedPass: string[]
  expectedReject: string[]
  relevantCategories: string[]
  groundTruthReasoning: string
}

export interface EvalDatasetResponse {
  count: number
  items: DatasetItem[]
}

export async function fetchEvalResults(): Promise<{ success: boolean; data?: EvalResultsResponse; error?: string }> {
  const token = getStoredToken()
  if (!token) {
    return { success: false, error: 'Not authenticated' }
  }

  const res = await fetch(`${API_BASE}/eval/results`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (res.status === 401) {
    clearAuth()
    return { success: false, error: 'Session expired. Please re-enter your access key.' }
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: 'Request failed' }))
    return { success: false, error: (data as { error: string }).error }
  }

  const data = await res.json() as EvalResultsResponse
  return { success: true, data }
}

export async function fetchEvalDataset(): Promise<{ success: boolean; data?: EvalDatasetResponse; error?: string }> {
  const token = getStoredToken()
  if (!token) {
    return { success: false, error: 'Not authenticated' }
  }

  const res = await fetch(`${API_BASE}/eval/dataset`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (res.status === 401) {
    clearAuth()
    return { success: false, error: 'Session expired. Please re-enter your access key.' }
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: 'Request failed' }))
    return { success: false, error: (data as { error: string }).error }
  }

  const data = await res.json() as EvalDatasetResponse
  return { success: true, data }
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

// --- Saved Events API ---

export type SavedEventStatus = 'interested' | 'going' | 'attended' | 'skipped'

export interface SavedEvent {
  id: string
  title: string
  description: string | null
  event_url: string | null
  venue_name: string | null
  venue_address: string | null
  start_time: string | null
  end_time: string | null
  category: string | null
  is_free: boolean | null
  confidence_score: number | null
  match_explanation: string | null
  status: SavedEventStatus
  notes: string | null
  enriched_at: string | null
  enrichment_data: Record<string, unknown> | null
  source_thread_id: string | null
  created_at: string
  updated_at: string
}

export interface SaveEventInput {
  title: string
  description?: string
  eventUrl?: string
  venueName?: string
  venueAddress?: string
  startTime?: string
  endTime?: string
  category?: string
  isFree?: boolean
  confidenceScore?: number
  matchExplanation?: string
  sourceThreadId?: string
  sourceQuery?: string
}

async function authedFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response | null> {
  const token = getStoredToken()
  if (!token) return null

  const headers = new Headers(options.headers)
  headers.set('Authorization', `Bearer ${token}`)
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers })
  if (res.status === 401 || res.status === 403) {
    clearAuth()
    return null
  }
  return res
}

export async function saveEvent(input: SaveEventInput): Promise<{ success: boolean; event?: SavedEvent; error?: string }> {
  const res = await authedFetch('/events', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  if (!res) return { success: false, error: 'Not authenticated' }

  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: 'Failed to save event' }))
    return { success: false, error: (data as { error: string }).error }
  }

  const data = await res.json() as { success: boolean; event: SavedEvent }
  return { success: true, event: data.event }
}

export async function fetchSavedEvents(filters?: {
  status?: SavedEventStatus
  category?: string
  upcoming?: boolean
}): Promise<{ success: boolean; events?: SavedEvent[]; error?: string }> {
  const params = new URLSearchParams()
  if (filters?.status) params.set('status', filters.status)
  if (filters?.category) params.set('category', filters.category)
  if (filters?.upcoming) params.set('upcoming', 'true')

  const qs = params.toString()
  const res = await authedFetch(`/events${qs ? `?${qs}` : ''}`)
  if (!res) return { success: false, error: 'Not authenticated' }

  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: 'Failed to fetch events' }))
    return { success: false, error: (data as { error: string }).error }
  }

  const data = await res.json() as { success: boolean; events: SavedEvent[] }
  return { success: true, events: data.events }
}

export async function updateEvent(
  eventId: string,
  updates: { status?: SavedEventStatus; notes?: string }
): Promise<{ success: boolean; error?: string }> {
  const res = await authedFetch(`/events/${eventId}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  })
  if (!res) return { success: false, error: 'Not authenticated' }

  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: 'Failed to update event' }))
    return { success: false, error: (data as { error: string }).error }
  }

  return { success: true }
}

export async function deleteEvent(eventId: string): Promise<{ success: boolean; error?: string }> {
  const res = await authedFetch(`/events/${eventId}`, { method: 'DELETE' })
  if (!res) return { success: false, error: 'Not authenticated' }

  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: 'Failed to delete event' }))
    return { success: false, error: (data as { error: string }).error }
  }

  return { success: true }
}

export function getEventIcsUrl(eventId: string): string {
  return `${API_BASE}/events/${eventId}/ics`
}

export interface EventBriefing {
  stillHappening: boolean
  updatedDetails: string | null
  weatherNote: string | null
  whatToExpect: string
  tips: string[]
  generatedAt: string
}

export async function getEventBriefing(eventId: string): Promise<{ success: boolean; briefing?: EventBriefing; error?: string }> {
  const res = await authedFetch(`/events/${eventId}/briefing`, { method: 'POST' })
  if (!res) return { success: false, error: 'Not authenticated' }

  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: 'Failed to generate briefing' }))
    return { success: false, error: (data as { error: string }).error }
  }

  const data = await res.json() as { success: boolean; briefing: EventBriefing }
  return { success: true, briefing: data.briefing }
}
