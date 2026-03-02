import { naiveRetrieve, type RetrievedHeuristic } from './naive'
import { bm25Retrieve } from './bm25'

const RRF_K = 60

export async function hybridRetrieve(
  query: string,
  topK: number = 6,
  categoryFilter?: string[]
): Promise<RetrievedHeuristic[]> {
  const [vectorResults, bm25Results] = await Promise.all([
    naiveRetrieve(query, topK * 2, categoryFilter),
    bm25Retrieve(query, topK * 2, categoryFilter),
  ])

  const rrfScores = new Map<number, { score: number; heuristic: RetrievedHeuristic }>()

  for (let rank = 0; rank < vectorResults.length; rank++) {
    const h = vectorResults[rank]
    if (!h) continue
    const rrfScore = 1 / (RRF_K + rank + 1)
    rrfScores.set(h.id, { score: rrfScore, heuristic: h })
  }

  for (let rank = 0; rank < bm25Results.length; rank++) {
    const h = bm25Results[rank]
    if (!h) continue
    const rrfScore = 1 / (RRF_K + rank + 1)
    const existing = rrfScores.get(h.id)
    if (existing) {
      existing.score += rrfScore
    } else {
      rrfScores.set(h.id, { score: rrfScore, heuristic: h })
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
