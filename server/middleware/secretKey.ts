import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

const SESSION_DURATION_MS = 4 * 60 * 60 * 1000 // 4 hours

function getSecretKey(): string {
  const key = process.env['AI_ENGINEERING_SECRET_KEY']
  if (!key) throw new Error('AI_ENGINEERING_SECRET_KEY is not set in environment variables')
  return key
}

function getJwtSecret(): string {
  const secret = process.env['AI_ENGINEERING_JWT_SECRET'] || process.env['JWT_SECRET']
  if (!secret) throw new Error('JWT_SECRET or AI_ENGINEERING_JWT_SECRET is not set')
  return secret
}

export function validateSecretKey(req: Request, res: Response): void {
  const { secretKey } = req.body as { secretKey?: string }

  if (!secretKey) {
    res.status(400).json({ error: 'Secret key is required' })
    return
  }

  try {
    const expected = getSecretKey()
    if (secretKey !== expected) {
      res.status(401).json({ error: 'Invalid secret key' })
      return
    }

    const jwtSecret = getJwtSecret()
    const token = jwt.sign(
      { scope: 'ai-engineering', iat: Date.now() },
      jwtSecret,
      { expiresIn: '4h' }
    )

    res.json({
      token,
      expiresAt: new Date(Date.now() + SESSION_DURATION_MS).toISOString(),
    })
  } catch (error) {
    console.error('Secret key validation error:', error)
    res.status(500).json({ error: 'Authentication service unavailable' })
  }
}

export function requireAIEngineeringAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization']
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!token) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }

  try {
    const jwtSecret = getJwtSecret()
    const decoded = jwt.verify(token, jwtSecret) as { scope: string }

    if (decoded.scope !== 'ai-engineering') {
      res.status(403).json({ error: 'Invalid token scope' })
      return
    }

    next()
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' })
  }
}
