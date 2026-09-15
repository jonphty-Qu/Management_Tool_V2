import { useCallback, useEffect, useState } from 'react'
import { addDays, isSameDay, startOfDay } from './date'

export type EventCategory =
  | 'arbeit'
  | 'privat'
  | 'termin'
  | 'gespraech'
  | 'deadline'
  | 'geburtstag'
  | 'sonstiges'

export type Recurrence = 'none' | 'yearly'

export interface CalEvent {
  id: string
  title: string
  /** ISO-String. */
  start: string
  end: string
  allDay: boolean
  category: EventCategory
  location?: string
  notes?: string
  /** Jährlich wiederkehrend (Geburtstage, Jahrestage). */
  recurrence?: Recurrence
  /** Erinnerungen in Minuten vor Beginn; 0 = zum Beginn bzw. am Tag. */
  alerts?: number[]
  /** Alte Form: Erinnerungen in Tagen – wird beim Laden in `alerts` übernommen. */
  reminders?: number[]
  /** Verknüpfte Bewerbung (bei Vorstellungsgesprächen). */
  applicationId?: string
}

export interface CategoryStyle {
  label: string
  /** Klassen für Termin-Blöcke. */
  block: string
  /** Farbpunkt für Listen und Auswahl. */
  dot: string
}

export const categories: Record<EventCategory, CategoryStyle> = {
  arbeit: {
    label: 'Arbeit',
    block:
      'bg-indigo-100 text-indigo-900 border-indigo-300 dark:bg-indigo-500/20 dark:text-indigo-100 dark:border-indigo-500/50',
    dot: 'bg-indigo-500',
  },
  privat: {
    label: 'Privat',
    block:
      'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-100 dark:border-emerald-500/50',
    dot: 'bg-emerald-500',
  },
  termin: {
    label: 'Termin',
    block:
      'bg-sky-100 text-sky-900 border-sky-300 dark:bg-sky-500/20 dark:text-sky-100 dark:border-sky-500/50',
    dot: 'bg-sky-500',
  },
  gespraech: {
    label: 'Gespräch',
    block:
      'bg-violet-100 text-violet-900 border-violet-300 dark:bg-violet-500/20 dark:text-violet-100 dark:border-violet-500/50',
    dot: 'bg-violet-500',
  },
  deadline: {
    label: 'Deadline',
    block:
      'bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-500/20 dark:text-rose-100 dark:border-rose-500/50',
    dot: 'bg-rose-500',
  },
  geburtstag: {
    label: 'Geburtstag',
    block:
      'bg-fuchsia-100 text-fuchsia-900 border-fuchsia-300 dark:bg-fuchsia-500/20 dark:text-fuchsia-100 dark:border-fuchsia-500/50',
    dot: 'bg-fuchsia-500',
  },
  sonstiges: {
    label: 'Sonstiges',
    block:
      'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-500/20 dark:text-amber-100 dark:border-amber-500/50',
    dot: 'bg-amber-500',
  },
}

export const categoryList = Object.entries(categories) as Array<[EventCategory, CategoryStyle]>

/** Minuten pro Tag – Erinnerungen werden in Minuten gespeichert. */
export const DAY = 24 * 60

/** Standard für Geburtstage: 3 Tage vorher und am Tag selbst. */
export const BIRTHDAY_ALERTS = [3 * DAY, 0]

const STORAGE_KEY = 'mt.events'

function seed(): CalEvent[] {
  const today = startOfDay(new Date())
  const at = (day: Date, h: number, m = 0) => {
    const d = new Date(day)
    d.setHours(h, m, 0, 0)
    return d.toISOString()
  }
  return [
    {
      id: 'seed-1',
      title: 'Daily Standup',
      start: at(today, 9),
      end: at(today, 9, 15),
      allDay: false,
      category: 'arbeit',
      location: 'Teams',
    },
    {
      id: 'seed-2',
      title: 'Sprint-Review vorbereiten',
      start: at(today, 14),
      end: at(today, 15, 30),
      allDay: false,
      category: 'arbeit',
    },
    {
      id: 'seed-3',
      title: 'Zahnarzt',
      start: at(addDays(today, 1), 11),
      end: at(addDays(today, 1), 12),
      allDay: false,
      category: 'privat',
      location: 'Praxis Dr. Weber',
    },
    {
      id: 'seed-4',
      title: 'Angebot Kunde X abgeben',
      start: at(addDays(today, 2), 0),
      end: at(addDays(today, 2), 23, 59),
      allDay: true,
      category: 'deadline',
      alerts: [DAY, 0],
    },
    {
      id: 'seed-5',
      title: 'Geburtstag (Beispiel)',
      start: at(addDays(today, 3), 0),
      end: at(addDays(today, 3), 23, 59),
      allDay: true,
      category: 'geburtstag',
      recurrence: 'yearly',
      alerts: BIRTHDAY_ALERTS,
    },
  ]
}

/** Alte Tages-Erinnerungen in Minuten umrechnen. */
function migrate(e: CalEvent): CalEvent {
  if (e.alerts || !e.reminders) return e
  const { reminders: _legacy, ...rest } = e
  return { ...rest, alerts: e.reminders.map((d) => d * DAY) }
}

function load(): CalEvent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return (JSON.parse(raw) as CalEvent[]).map(migrate)
  } catch {
    /* Storage kann blockiert sein */
  }
  return seed()
}

function persist(events: CalEvent[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events))
  } catch {
    /* ignorieren */
  }
}

export function useEvents() {
  const [events, setEvents] = useState<CalEvent[]>(load)

  useEffect(() => persist(events), [events])

  const save = useCallback((event: CalEvent) => {
    setEvents((prev) => {
      const exists = prev.some((e) => e.id === event.id)
      return exists ? prev.map((e) => (e.id === event.id ? event : e)) : [...prev, event]
    })
  }, [])

  const remove = useCallback((id: string) => {
    setEvents((prev) => prev.filter((e) => e.id !== id))
  }, [])

  return { events, save, remove }
}

export function newId(): string {
  return `ev-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

/**
 * Projiziert ein jährlich wiederkehrendes Ereignis auf das Jahr von `day`.
 * Andere Termine kommen unverändert zurück.
 */
export function projectToYear(event: CalEvent, day: Date): CalEvent {
  if (event.recurrence !== 'yearly') return event
  const start = new Date(event.start)
  const end = new Date(event.end)
  const shift = day.getFullYear() - start.getFullYear()
  if (shift === 0) return event
  const nextStart = new Date(start)
  nextStart.setFullYear(start.getFullYear() + shift)
  const nextEnd = new Date(end)
  nextEnd.setFullYear(end.getFullYear() + shift)
  return { ...event, start: nextStart.toISOString(), end: nextEnd.toISOString() }
}

/** Berührt das Ereignis den Tag – jährliche Wiederholung eingerechnet? */
function hits(event: CalEvent, day: Date): CalEvent | null {
  const dayStart = startOfDay(day)
  const dayEnd = addDays(dayStart, 1)
  const projected = projectToYear(event, dayStart)
  const start = new Date(projected.start)
  const end = new Date(projected.end)
  if (start < dayEnd && end > dayStart) return projected
  return null
}

/** Termine, die den Tag berühren – auch mehrtägige und jährlich wiederkehrende. */
export function eventsOnDay(events: CalEvent[], day: Date): CalEvent[] {
  return events
    .map((e) => hits(e, day))
    .filter((e): e is CalEvent => e !== null)
    .sort((a, b) => {
      if (a.allDay !== b.allDay) return a.allDay ? -1 : 1
      return new Date(a.start).getTime() - new Date(b.start).getTime()
    })
}

export function isMultiDay(e: CalEvent): boolean {
  return !isSameDay(new Date(e.start), new Date(e.end))
}

/** Jahre seit dem ursprünglichen Datum – für Geburtstage. `event.start` muss das Original sein. */
export function yearsSince(event: CalEvent, on: Date): number | null {
  if (event.recurrence !== 'yearly') return null
  const years = on.getFullYear() - new Date(event.start).getFullYear()
  return years > 0 ? years : null
}
