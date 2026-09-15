import { useEffect, useMemo, useState } from 'react'
import {
  Plus,
  RefreshCw,
  X,
  TriangleAlert,
  Inbox,
  Trash2,
  ShieldCheck,
  Loader2,
  Send,
  FileText,
  Archive,
  ShieldAlert,
  Folder,
  Star,
  Mails,
  MailOpen,
  SlidersHorizontal,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import {
  accountColor,
  fetchFolders,
  folderLabel,
  providers,
  useMail,
  useMailOverview,
  useMailbox,
  type MailAccount,
  type MailFolder,
  type MailMessage,
  type NewAccount,
} from '@/lib/mail'
import MailReader from '@/components/mail/MailReader'
import SourcesDialog from '@/components/mail/SourcesDialog'
import { addDays, formatTime, isSameDay, startOfDay } from '@/lib/date'

const inputClass =
  'rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-sm outline-none transition focus:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-800 dark:focus:border-neutral-500'

const PAGE = 50

const fmtShortDate = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit' })
const fmtWeekday = new Intl.DateTimeFormat('de-DE', { weekday: 'short' })

function whenLabel(date: Date): string {
  const today = startOfDay(new Date())
  if (isSameDay(date, today)) return formatTime(date)
  if (isSameDay(date, addDays(today, -1))) return `Gestern ${formatTime(date)}`
  if (date > addDays(today, -6)) return `${fmtWeekday.format(date)} ${formatTime(date)}`
  return fmtShortDate.format(date)
}

function groupOf(date: Date): string {
  const today = startOfDay(new Date())
  if (isSameDay(date, today)) return 'Heute'
  if (isSameDay(date, addDays(today, -1))) return 'Gestern'
  if (date > addDays(today, -7)) return 'Diese Woche'
  return 'Älter'
}

function folderIcon(folder: MailFolder) {
  if (folder.path.toUpperCase() === 'INBOX') return Inbox
  switch (folder.specialUse) {
    case '\\Sent':
      return Send
    case '\\Drafts':
      return FileText
    case '\\Archive':
    case '\\All':
      return Archive
    case '\\Junk':
      return ShieldAlert
    case '\\Trash':
      return Trash2
    case '\\Flagged':
      return Star
    default:
      return Folder
  }
}

/** Breit genug für Liste und Lesebereich nebeneinander? */
function useWide(query = '(min-width: 1024px)') {
  const [wide, setWide] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const onChange = () => setWide(mq.matches)
    // Zusätzlich auf resize hören – das change-Signal kommt nicht in jeder Umgebung zuverlässig an
    mq.addEventListener('change', onChange)
    window.addEventListener('resize', onChange)
    onChange()
    return () => {
      mq.removeEventListener('change', onChange)
      window.removeEventListener('resize', onChange)
    }
  }, [query])
  return wide
}

const sameMail = (a: MailMessage | null, b: MailMessage) =>
  Boolean(a && a.uid === b.uid && a.accountId === b.accountId && a.folder === b.folder)

interface Group {
  key: string
  title: string
  subtitle?: string
  color?: string
  count?: number
  items: MailMessage[]
}

export default function Mail() {
  const { settings: overview, save: saveOverview } = useMailOverview()
  const mail = useMail(overview)
  const { accounts, status, loading, error, fetchedAt, refresh, addAccount, removeAccount, markLocal } = mail
  const [accountId, setAccountId] = useState<string | null>(null)
  const [folder, setFolder] = useState('INBOX')
  const [unreadOnly, setUnreadOnly] = useState(true)
  const [limit, setLimit] = useState(PAGE)
  const [folders, setFolders] = useState<MailFolder[]>([])
  const [foldersError, setFoldersError] = useState<string | null>(null)
  const [open, setOpen] = useState<MailMessage | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [sourcesOpen, setSourcesOpen] = useState(false)
  const wide = useWide()

  // „Alle Konten + ungelesen“ liefert schon useMail – dafür keine zweite Abfrage
  const unified = accountId === null && unreadOnly
  const mailbox = useMailbox({
    accountId,
    folder,
    unreadOnly,
    limit,
    enabled: !unified && accounts.length > 0,
    sources: overview.sources,
  })

  const messages = unified ? mail.messages : mailbox.messages
  const listLoading = unified ? loading : mailbox.loading
  const listError = unified ? null : mailbox.error

  const loadFolders = (id: string) => {
    setFoldersError(null)
    fetchFolders(id)
      .then(setFolders)
      .catch((err: Error) => setFoldersError(err.message))
  }

  // Kontowechsel: Ordnerliste neu, zurück in den Posteingang
  useEffect(() => {
    setFolder('INBOX')
    setLimit(PAGE)
    setFolders([])
    setOpen(null)
    if (accountId) loadFolders(accountId)
  }, [accountId])

  useEffect(() => {
    setLimit(PAGE)
    setOpen(null)
  }, [folder, unreadOnly])

  const colorOf = useMemo(
    () => Object.fromEntries(accounts.map((a, i) => [a.id, accountColor(i)])),
    [accounts],
  )
  const accountById = useMemo(() => Object.fromEntries(accounts.map((a) => [a.id, a])), [accounts])
  const totalUnread = accounts.reduce((sum, a) => sum + (status[a.id]?.unreadTotal ?? 0), 0)

  // Übersicht: nach Postfach untereinander; einzelnes Konto: nach Datum
  const groups = useMemo<Group[]>(() => {
    if (accountId === null) {
      return accounts
        .map((acc) => ({
          key: acc.id,
          title: acc.label,
          subtitle: acc.label !== acc.email ? acc.email : undefined,
          color: colorOf[acc.id],
          count: messages.filter((m) => m.accountId === acc.id).length,
          items: messages.filter((m) => m.accountId === acc.id),
        }))
        .filter((g) => g.items.length > 0)
    }
    const out: Group[] = []
    for (const msg of messages) {
      const label = groupOf(new Date(msg.date))
      const last = out[out.length - 1]
      if (last?.key === label) last.items.push(msg)
      else out.push({ key: label, title: label, items: [msg] })
    }
    return out
  }, [accountId, accounts, colorOf, messages])

  const reloadAll = () => {
    void refresh()
    void mailbox.reload()
    if (accountId) loadFolders(accountId)
  }

  /** Gelesen/ungelesen überall nachziehen – Liste, Zähler, Ordner. */
  const onSeenChange = (msg: MailMessage, seen: boolean) => {
    // In der Übersicht „Ungelesen“ bleibt die geöffnete Mail sichtbar, bis man weiterklickt
    if (!(unified && seen)) markLocal(msg, seen)
    mailbox.patch(msg, { seen })
    setFolders((prev) =>
      prev.map((f) => (f.path === msg.folder ? { ...f, unseen: Math.max(0, f.unseen + (seen ? -1 : 1)) } : f)),
    )
    setOpen((o) => (o && sameMail(o, msg) ? { ...o, seen } : o))
  }

  /** Beim Weiterklicken in „Ungelesen“ die zuvor gelesene Mail aus der Liste nehmen. */
  const select = (msg: MailMessage) => {
    if (unified && open && open.seen && !sameMail(open, msg)) markLocal(open, true)
    setOpen(msg)
  }

  // Beschreibung der gewählten Quellen für die Kopfzeile
  const sourcesSummary = useMemo(() => {
    if (!overview.sources) return 'Posteingang aller Konten'
    const count = overview.sources.reduce((sum, s) => sum + s.folders.length, 0)
    const names = overview.sources.flatMap((s) => s.folders.map(folderLabel))
    const unique = [...new Set(names)]
    return unique.length <= 3 ? unique.join(', ') : `${count} Ordner aus ${overview.sources.length} Konten`
  }, [overview.sources])

  const currentFolderName =
    accountId === null ? `Übersicht · ${sourcesSummary}` : (folders.find((f) => f.path === folder)?.name ?? folder)
  const canLoadMore = !unified && !listLoading && mailbox.total > messages.length

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">E-Mails</h2>
          <p className="text-sm text-neutral-500">Links die Mails, rechts der Inhalt.</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {fetchedAt && (
            <span
              className="text-xs text-neutral-400"
              title={overview.intervalMin > 0 ? 'Außerdem beim Zurückkehren ins Fenster' : 'Einstellbar unter „Quellen“'}
            >
              Stand {formatTime(fetchedAt)} ·{' '}
              {overview.intervalMin === 0
                ? 'nur per Knopfdruck'
                : overview.intervalMin === 1
                  ? 'jede Minute'
                  : `alle ${overview.intervalMin} Min.`}
            </span>
          )}
          <button
            type="button"
            onClick={reloadAll}
            disabled={listLoading || accounts.length === 0}
            className="flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-1.5 text-sm transition hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
          >
            <RefreshCw className={cn('size-4', listLoading && 'animate-spin')} />
            Aktualisieren
          </button>
          <button
            type="button"
            onClick={() => setDialogOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            <Plus className="size-4" />
            Konto
          </button>
        </div>
      </div>

      {error && <ErrorBox text={error} />}

      {accounts.length === 0 ? (
        <div className="grid place-items-center rounded-xl border border-dashed border-neutral-300 px-6 py-16 text-center dark:border-neutral-700">
          <Inbox className="size-10 text-neutral-300 dark:text-neutral-600" />
          <h3 className="mt-3 text-base font-semibold">Noch kein Postfach eingebunden</h3>
          <p className="mt-1 max-w-md text-sm text-neutral-500">
            Füge deine Konten hinzu – Gmail, GMX, WEB.DE, iCloud und alle anderen mit IMAP.
          </p>
          <button
            type="button"
            onClick={() => setDialogOpen(true)}
            className="mt-5 flex items-center gap-1.5 rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            <Plus className="size-4" />
            Erstes Konto hinzufügen
          </button>
        </div>
      ) : (
        <>
          {/* Konten */}
          <div className="flex flex-wrap items-center gap-2">
            <div
              className={cn(
                'flex items-center rounded-lg border text-sm transition',
                accountId === null
                  ? 'border-neutral-900 dark:border-white'
                  : 'border-neutral-200 hover:border-neutral-300 dark:border-neutral-700',
              )}
            >
              <button
                type="button"
                onClick={() => setAccountId(null)}
                className={cn(
                  'flex items-center gap-2 py-1.5 pr-2 pl-3',
                  accountId === null ? 'font-medium' : 'text-neutral-500',
                )}
              >
                <Mails className="size-4" />
                Alle Konten <span className="tabular-nums">{totalUnread}</span>
              </button>
              <button
                type="button"
                onClick={() => setSourcesOpen(true)}
                title="Quellen wählen: welche Konten und Ordner die Übersicht zeigt"
                className="mr-1 flex items-center gap-1 rounded-md border-l border-neutral-200 px-2 py-1 text-xs text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900 dark:border-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-white"
              >
                <SlidersHorizontal className="size-3.5" />
                Quellen
              </button>
            </div>

            {accounts.map((acc) => (
              <AccountChip
                key={acc.id}
                account={acc}
                color={colorOf[acc.id]}
                unread={status[acc.id]?.unreadTotal}
                error={status[acc.id]?.error}
                active={accountId === acc.id}
                onSelect={() => setAccountId(acc.id)}
                onRemove={() => {
                  if (confirm(`Konto „${acc.label}“ entfernen? Das gespeicherte Passwort wird gelöscht.`)) {
                    if (accountId === acc.id) setAccountId(null)
                    void removeAccount(acc.id)
                  }
                }}
              />
            ))}
          </div>

          {accounts
            .filter((a) => status[a.id]?.error)
            .map((a) => (
              <ErrorBox key={a.id} tone="warn" text={`${a.label}: ${status[a.id]?.error}`} />
            ))}

          {/* Spalten: Ordner | Liste | Inhalt – jede scrollt für sich */}
          <div className="flex min-h-0 flex-1 gap-4">
            {accountId && (
              <nav className="hidden w-52 shrink-0 overflow-y-auto rounded-xl border border-neutral-200 bg-white p-1.5 xl:block dark:border-neutral-800 dark:bg-neutral-900">
                {foldersError && <p className="p-2 text-xs text-amber-700 dark:text-amber-300">{foldersError}</p>}
                {!foldersError && folders.length === 0 && (
                  <p className="flex items-center gap-2 p-2 text-xs text-neutral-500">
                    <Loader2 className="size-3.5 animate-spin" />
                    Ordner werden geladen…
                  </p>
                )}
                <ul className="space-y-0.5">
                  {folders.map((f) => {
                    const Icon = folderIcon(f)
                    return (
                      <li key={f.path}>
                        <button
                          type="button"
                          onClick={() => setFolder(f.path)}
                          title={f.path}
                          className={cn(
                            'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm transition',
                            folder === f.path
                              ? 'bg-neutral-100 font-medium dark:bg-neutral-800'
                              : 'text-neutral-600 hover:bg-neutral-50 dark:text-neutral-300 dark:hover:bg-neutral-800/50',
                          )}
                        >
                          <Icon className="size-4 shrink-0 text-neutral-400" />
                          <span className="min-w-0 flex-1 truncate">{f.name}</span>
                          {f.unseen > 0 && (
                            <span className="rounded-full bg-neutral-900 px-1.5 text-[10px] font-semibold text-white tabular-nums dark:bg-white dark:text-neutral-900">
                              {f.unseen}
                            </span>
                          )}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </nav>
            )}

            {/* Liste */}
            <section className="flex min-h-0 w-full flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white lg:w-[22rem] lg:shrink-0 2xl:w-[26rem] dark:border-neutral-800 dark:bg-neutral-900">
              <div className="space-y-2 border-b border-neutral-200 px-3 py-2.5 dark:border-neutral-800">
                <div className="flex items-center gap-2">
                  {/* Ordnerwahl als Auswahlfeld, solange die Ordnerspalte keinen Platz hat */}
                  {accountId && folders.length > 0 ? (
                    <select
                      value={folder}
                      onChange={(e) => setFolder(e.target.value)}
                      aria-label="Ordner"
                      className={cn(inputClass, 'min-w-0 flex-1 py-1 xl:hidden')}
                    >
                      {folders.map((f) => (
                        <option
                          key={f.path}
                          value={f.path}
                          className="bg-white text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100"
                        >
                          {f.name}
                          {f.unseen ? ` (${f.unseen})` : ''}
                        </option>
                      ))}
                    </select>
                  ) : null}
                  <h3
                    title={currentFolderName}
                    className={cn(
                      'min-w-0 flex-1 truncate text-sm font-semibold',
                      accountId && folders.length > 0 && 'hidden xl:block',
                    )}
                  >
                    {currentFolderName}
                  </h3>
                  <div className="flex shrink-0 rounded-lg border border-neutral-200 p-0.5 dark:border-neutral-700">
                    {(
                      [
                        [true, 'Ungelesen'],
                        [false, 'Alle'],
                      ] as const
                    ).map(([value, label]) => (
                      <button
                        key={label}
                        type="button"
                        onClick={() => setUnreadOnly(value)}
                        className={cn(
                          'rounded-md px-2 py-0.5 text-xs transition',
                          unreadOnly === value
                            ? 'bg-neutral-900 font-medium text-white dark:bg-white dark:text-neutral-900'
                            : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white',
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                {listError && <p className="text-xs text-amber-700 dark:text-amber-300">{listError}</p>}
              </div>

              <div className={cn('min-h-0 flex-1 overflow-y-auto transition', listLoading && messages.length > 0 && 'opacity-60')}>
                {listLoading && messages.length === 0 ? (
                  <div className="flex items-center justify-center gap-2 px-4 py-14 text-sm text-neutral-500">
                    <Loader2 className="size-4 animate-spin" />
                    Postfach wird abgefragt…
                  </div>
                ) : messages.length === 0 ? (
                  <div className="px-4 py-14 text-center text-sm text-neutral-500">
                    {unreadOnly ? 'Keine ungelesenen Mails. 🎉' : 'Dieser Ordner ist leer.'}
                  </div>
                ) : (
                  groups.map((group) => (
                    <div key={group.key}>
                      <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-neutral-100 bg-neutral-50/95 px-4 py-1.5 backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/95">
                        {group.color && <span className={cn('size-2 shrink-0 rounded-full', group.color)} />}
                        <span className="min-w-0 truncate text-[11px] font-semibold tracking-wide text-neutral-500 uppercase">
                          {group.title}
                        </span>
                        {group.subtitle && (
                          <span className="min-w-0 truncate text-[11px] text-neutral-400">{group.subtitle}</span>
                        )}
                        {group.count !== undefined && (
                          <span className="ml-auto shrink-0 text-[11px] text-neutral-400 tabular-nums">{group.count}</span>
                        )}
                      </div>
                      <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
                        {group.items.map((msg) => (
                          <MailRow
                            key={`${msg.accountId}:${msg.folder}:${msg.uid}`}
                            message={msg}
                            color={colorOf[msg.accountId]}
                            showFolder={accountId === null}
                            active={sameMail(open, msg)}
                            onOpen={() => select(msg)}
                          />
                        ))}
                      </ul>
                    </div>
                  ))
                )}

                {canLoadMore && (
                  <div className="p-3">
                    <button
                      type="button"
                      onClick={() => setLimit((l) => l + PAGE)}
                      className="w-full rounded-lg border border-neutral-200 py-2 text-sm text-neutral-600 transition hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
                    >
                      Ältere Mails laden ({messages.length} von {mailbox.total})
                    </button>
                  </div>
                )}
                {unified && accounts.some((a) => (status[a.id]?.folders ?? []).some((f) => f.total > PAGE)) && (
                  <p className="p-3 text-xs text-neutral-400">
                    Pro Ordner werden die neuesten {PAGE} ungelesenen Mails gezeigt – für mehr ein Konto auswählen.
                  </p>
                )}
              </div>
            </section>

            {/* Inhalt der gewählten Mail */}
            {wide && (
              <div className="flex min-h-0 min-w-0 flex-1">
                {open ? (
                  <MailReader
                    inline
                    message={open}
                    account={accountById[open.accountId]}
                    onClose={() => setOpen(null)}
                    onSeenChange={(seen) => onSeenChange(open, seen)}
                  />
                ) : (
                  <div className="grid flex-1 place-items-center rounded-xl border border-dashed border-neutral-300 text-center dark:border-neutral-700">
                    <div>
                      <MailOpen className="mx-auto size-10 text-neutral-300 dark:text-neutral-600" />
                      <p className="mt-3 text-sm text-neutral-500">Links eine Mail anklicken, um sie hier zu lesen.</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* Schmale Fenster: Einblendung von rechts */}
      {open && !wide && (
        <MailReader
          message={open}
          account={accountById[open.accountId]}
          onClose={() => setOpen(null)}
          onSeenChange={(seen) => onSeenChange(open, seen)}
        />
      )}

      {sourcesOpen && (
        <SourcesDialog
          accounts={accounts}
          colorOf={colorOf}
          value={overview}
          onClose={() => setSourcesOpen(false)}
          onSave={(next) => {
            saveOverview(next)
            setSourcesOpen(false)
            setAccountId(null)
          }}
        />
      )}

      {dialogOpen && (
        <AccountDialog
          onClose={() => setDialogOpen(false)}
          onSave={async (input) => {
            await addAccount(input)
            setDialogOpen(false)
          }}
        />
      )}
    </div>
  )
}

function ErrorBox({ text, tone = 'error' }: { text: string; tone?: 'error' | 'warn' }) {
  return (
    <div
      className={cn(
        'flex items-start gap-2 rounded-lg border px-3 py-2 text-sm',
        tone === 'error'
          ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300'
          : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200',
      )}
    >
      <TriangleAlert className="mt-0.5 size-4 shrink-0" />
      {text}
    </div>
  )
}

function AccountChip({
  account,
  color,
  unread,
  error,
  active,
  onSelect,
  onRemove,
}: {
  account: MailAccount
  color: string
  unread?: number
  error?: string
  active: boolean
  onSelect: () => void
  onRemove: () => void
}) {
  return (
    <div
      className={cn(
        'group flex items-center rounded-lg border text-sm transition',
        active
          ? 'border-neutral-900 dark:border-white'
          : 'border-neutral-200 hover:border-neutral-300 dark:border-neutral-700',
      )}
    >
      <button type="button" onClick={onSelect} className="flex items-center gap-2 py-1.5 pr-1 pl-3" title={account.email}>
        <span className={cn('size-2 rounded-full', color)} />
        <span className={cn(active ? 'font-medium' : 'text-neutral-600 dark:text-neutral-300')}>{account.label}</span>
        {error ? (
          <TriangleAlert className="size-3.5 text-amber-500" />
        ) : (
          <span className="tabular-nums text-neutral-500">{unread ?? '–'}</span>
        )}
      </button>
      <button
        type="button"
        onClick={onRemove}
        className="mr-1 rounded p-1 text-neutral-300 opacity-0 transition group-hover:opacity-100 hover:bg-red-50 hover:text-red-600 dark:text-neutral-600 dark:hover:bg-red-950/40"
        aria-label={`${account.label} entfernen`}
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  )
}

function MailRow({
  message,
  color,
  showFolder,
  active,
  onOpen,
}: {
  message: MailMessage
  color?: string
  showFolder: boolean
  active: boolean
  onOpen: () => void
}) {
  const unread = !message.seen
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        aria-current={active || undefined}
        className={cn(
          'relative flex w-full gap-3 px-4 py-3 text-left transition',
          active ? 'bg-neutral-100 dark:bg-neutral-800' : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/40',
        )}
      >
        {/* Markierung der geöffneten Mail */}
        {active && <span className="absolute inset-y-0 left-0 w-0.5 bg-neutral-900 dark:bg-white" />}
        {/* Punkt = ungelesen; in der Übersicht in der Kontofarbe */}
        <span
          className={cn(
            'mt-1.5 size-2 shrink-0 rounded-full',
            unread ? (showFolder ? color : 'bg-indigo-500') : 'bg-transparent',
          )}
          title={unread ? 'Ungelesen' : undefined}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span
              className={cn('truncate text-sm', unread ? 'font-semibold' : 'text-neutral-600 dark:text-neutral-400')}
              title={message.fromAddress}
            >
              {message.from}
            </span>
            <span className="ml-auto shrink-0 text-xs text-neutral-500 tabular-nums">{whenLabel(new Date(message.date))}</span>
          </div>
          <div
            className={cn(
              'truncate text-sm',
              unread ? 'text-neutral-800 dark:text-neutral-200' : 'text-neutral-500 dark:text-neutral-400',
            )}
          >
            {message.subject}
          </div>
          {/* In der Übersicht: aus welchem Ordner die Mail kommt */}
          {showFolder && (
            <span className="mt-1 inline-block rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
              {folderLabel(message.folder)}
            </span>
          )}
        </div>
      </button>
    </li>
  )
}

function AccountDialog({
  onClose,
  onSave,
}: {
  onClose: () => void
  onSave: (input: NewAccount) => Promise<void>
}) {
  const [providerId, setProviderId] = useState('gmail')
  const provider = providers.find((p) => p.id === providerId) ?? providers[0]
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [label, setLabel] = useState('')
  const [host, setHost] = useState('')
  const [port, setPort] = useState(993)
  const [user, setUser] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isCustom = provider.id === 'custom'

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await onSave({
        label: label.trim() || undefined,
        email: email.trim(),
        password,
        host: isCustom ? host.trim() : provider.host,
        port: isCustom ? port : provider.port,
        user: isCustom && user.trim() ? user.trim() : undefined,
        provider: provider.id,
        webmailUrl: provider.webmailUrl,
      })
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose()
      }}
    >
      <form
        onMouseDown={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-neutral-200 bg-white shadow-2xl dark:border-neutral-800 dark:bg-neutral-900"
      >
        <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-3.5 dark:border-neutral-800">
          <h2 className="text-sm font-semibold">Postfach einbinden</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg p-1.5 text-neutral-400 transition hover:bg-neutral-100 dark:hover:bg-neutral-800"
            aria-label="Schließen"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div>
            <span className="mb-1.5 block text-xs font-medium text-neutral-500">Anbieter</span>
            <div className="grid grid-cols-2 gap-1.5">
              {providers.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setProviderId(p.id)}
                  className={cn(
                    'rounded-lg border px-2.5 py-1.5 text-left text-sm transition',
                    providerId === p.id
                      ? 'border-neutral-900 font-medium dark:border-white'
                      : 'border-neutral-200 text-neutral-600 hover:border-neutral-300 dark:border-neutral-700 dark:text-neutral-300',
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <Field label="E-Mail-Adresse">
            <input
              autoFocus
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={cn(inputClass, 'w-full')}
            />
          </Field>

          {isCustom && (
            <>
              <div className="grid grid-cols-[1fr_6rem] gap-3">
                <Field label="IMAP-Server">
                  <input
                    required
                    value={host}
                    onChange={(e) => setHost(e.target.value)}
                    placeholder="imap.example.com"
                    className={cn(inputClass, 'w-full')}
                  />
                </Field>
                <Field label="Port">
                  <input
                    type="number"
                    value={port}
                    onChange={(e) => setPort(Number(e.target.value) || 993)}
                    className={cn(inputClass, 'w-full tabular-nums')}
                  />
                </Field>
              </div>
              <Field label="Benutzername (falls abweichend)">
                <input
                  value={user}
                  onChange={(e) => setUser(e.target.value)}
                  placeholder="meist die E-Mail-Adresse"
                  className={cn(inputClass, 'w-full')}
                />
              </Field>
            </>
          )}

          <Field label="Passwort / App-Passwort">
            <input
              type="password"
              required
              autoComplete="off"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={cn(inputClass, 'w-full')}
            />
          </Field>

          <p className="rounded-lg bg-neutral-50 px-3 py-2 text-xs text-neutral-600 dark:bg-neutral-800/60 dark:text-neutral-300">
            {provider.passwordHint}
            {provider.passwordUrl && (
              <>
                {' '}
                <a
                  href={provider.passwordUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                >
                  Hier anlegen
                </a>
              </>
            )}
          </p>

          <Field label="Anzeigename (optional)">
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="z. B. Privat, Arbeit"
              className={cn(inputClass, 'w-full')}
            />
          </Field>

          <p className="flex items-start gap-2 text-[11px] text-neutral-400">
            <ShieldCheck className="mt-px size-3.5 shrink-0" />
            Das Passwort bleibt auf diesem Rechner und wird mit deinem Windows-Konto verschlüsselt gespeichert.
            Übersichten ändern nichts im Postfach – erst beim Öffnen wird eine Mail als gelesen markiert.
          </p>

          {error && <ErrorBox text={error} />}
        </div>

        <div className="flex justify-end gap-2 border-t border-neutral-200 px-5 py-3.5 dark:border-neutral-800">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg border border-neutral-200 px-3 py-1.5 text-sm transition hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
          >
            Abbrechen
          </button>
          <button
            type="submit"
            disabled={busy}
            className="flex items-center gap-1.5 rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:opacity-60 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            {busy && <Loader2 className="size-4 animate-spin" />}
            {busy ? 'Verbinde…' : 'Verbinden'}
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
