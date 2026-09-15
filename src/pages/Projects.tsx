import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Plus,
  MoreHorizontal,
  Trash2,
  Pencil,
  CalendarRange,
  ArrowLeft,
  ArrowRight,
  GripVertical,
  FolderPlus,
  Play,
  Pause,
  Square,
  Clock3,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import CardDialog from '@/components/board/CardDialog'
import {
  cardsOf,
  newCardId,
  priorities,
  projectColor,
  useBoard,
  type BoardCard,
} from '@/lib/board'
import { formatDateInput } from '@/lib/date'
import { formatTrackedTime, loadRunningTime, loadTimeEntries } from '@/lib/time'

interface DropAt {
  columnId: string
  /** Karte, vor der eingefügt wird – null heißt ans Ende. */
  beforeId: string | null
}

export default function Projects() {
  const {
    projects,
    active,
    board,
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
  } = useBoard()
  const [draft, setDraft] = useState<BoardCard | null>(null)
  const [existing, setExisting] = useState(false)
  const [dropAt, setDropAt] = useState<DropAt | null>(null)
  const [menuFor, setMenuFor] = useState<string | null>(null)
  const dragId = useRef<string | null>(null)
  // Spalten-Ziehen läuft getrennt vom Karten-Ziehen
  const colDragId = useRef<string | null>(null)
  const [colDrop, setColDrop] = useState<number | null>(null)
  const [, setTimeTick] = useState(0)
  const [params, setParams] = useSearchParams()

  const columns = [...board.columns].sort((a, b) => a.order - b.order)
  const trackedByCard = new Map<string, number>()
  for (const entry of loadTimeEntries()) trackedByCard.set(entry.cardId ?? '', (trackedByCard.get(entry.cardId ?? '') ?? 0) + (Number(entry.seconds) || 0))
  const running = loadRunningTime()
  const runningSeconds = running ? (running.accumulated ?? 0) + (running.paused ? 0 : Math.max(0, Math.floor((Date.now() - new Date(running.startedAt).getTime()) / 1000))) : 0
  if (running?.cardId) trackedByCard.set(running.cardId, (trackedByCard.get(running.cardId) ?? 0) + (running.accumulated ?? 0) + (running.paused ? 0 : Math.max(0, Math.floor((Date.now() - new Date(running.startedAt).getTime()) / 1000))))

  useEffect(() => {
    const timer = window.setInterval(() => setTimeTick((value) => value + 1), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const startTimer = (card: BoardCard) => {
    if (running) return
    localStorage.setItem('mt.time.running', JSON.stringify({ task: card.title || 'Aufgabe', startedAt: new Date().toISOString(), cardId: card.id, projectId: active.id, accumulated: 0, paused: false }))
    setTimeTick((value) => value + 1)
  }
  const pauseTimer = () => {
    if (!running || running.paused) return
    const seconds = (running.accumulated ?? 0) + Math.max(0, Math.floor((Date.now() - new Date(running.startedAt).getTime()) / 1000))
    localStorage.setItem('mt.time.running', JSON.stringify({ ...running, accumulated: seconds, startedAt: new Date().toISOString(), paused: true }))
    setTimeTick((value) => value + 1)
  }
  const resumeTimer = () => {
    if (!running || !running.paused) return
    localStorage.setItem('mt.time.running', JSON.stringify({ ...running, startedAt: new Date().toISOString(), paused: false }))
    setTimeTick((value) => value + 1)
  }
  const stopTimer = () => {
    if (!running) return
    const seconds = (running.accumulated ?? 0) + (running.paused ? 0 : Math.max(0, Math.floor((Date.now() - new Date(running.startedAt).getTime()) / 1000)))
    const entries = loadTimeEntries()
    entries.unshift({ task: running.task, startedAt: running.startedAt, endedAt: new Date().toISOString(), seconds: Math.max(1, seconds), cardId: running.cardId })
    localStorage.setItem('mt.time', JSON.stringify(entries))
    localStorage.removeItem('mt.time.running')
    setTimeTick((value) => value + 1)
  }

  const openNew = (columnId: string) => {
    setExisting(false)
    setDraft({
      id: newCardId(),
      columnId,
      title: '',
      priority: 'mittel',
      order: cardsOf(board, columnId).length,
    })
  }

  const openCard = (card: BoardCard) => {
    setExisting(true)
    setDraft(card)
  }

  // Schnellanlage aus dem „Neu“-Menü (?neu=aufgabe)
  useEffect(() => {
    if (params.get('neu') !== 'aufgabe') return
    if (columns[0]) openNew(columns[0].id)
    setParams({}, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  useEffect(() => {
    const projectId = params.get('projekt')
    const cardId = params.get('aufgabe')
    if (!projectId && !cardId) return
    const project = projects.find((item) => item.id === projectId)
    if (project) {
      setActive(project.id)
      const card = project.cards.find((item) => item.id === cardId)
      if (card) openCard(card)
    }
    setParams({}, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, projects])

  const dropColumn = () => {
    const id = colDragId.current
    const target = colDrop
    colDragId.current = null
    setColDrop(null)
    if (!id || target === null) return
    const from = columns.findIndex((c) => c.id === id)
    // Die Zielposition zählt noch mit der gezogenen Spalte
    moveColumn(id, target > from ? target - 1 : target)
  }

  const endDrag = () => {
    dragId.current = null
    setDropAt(null)
  }

  const drop = (columnId: string, beforeId: string | null) => {
    const id = dragId.current
    endDrag()
    if (id) moveCard(id, columnId, beforeId)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {/* Projekte als Reiter */}
      <div className="flex items-end gap-1 overflow-x-auto border-b border-neutral-200 dark:border-neutral-800">
        {projects.map((p, i) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setActive(p.id)}
            className={cn(
              '-mb-px flex shrink-0 items-center gap-2 border-b-2 px-3 py-2 text-sm transition',
              p.id === active.id
                ? 'border-neutral-900 font-medium text-neutral-900 dark:border-white dark:text-white'
                : 'border-transparent text-neutral-500 hover:text-neutral-900 dark:hover:text-white',
            )}
          >
            <span className={cn('size-2 rounded-full', projectColor(i))} />
            {p.name}
            <span className="text-neutral-400 tabular-nums">{p.cards.length}</span>
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            const name = prompt('Name des neuen Projekts?')
            if (name?.trim()) createProject(name.trim())
          }}
          className="mb-1 ml-1 flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1 text-sm text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-white"
        >
          <FolderPlus className="size-4" />
          Projekt
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-xl font-semibold tracking-tight">{active.name}</h2>
          <p className="text-sm text-neutral-500">
            Aufgaben per Drag &amp; Drop verschieben – Spalten über ihren Kopf.
          </p>
        </div>
        {running && <div className="mx-auto flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 dark:border-indigo-500/40 dark:bg-indigo-500/10"><Clock3 className="size-4 text-indigo-600 dark:text-indigo-300" /><div className="text-xs"><div className="max-w-48 truncate font-medium">{running.task === 'Ohne Titel' ? 'Aufgabe' : running.task}</div><div className="font-mono tabular-nums text-indigo-700 dark:text-indigo-200">{formatTimer(runningSeconds)}{running.paused ? ' · pausiert' : ''}</div></div><div className="flex items-center gap-1"><button type="button" onClick={running.paused ? resumeTimer : pauseTimer} className="rounded p-1 text-indigo-700 hover:bg-indigo-100 dark:text-indigo-200 dark:hover:bg-indigo-500/20" title={running.paused ? 'Timer fortsetzen' : 'Timer pausieren'}>{running.paused ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}</button><button type="button" onClick={stopTimer} className="rounded p-1 text-rose-600 hover:bg-rose-100 dark:text-rose-300 dark:hover:bg-rose-500/20" title="Timer stoppen"><Square className="size-3.5" /></button></div></div>}
        <div className="ml-auto flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => {
              const name = prompt('Neuer Projektname?', active.name)
              if (name?.trim()) renameProject(active.id, name.trim())
            }}
            title="Projekt umbenennen"
            aria-label="Projekt umbenennen"
            className="rounded-lg p-2 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-white"
          >
            <Pencil className="size-4" />
          </button>
          {projects.length > 1 && (
            <button
              type="button"
              onClick={() => {
                if (confirm(`Projekt „${active.name}“ mit allen Aufgaben löschen?`)) removeProject(active.id)
              }}
              title="Projekt löschen"
              aria-label="Projekt löschen"
              className="rounded-lg p-2 text-neutral-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400"
            >
              <Trash2 className="size-4" />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            const title = prompt('Name der neuen Spalte?')
            if (title?.trim()) addColumn(title.trim())
          }}
          className="flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-1.5 text-sm transition hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
        >
          <Plus className="size-4" />
          Spalte
        </button>
      </div>

      {/* Board */}
      <div className="flex min-h-0 flex-1 gap-4 overflow-x-auto pb-2">
        {columns.map((column, index) => {
          const cards = cardsOf(board, column.id)
          const isTarget = dropAt?.columnId === column.id

          return (
            <section
              key={column.id}
              onDragOver={(e) => {
                e.preventDefault()
                if (colDragId.current) {
                  // Spalte: links oder rechts von dieser einfügen, je nach Mausposition
                  const rect = e.currentTarget.getBoundingClientRect()
                  const target = e.clientX < rect.left + rect.width / 2 ? index : index + 1
                  if (colDrop !== target) setColDrop(target)
                  return
                }
                if (!dropAt || dropAt.columnId !== column.id || dropAt.beforeId !== null) {
                  setDropAt({ columnId: column.id, beforeId: null })
                }
              }}
              onDrop={(e) => {
                e.preventDefault()
                if (colDragId.current) {
                  dropColumn()
                  return
                }
                drop(column.id, dropAt?.columnId === column.id ? dropAt.beforeId : null)
              }}
              className={cn(
                'relative flex w-72 shrink-0 flex-col rounded-xl border bg-neutral-50 transition dark:bg-neutral-900/60',
                // Einfügelinie beim Spalten-Ziehen
                colDrop === index &&
                  "before:absolute before:inset-y-0 before:-left-2.5 before:w-1 before:rounded-full before:bg-neutral-900 before:content-[''] dark:before:bg-white",
                colDrop === index + 1 &&
                  index === columns.length - 1 &&
                  "after:absolute after:inset-y-0 after:-right-2.5 after:w-1 after:rounded-full after:bg-neutral-900 after:content-[''] dark:after:bg-white",
                isTarget
                  ? 'border-neutral-400 dark:border-neutral-500'
                  : 'border-neutral-200 dark:border-neutral-800',
              )}
            >
              {/* Spaltenkopf – zum Verschieben der Spalte ziehen */}
              <div
                draggable
                onDragStart={(e) => {
                  colDragId.current = column.id
                  e.dataTransfer.effectAllowed = 'move'
                  e.dataTransfer.setData('application/x-column', column.id)
                }}
                onDragEnd={() => {
                  colDragId.current = null
                  setColDrop(null)
                }}
                title="Ziehen, um die Spalte zu verschieben"
                className="flex shrink-0 cursor-grab items-center gap-2 px-3 py-2.5 active:cursor-grabbing"
              >
                <GripVertical className="-ml-1 size-4 shrink-0 text-neutral-300 dark:text-neutral-600" />
                <h3 className="min-w-0 flex-1 truncate text-sm font-semibold">{column.title}</h3>
                <span className="rounded-full bg-neutral-200 px-1.5 py-0.5 text-[11px] font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                  {cards.length}
                </span>

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setMenuFor((v) => (v === column.id ? null : column.id))}
                    className="rounded p-1 text-neutral-400 transition hover:bg-neutral-200 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-white"
                    aria-label="Spaltenmenü"
                  >
                    <MoreHorizontal className="size-4" />
                  </button>

                  {menuFor === column.id && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setMenuFor(null)} />
                      <div className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-lg border border-neutral-200 bg-white py-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
                        {index > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setMenuFor(null)
                              moveColumn(column.id, index - 1)
                            }}
                            className="flex w-full items-center gap-2 px-3 py-1.5 text-sm transition hover:bg-neutral-100 dark:hover:bg-neutral-800"
                          >
                            <ArrowLeft className="size-3.5" />
                            Nach links
                          </button>
                        )}
                        {index < columns.length - 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              setMenuFor(null)
                              moveColumn(column.id, index + 1)
                            }}
                            className="flex w-full items-center gap-2 px-3 py-1.5 text-sm transition hover:bg-neutral-100 dark:hover:bg-neutral-800"
                          >
                            <ArrowRight className="size-3.5" />
                            Nach rechts
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setMenuFor(null)
                            const title = prompt('Neuer Name?', column.title)
                            if (title?.trim()) renameColumn(column.id, title.trim())
                          }}
                          className="flex w-full items-center gap-2 px-3 py-1.5 text-sm transition hover:bg-neutral-100 dark:hover:bg-neutral-800"
                        >
                          <Pencil className="size-3.5" />
                          Umbenennen
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setMenuFor(null)
                            if (confirm(`Spalte "${column.title}" mit allen Karten löschen?`)) {
                              removeColumn(column.id)
                            }
                          }}
                          className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                        >
                          <Trash2 className="size-3.5" />
                          Spalte löschen
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Karten */}
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-2 pb-2">
                {cards.map((card) => (
                  <div key={card.id}>
                    {isTarget && dropAt?.beforeId === card.id && <DropLine />}

                    <article
                      draggable
                      onDragStart={(e) => {
                        dragId.current = card.id
                        e.dataTransfer.effectAllowed = 'move'
                        e.dataTransfer.setData('text/plain', card.id)
                      }}
                      onDragEnd={endDrag}
                      onDragOver={(e) => {
                        if (colDragId.current) return
                        e.preventDefault()
                        e.stopPropagation()
                        if (dragId.current === card.id) return
                        const rect = e.currentTarget.getBoundingClientRect()
                        const below = e.clientY > rect.top + rect.height / 2
                        const index = cards.findIndex((c) => c.id === card.id)
                        const beforeId = below ? (cards[index + 1]?.id ?? null) : card.id
                        if (dropAt?.columnId !== column.id || dropAt?.beforeId !== beforeId) {
                          setDropAt({ columnId: column.id, beforeId })
                        }
                      }}
                      onDrop={(e) => {
                        if (colDragId.current) return
                        e.preventDefault()
                        e.stopPropagation()
                        drop(column.id, dropAt?.beforeId ?? null)
                      }}
                      onClick={() => openCard(card)}
                      className={cn(
                        'cursor-pointer rounded-lg border border-neutral-200 bg-white p-3 shadow-sm transition hover:border-neutral-300 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-neutral-600',
                        dragId.current === card.id && 'opacity-50',
                      )}
                    >
                      <div className="text-sm font-medium">{card.title}</div>

                      {card.description && (
                        <p className="mt-1 line-clamp-2 text-xs text-neutral-500">
                          {card.description}
                        </p>
                      )}

                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <span
                          className={cn(
                            'rounded px-1.5 py-0.5 text-[10px] font-medium',
                            priorities[card.priority].className,
                          )}
                        >
                          {priorities[card.priority].label}
                        </span>

                      {card.start && (
                          <span className="flex items-center gap-1 text-[10px] text-neutral-500">
                            <CalendarRange className="size-3" />
                            {formatDateInput(new Date(card.start))}
                            {card.end ? ` – ${formatDateInput(new Date(card.end))}` : ''}
                          </span>
                      )}
                        {(trackedByCard.get(card.id) ?? 0) > 0 && (
                        <span className="text-[10px] font-medium text-indigo-600 dark:text-indigo-300">
                          {formatTrackedTime(trackedByCard.get(card.id) ?? 0)}
                        </span>
                        )}
                        <span className="ml-auto flex items-center gap-1" onClick={(event) => event.stopPropagation()}>
                          {running?.cardId === card.id ? <><button type="button" onClick={running.paused ? resumeTimer : pauseTimer} className="rounded p-1 text-indigo-600 hover:bg-indigo-50 dark:text-indigo-300 dark:hover:bg-indigo-500/20" title={running.paused ? 'Timer fortsetzen' : 'Timer pausieren'}>{running.paused ? <Play className="size-3" /> : <Pause className="size-3" />}</button><button type="button" onClick={stopTimer} className="rounded p-1 text-rose-600 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-500/20" title="Timer stoppen"><Square className="size-3" /></button></> : <button type="button" onClick={() => startTimer(card)} disabled={Boolean(running)} className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-900 disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-neutral-800 dark:hover:text-white" title={running ? 'Es läuft bereits ein anderer Timer' : 'Timer starten'}><Play className="size-3" /></button>}
                        </span>
                      </div>
                    </article>
                  </div>
                ))}

                {isTarget && dropAt?.beforeId === null && <DropLine />}

                <button
                  type="button"
                  onClick={() => openNew(column.id)}
                  className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-neutral-500 transition hover:bg-neutral-200/60 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-white"
                >
                  <Plus className="size-4" />
                  Aufgabe
                </button>
              </div>
            </section>
          )
        })}
      </div>

      <CardDialog
        draft={draft}
        existing={existing}
        columns={columns}
        onSave={(card) => {
          saveCard(card)
          setDraft(null)
        }}
        onDelete={(id) => {
          removeCard(id)
          setDraft(null)
        }}
        onClose={() => setDraft(null)}
      />
    </div>
  )
}

function DropLine() {
  return <div className="my-1 h-0.5 rounded-full bg-neutral-900 dark:bg-white" />
}

function formatTimer(seconds: number) {
  return `${Math.floor(seconds / 3600).toString().padStart(2, '0')}:${Math.floor((seconds % 3600) / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`
}
