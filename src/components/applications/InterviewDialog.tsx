import { useEffect, useState } from 'react'
import { X, Clock, MapPin, Bell, AlignLeft } from 'lucide-react'
import { DateInput, TimeInput } from '../DateInput'
import AlertPicker from '../AlertPicker'
import { newId, type CalEvent } from '@/lib/events'
import { useSettings } from '@/lib/settings'
import { addDays, startOfDay } from '@/lib/date'
import type { Application } from '@/lib/applications'

const durations = [30, 45, 60, 90, 120]

const inputClass =
  'rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-sm outline-none transition focus:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-800 dark:focus:border-neutral-500'

interface Props {
  app: Application
  /** Z. B. der Betreff der Einladungsmail. */
  initialNote?: string
  onSave: (event: CalEvent) => void
  onClose: () => void
}

/** Vorstellungsgespräch in den Kalender eintragen – mit Erinnerungen. */
export default function InterviewDialog({ app, initialNote, onSave, onClose }: Props) {
  const { settings } = useSettings()
  const [start, setStart] = useState(() => {
    const d = addDays(startOfDay(new Date()), 1)
    d.setHours(10, 0, 0, 0)
    return d
  })
  const [duration, setDuration] = useState(60)
  const [location, setLocation] = useState('')
  const [alerts, setAlerts] = useState<number[]>(settings.interviewAlerts)
  const [notes, setNotes] = useState(initialNote ? `Einladung: ${initialNote}` : '')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({
      id: newId(),
      title: `Vorstellungsgespräch: ${app.company || 'Unbekannt'}`,
      start: start.toISOString(),
      end: new Date(start.getTime() + duration * 60_000).toISOString(),
      allDay: false,
      category: 'gespraech',
      location: location.trim() || undefined,
      notes: [app.position && `Position: ${app.position}`, notes.trim()].filter(Boolean).join('\n') || undefined,
      alerts,
      applicationId: app.id,
    })
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <form
        onMouseDown={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-neutral-200 bg-white shadow-2xl dark:border-neutral-800 dark:bg-neutral-900"
      >
        <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-3.5 dark:border-neutral-800">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">Vorstellungsgespräch eintragen</h2>
            <p className="truncate text-xs text-neutral-500">
              {app.company}
              {app.position && ` · ${app.position}`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-neutral-400 transition hover:bg-neutral-100 dark:hover:bg-neutral-800"
            aria-label="Schließen"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <Row icon={Clock}>
            <div className="flex flex-wrap items-center gap-2">
              <DateInput value={start} onChange={setStart} />
              <TimeInput value={start} onChange={setStart} />
              <select
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                aria-label="Dauer"
                className={inputClass}
              >
                {durations.map((d) => (
                  <option key={d} value={d} className="bg-white text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100">
                    {d < 60 ? `${d} Min.` : `${d / 60} Std.`.replace('.5', ',5')}
                  </option>
                ))}
              </select>
            </div>
          </Row>

          <Row icon={MapPin}>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Adresse, Teams-/Zoom-Link oder „Telefon“"
              className={`${inputClass} w-full`}
            />
          </Row>

          <Row icon={Bell}>
            <AlertPicker value={alerts} onChange={setAlerts} />
          </Row>

          <Row icon={AlignLeft}>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Ansprechpartner, Vorbereitung …"
              className={`${inputClass} w-full resize-y`}
            />
          </Row>
        </div>

        <div className="flex justify-end gap-2 border-t border-neutral-200 px-5 py-3.5 dark:border-neutral-800">
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
            In den Kalender
          </button>
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
