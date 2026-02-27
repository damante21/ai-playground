import { tavily } from '@tavily/core'

export interface TavilyResult {
  title: string
  url: string
  content: string
}

export async function tavilySearch(query: string): Promise<TavilyResult[]> {
  const client = tavily({ apiKey: process.env['TAVILY_API_KEY'] ?? '' })

  try {
    const response = await client.search(query, { maxResults: 5 })
    return response.results.map(r => ({
      title: r.title ?? '',
      url: r.url,
      content: r.content,
    }))
  } catch (error) {
    console.error('Tavily search error:', error)
    return []
  }
}
