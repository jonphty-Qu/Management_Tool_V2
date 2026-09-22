import { useState } from 'react'
import { Inbox, Check, X } from 'lucide-react'
import { useBoardStore } from '@/lib/store'
import { useInbox } from '@/lib/inbox'

/**
 * Zeigt vorbereitete Aufgaben aus `data/inbox.json` an und legt sie auf
 * Knopfdruck im aktiven Projekt an.
 */
export default function InboxBanner() {
  const { tasks, clear } = useInbox()
  const { active, quickAdd } = useBoardStore()
  const [done, setDone] = useState<number | null>(null)

  if (done !== null) {
    return (
      <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
        <Check className="size-4 shrink-0" />
        {done === 1 ? 'Eine Aufgabe übernommen.' : `${done} Aufgaben übernommen.`}
        <button
          type="button"
          onClick={() => setDone(null)}
          aria-label="Hinweis schließen"
          className="ml-auto rounded p-1 transition hover:bg-emerald-100 dark:hover:bg-emerald-500/20"
        >
          <X className="size-3.5" />
        </button>
      </div>
    )
  }

  if (!tasks.length) return null

  const take = async () => {
    for (const task of tasks) {
      quickAdd({
        title: task.title,
        description: task.description,
        priority: task.priority,
        end: task.due ? new Date(task.due).toISOString() : undefined,
      })
    }
    setDone(tasks.length)
    await clear()
  }

  return (
    <div className="mb-4 rounded-xl border border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-500/30 dark:bg-indigo-500/10">
      <div className="flex items-start gap-3">
        <Inbox className="mt-0.5 size-4 shrink-0 text-indigo-600 dark:text-indigo-300" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-indigo-900 dark:text-indigo-100">
            {tasks.length === 1 ? 'Eine Aufgabe wartet' : `${tasks.length} Aufgaben warten`} auf Übernahme
          </p>
          <p className="mt-0.5 truncate text-xs text-indigo-700/80 dark:text-indigo-200/70">
            {tasks
              .slice(0, 6)
              .map((t) => t.title)
              .join(' · ')}
            {tasks.length > 6 && ` · +${tasks.length - 6}`}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={take}
          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-indigo-500"
        >
          In „{active.name}“ übernehmen
        </button>
        <button
          type="button"
          onClick={() => void clear()}
          className="rounded-lg border border-indigo-200 px-3 py-1.5 text-sm text-indigo-800 transition hover:bg-indigo-100 dark:border-indigo-500/40 dark:text-indigo-200 dark:hover:bg-indigo-500/20"
        >
          Verwerfen
        </button>
        <span className="text-xs text-indigo-700/70 dark:text-indigo-200/60">
          Landen in der ersten Spalte des gewählten Projekts.
        </span>
      </div>
    </div>
  )
}
