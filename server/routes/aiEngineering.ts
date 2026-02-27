import { Router, Request, Response } from 'express'
import { HumanMessage } from '@langchain/core/messages'
import { validateSecretKey, requireAIEngineeringAuth } from '../middleware/secretKey'
import { agentGraph } from '../agents/graph'
import type { CategorizedEvents, FilteredEvent } from '../agents/state'

const router = Router()

interface ChatRequest {
  message: string
  threadId?: string
}

interface ChatResponse {
  response: string
  events?: CategorizedEvents
  rejectedEvents?: FilteredEvent[]
  threadId: string
  searchDurationMs?: number
}

router.post('/auth', (req: Request, res: Response) => {
  validateSecretKey(req, res)
})

router.post('/chat', requireAIEngineeringAuth, async (req: Request, res: Response) => {
  const startTime = Date.now()
  const { message, threadId } = req.body as ChatRequest

  if (!message?.trim()) {
    res.status(400).json({ error: 'Message is required' })
    return
  }

  const currentThreadId = threadId ?? crypto.randomUUID()

  try {
    const result = await agentGraph.invoke(
      {
        messages: [new HumanMessage(message)],
        userQuery: message,
      },
      {
        configurable: { thread_id: currentThreadId },
      }
    )

    const lastMessage = result.messages[result.messages.length - 1]
    const responseText = typeof lastMessage?.content === 'string'
      ? lastMessage.content
      : result.summary || 'I was unable to process your request. Please try again.'

    const hasEvents = Object.keys(result.categorizedEvents ?? {}).length > 0

    const response: ChatResponse = {
      response: responseText,
      threadId: currentThreadId,
      searchDurationMs: Date.now() - startTime,
    }

    if (hasEvents) {
      response.events = result.categorizedEvents
    }

    const rejectedEvents = result.rejectedEvents ?? []
    if (rejectedEvents.length > 0) {
      response.rejectedEvents = rejectedEvents
    }

    res.json(response)
  } catch (error) {
    console.error('Chat endpoint error:', error)

    const isApiKeyError = error instanceof Error && (
      error.message.includes('API key') ||
      error.message.includes('authentication') ||
      error.message.includes('401')
    )

    if (isApiKeyError) {
      res.status(503).json({
        error: 'AI service not configured. API keys may be missing.',
        threadId: currentThreadId,
      })
      return
    }

    res.status(500).json({
      error: 'Failed to process message',
      threadId: currentThreadId,
    })
  }
})

router.get('/health', (_req: Request, res: Response) => {
  const hasAnthropicKey = Boolean(process.env['ANTHROPIC_API_KEY'])
  const hasOpenAIKey = Boolean(process.env['OPENAI_API_KEY'])
  const hasTavilyKey = Boolean(process.env['TAVILY_API_KEY'])
  const hasSecretKey = Boolean(process.env['AI_ENGINEERING_SECRET_KEY'])

  res.json({
    status: 'ok',
    module: 'ai-engineering',
    keys: {
      anthropic: hasAnthropicKey,
      openai: hasOpenAIKey,
      tavily: hasTavilyKey,
      secretKey: hasSecretKey,
    },
  })
})

export default router
