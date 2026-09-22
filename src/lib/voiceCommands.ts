/**
 * Gesprochene Sätze in Einträge übersetzen.
 *
 * Der Parser arbeitet rein mit Mustern – kein Dienst, kein Schlüssel. Erkannte
 * Teile (Datum, Uhrzeit, Priorität, Projekt) werden aus dem Satz geschnitten,
 * der Rest bleibt als Titel übrig.
 */
import type { Priority } from './board'
import type { EventCategory } from './events'
import { addDays, addMinutes, startOfDay } from './date'
import { tools } from './tools'

export type QueryScope = 'today' | 'tomorrow' | 'week' | 'tasks'

export interface TaskIntent {
  kind: 'task'
  raw: string
  title: string
  priority: Priority
  /** Fälligkeitstag, wenn einer genannt wurde. */
  due: Date | null
  /** Projektname aus „im Projekt …“ – wird auf vorhandene Projekte gemappt. */
  project: string | null
  /** Aufzählung nach dem Doppelpunkt: „Einkaufen: Brot, Milch“. */
  description: string | null
}

export interface EventIntent {
  kind: 'event'
  raw: string
  title: string
  start: Date
  end: Date
  allDay: boolean
  category: EventCategory
  description: string | null
}

/** „Hake Einkaufen ab“ – der Text wird auf offene Karten gematcht. */
export interface CompleteIntent {
  kind: 'complete'
  raw: string
  query: string
}

/** „Verschiebe Einkaufen auf morgen“ – ändert eine vorhandene Karte. */
export interface UpdateIntent {
  kind: 'update'
  raw: string
  query: string
  due: Date | null
  priority: Priority | null
}

/** Zeiterfassung steuern. */
export interface TimerIntent {
  kind: 'timer'
  raw: string
  action: 'start' | 'stop' | 'pause' | 'resume'
  /** Wofür die Zeit läuft – nur beim Starten. */
  query: string | null
}

export interface NoteIntent {
  kind: 'note'
  raw: string
  title: string
  content: string
}

export interface NavigateIntent {
  kind: 'navigate'
  raw: string
  path: string
  label: string
}

export interface QueryIntent {
  kind: 'query'
  raw: string
  scope: QueryScope
}

export interface ControlIntent {
  kind: 'control'
  raw: string
  action: 'cancel' | 'undo' | 'help' | 'repeat'
}

export interface UnknownIntent {
  kind: 'unknown'
  raw: string
}

export type VoiceIntent =
  | TaskIntent
  | EventIntent
  | NoteIntent
  | CompleteIntent
  | UpdateIntent
  | TimerIntent
  | NavigateIntent
  | QueryIntent
  | ControlIntent
  | UnknownIntent

/** Einträge, die etwas anlegen – für die Sammelantwort bei mehreren Sätzen. */
export type CreateIntent = TaskIntent | EventIntent | NoteIntent

export function isCreateIntent(intent: VoiceIntent): intent is CreateIntent {
  return intent.kind === 'task' || intent.kind === 'event' || intent.kind === 'note'
}

// ---------- Bausteine ----------

const WEEKDAYS: Record<string, number> = {
  montag: 1,
  dienstag: 2,
  mittwoch: 3,
  donnerstag: 4,
  freitag: 5,
  samstag: 6,
  sonnabend: 6,
  sonntag: 0,
}

const MONTHS: Record<string, number> = {
  januar: 0,
  februar: 1,
  'märz': 2,
  maerz: 2,
  april: 3,
  mai: 4,
  juni: 5,
  juli: 6,
  august: 7,
  september: 8,
  oktober: 9,
  november: 10,
  dezember: 11,
}

/** Zahlwörter bis 24 – für „um halb drei“ und „in zwei Wochen“. */
const NUMBERS: Record<string, number> = {
  ein: 1,
  eine: 1,
  einer: 1,
  eins: 1,
  zwei: 2,
  drei: 3,
  vier: 4,
  'fünf': 5,
  fuenf: 5,
  sechs: 6,
  sieben: 7,
  acht: 8,
  neun: 9,
  zehn: 10,
  elf: 11,
  'zwölf': 12,
  zwoelf: 12,
  dreizehn: 13,
  vierzehn: 14,
  'fünfzehn': 15,
  fuenfzehn: 15,
  sechzehn: 16,
  siebzehn: 17,
  achtzehn: 18,
  neunzehn: 19,
  zwanzig: 20,
  einundzwanzig: 21,
  zweiundzwanzig: 22,
  dreiundzwanzig: 23,
  vierundzwanzig: 24,
}

/** Ordnungszahlen 1–31 für „am vierten Juni“. */
const ORDINALS: Record<string, number> = {
  ersten: 1,
  zweiten: 2,
  dritten: 3,
  vierten: 4,
  'fünften': 5,
  fuenften: 5,
  sechsten: 6,
  siebten: 7,
  siebenten: 7,
  achten: 8,
  neunten: 9,
  zehnten: 10,
  elften: 11,
  'zwölften': 12,
  zwoelften: 12,
  dreizehnten: 13,
  vierzehnten: 14,
  'fünfzehnten': 15,
  fuenfzehnten: 15,
  sechzehnten: 16,
  siebzehnten: 17,
  achtzehnten: 18,
  neunzehnten: 19,
  zwanzigsten: 20,
  einundzwanzigsten: 21,
  zweiundzwanzigsten: 22,
  dreiundzwanzigsten: 23,
  vierundzwanzigsten: 24,
  'fünfundzwanzigsten': 25,
  fuenfundzwanzigsten: 25,
  sechsundzwanzigsten: 26,
  siebenundzwanzigsten: 27,
  achtundzwanzigsten: 28,
  neunundzwanzigsten: 29,
  'dreißigsten': 30,
  dreissigsten: 30,
  einunddreissigsten: 31,
  'einunddreißigsten': 31,
}

const weekdayPattern = Object.keys(WEEKDAYS).join('|')
const monthPattern = Object.keys(MONTHS).join('|')
const numberPattern = Object.keys(NUMBERS).join('|')
const ordinalPattern = Object.keys(ORDINALS).join('|')

/** Wortweise Zahl oder Ziffer in eine Zahl umwandeln. */
function toNumber(value: string | undefined): number | null {
  if (!value) return null
  const trimmed = value.trim().toLowerCase()
  if (/^\d+$/.test(trimmed)) return Number(trimmed)
  return NUMBERS[trimmed] ?? null
}

/** Nächstes Vorkommen eines Wochentags. `skipWeek` springt in die Folgewoche. */
function nextWeekday(base: Date, weekday: number, skipWeek: boolean): Date {
  const today = startOfDay(base)
  let diff = (weekday - today.getDay() + 7) % 7
  if (skipWeek) diff += 7
  return addDays(today, diff)
}

/** Ein Datum in der Zukunft halten – „am 4. Juni“ meint im Dezember das nächste Jahr. */
function keepFuture(date: Date, base: Date, hadYear: boolean): Date {
  if (hadYear) return date
  const today = startOfDay(base)
  if (date.getTime() >= today.getTime()) return date
  const next = new Date(date)
  next.setFullYear(date.getFullYear() + 1)
  return next
}

/** Schneidet erkannte Wortgruppen heraus, damit am Ende der Titel übrig bleibt. */
class Sentence {
  text: string

  constructor(text: string) {
    this.text = text
  }

  /** Erstes Vorkommen suchen; gibt der Handler `false` zurück, bleibt der Text stehen. */
  take(pattern: RegExp, handle?: (match: RegExpMatchArray) => boolean | void): boolean {
    const match = this.text.match(pattern)
    if (!match || match.index === undefined) return false
    if (handle?.(match) === false) return false
    this.text = `${this.text.slice(0, match.index)} ${this.text.slice(match.index + match[0].length)}`
      .replace(/\s+/g, ' ')
      .trim()
    return true
  }

  has(pattern: RegExp): boolean {
    return pattern.test(this.text)
  }
}

// ---------- Datum und Uhrzeit ----------

interface TimeParts {
  date: Date | null
  minutes: number | null
  /** Dauer in Minuten, aus „für zwei Stunden“. */
  duration: number | null
}

function parseDate(sentence: Sentence, base: Date): Date | null {
  let result: Date | null = null
  const lead = '(?:am|an dem|bis(?:\\s+zum)?|zum|f[üu]r|ab)?\\s*'

  // 4.6.2026 / 4.6. / 04.06.26
  sentence.take(new RegExp(`\\b${lead}(\\d{1,2})\\.\\s*(\\d{1,2})\\.(\\s*(\\d{2,4}))?`, 'i'), (m) => {
    const day = Number(m[1])
    const month = Number(m[2])
    if (month < 1 || month > 12 || day < 1 || day > 31) return false
    const rawYear = m[4] ? Number(m[4]) : base.getFullYear()
    const year = rawYear < 100 ? 2000 + rawYear : rawYear
    const date = new Date(year, month - 1, day)
    if (date.getMonth() !== month - 1) return false
    result = keepFuture(startOfDay(date), base, Boolean(m[4]))
  })
  if (result) return result

  // am 4. Juni / bis zum 3. Oktober 2026
  sentence.take(
    new RegExp(`\\b${lead}(\\d{1,2})\\.?\\s*(${monthPattern})(\\s+(\\d{4}))?`, 'i'),
    (m) => {
      const day = Number(m[1])
      const month = MONTHS[m[2].toLowerCase()]
      if (day < 1 || day > 31) return false
      const year = m[4] ? Number(m[4]) : base.getFullYear()
      const date = new Date(year, month, day)
      if (date.getMonth() !== month) return false
      result = keepFuture(startOfDay(date), base, Boolean(m[4]))
    },
  )
  if (result) return result

  // am vierten Juni
  sentence.take(new RegExp(`\\b${lead}(${ordinalPattern})\\s+(${monthPattern})`, 'i'), (m) => {
    const day = ORDINALS[m[1].toLowerCase()]
    const month = MONTHS[m[2].toLowerCase()]
    const date = new Date(base.getFullYear(), month, day)
    if (date.getMonth() !== month) return false
    result = keepFuture(startOfDay(date), base, false)
  })
  if (result) return result

  // (bis) heute / morgen / übermorgen
  // Kein \b vor der Gruppe: es gilt nur für ASCII und würde „übermorgen“ verfehlen
  sentence.take(/(?:^|\s)(?:am\s+|bis\s+(?:zum\s+)?|zum\s+|ab\s+)?(heute|morgen|übermorgen|uebermorgen)\b/i, (m) => {
    const word = m[1].toLowerCase()
    const offset = word === 'heute' ? 0 : word === 'morgen' ? 1 : 2
    result = addDays(startOfDay(base), offset)
  })
  if (result) return result

  // in drei Tagen / in zwei Wochen / in einem Monat
  sentence.take(
    new RegExp(`\\bin\\s+(\\d{1,3}|${numberPattern}|einem)\\s+(tagen?|wochen?|monaten?)\\b`, 'i'),
    (m) => {
      const amount = m[1].toLowerCase() === 'einem' ? 1 : toNumber(m[1])
      if (amount === null) return false
      const unit = m[2].toLowerCase()
      const days = unit.startsWith('woche') ? amount * 7 : unit.startsWith('monat') ? amount * 30 : amount
      result = addDays(startOfDay(base), days)
    },
  )
  if (result) return result

  // nächste Woche / Ende der Woche / am Wochenende
  sentence.take(/\b(n[äa]chste[nr]?\s+woche|kommende[nr]?\s+woche)\b/i, () => {
    result = nextWeekday(base, 1, false).getTime() === startOfDay(base).getTime()
      ? addDays(startOfDay(base), 7)
      : nextWeekday(base, 1, true)
  })
  if (result) return result

  sentence.take(/\b(ende der woche|zum wochenende|am wochenende)\b/i, (m) => {
    result = nextWeekday(base, m[1].toLowerCase() === 'ende der woche' ? 5 : 6, false)
  })
  if (result) return result

  // bis Freitag / am nächsten Freitag
  sentence.take(
    new RegExp(`\\b${lead}(n[äa]chste[nr]?|kommende[nr]?|diese[nr]?)?\\s*(${weekdayPattern})\\b`, 'i'),
    (m) => {
      const skip = /^(n[äa]chste|kommende)/i.test(m[1] ?? '')
      result = nextWeekday(base, WEEKDAYS[m[2].toLowerCase()], skip)
    },
  )

  return result
}

function parseTime(sentence: Sentence): { minutes: number | null; duration: number | null } {
  let minutes: number | null = null
  let duration: number | null = null

  // für zwei Stunden / 90 Minuten lang
  sentence.take(
    new RegExp(`\\b(?:f[üu]r|dauert)?\\s*(\\d{1,3}|${numberPattern})\\s*(stunden?|minuten?)\\b`, 'i'),
    (m) => {
      const amount = toNumber(m[1])
      if (amount === null) return false
      duration = m[2].toLowerCase().startsWith('stunde') ? amount * 60 : amount
    },
  )

  // um 14:30 / um 14.30 Uhr
  sentence.take(/\bum\s*(\d{1,2})[:.](\d{2})\s*(uhr)?\b/i, (m) => {
    const h = Number(m[1])
    const min = Number(m[2])
    if (h > 23 || min > 59) return false
    minutes = h * 60 + min
  })
  if (minutes !== null) return withDaypart(sentence, minutes, duration)

  // um 14 Uhr 30 / 14 Uhr
  sentence.take(new RegExp(`\\b(?:um\\s*)?(\\d{1,2}|${numberPattern})\\s*uhr(?:\\s*(\\d{1,2}))?\\b`, 'i'), (m) => {
    const h = toNumber(m[1])
    if (h === null || h > 23) return false
    const min = m[2] ? Number(m[2]) : 0
    if (min > 59) return false
    minutes = h * 60 + min
  })
  if (minutes !== null) return withDaypart(sentence, minutes, duration)

  // um halb drei / viertel nach acht / viertel vor neun
  sentence.take(new RegExp(`\\b(?:um\\s*)?halb\\s*(\\d{1,2}|${numberPattern})\\b`, 'i'), (m) => {
    const h = toNumber(m[1])
    if (h === null) return false
    minutes = ((h + 23) % 24) * 60 + 30
  })
  if (minutes !== null) return withDaypart(sentence, minutes, duration)

  sentence.take(
    new RegExp(`\\b(?:um\\s*)?(viertel nach|viertel vor|dreiviertel)\\s*(\\d{1,2}|${numberPattern})\\b`, 'i'),
    (m) => {
      const h = toNumber(m[2])
      if (h === null) return false
      const word = m[1].toLowerCase()
      if (word === 'viertel nach') minutes = h * 60 + 15
      else minutes = ((h + 23) % 24) * 60 + 45
    },
  )
  if (minutes !== null) return withDaypart(sentence, minutes, duration)

  // um 8 (ohne „Uhr“)
  sentence.take(/\bum\s+(\d{1,2})\b/i, (m) => {
    const h = Number(m[1])
    if (h > 23) return false
    minutes = h * 60
  })
  if (minutes !== null) return withDaypart(sentence, minutes, duration)

  // reine Tageszeit
  sentence.take(/\b(morgens|vormittags|mittags|nachmittags|abends|nachts)\b/i, (m) => {
    minutes = daypartMinutes(m[1].toLowerCase())
  })

  return { minutes, duration }
}

function daypartMinutes(word: string): number {
  switch (word) {
    case 'morgens':
    case 'früh':
      return 8 * 60
    case 'vormittags':
      return 10 * 60
    case 'mittags':
      return 12 * 60
    case 'nachmittags':
      return 15 * 60
    case 'nachts':
      return 22 * 60
    default:
      return 19 * 60
  }
}

/** „um 3 nachmittags“ auf 15 Uhr schieben – und „halb drei“ ohne Zusatz ebenso. */
function withDaypart(
  sentence: Sentence,
  minutes: number,
  duration: number | null,
): { minutes: number; duration: number | null } {
  let result = minutes
  const named = sentence.take(/\b(morgens|vormittags|mittags|nachmittags|abends|nachts|früh)\b/i, (m) => {
    const word = m[1].toLowerCase()
    const hour = Math.floor(result / 60)
    const rest = result % 60
    const pm = word === 'nachmittags' || word === 'abends' || word === 'nachts'
    if (pm && hour < 12) result = (hour + 12) * 60 + rest
    if (!pm && hour >= 13) result = (hour - 12) * 60 + rest
  })

  // Ohne Zusatz meint „um drei“ den Nachmittag – vor 7 Uhr macht kaum jemand einen Termin
  if (!named) {
    const hour = Math.floor(result / 60)
    if (hour >= 1 && hour < 7) result += 12 * 60
  }
  return { minutes: result, duration }
}

function parseDateTime(sentence: Sentence, base: Date): TimeParts {
  const date = parseDate(sentence, base)
  const { minutes, duration } = parseTime(sentence)
  return { date, minutes, duration }
}

// ---------- Priorität, Projekt, Kategorie ----------

function parsePriority(sentence: Sentence): Priority {
  const high =
    /\b(hohe[rn]?\s+priorit[äa]t|h[öo]chste\s+priorit[äa]t|dringend|eilig|sehr wichtig|wichtig|asap|priorit[äa]t hoch)\b/i
  const low =
    /\b(niedrige[rn]?\s+priorit[äa]t|geringe\s+priorit[äa]t|unwichtig|kann warten|irgendwann|priorit[äa]t niedrig)\b/i

  if (sentence.take(high)) return 'hoch'
  if (sentence.take(low)) return 'niedrig'
  sentence.take(/\b(mittlere\s+priorit[äa]t|normale\s+priorit[äa]t|priorit[äa]t mittel)\b/i)
  return 'mittel'
}

function parseProject(sentence: Sentence): string | null {
  let project: string | null = null
  sentence.take(/\b(?:im|ins|in|f[üu]r|zum|zu)?\s*projekt\s+([\wäöüßÄÖÜ][\wäöüßÄÖÜ-]*(?:\s+[\wäöüßÄÖÜ][\wäöüßÄÖÜ-]*)?)/i, (m) => {
    project = m[1].trim()
  })
  return project
}

const CATEGORY_WORDS: Array<[RegExp, EventCategory]> = [
  [/\b(vorstellungsgespr[äa]ch|bewerbungsgespr[äa]ch|interview|gespr[äa]ch)\b/i, 'gespraech'],
  [/\bgeburtstag\b/i, 'geburtstag'],
  [/\b(deadline|abgabe|frist|f[äa]llig)\b/i, 'deadline'],
  [/\b(meeting|besprechung|standup|call|kunde|arbeit|b[üu]ro|termin mit)\b/i, 'arbeit'],
  [/\b(arzt|zahnarzt|friseur|sport|training|privat|essen|kino)\b/i, 'privat'],
]

function detectCategory(text: string): EventCategory {
  for (const [pattern, category] of CATEGORY_WORDS) if (pattern.test(text)) return category
  return 'termin'
}

// ---------- Titel aufräumen ----------

const LEAD_WORDS =
  /^(?:und\s+)?(?:bitte\s+)?(?:kannst du\s+)?(?:leg(?:e)?\s+(?:mir\s+)?(?:bitte\s+)?|trag(?:e)?\s+(?:mir\s+)?(?:bitte\s+)?|erstell(?:e)?[:,\s-]+|mach(?:e)?[:,\s-]+|f[üu]g(?:e)?[:,\s-]+|notier(?:e)?[:,\s-]+|merk(?:e)?\s+dir[:,\s-]+|erinnere mich\s*(?:daran|an)?[:,\s-]*|denk(?:e)?\s+daran[:,\s-]*|ich muss[:,\s-]+|ich sollte[:,\s-]+|ich soll[:,\s-]+|wir m[üu]ssen[:,\s-]+)+/i

/** „… eine Aufgabe an: Text“ – das trennbare „an“ gehört zum Befehl, nicht zum Titel. */
const KIND_WORDS =
  /^(?:eine?n?\s+)?(?:neue?n?\s+)?(?:aufgabe|to-?do|task|aufgaben|termin|meeting|kalendereintrag|notiz|merkzettel|eintrag)\b[:,\s-]*(?:an|ein|hinzu)?\b[:,\s-]*/i

const TAIL_WORDS =
  // „machen“ fehlt bewusst: es gehört meist zur Sache selbst („Termin machen“, „Sport machen“)
  /\s*\b(?:anlegen|eintragen|hinzuf[üu]gen|erstellen|erfassen|aufschreiben|notieren|speichern)\b[.!?]*\s*$/i

/** Punkte aus einer angesagten Liste bleiben wörtlich – nur Satzzeichen und Großschreibung. */
function plainTitle(raw: string): string {
  const text = raw
    .replace(/^[,;:\-–\s]+/, '')
    .replace(/[,;:\s]+$/, '')
    .replace(/\s+/g, ' ')
    .replace(/[.!?]+$/, '')
    .trim()
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : ''
}

function cleanTitle(raw: string, keepKind = false): string {
  let text = raw.trim()
  let previous = ''
  // Mehrfach ansetzen: „bitte leg eine neue Aufgabe an …“
  while (text !== previous) {
    previous = text
    text = text.replace(LEAD_WORDS, '')
    if (!keepKind) text = text.replace(KIND_WORDS, '')
    text = text.trim()
  }
  text = text.replace(TAIL_WORDS, '')
  text = text.replace(/^(?:dass\s+ich\s+|den\s+|die\s+|das\s+)?/i, (match) => (text.length > match.length + 3 ? '' : match))
  text = text.replace(/^[,;:\-–\s]+/, '').replace(/[,;:\s]+$/, '').replace(/\s+/g, ' ').trim()
  text = text.replace(/[.!?]+$/, '')
  if (!text) return ''
  return text.charAt(0).toUpperCase() + text.slice(1)
}

// ---------- Befehle ohne Eintrag ----------

/**
 * Titel und Einzelheiten trennen: „Einkaufen: Brötchen, Fleisch“ wird zu einem
 * kurzen Titel mit Beschreibung. Ohne Doppelpunkt bleibt alles der Titel.
 */
function splitDetails(text: string): { title: string; description: string | null } {
  const match = text.match(/^(.{3,60}?)\s*(?::|\s-\s|\bund zwar\b)\s*(.{3,})$/s)
  if (!match) return { title: text, description: null }
  const description = match[2].trim()
  return {
    title: match[1].trim(),
    description: description ? description.charAt(0).toUpperCase() + description.slice(1) : null,
  }
}

function matchComplete(text: string): CompleteIntent | null {
  const patterns = [
    /(?:^|\s)(?:hake?|hak)\s+(.+?)\s+ab\b/i,
    /(?:^|\s)(?:setze?|markiere?)\s+(.+?)\s+auf\s+(?:erledigt|fertig)\b/i,
    /(?:^|\s)ich\s+habe\s+(.+?)\s+(?:erledigt|gemacht|fertig)\b/i,
    /^(.+?)\s+(?:ist|sind|wurde)\s+(?:erledigt|fertig|abgehakt|gemacht)\b/i,
    /(?:^|\s)(?:erledigt|abhaken)[:,]\s*(.+)$/i,
  ]
  for (const pattern of patterns) {
    const match = text.match(pattern)
    const query = match?.[1]?.trim().replace(/^(?:die|der|das|den|meine?n?)\s+/i, '')
    if (query && query.length >= 3) return { kind: 'complete', raw: text, query }
  }
  return null
}

/**
 * Angesagte Liste: „Aufgaben: Werkstatt anrufen, Präsentation, Einkaufen“.
 * Nur mit dem Plural-Stichwort und Doppelpunkt – sonst würde „Einkaufen: Brot,
 * Milch“ fälschlich in drei Aufgaben zerfallen.
 */
export function parseTaskList(input: string): string[] | null {
  // Zwischen Stichwort und Doppelpunkt darf noch etwas stehen: „die Aufgaben anlegen:“
  const match = input.match(
    /^.{0,40}?\b(?:aufgabenliste|aufgaben|to-?dos|todos)\b(?:\s+\w+){0,3}\s*[:–-]\s*(.+)$/is,
  )
  if (!match) return null
  // Nicht nach einem Bindestrich trennen: „Spülmaschine ein- und ausräumen“
  const parts = match[1]
    .split(/,\s*|;\s*|(?<!-)\s+und\s+/i)
    .map((part) => part.trim().replace(/^[,;\s]+|[.,;\s]+$/g, ''))
    .filter((part) => part.length >= 3)
  return parts.length >= 2 ? parts : null
}

function matchTimer(text: string): TimerIntent | null {
  const lower = text.toLowerCase()
  if (!/\b(timer|zeit(erfassung)?|stoppuhr|uhr l[äa]uft)\b/.test(lower)) return null

  if (/\b(stopp?(e|en)?|beende?(n)?|halt an|aus)\b/.test(lower))
    return { kind: 'timer', raw: text, action: 'stop', query: null }
  if (/\b(pausiere?(n)?|pause|unterbrich)\b/.test(lower))
    return { kind: 'timer', raw: text, action: 'pause', query: null }
  if (/\b(weiter|fortsetzen|mach weiter)\b/.test(lower))
    return { kind: 'timer', raw: text, action: 'resume', query: null }
  if (!/\b(start(e|en)?|beginn(e|en)?|l[äa]uft|neue?r?)\b/.test(lower) && !/^timer\b/i.test(text.trim()))
    return null

  // „starte den Timer für Bewerben“ – alles nach „für“ ist die Tätigkeit
  const target = text.match(/\b(?:f[üu]r|auf|zu)\s+(.{3,})$/i)?.[1]
  const fallback = text.match(/\btimer\s+(.{3,})$/i)?.[1]
  const query = (target ?? fallback ?? '').trim().replace(/[.!?]+$/, '') || null
  return { kind: 'timer', raw: text, action: 'start', query }
}

/**
 * Änderungen an vorhandenen Aufgaben. Nur mit klarem Verb – sonst würde
 * „Einkaufen bis morgen“ die Aufgabe ändern statt eine neue anzulegen.
 */
function matchUpdate(text: string, base: Date): UpdateIntent | null {
  const match = text.match(
    /(?:^|\s)(?:verschiebe?|schieb(?:e)?|setze?|[äa]ndere?|mach(?:e)?)\s+(.+?)\s+(?:auf|zu|nach|bis)\s+(.+)$/i,
  )
  if (!match) return null

  const query = match[1].trim().replace(/^(?:die|der|das|den|meine?n?)\s+(?:aufgabe\s+)?/i, '')
  if (query.length < 3) return null

  const rest = new Sentence(match[2])
  const priority = rest.has(/priorit[äa]t|dringend|wichtig|eilig/i) ? parsePriority(rest) : null
  const due = parseDate(rest, base)
  if (!due && !priority) return null
  return { kind: 'update', raw: text, query, due, priority }
}

/** Wörter, die einen neuen Auftrag einleiten – nur davor wird getrennt. */
const COMMAND_START =
  /^(?:eine?n?\s+)?(?:neue?n?\s+)?(?:aufgabe|to-?do|task|termin|meeting|notiz|merkzettel|kalendereintrag|erinnere\s+mich|leg(?:e)?\s+|trag(?:e)?\s+|notier(?:e)?|merk(?:e)?\s+dir)/i

/**
 * Ein Diktat kann mehrere Aufträge enthalten. Getrennt wird nur an klaren
 * Stellen: Semikolon, „und dann“ und Kommas vor einem neuen Auftragswort –
 * damit „bis Freitag, hohe Priorität“ zusammenbleibt.
 */
export function splitCommands(input: string): string[] {
  const rough = input
    .split(/;|(?:^|\s)(?:und\s+dann|dann\s+noch|und\s+au[ßs]erdem|au[ßs]erdem|als\s+n[äa]chstes|weiterhin)\s+/i)
    .flatMap((part) => {
      // Komma oder „und“ nur trennen, wenn danach wieder ein Auftrag beginnt
      const pieces: string[] = []
      let rest = part
      const separator = /,\s+|(?<!-)\s+und\s+/i
      let guard = 0
      while (guard < 20) {
        guard += 1
        const hit = rest.match(separator)
        if (!hit || hit.index === undefined) break
        const after = rest.slice(hit.index + hit[0].length)
        if (!COMMAND_START.test(after)) break
        pieces.push(rest.slice(0, hit.index))
        rest = after
      }
      pieces.push(rest)
      return pieces
    })
    .map((part) => part.trim().replace(/^[,;\s]+|[,;\s]+$/g, ''))
    .filter((part) => part.length >= 3)

  return rough.length ? rough : [input.trim()]
}

function matchControl(text: string): ControlIntent | null {
  const lower = text.toLowerCase()
  if (/\b(abbrechen|abbruch|stopp|stop|beenden|schlie[ßs]en|zumachen|das war'?s|danke das war es|fertig, danke)\b/.test(lower))
    return { kind: 'control', raw: text, action: 'cancel' }
  if (/\b(r[üu]ckg[äa]ngig|doch nicht|l[öo]sch(?:e)? das|wieder weg|vergiss das|falsch)\b/.test(lower))
    return { kind: 'control', raw: text, action: 'undo' }
  if (/\b(hilfe|was kannst du|wie geht das|beispiele?)\b/.test(lower))
    return { kind: 'control', raw: text, action: 'help' }
  if (/\b(noch mal|nochmal|wiederhol(?:e)?)\b/.test(lower))
    return { kind: 'control', raw: text, action: 'repeat' }
  return null
}

function matchQuery(text: string, base: Date): QueryIntent | null {
  const lower = text.toLowerCase()
  const asking =
    /\b(was|welche|wie viele|wieviele|zeig mir was|sag mir was)\b/.test(lower) ||
    /\b(steht.*an|habe ich|hab ich|ist los|sieht.*tag aus|ist f[äa]llig)\b/.test(lower)
  if (!asking) return null
  if (!/\b(an|termine?|aufgaben?|to-?dos?|kalender|tag|woche|f[äa]llig|los)\b/.test(lower)) return null

  if (/\bmorgen\b/.test(lower)) return { kind: 'query', raw: text, scope: 'tomorrow' }
  if (/\b(woche|diese woche|n[äa]chste tage)\b/.test(lower)) return { kind: 'query', raw: text, scope: 'week' }
  if (/\b(aufgaben?|to-?dos?|f[äa]llig|offen)\b/.test(lower) && !/\btermine?\b/.test(lower))
    return { kind: 'query', raw: text, scope: 'tasks' }
  void base
  return { kind: 'query', raw: text, scope: 'today' }
}

function matchNavigation(text: string): NavigateIntent | null {
  // Kein \b am Anfang – es greift nicht vor „ö“
  const match = text.match(
    /(?:^|\s)(?:öffne|oeffne|zeig(?:e)?(?:\s+mir)?|geh(?:e)?\s+(?:zu|auf)|wechsle?\s+(?:zu|auf)|springe?\s+zu)\s+(?:die|den|das|zur|zum|zu)?\s*([\wäöüßÄÖÜ -]{3,})/i,
  )
  if (!match) return null
  const needle = match[1].trim().toLowerCase().replace(/[.!?]+$/, '')
  if (!needle) return null

  const tool = tools.find(
    (t) =>
      needle.startsWith(t.name.toLowerCase()) ||
      t.name.toLowerCase().startsWith(needle) ||
      (t.keywords ?? []).some((k) => needle.startsWith(k) || k === needle),
  )
  if (!tool) return null
  return { kind: 'navigate', raw: text, path: tool.path, label: tool.name }
}

// ---------- Einstieg ----------

/** Was für ein Eintrag ist gemeint? Ohne Hinweis wird es eine Aufgabe. */
function detectKind(text: string): 'task' | 'event' | 'note' {
  const lower = text.toLowerCase()
  // Ohne schließendes \b, damit „notiere“ und „notiert“ mitzählen
  if (/(?:^|\s)(notiz|notier|merk dir|merke dir|schreib(?:e)? auf|aufschreiben)/.test(lower)) return 'note'
  if (/\b(termin|meeting|besprechung|kalender|verabredung|vorstellungsgespr[äa]ch|geburtstag|arzttermin|standup|call)\b/.test(lower))
    return 'event'
  // „um 14 Uhr“ ohne Aufgabenwort deutet auf einen Termin
  if (
    !/\b(aufgabe|to-?do|task|erinnere|erledigen|bis)\b/.test(lower) &&
    /\b(um\s*\d{1,2}([:.]\d{2})?\s*(uhr)?|uhr)\b/.test(lower)
  )
    return 'event'
  return 'task'
}

/** Höflichkeiten und Ja/Nein sind kein Auftrag – sonst entstünde daraus eine Aufgabe „Ja“. */
const FILLER = /^(?:ja|jap|nein|n[öo]|ok|okay|hallo|hi|hey|danke|bitte|h[mn]+|[äa]h+|test|guten (?:morgen|tag|abend))[.!?]*$/i

/**
 * @param forceKind Aus einer angesagten Liste: dann ist jeder Punkt eine
 * Aufgabe, auch wenn er „Termin machen“ heißt.
 */
export function parseVoiceCommand(
  input: string,
  base = new Date(),
  forceKind?: 'task',
): VoiceIntent {
  const raw = input.trim()
  if (!raw || raw.length < 3 || FILLER.test(raw)) return { kind: 'unknown', raw }

  if (forceKind === 'task') {
    const sentence = new Sentence(raw)
    const { date, minutes } = parseDateTime(sentence, base)
    const priority = parsePriority(sentence)
    const project = parseProject(sentence)
    const cleaned = plainTitle(sentence.text)
    if (!cleaned) return { kind: 'unknown', raw }
    const { title, description } = splitDetails(cleaned)
    return {
      kind: 'task',
      raw,
      title,
      priority,
      due: date ?? (minutes !== null ? startOfDay(base) : null),
      project,
      description,
    }
  }

  // Vor den Steuerbefehlen: „stopp den Timer“ ist kein Abbruch des Dialogs
  const timer = matchTimer(raw)
  if (timer) return timer

  const control = matchControl(raw)
  if (control) return control

  const query = matchQuery(raw, base)
  if (query) return query

  // Nach den Fragen, damit „welche Aufgaben sind erledigt“ eine Frage bleibt
  const done = matchComplete(raw)
  if (done) return done

  const update = matchUpdate(raw, base)
  if (update) return update

  const navigation = matchNavigation(raw)
  if (navigation) return navigation

  const kind = detectKind(raw)
  const sentence = new Sentence(raw)

  if (kind === 'note') {
    const title = cleanTitle(sentence.text)
    if (!title) return { kind: 'unknown', raw }
    // Erster Satz wird die Überschrift, der Rest der Inhalt
    const split = title.match(/^(.{3,60}?)(?:[.:] )(.*)$/s)
    return {
      kind: 'note',
      raw,
      title: split ? split[1].trim() : title,
      content: split ? split[2].trim() : title,
    }
  }

  const { date, minutes, duration } = parseDateTime(sentence, base)

  if (kind === 'event') {
    const category = detectCategory(raw)
    const day = date ?? startOfDay(base)
    const allDay = minutes === null
    const start = allDay ? startOfDay(day) : addMinutes(startOfDay(day), minutes)
    const end = allDay
      ? addMinutes(startOfDay(day), 24 * 60 - 1)
      : addMinutes(start, duration ?? 60)
    const cleaned = cleanTitle(sentence.text)
    if (!cleaned) return { kind: 'unknown', raw }
    const { title, description } = splitDetails(cleaned)
    return { kind: 'event', raw, title, start, end, allDay, category, description }
  }

  const priority = parsePriority(sentence)
  const project = parseProject(sentence)
  const cleaned = cleanTitle(sentence.text)
  if (!cleaned) return { kind: 'unknown', raw }
  const { title, description } = splitDetails(cleaned)

  // Uhrzeit ohne Datum bei einer Aufgabe: als Fälligkeit heute werten
  const due = date ?? (minutes !== null ? startOfDay(base) : null)
  return { kind: 'task', raw, title, priority, due, project, description }
}

/** Ja/Nein aus einer gesprochenen Antwort lesen. */
export function parseConfirmation(text: string): boolean | null {
  const lower = text.trim().toLowerCase()
  if (/\b(ja|jap|jo|genau|passt|stimmt|richtig|korrekt|okay|ok|mach das|anlegen|speichern)\b/.test(lower)) return true
  if (/\b(nein|n[öo]|falsch|stimmt nicht|abbrechen|doch nicht|verwerfen|l[öo]schen)\b/.test(lower)) return false
  return null
}
