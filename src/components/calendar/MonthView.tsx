import { Plus } from 'lucide-react'
import { cn } from '@/lib/cn'
import { categories, eventsOnDay, type CalEvent } from '@/lib/events'
import {
  addDays,
  formatTime,
  isSameMonth,
  isToday,
  isoWeek,
  startOfMonth,
  startOfWeek,
} from '@/lib/date'

interface Props {
  cursor: Date
  events: CalEvent[]
  onCreate: (day: Date) => void
  onOpen: (event: CalEvent) => void
  onPickDay: (day: Date) => void
}

const weekdays = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

export default function MonthView({ cursor, events, onCreate, onOpen, onPickDay }: Props) {
  const first = startOfWeek(startOfMonth(cursor))
  const weeks = Array.from({ length: 6 }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => addDays(first, w * 7 + d)),
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
      {/* Wochentagsleiste */}
      <div className="grid shrink-0 grid-cols-[3rem_repeat(7,minmax(0,1fr))] border-b border-neutral-200 dark:border-neutral-800">
        <div className="px-2 py-2 text-center text-[11px] font-medium text-neutral-400">KW</div>
        {weekdays.map((day, i) => (
          <div
            key={day}
            className={cn(
              'border-l border-neutral-200 px-2 py-2 text-center text-[11px] font-semibold tracking-wide text-neutral-500 uppercase dark:border-neutral-800',
              i >= 5 && 'text-neutral-400',
            )}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Wochenzeilen */}
      <div className="grid min-h-0 flex-1 grid-rows-6">
        {weeks.map((week, wi) => (
          <div
            key={wi}
            className="grid min-h-0 grid-cols-[3rem_repeat(7,minmax(0,1fr))] border-b border-neutral-200 last:border-b-0 dark:border-neutral-800"
          >
            <div className="grid place-items-start justify-center pt-2 text-[11px] text-neutral-400">
              {isoWeek(week[0])}
            </div>

            {week.map((day) => {
              const dayEvents = eventsOnDay(events, day)
              const outside = !isSameMonth(day, cursor)
              const weekend = day.getDay() === 0 || day.getDay() === 6

              return (
                <div
                  key={day.toISOString()}
                  onClick={() => onCreate(day)}
                  className={cn(
                    'group relative flex min-h-0 cursor-pointer flex-col border-l border-neutral-200 p-1 transition dark:border-neutral-800',
                    weekend && 'bg-neutral-50/60 dark:bg-neutral-950/40',
                    outside && 'text-neutral-400',
                    'hover:bg-neutral-50 dark:hover:bg-neutral-800/40',
                  )}
                >
                  <div className="flex shrink-0 items-center justify-between px-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onPickDay(day)
                      }}
                      className={cn(
                        'grid size-6 place-items-center rounded-full text-xs transition',
                        isToday(day)
                          ? 'bg-neutral-900 font-semibold text-white dark:bg-white dark:text-neutral-900'
                          : outside
                            ? 'text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                            : 'hover:bg-neutral-100 dark:hover:bg-neutral-800',
                      )}
                      title="Tagesansicht öffnen"
                    >
                      {day.getDate()}
                    </button>
                    <Plus className="size-3.5 text-neutral-300 opacity-0 transition group-hover:opacity-100 dark:text-neutral-600" />
                  </div>

                  <div className="mt-0.5 min-h-0 flex-1 space-y-0.5 overflow-hidden">
                    {dayEvents.slice(0, 3).map((event) => (
                      <button
                        key={event.id}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          onOpen(event)
                        }}
                        className={cn(
                          'flex w-full items-center gap-1 rounded border px-1.5 py-0.5 text-left text-[11px] transition hover:brightness-95',
                          categories[event.category].block,
                        )}
                      >
                        {!event.allDay && (
                          <span className="shrink-0 tabular-nums opacity-70">
                            {formatTime(new Date(event.start))}
                          </span>
                        )}
                        <span className="truncate font-medium">{event.title}</span>
                      </button>
                    ))}

                    {dayEvents.length > 3 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          onPickDay(day)
                        }}
                        className="w-full px-1.5 text-left text-[11px] text-neutral-500 hover:underline"
                      >
                        +{dayEvents.length - 3} weitere
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
