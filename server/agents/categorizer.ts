import { ChatOpenAI } from '@langchain/openai'
import { AIMessage } from '@langchain/core/messages'
import { z } from 'zod'
import { GraphState, type GraphStateType, type CategorizedEvents, type FilteredEvent } from './state'

const CategorizationResultSchema = z.object({
  categories: z.record(
    z.string(),
    z.array(z.object({
      title: z.string(),
      description: z.string(),
      date: z.string(),
      time: z.string().nullish(),
      url: z.string(),
      source: z.string(),
      venue: z.string().nullish(),
      city: z.string(),
      confidenceScore: z.number(),
      matchExplanation: z.string(),
    }))
  ),
  summary: z.string(),
})

interface CategorizationResult {
  categories: Record<string, FilteredEvent[]>
  summary: string
}

function createCategorizerModel(): ChatOpenAI {
  return new ChatOpenAI({
    model: 'gpt-4o-mini',
    temperature: 0,
  })
}

export async function categorizerNode(
  state: GraphStateType
): Promise<Partial<typeof GraphState.State>> {
  const events = state.filteredEvents
  const city = state.userFilters?.city ?? 'your city'

  if (events.length === 0) {
    const noResultsMessage = `I searched for events in ${city} but couldn't find any that match all your criteria. Try broadening your filters or searching a different city.`
    return {
      categorizedEvents: {},
      status: 'complete',
      summary: noResultsMessage,
      messages: [new AIMessage(noResultsMessage)],
    }
  }

  const model = createCategorizerModel()

  const response = await model.invoke([
    {
      role: 'system',
      content: `You are an event categorizer. Group the provided events into meaningful activity categories.

Use categories like:
- Outdoor & Active (hikes, sports, park activities)
- Arts & Culture (museums, galleries, performances)
- Learning & Education (workshops, classes, talks)
- Social & Community (meetups, game nights, community gatherings)
- Food & Wellness (cooking classes, yoga, health events)
- Kids & Family (children's activities, family outings)

An event can only be in one category. Choose the best fit.

Also write a brief, friendly summary for the user (2-3 sentences) highlighting how many events were found and what kinds of activities are available.

Respond with JSON matching this schema:
{
  "categories": { "Category Name": [{ "title": string, "description": string, "date": string, "time": string | null, "url": string, "source": string, "venue": string | null, "city": string, "confidenceScore": number, "matchExplanation": string }] },
  "summary": string
}`,
    },
    {
      role: 'user',
      content: `Events to categorize:\n${JSON.stringify(events, null, 2)}`,
    },
  ])

  const content = typeof response.content === 'string' ? response.content : ''
  let result: CategorizationResult

  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    const raw = jsonMatch ? JSON.parse(jsonMatch[0]) : null
    const parsed = CategorizationResultSchema.parse(raw)
    const cleanCategories: Record<string, FilteredEvent[]> = {}
    for (const [cat, evts] of Object.entries(parsed.categories)) {
      cleanCategories[cat] = evts.map(e => ({
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
      }))
    }
    result = {
      categories: cleanCategories,
      summary: parsed.summary,
    }
  } catch (e) {
    console.error('Categorizer JSON parsing/validation error:', e)
    return {
      categorizedEvents: {},
      status: 'complete',
      summary: `Found ${events.length} events but had trouble organizing them.`,
      messages: [new AIMessage(`Found ${events.length} events but had trouble organizing them.`)],
    }
  }

  const categorized: CategorizedEvents = {}
  for (const [category, categoryEvents] of Object.entries(result.categories)) {
    categorized[category] = categoryEvents
  }

  return {
    categorizedEvents: categorized,
    status: 'complete',
    summary: result.summary,
    messages: [new AIMessage(result.summary)],
  }
}
