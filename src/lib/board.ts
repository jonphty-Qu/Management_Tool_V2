import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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

/** Eingabe für die Schnellanlage (Spracheingabe, „Neu“-Menü). */
export interface QuickCardInput {
  title: string
  priority?: Priority
  /** Fälligkeit als ISO-String. */
  end?: string
  description?: string
  /** Projektname; ein unbekannter Name legt ein neues Projekt an. */
  projectName?: string | null
}

export interface QuickCardResult {
  cardId: string
  projectId: string
  projectName: string
  columnTitle: string
  /** Das Projekt wurde für diese Karte neu angelegt. */
  createdProject: boolean
}

/** Projekt per Name finden – Groß-/Kleinschreibung egal, Diktat ist unzuverlässig. */
function findProject(projects: Project[], name: string): Project | undefined {
  const needle = name.trim().toLowerCase()
  return (
    projects.find((p) => p.name.toLowerCase() === needle) ??
    projects.find((p) => p.name.toLowerCase().startsWith(needle) || needle.startsWith(p.name.toLowerCase()))
  )
}

export function useBoard() {
  const [state, setState] = useState<ProjectsState>(load)
  // Spiegel des Zustands: die Schnellanlage muss synchron lesen und ihr Ergebnis zurückgeben
  const stateRef = useRef(state)
  stateRef.current = state

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

  /**
   * Karte in einem Zug anlegen: Projekt suchen oder anlegen, erste Spalte wählen,
   * Karte einsortieren. Gibt zurück, wo sie gelandet ist.
   */
  const quickAdd = useCallback((input: QuickCardInput): QuickCardResult => {
    const current = stateRef.current
    let projects = current.projects
    let target = input.projectName ? findProject(projects, input.projectName) : undefined
    const createdProject = Boolean(input.projectName) && !target

    if (!target && input.projectName) {
      target = {
        id: makeId('proj'),
        name: input.projectName.trim(),
        createdAt: new Date().toISOString(),
        columns: defaultColumns(),
        cards: [],
      }
      projects = [...projects, target]
    }
    if (!target) target = projects.find((p) => p.id === current.activeId) ?? projects[0]

    const column = [...target.columns].sort((a, b) => a.order - b.order)[0]
    const card: BoardCard = {
      id: newCardId(),
      columnId: column.id,
      title: input.title,
      description: input.description,
      end: input.end,
      priority: input.priority ?? 'mittel',
      order: target.cards.filter((c) => c.columnId === column.id).length,
    }

    const next: ProjectsState = {
      activeId: target.id,
      projects: projects.map((p) => (p.id === target!.id ? { ...p, cards: [...p.cards, card] } : p)),
    }
    stateRef.current = next
    setState(next)

    return {
      cardId: card.id,
      projectId: target.id,
      projectName: target.name,
      columnTitle: column.title,
      createdProject,
    }
  }, [])

  /**
   * Karte in eine Spalte eines beliebigen Projekts schieben – für das Abhaken
   * per Sprache, das auch nicht aktive Projekte trifft.
   */
  const moveCardTo = useCallback((projectId: string, cardId: string, columnId: string) => {
    const current = stateRef.current
    const next: ProjectsState = {
      ...current,
      projects: current.projects.map((p) => {
        if (p.id !== projectId) return p
        const order = p.cards.filter((c) => c.columnId === columnId && c.id !== cardId).length
        return {
          ...p,
          cards: p.cards.map((c) => (c.id === cardId ? { ...c, columnId, order } : c)),
        }
      }),
    }
    stateRef.current = next
    setState(next)
  }, [])

  /** Felder einer Karte in einem beliebigen Projekt ändern (Sprachbefehle). */
  const updateCard = useCallback(
    (projectId: string, cardId: string, patch: Partial<Omit<BoardCard, 'id' | 'columnId'>>) => {
      const current = stateRef.current
      const next: ProjectsState = {
        ...current,
        projects: current.projects.map((p) =>
          p.id === projectId
            ? { ...p, cards: p.cards.map((c) => (c.id === cardId ? { ...c, ...patch } : c)) }
            : p,
        ),
      }
      stateRef.current = next
      setState(next)
    },
    [],
  )

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
    quickAdd,
    moveCardTo,
    updateCard,
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
