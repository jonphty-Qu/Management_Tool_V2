import { useMemo, useState } from 'react'
import { Link2, Plus, Search, Trash2, Pencil, Star, X, Bookmark as BookmarkIcon, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/cn'
import {
  DEFAULT_GROUP,
  byUsage,
  hostOf,
  newBookmarkId,
  normalizeUrl,
  useBookmarks,
  type Bookmark,
} from '@/lib/bookmarks'
import { openExternal } from '@/lib/external'

const inputClass =
  'rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-sm outline-none transition focus:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-800 dark:focus:border-neutral-500'

export default function Bookmarks() {
  const { bookmarks, groups, save, remove, markOpened } = useBookmarks()
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState<string | null>(null)
  const [quickUrl, setQuickUrl] = useState('')
  const [notice, setNotice] = useState<string | null>(null)
  const [draft, setDraft] = useState<Bookmark | null>(null)

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return bookmarks.filter(
      (b) =>
        (!group || b.group === group) &&
        (!q || `${b.title} ${b.url} ${b.note ?? ''} ${b.group}`.toLowerCase().includes(q)),
    )
  }, [bookmarks, query, group])

  const pinned = useMemo(() => visible.filter((b) => b.pinned).sort(byUsage), [visible])

  const sections = useMemo(
    () =>
      groups
        .map((g) => ({
          group: g,
          items: visible.filter((b) => b.group === g).sort((a, b) => a.title.localeCompare(b.title, 'de')),
        }))
        .filter((s) => s.items.length > 0),
    [groups, visible],
  )

  /** Gruppen mit Einträgen – für die Filter-Chips. */
  const usedGroups = useMemo(
    () => groups.map((g) => ({ group: g, count: bookmarks.filter((b) => b.group === g).length })).filter((g) => g.count > 0),
    [groups, bookmarks],
  )

  const open = (b: Bookmark) => {
    markOpened(b.id)
    void openExternal(b.url)
  }

  /** Link einfügen = sofort gespeichert; der Dialog öffnet sich zum Benennen. */
  const quickAdd = (raw: string) => {
    const url = normalizeUrl(raw)
    if (!url) {
      setNotice('Das ist kein gültiger Link.')
      return
    }
    const duplicate = bookmarks.find((b) => b.url === url)
    if (duplicate) {
      setNotice(`Schon gespeichert als „${duplicate.title}“.`)
      return
    }
    const created: Bookmark = {
      id: newBookmarkId(),
      title: hostOf(url),
      url,
      group: group ?? DEFAULT_GROUP,
      pinned: false,
      createdAt: new Date().toISOString(),
    }
    save(created)
    setQuickUrl('')
    setNotice(null)
    setDraft(created)
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Lesezeichen</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Deine häufig genutzten Seiten – Favoriten oben, der Rest nach Gruppen.
          </p>
        </div>
        <button
          type="button"
          onClick={() =>
            setDraft({
              id: newBookmarkId(),
              title: '',
              url: '',
              group: group ?? DEFAULT_GROUP,
              pinned: false,
              createdAt: new Date().toISOString(),
            })
          }
          className="ml-auto flex items-center gap-1.5 rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          <Plus className="size-4" />
          Lesezeichen
        </button>
      </div>

      {/* Link einfügen → sofort gespeichert */}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          quickAdd(quickUrl)
        }}
        className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-white p-1.5 pl-3 dark:border-neutral-800 dark:bg-neutral-900"
      >
        <Link2 className="size-4 shrink-0 text-neutral-400" />
        <input
          value={quickUrl}
          onChange={(e) => {
            setQuickUrl(e.target.value)
            setNotice(null)
          }}
          onPaste={(e) => {
            const pasted = e.clipboardData.getData('text').trim()
            if (/^(https?:\/\/|www\.)\S+$/i.test(pasted)) {
              e.preventDefault()
              quickAdd(pasted)
            }
          }}
          placeholder="Link einfügen – wird sofort gespeichert"
          className="min-w-0 flex-1 bg-transparent py-1.5 text-sm outline-none placeholder:text-neutral-400"
        />
        <button
          type="submit"
          disabled={!quickUrl.trim()}
          className="shrink-0 rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:opacity-40 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          Speichern
        </button>
      </form>
      {notice && (
        <p className="-mt-3 flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-300">
          <TriangleAlert className="size-3.5" />
          {notice}
        </p>
      )}

      {bookmarks.length === 0 ? (
        <div className="grid place-items-center rounded-xl border border-dashed border-neutral-300 px-6 py-14 text-center dark:border-neutral-700">
          <BookmarkIcon className="size-10 text-neutral-300 dark:text-neutral-600" />
          <h3 className="mt-3 text-base font-semibold">Noch keine Lesezeichen</h3>
          <p className="mt-1 max-w-md text-sm text-neutral-500">
            Zum Beispiel Online-Banking, Jobportale, ELSTER, Webmail oder Lernplattformen. Link oben
            einfügen – fertig. Wichtige als Favorit anheften, dann liegen sie oben und auf dem Dashboard.
          </p>
        </div>
      ) : (
        <>
          {/* Suche + Gruppen */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-56 flex-1">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-neutral-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Lesezeichen durchsuchen…"
                className="w-full rounded-lg border border-neutral-200 bg-white py-2 pr-3 pl-9 text-sm outline-none focus:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-900"
              />
            </div>
            <div className="flex flex-wrap gap-1">
              <GroupChip label="Alle" count={bookmarks.length} active={group === null} onClick={() => setGroup(null)} />
              {usedGroups.map((g) => (
                <GroupChip
                  key={g.group}
                  label={g.group}
                  count={g.count}
                  active={group === g.group}
                  onClick={() => setGroup(group === g.group ? null : g.group)}
                />
              ))}
            </div>
          </div>

          {visible.length === 0 && <p className="py-8 text-center text-sm text-neutral-500">Nichts gefunden.</p>}

          {/* Favoriten */}
          {pinned.length > 0 && (
            <section>
              <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
                <Star className="size-4 fill-amber-400 text-amber-500" />
                Favoriten
              </h3>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                {pinned.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => open(b)}
                    title={b.url}
                    className="flex flex-col items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-4 text-center transition hover:border-neutral-300 hover:shadow-sm dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-neutral-700"
                  >
                    <Favicon url={b.url} large />
                    <span className="w-full truncate text-sm font-medium">{b.title}</span>
                    <span className="-mt-1.5 w-full truncate text-[11px] text-neutral-400">{hostOf(b.url)}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Gruppen */}
          {sections.map(({ group: g, items }) => (
            <section
              key={g}
              className="overflow-hidden rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900"
            >
              <div className="border-b border-neutral-200 px-4 py-2 text-[11px] font-semibold tracking-wide text-neutral-500 uppercase dark:border-neutral-800">
                {g} <span className="text-neutral-400 tabular-nums">{items.length}</span>
              </div>
              <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {items.map((b) => (
                  <li key={b.id} className="group flex items-center gap-3 px-4 py-2.5">
                    <Favicon url={b.url} />
                    <button type="button" onClick={() => open(b)} title={b.url} className="min-w-0 flex-1 text-left">
                      <div className="truncate text-sm font-medium group-hover:underline">{b.title}</div>
                      <div className="truncate text-xs text-neutral-500">
                        {hostOf(b.url)}
                        {b.note && ` · ${b.note}`}
                      </div>
                    </button>
                    <div className="flex shrink-0 items-center gap-0.5">
                      <IconButton
                        label={b.pinned ? 'Nicht mehr anheften' : 'Als Favorit anheften'}
                        onClick={() => save({ ...b, pinned: !b.pinned })}
                      >
                        <Star className={cn('size-4', b.pinned && 'fill-amber-400 text-amber-500')} />
                      </IconButton>
                      <IconButton label="Bearbeiten" onClick={() => setDraft(b)}>
                        <Pencil className="size-4" />
                      </IconButton>
                      <IconButton
                        label="Löschen"
                        danger
                        onClick={() => {
                          if (confirm(`„${b.title}“ löschen?`)) remove(b.id)
                        }}
                      >
                        <Trash2 className="size-4" />
                      </IconButton>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </>
      )}

      {draft && (
        <BookmarkDialog
          draft={draft}
          groups={groups}
          existing={bookmarks.some((b) => b.id === draft.id)}
          isDuplicate={(url) => bookmarks.some((b) => b.url === url && b.id !== draft.id)}
          onSave={(b) => {
            save(b)
            setDraft(null)
          }}
          onClose={() => setDraft(null)}
        />
      )}
    </div>
  )
}

/** Symbol der Seite selbst (kein Drittanbieter-Dienst); fehlt es, der Anfangsbuchstabe. */
export function Favicon({ url, large }: { url: string; large?: boolean }) {
  const [failed, setFailed] = useState(false)
  let origin = ''
  try {
    origin = new URL(url).origin
  } catch {
    /* ungültig – Buchstabe */
  }
  const box = large ? 'size-10' : 'size-8'
  if (origin && !failed) {
    return (
      <span
        className={cn(
          'grid shrink-0 place-items-center rounded-lg bg-white ring-1 ring-neutral-200 dark:bg-neutral-800 dark:ring-neutral-700',
          box,
        )}
      >
        <img
          src={`${origin}/favicon.ico`}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className={large ? 'size-6' : 'size-4'}
        />
      </span>
    )
  }
  return (
    <span
      className={cn(
        'grid shrink-0 place-items-center rounded-lg bg-neutral-100 font-semibold text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300',
        box,
        large ? 'text-base' : 'text-sm',
      )}
    >
      {hostOf(url).charAt(0).toUpperCase()}
    </span>
  )
}

function GroupChip({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full px-2.5 py-1 text-xs transition',
        active
          ? 'bg-neutral-900 font-medium text-white dark:bg-white dark:text-neutral-900'
          : 'text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800',
      )}
    >
      {label} <span className="tabular-nums opacity-70">{count}</span>
    </button>
  )
}

function IconButton({
  label,
  danger,
  onClick,
  children,
}: {
  label: string
  danger?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        'rounded p-1.5 text-neutral-400 transition',
        danger
          ? 'hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400'
          : 'hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-white',
      )}
    >
      {children}
    </button>
  )
}

function BookmarkDialog({
  draft,
  groups,
  existing,
  isDuplicate,
  onSave,
  onClose,
}: {
  draft: Bookmark
  groups: string[]
  existing: boolean
  isDuplicate: (url: string) => boolean
  onSave: (b: Bookmark) => void
  onClose: () => void
}) {
  const [form, setForm] = useState(draft)
  const [error, setError] = useState<string | null>(null)
  const set = <K extends keyof Bookmark>(key: K, value: Bookmark[K]) => setForm((f) => ({ ...f, [key]: value }))

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const url = normalizeUrl(form.url)
    if (!url) return setError('Bitte einen gültigen Link eingeben.')
    if (isDuplicate(url)) return setError('Dieser Link ist schon gespeichert.')
    onSave({
      ...form,
      url,
      title: form.title.trim() || hostOf(url),
      group: form.group.trim() || DEFAULT_GROUP,
      note: form.note?.trim() || undefined,
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose()
      }}
    >
      <form
        onMouseDown={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="w-full max-w-md overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl dark:border-neutral-800 dark:bg-neutral-900"
      >
        <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-3.5 dark:border-neutral-800">
          <h2 className="text-sm font-semibold">{existing ? 'Lesezeichen bearbeiten' : 'Neues Lesezeichen'}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            className="rounded-lg p-1.5 text-neutral-400 transition hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-3 px-5 py-4">
          <Field label="Titel">
            <input
              autoFocus
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder={form.url ? hostOf(normalizeUrl(form.url) ?? form.url) : 'z. B. Online-Banking'}
              className={cn(inputClass, 'w-full')}
            />
          </Field>
          <Field label="Link">
            <input
              value={form.url}
              onChange={(e) => {
                set('url', e.target.value)
                setError(null)
              }}
              placeholder="https://…"
              className={cn(inputClass, 'w-full')}
            />
          </Field>
          <Field label="Gruppe">
            <input
              value={form.group}
              onChange={(e) => set('group', e.target.value)}
              list="bookmark-groups"
              placeholder={DEFAULT_GROUP}
              className={cn(inputClass, 'w-full')}
            />
            <datalist id="bookmark-groups">
              {groups.map((g) => (
                <option key={g} value={g} />
              ))}
            </datalist>
          </Field>
          <Field label="Notiz (optional)">
            <input
              value={form.note ?? ''}
              onChange={(e) => set('note', e.target.value)}
              placeholder="z. B. Login mit Kundennummer"
              className={cn(inputClass, 'w-full')}
            />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.pinned}
              onChange={(e) => set('pinned', e.target.checked)}
              className="size-4 rounded border-neutral-300 dark:border-neutral-600"
            />
            Als Favorit anheften (oben und auf dem Dashboard)
          </label>
          {error && (
            <p className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400">
              <TriangleAlert className="size-3.5" />
              {error}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-neutral-200 px-5 py-3.5 dark:border-neutral-800">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-neutral-200 px-3 py-1.5 text-sm transition hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
          >
            {existing ? 'Schließen' : 'Abbrechen'}
          </button>
          <button
            type="submit"
            className="rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            Speichern
          </button>
        </div>
      </form>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-neutral-500">{label}</span>
      {children}
    </label>
  )
}
