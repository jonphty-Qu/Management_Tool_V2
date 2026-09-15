import { useCallback, useEffect, useMemo, useState } from 'react'
import { addDays, startOfDay } from './date'

export type AppStatus =
  | 'entwurf'
  | 'abgeschickt'
  | 'gespraech'
  | 'absage'
  | 'zusage'

/** Dauerhaft zugeordnete Nachricht aus der Postfach-Suche. */
export interface LinkedMail {
  accountId: string
  uid: number
  folder: string
  direction: 'in' | 'out'
  messageId?: string
  from: string
  fromAddress: string
  subject: string
  date: string
  snippet: string
  link?: string
  isRejection?: boolean
}

export interface Application {
  id: string
  company: string
  position: string
  /** Link zur Stellenanzeige. */
  jobUrl?: string
  /** Link zum Unternehmen. */
  companyUrl?: string
  status: AppStatus
  /** Tag der Bewerbung (ISO). */
  appliedAt?: string
  location?: string
  source?: string
  notes?: string
  /** Mitgeschickte Unterlagen (IDs aus der Unterlagen-Ablage). */
  documentIds?: string[]
  /** Gespeicherte Stellenbeschreibung. */
  jobDescription?: string
  /** Zugeordnete E-Mails und Kalendertermine. */
  emails?: LinkedMail[]
  interviewIds?: string[]
}

export const statusMeta: Record<AppStatus, { label: string; className: string; dot: string }> = {
  entwurf: {
    label: 'In Arbeit',
    className: 'bg-neutral-200 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-200',
    dot: 'bg-neutral-400',
  },
  abgeschickt: {
    label: 'Abgeschickt',
    className: 'bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-200',
    dot: 'bg-sky-500',
  },
  gespraech: {
    label: 'Gespräch',
    className: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-200',
    dot: 'bg-indigo-500',
  },
  absage: {
    label: 'Absage',
    className: 'bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-200',
    dot: 'bg-rose-500',
  },
  zusage: {
    label: 'Zusage',
    className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200',
    dot: 'bg-emerald-500',
  },
}

export const statusOrder: AppStatus[] = [
  'entwurf',
  'abgeschickt',
  'gespraech',
  'zusage',
  'absage',
]

const STORAGE_KEY = 'mt.applications'

function seed(): Application[] {
  const today = startOfDay(new Date())
  return [
    {
      id: 'app-1',
      company: 'Musterfirma GmbH',
      position: 'Frontend-Entwickler',
      jobUrl: 'https://example.com/stellen/frontend',
      companyUrl: 'https://example.com',
      status: 'abgeschickt',
      appliedAt: addDays(today, -6).toISOString(),
      location: 'Remote',
      source: 'LinkedIn',
    },
    {
      id: 'app-2',
      company: 'Beispiel AG',
      position: 'Werkstudent Softwareentwicklung',
      companyUrl: 'https://example.org',
      status: 'entwurf',
      location: 'Hamburg',
    },
  ]
}

function load(): Application[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as Application[]
  } catch {
    /* Storage kann blockiert sein */
  }
  return seed()
}

/** Vergleichbarer Firmenname – für die Dublettenerkennung. */
function normalizeCompany(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(gmbh|ag|se|kg|ug|mbh|co|inc|ltd|e\.?v\.?)\b/g, '')
    .replace(/[^a-z0-9äöüß]/g, '')
    .trim()
}

export function useApplications() {
  const [applications, setApplications] = useState<Application[]>(load)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(applications))
    } catch {
      /* ignorieren */
    }
  }, [applications])

  const save = useCallback((app: Application) => {
    setApplications((prev) => {
      const exists = prev.some((a) => a.id === app.id)
      return exists ? prev.map((a) => (a.id === app.id ? app : a)) : [...prev, app]
    })
  }, [])

  const remove = useCallback((id: string) => {
    setApplications((prev) => prev.filter((a) => a.id !== id))
  }, [])

  const setStatus = useCallback((id: string, status: AppStatus) => {
    setApplications((prev) =>
      prev.map((a) =>
        a.id === id
          ? {
              ...a,
              status,
              // Beim Abschicken das Datum setzen, falls noch keins da ist
              appliedAt:
                status !== 'entwurf' && !a.appliedAt
                  ? startOfDay(new Date()).toISOString()
                  : a.appliedAt,
            }
          : a,
      ),
    )
  }, [])

  const counts = useMemo(() => {
    const map = {} as Record<AppStatus, number>
    for (const status of statusOrder) map[status] = 0
    for (const app of applications) map[app.status] = (map[app.status] ?? 0) + 1
    return map
  }, [applications])

  /** Firmen, bei denen mehr als eine Bewerbung liegt. */
  const duplicates = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const app of applications) {
      const key = normalizeCompany(app.company)
      if (!key) continue
      map.set(key, [...(map.get(key) ?? []), app.id])
    }
    return new Set(
      [...map.values()].filter((ids) => ids.length > 1).flat(),
    )
  }, [applications])

  return { applications, save, remove, setStatus, counts, duplicates }
}

export function newApplicationId(): string {
  return `app-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

/** Host eines Links für die kompakte Anzeige. */
export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/** Fehlendes Protokoll ergänzen, damit Links klickbar bleiben. */
export function normalizeUrl(url: string): string {
  const trimmed = url.trim()
  if (!trimmed) return ''
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
}

/** Ergebnis des Link-Imports – Felder fehlen, wenn die Seite sie nicht liefert. */
export interface ParsedJob {
  url: string
  position?: string
  company?: string
  companyUrl?: string
  location?: string
  source?: string
  employmentType?: string
  salary?: string
  datePosted?: string
  validThrough?: string
  description?: string
  via: 'json-ld' | 'meta' | 'none'
}

/**
 * Stellenanzeige über den lokalen Server auslesen.
 * Bei Blockaden kommt `partial` mit Link und Quelle zurück.
 */
export async function parseJobUrl(
  url: string,
): Promise<{ job: Partial<ParsedJob>; error?: string }> {
  try {
    const res = await fetch('/api/jobs/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'management-tool' },
      body: JSON.stringify({ url }),
    })
    const data = (await res.json().catch(() => ({}))) as ParsedJob & {
      error?: string
      partial?: Partial<ParsedJob>
    }
    if (!res.ok) return { job: data.partial ?? { url }, error: data.error ?? `Fehler ${res.status}` }
    return { job: data }
  } catch {
    return { job: { url }, error: 'Der lokale Server ist nicht erreichbar.' }
  }
}

/** Übernimmt ausgelesene Felder – vorhandene Werte bleiben, wo nichts gefunden wurde. */
export function applyParsedJob(base: Application, job: Partial<ParsedJob>): Application {
  const extra = [
    job.employmentType && `Anstellung: ${job.employmentType}`,
    job.salary && `Gehalt: ${job.salary}`,
    job.validThrough && `Bewerbungsfrist: ${formatDate(job.validThrough)}`,
    job.datePosted && `Ausgeschrieben: ${formatDate(job.datePosted)}`,
  ].filter(Boolean)
  const notes = [extra.join(' · '), job.description].filter(Boolean).join('\n\n')

  return {
    ...base,
    jobUrl: job.url ?? base.jobUrl,
    company: job.company ?? base.company,
    position: job.position ?? base.position,
    companyUrl: job.companyUrl ?? base.companyUrl,
    location: job.location ?? base.location,
    source: job.source ?? base.source,
    notes: notes || base.notes,
  }
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? iso
    : new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d)
}
