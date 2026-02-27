/**
 * Chunking Strategy: Natural Document Boundaries
 *
 * Each heuristic in the knowledge base is a self-contained paragraph
 * authored at the right granularity (100-300 tokens). No splitting is
 * needed because the data is curated, not scraped.
 *
 * The embedding text combines the title and content for richer semantic
 * representation, while metadata (category, title) enables filtered
 * retrieval when needed.
 */

export interface HeuristicEntry {
  category: string
  title: string
  content: string
}

export interface ChunkedHeuristic {
  category: string
  title: string
  content: string
  embeddingText: string
}

export function chunkHeuristic(entry: HeuristicEntry): ChunkedHeuristic {
  return {
    ...entry,
    embeddingText: `[${entry.category}] ${entry.title}: ${entry.content}`,
  }
}

export function chunkHeuristics(entries: HeuristicEntry[]): ChunkedHeuristic[] {
  return entries.map(chunkHeuristic)
}
