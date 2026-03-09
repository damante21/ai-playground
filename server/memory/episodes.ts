import { getStore } from './store'

export interface Episode {
  query: string
  city: string
  filters: Record<string, boolean>
  savedEventTitle: string
  savedEventCategory: string | null
  confidence: number
  timestamp: string
}

function getNamespace(userId: string): [string, string] {
  return ['ai-engineering-episodes', userId]
}

export async function recordEpisode(userId: string, episode: Episode): Promise<void> {
  try {
    const store = await getStore()
    const key = crypto.randomUUID()
    await store.put(getNamespace(userId), key, episode)
  } catch (error) {
    console.error('Failed to record episode:', error)
  }
}

export async function retrieveSimilarEpisodes(
  userId: string,
  query: string,
  limit = 3
): Promise<Episode[]> {
  try {
    const store = await getStore()
    const results = await store.search(getNamespace(userId), { query, limit })
    if (!results || results.length === 0) return []
    return results.map((r: { value: Episode }) => r.value)
  } catch (error) {
    console.error('Failed to retrieve similar episodes:', error)
    return []
  }
}

export function formatEpisodesForPrompt(episodes: Episode[]): string | null {
  if (episodes.length === 0) return null

  const blocks = episodes.map((ep, i) => {
    const filterList = Object.entries(ep.filters)
      .filter(([, v]) => v)
      .map(([k]) => k)
    const filterStr = filterList.length > 0 ? filterList.join(', ') : 'none'

    return `Example ${i + 1}:
  Query: "${ep.query}"
  City: ${ep.city}
  Filters: ${filterStr}
  Saved event: "${ep.savedEventTitle}" (${ep.savedEventCategory ?? 'uncategorized'}, ${Math.round(ep.confidence * 100)}% confidence)`
  })

  return blocks.join('\n')
}
