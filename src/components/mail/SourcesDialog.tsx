import { useEffect, useState } from 'react'
import { X, Loader2, TriangleAlert, Inbox } from 'lucide-react'
import { cn } from '@/lib/cn'
import {
  INTERVAL_OPTIONS,
  fetchFolders,
  type MailAccount,
  type MailFolder,
  type MailOverviewSettings,
} from '@/lib/mail'

interface Props {
  accounts: MailAccount[]
  colorOf: Record<string, string>
  value: MailOverviewSettings
  onSave: (next: MailOverviewSettings) => void
  onClose: () => void
}

type FolderState = { loading: true } | { loading: false; folders: MailFolder[]; error?: string }

/** Einmal festlegen, welche Konten und Ordner die Übersicht „Alle Konten“ zeigt. */
export default function SourcesDialog({ accounts, colorOf, value, onSave, onClose }: Props) {
  // Ohne gespeicherte Auswahl: der Posteingang jedes Kontos
  const [selected, setSelected] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(
      accounts.map((a) => [
        a.id,
        value.sources ? (value.sources.find((s) => s.accountId === a.id)?.folders ?? []) : ['INBOX'],
      ]),
    ),
  )
  const [intervalMin, setIntervalMin] = useState(value.intervalMin)
  const [folders, setFolders] = useState<Record<string, FolderState>>(() =>
    Object.fromEntries(accounts.map((a) => [a.id, { loading: true } as FolderState])),
  )

  useEffect(() => {
    for (const acc of accounts) {
      fetchFolders(acc.id)
        .then((list) => setFolders((prev) => ({ ...prev, [acc.id]: { loading: false, folders: list } })))
        .catch((err: Error) =>
          setFolders((prev) => ({ ...prev, [acc.id]: { loading: false, folders: [], error: err.message } })),
        )
    }
  }, [accounts])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const toggle = (accountId: string, path: string) =>
    setSelected((prev) => {
      const current = prev[accountId] ?? []
      return {
        ...prev,
        [accountId]: current.includes(path) ? current.filter((p) => p !== path) : [...current, path],
      }
    })

  const setAll = (accountId: string, paths: string[]) => setSelected((prev) => ({ ...prev, [accountId]: paths }))

  const total = Object.values(selected).reduce((sum, list) => sum + list.length, 0)

  const save = () => {
    onSave({
      sources: accounts
        .map((a) => ({ accountId: a.id, folders: selected[a.id] ?? [] }))
        .filter((s) => s.folders.length > 0),
      intervalMin,
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl dark:border-neutral-800 dark:bg-neutral-900"
      >
        <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-3.5 dark:border-neutral-800">
          <div>
            <h2 className="text-sm font-semibold">Quellen für „Alle Konten“</h2>
            <p className="text-xs text-neutral-500">Welche Postfächer und Ordner sollen in der Übersicht landen?</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            className="rounded-lg p-1.5 text-neutral-400 transition hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {accounts.map((acc) => {
            const state = folders[acc.id]
            const chosen = selected[acc.id] ?? []
            return (
              <section key={acc.id} className="rounded-xl border border-neutral-200 dark:border-neutral-800">
                <div className="flex items-center gap-2 border-b border-neutral-200 px-3 py-2 dark:border-neutral-800">
                  <span className={cn('size-2 rounded-full', colorOf[acc.id])} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{acc.label}</div>
                    <div className="truncate text-xs text-neutral-500">{acc.email}</div>
                  </div>
                  {state && !state.loading && state.folders.length > 0 && (
                    <div className="flex shrink-0 gap-1 text-xs">
                      <button
                        type="button"
                        onClick={() => setAll(acc.id, state.folders.map((f) => f.path))}
                        className="rounded px-1.5 py-0.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-white"
                      >
                        Alle
                      </button>
                      <button
                        type="button"
                        onClick={() => setAll(acc.id, [])}
                        className="rounded px-1.5 py-0.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-white"
                      >
                        Keine
                      </button>
                    </div>
                  )}
                </div>

                <div className="p-2">
                  {!state || state.loading ? (
                    <p className="flex items-center gap-2 px-1 py-1.5 text-xs text-neutral-500">
                      <Loader2 className="size-3.5 animate-spin" />
                      Ordner werden geladen…
                    </p>
                  ) : state.error ? (
                    <p className="flex items-start gap-1.5 px-1 py-1.5 text-xs text-amber-700 dark:text-amber-300">
                      <TriangleAlert className="mt-px size-3.5 shrink-0" />
                      {state.error}
                    </p>
                  ) : (
                    <div className="grid gap-0.5 sm:grid-cols-2">
                      {state.folders.map((f) => (
                        <label
                          key={f.path}
                          className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                        >
                          <input
                            type="checkbox"
                            checked={chosen.includes(f.path)}
                            onChange={() => toggle(acc.id, f.path)}
                            className="size-4 rounded border-neutral-300 dark:border-neutral-600"
                          />
                          <span className="min-w-0 flex-1 truncate" title={f.path}>
                            {f.name}
                          </span>
                          {f.unseen > 0 && (
                            <span className="shrink-0 text-xs text-neutral-400 tabular-nums">{f.unseen} neu</span>
                          )}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            )
          })}

          <p className="flex items-start gap-1.5 text-[11px] text-neutral-400">
            <Inbox className="mt-px size-3.5 shrink-0" />
            Angezeigt wird, was dein Anbieter per IMAP bereitstellt. Ansichten wie „Freunde &amp; Bekannte“ oder
            „Unbekannt“ tauchen nur auf, wenn sie dort echte Ordner sind.
          </p>

          <label className="flex items-center gap-3 text-sm">
            <span className="flex-1">Automatisch aktualisieren</span>
            <select
              value={intervalMin}
              onChange={(e) => setIntervalMin(Number(e.target.value))}
              className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-sm outline-none dark:border-neutral-700 dark:bg-neutral-800"
            >
              {INTERVAL_OPTIONS.map((m) => (
                <option key={m} value={m} className="bg-white text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100">
                  {m === 0 ? 'Nur per Knopfdruck' : m === 1 ? 'jede Minute' : `alle ${m} Minuten`}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-neutral-200 px-5 py-3.5 dark:border-neutral-800">
          <span className="text-xs text-neutral-500">{total === 1 ? '1 Ordner gewählt' : `${total} Ordner gewählt`}</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-neutral-200 px-3 py-1.5 text-sm transition hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
            >
              Abbrechen
            </button>
            <button
              type="button"
              onClick={save}
              disabled={total === 0}
              className="rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:opacity-40 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
            >
              Speichern
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
