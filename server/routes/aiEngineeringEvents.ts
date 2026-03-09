import { Router, Request, Response } from 'express'
import { body, query, validationResult } from 'express-validator'
import { getSharedDeps } from '../shared'
import { enrichEvent } from '../agents/enrichment'
import { generateBriefing } from '../agents/briefing'
import { recordEventSaved } from '../memory/preferences'
import { recordEpisode } from '../memory/episodes'

const router = Router()

type EventStatus = 'interested' | 'going' | 'attended' | 'skipped'
const VALID_STATUSES: EventStatus[] = ['interested', 'going', 'attended', 'skipped']

/**
 * POST /api/ai-engineering/events
 * Save an event from chat results
 */
router.post('/', [
  body('title').notEmpty().withMessage('Title is required').trim(),
  body('description').optional().trim(),
  body('eventUrl').optional().isURL().withMessage('Invalid URL'),
  body('venueName').optional().trim(),
  body('venueAddress').optional().trim(),
  body('startTime').optional().isISO8601().withMessage('Invalid start time'),
  body('endTime').optional().isISO8601().withMessage('Invalid end time'),
  body('category').optional().trim(),
  body('isFree').optional().isBoolean(),
  body('confidenceScore').optional().isFloat({ min: 0, max: 1 }),
  body('matchExplanation').optional().trim(),
  body('sourceThreadId').optional().trim(),
  body('sourceQuery').optional().trim(),
], async (req: Request, res: Response) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    res.status(400).json({ error: 'Validation failed', details: errors.array() })
    return
  }

  const { db } = getSharedDeps()
  const userId = req.user!.id

  try {
    const event = await db
      .insertInto('ai_engineering_saved_events')
      .values({
        user_id: userId,
        title: req.body.title,
        description: req.body.description ?? null,
        event_url: req.body.eventUrl ?? null,
        venue_name: req.body.venueName ?? null,
        venue_address: req.body.venueAddress ?? null,
        start_time: req.body.startTime ? new Date(req.body.startTime) : null,
        end_time: req.body.endTime ? new Date(req.body.endTime) : null,
        category: req.body.category ?? null,
        is_free: req.body.isFree ?? null,
        confidence_score: req.body.confidenceScore ?? null,
        match_explanation: req.body.matchExplanation ?? null,
        source_thread_id: req.body.sourceThreadId ?? null,
        status: 'interested',
      } as Record<string, unknown>)
      .returning([
        'id', 'title', 'description', 'event_url', 'venue_name', 'venue_address',
        'start_time', 'end_time', 'category', 'is_free', 'confidence_score',
        'match_explanation', 'status', 'source_thread_id', 'created_at',
      ])
      .executeTakeFirstOrThrow()

    if (event.event_url) {
      enrichEvent(event.id as string).catch(err =>
        console.error('Background enrichment failed:', err)
      )
    }

    recordEventSaved(userId, req.body.category ?? null, null).catch(err =>
      console.error('Background preference recording failed:', err)
    )

    if (req.body.sourceQuery) {
      recordEpisode(userId, {
        query: req.body.sourceQuery,
        city: req.body.category ?? 'Unknown',
        filters: {},
        savedEventTitle: req.body.title,
        savedEventCategory: req.body.category ?? null,
        confidence: req.body.confidenceScore ?? 0,
        timestamp: new Date().toISOString(),
      }).catch(err =>
        console.error('Background episode recording failed:', err)
      )
    }

    res.status(201).json({ success: true, event })
  } catch (error) {
    console.error('Failed to save event:', error)
    res.status(500).json({ error: 'Failed to save event' })
  }
})

/**
 * GET /api/ai-engineering/events
 * List the user's saved events with optional filters
 */
router.get('/', [
  query('status').optional().isIn(VALID_STATUSES),
  query('category').optional().trim(),
  query('upcoming').optional().isBoolean(),
], async (req: Request, res: Response) => {
  const { db } = getSharedDeps()
  const userId = req.user!.id
  const { status, category, upcoming } = req.query as {
    status?: EventStatus
    category?: string
    upcoming?: string
  }

  try {
    let q = db
      .selectFrom('ai_engineering_saved_events')
      .selectAll()
      .where('user_id', '=', userId)

    if (status) {
      q = q.where('status', '=', status)
    }
    if (category) {
      q = q.where('category', '=', category)
    }
    if (upcoming === 'true') {
      q = q.where('start_time', '>=', new Date())
    }

    const events = await q.orderBy('start_time', 'asc').execute()

    res.json({ success: true, events })
  } catch (error) {
    console.error('Failed to fetch events:', error)
    res.status(500).json({ error: 'Failed to fetch events' })
  }
})

/**
 * PATCH /api/ai-engineering/events/:id
 * Update event status, notes, or other mutable fields
 */
router.patch('/:id', [
  body('status').optional().isIn(VALID_STATUSES),
  body('notes').optional().trim(),
], async (req: Request, res: Response) => {
  const { db } = getSharedDeps()
  const userId = req.user!.id
  const eventId = req.params['id']

  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    res.status(400).json({ error: 'Validation failed', details: errors.array() })
    return
  }

  const updates: Record<string, unknown> = {}
  if (req.body.status) updates['status'] = req.body.status
  if (req.body.notes !== undefined) updates['notes'] = req.body.notes

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: 'No valid fields to update' })
    return
  }

  try {
    const event = await db
      .updateTable('ai_engineering_saved_events')
      .set(updates)
      .where('id', '=', eventId!)
      .where('user_id', '=', userId)
      .returning(['id', 'title', 'status', 'notes', 'updated_at'])
      .executeTakeFirst()

    if (!event) {
      res.status(404).json({ error: 'Event not found' })
      return
    }

    res.json({ success: true, event })
  } catch (error) {
    console.error('Failed to update event:', error)
    res.status(500).json({ error: 'Failed to update event' })
  }
})

/**
 * DELETE /api/ai-engineering/events/:id
 * Remove a saved event
 */
router.delete('/:id', async (req: Request, res: Response) => {
  const { db } = getSharedDeps()
  const userId = req.user!.id
  const eventId = req.params['id']

  try {
    const result = await db
      .deleteFrom('ai_engineering_saved_events')
      .where('id', '=', eventId!)
      .where('user_id', '=', userId)
      .executeTakeFirst()

    if (result.numDeletedRows === 0n) {
      res.status(404).json({ error: 'Event not found' })
      return
    }

    res.json({ success: true })
  } catch (error) {
    console.error('Failed to delete event:', error)
    res.status(500).json({ error: 'Failed to delete event' })
  }
})

/**
 * POST /api/ai-engineering/events/:id/briefing
 * Generate a pre-event briefing (re-checks the event, weather, tips)
 */
router.post('/:id/briefing', async (req: Request, res: Response) => {
  const { db } = getSharedDeps()
  const userId = req.user!.id
  const eventId = req.params['id']

  const event = await db
    .selectFrom('ai_engineering_saved_events')
    .select('id')
    .where('id', '=', eventId!)
    .where('user_id', '=', userId)
    .executeTakeFirst()

  if (!event) {
    res.status(404).json({ error: 'Event not found' })
    return
  }

  try {
    const briefing = await generateBriefing(eventId!)
    if (!briefing) {
      res.status(500).json({ error: 'Failed to generate briefing' })
      return
    }
    res.json({ success: true, briefing })
  } catch (error) {
    console.error('Briefing endpoint error:', error)
    res.status(500).json({ error: 'Failed to generate briefing' })
  }
})

/**
 * GET /api/ai-engineering/events/:id/ics
 * Download an .ics calendar file for a single event
 */
router.get('/:id/ics', async (req: Request, res: Response) => {
  const { db } = getSharedDeps()
  const userId = req.user!.id
  const eventId = req.params['id']

  try {
    const event = await db
      .selectFrom('ai_engineering_saved_events')
      .selectAll()
      .where('id', '=', eventId!)
      .where('user_id', '=', userId)
      .executeTakeFirst()

    if (!event) {
      res.status(404).json({ error: 'Event not found' })
      return
    }

    const uid = `${event.id}@ai-engineering`
    const now = formatICSDate(new Date())
    const dtStart = event.start_time ? formatICSDate(new Date(event.start_time)) : now
    const dtEnd = event.end_time
      ? formatICSDate(new Date(event.end_time))
      : formatICSDate(new Date(new Date(dtStart).getTime() + 2 * 60 * 60 * 1000))

    const description = [
      event.description ?? '',
      event.event_url ? `\\nLink: ${event.event_url}` : '',
      event.match_explanation ? `\\nWhy this event: ${event.match_explanation}` : '',
    ].filter(Boolean).join('')

    const location = [event.venue_name, event.venue_address].filter(Boolean).join(', ')

    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//AI Powered Event Sourcer//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${now}`,
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd}`,
      `SUMMARY:${escapeICS(event.title)}`,
      description ? `DESCRIPTION:${escapeICS(description)}` : '',
      location ? `LOCATION:${escapeICS(location)}` : '',
      event.event_url ? `URL:${event.event_url}` : '',
      'END:VEVENT',
      'END:VCALENDAR',
    ].filter(Boolean).join('\r\n')

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${slugify(event.title)}.ics"`)
    res.send(ics)
  } catch (error) {
    console.error('Failed to generate ICS:', error)
    res.status(500).json({ error: 'Failed to generate calendar file' })
  }
})

function formatICSDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

function escapeICS(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 50)
}

export default router
