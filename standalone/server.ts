import * as dotenv from 'dotenv'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.resolve(__dirname, '../.env') })

import express from 'express'
import type { Request, Response, NextFunction } from 'express'
import cors from 'cors'
import { Pool } from 'pg'
import { Kysely, PostgresDialect } from 'kysely'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { readFileSync } from 'fs'
import { initSharedDeps } from '../server/shared'
import { ingestHeuristics } from '../server/rag/ingest'

const PORT = process.env['PORT'] || 8000
const AUTH_DISABLED = process.env['AUTH_DISABLED'] === 'true'

interface User {
  id: string
  user_name: string
  email: string
  name: string
}

const DEFAULT_USER: User = {
  id: '00000000-0000-0000-0000-000000000001',
  user_name: 'demo',
  email: 'demo@localhost',
  name: 'Demo User',
}

function getJwtSecret(): string {
  if (AUTH_DISABLED) return 'standalone-dev-secret'
  const secret = process.env['JWT_SECRET']
  if (!secret) throw new Error('JWT_SECRET is not set')
  return secret
}

const pool = new Pool({ connectionString: process.env['DATABASE_URL'], ssl: false })

const db = new Kysely<Record<string, unknown>>({
  dialect: new PostgresDialect({ pool }),
})

function createToken(user: User): string {
  return jwt.sign(
    { sub: user.id, email: user.email, user_name: user.user_name, name: user.name },
    getJwtSecret(),
    { expiresIn: '24h' }
  )
}

function verifyToken(token: string): User | null {
  try {
    const payload = jwt.verify(token, getJwtSecret()) as Record<string, unknown>
    return {
      id: payload['sub'] as string,
      email: payload['email'] as string,
      user_name: payload['user_name'] as string,
      name: payload['name'] as string,
    }
  } catch {
    return null
  }
}

async function authenticateUser(emailOrUsername: string, password: string) {
  if (AUTH_DISABLED) {
    return { success: true, user: DEFAULT_USER, token: createToken(DEFAULT_USER) }
  }

  const result = await pool.query(
    `SELECT id, user_name, email, name, password FROM users
     WHERE (email = $1 OR user_name = $1) AND deleted_at IS NULL
     LIMIT 1`,
    [emailOrUsername]
  )
  const row = result.rows[0]
  if (!row) return { success: false, error: 'Invalid credentials' }

  const valid = await bcrypt.compare(password, row.password)
  if (!valid) return { success: false, error: 'Invalid credentials' }

  const u: User = { id: row.id, user_name: row.user_name, email: row.email, name: row.name }
  return { success: true, user: u, token: createToken(u) }
}

async function createUser(userData: { user_name: string; email: string; name: string; password: string }) {
  try {
    const hashed = await bcrypt.hash(userData.password, 12)
    const row = await db
      .insertInto('users')
      .values({ ...userData, password: hashed } as Record<string, unknown>)
      .returning(['id', 'user_name', 'email', 'name'])
      .executeTakeFirstOrThrow() as Record<string, unknown>

    const u: User = {
      id: row['id'] as string,
      user_name: row['user_name'] as string,
      email: row['email'] as string,
      name: row['name'] as string,
    }
    return { success: true, user: u, token: createToken(u) }
  } catch (err: unknown) {
    const dbErr = err as { code?: string; constraint?: string }
    if (dbErr.code === '23505') {
      const field = dbErr.constraint?.includes('user_name') ? 'Username' : 'Email'
      return { success: false, error: `${field} already taken` }
    }
    return { success: false, error: 'Failed to create user' }
  }
}

async function authenticateToken(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (AUTH_DISABLED) { req.user = DEFAULT_USER; return next() }

  const authHeader = req.headers.authorization
  const token = authHeader?.split(' ')[1]
  if (!token) { res.status(401).json({ error: 'Access token required' }); return }
  const user = verifyToken(token)
  if (!user) { res.status(403).json({ error: 'Invalid or expired token' }); return }
  req.user = user
  next()
}

function requireAppAccess(appSlug: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (AUTH_DISABLED) return next()

    if (!req.user) { res.status(401).json({ error: 'Authentication required' }); return }
    const access = await db
      .selectFrom('user_applications')
      .innerJoin('applications', 'applications.id', 'user_applications.application_id')
      .select('user_applications.granted_at')
      .where('user_applications.user_id', '=', req.user.id)
      .where('applications.slug', '=', appSlug)
      .executeTakeFirst()
    if (!access) { res.status(403).json({ error: 'Access denied' }); return }
    next()
  }
}

declare global {
  namespace Express {
    interface Request {
      user?: User
    }
  }
}

initSharedDeps({
  db: db as never,
  authenticateUser,
  createUser,
  authenticateToken,
  requireAppAccess,
})

import aiEngineeringRoutes from '../server/routes/aiEngineering'

async function runMigrations(): Promise<void> {
  const migrationPool = new Pool({ connectionString: process.env['DATABASE_URL'], ssl: false })
  const migrationsDir = path.resolve(__dirname, 'migrations')
  const files = ['001_pgvector_heuristics.sql', '002_fts_heuristics.sql', '003_users_and_auth.sql']

  for (const file of files) {
    const sql = readFileSync(path.join(migrationsDir, file), 'utf-8')
    try {
      await migrationPool.query(sql)
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

  await migrationPool.end()
}

async function ensureDataIngested(): Promise<void> {
  try {
    const result = await pool.query('SELECT COUNT(*) FROM filtering_heuristics')
    const count = parseInt(result.rows[0].count, 10)
    if (count === 0) {
      console.log('No heuristics found — running ingestion...')
      await ingestHeuristics()
    } else {
      console.log(`${count} heuristics already ingested — skipping.`)
    }
  } catch {
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

  app.use((req, _res, next) => {
    console.log(`${req.method} ${req.path}`)
    next()
  })

  if (AUTH_DISABLED) {
    app.get('/api/ai-engineering/auth/auto', (_req: Request, res: Response) => {
      res.json({
        success: true,
        user: { id: DEFAULT_USER.id, username: DEFAULT_USER.user_name, email: DEFAULT_USER.email },
        token: createToken(DEFAULT_USER),
      })
    })
  }

  app.use('/api/ai-engineering', aiEngineeringRoutes)

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() })
  })

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
    console.log(`API: http://localhost:${PORT}/api/ai-engineering/health`)
    if (AUTH_DISABLED) console.log('AUTH_DISABLED=true — authentication bypassed')
  })
}

main().catch((err) => {
  console.error('Server failed to start:', err)
  process.exit(1)
})
