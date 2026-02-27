import { Annotation, MessagesAnnotation } from '@langchain/langgraph'

export interface UserFilters {
  city: string
  free: boolean
  noAlcohol: boolean
  familyFriendly: boolean
  secular: boolean
  apolitical: boolean
  customFilters?: string[]
}

export interface RawEvent {
  title: string
  description: string
  date: string
  time?: string
  url: string
  source: string
  venue?: string
  city: string
}

export interface FilteredEvent extends RawEvent {
  confidenceScore: number
  matchExplanation: string
  venueContext?: string
}

export interface CategorizedEvents {
  [category: string]: FilteredEvent[]
}

export interface RetrievedContext {
  heuristics: Array<{
    category: string
    title: string
    content: string
    similarity: number
  }>
  query: string
}

export const GraphState = Annotation.Root({
  ...MessagesAnnotation.spec,
  userQuery: Annotation<string>({
    reducer: (_current, update) => update,
    default: () => '',
  }),
  userFilters: Annotation<UserFilters | null>({
    reducer: (_current, update) => update,
    default: () => null,
  }),
  searchQueries: Annotation<string[]>({
    reducer: (_current, update) => update,
    default: () => [],
  }),
  rawEvents: Annotation<RawEvent[]>({
    reducer: (current, update) => [...current, ...update],
    default: () => [],
  }),
  filteredEvents: Annotation<FilteredEvent[]>({
    reducer: (_current, update) => update,
    default: () => [],
  }),
  rejectedEvents: Annotation<FilteredEvent[]>({
    reducer: (_current, update) => update,
    default: () => [],
  }),
  categorizedEvents: Annotation<CategorizedEvents>({
    reducer: (_current, update) => update,
    default: () => ({}),
  }),
  retrievedContext: Annotation<RetrievedContext | null>({
    reducer: (_current, update) => update,
    default: () => null,
  }),
  status: Annotation<'planning' | 'researching' | 'filtering' | 'categorizing' | 'complete' | 'error'>({
    reducer: (_current, update) => update,
    default: () => 'planning' as const,
  }),
  summary: Annotation<string>({
    reducer: (_current, update) => update,
    default: () => '',
  }),
})

export type GraphStateType = typeof GraphState.State
