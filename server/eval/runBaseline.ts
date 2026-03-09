import * as dotenv from 'dotenv'
import * as path from 'path'
dotenv.config({ path: path.resolve(__dirname, '../../../../server/.env') })

if (!process.env['DATABASE_URL']) {
  process.env['DATABASE_URL'] =
    'postgresql://jamesdamante_user:jamesdamante_password@localhost:5432/jamesdamante'
}

import { sdk } from './instrumentation'
import { LangfuseClient, type ExperimentItem } from '@langfuse/client'
import { ragRetrievalNode } from '../agents/ragRetrieval'
import { filterNode } from '../agents/filter'
import type { GraphStateType, FilteredEvent, RetrievedContext } from '../agents/state'
import { goldenDataset, type EvalInput, type EvalExpectedOutput } from './goldenDataset'
import type { TaskOutput } from './ragasEvaluators'
import {
  faithfulnessEvaluator,
  answerRelevancyEvaluator,
  contextPrecisionEvaluator,
  contextRecallEvaluator,
  ragasAggregator,
} from './ragasEvaluators'

interface RetrievalNodeResult {
  retrievedContext?: RetrievedContext | null
}

interface FilterNodeResult {
  filteredEvents?: FilteredEvent[]
  rejectedEvents?: FilteredEvent[]
}

function buildMinimalState(input: EvalInput): GraphStateType {
  return {
    messages: [],
    userId: null,
    preferenceContext: null,
    episodicContext: null,
    userQuery: input.userQuery,
    userFilters: input.userFilters,
    searchQueries: [],
    rawEvents: input.rawEvents,
    filteredEvents: [],
    rejectedEvents: [],
    categorizedEvents: {},
    retrievedContext: null,
    refinementCriteria: null,
    status: 'filtering',
    summary: '',
  }
}

async function ragTask(item: ExperimentItem<EvalInput, EvalExpectedOutput>): Promise<TaskOutput> {
  const input = item.input as EvalInput
  const state = buildMinimalState(input)

  const retrievalResult = await ragRetrievalNode(state) as RetrievalNodeResult

  const stateWithContext: GraphStateType = {
    ...state,
    retrievedContext: retrievalResult.retrievedContext ?? null,
  }

  const filterResult = await filterNode(stateWithContext) as FilterNodeResult

  const heuristics = stateWithContext.retrievedContext?.heuristics ?? []
  const contexts = heuristics.map(
    (h: { category: string; title: string; content: string }) =>
      `[${h.category.toUpperCase()}] ${h.title}: ${h.content}`
  )

  const passed = filterResult.filteredEvents ?? []
  const rejected = filterResult.rejectedEvents ?? []
  const filteredTitles = passed.map((e: FilteredEvent) => e.title)
  const rejectedTitles = rejected.map((e: FilteredEvent) => e.title)

  const answer = [
    `Events evaluated: ${input.rawEvents.length}`,
    `Passed: ${filteredTitles.join(', ') || 'None'}`,
    `Rejected: ${rejectedTitles.join(', ') || 'None'}`,
    '',
    ...passed.map(
      (e: FilteredEvent) => `PASS [${e.confidenceScore.toFixed(2)}] ${e.title}: ${e.matchExplanation}`
    ),
    ...rejected.map(
      (e: FilteredEvent) => `REJECT [${e.confidenceScore.toFixed(2)}] ${e.title}: ${e.matchExplanation}`
    ),
  ].join('\n')

  return { contexts, answer, filteredTitles, rejectedTitles }
}

async function main(): Promise<void> {
  console.log('Starting RAGAS baseline evaluation...')
  console.log(`Dataset: ${goldenDataset.length} test cases`)
  console.log('')

  const langfuse = new LangfuseClient()

  const experimentData: ExperimentItem<EvalInput, EvalExpectedOutput>[] = goldenDataset.map((item) => ({
    input: item.input,
    expectedOutput: item.expectedOutput,
  }))

  const result = await langfuse.experiment.run({
    name: 'RAGAS Baseline - Naive Retriever',
    description: 'Baseline RAGAS evaluation of the naive pgvector retriever + Claude filter agent',
    data: experimentData,
    task: ragTask,
    evaluators: [
      faithfulnessEvaluator,
      answerRelevancyEvaluator,
      contextPrecisionEvaluator,
      contextRecallEvaluator,
    ],
    runEvaluators: [ragasAggregator],
    maxConcurrency: 3,
    metadata: {
      retriever: 'naive',
      model: 'claude-sonnet-4-20250514',
      topK: 8,
    },
  })

  console.log(await result.format())

  await sdk.shutdown()
  process.exit(0)
}

main().catch((error: unknown) => {
  console.error('Evaluation failed:', error)
  process.exit(1)
})
