import { tavily } from '@tavily/core'
import { ChatOpenAI } from '@langchain/openai'
import { getSharedDeps } from '../shared'

export interface EventBriefing {
  stillHappening: boolean
  updatedDetails: string | null
  weatherNote: string | null
  whatToExpect: string
  tips: string[]
  generatedAt: string
}

/**
 * Generates a pre-event briefing for a saved event.
 * Re-checks the event page, gathers contextual info, and produces
 * a concise "what to know before you go" summary.
 */
export async function generateBriefing(eventId: string): Promise<EventBriefing | null> {
  const { db } = getSharedDeps()

  const event = await db
    .selectFrom('ai_engineering_saved_events')
    .selectAll()
    .where('id', '=', eventId)
    .executeTakeFirst()

  if (!event) return null

  const client = tavily({ apiKey: process.env['TAVILY_API_KEY'] ?? '' })

  let eventPageContent = ''
  if (event.event_url) {
    try {
      const extractResult = await client.extract([event.event_url])
      eventPageContent = extractResult.results.map(r => r.rawContent).join('\n\n')
    } catch {
      try {
        const searchResult = await client.search(`${event.title} event`, { maxResults: 2 })
        eventPageContent = searchResult.results.map(r => r.content).join('\n\n')
      } catch (err) {
        console.error('Briefing: failed to fetch event info:', err)
      }
    }
  }

  let weatherContent = ''
  if (event.venue_address || event.venue_name) {
    const location = event.venue_address || event.venue_name
    const dateStr = event.start_time
      ? new Date(event.start_time).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
      : 'upcoming'
    try {
      const weatherResult = await client.search(
        `weather forecast ${location} ${dateStr}`,
        { maxResults: 2 }
      )
      weatherContent = weatherResult.results.map(r => r.content).join('\n')
    } catch {
      // Weather is optional
    }
  }

  const model = new ChatOpenAI({
    model: 'gpt-4o-mini',
    temperature: 0.3,
  })

  const eventDetails = [
    `Title: ${event.title}`,
    event.description ? `Description: ${event.description}` : '',
    event.venue_name ? `Venue: ${event.venue_name}` : '',
    event.venue_address ? `Address: ${event.venue_address}` : '',
    event.start_time ? `Start: ${new Date(event.start_time).toLocaleString()}` : '',
    event.end_time ? `End: ${new Date(event.end_time).toLocaleString()}` : '',
    event.event_url ? `URL: ${event.event_url}` : '',
  ].filter(Boolean).join('\n')

  const enrichment = event.enrichment_data
    ? `\nEnriched details: ${JSON.stringify(event.enrichment_data)}`
    : ''

  try {
    const response = await model.invoke([
      {
        role: 'system',
        content: `You generate concise pre-event briefings. Return valid JSON with these fields:
- stillHappening (boolean): based on the page content, does the event appear to still be scheduled?
- updatedDetails (string|null): any changes or new info found on the page vs what we had
- weatherNote (string|null): brief weather note if relevant outdoor event
- whatToExpect (string): 2-3 sentence "what to expect" summary
- tips (string[]): 2-4 practical tips (what to bring, parking, arrival time, etc.)`,
      },
      {
        role: 'user',
        content: `Generate a briefing for this event:

${eventDetails}${enrichment}

${eventPageContent ? `Current page content:\n${eventPageContent.slice(0, 6000)}` : 'No current page content available.'}

${weatherContent ? `Weather info:\n${weatherContent.slice(0, 1000)}` : ''}`,
      },
    ])

    const content = typeof response.content === 'string' ? response.content : ''
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null

    const parsed = JSON.parse(jsonMatch[0]) as EventBriefing
    parsed.generatedAt = new Date().toISOString()

    return parsed
  } catch (error) {
    console.error('Briefing generation failed:', error)
    return null
  }
}
