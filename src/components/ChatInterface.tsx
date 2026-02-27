import { useState, useRef, useEffect, type FormEvent, type KeyboardEvent } from 'react'
import { useChat } from '../hooks/useChat'
import { clearAuth } from '../lib/api'
import ChatMessage from './ChatMessage'

interface ChatInterfaceProps {
  onLogout: () => void
}

export default function ChatInterface({ onLogout }: ChatInterfaceProps) {
  const { messages, isLoading, error, sendMessage, clearMessages } = useChat()
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!input.trim() || isLoading) return
    sendMessage(input)
    setInput('')
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  function handleLogout() {
    clearAuth()
    onLogout()
  }

  const hasMessages = messages.length > 0

  const inputBar = (
    <form onSubmit={handleSubmit} className="max-w-3xl mx-auto w-full px-4 py-3">
      <div className="flex items-end gap-3">
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Describe the events you're looking for..."
          rows={1}
          className="flex-1 resize-none px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="px-5 py-3 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Send
        </button>
      </div>
    </form>
  )

  return (
    <div className="flex flex-col h-screen bg-gray-950 fixed inset-0 z-10">
      {/* Header */}
      <header className="shrink-0 border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-white">AI Powered Event Sourcer</h1>
            <p className="text-xs text-gray-500">AI-powered community event discovery</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={clearMessages}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              Clear chat
            </button>
            <button
              onClick={handleLogout}
              className="text-xs text-gray-500 hover:text-red-400 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {!hasMessages ? (
        /* Welcome state — vertically centered with input directly below */
        <div className="flex-1 flex flex-col items-center justify-center px-4">
          <div className="text-center mb-8">
            <h2 className="text-xl font-semibold text-white mb-2">Find your next community event</h2>
            <p className="text-gray-400 text-sm max-w-md mx-auto mb-6">
              Tell me your city and what matters to you — free, alcohol-free, family-friendly, secular, or anything else. I'll search across event platforms and find what fits.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {[
                'Free family-friendly events in San Francisco',
                'Secular outdoor activities in Austin',
                'Alcohol-free social events in Seattle',
              ].map(suggestion => (
                <button
                  key={suggestion}
                  onClick={() => {
                    setInput(suggestion)
                    inputRef.current?.focus()
                  }}
                  className="text-xs px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-300 hover:border-gray-600 hover:text-white transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
          {inputBar}
        </div>
      ) : (
        /* Chat state — messages scroll, input pinned to bottom */
        <>
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
              {messages.map(msg => (
                <ChatMessage key={msg.id} message={msg} />
              ))}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-gray-800 border border-gray-700 rounded-2xl rounded-bl-md px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce [animation-delay:0ms]" />
                        <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce [animation-delay:150ms]" />
                        <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce [animation-delay:300ms]" />
                      </div>
                      <span className="text-xs text-gray-500">Searching for events...</span>
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <div className="flex justify-center">
                  <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-2">
                    {error}
                  </p>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          <div className="shrink-0 border-t border-gray-800 bg-gray-900/80 backdrop-blur-sm">
            {inputBar}
          </div>
        </>
      )}
    </div>
  )
}
