/**
 * Gesprochene Antworten formulieren.
 *
 * Getrennt vom Dialog, damit die Sätze an einer Stelle stehen und ohne UI
 * geprüft werden können. Uhrzeiten werden ausgeschrieben („14 Uhr 30“) –
 * „14:30“ liest die Sprachausgabe sonst als Datum vor.
 */
import type { BoardCard, BoardColumn, Priority, Project } from './board'
import { priorities } from './board'
import type { CalEvent } from './events'
import { eventsOnDay } from './events'
import { addDays, daysBetween, formatDayShort, isSameDay, startOfDay } from './date'
import type { EventIntent, NoteIntent, QueryScope, TaskIntent } from './voiceCommands'

const WEEKDAY_NAMES = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag']

/** „heute“, „morgen“, „am Freitag“ oder „am 26. September“. */
export function spokenDay(date: Date, base = new Date()): string {
  const diff = daysBetween(base, date)
  if (diff === 0) return 'heute'
  if (diff === 1) return 'morgen'
  if (diff === 2) return 'übermorgen'
  if (diff === -1) return 'gestern'
  if (diff > 2 && diff < 7) return `am ${WEEKDAY_NAMES[date.getDay()]}`
  return `am ${formatDayShort(date)}`
}

export function spokenTime(date: Date): string {
  const hours = date.getHours()
  const minutes = date.getMinutes()
  return minutes === 0 ? `${hours} Uhr` : `${hours} Uhr ${minutes}`
}

/** „A, B und C“ – Aufzählung, wie man sie spricht. */
export function listPhrase(items: string[]): string {
  if (items.length === 0) return ''
  if (items.length === 1) return items[0]
  return `${items.slice(0, -1).join(', ')} und ${items[items.length - 1]}`
}

/** Aufzählung mit Rest: dann ohne „und“ zwischen den Beispielen, sonst klingt es doppelt. */
function listWithRest(items: string[], rest: number): string {
  return rest > 0 ? `${items.join(', ')} und ${rest} weitere` : listPhrase(items)
}

/** „einen Termin“ / „3 Termine“ – Zahlwörter klingen gesprochen natürlicher. */
function eventCount(count: number): string {
  return count === 1 ? 'einen Termin' : `${count} Termine`
}

/** „eine Aufgabe“ / „3 Aufgaben“. */
function taskCount(count: number): string {
  return count === 1 ? 'eine Aufgabe' : `${count} Aufgaben`
}

// ---------- Bestätigungen ----------

export function taskConfirmation(
  intent: TaskIntent,
  where: { projectName: string; createdProject: boolean },
  base = new Date(),
): string {
  const parts: string[] = [`Aufgabe „${intent.title}“ angelegt`]
  if (intent.due) parts.push(`fällig ${spokenDay(intent.due, base)}`)
  if (intent.priority !== 'mittel') parts.push(`Priorität ${priorities[intent.priority].label.toLowerCase()}`)
  parts.push(where.createdProject ? `im neuen Projekt ${where.projectName}` : `im Projekt ${where.projectName}`)
  return `${parts.join(', ')}.`
}

export function eventConfirmation(intent: EventIntent, base = new Date()): string {
  const start = new Date(intent.start)
  const when = intent.allDay
    ? `${spokenDay(start, base)} ganztägig`
    : `${spokenDay(start, base)} um ${spokenTime(start)}`
  return `Termin „${intent.title}“ ${when} eingetragen.`
}

export function noteConfirmation(intent: NoteIntent): string {
  return `Notiz „${intent.title}“ gespeichert.`
}

// ---------- Auskünfte ----------

/** Spalten, die für erledigte Karten stehen. */
function isDoneColumn(title: string): boolean {
  return /erledigt|fertig|done|abgeschlossen/i.test(title)
}

export interface OpenTask {
  card: BoardCard
  projectId: string
  projectName: string
  due: Date | null
}

/** Alle offenen Karten aller Projekte, nach Fälligkeit sortiert. */
export function openTasks(projects: Project[]): OpenTask[] {
  const result: OpenTask[] = []
  for (const project of projects) {
    const done = new Set(project.columns.filter((c) => isDoneColumn(c.title)).map((c) => c.id))
    for (const card of project.cards) {
      if (done.has(card.columnId)) continue
      result.push({
        card,
        projectId: project.id,
        projectName: project.name,
        due: card.end ? startOfDay(new Date(card.end)) : null,
      })
    }
  }
  return result.sort((a, b) => (a.due?.getTime() ?? Infinity) - (b.due?.getTime() ?? Infinity))
}

/** Zielspalte fürs Abhaken – sonst die letzte Spalte des Boards. */
export function doneColumn(project: Project): BoardColumn {
  const sorted = [...project.columns].sort((a, b) => a.order - b.order)
  return sorted.find((c) => isDoneColumn(c.title)) ?? sorted[sorted.length - 1]
}

/** Diktat-tauglich vergleichen: ohne Umlaute, Satzzeichen und Groß-/Kleinschreibung. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Offene Aufgabe zu einem gesprochenen Stichwort finden. Gesucht wird erst
 * wörtlich, dann über gemeinsame Wörter – „hake Einkaufen ab“ trifft auch
 * „Einkaufen gehen“.
 */
export function findOpenTask(projects: Project[], query: string): OpenTask | null {
  const needle = normalize(query)
  if (!needle) return null
  const words = needle.split(' ').filter((w) => w.length >= 4)

  let best: { task: OpenTask; score: number } | null = null
  for (const task of openTasks(projects)) {
    const title = normalize(task.card.title)
    let score = 0
    if (title === needle) score = 100
    else if (title.includes(needle)) score = 80 - (title.length - needle.length)
    else if (needle.includes(title)) score = 70
    else {
      const hits = words.filter((w) => title.includes(w)).length
      if (hits) score = 40 + hits * 10
    }
    if (score > 0 && (!best || score > best.score)) best = { task, score }
  }
  return best?.task ?? null
}

/** „Einkaufen ist jetzt morgen fällig, Priorität hoch.“ */
export function updateConfirmation(
  title: string,
  due: Date | null,
  priority: Priority | null,
  base = new Date(),
): string {
  const parts: string[] = []
  if (due) parts.push(`${spokenDay(due, base)} fällig`)
  if (priority) parts.push(`Priorität ${priorities[priority].label.toLowerCase()}`)
  return `„${title}“ ist jetzt ${listPhrase(parts)}.`
}

/** Sammelantwort, wenn ein Diktat mehrere Einträge enthielt. */
export function batchConfirmation(entries: Array<{ kind: 'task' | 'event' | 'note'; title: string }>): string {
  const titles = entries.slice(0, 5).map((e) => e.title)
  const rest = entries.length - titles.length
  const allTasks = entries.every((e) => e.kind === 'task')
  const what = allTasks
    ? `${entries.length} Aufgaben`
    : `${entries.length} Einträge`
  return `${what} angelegt: ${listWithRest(titles, rest)}.`
}

function eventPhrase(event: CalEvent): string {
  const start = new Date(event.start)
  return event.allDay ? `${event.title} (ganztägig)` : `um ${spokenTime(start)} ${event.title}`
}

function dayAnswer(day: Date, events: CalEvent[], projects: Project[], base: Date): string {
  const dayEvents = eventsOnDay(events, day)
  const due = openTasks(projects).filter((t) => t.due && isSameDay(t.due, day))
  const label = spokenDay(day, base)
  const opener = label.charAt(0).toUpperCase() + label.slice(1)

  if (!dayEvents.length && !due.length) return `${opener} steht nichts an.`

  const sentences: string[] = []
  if (dayEvents.length) {
    const named = dayEvents.slice(0, 4).map(eventPhrase)
    const rest = dayEvents.length - named.length
    sentences.push(
      `${opener} hast du ${eventCount(dayEvents.length)}: ${listWithRest(named, rest)}.`,
    )
  }
  if (due.length) {
    const named = due.slice(0, 4).map((t) => t.card.title)
    const rest = due.length - named.length
    const verb = due.length === 1 ? 'ist' : 'sind'
    const lead = dayEvents.length ? `Außerdem ${verb}` : `${opener} ${verb}`
    sentences.push(
      `${lead} ${taskCount(due.length)} fällig: ${listWithRest(named, rest)}.`,
    )
  }
  return sentences.join(' ')
}

function weekAnswer(events: CalEvent[], projects: Project[], base: Date): string {
  const today = startOfDay(base)
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i))
  const upcoming = days.flatMap((day) => eventsOnDay(events, day).map((event) => ({ day, event })))
  const due = openTasks(projects).filter(
    (t) => t.due && t.due >= today && t.due <= addDays(today, 6),
  )

  if (!upcoming.length && !due.length) return 'In den nächsten sieben Tagen steht nichts an.'

  const named = upcoming
    .slice(0, 4)
    .map(({ day, event }) => `${spokenDay(day, base)} ${event.allDay ? event.title : `um ${spokenTime(new Date(event.start))} ${event.title}`}`)
  const rest = upcoming.length - named.length

  const parts: string[] = []
  if (upcoming.length)
    parts.push(
      `Diese Woche: ${eventCount(upcoming.length)}, ${listWithRest(named, rest)}.`,
    )
  if (due.length) parts.push(`Dazu ${taskCount(due.length)} mit Frist.`)
  return parts.join(' ')
}

function taskAnswer(projects: Project[], base: Date): string {
  const today = startOfDay(base)
  const tasks = openTasks(projects)
  if (!tasks.length) return 'Es sind keine Aufgaben offen.'

  const overdue = tasks.filter((t) => t.due && t.due < today)
  const dueToday = tasks.filter((t) => t.due && isSameDay(t.due, today))
  const parts: string[] = [tasks.length === 1 ? 'Es ist eine Aufgabe offen.' : `Offen sind ${tasks.length} Aufgaben.`]

  if (overdue.length)
    parts.push(
      `Überfällig: ${listWithRest(overdue.slice(0, 3).map((t) => t.card.title), overdue.length - 3)}.`,
    )
  if (dueToday.length) parts.push(`Heute fällig: ${listPhrase(dueToday.slice(0, 3).map((t) => t.card.title))}.`)
  if (!overdue.length && !dueToday.length) {
    const next = tasks.find((t) => t.due)
    parts.push(next?.due ? `Als Nächstes ${spokenDay(next.due, base)}: ${next.card.title}.` : 'Nichts davon hat eine Frist.')
  }
  return parts.join(' ')
}

export function answerQuery(
  scope: QueryScope,
  events: CalEvent[],
  projects: Project[],
  base = new Date(),
): string {
  switch (scope) {
    case 'today':
      return dayAnswer(startOfDay(base), events, projects, base)
    case 'tomorrow':
      return dayAnswer(addDays(startOfDay(base), 1), events, projects, base)
    case 'week':
      return weekAnswer(events, projects, base)
    case 'tasks':
      return taskAnswer(projects, base)
  }
}

export const VOICE_HELP =
  'Sag zum Beispiel: Aufgabe Angebot schreiben bis Freitag mit hoher Priorität. ' +
  'Oder: Termin morgen um 14 Uhr Zahnarzt. Oder: Notiz Einkaufsliste. ' +
  'Du kannst auch fragen, was heute ansteht, oder sagen: öffne den Kalender.'
