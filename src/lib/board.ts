import { useCallback, useEffect, useMemo, useState } from 'react'
import { addDays, startOfDay } from './date'

export type Priority = 'niedrig' | 'mittel' | 'hoch'

export interface BoardCard {
  id: string
  columnId: string
  title: string
  description?: string
  /** ISO-Datum (nur Tag) - optional. */
  start?: string
  end?: string
  priority: Priority
  /** Reihenfolge innerhalb der Spalte. */
  order: number
}

export interface BoardColumn {
  id: string
  title: string
  order: number
}

export interface Board {
  columns: BoardColumn[]
  cards: BoardCard[]
}

/** Ein Projekt ist ein eigenes Board mit Namen. */
export interface Project extends Board {
  id: string
  name: string
  createdAt: string
}

interface ProjectsState {
  projects: Project[]
  activeId: string
}

export const priorities: Record<Priority, { label: string; className: string }> = {
  niedrig: {
    label: 'Niedrig',
    className:
      'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300',
  },
  mittel: {
    label: 'Mittel',
    className: 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200',
  },
  hoch: {
    label: 'Hoch',
    className: 'bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-200',
  },
}

const STORAGE_KEY = 'mt.projects'
/** Frühere Version mit nur einem Board – wird beim ersten Laden als „Allgemein“ übernommen. */
const LEGACY_KEY = 'mt.board'

/** Identitätsfarben für Projekte – feste Reihenfolge, danach neutral. */
const projectColors = [
  'bg-indigo-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-sky-500',
  'bg-rose-500',
  'bg-fuchsia-500',
]

export function projectColor(index: number): string {
  return projectColors[index] ?? 'bg-neutral-400'
}

const makeId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

function defaultColumns(): BoardColumn[] {
  return [
    { id: makeId('col'), title: 'Offen', order: 0 },
    { id: makeId('col'), title: 'In Arbeit', order: 1 },
    { id: makeId('col'), title: 'Erledigt', order: 2 },
  ]
}

function seedBoard(): Board {
  const today = startOfDay(new Date())
  const iso = (d: Date) => d.toISOString()
  return {
    columns: [
      { id: 'col-backlog', title: 'Backlog', order: 0 },
      { id: 'col-progress', title: 'In Arbeit', order: 1 },
      { id: 'col-review', title: 'Review', order: 2 },
      { id: 'col-done', title: 'Fertig', order: 3 },
    ],
    cards: [
      {
        id: 'card-1',
        columnId: 'col-backlog',
        title: 'Website-Relaunch planen',
        description: 'Struktur, Inhalte und Zeitplan festlegen.',
        start: iso(today),
        end: iso(addDays(today, 14)),
        priority: 'mittel',
        order: 0,
      },
      {
        id: 'card-2',
        columnId: 'col-progress',
        title: 'Angebot Kunde X',
        description: 'Leistungen kalkulieren und Angebot schreiben.',
        start: iso(today),
        end: iso(addDays(today, 2)),
        priority: 'hoch',
        order: 0,
      },
      {
        id: 'card-3',
        columnId: 'col-done',
        title: 'Projektstruktur aufsetzen',
        priority: 'niedrig',
        order: 0,
      },
    ],
  }
}

function initialState(board: Board): ProjectsState {
  const project: Project = { id: 'proj-allgemein', name: 'Allgemein', createdAt: new Date().toISOString(), ...board }
  return { projects: [project], activeId: project.id }
}

function load(): ProjectsState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const state = JSON.parse(raw) as ProjectsState
      if (state.projects?.length) return state
    }
    const legacy = localStorage.getItem(LEGACY_KEY)
    return initialState(legacy ? (JSON.parse(legacy) as Board) : seedBoard())
  } catch {
    return initialState(seedBoard())
  }
}

export function useBoard() {
  const [state, setState] = useState<ProjectsState>(load)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      /* ignorieren */
    }
  }, [state])

  const active = useMemo(
    () => state.projects.find((p) => p.id === state.activeId) ?? state.projects[0],
    [state],
  )

  /** Änderung auf das Board des aktiven Projekts anwenden. */
  const updateActive = useCallback((fn: (b: Board) => Board) => {
    setState((s) => {
      const activeId = s.projects.some((p) => p.id === s.activeId) ? s.activeId : s.projects[0].id
      return {
        activeId,
        projects: s.projects.map((p) => (p.id === activeId ? { ...p, ...fn(p) } : p)),
      }
    })
  }, [])

  // ---------- Projekte ----------

  const setActive = useCallback((id: string) => setState((s) => ({ ...s, activeId: id })), [])

  const createProject = useCallback((name: string) => {
    const project: Project = {
      id: makeId('proj'),
      name,
      createdAt: new Date().toISOString(),
      columns: defaultColumns(),
      cards: [],
    }
    setState((s) => ({ projects: [...s.projects, project], activeId: project.id }))
  }, [])

  const renameProject = useCallback((id: string, name: string) => {
    setState((s) => ({ ...s, projects: s.projects.map((p) => (p.id === id ? { ...p, name } : p)) }))
  }, [])

  /** Das letzte Projekt bleibt immer erhalten. */
  const removeProject = useCallback((id: string) => {
    setState((s) => {
      if (s.projects.length <= 1) return s
      const rest = s.projects.filter((p) => p.id !== id)
      return { projects: rest, activeId: s.activeId === id ? rest[0].id : s.activeId }
    })
  }, [])

  // ---------- Karten ----------

  const saveCard = useCallback(
    (card: BoardCard) =>
      updateActive((b) => {
        const exists = b.cards.some((c) => c.id === card.id)
        return {
          ...b,
          cards: exists ? b.cards.map((c) => (c.id === card.id ? card : c)) : [...b.cards, card],
        }
      }),
    [updateActive],
  )

  const removeCard = useCallback(
    (id: string) => updateActive((b) => ({ ...b, cards: b.cards.filter((c) => c.id !== id) })),
    [updateActive],
  )

  /** Karte in eine Spalte einsortieren – `beforeId` legt die Position fest. */
  const moveCard = useCallback(
    (cardId: string, columnId: string, beforeId: string | null) =>
      updateActive((b) => {
        const card = b.cards.find((c) => c.id === cardId)
        if (!card) return b

        const target = b.cards
          .filter((c) => c.columnId === columnId && c.id !== cardId)
          .sort((a, z) => a.order - z.order)

        const index = beforeId ? target.findIndex((c) => c.id === beforeId) : target.length
        const at = index === -1 ? target.length : index
        target.splice(at, 0, { ...card, columnId })

        const reordered = target.map((c, i) => ({ ...c, order: i }))
        const untouched = b.cards.filter((c) => c.columnId !== columnId && c.id !== cardId)

        return { ...b, cards: [...untouched, ...reordered] }
      }),
    [updateActive],
  )

  // ---------- Spalten ----------

  const addColumn = useCallback(
    (title: string) =>
      updateActive((b) => ({
        ...b,
        columns: [...b.columns, { id: makeId('col'), title, order: b.columns.length }],
      })),
    [updateActive],
  )

  const renameColumn = useCallback(
    (id: string, title: string) =>
      updateActive((b) => ({ ...b, columns: b.columns.map((c) => (c.id === id ? { ...c, title } : c)) })),
    [updateActive],
  )

  /** Spalte an eine neue Position verschieben. */
  const moveColumn = useCallback(
    (id: string, toIndex: number) =>
      updateActive((b) => {
        const sorted = [...b.columns].sort((x, y) => x.order - y.order)
        const from = sorted.findIndex((c) => c.id === id)
        if (from === -1) return b
        const [col] = sorted.splice(from, 1)
        sorted.splice(Math.max(0, Math.min(toIndex, sorted.length)), 0, col)
        return { ...b, columns: sorted.map((c, i) => ({ ...c, order: i })) }
      }),
    [updateActive],
  )

  /** Spalte samt Karten entfernen. */
  const removeColumn = useCallback(
    (id: string) =>
      updateActive((b) => ({
        columns: b.columns.filter((c) => c.id !== id),
        cards: b.cards.filter((c) => c.columnId !== id),
      })),
    [updateActive],
  )

  return {
    projects: state.projects,
    active,
    board: active as Board,
    setActive,
    createProject,
    renameProject,
    removeProject,
    saveCard,
    removeCard,
    moveCard,
    addColumn,
    renameColumn,
    removeColumn,
    moveColumn,
  }
}

export function newCardId(): string {
  return makeId('card')
}

export function cardsOf(board: Board, columnId: string): BoardCard[] {
  return board.cards
    .filter((c) => c.columnId === columnId)
    .sort((a, b) => a.order - b.order)
}
