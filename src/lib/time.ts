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
  projectId?: string
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

const RUNNING_KEY = 'mt.time.running'
const ENTRIES_KEY = 'mt.time'

/** Bisher gelaufene Sekunden einer Messung – Pausen eingerechnet. */
export function trackedSeconds(running: StoredRunningTime, now = Date.now()): number {
  const since = running.paused
    ? 0
    : Math.max(0, Math.floor((now - new Date(running.startedAt).getTime()) / 1000))
  return (running.accumulated ?? 0) + since
}

function writeRunning(value: StoredRunningTime | null) {
  try {
    if (value) localStorage.setItem(RUNNING_KEY, JSON.stringify(value))
    else localStorage.removeItem(RUNNING_KEY)
  } catch {
    /* Storage kann blockiert sein */
  }
}

/** Messung starten. Läuft schon eine, bleibt sie unangetastet. */
export function startTracking(task: string, cardId?: string, projectId?: string): boolean {
  if (loadRunningTime()) return false
  writeRunning({ task, startedAt: new Date().toISOString(), cardId, projectId, accumulated: 0, paused: false })
  return true
}

export function pauseTracking(): boolean {
  const running = loadRunningTime()
  if (!running || running.paused) return false
  writeRunning({ ...running, accumulated: trackedSeconds(running), startedAt: new Date().toISOString(), paused: true })
  return true
}

export function resumeTracking(): boolean {
  const running = loadRunningTime()
  if (!running || !running.paused) return false
  writeRunning({ ...running, startedAt: new Date().toISOString(), paused: false })
  return true
}

/** Messung beenden und als Eintrag sichern. Gibt den gesicherten Eintrag zurück. */
export function stopTracking(): StoredTimeEntry | null {
  const running = loadRunningTime()
  if (!running) return null
  const entry: StoredTimeEntry = {
    task: running.task,
    startedAt: running.startedAt,
    endedAt: new Date().toISOString(),
    seconds: Math.max(1, trackedSeconds(running)),
    cardId: running.cardId,
  }
  try {
    const entries = loadTimeEntries()
    entries.unshift(entry)
    localStorage.setItem(ENTRIES_KEY, JSON.stringify(entries))
  } catch {
    /* ignorieren */
  }
  writeRunning(null)
  return entry
}

export function formatTrackedTime(seconds: number) {
  const minutes = Math.floor(Math.max(0, seconds) / 60)
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return hours > 0 ? `${hours} h ${rest} min` : `${rest} min`
}
