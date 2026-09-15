import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Circle, Clock, Star } from 'lucide-react'
import { tools } from '@/lib/tools'
import { useBoard } from '@/lib/board'
import { useNotes } from '@/lib/notes'
import { useApplications } from '@/lib/applications'
import { useSettings } from '@/lib/settings'
import { byUsage, useBookmarks } from '@/lib/bookmarks'
import { openExternal } from '@/lib/external'
import { Favicon } from './Bookmarks'

function relativeTime(iso: string): string {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000))
  if (minutes < 1) return 'gerade eben'
  if (minutes < 60) return `vor ${minutes} Min.`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `vor ${hours} Std.`
  const days = Math.floor(hours / 24)
  return days === 1 ? 'gestern' : `vor ${days} Tagen`
}

export default function Dashboard() {
  const quickTools = tools.filter((t) => t.path !== '/')
  const { projects } = useBoard()
  const { notes } = useNotes()
  const { applications } = useApplications()
  const { settings } = useSettings()
  const { bookmarks, markOpened } = useBookmarks()
  const favorites = useMemo(() => bookmarks.filter((b) => b.pinned).sort(byUsage).slice(0, 12), [bookmarks])
  const dueToday = useMemo(() => {
    const today = new Date()
    const day = today.toISOString().slice(0, 10)
    return projects.flatMap((project) =>
      project.cards
        .filter((card) => card.end?.slice(0, 10) === day || card.start?.slice(0, 10) === day)
        .map((card) => ({
          id: card.id,
          title: card.title,
          project: project.name,
          time: card.start ? new Date(card.start).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : 'heute',
        })),
    )
  }, [projects])
  const recent = useMemo(() => {
    const items = [
      ...notes.map((note) => ({ id: `note-${note.id}`, text: `Notiz „${note.title || 'Ohne Titel'}“ bearbeitet`, at: note.updatedAt, path: '/notes' })),
      ...applications.filter((app) => app.appliedAt).map((app) => ({ id: `app-${app.id}`, text: `Bewerbung bei ${app.company || 'unbekannt'} erfasst`, at: app.appliedAt!, path: '/applications' })),
      ...projects.map((project) => ({ id: `project-${project.id}`, text: `Projekt „${project.name}“ angelegt`, at: project.createdAt, path: '/projects' })),
    ]
    return items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 5).map((item) => ({ ...item, when: relativeTime(item.at) }))
  }, [applications, notes, projects])

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Guten Tag{settings.profileName ? `, ${settings.profileName}` : ''}</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Hier ist dein Überblick für heute.
        </p>
      </div>

      {/* Angeheftete Lesezeichen */}
      {favorites.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold">
              <Star className="size-4 fill-amber-400 text-amber-500" />
              Favoriten
            </h3>
            <Link to="/bookmarks" className="text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-white">
              Alle Lesezeichen
            </Link>
          </div>
          <div className="flex flex-wrap gap-2">
            {favorites.map((b) => (
              <button
                key={b.id}
                type="button"
                title={b.url}
                onClick={() => {
                  markOpened(b.id)
                  void openExternal(b.url)
                }}
                className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-white py-1.5 pr-3 pl-1.5 text-sm transition hover:border-neutral-300 hover:shadow-sm dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-neutral-700"
              >
                <Favicon url={b.url} />
                <span className="max-w-40 truncate">{b.title}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Tool-Kacheln */}
      <section>
        <h3 className="mb-3 text-sm font-semibold">Tools</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {quickTools.map((tool) => (
            <Link
              key={tool.id}
              to={tool.path}
              className="group rounded-xl border border-neutral-200 bg-white p-4 transition hover:border-neutral-300 hover:shadow-sm dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-neutral-700"
            >
              <div className="flex items-start justify-between">
                <span className="grid size-10 place-items-center rounded-lg bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">
                  <tool.icon className="size-5" />
                </span>
                <ArrowRight className="size-4 text-neutral-300 transition group-hover:translate-x-0.5 group-hover:text-neutral-500 dark:text-neutral-700" />
              </div>
              <div className="mt-3 text-sm font-medium">{tool.name}</div>
              <div className="mt-0.5 line-clamp-2 text-xs text-neutral-500">
                {tool.description}
              </div>
            </Link>
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Heute fällig */}
        <section className="rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
            <h3 className="text-sm font-semibold">Heute fällig</h3>
            <Link to="/projects" className="text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-white">
              Zu den Projekten
            </Link>
          </div>
          <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {dueToday.length === 0 && <li className="px-4 py-6 text-sm text-neutral-500">Heute ist nichts fällig.</li>}
            {dueToday.map((task) => (
              <li key={task.id} className="flex items-center gap-3 px-4 py-3">
                <Circle className="size-4 shrink-0 text-neutral-300 dark:text-neutral-600" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">{task.title}</div>
                  <div className="text-xs text-neutral-500">{task.project}</div>
                </div>
                <span className="shrink-0 text-xs text-neutral-500">{task.time}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Letzte Aktivität */}
        <section className="rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
          <div className="border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
            <h3 className="text-sm font-semibold">Letzte Aktivität</h3>
          </div>
          <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {recent.length === 0 && <li className="px-4 py-6 text-sm text-neutral-500">Noch keine Aktivitäten.</li>}
            {recent.map((item) => (
              <li key={item.id} className="flex items-start gap-3 px-4 py-3">
                <Clock className="mt-0.5 size-4 shrink-0 text-neutral-300 dark:text-neutral-600" />
                <div className="min-w-0 flex-1">
                  <Link to={item.path} className="text-sm hover:underline">{item.text}</Link>
                  <div className="text-xs text-neutral-500">{item.when}</div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
