import { Router, Request, Response } from 'express'
import { HumanMessage } from '@langchain/core/messages'
import { validateSecretKey, requireAIEngineeringAuth } from '../middleware/secretKey'
import { compileGraph, agentGraph } from '../agents/graph'
import type { CategorizedEvents, FilteredEvent } from '../agents/state'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let compiledGraph: any = null

async function getGraph() {
  if (compiledGraph) return compiledGraph
  try {
    compiledGraph = await compileGraph()
    return compiledGraph
  } catch (err) {
    console.warn('Memory-enabled graph failed to compile, falling back to stateless graph:', err)
    return agentGraph
  }
}

const router: Router = Router()

interface LangfuseScore {
  id: string
  traceId: string
  name: string
  value: number
  comment: string | null
  observationId: string | null
  source: string
  createdAt: string
}

interface TraceDetail {
  id: string
  input: Record<string, unknown> | null
  output: Record<string, unknown> | null
  metadata: Record<string, unknown> | null
  createdAt: string
}

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
    const graph = await getGraph()
    const result = await graph.invoke(
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
  const ragasMetrics = ['faithfulness', 'answer_relevancy', 'context_precision', 'context_recall']

  try {
    const allScores: LangfuseScore[] = []
    let page = 1
    let hasMore = true
    while (hasMore && page <= 10) {
      const scoresRes = await fetch(
        `${baseUrl}/api/public/scores?limit=100&page=${page}`,
        { headers: { Authorization: authHeader } }
      )
      if (!scoresRes.ok) {
        const errorBody = await scoresRes.text().catch(() => 'no body')
        console.error(`Langfuse scores API returned ${scoresRes.status}: ${errorBody}`)
        res.status(502).json({ error: `Failed to fetch scores from Langfuse (${scoresRes.status})` })
        return
      }
      const body = await scoresRes.json() as { data: LangfuseScore[] }
      if (body.data.length === 0) {
        hasMore = false
      } else {
        allScores.push(...body.data)
        page++
      }
    }

    const ragasScores = allScores.filter(s => ragasMetrics.includes(s.name))

    const traceMap = new Map<string, TraceDetail>()
    let tracePage = 1
    let traceHasMore = true
    while (traceHasMore && tracePage <= 5) {
      const tracesRes = await fetch(
        `${baseUrl}/api/public/traces?limit=100&page=${tracePage}&environment=sdk-experiment`,
        { headers: { Authorization: authHeader } }
      )
      if (!tracesRes.ok) break
      const tracesBody = await tracesRes.json() as { data: TraceDetail[] }
      if (tracesBody.data.length === 0) {
        traceHasMore = false
      } else {
        for (const trace of tracesBody.data) {
          traceMap.set(trace.id, trace)
        }
        tracePage++
      }
    }

    const runsByRetriever = new Map<string, {
      scores: LangfuseScore[]
      traces: TraceDetail[]
    }>()

    for (const score of ragasScores) {
      const trace = traceMap.get(score.traceId)
      if (!trace) continue
      const retriever = (trace.metadata as Record<string, unknown> | null)?.['retriever'] as string || 'naive'

      if (!runsByRetriever.has(retriever)) {
        runsByRetriever.set(retriever, { scores: [], traces: [] })
      }
      const run = runsByRetriever.get(retriever)!
      run.scores.push(score)
    }

    for (const trace of traceMap.values()) {
      const retriever = (trace.metadata as Record<string, unknown> | null)?.['retriever'] as string || 'naive'
      const run = runsByRetriever.get(retriever)
      if (run && !run.traces.some(t => t.id === trace.id)) {
        run.traces.push(trace)
      }
    }

    const runs = [...runsByRetriever.entries()].map(([retriever, run]) => {
      const metricAgg: Record<string, number[]> = {}
      for (const name of ragasMetrics) metricAgg[name] = []

      for (const score of run.scores) {
        if (typeof score.value === 'number' && metricAgg[score.name]) {
          metricAgg[score.name]!.push(score.value)
        }
      }

      const metrics = ragasMetrics.map(name => {
        const values = metricAgg[name] ?? []
        if (values.length === 0) return { name, mean: 0, min: 0, max: 0, count: 0 }
        const mean = values.reduce((a, b) => a + b, 0) / values.length
        return {
          name,
          mean: parseFloat(mean.toFixed(4)),
          min: parseFloat(Math.min(...values).toFixed(4)),
          max: parseFloat(Math.max(...values).toFixed(4)),
          count: values.length,
        }
      })

      const scoresByTrace: Record<string, { scores: Record<string, number>; comments: Record<string, string> }> = {}
      for (const score of run.scores) {
        if (!scoresByTrace[score.traceId]) {
          scoresByTrace[score.traceId] = { scores: {}, comments: {} }
        }
        scoresByTrace[score.traceId]!.scores[score.name] = score.value
        if (score.comment) {
          scoresByTrace[score.traceId]!.comments[score.name] = score.comment
        }
      }

      const items = run.traces.map(trace => {
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

      const latestTrace = run.traces.length > 0
        ? run.traces.reduce((a, b) => (a.createdAt > b.createdAt ? a : b))
        : null

      return {
        experiment: {
          name: `RAGAS Eval - ${retriever}`,
          retriever,
          model: 'claude-sonnet-4-20250514',
          topK: 8,
          runTimestamp: latestTrace?.createdAt ?? null,
          langfuseUrl: baseUrl,
        },
        metrics,
        items,
      }
    })

    res.json({ runs })
  } catch (error) {
    console.error('Eval results fetch error:', error)
    res.status(500).json({ error: 'Failed to fetch evaluation results' })
  }
})

router.get('/eval/dataset', requireAIEngineeringAuth, async (_req: Request, res: Response) => {
  try {
    const { goldenDataset } = await import('../eval/goldenDataset')
    const items = (goldenDataset as unknown as Array<{
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
