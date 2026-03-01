import { ChatAnthropic } from '@langchain/anthropic'
import type { Evaluator, Evaluation, RunEvaluator } from '@langfuse/client'
import type { EvalInput, EvalExpectedOutput } from './goldenDataset'

const judgeModel = new ChatAnthropic({
  model: 'claude-sonnet-4-20250514',
  temperature: 0,
  maxTokens: 1024,
})

export interface TaskOutput {
  contexts: string[]
  answer: string
  filteredTitles: string[]
  rejectedTitles: string[]
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
    // Fall through to default
  }

  return { score: 0, reasoning: 'Failed to parse judge response' }
}

/**
 * Faithfulness: Can every claim in the filter agent's output be traced back
 * to the retrieved heuristic contexts?
 */
export const faithfulnessEvaluator: Evaluator<EvalInput, EvalExpectedOutput> = async ({ output }) => {
  const taskOutput = output as TaskOutput

  const systemPrompt = `You are an evaluation judge assessing FAITHFULNESS of an AI filter agent's output.

Faithfulness measures whether every claim, decision, or reasoning in the answer is grounded in and supported by the provided context documents.

You must respond with ONLY a JSON object in this format:
{"score": <number 0.0-1.0>, "reasoning": "<brief explanation>"}`

  const userPrompt = `CONTEXT DOCUMENTS (retrieved heuristics):
${taskOutput.contexts.map((c, i) => `[${i + 1}] ${c}`).join('\n\n')}

FILTER AGENT'S ANSWER:
${taskOutput.answer}

Score the faithfulness:
- 1.0: Every claim and filter decision is directly supported by the context documents
- 0.5: Some claims are supported, but others are made without context support
- 0.0: The answer makes claims that contradict or have no basis in the context documents

Consider: Are the filter decisions (pass/reject) grounded in the heuristics? Does the reasoning cite applicable rules from the context?`

  const result = await callJudge(systemPrompt, userPrompt)
  return { name: 'faithfulness', value: result.score, comment: result.reasoning }
}

/**
 * Answer Relevancy: Is the filter agent's response relevant to the user's
 * query and specified filters?
 */
export const answerRelevancyEvaluator: Evaluator<EvalInput, EvalExpectedOutput> = async ({ input, output }) => {
  const taskOutput = output as TaskOutput

  const systemPrompt = `You are an evaluation judge assessing ANSWER RELEVANCY of an AI filter agent's output.

Answer relevancy measures whether the response directly addresses the user's query and applies the specified filters correctly.

You must respond with ONLY a JSON object in this format:
{"score": <number 0.0-1.0>, "reasoning": "<brief explanation>"}`

  const userPrompt = `USER QUERY: ${input.userQuery}

USER FILTERS: ${JSON.stringify(input.userFilters)}

FILTER AGENT'S ANSWER:
${taskOutput.answer}

EVENTS PASSED: ${taskOutput.filteredTitles.join(', ') || 'None'}
EVENTS REJECTED: ${taskOutput.rejectedTitles.join(', ') || 'None'}

Score the answer relevancy:
- 1.0: The response directly addresses the query, applies all specified filters, and provides relevant filter decisions
- 0.5: The response partially addresses the query or misses some filter criteria
- 0.0: The response is off-topic or ignores the user's filters entirely`

  const result = await callJudge(systemPrompt, userPrompt)
  return { name: 'answer_relevancy', value: result.score, comment: result.reasoning }
}

/**
 * Context Precision: What proportion of the retrieved heuristics are actually
 * relevant to the user's query and filters?
 */
export const contextPrecisionEvaluator: Evaluator<EvalInput, EvalExpectedOutput> = async ({ input, output }) => {
  const taskOutput = output as TaskOutput

  const systemPrompt = `You are an evaluation judge assessing CONTEXT PRECISION of a retrieval system.

Context precision measures the proportion of retrieved context documents that are actually relevant and useful for answering the given query with the specified filters.

You must respond with ONLY a JSON object in this format:
{"score": <number 0.0-1.0>, "reasoning": "<brief explanation>"}`

  const userPrompt = `USER QUERY: ${input.userQuery}

USER FILTERS: ${JSON.stringify(input.userFilters)}

RETRIEVED CONTEXT DOCUMENTS:
${taskOutput.contexts.map((c, i) => `[${i + 1}] ${c}`).join('\n\n')}

Score the context precision:
- 1.0: Every retrieved document is relevant to the query and active filters
- 0.5: About half of the retrieved documents are relevant
- 0.0: None of the retrieved documents are relevant to the query or filters

For each document, consider: Does it contain heuristics or rules applicable to the active filters? Would it help make correct filter decisions for the events in question?`

  const result = await callJudge(systemPrompt, userPrompt)
  return { name: 'context_precision', value: result.score, comment: result.reasoning }
}

/**
 * Context Recall: Do the retrieved heuristics cover all the information
 * needed to produce the ground-truth filter decisions?
 */
export const contextRecallEvaluator: Evaluator<EvalInput, EvalExpectedOutput> = async ({ output, expectedOutput }) => {
  const taskOutput = output as TaskOutput
  const expected = expectedOutput as EvalExpectedOutput

  const systemPrompt = `You are an evaluation judge assessing CONTEXT RECALL of a retrieval system.

Context recall measures whether the retrieved context documents contain all the information necessary to support the ground truth answer. High recall means the retrieval system found everything needed.

You must respond with ONLY a JSON object in this format:
{"score": <number 0.0-1.0>, "reasoning": "<brief explanation>"}`

  const userPrompt = `GROUND TRUTH:
Expected pass: ${expected.expectedPassTitles.join(', ')}
Expected reject: ${expected.expectedRejectTitles.join(', ')}
Reasoning: ${expected.groundTruthReasoning}
Relevant categories needed: ${expected.relevantHeuristicCategories.join(', ')}

RETRIEVED CONTEXT DOCUMENTS:
${taskOutput.contexts.map((c, i) => `[${i + 1}] ${c}`).join('\n\n')}

Score the context recall:
- 1.0: The retrieved documents contain all information needed to arrive at the ground truth decisions
- 0.5: The documents cover some but not all of the ground truth reasoning
- 0.0: The documents are missing critical information needed for the ground truth

Consider: Do the retrieved heuristics cover all the relevant filter categories? Do they contain rules that would lead to the correct pass/reject decisions?`

  const result = await callJudge(systemPrompt, userPrompt)
  return { name: 'context_recall', value: result.score, comment: result.reasoning }
}

const RAGAS_METRIC_NAMES = ['faithfulness', 'answer_relevancy', 'context_precision', 'context_recall'] as const

/**
 * Run-level evaluator that computes average scores across all items for each
 * RAGAS metric and prints a summary table.
 */
export const ragasAggregator: RunEvaluator<EvalInput, EvalExpectedOutput> = async ({ itemResults }) => {
  const metricAgg: Record<string, number[]> = {}
  for (const name of RAGAS_METRIC_NAMES) {
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
  console.log('RAGAS BASELINE EVALUATION RESULTS')
  console.log('='.repeat(60))
  console.log(`${'Metric'.padEnd(22)} | ${'Mean'.padEnd(6)} | ${'Min'.padEnd(6)} | ${'Max'.padEnd(6)} | N`)
  console.log('-'.repeat(60))

  for (const name of RAGAS_METRIC_NAMES) {
    const scores = metricAgg[name] ?? []
    if (scores.length === 0) continue

    const mean = scores.reduce((a, b) => a + b, 0) / scores.length
    const min = Math.min(...scores)
    const max = Math.max(...scores)

    console.log(
      `${name.padEnd(22)} | ${mean.toFixed(3).padEnd(6)} | ${min.toFixed(3).padEnd(6)} | ${max.toFixed(3).padEnd(6)} | ${scores.length}`
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
