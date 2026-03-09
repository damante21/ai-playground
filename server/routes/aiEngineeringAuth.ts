import { Router, Request, Response, NextFunction } from 'express'
import { body, validationResult } from 'express-validator'
import { getSharedDeps } from '../shared'

const router: Router = Router()

function getSecretKey(): string {
  const key = process.env['AI_ENGINEERING_SECRET_KEY']
  if (!key) throw new Error('AI_ENGINEERING_SECRET_KEY is not set in environment variables')
  return key
}

/**
 * POST /api/ai-engineering/auth/signup
 * Create account with username, email, password + secret key validation.
 * Secret key is the same for all users — it gates who can create accounts.
 */
router.post('/signup', [
  body('username')
    .isLength({ min: 2, max: 50 })
    .withMessage('Username must be 2-50 characters')
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('Username can only contain letters, numbers, hyphens, and underscores')
    .trim(),
  body('email')
    .isEmail()
    .withMessage('Valid email is required')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
  body('secretKey')
    .notEmpty()
    .withMessage('Secret key is required'),
], async (req: Request, res: Response) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    res.status(400).json({ error: 'Validation failed', details: errors.array() })
    return
  }

  const { username, email, password, secretKey } = req.body as {
    username: string
    email: string
    password: string
    secretKey: string
  }

  try {
    const expected = getSecretKey()
    if (secretKey !== expected) {
      res.status(401).json({ error: 'Invalid secret key' })
      return
    }
  } catch {
    res.status(500).json({ error: 'Authentication service unavailable' })
    return
  }

  const { createUser, db } = getSharedDeps()

  const result = await createUser({
    user_name: username,
    email,
    name: username,
    password,
  })

  if (!result.success || !result.user) {
    res.status(400).json({ error: result.error || 'Failed to create account' })
    return
  }

  try {
    const aiApp = await db
      .selectFrom('applications')
      .select('id')
      .where('slug', '=', 'ai-engineering')
      .executeTakeFirst()

    if (aiApp) {
      await db
        .insertInto('user_applications')
        .values({
          user_id: result.user.id,
          application_id: aiApp.id,
        })
        .execute()
    }
  } catch (error) {
    console.error('Failed to grant app access:', error)
  }

  res.status(201).json({
    success: true,
    message: 'Account created. Please log in.',
  })
})

/**
 * POST /api/ai-engineering/auth/login
 * Login with username/email + password.
 * Checks user_applications to verify ai-engineering access.
 */
router.post('/login', [
  body('emailOrUsername')
    .notEmpty()
    .withMessage('Username or email is required')
    .trim(),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
], async (req: Request, res: Response) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    res.status(400).json({ error: 'Validation failed', details: errors.array() })
    return
  }

  const { emailOrUsername, password } = req.body as {
    emailOrUsername: string
    password: string
  }

  const { authenticateUser, db } = getSharedDeps()

  const result = await authenticateUser(emailOrUsername, password)

  if (!result.success || !result.user) {
    res.status(401).json({ error: 'Invalid credentials' })
    return
  }

  const access = await db
    .selectFrom('user_applications')
    .innerJoin('applications', 'applications.id', 'user_applications.application_id')
    .select('user_applications.granted_at')
    .where('user_applications.user_id', '=', result.user.id)
    .where('applications.slug', '=', 'ai-engineering')
    .executeTakeFirst()

  if (!access) {
    res.status(403).json({ error: 'You do not have access to this application' })
    return
  }

  res.json({
    success: true,
    user: {
      id: result.user.id,
      username: result.user.user_name,
      email: result.user.email,
    },
    token: result.token,
  })
})

/**
 * GET /api/ai-engineering/auth/verify
 * Verify the current token is valid and the user has ai-engineering access.
 */
router.get('/verify',
  (req: Request, res: Response, next: NextFunction) => getSharedDeps().authenticateToken(req, res, next),
  (req: Request, res: Response, next: NextFunction) => getSharedDeps().requireAppAccess('ai-engineering')(req, res, next),
  (req: Request, res: Response) => {
  res.json({
    success: true,
    user: {
      id: req.user!.id,
      username: req.user!.user_name,
      email: req.user!.email,
    },
  })
})

export default router
