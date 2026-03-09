import { getStore } from './store'

interface UserPreferences {
  favoriteCategories: Record<string, number>
  frequentFilters: Record<string, number>
  savedEventCount: number
  lastSearchCity: string | null
  updatedAt: string
}

function getNamespace(userId: string): [string, string] {
  return ['ai-engineering-preferences', userId]
}

const PREFERENCES_KEY = 'profile'

export async function getUserPreferences(userId: string): Promise<UserPreferences | null> {
  try {
    const store = await getStore()
    const result = await store.get(getNamespace(userId), PREFERENCES_KEY)
    if (!result?.value) return null
    return result.value as UserPreferences
  } catch (error) {
    console.error('Failed to get user preferences:', error)
    return null
  }
}

export async function recordEventSaved(
  userId: string,
  category: string | null,
  filters: Record<string, boolean> | null
): Promise<void> {
  try {
    const store = await getStore()
    const existing = await getUserPreferences(userId)

    const prefs: UserPreferences = existing ?? {
      favoriteCategories: {},
      frequentFilters: {},
      savedEventCount: 0,
      lastSearchCity: null,
      updatedAt: new Date().toISOString(),
    }

    prefs.savedEventCount += 1

    if (category) {
      prefs.favoriteCategories[category] = (prefs.favoriteCategories[category] ?? 0) + 1
    }

    if (filters) {
      for (const [key, val] of Object.entries(filters)) {
        if (val) {
          prefs.frequentFilters[key] = (prefs.frequentFilters[key] ?? 0) + 1
        }
      }
    }

    prefs.updatedAt = new Date().toISOString()

    await store.put(getNamespace(userId), PREFERENCES_KEY, prefs)
  } catch (error) {
    console.error('Failed to record event saved preference:', error)
  }
}

export async function recordSearchCity(userId: string, city: string): Promise<void> {
  try {
    const store = await getStore()
    const existing = await getUserPreferences(userId)

    const prefs: UserPreferences = existing ?? {
      favoriteCategories: {},
      frequentFilters: {},
      savedEventCount: 0,
      lastSearchCity: null,
      updatedAt: new Date().toISOString(),
    }

    prefs.lastSearchCity = city
    prefs.updatedAt = new Date().toISOString()

    await store.put(getNamespace(userId), PREFERENCES_KEY, prefs)
  } catch (error) {
    console.error('Failed to record search city:', error)
  }
}

/**
 * Format preferences into a context string for the supervisor prompt.
 * Returns null if there are no meaningful preferences yet.
 */
export function formatPreferencesForPrompt(prefs: UserPreferences | null): string | null {
  if (!prefs || prefs.savedEventCount === 0) return null

  const lines: string[] = []

  const topCategories = Object.entries(prefs.favoriteCategories)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([cat, count]) => `${cat} (${count} saved)`)

  if (topCategories.length > 0) {
    lines.push(`Preferred categories: ${topCategories.join(', ')}`)
  }

  const topFilters = Object.entries(prefs.frequentFilters)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([f]) => f)

  if (topFilters.length > 0) {
    lines.push(`Commonly used filters: ${topFilters.join(', ')}`)
  }

  lines.push(`Total events saved: ${prefs.savedEventCount}`)

  if (prefs.lastSearchCity) {
    lines.push(`Last searched city: ${prefs.lastSearchCity}`)
  }

  return lines.join('\n')
}
