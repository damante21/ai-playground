import { Pool } from 'pg'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { embedTexts } from './embeddings'
import { chunkHeuristics, type HeuristicEntry } from './chunking'

function getPool(): Pool {
  return new Pool({
    connectionString: process.env['DATABASE_URL'] ||
      'postgresql://postgres:postgres@localhost:5432/postgres',
    ssl: false,
  })
}

export async function ingestHeuristics(): Promise<void> {
  const dataPath = typeof __dirname !== 'undefined'
    ? resolve(__dirname, '../../data/heuristics.json')
    : resolve(process.cwd(), 'data/heuristics.json')
  const raw = readFileSync(dataPath, 'utf-8')
  const entries: HeuristicEntry[] = JSON.parse(raw)
  const chunked = chunkHeuristics(entries)

  console.log(`Embedding ${chunked.length} heuristics...`)
  const embeddingTexts = chunked.map(c => c.embeddingText)

  const BATCH_SIZE = 20
  const allEmbeddings: number[][] = []
  for (let i = 0; i < embeddingTexts.length; i += BATCH_SIZE) {
    const batch = embeddingTexts.slice(i, i + BATCH_SIZE)
    console.log(`  Embedding batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(embeddingTexts.length / BATCH_SIZE)}...`)
    const batchEmbeddings = await embedTexts(batch)
    allEmbeddings.push(...batchEmbeddings)
  }

  const pool = getPool()
  try {
    await pool.query('DELETE FROM filtering_heuristics')
    console.log('Cleared existing heuristics.')

    for (const [i, h] of chunked.entries()) {
      const embedding = allEmbeddings[i]
      if (!embedding) throw new Error(`Missing embedding for index ${i}`)
      const vectorStr = `[${embedding.join(',')}]`

      await pool.query(
        `INSERT INTO filtering_heuristics (category, title, content, embedding, metadata)
         VALUES ($1, $2, $3, $4::vector, $5)`,
        [
          h.category,
          h.title,
          h.content,
          vectorStr,
          JSON.stringify({ embeddingText: h.embeddingText }),
        ]
      )
    }

    console.log(`Ingested ${chunked.length} heuristics into pgvector.`)
  } finally {
    await pool.end()
  }
}

const isDirectRun = typeof require !== 'undefined'
  ? require.main === module
  : process.argv[1]?.includes('ingest')

if (isDirectRun) {
  ingestHeuristics()
    .then(() => {
      console.log('Ingestion complete.')
      process.exit(0)
    })
    .catch(err => {
      console.error('Ingestion failed:', err)
      process.exit(1)
    })
}
