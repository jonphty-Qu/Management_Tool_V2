import { useCallback, useEffect, useMemo, useState } from 'react'

export interface Bookmark {
  id: string
  title: string
  url: string
  note?: string
  group: string
  /** Angeheftet – erscheint als Kachel oben und auf dem Dashboard. */
  pinned: boolean
  createdAt: string
  lastOpenedAt?: string
  openCount?: number
}

const KEY = 'mt.bookmarks'
/** Signal an andere Stellen derselben Seite (das storage-Event feuert nur in anderen Fenstern). */
const CHANGE_EVENT = 'mt:bookmarks'

export const DEFAULT_GROUP = 'Allgemein'
export const suggestedGroups = [DEFAULT_GROUP, 'Bank & Finanzen', 'Jobportale', 'Behörden', 'Arbeit & Tools', 'Lernen']

/** Lädt und ergänzt ältere Einträge (ohne Gruppe/Favorit) um Standardwerte. */
export function loadBookmarks(): Bookmark[] {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown
    if (!Array.isArray(value)) return []
    return value
      .filter((b): b is Bookmark => Boolean(b) && typeof (b as Bookmark).url === 'string')
      .map((b) => ({
        ...b,
        group: typeof b.group === 'string' && b.group.trim() ? b.group : DEFAULT_GROUP,
        pinned: Boolean(b.pinned),
      }))
  } catch {
    return []
  }
}

function persist(list: Bookmark[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    /* Storage kann blockiert sein */
  }
}

/** Nur http(s) mit echtem Hostnamen; fehlendes Protokoll wird ergänzt. */
export function normalizeUrl(value: string): string | null {
  const v = value.trim()
  if (!v) return null
  try {
    const url = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`)
    return ['http:', 'https:'].includes(url.protocol) && url.hostname.includes('.') ? url.toString() : null
  } catch {
    return null
  }
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export function newBookmarkId(): string {
  return `bookmark-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

/** Aufruf zählen, ohne den Hook – z. B. aus der Strg+K-Suche. */
export function recordOpen(id: string) {
  const now = new Date().toISOString()
  persist(loadBookmarks().map((b) => (b.id === id ? { ...b, lastOpenedAt: now, openCount: (b.openCount ?? 0) + 1 } : b)))
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

export function searchBookmarks(list: Bookmark[], query: string): Bookmark[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  return list.filter((b) => `${b.title} ${b.url} ${b.note ?? ''} ${b.group}`.toLowerCase().includes(q))
}

/** Oft genutzte zuerst, dann alphabetisch. */
export function byUsage(a: Bookmark, b: Bookmark): number {
  return (b.openCount ?? 0) - (a.openCount ?? 0) || a.title.localeCompare(b.title, 'de')
}

export function useBookmarks() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(loadBookmarks)

  // Änderungen von außen übernehmen (andere Fenster, Strg+K-Suche)
  useEffect(() => {
    const reload = () => setBookmarks(loadBookmarks())
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) reload()
    }
    window.addEventListener('storage', onStorage)
    window.addEventListener(CHANGE_EVENT, reload)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener(CHANGE_EVENT, reload)
    }
  }, [])

  const update = useCallback((fn: (prev: Bookmark[]) => Bookmark[]) => {
    setBookmarks((prev) => {
      const next = fn(prev)
      persist(next)
      return next
    })
  }, [])

  const save = useCallback(
    (bookmark: Bookmark) =>
      update((prev) =>
        prev.some((b) => b.id === bookmark.id)
          ? prev.map((b) => (b.id === bookmark.id ? bookmark : b))
          : [bookmark, ...prev],
      ),
    [update],
  )

  const remove = useCallback((id: string) => update((prev) => prev.filter((b) => b.id !== id)), [update])

  const markOpened = useCallback(
    (id: string) => {
      const now = new Date().toISOString()
      update((prev) => prev.map((b) => (b.id === id ? { ...b, lastOpenedAt: now, openCount: (b.openCount ?? 0) + 1 } : b)))
    },
    [update],
  )

  /** Vorschläge plus alle selbst angelegten Gruppen. */
  const groups = useMemo(
    () => [...new Set([...suggestedGroups, ...bookmarks.map((b) => b.group)])],
    [bookmarks],
  )

  return { bookmarks, groups, save, remove, markOpened }
}
