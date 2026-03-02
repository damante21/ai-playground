import { ChatAnthropic } from '@langchain/anthropic'
import { naiveRetrieve, type RetrievedHeuristic } from './naive'

const queryModel = new ChatAnthropic({
  model: 'claude-sonnet-4-20250514',
  temperature: 0.7,
  maxTokens: 256,
})

async function generateQueryVariations(query: string): Promise<string[]> {
  const response = await queryModel.invoke([
    {
      role: 'system',
      content: `You generate alternative search queries for a knowledge base of event-filtering heuristics (alcohol, religion, politics, cost, family-friendliness).
Given a query, produce exactly 3 reformulations that approach the same intent from different angles.
Return ONLY a JSON array of 3 strings. No explanation.`,
    },
    { role: 'user', content: query },
  ])

  const content = typeof response.content === 'string' ? response.content : ''

  try {
    const parsed = JSON.parse(content) as string[]
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.slice(0, 3)
    }
  } catch {
    const lines = content.split('\n').filter(l => l.trim().length > 5)
    if (lines.length > 0) return lines.slice(0, 3)
  }

  return [query]
}

export async function multiQueryRetrieve(
  query: string,
  topK: number = 6,
  categoryFilter?: string[]
): Promise<RetrievedHeuristic[]> {
  const variations = await generateQueryVariations(query)
  const allQueries = [query, ...variations]

  const resultSets = await Promise.all(
    allQueries.map(q => naiveRetrieve(q, topK, categoryFilter))
  )

  const seen = new Map<number, RetrievedHeuristic>()
  for (const results of resultSets) {
    for (const h of results) {
      const existing = seen.get(h.id)
      if (!existing || h.similarity > existing.similarity) {
        seen.set(h.id, h)
      }
    }
  }

  return [...seen.values()]
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK)
}
