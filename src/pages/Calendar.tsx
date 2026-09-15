import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Plus, CalendarDays, Cake } from 'lucide-react'
import QuickDayDialog from '@/components/calendar/QuickDayDialog'
import { cn } from '@/lib/cn'
import MonthView from '@/components/calendar/MonthView'
import WeekView from '@/components/calendar/WeekView'
import EventDialog from '@/components/calendar/EventDialog'
import { newId, type CalEvent } from '@/lib/events'
import { useEventStore } from '@/lib/store'
import {
  addDays,
  addMonths,
  formatDayLong,
  formatDayShort,
  formatMonthYear,
  isSameMonth,
  isoWeek,
  startOfDay,
  startOfWeek,
} from '@/lib/date'

type View = 'tag' | 'arbeitswoche' | 'woche' | 'monat'

const views: Array<{ value: View; label: string }> = [
  { value: 'tag', label: 'Tag' },
  { value: 'arbeitswoche', label: 'Arbeitswoche' },
  { value: 'woche', label: 'Woche' },
  { value: 'monat', label: 'Monat' },
]

export default function Calendar() {
  const { events, save, remove } = useEventStore()
  const [view, setView] = useState<View>('woche')
  const [timed, setTimed] = useState(true)
  const [cursor, setCursor] = useState(() => startOfDay(new Date()))
  const [draft, setDraft] = useState<CalEvent | null>(null)
  const [existing, setExisting] = useState(false)
  const [quickDay, setQuickDay] = useState(false)
  const [params, setParams] = useSearchParams()

  const days = useMemo(() => {
    if (view === 'tag') return [cursor]
    const weekStart = startOfWeek(cursor)
    const count = view === 'arbeitswoche' ? 5 : 7
    return Array.from({ length: count }, (_, i) => addDays(weekStart, i))
  }, [view, cursor])

  const step = (dir: -1 | 1) => {
    setCursor((c) => {
      if (view === 'monat') return addMonths(c, dir)
      if (view === 'tag') return addDays(c, dir)
      return addDays(c, dir * 7)
    })
  }

  const title = useMemo(() => {
    if (view === 'monat') return formatMonthYear(cursor)
    if (view === 'tag') return formatDayLong(cursor)
    const first = days[0]
    const last = days[days.length - 1]
    const range = isSameMonth(first, last)
      ? `${first.getDate()}. – ${formatDayShort(last)}`
      : `${formatDayShort(first)} – ${formatDayShort(last)}`
    return `${range} ${last.getFullYear()}`
  }, [view, cursor, days])

  const openNew = (start: Date, end: Date, allDay = false) => {
    setExisting(false)
    setDraft({
      id: newId(),
      title: '',
      start: start.toISOString(),
      end: end.toISOString(),
      allDay,
      category: 'termin',
    })
  }

  const openExisting = (event: CalEvent) => {
    setExisting(true)
    // Bei Wiederholungen das Original bearbeiten, nicht die projizierte Instanz
    setDraft(events.find((e) => e.id === event.id) ?? event)
  }

  /** Klick auf eine Tageskachel im Monat: 9–10 Uhr vorbelegen. */
  const createOnDay = (day: Date) => {
    const start = startOfDay(day)
    start.setHours(9, 0, 0, 0)
    openNew(start, new Date(start.getTime() + 60 * 60_000))
  }

  const createAllDay = (day: Date) => {
    const start = startOfDay(day)
    const end = startOfDay(day)
    end.setHours(23, 59, 0, 0)
    openNew(start, end, true)
  }

  const goToDay = (day: Date) => {
    setCursor(startOfDay(day))
    setView('tag')
  }

  // Schnellanlage aus dem „Neu“-Menü (?neu=termin | ?neu=tag)
  useEffect(() => {
    const neu = params.get('neu')
    if (!neu) return
    if (neu === 'termin') createOnDay(new Date())
    if (neu === 'tag') setQuickDay(true)
    setParams({}, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => createOnDay(view === 'monat' ? new Date() : cursor)}
          className="flex items-center gap-1.5 rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          <Plus className="size-4" />
          Neuer Termin
        </button>

        <button
          type="button"
          onClick={() => setQuickDay(true)}
          title="Nur Name und Datum – z. B. Geburtstage"
          className="flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-1.5 text-sm transition hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
        >
          <Cake className="size-4" />
          Tag eintragen
        </button>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setCursor(startOfDay(new Date()))}
            className="flex items-center gap-1.5 rounded-lg border border-neutral-200 px-2.5 py-1.5 text-sm transition hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
          >
            <CalendarDays className="size-4" />
            Heute
          </button>
          <button
            type="button"
            onClick={() => step(-1)}
            className="rounded-lg p-1.5 text-neutral-500 transition hover:bg-neutral-100 dark:hover:bg-neutral-800"
            aria-label="Zurück"
          >
            <ChevronLeft className="size-5" />
          </button>
          <button
            type="button"
            onClick={() => step(1)}
            className="rounded-lg p-1.5 text-neutral-500 transition hover:bg-neutral-100 dark:hover:bg-neutral-800"
            aria-label="Weiter"
          >
            <ChevronRight className="size-5" />
          </button>
        </div>

        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold tracking-tight">{title}</h2>
          {view !== 'monat' && (
            <span className="text-xs text-neutral-500">KW {isoWeek(days[0])}</span>
          )}
        </div>

        <div className="ml-auto flex rounded-lg border border-neutral-200 p-0.5 dark:border-neutral-700">
          {views.map((v) => (
            <button
              key={v.value}
              type="button"
              onClick={() => setView(v.value)}
              className={cn(
                'rounded-md px-2.5 py-1 text-sm transition',
                view === v.value
                  ? 'bg-neutral-900 font-medium text-white dark:bg-white dark:text-neutral-900'
                  : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white',
              )}
            >
              {v.label}
            </button>
          ))}
        </div>
        {view !== 'monat' && <div className="flex rounded-lg border border-neutral-200 p-0.5 dark:border-neutral-700"><button type="button" onClick={() => setTimed(false)} className={cn('rounded-md px-2.5 py-1 text-sm', !timed ? 'bg-neutral-900 font-medium text-white dark:bg-white dark:text-neutral-900' : 'text-neutral-500')}>Kompakt</button><button type="button" onClick={() => setTimed(true)} className={cn('rounded-md px-2.5 py-1 text-sm', timed ? 'bg-neutral-900 font-medium text-white dark:bg-white dark:text-neutral-900' : 'text-neutral-500')}>Stunden</button></div>}
      </div>

      {/* Ansicht */}
      {view === 'monat' ? (
        <MonthView
          cursor={cursor}
          events={events}
          onCreate={createOnDay}
          onOpen={openExisting}
          onPickDay={goToDay}
        />
      ) : (
        <WeekView
          days={days}
          events={events}
          onCreate={(start, end) => openNew(start, end)}
          onCreateAllDay={createAllDay}
          onOpen={openExisting}
          timed={timed}
        />
      )}

      {quickDay && (
        <QuickDayDialog
          initialDate={view === 'monat' ? new Date() : cursor}
          onClose={() => setQuickDay(false)}
          onSave={(event) => {
            save(event)
            setQuickDay(false)
          }}
        />
      )}

      <EventDialog
        draft={draft}
        existing={existing}
        onSave={(event) => {
          save(event)
          setDraft(null)
        }}
        onDelete={(id) => {
          remove(id)
          setDraft(null)
        }}
        onClose={() => setDraft(null)}
      />
    </div>
  )
}
