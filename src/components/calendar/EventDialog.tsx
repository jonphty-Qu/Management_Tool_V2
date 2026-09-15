import { useEffect, useState } from 'react'
import { X, Trash2, Clock, MapPin, AlignLeft, Tag, Bell, Repeat } from 'lucide-react'
import { cn } from '@/lib/cn'
import {
  BIRTHDAY_ALERTS,
  DAY,
  categoryList,
  type CalEvent,
  type EventCategory,
} from '@/lib/events'
import { DateInput, TimeInput } from '../DateInput'
import AlertPicker from '../AlertPicker'

interface Props {
  /** Vorbelegter Termin - neu oder bestehend. */
  draft: CalEvent | null
  /** true, wenn der Termin schon gespeichert ist (dann Löschen anbieten). */
  existing: boolean
  onSave: (event: CalEvent) => void
  onDelete: (id: string) => void
  onClose: () => void
}

const inputClass =
  'rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-sm outline-none transition focus:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-800 dark:focus:border-neutral-500'

export default function EventDialog({ draft, existing, onSave, onDelete, onClose }: Props) {
  const [form, setForm] = useState<CalEvent | null>(draft)

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

  const start = new Date(form.start)
  const end = new Date(form.end)
  const alerts = form.alerts ?? form.reminders?.map((days) => days * DAY)
    ?? (form.category === 'geburtstag' ? BIRTHDAY_ALERTS : [])

  const set = <K extends keyof CalEvent>(key: K, value: CalEvent[K]) =>
    setForm((f) => (f ? { ...f, [key]: value } : f))

  /** Start setzen, Dauer beibehalten. */
  const setStart = (next: Date) => {
    setForm((f) => {
      if (!f) return f
      const duration = new Date(f.end).getTime() - new Date(f.start).getTime()
      return {
        ...f,
        start: next.toISOString(),
        end: new Date(next.getTime() + Math.max(duration, 0)).toISOString(),
      }
    })
  }

  /** Ende setzen, nie vor dem Start. */
  const setEnd = (next: Date) => {
    setForm((f) => {
      if (!f) return f
      const s = new Date(f.start)
      const safe = next <= s ? new Date(s.getTime() + 15 * 60_000) : next
      return { ...f, end: safe.toISOString() }
    })
  }

  const setAllDay = (allDay: boolean) => {
    setForm((f) => {
      if (!f) return f
      const s = new Date(f.start)
      const e = new Date(f.end)
      if (allDay) {
        s.setHours(0, 0, 0, 0)
        e.setHours(23, 59, 0, 0)
      } else {
        s.setHours(9, 0, 0, 0)
        e.setHours(10, 0, 0, 0)
      }
      return { ...f, allDay, start: s.toISOString(), end: e.toISOString() }
    })
  }

  /** Geburtstag setzt sinnvolle Vorgaben: ganztägig, jährlich, 3 Tage + am Tag. */
  const setCategory = (category: EventCategory) => {
    setForm((f) => {
      if (!f) return f
      if (category !== 'geburtstag') return { ...f, category }
      const s = new Date(f.start)
      const e = new Date(f.start)
      s.setHours(0, 0, 0, 0)
      e.setHours(23, 59, 0, 0)
      return {
        ...f,
        category,
        allDay: true,
        recurrence: 'yearly',
        alerts: BIRTHDAY_ALERTS,
        start: s.toISOString(),
        end: e.toISOString(),
      }
    })
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const { reminders: _legacy, ...event } = form
    onSave({ ...event, alerts, title: form.title.trim() || 'Ohne Titel' })
  }

  const isBirthday = form.category === 'geburtstag'

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
            {existing ? 'Termin bearbeiten' : 'Neuer Termin'}
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
            placeholder={isBirthday ? 'Name' : 'Titel hinzufügen'}
            className="w-full border-b border-neutral-200 pb-2 text-lg font-medium outline-none transition placeholder:text-neutral-400 focus:border-neutral-900 dark:border-neutral-700 dark:focus:border-white"
          />

          <Row icon={Tag}>
            <div className="flex flex-wrap gap-1.5">
              {categoryList.map(([key, style]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setCategory(key as EventCategory)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition',
                    form.category === key
                      ? 'border-neutral-900 font-medium dark:border-white'
                      : 'border-neutral-200 text-neutral-500 hover:border-neutral-300 dark:border-neutral-700 dark:hover:border-neutral-600',
                  )}
                >
                  <span className={cn('size-2 rounded-full', style.dot)} />
                  {style.label}
                </button>
              ))}
            </div>
          </Row>

          {/* Datum und Uhrzeit */}
          <Row icon={Clock}>
            <div className="space-y-2">
              {!isBirthday && (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.allDay}
                    onChange={(e) => setAllDay(e.target.checked)}
                    className="size-4 rounded border-neutral-300 dark:border-neutral-600"
                  />
                  Ganztägig
                </label>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <DateInput value={start} onChange={setStart} />
                {!form.allDay && <TimeInput value={start} onChange={setStart} />}

                {!isBirthday && (
                  <>
                    <span className="text-sm text-neutral-400">bis</span>
                    <DateInput value={end} onChange={setEnd} />
                    {!form.allDay && <TimeInput value={end} onChange={setEnd} />}
                  </>
                )}
              </div>

              <p className="text-[11px] text-neutral-400">
                Eingabe frei: 04062026, 4.6.26, morgen – oder das Symbol für den Kalender.
              </p>
            </div>
          </Row>

          {/* Wiederholung */}
          <Row icon={Repeat}>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.recurrence === 'yearly'}
                onChange={(e) => set('recurrence', e.target.checked ? 'yearly' : 'none')}
                className="size-4 rounded border-neutral-300 dark:border-neutral-600"
              />
              Jährlich wiederholen
              {isBirthday && <span className="text-xs text-neutral-400">(bei Geburtstagen üblich)</span>}
            </label>
          </Row>

          {/* Erinnerungen */}
          <Row icon={Bell}>
            <div className="space-y-1.5">
              <AlertPicker value={alerts} onChange={(next) => set('alerts', next)} allDay={form.allDay} />
              <p className="text-[11px] text-neutral-400">
                Erscheint zur gewählten Zeit in den Benachrichtigungen oben rechts.
              </p>
            </div>
          </Row>

          <Row icon={MapPin}>
            <input
              value={form.location ?? ''}
              onChange={(e) => set('location', e.target.value)}
              placeholder="Ort oder Link"
              className={cn(inputClass, 'w-full')}
            />
          </Row>

          <Row icon={AlignLeft}>
            <textarea
              value={form.notes ?? ''}
              onChange={(e) => set('notes', e.target.value)}
              placeholder="Notizen"
              rows={3}
              className={cn(inputClass, 'w-full resize-y')}
            />
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

function Row({ icon: Icon, children }: { icon: typeof Clock; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <Icon className="mt-1.5 size-4 shrink-0 text-neutral-400" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
