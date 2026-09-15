import { useEffect, useState } from 'react'
import { X, Cake, Heart, CalendarDays } from 'lucide-react'
import { cn } from '@/lib/cn'
import { DateInput } from '../DateInput'
import { BIRTHDAY_ALERTS, newId, type CalEvent } from '@/lib/events'
import { startOfDay } from '@/lib/date'

type Kind = 'geburtstag' | 'jahrestag' | 'einmalig'

const kinds: Array<{ value: Kind; label: string; icon: typeof Cake; hint: string }> = [
  {
    value: 'geburtstag',
    label: 'Geburtstag',
    icon: Cake,
    hint: 'Jedes Jahr · Erinnerung 3 Tage vorher und am Tag. Mit Geburtsjahr zeigt die Erinnerung das Alter.',
  },
  { value: 'jahrestag', label: 'Jahrestag', icon: Heart, hint: 'Jedes Jahr · Erinnerung am Tag.' },
  { value: 'einmalig', label: 'Einmalig', icon: CalendarDays, hint: 'Nur dieser eine Tag · ohne Erinnerung.' },
]

interface Props {
  initialDate: Date
  onSave: (event: CalEvent) => void
  onClose: () => void
}

/** Schnellanlage für ganze Tage: nur Name und Datum. */
export default function QuickDayDialog({ initialDate, onSave, onClose }: Props) {
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(() => startOfDay(initialDate))
  const [kind, setKind] = useState<Kind>('geburtstag')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const start = startOfDay(date)
    const end = new Date(start)
    end.setHours(23, 59, 0, 0)
    onSave({
      id: newId(),
      title: title.trim() || (kind === 'geburtstag' ? 'Geburtstag' : 'Ohne Titel'),
      start: start.toISOString(),
      end: end.toISOString(),
      allDay: true,
      category: kind === 'geburtstag' ? 'geburtstag' : kind === 'jahrestag' ? 'privat' : 'sonstiges',
      recurrence: kind === 'einmalig' ? 'none' : 'yearly',
      alerts: kind === 'geburtstag' ? BIRTHDAY_ALERTS : kind === 'jahrestag' ? [0] : [],
    })
  }

  const current = kinds.find((k) => k.value === kind) ?? kinds[0]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <form
        onMouseDown={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="w-full max-w-sm overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl dark:border-neutral-800 dark:bg-neutral-900"
      >
        <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-3.5 dark:border-neutral-800">
          <h2 className="text-sm font-semibold">Tag eintragen</h2>
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
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={kind === 'geburtstag' ? 'Wessen Geburtstag?' : 'Name des Tages'}
            className="w-full border-b border-neutral-200 pb-2 text-lg font-medium outline-none transition placeholder:text-neutral-400 focus:border-neutral-900 dark:border-neutral-700 dark:focus:border-white"
          />

          <div className="flex items-center gap-3">
            <DateInput value={date} onChange={setDate} />
            <span className="text-xs text-neutral-400">z. B. 04061965 oder 4.6.</span>
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            {kinds.map((k) => (
              <button
                key={k.value}
                type="button"
                onClick={() => setKind(k.value)}
                className={cn(
                  'flex flex-col items-center gap-1 rounded-lg border px-2 py-2 text-xs transition',
                  kind === k.value
                    ? 'border-neutral-900 font-medium dark:border-white'
                    : 'border-neutral-200 text-neutral-500 hover:border-neutral-300 dark:border-neutral-700 dark:hover:border-neutral-600',
                )}
              >
                <k.icon className="size-4" />
                {k.label}
              </button>
            ))}
          </div>

          <p className="text-[11px] text-neutral-500">{current.hint}</p>
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
            Eintragen
          </button>
        </div>
      </form>
    </div>
  )
}
