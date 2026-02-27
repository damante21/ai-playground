import { ChatOpenAI } from '@langchain/openai'
import { AIMessage } from '@langchain/core/messages'
import { GraphState, type GraphStateType, type RawEvent } from './state'
import { tavilySearch } from '../tools/tavily'

function createResearcherModel(): ChatOpenAI {
  return new ChatOpenAI({
    model: 'gpt-4o-mini',
    temperature: 0,
  })
}

async function executeResearch(query: string, city: string): Promise<RawEvent[]> {
  const results = await tavilySearch(query)

  const model = createResearcherModel()
  const response = await model.invoke([
    {
      role: 'system',
      content: `You are a research assistant parsing web search results for community events. Extract structured event data from the search results. Only include results that are actual events (not articles about events, not venue listings without specific events). Return a JSON array of events.

Today's date is ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}. Only include events that have not yet occurred. Discard any event whose date is clearly in the past.

Each event should have: title, description, date (best guess if not explicit), url, source (website name), venue (if mentioned), city.

If a result is not an event, skip it. If you cannot find any events, return an empty array.

Respond with ONLY a JSON array, no other text.`,
    },
    {
      role: 'user',
      content: `City: ${city}\nSearch results:\n${JSON.stringify(results, null, 2)}`,
    },
  ])

  try {
    const content = typeof response.content === 'string' ? response.content : ''
    const jsonMatch = content.match(/\[[\s\S]*\]/)
    if (!jsonMatch) return []
    const parsed = JSON.parse(jsonMatch[0]) as RawEvent[]
    return parsed.map(event => ({ ...event, city }))
  } catch {
    return []
  }
}

export async function researcherNode(
  state: GraphStateType
): Promise<Partial<typeof GraphState.State>> {
  const queries = state.searchQueries
  const city = state.userFilters?.city ?? 'Unknown'

  const results = await Promise.all(
    queries.map(query => executeResearch(query, city))
  )

  const allEvents = results.flat()

  return {
    rawEvents: allEvents,
    messages: [
      new AIMessage(`Found ${allEvents.length} potential events across ${queries.length} searches.`),
    ],
    status: 'filtering',
  }
}
