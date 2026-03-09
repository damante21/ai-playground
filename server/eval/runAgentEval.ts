import * as dotenv from 'dotenv'
import * as path from 'path'
dotenv.config({ path: path.resolve(__dirname, '../../../../server/.env') })

if (!process.env['DATABASE_URL']) {
  process.env['DATABASE_URL'] =
    'postgresql://jamesdamante_user:jamesdamante_password@localhost:5432/jamesdamante'
}

import { sdk } from './instrumentation'
import { LangfuseClient, type ExperimentItem } from '@langfuse/client'
import { HumanMessage, AIMessage } from '@langchain/core/messages'
import { supervisorNode } from '../agents/supervisor'
import type { GraphStateType } from '../agents/state'
import { agentGoldenDataset, type AgentEvalInput, type AgentEvalExpected } from './agentGoldenDataset'
import type { AgentTaskOutput } from './agentEvaluators'
import {
  toolCallAccuracyEvaluator,
  agentGoalAccuracyEvaluator,
  topicAdherenceEvaluator,
  agentEvalAggregator,
} from './agentEvaluators'

function buildAgentState(input: AgentEvalInput): GraphStateType {
  const messages = []

  if (input.conversationHistory) {
    for (const msg of input.conversationHistory) {
      if (msg.role === 'user') {
        messages.push(new HumanMessage(msg.content))
      } else {
        messages.push(new AIMessage(msg.content))
      }
    }
  }

  messages.push(new HumanMessage(input.userMessage))

  return {
    messages,
    userId: null,
    preferenceContext: null,
    episodicContext: null,
    userQuery: input.userMessage,
    userFilters: null,
    searchQueries: [],
    rawEvents: [],
    filteredEvents: input.previousFilteredEvents ?? [],
    rejectedEvents: [],
    categorizedEvents: input.previousCategorizedEvents ?? {},
    retrievedContext: null,
    refinementCriteria: null,
    status: 'planning',
    summary: '',
  }
}

function classifyRouting(result: Partial<GraphStateType>): 'search' | 'refinement' | 'direct_response' {
  if (result.status === 'researching') return 'search'
  if (result.status === 'refining') return 'refinement'
  return 'direct_response'
}

async function agentTask(
  item: ExperimentItem<AgentEvalInput, AgentEvalExpected>
): Promise<AgentTaskOutput> {
  const input = item.input as AgentEvalInput
  const state = buildAgentState(input)

  const result = await supervisorNode(state)

  const actualRouting = classifyRouting(result)

  const thinking = (() => {
    const lastMsg = result.messages?.[result.messages.length - 1]
    const content = lastMsg && typeof lastMsg.content === 'string' ? lastMsg.content : ''
    return content
  })()

  const supervisorDecision = {
    thinking,
    isSearchRequest: result.status === 'researching',
    isRefinementRequest: result.status === 'refining',
    refinementCriteria: result.refinementCriteria ?? null,
    city: result.userFilters?.city ?? null,
    filters: result.userFilters
      ? {
          free: result.userFilters.free,
          noAlcohol: result.userFilters.noAlcohol,
          familyFriendly: result.userFilters.familyFriendly,
          secular: result.userFilters.secular,
          apolitical: result.userFilters.apolitical,
          customFilters: result.userFilters.customFilters ?? [],
        }
      : null,
    searchQueries: result.searchQueries ?? [],
    directResponse: result.summary ?? null,
  }

  return { supervisorDecision, actualRouting }
}

async function main(): Promise<void> {
  console.log('Starting Agent Evaluation Pipeline...')
  console.log(`Dataset: ${agentGoldenDataset.length} test cases`)
  console.log('Metrics: Tool Call Accuracy, Agent Goal Accuracy, Topic Adherence')
  console.log('')

  const langfuse = new LangfuseClient()

  const experimentData: ExperimentItem<AgentEvalInput, AgentEvalExpected>[] =
    agentGoldenDataset.map((item) => ({
      input: item.input,
      expectedOutput: item.expectedOutput,
    }))

  const result = await langfuse.experiment.run({
    name: 'Agent Eval - Supervisor Behavior',
    description: 'Agent-level evaluation of supervisor routing, goal accuracy, and topic adherence',
    data: experimentData,
    task: agentTask,
    evaluators: [
      toolCallAccuracyEvaluator,
      agentGoalAccuracyEvaluator,
      topicAdherenceEvaluator,
    ],
    runEvaluators: [agentEvalAggregator],
    maxConcurrency: 2,
    metadata: {
      model: 'claude-sonnet-4-20250514',
      evalType: 'agent-behavior',
      testCases: agentGoldenDataset.length,
    },
  })

  console.log(await result.format())

  await sdk.shutdown()
  process.exit(0)
}

main().catch((error: unknown) => {
  console.error('Agent evaluation failed:', error)
  process.exit(1)
})
