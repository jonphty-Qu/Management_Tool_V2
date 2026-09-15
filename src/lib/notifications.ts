import { useCallback, useEffect, useMemo, useState } from 'react'
import { addDays, formatTime, startOfDay } from './date'
import { BIRTHDAY_ALERTS, DAY, yearsSince, type CalEvent, type EventCategory } from './events'

export interface Reminder {
  /** Pro Vorkommen und Erinnerungsstufe eindeutig – eine neue Stufe gilt wieder als ungelesen. */
  id: string
  eventId: string
  title: string
  start: Date
  allDay: boolean
  category: EventCategory
  location?: string
  text: string
}

const READ_KEY = 'mt.remindersRead'
const NOTIFIED_KEY = 'mt.remindersNotified'

function loadList(key: string): string[] {
  try {
    const raw = localStorage.getItem(key)
    if (raw) return JSON.parse(raw) as string[]
  } catch {
    /* Storage kann blockiert sein */
  }
  return []
}

function saveList(key: string, list: string[]) {
  try {
    localStorage.setItem(key, JSON.stringify(list.slice(-500)))
  } catch {
    /* ignorieren */
  }
}

/** Erinnerungen eines Termins in Minuten – Geburtstage bekommen den Standard. */
export function alertsOf(event: CalEvent): number[] {
  if (event.alerts && event.alerts.length > 0) return event.alerts
  if (event.reminders && event.reminders.length > 0) return event.reminders.map((d) => d * DAY)
  if (event.category === 'geburtstag') return BIRTHDAY_ALERTS
  return []
}

/** Vorkommen, die für Erinnerungen infrage kommen. */
function occurrences(event: CalEvent, now: Date): Array<{ start: Date; end: Date }> {
  const start = new Date(event.start)
  const end = new Date(event.end)
  if (event.recurrence !== 'yearly') return [{ start, end }]
  const span = end.getFullYear() - start.getFullYear()
  return [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((year) => {
    const s = new Date(start)
    s.setFullYear(year)
    const e = new Date(end)
    e.setFullYear(year + span)
    return { start: s, end: e }
  })
}

const fmtWeekday = new Intl.DateTimeFormat('de-DE', { weekday: 'short' })

function relative(start: Date, allDay: boolean, now: Date): string {
  const days = Math.round((startOfDay(start).getTime() - startOfDay(now).getTime()) / 86_400_000)
  if (allDay) {
    if (days <= 0) return 'heute'
    if (days === 1) return 'morgen'
    return `in ${days} Tagen`
  }
  const minutes = Math.round((start.getTime() - now.getTime()) / 60_000)
  if (minutes <= 0) return 'läuft gerade'
  if (minutes < 60) return `in ${minutes} Min.`
  if (days === 0) return `heute um ${formatTime(start)}`
  if (days === 1) return `morgen um ${formatTime(start)}`
  return `in ${days} Tagen (${fmtWeekday.format(start)} ${formatTime(start)})`
}

const kindLabel: Partial<Record<EventCategory, string>> = {
  geburtstag: 'Geburtstag',
  gespraech: 'Vorstellungsgespräch',
  deadline: 'Deadline',
}

/** Alle gerade fälligen Erinnerungen, nächster Termin zuerst. */
export function collectReminders(events: CalEvent[], now = new Date()): Reminder[] {
  const out: Reminder[] = []

  for (const event of events) {
    const alerts = alertsOf(event)
    if (alerts.length === 0) continue

    for (const occ of occurrences(event, now)) {
      // Vorbei? Ganztägig zählt bis Tagesende, sonst bis zum Terminende
      const over = event.allDay ? addDays(startOfDay(occ.start), 1) : occ.end
      if (now >= over) continue

      // Die zuletzt fällig gewordene Stufe zählt – bei 3 Tagen, 1 Tag, 2 Std. kommt so jedes Mal eine neue
      const due = alerts.filter((m) => now.getTime() >= occ.start.getTime() - m * 60_000)
      if (due.length === 0) continue
      const stage = Math.min(...due)

      const age = event.category === 'geburtstag' ? yearsSince(event, occ.start) : null
      const text = `${kindLabel[event.category] ?? 'Termin'} ${relative(occ.start, event.allDay, now)}${age ? ` – wird ${age}` : ''}`

      out.push({
        id: `${event.id}:${occ.start.toISOString().slice(0, 16)}:${stage}`,
        eventId: event.id,
        title: event.title,
        start: occ.start,
        allDay: event.allDay,
        category: event.category,
        location: event.location,
        text,
      })
    }
  }

  return out.sort((a, b) => a.start.getTime() - b.start.getTime())
}

export function useReminders(events: CalEvent[]) {
  const [read, setRead] = useState<string[]>(() => loadList(READ_KEY))
  const [now, setNow] = useState(() => new Date())

  // Minutengenau nachrechnen, damit auch „2 Std. vorher“ pünktlich erscheint
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => saveList(READ_KEY, read), [read])

  const reminders = useMemo(() => collectReminders(events, now), [events, now])
  const unreadCount = reminders.filter((r) => !read.includes(r.id)).length

  const markAllRead = useCallback(() => {
    setRead((prev) => Array.from(new Set([...prev, ...reminders.map((r) => r.id)])))
  }, [reminders])

  return { reminders, unreadCount, markAllRead }
}

/** Zeigt jede Erinnerung einmal als Desktop-Benachrichtigung – sofern erlaubt. */
export function useDesktopNotifications(reminders: Reminder[]) {
  useEffect(() => {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    const notified = new Set(loadList(NOTIFIED_KEY))
    let changed = false
    for (const r of reminders) {
      if (notified.has(r.id)) continue
      try {
        new Notification(r.title, {
          body: r.location ? `${r.text} · ${r.location}` : r.text,
          tag: r.id,
          icon: '/favicon.svg',
        })
      } catch {
        /* z. B. vom System unterdrückt */
      }
      notified.add(r.id)
      changed = true
    }
    if (changed) saveList(NOTIFIED_KEY, [...notified])
  }, [reminders])
}
