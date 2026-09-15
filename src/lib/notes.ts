import { useCallback, useEffect, useState } from 'react'
import { startOfDay } from './date'

export interface Note {
  id: string
  title: string
  /** Tag, dem die Notiz zugeordnet ist (ISO) – frei wählbar, Standard heute. */
  date: string
  content: string
  pinned: boolean
  createdAt: string
  updatedAt: string
}

const STORAGE_KEY = 'mt.notes'

function load(): Note[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as Note[]
  } catch {
    /* Storage kann blockiert sein */
  }
  return []
}

export function isEmptyNote(note: Note): boolean {
  return !note.title.trim() && !note.content.trim()
}

export function useNotes() {
  const [notes, setNotes] = useState<Note[]>(load)

  // Jede Änderung sofort sichern – Notizen sind klein, ein Debounce lohnt nicht
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notes))
    } catch {
      /* ignorieren */
    }
  }, [notes])

  const create = useCallback((): Note => {
    const now = new Date().toISOString()
    const note: Note = {
      id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: '',
      date: startOfDay(new Date()).toISOString(),
      content: '',
      pinned: false,
      createdAt: now,
      updatedAt: now,
    }
    setNotes((prev) => [note, ...prev])
    return note
  }, [])

  const update = useCallback((id: string, patch: Partial<Omit<Note, 'id' | 'createdAt'>>) => {
    setNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, ...patch, updatedAt: new Date().toISOString() } : n)),
    )
  }, [])

  const remove = useCallback((id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id))
  }, [])

  return { notes, create, update, remove }
}

/** Erste Zeile des Inhalts als Vorschau. */
export function notePreview(note: Note): string {
  const line = note.content
    .split('\n')
    .map((s) => s.trim())
    .find(Boolean)
  return line ?? ''
}
