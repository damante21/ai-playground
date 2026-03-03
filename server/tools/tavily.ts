import { tavily } from '@tavily/core'
import { DynamicStructuredTool } from '@langchain/core/tools'
import { z } from 'zod'

export interface TavilyResult {
  title: string
  url: string
  content: string
}

async function searchTavily(query: string): Promise<TavilyResult[]> {
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

export const tavilySearchTool = new DynamicStructuredTool({
  name: 'tavily_search',
  description: 'Search the web for community events, activities, and gatherings. Use this tool to find events in a specific city or matching specific criteria.',
  schema: z.object({
    query: z.string().describe('The search query to find events, e.g. "free family-friendly events in Austin this weekend 2026"'),
  }),
  func: async ({ query }) => {
    const results = await searchTavily(query)
    return JSON.stringify(results, null, 2)
  },
})

export { searchTavily as tavilySearch }
