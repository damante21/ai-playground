import { ChatOpenAI } from '@langchain/openai'
import { AIMessage } from '@langchain/core/messages'
import { HumanMessage, ToolMessage } from '@langchain/core/messages'
import { GraphState, type GraphStateType, type RawEvent } from './state'
import { tavilySearchTool } from '../tools/tavily'

const MAX_TOOL_ROUNDS = 3

function createResearcherModel(): ChatOpenAI {
  return new ChatOpenAI({
    model: 'gpt-4o-mini',
    temperature: 0,
  })
}

function getResearcherSystemPrompt(): string {
  const now = new Date()
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  return `You are a research assistant that finds community events. Today's date is ${dateStr}.

You have access to a web search tool. Use it to search for events matching the user's criteria. You may call the tool multiple times with different queries to get broader coverage.

After gathering search results, synthesize them into a JSON array of events. Only include results that are actual events (not articles, not venue listings). Only include events that have not yet occurred.

Each event object must have: title, description, date, url, source (website name), venue (if mentioned), city.

When you are done searching, respond with ONLY a JSON array of events. No other text.`
}

async function executeResearch(queries: string[], city: string): Promise<RawEvent[]> {
  const model = createResearcherModel().bindTools([tavilySearchTool])

  const userContent = `Search for community events in ${city}. Here are suggested search queries to try:\n${queries.map((q, i) => `${i + 1}. ${q}`).join('\n')}\n\nUse the tavily_search tool to search for events, then compile the results into a JSON array.`

  const messages: Array<HumanMessage | AIMessage | ToolMessage> = [
    new HumanMessage(userContent),
  ]

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await model.invoke([
      { role: 'system', content: getResearcherSystemPrompt() },
      ...messages,
    ])

    messages.push(response)

    const toolCalls = response.tool_calls
    if (!toolCalls || toolCalls.length === 0) {
      break
    }

    for (const tc of toolCalls) {
      const result = await tavilySearchTool.invoke(tc.args)
      messages.push(new ToolMessage({
        content: typeof result === 'string' ? result : JSON.stringify(result),
        tool_call_id: tc.id ?? '',
      }))
    }
  }

  const lastAI = [...messages].reverse().find(m => m instanceof AIMessage)
  if (!lastAI) return []

  const content = typeof lastAI.content === 'string'
    ? lastAI.content
    : Array.isArray(lastAI.content)
      ? lastAI.content.map(block => ('text' in block ? block.text : '')).join('')
      : ''

  try {
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

  const allEvents = await executeResearch(queries, city)

  return {
    rawEvents: allEvents,
    messages: [
      new AIMessage(`Found ${allEvents.length} potential events across tool-assisted searches.`),
    ],
    status: 'filtering',
  }
}
