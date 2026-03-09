import { useState, useCallback, useRef } from 'react'
import { sendChatMessage, type ChatResponseData, type EventData } from '../lib/api'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  events?: ChatResponseData['events']
  rejectedEvents?: EventData[]
  searchDurationMs?: number
  timestamp: Date
}

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const threadIdRef = useRef<string | undefined>(undefined)

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoading) return

    setError(null)

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMessage])
    setIsLoading(true)

    const result = await sendChatMessage(content.trim(), threadIdRef.current)

    if (!result.success) {
      setError(result.error ?? 'Something went wrong')
      setIsLoading(false)
      return
    }

    if (result.data) {
      threadIdRef.current = result.data.threadId

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: result.data.response,
        events: result.data.events,
        rejectedEvents: result.data.rejectedEvents,
        searchDurationMs: result.data.searchDurationMs,
        timestamp: new Date(),
      }

      setMessages(prev => [...prev, assistantMessage])
    }

    setIsLoading(false)
  }, [isLoading])

  const clearMessages = useCallback(() => {
    setMessages([])
    setError(null)
    threadIdRef.current = undefined
  }, [])

  return { messages, isLoading, error, sendMessage, clearMessages, threadId: threadIdRef.current }
}
