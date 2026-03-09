import { tavily } from '@tavily/core'
import { ChatOpenAI } from '@langchain/openai'
import { z } from 'zod'
import type { Updateable } from 'kysely'
import { getSharedDeps, type AIEngineeringSavedEventsTable } from '../shared'

const EnrichedEventSchema = z.object({
  startTime: z.string().nullish().describe('ISO 8601 datetime of event start'),
  endTime: z.string().nullish().describe('ISO 8601 datetime of event end'),
  venueName: z.string().nullish(),
  venueAddress: z.string().nullish().describe('Full street address'),
  ticketPrice: z.string().nullish().describe('Price or "Free"'),
  organizerName: z.string().nullish(),
  organizerUrl: z.string().nullish(),
  accessibilityInfo: z.string().nullish(),
  ageRestriction: z.string().nullish(),
  description: z.string().nullish().describe('Detailed description from the event page'),
  imageUrl: z.string().nullish(),
  tags: z.array(z.string()).default([]),
})

/**
 * Fetches the event page via Tavily extract and uses an LLM to
 * pull structured details. Updates the saved event in the database.
 */
export async function enrichEvent(eventId: string): Promise<void> {
  const { db } = getSharedDeps()

  const event = await db
    .selectFrom('ai_engineering_saved_events')
    .select(['id', 'event_url', 'title', 'description'])
    .where('id', '=', eventId)
    .executeTakeFirst()

  if (!event?.event_url) {
    console.warn(`Enrichment skipped: event ${eventId} has no URL`)
    return
  }

  let pageContent: string

  try {
    const client = tavily({ apiKey: process.env['TAVILY_API_KEY'] ?? '' })
    const response = await client.extract([event.event_url])
    pageContent = response.results.map(r => r.rawContent).join('\n\n')

    if (!pageContent.trim()) {
      const searchResponse = await client.search(`${event.title} event details`, { maxResults: 3 })
      pageContent = searchResponse.results.map(r => r.content).join('\n\n')
    }
  } catch (error) {
    console.error(`Tavily extract failed for ${event.event_url}:`, error)
    return
  }

  if (!pageContent.trim()) {
    console.warn(`Enrichment: no content extracted for event ${eventId}`)
    return
  }

  const model = new ChatOpenAI({
    model: 'gpt-4o-mini',
    temperature: 0,
  })

  try {
    const response = await model.invoke([
      {
        role: 'system',
        content: `You extract structured event details from web page content. Return valid JSON matching the schema. Use ISO 8601 for dates. If a field is not found, use null.`,
      },
      {
        role: 'user',
        content: `Extract event details from this page content:\n\nEvent title: ${event.title}\nEvent URL: ${event.event_url}\n\nPage content:\n${pageContent.slice(0, 8000)}\n\nReturn JSON with these fields: startTime, endTime, venueName, venueAddress, ticketPrice, organizerName, organizerUrl, accessibilityInfo, ageRestriction, description, imageUrl, tags`,
      },
    ])

    const content = typeof response.content === 'string' ? response.content : ''
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return

    const parsed = EnrichedEventSchema.parse(JSON.parse(jsonMatch[0]))
    const enrichmentData = parsed as unknown as Record<string, unknown>

    const updates: Updateable<AIEngineeringSavedEventsTable> = {
      enrichment_data: JSON.stringify(enrichmentData),
      enriched_at: new Date(),
    }

    if (parsed.startTime) updates.start_time = new Date(parsed.startTime)
    if (parsed.endTime) updates.end_time = new Date(parsed.endTime)
    if (parsed.venueName) updates.venue_name = parsed.venueName
    if (parsed.venueAddress) updates.venue_address = parsed.venueAddress
    if (parsed.description && (!event.description || event.description.length < 50)) {
      updates.description = parsed.description
    }

    await db
      .updateTable('ai_engineering_saved_events')
      .set(updates)
      .where('id', '=', eventId)
      .execute()

    console.log(`Enrichment complete for event ${eventId}`)
  } catch (error) {
    console.error(`LLM enrichment extraction failed for event ${eventId}:`, error)
  }
}
