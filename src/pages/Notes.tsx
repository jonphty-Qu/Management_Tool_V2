import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, Search, Pin, PinOff, Trash2, ChevronLeft, NotebookPen, Check } from 'lucide-react'
import { cn } from '@/lib/cn'
import { DateInput } from '@/components/DateInput'
import { formatDateInput, formatTime, startOfDay } from '@/lib/date'
import { isEmptyNote, notePreview, type Note } from '@/lib/notes'
import { useNoteStore } from '@/lib/store'

export default function Notes() {
  const { notes, create, update, remove } = useNoteStore()
  const [activeId, setActiveId] = useState<string | null>(() => notes[0]?.id ?? null)
  const [query, setQuery] = useState('')
  // Auf schmalen Bildschirmen entweder Liste oder Editor
  const [editorOpen, setEditorOpen] = useState(false)
  const [params, setParams] = useSearchParams()
  const titleRef = useRef<HTMLInputElement>(null)
  const focusTitle = useRef(false)

  const active = notes.find((n) => n.id === activeId) ?? null

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return notes
      .filter((n) => !q || `${n.title}\n${n.content}`.toLowerCase().includes(q))
      .sort(
        (a, b) =>
          Number(b.pinned) - Number(a.pinned) ||
          b.date.localeCompare(a.date) ||
          b.updatedAt.localeCompare(a.updatedAt),
      )
  }, [notes, query])

  /** Wechseln – eine leer gelassene Notiz wird dabei verworfen. */
  const select = (id: string | null) => {
    if (active && active.id !== id && isEmptyNote(active)) remove(active.id)
    setActiveId(id)
    setEditorOpen(id !== null)
  }

  const newNote = () => {
    if (active && isEmptyNote(active)) {
      // Leere Notiz wiederverwenden statt eine zweite anzulegen
      focusTitle.current = true
      setEditorOpen(true)
      titleRef.current?.focus()
      return
    }
    const note = create()
    focusTitle.current = true
    setActiveId(note.id)
    setEditorOpen(true)
  }

  // Titel der neuen Notiz fokussieren, sobald sie gerendert ist
  useEffect(() => {
    if (focusTitle.current && active) {
      focusTitle.current = false
      titleRef.current?.focus()
    }
  }, [active])

  // Schnellanlage aus dem „Neu“-Menü (?neu=notiz)
  useEffect(() => {
    if (params.get('neu') !== 'notiz') return
    newNote()
    setParams({}, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  return (
    <div className="flex min-h-0 flex-1 gap-4">
      {/* Liste */}
      <aside
        className={cn(
          'flex min-h-0 w-full shrink-0 flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white md:w-72 dark:border-neutral-800 dark:bg-neutral-900',
          editorOpen && 'hidden md:flex',
        )}
      >
        <div className="flex items-center gap-2 border-b border-neutral-200 px-3 py-2.5 dark:border-neutral-800">
          <h2 className="text-sm font-semibold">Notizen</h2>
          <span className="text-xs text-neutral-400 tabular-nums">{notes.length}</span>
          <button
            type="button"
            onClick={newNote}
            className="ml-auto flex items-center gap-1 rounded-lg bg-neutral-900 px-2.5 py-1 text-sm font-medium text-white transition hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            <Plus className="size-4" />
            Neu
          </button>
        </div>

        <div className="border-b border-neutral-200 p-2 dark:border-neutral-800">
          <div className="relative">
            <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-neutral-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Notizen durchsuchen…"
              className="w-full rounded-lg border border-neutral-200 bg-white py-1.5 pr-2.5 pl-8 text-sm outline-none transition focus:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-800 dark:focus:border-neutral-500"
            />
          </div>
        </div>

        <ul className="min-h-0 flex-1 overflow-y-auto p-1.5">
          {visible.length === 0 && (
            <li className="px-3 py-10 text-center text-sm text-neutral-500">
              {query ? 'Nichts gefunden.' : 'Noch keine Notizen.'}
            </li>
          )}
          {visible.map((note) => (
            <li key={note.id}>
              <NoteItem note={note} active={note.id === activeId} onSelect={() => select(note.id)} />
            </li>
          ))}
        </ul>
      </aside>

      {/* Editor */}
      <section
        className={cn(
          'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900',
          !editorOpen && 'hidden md:flex',
        )}
      >
        {active ? (
          <>
            <div className="flex flex-wrap items-center gap-2 border-b border-neutral-200 px-3 py-2 dark:border-neutral-800">
              <button
                type="button"
                onClick={() => select(null)}
                className="rounded-lg p-1.5 text-neutral-500 transition hover:bg-neutral-100 md:hidden dark:hover:bg-neutral-800"
                aria-label="Zurück zur Liste"
              >
                <ChevronLeft className="size-4" />
              </button>

              <DateInput
                value={new Date(active.date)}
                onChange={(d) => update(active.id, { date: startOfDay(d).toISOString() })}
              />

              <span className="ml-auto flex items-center gap-1 text-xs text-neutral-400">
                <Check className="size-3.5" />
                gespeichert {formatTime(new Date(active.updatedAt))}
              </span>

              <button
                type="button"
                onClick={() => update(active.id, { pinned: !active.pinned })}
                title={active.pinned ? 'Nicht mehr anheften' : 'Oben anheften'}
                aria-label={active.pinned ? 'Nicht mehr anheften' : 'Oben anheften'}
                className={cn(
                  'rounded-lg p-1.5 transition hover:bg-neutral-100 dark:hover:bg-neutral-800',
                  active.pinned ? 'text-amber-500' : 'text-neutral-400',
                )}
              >
                {active.pinned ? <PinOff className="size-4" /> : <Pin className="size-4" />}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (isEmptyNote(active) || confirm(`Notiz „${active.title || 'Ohne Titel'}“ löschen?`)) {
                    remove(active.id)
                    setActiveId(null)
                    setEditorOpen(false)
                  }
                }}
                title="Löschen"
                aria-label="Notiz löschen"
                className="rounded-lg p-1.5 text-neutral-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400"
              >
                <Trash2 className="size-4" />
              </button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col px-5 pt-4 pb-2 md:px-8">
              <input
                ref={titleRef}
                value={active.title}
                onChange={(e) => update(active.id, { title: e.target.value })}
                onKeyDown={(e) => {
                  // Enter springt in den Text
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    ;(e.currentTarget.parentElement?.querySelector('textarea') as HTMLTextAreaElement | null)?.focus()
                  }
                }}
                placeholder="Titel"
                className="w-full bg-transparent text-2xl font-semibold tracking-tight outline-none placeholder:text-neutral-300 dark:placeholder:text-neutral-600"
              />
              <textarea
                value={active.content}
                onChange={(e) => update(active.id, { content: e.target.value })}
                placeholder="Schreib los…"
                className="mt-3 min-h-0 w-full flex-1 resize-none bg-transparent text-[15px] leading-relaxed outline-none placeholder:text-neutral-300 dark:placeholder:text-neutral-600"
              />
            </div>

            <div className="border-t border-neutral-100 px-5 py-1.5 text-[11px] text-neutral-400 md:px-8 dark:border-neutral-800">
              {countWords(active.content)} Wörter · {active.content.length} Zeichen · angelegt{' '}
              {formatDateInput(new Date(active.createdAt))}
            </div>
          </>
        ) : (
          <div className="grid flex-1 place-items-center p-6 text-center">
            <div>
              <NotebookPen className="mx-auto size-10 text-neutral-300 dark:text-neutral-600" />
              <p className="mt-3 text-sm text-neutral-500">Wähle links eine Notiz oder leg eine neue an.</p>
              <button
                type="button"
                onClick={newNote}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
              >
                <Plus className="size-4" />
                Neue Notiz
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

function NoteItem({ note, active, onSelect }: { note: Note; active: boolean; onSelect: () => void }) {
  const preview = notePreview(note)
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'w-full rounded-lg px-3 py-2 text-left transition',
        active ? 'bg-neutral-100 dark:bg-neutral-800' : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/50',
      )}
    >
      <div className="flex items-center gap-1.5">
        {note.pinned && <Pin className="size-3 shrink-0 text-amber-500" />}
        <span className={cn('truncate text-sm font-medium', !note.title && 'text-neutral-400')}>
          {note.title || 'Ohne Titel'}
        </span>
      </div>
      <div className="mt-0.5 flex gap-2 text-xs text-neutral-500">
        <span className="shrink-0 tabular-nums">{formatDateInput(new Date(note.date))}</span>
        <span className="truncate">{preview}</span>
      </div>
    </button>
  )
}

function countWords(text: string): number {
  const trimmed = text.trim()
  return trimmed ? trimmed.split(/\s+/).length : 0
}
