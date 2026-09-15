import { useEffect, useState } from 'react'
import { X, Trash2, AlignLeft, CalendarRange, Flag, Columns3 } from 'lucide-react'
import { cn } from '@/lib/cn'
import { priorities, type BoardCard, type BoardColumn, type Priority } from '@/lib/board'
import { DateInput } from '../DateInput'
import { addDays, startOfDay } from '@/lib/date'

interface Props {
  draft: BoardCard | null
  existing: boolean
  columns: BoardColumn[]
  onSave: (card: BoardCard) => void
  onDelete: (id: string) => void
  onClose: () => void
}

const inputClass =
  'rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-sm outline-none transition focus:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-800 dark:focus:border-neutral-500'

export default function CardDialog({
  draft,
  existing,
  columns,
  onSave,
  onDelete,
  onClose,
}: Props) {
  const [form, setForm] = useState<BoardCard | null>(draft)

  useEffect(() => setForm(draft), [draft])

  useEffect(() => {
    if (!draft) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [draft, onClose])

  if (!form) return null

  const set = <K extends keyof BoardCard>(key: K, value: BoardCard[K]) =>
    setForm((f) => (f ? { ...f, [key]: value } : f))

  const hasRange = Boolean(form.start)

  const toggleRange = (on: boolean) => {
    setForm((f) => {
      if (!f) return f
      if (!on) return { ...f, start: undefined, end: undefined }
      const today = startOfDay(new Date())
      return { ...f, start: today.toISOString(), end: addDays(today, 7).toISOString() }
    })
  }

  const setStart = (next: Date) => {
    setForm((f) => {
      if (!f) return f
      const end = f.end ? new Date(f.end) : null
      return {
        ...f,
        start: next.toISOString(),
        end: end && end < next ? next.toISOString() : f.end,
      }
    })
  }

  const setEnd = (next: Date) => {
    setForm((f) => {
      if (!f) return f
      const start = f.start ? new Date(f.start) : null
      const safe = start && next < start ? start : next
      return { ...f, end: safe.toISOString() }
    })
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({ ...form, title: form.title.trim() || 'Ohne Titel' })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        // Nur ein Druck auf den Hintergrund selbst schließt
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <form
        onMouseDown={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-neutral-200 bg-white shadow-2xl dark:border-neutral-800 dark:bg-neutral-900"
      >
        <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-3.5 dark:border-neutral-800">
          <h2 className="text-sm font-semibold">
            {existing ? 'Aufgabe bearbeiten' : 'Neue Aufgabe'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-white"
            aria-label="Schließen"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <input
            autoFocus
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="Was ist zu tun?"
            className="w-full border-b border-neutral-200 pb-2 text-lg font-medium outline-none transition placeholder:text-neutral-400 focus:border-neutral-900 dark:border-neutral-700 dark:focus:border-white"
          />

          <Row icon={AlignLeft}>
            <textarea
              value={form.description ?? ''}
              onChange={(e) => set('description', e.target.value)}
              placeholder="Beschreibung"
              rows={4}
              className={cn(inputClass, 'w-full resize-y')}
            />
          </Row>

          <Row icon={CalendarRange}>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={hasRange}
                  onChange={(e) => toggleRange(e.target.checked)}
                  className="size-4 rounded border-neutral-300 dark:border-neutral-600"
                />
                Zeitraum festlegen
              </label>

              {hasRange && form.start && (
                <div className="flex flex-wrap items-center gap-2">
                  <DateInput value={new Date(form.start)} onChange={setStart} />
                  <span className="text-sm text-neutral-400">bis</span>
                  <DateInput
                    value={new Date(form.end ?? form.start)}
                    onChange={setEnd}
                  />
                </div>
              )}
            </div>
          </Row>

          <Row icon={Flag}>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(priorities) as Priority[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => set('priority', key)}
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-xs transition',
                    form.priority === key
                      ? 'border-neutral-900 font-medium dark:border-white'
                      : 'border-neutral-200 text-neutral-500 hover:border-neutral-300 dark:border-neutral-700 dark:hover:border-neutral-600',
                  )}
                >
                  {priorities[key].label}
                </button>
              ))}
            </div>
          </Row>

          <Row icon={Columns3}>
            <select
              value={form.columnId}
              onChange={(e) => set('columnId', e.target.value)}
              className={cn(inputClass, 'w-full')}
            >
              {columns.map((col) => (
                <option key={col.id} value={col.id}>
                  {col.title}
                </option>
              ))}
            </select>
          </Row>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-neutral-200 px-5 py-3.5 dark:border-neutral-800">
          {existing ? (
            <button
              type="button"
              onClick={() => onDelete(form.id)}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
            >
              <Trash2 className="size-4" />
              Löschen
            </button>
          ) : (
            <span />
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-neutral-200 px-3 py-1.5 text-sm transition hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              className="rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
            >
              Speichern
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}

function Row({ icon: Icon, children }: { icon: typeof Flag; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <Icon className="mt-1.5 size-4 shrink-0 text-neutral-400" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
