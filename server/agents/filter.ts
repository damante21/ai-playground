import { ChatAnthropic } from '@langchain/anthropic'
import { AIMessage } from '@langchain/core/messages'
import { z } from 'zod'
import { GraphState, type GraphStateType, type FilteredEvent, type UserFilters } from './state'

const FilterResultSchema = z.object({
  events: z.array(z.object({
    title: z.string(),
    description: z.string(),
    date: z.string(),
    time: z.string().nullish(),
    url: z.string(),
    source: z.string(),
    venue: z.string().nullish(),
    city: z.string(),
    confidenceScore: z.number().min(0).max(1),
    matchExplanation: z.string(),
    passesFilter: z.boolean(),
  })),
})

interface FilterResultEvent {
  title: string
  description: string
  date: string
  time?: string | null
  url: string
  source: string
  venue?: string | null
  city: string
  confidenceScore: number
  matchExplanation: string
  passesFilter: boolean
}

interface FilterResult {
  events: FilterResultEvent[]
}

function createFilterModel(): ChatAnthropic {
  return new ChatAnthropic({
    model: 'claude-sonnet-4-20250514',
    temperature: 0,
    maxTokens: 4096,
  })
}

function buildFilterPrompt(filters: UserFilters): string {
  const criteria: string[] = []
  if (filters.free) criteria.push('Must be genuinely free (no "suggested donations," no hidden costs)')
  if (filters.noAlcohol) criteria.push('Must be alcohol-free (no bars, no "wine included," no brewery venues, no events centered around drinking)')
  if (filters.familyFriendly) criteria.push('Must be family-friendly and appropriate for all ages')
  if (filters.secular) criteria.push('Must be secular (no religious organizations, no church events disguised as community events, no spiritual undertones)')
  if (filters.apolitical) criteria.push('Must be apolitical (no political fundraisers, no partisan organizations, no events with political agendas)')
  if (filters.customFilters?.length) {
    filters.customFilters.forEach(f => criteria.push(f))
  }
  return criteria.join('\n')
}

export async function filterNode(
  state: GraphStateType
): Promise<Partial<typeof GraphState.State>> {
  const isRefinement = state.status === 'refining' && state.refinementCriteria
  const filters = state.userFilters

  if (!isRefinement && !filters) {
    return {
      filteredEvents: [],
      status: 'categorizing',
      messages: [new AIMessage('No filters specified. Passing all events through.')],
    }
  }

  const eventsToFilter = isRefinement ? state.filteredEvents : state.rawEvents
  if (eventsToFilter.length === 0) {
    const msg = isRefinement
      ? 'No previous results to refine. Try a new search first.'
      : 'No events to filter.'
    return {
      filteredEvents: [],
      status: isRefinement ? 'complete' : 'categorizing',
      messages: [new AIMessage(msg)],
      summary: isRefinement ? msg : undefined,
    }
  }

  const model = createFilterModel()
  const filterCriteria = isRefinement
    ? state.refinementCriteria!
    : buildFilterPrompt(filters!)

  let ragContext = ''
  if (state.retrievedContext?.heuristics.length) {
    const heuristicTexts = state.retrievedContext.heuristics
      .map(h => `[${h.category.toUpperCase()}] ${h.title}: ${h.content}`)
      .join('\n\n')
    ragContext = `\n\nUse the following knowledge base of filtering heuristics to inform your decisions. These are curated rules and edge cases for values-based event filtering:\n\n${heuristicTexts}\n`
  }

  let episodicCalibration = ''
  if (state.episodicContext) {
    episodicCalibration = `\n\nPast events this user saved (use as calibration for confidence scoring — events similar to these should score higher):\n${state.episodicContext}\n`
  }

  const systemPrompt = isRefinement
    ? `You are an event refinement filter. The user has asked to narrow down their previous search results with an additional criterion. Apply the refinement criterion to the provided events and determine which ones match.

Today's date is ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.${episodicCalibration}

Respond with JSON matching this schema:`
    : `You are a values-based event filter. Your job is to carefully evaluate each event against the user's criteria and determine if it passes.

Today's date is ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}. Any event whose date has clearly already passed MUST fail the filter with passesFilter: false, regardless of other criteria. Events with ambiguous dates (e.g. "Saturdays" recurring) may pass if they could plausibly be upcoming.

Be thorough and skeptical. Use the provided filtering heuristics as expert knowledge to guide your decisions.${ragContext}${episodicCalibration}

Respond with JSON matching this schema:`

  const response = await model.invoke([
    {
      role: 'system',
      content: `${systemPrompt}
{
  "events": [{ "title": string, "description": string, "date": string, "time": string | null, "url": string, "source": string, "venue": string | null, "city": string, "confidenceScore": number (0-1), "matchExplanation": string, "passesFilter": boolean }]
}

For each event, provide:
- confidenceScore: 0.0-1.0 (how confident you are it matches ALL criteria)
- matchExplanation: one sentence explaining why it passes or fails
- passesFilter: true/false

Only pass events with high confidence of matching ALL criteria.`,
    },
    {
      role: 'user',
      content: `${isRefinement ? 'Refinement criteria' : 'Filter criteria'}:\n${filterCriteria}\n\nEvents to evaluate:\n${JSON.stringify(eventsToFilter, null, 2)}`,
    },
  ])

  const content = typeof response.content === 'string' ? response.content : ''
  let result: FilterResult

  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    const raw = jsonMatch ? JSON.parse(jsonMatch[0]) : null
    result = FilterResultSchema.parse(raw) as FilterResult
  } catch (e) {
    console.error('Filter JSON parsing/validation error:', e)
    return {
      filteredEvents: [],
      status: 'categorizing',
      messages: [new AIMessage('Filter encountered an error processing events. Passing none through.')],
    }
  }

  function toFilteredEvent(e: FilterResultEvent): FilteredEvent {
    return {
      title: e.title,
      description: e.description,
      date: e.date,
      url: e.url,
      source: e.source,
      city: e.city,
      confidenceScore: e.confidenceScore,
      matchExplanation: e.matchExplanation,
      ...(e.time ? { time: e.time } : {}),
      ...(e.venue ? { venue: e.venue } : {}),
    }
  }

  const filtered: FilteredEvent[] = result.events
    .filter((e: FilterResultEvent) => e.passesFilter)
    .map(toFilteredEvent)

  const rejected: FilteredEvent[] = result.events
    .filter((e: FilterResultEvent) => !e.passesFilter)
    .map(toFilteredEvent)

  const msg = isRefinement
    ? `Refined ${eventsToFilter.length} previous results down to ${filtered.length} matching your criteria.`
    : `Filtered ${eventsToFilter.length} events down to ${filtered.length} that match your criteria. ${rejected.length} events were excluded.`

  return {
    filteredEvents: filtered,
    rejectedEvents: rejected,
    refinementCriteria: null,
    status: 'categorizing',
    messages: [new AIMessage(msg)],
  }
}
