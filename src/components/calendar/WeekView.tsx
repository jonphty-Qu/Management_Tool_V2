import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/cn'
import { categories, eventsOnDay, type CalEvent } from '@/lib/events'
import {
  HOUR_HEIGHT,
  SLOT_MINUTES,
  addDays,
  dateAtMinutes,
  formatTime,
  formatWeekdayShort,
  isToday,
  minutesOfDay,
  startOfDay,
} from '@/lib/date'

interface Props {
  days: Date[]
  events: CalEvent[]
  timed?: boolean
  /** Zeitbereich wurde angeklickt oder aufgezogen. */
  onCreate: (start: Date, end: Date) => void
  onCreateAllDay: (day: Date) => void
  onOpen: (event: CalEvent) => void
}

interface DragState {
  day: Date
  from: number
  to: number
}

interface Placed {
  event: CalEvent
  top: number
  height: number
  left: number
  width: number
}

const DAY_MINUTES = 24 * 60

/** Überlappende Termine nebeneinander anordnen. */
function layout(events: CalEvent[], day: Date): Placed[] {
  const dayStart = startOfDay(day)
  const dayEnd = addDays(dayStart, 1)

  const items = events
    .filter((e) => !e.allDay)
    .map((e) => {
      const rawStart = new Date(e.start)
      const rawEnd = new Date(e.end)
      const start = Math.max(0, (Math.max(rawStart.getTime(), dayStart.getTime()) - dayStart.getTime()) / 60_000)
      const end = Math.min(DAY_MINUTES, (Math.min(rawEnd.getTime(), dayEnd.getTime()) - dayStart.getTime()) / 60_000)
      return { event: e, start, end: Math.max(end, start + 15) }
    })
    .sort((a, b) => a.start - b.start || b.end - a.end)

  const placed: Placed[] = []
  let cluster: typeof items = []
  let clusterEnd = -1

  const flush = () => {
    if (cluster.length === 0) return
    // Greedy-Spaltenzuweisung innerhalb des Clusters
    const colEnds: number[] = []
    const cols: number[] = []
    for (const item of cluster) {
      let col = colEnds.findIndex((end) => end <= item.start)
      if (col === -1) {
        col = colEnds.length
        colEnds.push(item.end)
      } else {
        colEnds[col] = item.end
      }
      cols.push(col)
    }
    const total = colEnds.length
    cluster.forEach((item, i) => {
      placed.push({
        event: item.event,
        top: (item.start / 60) * HOUR_HEIGHT,
        height: Math.max(((item.end - item.start) / 60) * HOUR_HEIGHT, 18),
        left: (cols[i] / total) * 100,
        width: (1 / total) * 100,
      })
    })
    cluster = []
    clusterEnd = -1
  }

  for (const item of items) {
    if (cluster.length > 0 && item.start >= clusterEnd) flush()
    cluster.push(item)
    clusterEnd = Math.max(clusterEnd, item.end)
  }
  flush()

  return placed
}

export default function WeekView({ days, events, onCreate, onCreateAllDay, onOpen, timed = true }: Props) {
  if (!timed) return <CompactWeekView days={days} events={events} onCreate={onCreate} onCreateAllDay={onCreateAllDay} onOpen={onOpen} />
  const scrollRef = useRef<HTMLDivElement>(null)
  const [now, setNow] = useState(() => new Date())
  const [drag, setDrag] = useState<DragState | null>(null)
  // Ref, damit mouseup den aktuellen Stand sieht (State wäre im Closure veraltet)
  const dragRef = useRef<DragState | null>(null)
  const onCreateRef = useRef(onCreate)
  onCreateRef.current = onCreate

  // Beim Öffnen auf den Vormittag scrollen
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 7 * HOUR_HEIGHT
  }, [])

  // Zeitmarker aktuell halten
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  const minutesFromEvent = (e: React.MouseEvent<HTMLDivElement>): number => {
    const rect = e.currentTarget.getBoundingClientRect()
    const raw = ((e.clientY - rect.top) / HOUR_HEIGHT) * 60
    const snapped = Math.floor(raw / SLOT_MINUTES) * SLOT_MINUTES
    return Math.min(Math.max(snapped, 0), DAY_MINUTES - SLOT_MINUTES)
  }

  // Ziehen endet auch außerhalb der Spalte
  useEffect(() => {
    const onUp = () => {
      const d = dragRef.current
      if (!d) return
      dragRef.current = null
      setDrag(null)
      const from = Math.min(d.from, d.to)
      const to = Math.min(Math.max(d.from, d.to) + SLOT_MINUTES, DAY_MINUTES)
      onCreateRef.current(dateAtMinutes(d.day, from), dateAtMinutes(d.day, to))
    }
    document.addEventListener('mouseup', onUp)
    return () => document.removeEventListener('mouseup', onUp)
  }, [])

  const allDayRows = days.map((day) => eventsOnDay(events, day).filter((e) => e.allDay))
  const hasAllDay = allDayRows.some((row) => row.length > 0)

  const gridCols = { gridTemplateColumns: `4rem repeat(${days.length}, minmax(0, 1fr))` }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
      {/* Kopfzeile mit Tagen */}
      <div
        className="grid shrink-0 border-b border-neutral-200 dark:border-neutral-800"
        style={gridCols}
      >
        <div className="border-r border-neutral-200 dark:border-neutral-800" />
        {days.map((day) => (
          <div
            key={day.toISOString()}
            className="flex flex-col items-center gap-0.5 border-r border-neutral-200 py-2 last:border-r-0 dark:border-neutral-800"
          >
            <span className="text-[11px] font-medium tracking-wide text-neutral-500 uppercase">
              {formatWeekdayShort(day)}
            </span>
            <span
              className={cn(
                'grid size-8 place-items-center rounded-full text-sm',
                isToday(day)
                  ? 'bg-neutral-900 font-semibold text-white dark:bg-white dark:text-neutral-900'
                  : 'font-medium',
              )}
            >
              {day.getDate()}
            </span>
          </div>
        ))}
      </div>

      {/* Ganztägige Termine */}
      <div
        className="grid shrink-0 border-b border-neutral-200 dark:border-neutral-800"
        style={gridCols}
      >
        <div className="flex items-start justify-end border-r border-neutral-200 px-2 py-1.5 text-[11px] text-neutral-400 dark:border-neutral-800">
          ganztägig
        </div>
        {days.map((day, i) => (
          <div
            key={day.toISOString()}
            onClick={() => onCreateAllDay(day)}
            className={cn(
              'cursor-pointer space-y-0.5 border-r border-neutral-200 p-1 transition last:border-r-0 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800/40',
              hasAllDay ? 'min-h-[2.25rem]' : 'min-h-[1.5rem]',
            )}
          >
            {allDayRows[i].map((event) => (
              <button
                key={event.id}
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onOpen(event)
                }}
                className={cn(
                  'block w-full truncate rounded border px-1.5 py-0.5 text-left text-[11px] font-medium transition hover:brightness-95',
                  categories[event.category].block,
                )}
              >
                {event.title}
              </button>
            ))}
          </div>
        ))}
      </div>

      {/* Zeitraster */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        <div className="grid" style={gridCols}>
          {/* Stundenachse */}
          <div className="border-r border-neutral-200 dark:border-neutral-800">
            {Array.from({ length: 24 }, (_, h) => (
              <div
                key={h}
                className="relative text-right"
                style={{ height: HOUR_HEIGHT }}
              >
                {h > 0 && (
                  <span className="absolute -top-2 right-2 text-[11px] tabular-nums text-neutral-400">
                    {String(h).padStart(2, '0')}:00
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Tagesspalten */}
          {days.map((day) => {
            const placed = layout(eventsOnDay(events, day), day)
            const dragOnDay = drag && drag.day.getTime() === day.getTime() ? drag : null
            const dragTop = dragOnDay
              ? (Math.min(dragOnDay.from, dragOnDay.to) / 60) * HOUR_HEIGHT
              : 0
            const dragHeight = dragOnDay
              ? ((Math.abs(dragOnDay.to - dragOnDay.from) + SLOT_MINUTES) / 60) * HOUR_HEIGHT
              : 0

            return (
              <div
                key={day.toISOString()}
                className="relative border-r border-neutral-200 last:border-r-0 dark:border-neutral-800"
                style={{ height: 24 * HOUR_HEIGHT }}
                onMouseDown={(e) => {
                  if (e.button !== 0) return
                  const next = { day: startOfDay(day), from: minutesFromEvent(e), to: minutesFromEvent(e) }
                  dragRef.current = next
                  setDrag(next)
                }}
                onMouseMove={(e) => {
                  const d = dragRef.current
                  if (!d || d.day.getTime() !== startOfDay(day).getTime()) return
                  const m = minutesFromEvent(e)
                  if (d.to === m) return
                  d.to = m
                  setDrag({ ...d })
                }}
              >
                {/* Stundenlinien */}
                {Array.from({ length: 24 }, (_, h) => (
                  <div
                    key={h}
                    className="border-b border-neutral-100 dark:border-neutral-800/70"
                    style={{ height: HOUR_HEIGHT }}
                  >
                    <div className="h-1/2 border-b border-dashed border-neutral-100/80 dark:border-neutral-800/40" />
                  </div>
                ))}

                {/* Aufgezogener Bereich */}
                {dragOnDay && (
                  <div
                    className="pointer-events-none absolute inset-x-1 rounded border border-neutral-400 bg-neutral-200/70 dark:border-neutral-500 dark:bg-neutral-700/60"
                    style={{ top: dragTop, height: dragHeight }}
                  />
                )}

                {/* Termine */}
                {placed.map((p) => (
                  <button
                    key={p.event.id}
                    type="button"
                    onMouseDown={(e) => {
                      e.stopPropagation()
                      dragRef.current = null
                    }}
                    onClick={(e) => {
                      e.stopPropagation()
                      onOpen(p.event)
                    }}
                    className={cn(
                      'absolute overflow-hidden rounded-md border px-1.5 py-0.5 text-left transition hover:brightness-95',
                      categories[p.event.category].block,
                    )}
                    style={{
                      top: p.top,
                      height: p.height,
                      left: `calc(${p.left}% + 2px)`,
                      width: `calc(${p.width}% - 4px)`,
                    }}
                  >
                    <div className="truncate text-[11px] font-semibold">{p.event.title}</div>
                    {p.height > 30 && (
                      <div className="truncate text-[10px] opacity-75">
                        {formatTime(new Date(p.event.start))} – {formatTime(new Date(p.event.end))}
                        {p.event.location ? ` · ${p.event.location}` : ''}
                      </div>
                    )}
                  </button>
                ))}

                {/* Aktuelle Uhrzeit */}
                {isToday(day) && (
                  <div
                    className="pointer-events-none absolute inset-x-0 z-10 flex items-center"
                    style={{ top: (minutesOfDay(now) / 60) * HOUR_HEIGHT }}
                  >
                    <span className="-ml-1 size-2 rounded-full bg-red-500" />
                    <span className="h-px flex-1 bg-red-500" />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function CompactWeekView({ days, events, onCreate, onCreateAllDay, onOpen }: Props) {
  return <div className="grid min-h-0 flex-1 overflow-auto rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(12rem, 1fr))` }}>
    {days.map((day) => {
      const dayEvents = eventsOnDay(events, day).sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
      return <section key={day.toISOString()} className="min-h-56 border-r border-neutral-200 p-2 last:border-r-0 dark:border-neutral-800" onDoubleClick={() => onCreateAllDay(day)}>
        <header className="mb-2 border-b border-neutral-100 pb-2 text-center text-xs font-semibold dark:border-neutral-800">{formatWeekdayShort(day)} {day.getDate()}</header>
        <div className="space-y-1.5">{dayEvents.length === 0 && <p className="py-6 text-center text-xs text-neutral-400">Keine Einträge</p>}{dayEvents.map((event) => <button key={event.id} type="button" onClick={() => onOpen(event)} className={cn('block w-full rounded border px-2 py-1.5 text-left text-xs font-medium', categories[event.category].block)}><span className="block truncate">{event.title}</span>{!event.allDay && <span className="text-[10px] opacity-70">{formatTime(new Date(event.start))}–{formatTime(new Date(event.end))}</span>}</button>)}</div>
        <button type="button" onClick={() => onCreate(startOfDay(day), addDays(startOfDay(day), 1))} className="mt-3 w-full rounded px-2 py-1 text-xs text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800">+ Eintrag</button>
      </section>
    })}
  </div>
}
