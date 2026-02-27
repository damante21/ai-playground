import { AIMessage } from '@langchain/core/messages'
import { GraphState, type GraphStateType, type RetrievedContext } from './state'
import { retrieve } from '../rag/retrievers/index'

function getActiveCategories(state: GraphStateType): string[] {
  const filters = state.userFilters
  if (!filters) return []

  const categories: string[] = []
  if (filters.noAlcohol) categories.push('alcohol')
  if (filters.secular) categories.push('religious')
  if (filters.apolitical) categories.push('political')
  if (filters.free) categories.push('cost')
  if (filters.familyFriendly) categories.push('family')
  categories.push('general')
  return categories
}

function buildRetrievalQuery(state: GraphStateType): string {
  const parts: string[] = []

  if (state.userFilters) {
    const f = state.userFilters
    if (f.noAlcohol) parts.push('alcohol-free events')
    if (f.secular) parts.push('secular non-religious events')
    if (f.apolitical) parts.push('apolitical non-political events')
    if (f.free) parts.push('genuinely free events no hidden costs')
    if (f.familyFriendly) parts.push('family-friendly events for children')
  }

  const eventSummaries = state.rawEvents.slice(0, 5).map(e => {
    const venue = e.venue ? ` at ${e.venue}` : ''
    return `${e.title}${venue}`
  })

  if (eventSummaries.length > 0) {
    parts.push(`Events to evaluate: ${eventSummaries.join(', ')}`)
  }

  return parts.join('. ')
}

export async function ragRetrievalNode(
  state: GraphStateType
): Promise<Partial<typeof GraphState.State>> {
  const rawEvents = state.rawEvents
  if (rawEvents.length === 0) {
    return {
      retrievedContext: null,
      messages: [new AIMessage('No events to retrieve context for.')],
    }
  }

  const query = buildRetrievalQuery(state)
  const categories = getActiveCategories(state)

  try {
    const heuristics = await retrieve(
      query,
      8,
      categories.length > 0 ? categories : undefined
    )

    const context: RetrievedContext = {
      heuristics: heuristics.map(h => ({
        category: h.category,
        title: h.title,
        content: h.content,
        similarity: h.similarity,
      })),
      query,
    }

    return {
      retrievedContext: context,
      messages: [new AIMessage(`Retrieved ${heuristics.length} relevant filtering heuristics.`)],
    }
  } catch (error) {
    console.error('RAG retrieval error:', error)
    return {
      retrievedContext: null,
      messages: [new AIMessage('RAG retrieval failed. Proceeding without additional context.')],
    }
  }
}
