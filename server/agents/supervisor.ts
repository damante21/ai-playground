import { ChatAnthropic } from '@langchain/anthropic'
import { AIMessage, HumanMessage, type BaseMessage } from '@langchain/core/messages'
import { z } from 'zod'
import { GraphState, type GraphStateType, type UserFilters } from './state'

const MAX_HISTORY_MESSAGES = 10

const SupervisorDecisionSchema = z.object({
  thinking: z.string(),
  isSearchRequest: z.boolean(),
  isRefinementRequest: z.boolean().default(false),
  refinementCriteria: z.string().nullish(),
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
  thinking: string
  isSearchRequest: boolean
  isRefinementRequest: boolean
  refinementCriteria?: string
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

When a user wants to refine previous results (e.g., "show me only the free ones", "any outdoor events?", "which ones are in the evening?", "filter those by family-friendly"):
1. Set isRefinementRequest to true
2. Set isSearchRequest to false
3. Provide a clear refinementCriteria string describing what to filter for (e.g., "only free events", "only outdoor/active events", "only evening events after 5pm")
4. This only applies when previous search results exist in the conversation

When a user sends a conversational message (greeting, follow-up question, general chat):
1. Respond directly and helpfully
2. If they seem interested in events, ask about their city and preferences

IMPORTANT — Before deciding on an action, use the "thinking" field to reason step-by-step:
- What is the user actually asking for? Is this a new search, a refinement of previous results, or a conversational message?
- If it's a search: what's the best way to interpret their intent? For ambiguous queries (e.g., "cycling" could mean cycling events, bike-related meetups, outdoor recreation), consider multiple angles and generate diverse search queries that cover the possibilities.
- If the query mentions a specific activity, consider related terms and broader categories that would surface relevant results.
- If the user has preferences or past episodes, how should those influence the search strategy?

Always be helpful, concise, and focused on helping users find safe community events.`
}

function createSupervisorModel(): ChatAnthropic {
  return new ChatAnthropic({
    model: 'claude-sonnet-4-20250514',
    temperature: 0,
    maxTokens: 4096,
  })
}

function buildConversationHistory(messages: BaseMessage[]): Array<{ role: 'user' | 'assistant'; content: string }> {
  const recent = messages.slice(-MAX_HISTORY_MESSAGES)
  return recent
    .filter(msg => {
      const content = typeof msg.content === 'string' ? msg.content : ''
      return content.trim().length > 0
    })
    .map(msg => ({
      role: (msg instanceof HumanMessage ? 'user' : 'assistant') as 'user' | 'assistant',
      content: typeof msg.content === 'string' ? msg.content : '',
    }))
}

export async function supervisorNode(
  state: GraphStateType
): Promise<Partial<typeof GraphState.State>> {
  const model = createSupervisorModel()

  const lastMessage = state.messages[state.messages.length - 1]
  const userQuery = typeof lastMessage?.content === 'string'
    ? lastMessage.content
    : state.userQuery

  const history = buildConversationHistory(state.messages.slice(0, -1))
  const historyBlock = history.length > 0
    ? `\n\nConversation history (for context):\n${history.map(m => `${m.role}: ${m.content}`).join('\n')}\n\n`
    : ''

  const prefBlock = state.preferenceContext
    ? `\n\nUser preferences (learned from past interactions):\n${state.preferenceContext}\nUse these to personalize search queries and prioritize results the user is likely to enjoy.\n\n`
    : ''

  const episodicBlock = state.episodicContext
    ? `\n\nPast successful recommendations (events the user saved):\n${state.episodicContext}\nUse these as examples of what this user enjoys. Generate search queries that would find similar events.\n\n`
    : ''

  const response = await model.invoke([
    { role: 'system', content: getSupervisorSystemPrompt() },
    {
      role: 'user',
      content: `Analyze this message and respond with JSON matching this schema. IMPORTANT: Fill "thinking" FIRST with your step-by-step reasoning before deciding on the action fields.
{
  "thinking": string,
  "isSearchRequest": boolean,
  "isRefinementRequest": boolean,
  "refinementCriteria": string | null,
  "city": string | null,
  "filters": { "free": boolean, "noAlcohol": boolean, "familyFriendly": boolean, "secular": boolean, "apolitical": boolean, "customFilters": string[] } | null,
  "searchQueries": string[],
  "directResponse": string | null
}
${historyBlock}${prefBlock}${episodicBlock}Current user message: ${userQuery}`,
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
    if (decision.thinking) {
      console.log(`[Supervisor Think] ${decision.thinking}`)
    }
  } catch {
    return {
      messages: [new AIMessage(content || 'How can I help you find community events today?')],
      status: 'complete',
      summary: content,
    }
  }

  if (decision.isRefinementRequest && decision.refinementCriteria) {
    const hasPreviousResults = state.filteredEvents.length > 0 || Object.keys(state.categorizedEvents ?? {}).length > 0
    if (hasPreviousResults) {
      return {
        userQuery,
        refinementCriteria: decision.refinementCriteria,
        status: 'refining',
      }
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
    rawEvents: [],
    filteredEvents: [],
    rejectedEvents: [],
    categorizedEvents: {},
    status: 'researching',
  }
}
