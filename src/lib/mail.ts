import { useCallback, useEffect, useRef, useState } from 'react'

export interface MailAccount {
  id: string
  label: string
  email: string
  host: string
  port: number
  user: string
  provider: string
  webmailUrl?: string
  protection: 'dpapi' | 'plain'
}

export interface MailMessage {
  uid: number
  accountId: string
  folder: string
  seen: boolean
  from: string
  fromAddress: string
  subject: string
  date: string
  link?: string
}

export interface FolderStatus {
  path: string
  total: number
  error?: string
}

export interface AccountStatus {
  id: string
  unreadTotal: number
  /** Stand je gewähltem Ordner (aus der Übersicht). */
  folders?: FolderStatus[]
  error?: string
}

export interface MailFolder {
  path: string
  name: string
  specialUse?: string
  unseen: number
  total: number
}

export interface MailAttachment {
  index: number
  filename: string
  contentType: string
  size: number
}

export interface FullMessage {
  accountId: string
  folder: string
  uid: number
  subject: string
  from: string
  to: string
  cc: string
  date: string
  /** HTML-Fassung, falls vorhanden – wird abgeschottet angezeigt. */
  html: string | null
  text: string
  attachments: MailAttachment[]
  link?: string
}

export type MailRef = Pick<MailMessage, 'accountId' | 'folder' | 'uid'>

/** Welche Ordner eines Kontos in die Übersicht „Alle Konten“ gehören. */
export interface MailSource {
  accountId: string
  folders: string[]
}

export interface MailOverviewSettings {
  /** null = Posteingang aller Konten (Standard). */
  sources: MailSource[] | null
  /** Automatische Aktualisierung in Minuten. */
  intervalMin: number
}

export interface Provider {
  id: string
  label: string
  host: string
  port: number
  webmailUrl?: string
  /** Was man als Passwort eintragen muss. */
  passwordHint: string
  passwordUrl?: string
}

export const providers: Provider[] = [
  {
    id: 'gmail',
    label: 'Gmail',
    host: 'imap.gmail.com',
    port: 993,
    webmailUrl: 'https://mail.google.com/',
    passwordHint:
      'Gmail braucht ein App-Passwort (16 Zeichen), nicht dein normales Passwort. Voraussetzung: Bestätigung in zwei Schritten ist aktiv.',
    passwordUrl: 'https://myaccount.google.com/apppasswords',
  },
  {
    id: 'gmx',
    label: 'GMX',
    host: 'imap.gmx.net',
    port: 993,
    webmailUrl: 'https://www.gmx.net/',
    passwordHint:
      'In den GMX-Einstellungen unter „E-Mail empfangen → POP3/IMAP Abruf“ den Zugriff erlauben. Dann dein GMX-Passwort (bzw. App-Passwort bei Zwei-Faktor).',
  },
  {
    id: 'webde',
    label: 'WEB.DE',
    host: 'imap.web.de',
    port: 993,
    webmailUrl: 'https://web.de/',
    passwordHint:
      'In den WEB.DE-Einstellungen unter „E-Mail empfangen → POP3/IMAP Abruf“ den Zugriff erlauben. Dann dein WEB.DE-Passwort (bzw. App-Passwort bei Zwei-Faktor).',
  },
  {
    id: 'outlook',
    label: 'Outlook / Hotmail',
    host: 'outlook.office365.com',
    port: 993,
    webmailUrl: 'https://outlook.live.com/mail/',
    passwordHint:
      'Microsoft lässt Passwort-Anmeldungen per IMAP kaum noch zu. Klappt nur, wenn dein Konto ein App-Passwort erlaubt.',
  },
  {
    id: 'icloud',
    label: 'iCloud',
    host: 'imap.mail.me.com',
    port: 993,
    webmailUrl: 'https://www.icloud.com/mail',
    passwordHint: 'iCloud braucht ein app-spezifisches Passwort aus deinem Apple-Account.',
    passwordUrl: 'https://account.apple.com/',
  },
  {
    id: 'tonline',
    label: 'T-Online',
    host: 'secureimap.t-online.de',
    port: 993,
    webmailUrl: 'https://email.t-online.de/',
    passwordHint: 'Das separate E-Mail-Passwort aus dem Telekom-Kundencenter – nicht das Login-Passwort.',
  },
  {
    id: 'yahoo',
    label: 'Yahoo',
    host: 'imap.mail.yahoo.com',
    port: 993,
    webmailUrl: 'https://mail.yahoo.com/',
    passwordHint: 'Yahoo braucht ein App-Passwort aus den Kontosicherheits-Einstellungen.',
  },
  {
    id: 'custom',
    label: 'Anderer Anbieter',
    host: '',
    port: 993,
    passwordHint: 'IMAP-Server und Port findest du in der Hilfe deines Anbieters.',
  },
]

/** Identitätsfarben für Konten – feste Reihenfolge, nicht zyklisch. */
const accountColors = [
  'bg-indigo-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-sky-500',
  'bg-rose-500',
  'bg-fuchsia-500',
]

export function accountColor(index: number): string {
  return accountColors[index] ?? 'bg-neutral-400'
}

/** Anzeigename eines Ordnerpfads – „INBOX“ heißt Posteingang, sonst der letzte Teil. */
export function folderLabel(path: string): string {
  if (path.toUpperCase() === 'INBOX') return 'Posteingang'
  return path.split(/[/.]/).pop() || path
}

export interface NewAccount {
  label?: string
  email: string
  host: string
  port: number
  user?: string
  password: string
  provider: string
  webmailUrl?: string
}

const HEADERS = { 'X-Requested-With': 'management-tool' }

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...HEADERS, ...init?.headers },
  })
  const data = (await res.json().catch(() => ({}))) as { error?: string }
  if (!res.ok) throw new Error(data.error || `Fehler ${res.status}`)
  return data as T
}

const refQuery = (m: MailRef) =>
  `account=${encodeURIComponent(m.accountId)}&folder=${encodeURIComponent(m.folder)}&uid=${m.uid}`

export const fetchFolders = (accountId: string) =>
  api<MailFolder[]>(`/api/mail/folders?account=${encodeURIComponent(accountId)}`)

/** Ganze Mail laden; `markSeen` markiert sie dabei als gelesen. */
export const fetchMessage = (m: MailRef, markSeen = true) =>
  api<FullMessage>(`/api/mail/message?${refQuery(m)}&seen=${markSeen ? 1 : 0}`)

export const setSeen = (m: MailRef, seen: boolean) =>
  api('/api/mail/flags', { method: 'POST', body: JSON.stringify({ ...m, seen }) })

export async function downloadAttachment(m: MailRef, att: MailAttachment) {
  const res = await fetch(`/api/mail/attachment?${refQuery(m)}&index=${att.index}`, { headers: HEADERS })
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(data.error || `„${att.filename}“ konnte nicht geladen werden.`)
  }
  const url = URL.createObjectURL(await res.blob())
  const a = document.createElement('a')
  a.href = url
  a.download = att.filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

interface OverviewResponse {
  fetchedAt: string
  accounts: Array<{ id: string; total: number; folders: FolderStatus[]; error?: string }>
  messages: MailMessage[]
}

const overview = (sources: MailSource[] | null, unreadOnly: boolean, limit: number) =>
  api<OverviewResponse>('/api/mail/overview', {
    method: 'POST',
    body: JSON.stringify({ sources: sources ?? undefined, unreadOnly, limit }),
  })

// ---------- Auswahl für die Übersicht ----------

const OVERVIEW_KEY = 'mt.mailOverview'
/** 0 = nur per Knopfdruck (Standard), sonst Minuten. */
export const INTERVAL_OPTIONS = [0, 1, 2, 5, 10, 15, 30]
const defaultOverview: MailOverviewSettings = { sources: null, intervalMin: 0 }

function loadOverview(): MailOverviewSettings {
  try {
    const raw = localStorage.getItem(OVERVIEW_KEY)
    if (raw) return { ...defaultOverview, ...(JSON.parse(raw) as Partial<MailOverviewSettings>) }
  } catch {
    /* Storage kann blockiert sein */
  }
  return defaultOverview
}

export function useMailOverview() {
  const [settings, setSettings] = useState<MailOverviewSettings>(loadOverview)
  const save = useCallback((next: MailOverviewSettings) => {
    setSettings(next)
    try {
      localStorage.setItem(OVERVIEW_KEY, JSON.stringify(next))
    } catch {
      /* ignorieren */
    }
  }, [])
  return { settings, save }
}

// ---------- Hooks ----------

/** Konten und die ungelesenen Mails der gewählten Quellen (Standard: alle Posteingänge). */
export function useMail(settings: MailOverviewSettings) {
  const [accounts, setAccounts] = useState<MailAccount[]>([])
  const [status, setStatus] = useState<Record<string, AccountStatus>>({})
  const [messages, setMessages] = useState<MailMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fetchedAt, setFetchedAt] = useState<Date | null>(null)
  const busy = useRef(false)
  const lastFetch = useRef(0)

  const refresh = useCallback(async () => {
    if (busy.current) return
    busy.current = true
    setLoading(true)
    setError(null)
    try {
      const data = await overview(settings.sources, true, 50)
      setStatus(
        Object.fromEntries(
          data.accounts.map((a) => [a.id, { id: a.id, unreadTotal: a.total, folders: a.folders, error: a.error }]),
        ),
      )
      setMessages(data.messages)
      setFetchedAt(new Date(data.fetchedAt))
      lastFetch.current = Date.now()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      busy.current = false
      setLoading(false)
    }
  }, [settings.sources])

  const loadAccounts = useCallback(async () => {
    try {
      const list = await api<MailAccount[]>('/api/mail/accounts')
      setAccounts(list)
      return list
    } catch (err) {
      setError((err as Error).message)
      return []
    }
  }, [])

  // Beim Öffnen und bei geänderter Auswahl einmal laden; danach nur im gewählten Takt (0 = nur per Knopfdruck)
  useEffect(() => {
    void loadAccounts().then((list) => {
      if (list.length > 0) void refresh()
    })
    if (settings.intervalMin <= 0) return
    const id = setInterval(() => void refresh(), settings.intervalMin * 60_000)
    return () => clearInterval(id)
  }, [loadAccounts, refresh, settings.intervalMin])

  // Zurück ins Fenster: nachholen, wenn der letzte Abruf über eine Minute her ist – nicht im Knopfdruck-Modus
  useEffect(() => {
    if (settings.intervalMin <= 0) return
    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastFetch.current > 60_000) void refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [refresh, settings.intervalMin])

  const addAccount = useCallback(
    async (input: NewAccount) => {
      await api<MailAccount>('/api/mail/accounts', { method: 'POST', body: JSON.stringify(input) })
      await loadAccounts()
      await refresh()
    },
    [loadAccounts, refresh],
  )

  const removeAccount = useCallback(
    async (id: string) => {
      await api(`/api/mail/accounts/${id}`, { method: 'DELETE' })
      setMessages((prev) => prev.filter((m) => m.accountId !== id))
      await loadAccounts()
    },
    [loadAccounts],
  )

  /** Nach dem Öffnen: Mail aus „ungelesen“ nehmen, ohne neu abzufragen. */
  const markLocal = useCallback(
    (m: MailRef, seen: boolean) => {
      if (!seen) {
        void refresh()
        return
      }
      let removed = false
      setMessages((prev) =>
        prev.filter((x) => {
          const hit = x.accountId === m.accountId && x.uid === m.uid && x.folder === m.folder
          if (hit) removed = true
          return !hit
        }),
      )
      setStatus((prev) => {
        const s = prev[m.accountId]
        if (!s || !removed) return prev
        return {
          ...prev,
          [m.accountId]: {
            ...s,
            unreadTotal: Math.max(0, s.unreadTotal - 1),
            folders: s.folders?.map((f) => (f.path === m.folder ? { ...f, total: Math.max(0, f.total - 1) } : f)),
          },
        }
      })
    },
    [refresh],
  )

  return { accounts, status, messages, loading, error, fetchedAt, refresh, addAccount, removeAccount, markLocal }
}

interface MailboxQuery {
  /** null = Übersicht über die gewählten Quellen. */
  accountId: string | null
  folder: string
  unreadOnly: boolean
  limit: number
  enabled: boolean
  sources: MailSource[] | null
}

/** Mails eines Ordners – oder aller gewählten Quellen – gelesen und ungelesen. */
export function useMailbox({ accountId, folder, unreadOnly, limit, enabled, sources }: MailboxQuery) {
  const [messages, setMessages] = useState<MailMessage[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Nur die jüngste Anfrage zählt – schnelles Ordnerwechseln soll nichts durcheinanderbringen
  const request = useRef(0)

  const reload = useCallback(async () => {
    if (!enabled) return
    const id = ++request.current
    setLoading(true)
    setError(null)
    try {
      let data: { accounts: Array<{ id: string; total: number; error?: string }>; messages: MailMessage[] }
      if (accountId) {
        const params = new URLSearchParams({
          account: accountId,
          folder,
          filter: unreadOnly ? 'unread' : 'all',
          limit: String(limit),
        })
        data = await api(`/api/mail/list?${params}`)
      } else {
        data = await overview(sources, unreadOnly, limit)
      }
      if (id !== request.current) return
      setMessages(data.messages)
      setTotal(data.accounts.reduce((sum, a) => sum + a.total, 0))
      const errors = data.accounts.filter((a) => a.error).map((a) => a.error)
      setError(errors.length ? errors.join(' · ') : null)
    } catch (err) {
      if (id === request.current) setError((err as Error).message)
    } finally {
      if (id === request.current) setLoading(false)
    }
  }, [accountId, folder, unreadOnly, limit, enabled, sources])

  useEffect(() => {
    void reload()
  }, [reload])

  const patch = useCallback((m: MailRef, changes: Partial<MailMessage>) => {
    setMessages((prev) =>
      prev.map((x) => (x.accountId === m.accountId && x.folder === m.folder && x.uid === m.uid ? { ...x, ...changes } : x)),
    )
  }, [])

  return { messages, total, loading, error, reload, patch }
}
