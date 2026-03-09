import { ChatAnthropic } from '@langchain/anthropic'
import type { Evaluator, Evaluation, RunEvaluator } from '@langfuse/client'
import type { AgentEvalInput, AgentEvalExpected } from './agentGoldenDataset'

const judgeModel = new ChatAnthropic({
  model: 'claude-sonnet-4-20250514',
  temperature: 0,
  maxTokens: 1024,
})

export interface AgentTaskOutput {
  supervisorDecision: {
    thinking: string
    isSearchRequest: boolean
    isRefinementRequest: boolean
    refinementCriteria?: string | null
    city?: string | null
    filters?: Record<string, boolean | string[]> | null
    searchQueries: string[]
    directResponse?: string | null
  }
  actualRouting: 'search' | 'refinement' | 'direct_response'
}

async function callJudge(systemPrompt: string, userPrompt: string): Promise<{ score: number; reasoning: string }> {
  const response = await judgeModel.invoke([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ])

  const content = typeof response.content === 'string' ? response.content : ''

  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as { score?: number; reasoning?: string }
      return {
        score: Math.max(0, Math.min(1, Number(parsed.score) || 0)),
        reasoning: String(parsed.reasoning || ''),
      }
    }
  } catch {
    // Fall through
  }

  return { score: 0, reasoning: 'Failed to parse judge response' }
}

/**
 * Tool Call Accuracy: Did the supervisor route to the correct action?
 * Evaluates whether the supervisor correctly classified the user's intent
 * (search, refinement, or direct response) and extracted the right parameters.
 */
export const toolCallAccuracyEvaluator: Evaluator<AgentEvalInput, AgentEvalExpected> = async ({
  input,
  output,
  expectedOutput,
}) => {
  const taskOutput = output as AgentTaskOutput
  const expected = expectedOutput as AgentEvalExpected

  const systemPrompt = `You are an evaluation judge assessing TOOL CALL ACCURACY of an AI supervisor agent.

Tool call accuracy measures whether the supervisor correctly:
1. Classified the user's intent (search, refinement, or direct response)
2. Extracted the correct parameters (city, filters, refinement criteria)
3. Generated appropriate search queries (if applicable)

You must respond with ONLY a JSON object in this format:
{"score": <number 0.0-1.0>, "reasoning": "<brief explanation>"}`

  const userPrompt = `USER MESSAGE: ${input.userMessage}
${input.conversationHistory ? `CONVERSATION HISTORY:\n${input.conversationHistory.map(m => `${m.role}: ${m.content}`).join('\n')}` : ''}
${input.previousFilteredEvents ? `PREVIOUS RESULTS EXIST: Yes (${input.previousFilteredEvents.length} events)` : 'PREVIOUS RESULTS EXIST: No'}

EXPECTED ROUTING: ${expected.expectedRouting}
${expected.expectedCity ? `EXPECTED CITY: ${expected.expectedCity}` : ''}
${expected.expectedFilters ? `EXPECTED FILTERS: ${expected.expectedFilters.join(', ')}` : ''}

ACTUAL SUPERVISOR DECISION:
- Routing: ${taskOutput.actualRouting}
- Is search: ${taskOutput.supervisorDecision.isSearchRequest}
- Is refinement: ${taskOutput.supervisorDecision.isRefinementRequest}
- City: ${taskOutput.supervisorDecision.city ?? 'none'}
- Filters: ${JSON.stringify(taskOutput.supervisorDecision.filters)}
- Search queries: ${taskOutput.supervisorDecision.searchQueries.join(', ') || 'none'}
- Refinement criteria: ${taskOutput.supervisorDecision.refinementCriteria ?? 'none'}
- Direct response: ${taskOutput.supervisorDecision.directResponse ?? 'none'}

GOAL: ${expected.goalDescription}

Score the tool call accuracy:
- 1.0: Correct routing AND correct parameter extraction (city, filters, criteria all match expected)
- 0.7: Correct routing but minor parameter issues (e.g., missed one filter, slightly wrong city spelling)
- 0.5: Correct routing but significant parameter issues
- 0.3: Wrong routing but reasonable interpretation of the message
- 0.0: Completely wrong routing and parameters`

  const result = await callJudge(systemPrompt, userPrompt)
  return { name: 'tool_call_accuracy', value: result.score, comment: result.reasoning }
}

/**
 * Agent Goal Accuracy: Did the supervisor's decision serve the user's actual goal?
 * Evaluates whether the supervisor's action would lead to the desired outcome,
 * independent of exact routing match.
 */
export const agentGoalAccuracyEvaluator: Evaluator<AgentEvalInput, AgentEvalExpected> = async ({
  input,
  output,
  expectedOutput,
}) => {
  const taskOutput = output as AgentTaskOutput
  const expected = expectedOutput as AgentEvalExpected

  const systemPrompt = `You are an evaluation judge assessing AGENT GOAL ACCURACY of an AI supervisor agent.

Agent goal accuracy measures whether the supervisor's decision would actually help the user achieve their goal. This is about outcomes, not just routing correctness.

You must respond with ONLY a JSON object in this format:
{"score": <number 0.0-1.0>, "reasoning": "<brief explanation>"}`

  const userPrompt = `USER MESSAGE: ${input.userMessage}
${input.conversationHistory ? `CONVERSATION HISTORY:\n${input.conversationHistory.map(m => `${m.role}: ${m.content}`).join('\n')}` : ''}

USER'S GOAL: ${expected.goalDescription}

SUPERVISOR'S ACTION:
- Thinking: ${taskOutput.supervisorDecision.thinking}
- Routing: ${taskOutput.actualRouting}
- City: ${taskOutput.supervisorDecision.city ?? 'none'}
- Filters: ${JSON.stringify(taskOutput.supervisorDecision.filters)}
- Search queries: ${taskOutput.supervisorDecision.searchQueries.join('; ') || 'none'}
- Refinement criteria: ${taskOutput.supervisorDecision.refinementCriteria ?? 'none'}
- Direct response: ${taskOutput.supervisorDecision.directResponse ?? 'none'}

Score the agent goal accuracy:
- 1.0: The supervisor's decision would fully achieve the user's goal
- 0.7: The decision mostly achieves the goal but misses a minor aspect
- 0.5: The decision partially achieves the goal
- 0.3: The decision addresses the user but in a suboptimal way
- 0.0: The decision would not help the user at all`

  const result = await callJudge(systemPrompt, userPrompt)
  return { name: 'agent_goal_accuracy', value: result.score, comment: result.reasoning }
}

/**
 * Topic Adherence: Did the supervisor stay on-topic (community event discovery)?
 * Evaluates whether the agent's response/action remains focused on its domain
 * and doesn't drift into unrelated territory.
 */
export const topicAdherenceEvaluator: Evaluator<AgentEvalInput, AgentEvalExpected> = async ({
  input,
  output,
  expectedOutput,
}) => {
  const taskOutput = output as AgentTaskOutput
  const expected = expectedOutput as AgentEvalExpected

  const systemPrompt = `You are an evaluation judge assessing TOPIC ADHERENCE of an AI supervisor agent.

Topic adherence measures whether the agent stays within its designated domain (community event discovery) and appropriately handles off-topic requests by redirecting back to its purpose.

The agent's domain is: ${expected.expectedTopic}

You must respond with ONLY a JSON object in this format:
{"score": <number 0.0-1.0>, "reasoning": "<brief explanation>"}`

  const userPrompt = `USER MESSAGE: ${input.userMessage}

AGENT'S DESIGNATED TOPIC: ${expected.expectedTopic}

SUPERVISOR'S ACTION:
- Thinking: ${taskOutput.supervisorDecision.thinking}
- Routing: ${taskOutput.actualRouting}
- Search queries: ${taskOutput.supervisorDecision.searchQueries.join('; ') || 'none'}
- Direct response: ${taskOutput.supervisorDecision.directResponse ?? 'none'}

Score the topic adherence:
- 1.0: Agent stays fully on-topic OR appropriately redirects an off-topic request back to event discovery
- 0.7: Agent mostly stays on-topic with minor drift
- 0.5: Agent partially addresses the topic but gets sidetracked
- 0.3: Agent mostly off-topic but tangentially related
- 0.0: Agent completely leaves its domain (e.g., answers trivia, writes code, etc.)

Note: For off-topic user messages, the BEST behavior is to acknowledge the message and redirect to event discovery (score 1.0). Refusing to engage at all is acceptable (0.7). Fully answering the off-topic question is poor adherence (0.3 or lower).`

  const result = await callJudge(systemPrompt, userPrompt)
  return { name: 'topic_adherence', value: result.score, comment: result.reasoning }
}

const AGENT_METRIC_NAMES = ['tool_call_accuracy', 'agent_goal_accuracy', 'topic_adherence'] as const

export const agentEvalAggregator: RunEvaluator<AgentEvalInput, AgentEvalExpected> = async ({ itemResults }) => {
  const metricAgg: Record<string, number[]> = {}
  for (const name of AGENT_METRIC_NAMES) {
    metricAgg[name] = []
  }

  for (const result of itemResults) {
    for (const evaluation of result.evaluations) {
      const name = evaluation.name as string
      if (name in metricAgg && typeof evaluation.value === 'number') {
        metricAgg[name]?.push(evaluation.value)
      }
    }
  }

  const evaluations: Evaluation[] = []

  console.log('\n' + '='.repeat(60))
  console.log('AGENT EVALUATION RESULTS')
  console.log('='.repeat(60))
  console.log(`${'Metric'.padEnd(24)} | ${'Mean'.padEnd(6)} | ${'Min'.padEnd(6)} | ${'Max'.padEnd(6)} | N`)
  console.log('-'.repeat(60))

  for (const name of AGENT_METRIC_NAMES) {
    const scores = metricAgg[name] ?? []
    if (scores.length === 0) continue

    const mean = scores.reduce((a, b) => a + b, 0) / scores.length
    const min = Math.min(...scores)
    const max = Math.max(...scores)

    console.log(
      `${name.padEnd(24)} | ${mean.toFixed(3).padEnd(6)} | ${min.toFixed(3).padEnd(6)} | ${max.toFixed(3).padEnd(6)} | ${scores.length}`
    )

    evaluations.push({
      name: `avg_${name}`,
      value: parseFloat(mean.toFixed(4)),
      comment: `Mean: ${mean.toFixed(3)}, Min: ${min.toFixed(3)}, Max: ${max.toFixed(3)} (n=${scores.length})`,
    })
  }

  console.log('='.repeat(60) + '\n')

  return evaluations
}
