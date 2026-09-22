import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, Cake, CalendarClock, Briefcase } from 'lucide-react'
import { cn } from '@/lib/cn'
import { categories } from '@/lib/events'
import { useEventStore, useBoardStore } from '@/lib/store'
import { useDesktopNotifications, useReminders } from '@/lib/notifications'
import { useSettings } from '@/lib/settings'
import { formatDayLong, formatTime } from '@/lib/date'

export default function NotificationMenu() {
  const { events } = useEventStore()
  const { settings } = useSettings()
  const { projects } = useBoardStore()
  const { reminders, unreadCount, markAllRead } = useReminders(settings.notifications.eventReminders ? events : [])
  const now = new Date()
  const today = localDateKey(now)
  const dueTasks = settings.notifications.dueTasks
    ? projects.flatMap((project) => project.cards.filter((card) => {
        if (isCompleted(project, card.columnId)) return false
        const start = card.start ? localDateKey(new Date(card.start)) : ''
        const end = card.end ? localDateKey(new Date(card.end)) : ''
        return start === today || end === today || (end !== '' && end < today)
      }).map((card) => {
        const overdue = Boolean(card.end && localDateKey(new Date(card.end)) < today)
        return { id: card.id, title: card.title, project: project.name, projectId: project.id, overdue, priority: card.priority }
      })).sort((a, b) => Number(b.overdue) - Number(a.overdue) || priorityRank(b.priority) - priorityRank(a.priority))
    : []
  const weekEnd = new Date(now)
  weekEnd.setDate(weekEnd.getDate() + 7)
  const weekEndKey = localDateKey(weekEnd)
  const weeklyEvents = settings.notifications.weeklySummary
    ? events.filter((event) => {
        const start = localDateKey(new Date(event.start))
        return start >= today && start <= weekEndKey
      }).length
    : 0
  const weeklyTasks = settings.notifications.weeklySummary
    ? projects.reduce((count, project) => count + project.cards.filter((card) => {
        if (!card.end) return false
        const end = localDateKey(new Date(card.end))
        return !isCompleted(project, card.columnId) && end >= today && end <= weekEndKey
      }).length, 0)
    : 0
  useDesktopNotifications(reminders)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const canAskDesktop = typeof Notification !== 'undefined' && Notification.permission === 'default'

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const toggle = () => {
    setOpen((v) => {
      if (!v) markAllRead()
      return !v
    })
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={toggle}
        aria-label="Benachrichtigungen"
        className="relative rounded-lg p-2 text-neutral-500 transition hover:bg-neutral-100 dark:hover:bg-neutral-800"
      >
        <Bell className="size-[18px]" />
        {unreadCount + dueTasks.length > 0 && (
          <span className="absolute top-0.5 right-0.5 grid min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white ring-2 ring-white dark:ring-neutral-900">
            {unreadCount + dueTasks.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-lg shadow-black/5 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
            <h3 className="text-sm font-semibold">Benachrichtigungen</h3>
          </div>

          {reminders.length === 0 && dueTasks.length === 0 && !settings.notifications.weeklySummary ? (
            <div className="px-4 py-8 text-center text-sm text-neutral-500">Nichts Anstehendes.</div>
          ) : (
            <ul className="max-h-96 divide-y divide-neutral-100 overflow-y-auto dark:divide-neutral-800">
              {settings.notifications.weeklySummary && (
                <li className="flex gap-3 bg-indigo-50/70 px-4 py-3 dark:bg-indigo-500/10">
                  <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg border border-indigo-200 bg-indigo-100 text-indigo-700 dark:border-indigo-500/40 dark:bg-indigo-500/20 dark:text-indigo-200">
                    <CalendarClock className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">Diese Woche</div>
                    <div className="text-xs text-neutral-600 dark:text-neutral-300">
                      {weeklyEvents} {weeklyEvents === 1 ? 'Termin' : 'Termine'} · {weeklyTasks} {weeklyTasks === 1 ? 'Aufgabe' : 'Aufgaben'} fällig
                    </div>
                  </div>
                </li>
              )}
              {dueTasks.map((task) => (
                <li key={`task-${task.id}`} className="flex gap-3 px-4 py-3">
                  <span className={cn(
                    'mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg border',
                    task.overdue
                      ? 'border-rose-300 bg-rose-100 text-rose-700 dark:border-rose-500/50 dark:bg-rose-500/20 dark:text-rose-200'
                      : 'border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-500/50 dark:bg-amber-500/20 dark:text-amber-200',
                  )}>
                    <Briefcase className="size-4" />
                  </span>
                  <Link to={`/projects?projekt=${encodeURIComponent(task.projectId)}&aufgabe=${encodeURIComponent(task.id)}`} onClick={() => setOpen(false)} className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium hover:underline">{task.title}</div>
                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                      <span className={task.overdue ? 'text-rose-600 dark:text-rose-400' : 'text-neutral-500'}>{task.overdue ? 'Überfällig' : 'Heute fällig'} · {task.project}</span>
                      {task.priority === 'hoch' && <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-medium text-rose-700 dark:bg-rose-500/20 dark:text-rose-200">Hoch</span>}
                    </div>
                  </Link>
                </li>
              ))}
              {reminders.map((r) => {
                const Icon = r.category === 'geburtstag' ? Cake : r.category === 'gespraech' ? Briefcase : CalendarClock
                return (
                  <li key={r.id} className="flex gap-3 px-4 py-3">
                    <span
                      className={cn(
                        'mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg border',
                        categories[r.category].block,
                      )}
                    >
                      <Icon className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{r.title}</div>
                      <div className="text-xs text-neutral-500">{r.text}</div>
                      <div className="truncate text-[11px] text-neutral-400">
                        {formatDayLong(r.start)}
                        {!r.allDay && `, ${formatTime(r.start)}`}
                        {r.location && ` · ${r.location}`}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}

          {canAskDesktop && (
            <Link
              to="/settings?bereich=benachrichtigungen"
              onClick={() => setOpen(false)}
              className="block border-t border-neutral-200 px-4 py-2.5 text-xs text-indigo-600 hover:bg-neutral-50 dark:border-neutral-800 dark:text-indigo-400 dark:hover:bg-neutral-800"
            >
              Auch als Desktop-Benachrichtigung anzeigen …
            </Link>
          )}
        </div>
      )}
    </div>
  )
}

function isCompleted(project: { columns: Array<{ id: string; title: string }> }, columnId: string) {
  const title = project.columns.find((column) => column.id === columnId)?.title.toLowerCase() ?? ''
  return title.includes('erledigt') || title.includes('fertig') || title.includes('done')
}

function priorityRank(priority: 'niedrig' | 'mittel' | 'hoch') {
  return priority === 'hoch' ? 2 : priority === 'mittel' ? 1 : 0
}

function localDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
