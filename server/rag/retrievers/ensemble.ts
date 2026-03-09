import { naiveRetrieve, type RetrievedHeuristic } from './naive'
import { bm25Retrieve } from './bm25'
import { multiQueryRetrieve } from './multiQuery'

const RRF_K = 60

interface WeightedSource {
  results: RetrievedHeuristic[]
  weight: number
}

/**
 * Ensemble retriever combining three signal types via weighted reciprocal rank fusion:
 * - Multi-query semantic (LLM-generated query reformulations → vector search)
 * - BM25 keyword (exact term matching for venue names, event types)
 * - Naive semantic (single-query vector search as baseline)
 *
 * Weights control relative contribution of each source.
 * Higher weight = more influence on final ranking.
 */
export async function ensembleRetrieve(
  query: string,
  topK: number = 8,
  categoryFilter?: string[]
): Promise<RetrievedHeuristic[]> {
  const fetchCount = topK * 2

  const [multiQueryResults, bm25Results, naiveResults] = await Promise.all([
    multiQueryRetrieve(query, fetchCount, categoryFilter).catch(err => {
      console.error('Ensemble: multiQuery failed, continuing with other sources:', err)
      return [] as RetrievedHeuristic[]
    }),
    bm25Retrieve(query, fetchCount, categoryFilter).catch(err => {
      console.error('Ensemble: BM25 failed, continuing with other sources:', err)
      return [] as RetrievedHeuristic[]
    }),
    naiveRetrieve(query, fetchCount, categoryFilter).catch(err => {
      console.error('Ensemble: naive failed, continuing with other sources:', err)
      return [] as RetrievedHeuristic[]
    }),
  ])

  const sources: WeightedSource[] = [
    { results: multiQueryResults, weight: 0.45 },
    { results: bm25Results, weight: 0.25 },
    { results: naiveResults, weight: 0.30 },
  ]

  const rrfScores = new Map<number, { score: number; heuristic: RetrievedHeuristic }>()

  for (const source of sources) {
    for (let rank = 0; rank < source.results.length; rank++) {
      const h = source.results[rank]
      if (!h) continue
      const rrfScore = source.weight * (1 / (RRF_K + rank + 1))
      const existing = rrfScores.get(h.id)
      if (existing) {
        existing.score += rrfScore
      } else {
        rrfScores.set(h.id, { score: rrfScore, heuristic: h })
      }
    }
  }

  return [...rrfScores.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(entry => ({
      ...entry.heuristic,
      similarity: entry.score,
    }))
}
