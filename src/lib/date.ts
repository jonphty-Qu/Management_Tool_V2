/** Datums-Helfer. Woche beginnt Montag (deutsche Konvention). */

export const HOUR_HEIGHT = 48 // px pro Stunde im Zeitraster
export const SLOT_MINUTES = 30

export function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

export function addDays(d: Date, days: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + days)
  return x
}

export function addMonths(d: Date, months: number): Date {
  const x = new Date(d)
  x.setDate(1)
  x.setMonth(x.getMonth() + months)
  return x
}

export function addMinutes(d: Date, minutes: number): Date {
  return new Date(d.getTime() + minutes * 60_000)
}

/** Montag der Woche, in der d liegt. */
export function startOfWeek(d: Date): Date {
  const x = startOfDay(d)
  const day = (x.getDay() + 6) % 7 // Mo = 0
  return addDays(x, -day)
}

export function startOfMonth(d: Date): Date {
  const x = startOfDay(d)
  x.setDate(1)
  return x
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

export function isToday(d: Date): boolean {
  return isSameDay(d, new Date())
}

export function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()
}

/** ISO-Kalenderwoche. */
export function isoWeek(d: Date): number {
  const x = startOfDay(d)
  x.setDate(x.getDate() + 3 - ((x.getDay() + 6) % 7))
  const firstThursday = new Date(x.getFullYear(), 0, 4)
  firstThursday.setDate(firstThursday.getDate() + 3 - ((firstThursday.getDay() + 6) % 7))
  return 1 + Math.round((x.getTime() - firstThursday.getTime()) / (7 * 86_400_000))
}

/** Minuten seit Mitternacht. */
export function minutesOfDay(d: Date): number {
  return d.getHours() * 60 + d.getMinutes()
}

/** Auf das nächste SLOT_MINUTES-Raster abrunden. */
export function floorToSlot(minutes: number): number {
  return Math.floor(minutes / SLOT_MINUTES) * SLOT_MINUTES
}

export function dateAtMinutes(day: Date, minutes: number): Date {
  const x = startOfDay(day)
  x.setMinutes(minutes)
  return x
}

const fmtTime = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' })
const fmtWeekdayShort = new Intl.DateTimeFormat('de-DE', { weekday: 'short' })
const fmtMonthYear = new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' })
const fmtDayLong = new Intl.DateTimeFormat('de-DE', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})
const fmtDayShort = new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'long' })

export const formatTime = (d: Date) => fmtTime.format(d)
export const formatWeekdayShort = (d: Date) => fmtWeekdayShort.format(d).replace('.', '')
export const formatMonthYear = (d: Date) => fmtMonthYear.format(d)
export const formatDayLong = (d: Date) => fmtDayLong.format(d)
export const formatDayShort = (d: Date) => fmtDayShort.format(d)

/** Wert für <input type="datetime-local"> bzw. type="date". */
export function toLocalInput(d: Date, withTime = true): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  return withTime ? `${date}T${pad(d.getHours())}:${pad(d.getMinutes())}` : date
}

export function fromLocalInput(value: string): Date {
  return new Date(value.length === 10 ? `${value}T00:00` : value)
}

/**
 * Freitext-Datum: "04062026", "040626", "0406", "4.6.2026", "4/6/26",
 * "heute", "morgen", "übermorgen". Gibt null zurück, wenn nichts passt.
 */
export function parseDateText(text: string, base = new Date()): Date | null {
  const raw = text.trim().toLowerCase()
  if (!raw) return null

  if (raw === 'heute') return startOfDay(base)
  if (raw === 'morgen') return startOfDay(addDays(base, 1))
  if (raw === 'übermorgen' || raw === 'uebermorgen') return startOfDay(addDays(base, 2))

  const digits = raw.replace(/\D/g, '')
  const hasSeparator = /[.\-/\s]/.test(raw)
  let day: number, month: number, year: number

  if (hasSeparator) {
    // 4.6.2026 / 4-6-26 / 4/6
    const parts = raw.split(/[.\-/\s]+/).filter(Boolean)
    if (parts.length < 2) return null
    day = Number(parts[0])
    month = Number(parts[1])
    year = parts[2] ? Number(parts[2]) : base.getFullYear()
    if (!Number.isFinite(day) || !Number.isFinite(month) || !Number.isFinite(year)) return null
    if (year < 100) year += 2000
  } else if (/^\d{4}$/.test(digits)) {
    // TTMM – Jahr aus dem Bezugsdatum
    day = +digits.slice(0, 2)
    month = +digits.slice(2, 4)
    year = base.getFullYear()
  } else if (/^\d{6}$/.test(digits)) {
    day = +digits.slice(0, 2)
    month = +digits.slice(2, 4)
    year = 2000 + +digits.slice(4, 6)
  } else if (/^\d{8}$/.test(digits)) {
    day = +digits.slice(0, 2)
    month = +digits.slice(2, 4)
    year = +digits.slice(4, 8)
  } else {
    return null
  }

  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  const d = new Date(year, month - 1, day)
  // Rollover abfangen (z. B. 31.02.)
  if (d.getMonth() !== month - 1 || d.getDate() !== day) return null
  return startOfDay(d)
}

/** Freitext-Uhrzeit: "1430", "14:30", "14", "9.15". */
export function parseTimeText(text: string): number | null {
  const raw = text.trim()
  if (!raw) return null
  const digits = raw.replace(/\D/g, '')
  let h: number, m: number
  if (digits.length <= 2) {
    h = +digits
    m = 0
  } else if (digits.length === 3) {
    h = +digits.slice(0, 1)
    m = +digits.slice(1, 3)
  } else if (digits.length === 4) {
    h = +digits.slice(0, 2)
    m = +digits.slice(2, 4)
  } else {
    return null
  }
  if (h > 23 || m > 59) return null
  return h * 60 + m
}

const fmtDateShort = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})
/** Anzeigeformat für Eingabefelder: 04.06.2026 */
export const formatDateInput = (d: Date) => fmtDateShort.format(d)

/** Kalendertage zwischen zwei Daten (Zeit wird ignoriert). */
export function daysBetween(a: Date, b: Date): number {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / 86_400_000)
}
