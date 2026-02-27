import { ChatAnthropic } from '@langchain/anthropic'
import { AIMessage } from '@langchain/core/messages'
import { z } from 'zod'
import { GraphState, type GraphStateType, type UserFilters } from './state'

const SupervisorDecisionSchema = z.object({
  isSearchRequest: z.boolean(),
  city: z.string().nullish(),
  filters: z.object({
    free: z.boolean().default(false),
    noAlcohol: z.boolean().default(false),
    familyFriendly: z.boolean().default(false),
    secular: z.boolean().default(false),
    apolitical: z.boolean().default(false),
    customFilters: z.array(z.string()).default([]),
  }).nullish(),
  searchQueries: z.array(z.string()),
  directResponse: z.string().nullish(),
})

interface SupervisorDecision {
  isSearchRequest: boolean
  city?: string
  filters?: {
    free: boolean
    noAlcohol: boolean
    familyFriendly: boolean
    secular: boolean
    apolitical: boolean
    customFilters: string[]
  }
  searchQueries: string[]
  directResponse?: string
}

function getSupervisorSystemPrompt(): string {
  const now = new Date()
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  return `You are the supervisor agent for AI Powered Event Sourcer, an AI-powered community event discovery system. Your job is to analyze user messages and decide the next action.

Today's date is ${dateStr}.

When a user asks about finding events:
1. Extract the city they want to search in
2. Extract values-based filters (free, no alcohol, family-friendly, secular, apolitical)
3. Generate 3-5 targeted search queries for different event platforms (Eventbrite, Meetup, local calendars, community boards)
4. Each search query should include the city, relevant keywords, AND a time reference (e.g. "this weekend", "March 2026", "upcoming"). Always include the current year (${now.getFullYear()}) in at least some queries to avoid stale results.
5. Prefer queries like "events this weekend in [city] ${now.getFullYear()}" over generic "events in [city]"

When a user sends a conversational message (greeting, follow-up question, general chat):
1. Respond directly and helpfully
2. If they seem interested in events, ask about their city and preferences

Always be helpful, concise, and focused on helping users find safe community events.`
}

function createSupervisorModel(): ChatAnthropic {
  return new ChatAnthropic({
    model: 'claude-sonnet-4-20250514',
    temperature: 0,
    maxTokens: 4096,
  })
}

export async function supervisorNode(
  state: GraphStateType
): Promise<Partial<typeof GraphState.State>> {
  const model = createSupervisorModel()

  const lastMessage = state.messages[state.messages.length - 1]
  const userQuery = typeof lastMessage?.content === 'string'
    ? lastMessage.content
    : state.userQuery

  const response = await model.invoke([
    { role: 'system', content: getSupervisorSystemPrompt() },
    {
      role: 'user',
      content: `Analyze this message and respond with JSON matching this schema:
{
  "isSearchRequest": boolean,
  "city": string | null,
  "filters": { "free": boolean, "noAlcohol": boolean, "familyFriendly": boolean, "secular": boolean, "apolitical": boolean, "customFilters": string[] } | null,
  "searchQueries": string[],
  "directResponse": string | null
}

User message: ${userQuery}`,
    },
  ])

  const content = typeof response.content === 'string'
    ? response.content
    : Array.isArray(response.content)
      ? response.content.map(block => ('text' in block ? block.text : '')).join('')
      : ''
  let decision: SupervisorDecision

  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    const raw = jsonMatch ? JSON.parse(jsonMatch[0]) : null
    decision = SupervisorDecisionSchema.parse(raw) as SupervisorDecision
  } catch {
    return {
      messages: [new AIMessage(content || 'How can I help you find community events today?')],
      status: 'complete',
      summary: content,
    }
  }

  if (!decision.isSearchRequest) {
    const directResponse = decision.directResponse ?? 'How can I help you find community events today?'
    return {
      messages: [new AIMessage(directResponse)],
      status: 'complete',
      summary: directResponse,
    }
  }

  const city = decision.city ?? 'Unknown City'
  const rawFilters = decision.filters
  const customFilters = rawFilters?.customFilters
  const filters: UserFilters = {
    city,
    free: rawFilters?.free ?? false,
    noAlcohol: rawFilters?.noAlcohol ?? false,
    familyFriendly: rawFilters?.familyFriendly ?? false,
    secular: rawFilters?.secular ?? false,
    apolitical: rawFilters?.apolitical ?? false,
    ...(customFilters ? { customFilters } : {}),
  }

  return {
    userQuery,
    userFilters: filters,
    searchQueries: decision.searchQueries,
    status: 'researching',
  }
}
