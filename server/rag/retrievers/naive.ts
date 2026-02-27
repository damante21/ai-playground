import { Pool } from 'pg'
import { embedText } from '../embeddings'

export interface RetrievedHeuristic {
  id: number
  category: string
  title: string
  content: string
  similarity: number
}

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

export async function naiveRetrieve(
  query: string,
  topK: number = 6,
  categoryFilter?: string[]
): Promise<RetrievedHeuristic[]> {
  const queryEmbedding = await embedText(query)
  const vectorStr = `[${queryEmbedding.join(',')}]`
  const db = getPool()

  let sql: string
  let params: (string | number)[]

  if (categoryFilter && categoryFilter.length > 0) {
    const placeholders = categoryFilter.map((_, i) => `$${i + 3}`).join(', ')
    sql = `
      SELECT id, category, title, content,
             1 - (embedding <=> $1::vector) AS similarity
      FROM filtering_heuristics
      WHERE category IN (${placeholders})
      ORDER BY embedding <=> $1::vector
      LIMIT $2
    `
    params = [vectorStr, topK, ...categoryFilter]
  } else {
    sql = `
      SELECT id, category, title, content,
             1 - (embedding <=> $1::vector) AS similarity
      FROM filtering_heuristics
      ORDER BY embedding <=> $1::vector
      LIMIT $2
    `
    params = [vectorStr, topK]
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
