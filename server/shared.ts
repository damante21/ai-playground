import type { Request, Response, NextFunction } from 'express'
import type { Kysely } from 'kysely'

export interface AuthResponse {
  success: boolean
  user?: { id: string; user_name: string; email: string; name: string }
  token?: string
  error?: string
}

export interface SharedDeps {
  db: Kysely<Record<string, unknown>>
  authenticateUser: (emailOrUsername: string, password: string) => Promise<AuthResponse>
  createUser: (userData: { user_name: string; email: string; name: string; password: string }) => Promise<AuthResponse>
  authenticateToken: (req: Request, res: Response, next: NextFunction) => Promise<void>
  requireAppAccess: (appSlug: string) => (req: Request, res: Response, next: NextFunction) => Promise<void>
}

let _deps: SharedDeps | null = null

export function initSharedDeps(deps: SharedDeps): void {
  _deps = deps
}

export function getSharedDeps(): SharedDeps {
  if (!_deps) throw new Error('Shared dependencies not initialized. Call initSharedDeps() first.')
  return _deps
}
