import { ChatOpenAI } from '@langchain/openai'
import { z } from 'zod'
import type { RetrievedHeuristic } from './retrievers/naive'

const RELEVANCE_THRESHOLD = 0.3
const MIN_HEURISTICS = 6

const RerankedResultSchema = z.object({
  scores: z.array(
    z.object({
      index: z.number(),
      relevance: z.number().min(0).max(1),
      reasoning: z.string(),
    })
  ),
})

let rerankerModel: ChatOpenAI | null = null

function getRerankerModel(): ChatOpenAI {
  if (!rerankerModel) {
    rerankerModel = new ChatOpenAI({
      model: 'gpt-4o-mini',
      temperature: 0,
    })
  }
  return rerankerModel
}

/**
 * LLM-based reranker: scores each retrieved heuristic against the query,
 * drops low-relevance chunks, and returns the compressed set sorted by relevance.
 */
export async function rerankHeuristics(
  query: string,
  heuristics: RetrievedHeuristic[],
  threshold: number = RELEVANCE_THRESHOLD
): Promise<RetrievedHeuristic[]> {
  if (heuristics.length === 0) return []

  const model = getRerankerModel()

  const heuristicList = heuristics
    .map((h, i) => `[${i}] (${h.category}) ${h.title}: ${h.content}`)
    .join('\n\n')

  const response = await model.invoke([
    {
      role: 'system',
      content: `You are a relevance judge for a values-based event filtering system. Given a retrieval query and a set of filtering heuristics, score each heuristic's relevance to the query on a 0-1 scale.

A heuristic is relevant if it would help an agent decide whether an event passes or fails the user's value-based filters (alcohol-free, secular, apolitical, free, family-friendly).

Scoring guide:
- 0.8-1.0: Directly addresses the query's filter criteria with actionable guidance
- 0.5-0.7: Related to the query but only partially applicable
- 0.2-0.4: Tangentially related, unlikely to help with this specific query
- 0.0-0.1: Unrelated to the query

Respond with JSON matching this schema:
{
  "scores": [
    { "index": number, "relevance": number, "reasoning": string }
  ]
}

Score EVERY heuristic. Keep reasoning to one sentence.`,
    },
    {
      role: 'user',
      content: `Query: ${query}\n\nHeuristics to score:\n${heuristicList}`,
    },
  ])

  const content = typeof response.content === 'string' ? response.content : ''

  try {
    const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const parsed = RerankedResultSchema.parse(JSON.parse(cleaned))

    const allScored = parsed.scores
      .map(score => {
        const heuristic = heuristics[score.index]
        if (!heuristic) return null
        return { ...heuristic, similarity: score.relevance, rerankScore: score.relevance }
      })
      .filter((h): h is RetrievedHeuristic & { rerankScore: number } => h !== null)
      .sort((a, b) => b.rerankScore - a.rerankScore)

    const aboveThreshold = allScored.filter(h => h.rerankScore >= threshold)

    const kept = aboveThreshold.length >= MIN_HEURISTICS
      ? aboveThreshold
      : allScored.slice(0, MIN_HEURISTICS)

    const result = kept.map(({ rerankScore: _, ...h }) => h)

    console.log(
      `[Reranker] ${heuristics.length} → ${result.length} heuristics (threshold ${threshold}, floor ${MIN_HEURISTICS}, dropped ${heuristics.length - result.length})`
    )

    return result
  } catch (error) {
    console.error('Reranker parse failed, returning original results:', error)
    return heuristics
  }
}
