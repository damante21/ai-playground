import type { FilteredEvent, CategorizedEvents } from '../agents/state'

export interface AgentEvalInput {
  userMessage: string
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
  previousFilteredEvents?: FilteredEvent[]
  previousCategorizedEvents?: CategorizedEvents
}

export interface AgentEvalExpected {
  expectedRouting: 'search' | 'refinement' | 'direct_response'
  expectedCity?: string
  expectedFilters?: string[]
  expectedTopic: string
  goalDescription: string
}

export interface AgentEvalItem {
  input: AgentEvalInput
  expectedOutput: AgentEvalExpected
}

const sampleFilteredEvents: FilteredEvent[] = [
  {
    title: 'Saturday Morning Yoga in the Park',
    description: 'Free community yoga class at Zilker Park.',
    date: '2026-03-14',
    url: 'https://example.com/yoga',
    source: 'eventbrite',
    venue: 'Zilker Park',
    city: 'Austin',
    confidenceScore: 0.92,
    matchExplanation: 'Free outdoor activity, no alcohol, family-friendly.',
  },
  {
    title: 'Austin Makers Market',
    description: 'Local artisans showcase handmade goods. Live music and food trucks.',
    date: '2026-03-14',
    url: 'https://example.com/makers',
    source: 'eventbrite',
    venue: 'Palmer Events Center',
    city: 'Austin',
    confidenceScore: 0.85,
    matchExplanation: 'Community event at a secular venue.',
  },
  {
    title: 'Kite Festival',
    description: 'Annual kite festival with kite-making workshops for all ages.',
    date: '2026-03-14',
    time: '10:00 AM',
    url: 'https://example.com/kites',
    source: 'eventbrite',
    venue: 'Zilker Park',
    city: 'Austin',
    confidenceScore: 0.95,
    matchExplanation: 'Free, family-friendly, outdoor, all ages.',
  },
]

export const agentGoldenDataset: AgentEvalItem[] = [
  // 1. Clear search request — new city + filters
  {
    input: {
      userMessage: 'Find free family-friendly events in San Francisco this weekend',
    },
    expectedOutput: {
      expectedRouting: 'search',
      expectedCity: 'San Francisco',
      expectedFilters: ['free', 'familyFriendly'],
      expectedTopic: 'community event discovery',
      goalDescription: 'Should route to search, extract San Francisco as city, and set free + familyFriendly filters.',
    },
  },

  // 2. Ambiguous search — "cycling" could mean many things
  {
    input: {
      userMessage: 'cycling in Boulder, Colorado',
    },
    expectedOutput: {
      expectedRouting: 'search',
      expectedCity: 'Boulder',
      expectedFilters: [],
      expectedTopic: 'community event discovery',
      goalDescription: 'Should route to search with diverse queries covering cycling events, bike meetups, and outdoor recreation in Boulder.',
    },
  },

  // 3. Refinement request — filter previous results
  {
    input: {
      userMessage: 'show me only the free ones',
      conversationHistory: [
        { role: 'user', content: 'Find events in Austin this weekend' },
        { role: 'assistant', content: 'Found 3 events in Austin matching your criteria.' },
      ],
      previousFilteredEvents: sampleFilteredEvents,
      previousCategorizedEvents: { 'Outdoor Activities': sampleFilteredEvents },
    },
    expectedOutput: {
      expectedRouting: 'refinement',
      expectedTopic: 'community event discovery',
      goalDescription: 'Should detect this is a refinement of previous Austin results, not a new search. Should extract "free" as the refinement criterion.',
    },
  },

  // 4. Refinement — time-based narrowing
  {
    input: {
      userMessage: 'any of those in the morning?',
      conversationHistory: [
        { role: 'user', content: 'Find family events in Austin' },
        { role: 'assistant', content: 'Here are 3 family-friendly events in Austin.' },
      ],
      previousFilteredEvents: sampleFilteredEvents,
      previousCategorizedEvents: { 'Family Events': sampleFilteredEvents },
    },
    expectedOutput: {
      expectedRouting: 'refinement',
      expectedTopic: 'community event discovery',
      goalDescription: 'Should detect time-based refinement request. Should not re-run the full search pipeline.',
    },
  },

  // 5. Direct response — greeting
  {
    input: {
      userMessage: 'Hello! What can you help me with?',
    },
    expectedOutput: {
      expectedRouting: 'direct_response',
      expectedTopic: 'community event discovery',
      goalDescription: 'Should respond conversationally and guide the user toward event discovery. Should NOT trigger a search.',
    },
  },

  // 6. Direct response — off-topic question
  {
    input: {
      userMessage: 'What is the capital of France?',
    },
    expectedOutput: {
      expectedRouting: 'direct_response',
      expectedTopic: 'community event discovery',
      goalDescription: 'Should respond that this is outside its scope and redirect toward event discovery. Should stay on-topic.',
    },
  },

  // 7. Search with all filters active
  {
    input: {
      userMessage: 'I need free, alcohol-free, family-friendly, secular, apolitical events in Portland',
    },
    expectedOutput: {
      expectedRouting: 'search',
      expectedCity: 'Portland',
      expectedFilters: ['free', 'noAlcohol', 'familyFriendly', 'secular', 'apolitical'],
      expectedTopic: 'community event discovery',
      goalDescription: 'Should extract all five filters correctly and route to search with Portland as the city.',
    },
  },

  // 8. Search — implicit filters
  {
    input: {
      userMessage: 'Events for my kids this weekend in Denver, nothing with drinking',
    },
    expectedOutput: {
      expectedRouting: 'search',
      expectedCity: 'Denver',
      expectedFilters: ['familyFriendly', 'noAlcohol'],
      expectedTopic: 'community event discovery',
      goalDescription: 'Should infer familyFriendly from "for my kids" and noAlcohol from "nothing with drinking".',
    },
  },

  // 9. Refinement — outdoor filtering
  {
    input: {
      userMessage: 'which of those are outdoor events?',
      conversationHistory: [
        { role: 'user', content: 'Find events in Austin' },
        { role: 'assistant', content: 'Found several events in Austin.' },
      ],
      previousFilteredEvents: sampleFilteredEvents,
      previousCategorizedEvents: { 'Various': sampleFilteredEvents },
    },
    expectedOutput: {
      expectedRouting: 'refinement',
      expectedTopic: 'community event discovery',
      goalDescription: 'Should detect "which of those" as a refinement request and extract "outdoor" as the criterion.',
    },
  },

  // 10. Follow-up question about a previous result
  {
    input: {
      userMessage: 'Tell me more about the Kite Festival',
      conversationHistory: [
        { role: 'user', content: 'Find family events in Austin' },
        { role: 'assistant', content: 'Found 3 events including the Kite Festival.' },
      ],
      previousFilteredEvents: sampleFilteredEvents,
    },
    expectedOutput: {
      expectedRouting: 'direct_response',
      expectedTopic: 'community event discovery',
      goalDescription: 'Should respond with available details about the Kite Festival from previous results. Should NOT re-run a search.',
    },
  },

  // 11. New search in different city after previous results
  {
    input: {
      userMessage: 'Now find me events in Seattle',
      conversationHistory: [
        { role: 'user', content: 'Find events in Austin' },
        { role: 'assistant', content: 'Found events in Austin.' },
      ],
      previousFilteredEvents: sampleFilteredEvents,
    },
    expectedOutput: {
      expectedRouting: 'search',
      expectedCity: 'Seattle',
      expectedTopic: 'community event discovery',
      goalDescription: 'Should route to a new search with Seattle, not treat as refinement of Austin results.',
    },
  },

  // 12. Vague request needing interpretation
  {
    input: {
      userMessage: 'something fun to do this weekend',
    },
    expectedOutput: {
      expectedRouting: 'direct_response',
      expectedTopic: 'community event discovery',
      goalDescription: 'Should ask the user for a city since no location was provided. Should not guess a city.',
    },
  },
]
