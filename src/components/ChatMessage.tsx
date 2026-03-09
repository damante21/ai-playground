import { useState } from 'react'
import type { ChatMessage as ChatMessageType } from '../hooks/useChat'
import type { EventData } from '../lib/api'
import { saveEvent } from '../lib/api'

interface ChatMessageProps {
  message: ChatMessageType
  threadId?: string
  userQuery?: string
}

function EventCard({ event, threadId, userQuery }: { event: EventData; threadId?: string; userQuery?: string }) {
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  const confidenceColor = event.confidenceScore >= 0.9
    ? 'text-green-400'
    : event.confidenceScore >= 0.7
      ? 'text-yellow-400'
      : 'text-orange-400'

  async function handleSave(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (saved || saving) return

    setSaving(true)
    const result = await saveEvent({
      title: event.title,
      description: event.description,
      eventUrl: event.url,
      venueName: event.venue,
      startTime: event.date,
      category: event.city,
      confidenceScore: event.confidenceScore,
      matchExplanation: event.matchExplanation,
      sourceThreadId: threadId,
      sourceQuery: userQuery,
    })
    setSaving(false)

    if (result.success) {
      setSaved(true)
    }
  }

  return (
    <div className="relative group">
      <a
        href={event.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block bg-gray-800/50 border border-gray-700 rounded-lg p-4 hover:border-gray-600 transition-colors"
      >
        <div className="flex items-start gap-2 mb-2 pr-8">
          <span className={`text-xs font-mono ${confidenceColor} shrink-0 mt-0.5`}>
            {Math.round(event.confidenceScore * 100)}%
          </span>
          <h4 className="text-white font-medium text-sm leading-tight">{event.title}</h4>
        </div>
        <p className="text-gray-400 text-xs mb-2 line-clamp-2">{event.description}</p>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
          <span>{event.date}{event.time ? ` · ${event.time}` : ''}</span>
          {event.venue && <span>{event.venue}</span>}
          <span>{event.source}</span>
        </div>
        <p className="mt-2 text-xs text-blue-400/80 italic">{event.matchExplanation}</p>
      </a>
      <button
        onClick={handleSave}
        disabled={saved || saving}
        title={saved ? 'Saved' : 'Save event'}
        className={`absolute top-3 right-3 p-1.5 rounded-md transition-all flex items-center ${
          saved
            ? 'text-blue-400 cursor-default'
            : 'text-gray-500 hover:text-white hover:bg-gray-700 sm:opacity-0 sm:group-hover:opacity-100'
        }`}
      >
        {saving ? (
          <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill={saved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
            <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
          </svg>
        )}
        <span className="sm:hidden text-xs ml-1">{saved ? 'Saved' : 'Save'}</span>
      </button>
    </div>
  )
}

function RejectedEventRow({ event }: { event: EventData }) {
  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-3">
      <div className="flex items-start justify-between gap-2 mb-1">
        <h4 className="text-gray-400 font-medium text-xs leading-tight">{event.title}</h4>
        <span className="text-xs font-mono text-red-400/70 shrink-0">
          {Math.round(event.confidenceScore * 100)}%
        </span>
      </div>
      <p className="text-xs text-red-400/80 italic">{event.matchExplanation}</p>
    </div>
  )
}

export default function ChatMessage({ message, threadId, userQuery }: ChatMessageProps) {
  const isUser = message.role === 'user'
  const [showRejected, setShowRejected] = useState(false)
  const rejectedCount = message.rejectedEvents?.length ?? 0

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className="max-w-[85%]">
        <div
          className={`rounded-2xl px-4 py-3 ${
            isUser
              ? 'bg-blue-600 text-white rounded-br-md'
              : 'bg-gray-800 text-gray-100 rounded-bl-md border border-gray-700'
          }`}
        >
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        </div>

        {message.events && Object.keys(message.events).length > 0 && (
          <div className="mt-3 space-y-4">
            {Object.entries(message.events).map(([category, events]) => (
              <div key={category}>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  {category} ({events.length})
                </h3>
                <div className="space-y-2">
                  {events.map((event, i) => (
                    <EventCard key={`${event.title}-${i}`} event={event} threadId={threadId} userQuery={userQuery} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {rejectedCount > 0 && (
          <div className="mt-3">
            <button
              onClick={() => setShowRejected(!showRejected)}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              {showRejected ? 'Hide' : 'Show'} {rejectedCount} filtered out event{rejectedCount !== 1 ? 's' : ''}
            </button>
            {showRejected && (
              <div className="mt-2 space-y-2">
                {message.rejectedEvents?.map((event, i) => (
                  <RejectedEventRow key={`rejected-${event.title}-${i}`} event={event} />
                ))}
              </div>
            )}
          </div>
        )}

        {message.searchDurationMs !== undefined && (
          <p className="text-xs text-gray-600 mt-1 px-1">
            {(message.searchDurationMs / 1000).toFixed(1)}s
          </p>
        )}
      </div>
    </div>
  )
}
