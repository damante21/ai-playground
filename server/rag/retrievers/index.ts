import { naiveRetrieve, type RetrievedHeuristic } from './naive'
import { bm25Retrieve } from './bm25'
import { multiQueryRetrieve } from './multiQuery'
import { hybridRetrieve } from './hybrid'

export type RetrieverType = 'naive' | 'bm25' | 'multiQuery' | 'hybrid'

export type RetrieverFn = (
  query: string,
  topK?: number,
  categoryFilter?: string[]
) => Promise<RetrievedHeuristic[]>

const retrievers: Record<RetrieverType, RetrieverFn> = {
  naive: naiveRetrieve,
  bm25: bm25Retrieve,
  multiQuery: multiQueryRetrieve,
  hybrid: hybridRetrieve,
}

let activeRetriever: RetrieverType = 'naive'

export function setActiveRetriever(type: RetrieverType): void {
  activeRetriever = type
}

export function getActiveRetriever(): RetrieverType {
  return activeRetriever
}

export async function retrieve(
  query: string,
  topK?: number,
  categoryFilter?: string[]
): Promise<RetrievedHeuristic[]> {
  const fn = retrievers[activeRetriever]
  return fn(query, topK, categoryFilter)
}

export function registerRetriever(type: RetrieverType, fn: RetrieverFn): void {
  retrievers[type] = fn
}

export type { RetrievedHeuristic } from './naive'
