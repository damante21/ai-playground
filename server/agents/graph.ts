import { StateGraph, END, START } from '@langchain/langgraph'
import { GraphState, type GraphStateType } from './state'
import { supervisorNode } from './supervisor'
import { researcherNode } from './researcher'
import { ragRetrievalNode } from './ragRetrieval'
import { filterNode } from './filter'
import { categorizerNode } from './categorizer'

function routeAfterSupervisor(state: GraphStateType): string {
  if (state.status === 'complete') return END
  if (state.status === 'researching') return 'researchers'
  return END
}

function routeAfterResearchers(state: GraphStateType): string {
  if (state.rawEvents.length < 3 && state.searchQueries.length < 8) {
    return 'supervisor'
  }
  return 'ragRetrieval'
}

const workflow = new StateGraph(GraphState)
  .addNode('supervisor', supervisorNode)
  .addNode('researchers', researcherNode)
  .addNode('ragRetrieval', ragRetrievalNode)
  .addNode('filter', filterNode)
  .addNode('categorizer', categorizerNode)
  .addEdge(START, 'supervisor')
  .addConditionalEdges('supervisor', routeAfterSupervisor, {
    [END]: END,
    researchers: 'researchers',
  })
  .addConditionalEdges('researchers', routeAfterResearchers, {
    supervisor: 'supervisor',
    ragRetrieval: 'ragRetrieval',
  })
  .addEdge('ragRetrieval', 'filter')
  .addEdge('filter', 'categorizer')
  .addEdge('categorizer', END)

export const agentGraph = workflow.compile()
