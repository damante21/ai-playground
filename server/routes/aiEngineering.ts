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

router.get('/eval/results', requireAIEngineeringAuth, async (_req: Request, res: Response) => {
  const publicKey = process.env['LANGFUSE_PUBLIC_KEY']
  const secretKey = process.env['LANGFUSE_SECRET_KEY']
  const baseUrl = process.env['LANGFUSE_BASE_URL'] || 'https://us.cloud.langfuse.com'

  if (!publicKey || !secretKey) {
    res.status(503).json({ error: 'Langfuse API keys not configured' })
    return
  }

  const authHeader = 'Basic ' + Buffer.from(`${publicKey}:${secretKey}`).toString('base64')

  try {
    const scoresRes = await fetch(`${baseUrl}/api/public/scores?limit=100`, {
      headers: { Authorization: authHeader },
    })

    if (!scoresRes.ok) {
      const errorBody = await scoresRes.text().catch(() => 'no body')
      console.error(`Langfuse scores API returned ${scoresRes.status}: ${errorBody}`)
      res.status(502).json({ error: `Failed to fetch scores from Langfuse (${scoresRes.status})` })
      return
    }

    const scoresData = await scoresRes.json() as {
      data: Array<{
        id: string
        traceId: string
        name: string
        value: number
        comment: string | null
        observationId: string | null
        source: string
        createdAt: string
      }>
    }

    const ragasMetrics = ['faithfulness', 'answer_relevancy', 'context_precision', 'context_recall']
    const ragasScores = scoresData.data.filter(
      (s: { name: string }) => ragasMetrics.includes(s.name)
    )

    const traceIds = [...new Set(ragasScores.map((s: { traceId: string }) => s.traceId))]

    const traceDetails: Array<{
      id: string
      input: Record<string, unknown> | null
      output: Record<string, unknown> | null
      metadata: Record<string, unknown> | null
      createdAt: string
    }> = []

    for (const traceId of traceIds.slice(0, 20)) {
      try {
        const traceRes = await fetch(`${baseUrl}/api/public/traces/${traceId}`, {
          headers: { Authorization: authHeader },
        })
        if (traceRes.ok) {
          const trace = await traceRes.json() as {
            id: string
            input: Record<string, unknown> | null
            output: Record<string, unknown> | null
            metadata: Record<string, unknown> | null
            createdAt: string
          }
          traceDetails.push(trace)
        }
      } catch {
        // skip individual trace fetch failures
      }
    }

    interface MetricAgg {
      values: number[]
    }
    const metricAgg: Record<string, MetricAgg> = {}
    for (const name of ragasMetrics) {
      metricAgg[name] = { values: [] }
    }

    for (const score of ragasScores) {
      if (typeof score.value === 'number' && metricAgg[score.name]) {
        metricAgg[score.name]?.values.push(score.value)
      }
    }

    const metrics = ragasMetrics.map(name => {
      const agg = metricAgg[name]
      const values = agg?.values ?? []
      if (values.length === 0) {
        return { name, mean: 0, min: 0, max: 0, count: 0 }
      }
      const mean = values.reduce((a, b) => a + b, 0) / values.length
      return {
        name,
        mean: parseFloat(mean.toFixed(4)),
        min: parseFloat(Math.min(...values).toFixed(4)),
        max: parseFloat(Math.max(...values).toFixed(4)),
        count: values.length,
      }
    })

    interface ScoresByTrace {
      scores: Record<string, number>
      comments: Record<string, string>
    }
    const scoresByTrace: Record<string, ScoresByTrace> = {}
    for (const score of ragasScores) {
      if (!scoresByTrace[score.traceId]) {
        scoresByTrace[score.traceId] = { scores: {}, comments: {} }
      }
      const entry = scoresByTrace[score.traceId] as ScoresByTrace
      entry.scores[score.name] = score.value
      if (score.comment) {
        entry.comments[score.name] = score.comment
      }
    }

    const items = traceDetails.map(trace => {
      const input = (trace.input ?? {}) as Record<string, unknown>
      const output = (trace.output ?? {}) as Record<string, unknown>
      const traceScores = scoresByTrace[trace.id]

      const userFilters = (input['userFilters'] ?? {}) as Record<string, boolean>
      const activeFilters = Object.entries(userFilters)
        .filter(([key, val]) => val === true && key !== 'city')
        .map(([key]) => key)

      return {
        userQuery: (input['userQuery'] as string) || 'Unknown query',
        activeFilters,
        actualPass: (output['filteredTitles'] as string[]) || [],
        actualReject: (output['rejectedTitles'] as string[]) || [],
        scores: traceScores?.scores ?? {},
        comments: traceScores?.comments ?? {},
      }
    })

    const latestTrace = traceDetails.length > 0
      ? traceDetails.reduce((a, b) => (a.createdAt > b.createdAt ? a : b))
      : null

    res.json({
      experiment: {
        name: 'RAGAS Baseline - Naive Retriever',
        retriever: 'naive',
        model: 'claude-sonnet-4-20250514',
        topK: 8,
        runTimestamp: latestTrace?.createdAt ?? null,
        langfuseUrl: `${baseUrl}`,
      },
      metrics,
      items,
    })
  } catch (error) {
    console.error('Eval results fetch error:', error)
    res.status(500).json({ error: 'Failed to fetch evaluation results' })
  }
})

router.get('/eval/dataset', requireAIEngineeringAuth, (_req: Request, res: Response) => {
  try {
    const { goldenDataset } = require('../eval/goldenDataset')
    const items = (goldenDataset as Array<{
      input: { userQuery: string; userFilters: Record<string, unknown>; rawEvents: Array<{ title: string }> }
      expectedOutput: { relevantHeuristicCategories: string[]; expectedPassTitles: string[]; expectedRejectTitles: string[]; groundTruthReasoning: string }
    }>).map((item, index) => {
      const filters = item.input.userFilters
      const activeFilters = Object.entries(filters)
        .filter(([key, val]) => val === true && key !== 'city')
        .map(([key]) => key)

      return {
        id: index + 1,
        userQuery: item.input.userQuery,
        activeFilters,
        eventCount: item.input.rawEvents.length,
        expectedPass: item.expectedOutput.expectedPassTitles,
        expectedReject: item.expectedOutput.expectedRejectTitles,
        relevantCategories: item.expectedOutput.relevantHeuristicCategories,
        groundTruthReasoning: item.expectedOutput.groundTruthReasoning,
      }
    })

    res.json({ count: items.length, items })
  } catch (error) {
    console.error('Eval dataset fetch error:', error)
    res.status(500).json({ error: 'Failed to load golden dataset' })
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
