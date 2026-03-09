import type { Request, Response, NextFunction } from 'express'
import type { Kysely, Generated } from 'kysely'

export interface AIEngineeringSavedEventsTable {
  id: Generated<string>
  user_id: string
  title: string
  description: string | null
  event_url: string | null
  venue_name: string | null
  venue_address: string | null
  start_time: Date | null
  end_time: Date | null
  category: string | null
  is_free: boolean | null
  confidence_score: number | null
  match_explanation: string | null
  status: Generated<string>
  source_thread_id: string | null
  notes: Generated<string | null>
  enrichment_data: Generated<unknown>
  enriched_at: Generated<Date | null>
  ics_url: Generated<string | null>
  created_at: Generated<Date>
  updated_at: Generated<Date>
}

export interface ApplicationsTable {
  id: Generated<string>
  name: string
  slug: string
  description: string | null
  created_at: Generated<Date>
}

export interface UserApplicationsTable {
  id: Generated<string>
  user_id: string
  application_id: string
  granted_at: Generated<Date>
}

export interface AIEngineeringDB {
  ai_engineering_saved_events: AIEngineeringSavedEventsTable
  applications: ApplicationsTable
  user_applications: UserApplicationsTable
}

export interface AuthResponse {
  success: boolean
  user?: { id: string; user_name: string; email: string; name: string }
  token?: string
  error?: string
}

export interface SharedDeps {
  db: Kysely<AIEngineeringDB>
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
