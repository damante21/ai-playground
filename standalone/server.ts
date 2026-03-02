import * as dotenv from 'dotenv'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.resolve(__dirname, '../.env') })

import express from 'express'
import cors from 'cors'
import { Pool } from 'pg'
import { readFileSync } from 'fs'
import aiEngineeringRoutes from '../server/routes/aiEngineering'
import { ingestHeuristics } from '../server/rag/ingest'

const PORT = process.env['PORT'] || 8000

async function runMigrations(): Promise<void> {
  const pool = new Pool({
    connectionString: process.env['DATABASE_URL'],
    ssl: false,
  })

  const migrationsDir = path.resolve(__dirname, 'migrations')
  const files = ['001_pgvector_heuristics.sql', '002_fts_heuristics.sql']

  for (const file of files) {
    const sql = readFileSync(path.join(migrationsDir, file), 'utf-8')
    try {
      await pool.query(sql)
      console.log(`Migration applied: ${file}`)
    } catch (err: unknown) {
      const pgErr = err as { code?: string }
      if (pgErr.code === '42710' || pgErr.code === '42P07') {
        console.log(`Migration skipped (already applied): ${file}`)
      } else {
        throw err
      }
    }
  }

  await pool.end()
}

async function ensureDataIngested(): Promise<void> {
  const pool = new Pool({
    connectionString: process.env['DATABASE_URL'],
    ssl: false,
  })

  try {
    const result = await pool.query('SELECT COUNT(*) FROM filtering_heuristics')
    const count = parseInt(result.rows[0].count, 10)
    if (count === 0) {
      console.log('No heuristics found — running ingestion...')
      await pool.end()
      await ingestHeuristics()
    } else {
      console.log(`${count} heuristics already ingested — skipping.`)
      await pool.end()
    }
  } catch {
    await pool.end()
    console.log('Table check failed — running ingestion after migration settles...')
    await ingestHeuristics()
  }
}

async function main(): Promise<void> {
  console.log('Running database migrations...')
  await runMigrations()

  console.log('Checking data ingestion...')
  await ensureDataIngested()

  const app = express()

  app.use(cors())
  app.use(express.json())

  app.use('/api/ai-engineering', aiEngineeringRoutes)

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() })
  })

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
    console.log(`API: http://localhost:${PORT}/api/ai-engineering/health`)
  })
}

main().catch((err) => {
  console.error('Server failed to start:', err)
  process.exit(1)
})
