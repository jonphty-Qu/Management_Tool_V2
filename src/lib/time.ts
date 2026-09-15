export interface StoredTimeEntry {
  task: string
  startedAt: string
  endedAt?: string
  seconds: number
  cardId?: string
}

export interface StoredRunningTime {
  task: string
  startedAt: string
  accumulated?: number
  paused?: boolean
  cardId?: string
}

export function loadTimeEntries(): StoredTimeEntry[] {
  try {
    const value = JSON.parse(localStorage.getItem('mt.time') ?? '[]')
    return Array.isArray(value) ? value : []
  } catch {
    return []
  }
}

export function loadRunningTime(): StoredRunningTime | null {
  try {
    const value = JSON.parse(localStorage.getItem('mt.time.running') ?? 'null')
    return value && typeof value === 'object' ? value : null
  } catch {
    return null
  }
}

export function formatTrackedTime(seconds: number) {
  const minutes = Math.floor(Math.max(0, seconds) / 60)
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return hours > 0 ? `${hours} h ${rest} min` : `${rest} min`
}
