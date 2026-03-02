import { Pool } from 'pg'
import type { RetrievedHeuristic } from './naive'

let pool: Pool | null = null

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env['DATABASE_URL'] ||
        'postgresql://postgres:postgres@localhost:5432/postgres',
      ssl: false,
    })
  }
  return pool
}

function buildTsQuery(query: string): string {
  const words = query
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2)
    .slice(0, 12)

  if (words.length === 0) return ''
  return words.join(' | ')
}

export async function bm25Retrieve(
  query: string,
  topK: number = 6,
  categoryFilter?: string[]
): Promise<RetrievedHeuristic[]> {
  const tsQuery = buildTsQuery(query)
  if (!tsQuery) return []

  const db = getPool()

  let sql: string
  let params: (string | number)[]

  if (categoryFilter && categoryFilter.length > 0) {
    const placeholders = categoryFilter.map((_, i) => `$${i + 3}`).join(', ')
    sql = `
      SELECT id, category, title, content,
             ts_rank_cd(search_vector, to_tsquery('english', $1)) AS similarity
      FROM filtering_heuristics
      WHERE search_vector @@ to_tsquery('english', $1)
        AND category IN (${placeholders})
      ORDER BY ts_rank_cd(search_vector, to_tsquery('english', $1)) DESC
      LIMIT $2
    `
    params = [tsQuery, topK, ...categoryFilter]
  } else {
    sql = `
      SELECT id, category, title, content,
             ts_rank_cd(search_vector, to_tsquery('english', $1)) AS similarity
      FROM filtering_heuristics
      WHERE search_vector @@ to_tsquery('english', $1)
      ORDER BY ts_rank_cd(search_vector, to_tsquery('english', $1)) DESC
      LIMIT $2
    `
    params = [tsQuery, topK]
  }

  const result = await db.query(sql, params)

  return result.rows.map(row => ({
    id: row.id as number,
    category: row.category as string,
    title: row.title as string,
    content: row.content as string,
    similarity: parseFloat(row.similarity as string),
  }))
}
