import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  isAuthenticated,
  verifyAuth,
  clearAuth,
  fetchSavedEvents,
  updateEvent,
  deleteEvent,
  getEventIcsUrl,
  getEventBriefing,
} from '../lib/api'
import type { SavedEvent, SavedEventStatus, EventBriefing } from '../lib/api'
import AuthGate from '../components/AuthGate'

const STATUS_LABELS: Record<SavedEventStatus, string> = {
  interested: 'Interested',
  going: 'Going',
  attended: 'Attended',
  skipped: 'Skipped',
}

const STATUS_COLORS: Record<SavedEventStatus, string> = {
  interested: 'bg-yellow-400/10 text-yellow-400 border-yellow-400/20',
  going: 'bg-green-400/10 text-green-400 border-green-400/20',
  attended: 'bg-blue-400/10 text-blue-400 border-blue-400/20',
  skipped: 'bg-gray-400/10 text-gray-400 border-gray-400/20',
}

type FilterTab = 'all' | 'upcoming' | 'past'

export default function MyEventsPage() {
  const navigate = useNavigate()
  const [authed, setAuthed] = useState(false)
  const [checking, setChecking] = useState(true)
  const [events, setEvents] = useState<SavedEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<FilterTab>('all')

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

  const loadEvents = useCallback(async () => {
    setLoading(true)
    setError(null)
    const result = await fetchSavedEvents(
      activeTab === 'upcoming' ? { upcoming: true } : undefined
    )
    if (result.success && result.events) {
      setEvents(result.events)
    } else {
      setError(result.error ?? 'Failed to load events')
    }
    setLoading(false)
  }, [activeTab])

  useEffect(() => {
    if (authed) loadEvents()
  }, [authed, loadEvents])

  async function handleStatusChange(eventId: string, status: SavedEventStatus) {
    const result = await updateEvent(eventId, { status })
    if (result.success) {
      setEvents(prev => prev.map(e => e.id === eventId ? { ...e, status } : e))
    }
  }

  async function handleDelete(eventId: string) {
    const result = await deleteEvent(eventId)
    if (result.success) {
      setEvents(prev => prev.filter(e => e.id !== eventId))
    }
  }

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

  const now = new Date()
  const filteredEvents = activeTab === 'past'
    ? events.filter(e => e.start_time && new Date(e.start_time) < now)
    : events

  return (
    <div className="min-h-screen bg-gray-950">
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-semibold text-white">My Events</h1>
            <p className="text-xs text-gray-500 hidden sm:block">Events you've saved from chat</p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button
              onClick={() => navigate('/ai-engineering')}
              className="text-xs px-2 sm:px-3 py-1.5 bg-gray-800 border border-gray-700 text-gray-400 rounded-lg hover:border-gray-600 hover:text-white transition-colors"
            >
              <span className="hidden sm:inline">Back to Chat</span>
              <span className="sm:hidden">&larr; Chat</span>
            </button>
            <button
              onClick={() => { clearAuth(); setAuthed(false) }}
              className="text-xs text-gray-500 hover:text-red-400 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-gray-900 rounded-lg p-1 w-fit">
          {(['all', 'upcoming', 'past'] as FilterTab[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
                activeTab === tab
                  ? 'bg-gray-800 text-white font-medium'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {loading && (
          <div className="text-center py-12">
            <p className="text-gray-400 text-sm">Loading events...</p>
          </div>
        )}

        {error && (
          <div className="text-center py-12">
            <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-2 inline-block">
              {error}
            </p>
          </div>
        )}

        {!loading && !error && filteredEvents.length === 0 && (
          <div className="text-center py-16">
            <p className="text-gray-400 mb-2">No saved events yet</p>
            <p className="text-gray-500 text-sm mb-4">
              Search for events in the chat and save the ones you like.
            </p>
            <button
              onClick={() => navigate('/ai-engineering')}
              className="text-sm px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors"
            >
              Find Events
            </button>
          </div>
        )}

        {!loading && filteredEvents.length > 0 && (
          <div className="space-y-3">
            {filteredEvents.map(event => (
              <EventRow
                key={event.id}
                event={event}
                onStatusChange={handleStatusChange}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

function EventRow({
  event,
  onStatusChange,
  onDelete,
}: {
  event: SavedEvent
  onStatusChange: (id: string, status: SavedEventStatus) => void
  onDelete: (id: string) => void
}) {
  const [showActions, setShowActions] = useState(false)
  const [briefing, setBriefing] = useState<EventBriefing | null>(null)
  const [briefingLoading, setBriefingLoading] = useState(false)
  const [showBriefing, setShowBriefing] = useState(false)

  async function handleGetBriefing() {
    if (briefing) {
      setShowBriefing(!showBriefing)
      return
    }
    setBriefingLoading(true)
    const result = await getEventBriefing(event.id)
    if (result.success && result.briefing) {
      setBriefing(result.briefing)
      setShowBriefing(true)
    }
    setBriefingLoading(false)
  }

  const dateStr = event.start_time
    ? new Date(event.start_time).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : 'Date TBD'

  const confidenceColor = (event.confidence_score ?? 0) >= 0.9
    ? 'text-green-400'
    : (event.confidence_score ?? 0) >= 0.7
      ? 'text-yellow-400'
      : 'text-orange-400'

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-3 sm:p-4 hover:border-gray-700 transition-colors">
      <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2 mb-1">
            <h3 className="text-white font-medium text-sm leading-tight">{event.title}</h3>
            <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full border ${STATUS_COLORS[event.status]}`}>
              {STATUS_LABELS[event.status]}
            </span>
          </div>

          {event.description && (
            <p className="text-gray-400 text-xs mb-2 line-clamp-2">{event.description}</p>
          )}

          <div className="flex flex-wrap gap-x-3 sm:gap-x-4 gap-y-1 text-xs text-gray-500">
            <span>{dateStr}</span>
            {event.venue_name && <span>{event.venue_name}</span>}
            {event.venue_address && <span className="hidden sm:inline">{event.venue_address}</span>}
            {event.category && (
              <span className="text-gray-600">{event.category}</span>
            )}
            {event.confidence_score != null && (
              <span className={`font-mono ${confidenceColor}`}>
                {Math.round(event.confidence_score * 100)}% match
              </span>
            )}
          </div>

          {event.match_explanation && (
            <p className="mt-2 text-xs text-blue-400/70 italic">{event.match_explanation}</p>
          )}

          <button
            onClick={handleGetBriefing}
            disabled={briefingLoading}
            className="mt-2 text-xs text-gray-500 hover:text-gray-300 transition-colors disabled:opacity-50"
          >
            {briefingLoading ? 'Generating briefing...' : briefing ? (showBriefing ? 'Hide briefing' : 'Show briefing') : 'Get Briefing'}
          </button>

          {showBriefing && briefing && (
            <div className="mt-3 bg-gray-800/50 border border-gray-700 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${briefing.stillHappening ? 'bg-green-400' : 'bg-red-400'}`} />
                <span className="text-xs text-gray-300">
                  {briefing.stillHappening ? 'Event appears to be happening' : 'Event may have changed or been cancelled'}
                </span>
              </div>

              {briefing.updatedDetails && (
                <p className="text-xs text-yellow-400/80">{briefing.updatedDetails}</p>
              )}

              {briefing.weatherNote && (
                <p className="text-xs text-gray-400">{briefing.weatherNote}</p>
              )}

              <p className="text-xs text-gray-300">{briefing.whatToExpect}</p>

              {briefing.tips.length > 0 && (
                <ul className="space-y-1">
                  {briefing.tips.map((tip, i) => (
                    <li key={i} className="text-xs text-gray-400 flex gap-1.5">
                      <span className="text-gray-600 shrink-0">-</span>
                      {tip}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="shrink-0 flex items-center gap-1 border-t border-gray-800 pt-2 sm:border-0 sm:pt-0">
          {event.event_url && (
            <a
              href={event.event_url}
              target="_blank"
              rel="noopener noreferrer"
              title="Open event link"
              className="p-2 text-gray-500 hover:text-white hover:bg-gray-800 rounded-md transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </a>
          )}
          <a
            href={getEventIcsUrl(event.id)}
            title="Download calendar file"
            className="p-2 text-gray-500 hover:text-white hover:bg-gray-800 rounded-md transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </a>
          <div className="relative">
            <button
              onClick={() => setShowActions(!showActions)}
              className="p-2 text-gray-500 hover:text-white hover:bg-gray-800 rounded-md transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="5" r="1.5" />
                <circle cx="12" cy="12" r="1.5" />
                <circle cx="12" cy="19" r="1.5" />
              </svg>
            </button>
            {showActions && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowActions(false)} />
                <div className="absolute right-0 top-full mt-1 z-20 bg-gray-800 border border-gray-700 rounded-lg shadow-xl py-1 w-36">
                  {(Object.keys(STATUS_LABELS) as SavedEventStatus[])
                    .filter(s => s !== event.status)
                    .map(status => (
                      <button
                        key={status}
                        onClick={() => { onStatusChange(event.id, status); setShowActions(false) }}
                        className="w-full text-left px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-700 transition-colors"
                      >
                        Mark as {STATUS_LABELS[status]}
                      </button>
                    ))}
                  <hr className="border-gray-700 my-1" />
                  <button
                    onClick={() => { onDelete(event.id); setShowActions(false) }}
                    className="w-full text-left px-3 py-1.5 text-xs text-red-400 hover:bg-gray-700 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
