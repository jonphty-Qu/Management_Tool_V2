import type { Plugin } from 'vite'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { execFile } from 'node:child_process'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { ImapFlow } from 'imapflow'
import { simpleParser, type AddressObject } from 'mailparser'

/**
 * Lokale Mail-Schnittstelle: liest ungelesene Mails per IMAP (nur lesend).
 * Läuft als Middleware im Vite-Server – kein eigener Prozess nötig.
 */

interface StoredAccount {
  id: string
  label: string
  email: string
  host: string
  port: number
  user: string
  provider: string
  webmailUrl?: string
  /** Passwort – unter Windows per DPAPI an das Benutzerkonto gebunden verschlüsselt. */
  secret: string
  protection: 'dpapi' | 'plain'
}

interface MailSummary {
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

interface AccountResult {
  id: string
  unreadTotal: number
  error?: string
}

const MAX_PER_ACCOUNT = 50
const HEADER_NAME = 'x-requested-with'
const HEADER_VALUE = 'management-tool'

let accountsFile = path.resolve(process.cwd(), 'data', 'mail-accounts.json')
const passwordCache = new Map<string, string>()
let inflight: Promise<unknown> | null = null

// ---------- Speicherung ----------

async function readAccounts(): Promise<StoredAccount[]> {
  try {
    return JSON.parse(await fs.readFile(accountsFile, 'utf8')) as StoredAccount[]
  } catch {
    return []
  }
}

async function writeAccounts(accounts: StoredAccount[]) {
  await fs.mkdir(path.dirname(accountsFile), { recursive: true })
  const tmp = `${accountsFile}.tmp`
  await fs.writeFile(tmp, JSON.stringify(accounts, null, 2), 'utf8')
  await fs.rename(tmp, accountsFile)
}

function publicView(a: StoredAccount) {
  const { secret: _secret, ...rest } = a
  return rest
}

// ---------- Verschlüsselung (Windows DPAPI) ----------

function runPowerShell(script: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', script],
      { windowsHide: true, timeout: 20_000 },
      (err, stdout, stderr) => {
        if (err) reject(new Error(stderr?.toString().trim() || err.message))
        else resolve(stdout.toString().trim())
      },
    )
  })
}

// Base64 enthält nur [A-Za-z0-9+/=] – sicher in einfachen Anführungszeichen
const dpapi = (op: 'Protect' | 'Unprotect', b64: string) =>
  runPowerShell(
    `Add-Type -AssemblyName System.Security; [Convert]::ToBase64String([Security.Cryptography.ProtectedData]::${op}([Convert]::FromBase64String('${b64}'), $null, 'CurrentUser'))`,
  )

async function protect(plain: string): Promise<Pick<StoredAccount, 'secret' | 'protection'>> {
  const b64 = Buffer.from(plain, 'utf8').toString('base64')
  if (process.platform !== 'win32') return { secret: b64, protection: 'plain' }
  return { secret: await dpapi('Protect', b64), protection: 'dpapi' }
}

async function passwordOf(acc: StoredAccount): Promise<string> {
  const cached = passwordCache.get(acc.id)
  if (cached) return cached
  const b64 = acc.protection === 'dpapi' ? await dpapi('Unprotect', acc.secret) : acc.secret
  const plain = Buffer.from(b64, 'base64').toString('utf8')
  passwordCache.set(acc.id, plain)
  return plain
}

// ---------- IMAP ----------

async function withClient<T>(
  acc: Pick<StoredAccount, 'host' | 'port' | 'user'>,
  pass: string,
  fn: (client: ImapFlow) => Promise<T>,
): Promise<T> {
  const client = new ImapFlow({
    host: acc.host,
    port: acc.port,
    secure: acc.port === 993,
    auth: { user: acc.user, pass },
    logger: false,
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000,
  })
  // Verbindungsabbrüche nicht als unbehandelten Fehler den Server killen lassen
  client.on('error', () => {})
  await client.connect()
  try {
    return await fn(client)
  } finally {
    await client.logout().catch(() => client.close())
  }
}

function explain(err: unknown, host: string): string {
  const e = err as {
    authenticationFailed?: boolean
    code?: string
    message?: string
    responseText?: string
    serverResponseCode?: string
  }
  if (e?.authenticationFailed) {
    const hint = host.includes('gmail')
      ? 'Anmeldung fehlgeschlagen. Gmail braucht ein App-Passwort – nicht dein normales Google-Passwort.'
      : host.includes('web.de') || host.includes('gmx')
        ? 'Anmeldung fehlgeschlagen. In den Einstellungen unter „E-Mail empfangen → POP3/IMAP Abruf“ den Zugriff erlauben und speichern. Mit Zwei-Faktor-Anmeldung ein anwendungsspezifisches Passwort verwenden.'
        : 'Anmeldung fehlgeschlagen. E-Mail und Passwort prüfen – viele Anbieter verlangen ein App-Passwort bzw. freigeschaltetes IMAP.'
    // Die Antwort des Servers zeigt die eigentliche Ursache (z. B. IMAP gesperrt oder Passwort falsch)
    const detail = [e.serverResponseCode, e.responseText?.trim()].filter(Boolean).join(' ')
    return detail ? `${hint} Antwort des Servers: ${detail}` : hint
  }
  if (e?.code === 'ENOTFOUND') return `Server „${host}“ nicht gefunden.`
  if (e?.code === 'ECONNREFUSED' || e?.code === 'ETIMEDOUT' || e?.code === 'ECONNRESET') {
    return `Keine Verbindung zu „${host}“.`
  }
  return e?.responseText || e?.message || 'Unbekannter Fehler'
}

function messageLink(acc: StoredAccount, messageId?: string): string | undefined {
  if (acc.host.includes('gmail') && messageId) {
    const id = messageId.replace(/^<|>$/g, '')
    return `https://mail.google.com/mail/u/${encodeURIComponent(acc.email)}/#search/rfc822msgid%3A${encodeURIComponent(id)}`
  }
  return acc.webmailUrl
}

const MAX_MESSAGE_BYTES = 25 * 1024 * 1024
const INLINE_IMAGE_BYTES = 2 * 1024 * 1024

class MailError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

async function accountById(id: string | null): Promise<StoredAccount> {
  const acc = (await readAccounts()).find((a) => a.id === id)
  if (!acc) throw new MailError(404, 'Konto nicht gefunden.')
  return acc
}

/** Neueste Mails eines Ordners über eine bestehende Verbindung – nur lesend, ändert keine Flags. */
async function readFolder(
  client: ImapFlow,
  acc: StoredAccount,
  folder: string,
  unreadOnly: boolean,
  limit: number,
): Promise<{ total: number; messages: MailSummary[] }> {
  const lock = await client.getMailboxLock(folder, { readOnly: true })
  try {
    const found = (await client.search(unreadOnly ? { seen: false } : { all: true }, { uid: true })) || []
    const uids = found.slice(-limit)
    const messages: MailSummary[] = []
    if (uids.length > 0) {
      for await (const msg of client.fetch(
        uids,
        { uid: true, envelope: true, flags: true, internalDate: true },
        { uid: true },
      )) {
        const sender = msg.envelope?.from?.[0]
        const date = msg.envelope?.date ?? msg.internalDate
        messages.push({
          uid: msg.uid,
          accountId: acc.id,
          folder,
          seen: msg.flags?.has('\\Seen') ?? false,
          from: sender?.name || sender?.address || 'Unbekannt',
          fromAddress: sender?.address ?? '',
          subject: msg.envelope?.subject || '(kein Betreff)',
          date: (date instanceof Date ? date : new Date(date ?? Date.now())).toISOString(),
          link: messageLink(acc, msg.envelope?.messageId),
        })
      }
    }
    messages.sort((a, b) => b.date.localeCompare(a.date))
    return { total: found.length, messages }
  } finally {
    lock.release()
  }
}

async function listFolder(
  acc: StoredAccount,
  folder: string,
  unreadOnly: boolean,
  limit: number,
): Promise<{ total: number; messages: MailSummary[] }> {
  const pass = await passwordOf(acc)
  return withClient(acc, pass, (client) => readFolder(client, acc, folder, unreadOnly, limit))
}

interface FolderResult {
  path: string
  total: number
  error?: string
}

/** Mehrere Ordner eines Kontos über eine Verbindung – ein fehlender Ordner bremst die anderen nicht aus. */
async function overviewAccount(
  acc: StoredAccount,
  folders: string[],
  unreadOnly: boolean,
  limit: number,
): Promise<{ folders: FolderResult[]; messages: MailSummary[] }> {
  const pass = await passwordOf(acc)
  return withClient(acc, pass, async (client) => {
    const results: FolderResult[] = []
    const messages: MailSummary[] = []
    for (const folder of folders) {
      try {
        const r = await readFolder(client, acc, folder, unreadOnly, limit)
        results.push({ path: folder, total: r.total })
        messages.push(...r.messages)
      } catch (err) {
        results.push({ path: folder, total: 0, error: explain(err, acc.host) })
      }
    }
    return { folders: results, messages }
  })
}

/** Übersicht über frei gewählte Konten und Ordner; ohne Auswahl der Posteingang aller Konten. */
async function overviewRoute(body: Record<string, unknown>): Promise<{ status: number; body: unknown }> {
  const accounts = await readAccounts()
  const unreadOnly = body.unreadOnly !== false
  const limit = Math.min(Math.max(Number(body.limit) || MAX_PER_ACCOUNT, 10), 500)
  const requested = Array.isArray(body.sources) ? (body.sources as unknown[]) : null
  const plan = (requested ?? accounts.map((a) => ({ accountId: a.id, folders: ['INBOX'] })))
    .map((raw) => {
      const src = raw as { accountId?: unknown; folders?: unknown }
      const acc = accounts.find((a) => a.id === src.accountId)
      const folders = Array.isArray(src.folders)
        ? [...new Set(src.folders.filter((f): f is string => typeof f === 'string' && f.length > 0 && f.length <= 500))].slice(0, 30)
        : []
      return acc && folders.length ? { acc, folders } : null
    })
    .filter((x): x is { acc: StoredAccount; folders: string[] } => x !== null)

  const settled = await Promise.allSettled(plan.map((x) => overviewAccount(x.acc, x.folders, unreadOnly, limit)))
  const out: Array<{ id: string; total: number; folders: FolderResult[]; error?: string }> = []
  const messages: MailSummary[] = []
  settled.forEach((r, i) => {
    const { acc } = plan[i]
    if (r.status === 'fulfilled') {
      out.push({ id: acc.id, total: r.value.folders.reduce((sum, f) => sum + f.total, 0), folders: r.value.folders })
      messages.push(...r.value.messages)
    } else {
      // Bei Anmeldefehlern das gecachte Passwort verwerfen
      passwordCache.delete(acc.id)
      out.push({ id: acc.id, total: 0, folders: [], error: explain(r.reason, acc.host) })
    }
  })
  messages.sort((a, b) => b.date.localeCompare(a.date))
  return { status: 200, body: { fetchedAt: new Date().toISOString(), accounts: out, messages } }
}

/** Ergebnisse mehrerer Konten zusammenführen – ein fehlerhaftes Konto bremst die anderen nicht aus. */
async function collect(accounts: StoredAccount[], folder: string, unreadOnly: boolean, limit: number) {
  const results = await Promise.allSettled(accounts.map((a) => listFolder(a, folder, unreadOnly, limit)))
  const status: Array<{ id: string; total: number; error?: string }> = []
  const messages: MailSummary[] = []
  results.forEach((r, i) => {
    const acc = accounts[i]
    if (r.status === 'fulfilled') {
      status.push({ id: acc.id, total: r.value.total })
      messages.push(...r.value.messages)
    } else {
      // Bei Anmeldefehlern das gecachte Passwort verwerfen
      passwordCache.delete(acc.id)
      status.push({ id: acc.id, total: 0, error: explain(r.reason, acc.host) })
    }
  })
  messages.sort((a, b) => b.date.localeCompare(a.date))
  return { fetchedAt: new Date().toISOString(), accounts: status, messages }
}

async function collectUnread() {
  const result = await collect(await readAccounts(), 'INBOX', true, MAX_PER_ACCOUNT)
  const accounts: AccountResult[] = result.accounts.map((a) => ({ id: a.id, unreadTotal: a.total, error: a.error }))
  return { ...result, accounts }
}

// ---------- Ordner und einzelne Mails ----------

interface FolderInfo {
  path: string
  name: string
  specialUse?: string
  unseen: number
  total: number
}

const specialOrder = ['\\Sent', '\\Drafts', '\\Archive', '\\All', '\\Flagged', '\\Junk', '\\Trash']

async function listFolders(acc: StoredAccount): Promise<FolderInfo[]> {
  const pass = await passwordOf(acc)
  return withClient(acc, pass, async (client) => {
    const boxes = await client.list({ statusQuery: { messages: true, unseen: true } })
    const isInbox = (path: string) => path.toUpperCase() === 'INBOX'
    // Posteingang zuerst, dann eigene Ordner (z. B. „Freunde & Bekannte“), dann Systemordner
    const rank = (f: FolderInfo) =>
      isInbox(f.path) ? 0 : !f.specialUse || f.specialUse === '\\Inbox' ? 1 : 2 + Math.max(0, specialOrder.indexOf(f.specialUse))
    return boxes
      .filter((b) => !b.flags?.has('\\Noselect'))
      .map((b) => ({
        path: b.path,
        name: isInbox(b.path) ? 'Posteingang' : b.name,
        specialUse: b.specialUse,
        unseen: b.status?.unseen ?? 0,
        total: b.status?.messages ?? 0,
      }))
      .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, 'de'))
  })
}

/** Rohquelle einer Mail laden; `markSeen` setzt danach das Gelesen-Flag. */
async function downloadMessage(acc: StoredAccount, folder: string, uid: number, markSeen: boolean): Promise<Buffer> {
  const pass = await passwordOf(acc)
  return withClient(acc, pass, async (client) => {
    const lock = await client.getMailboxLock(folder, { readOnly: !markSeen })
    try {
      const meta = await client.fetchOne(String(uid), { uid: true, size: true }, { uid: true })
      if (!meta) throw new MailError(404, 'Mail nicht gefunden – vielleicht verschoben oder gelöscht.')
      if ((meta.size ?? 0) > MAX_MESSAGE_BYTES) {
        throw new MailError(413, 'Die Mail ist zu groß zum Anzeigen (über 25 MB). Bitte im Postfach öffnen.')
      }
      const { content } = await client.download(String(uid), undefined, { uid: true })
      const chunks: Buffer[] = []
      for await (const chunk of content) chunks.push(chunk as Buffer)
      if (markSeen) await client.messageFlagsAdd(String(uid), ['\\Seen'], { uid: true })
      return Buffer.concat(chunks)
    } finally {
      lock.release()
    }
  })
}

function addressText(a?: AddressObject | AddressObject[]): string {
  if (!a) return ''
  return (Array.isArray(a) ? a : [a]).map((x) => x.text).join(', ')
}

async function messageView(acc: StoredAccount, folder: string, uid: number, markSeen: boolean) {
  const parsed = await simpleParser(await downloadMessage(acc, folder, uid, markSeen))
  let html = typeof parsed.html === 'string' ? parsed.html : null
  // Eingebettete Bilder (cid:) direkt einsetzen – sie gehören zur Mail, nicht ins Internet
  if (html) {
    for (const att of parsed.attachments) {
      if (att.cid && att.contentType.startsWith('image/') && att.size <= INLINE_IMAGE_BYTES) {
        html = html.split(`cid:${att.cid}`).join(`data:${att.contentType};base64,${att.content.toString('base64')}`)
      }
    }
  }
  return {
    accountId: acc.id,
    folder,
    uid,
    subject: parsed.subject || '(kein Betreff)',
    from: addressText(parsed.from),
    to: addressText(parsed.to),
    cc: addressText(parsed.cc),
    date: (parsed.date ?? new Date()).toISOString(),
    html,
    text: parsed.text ?? '',
    attachments: parsed.attachments
      .map((att, index) => ({ att, index }))
      .filter(({ att }) => !att.related)
      .map(({ att, index }) => ({
        index,
        filename: att.filename || `Anhang ${index + 1}`,
        contentType: att.contentType,
        size: att.size,
      })),
    link: messageLink(acc, parsed.messageId),
  }
}

async function setSeen(acc: StoredAccount, folder: string, uid: number, seen: boolean) {
  const pass = await passwordOf(acc)
  await withClient(acc, pass, async (client) => {
    const lock = await client.getMailboxLock(folder)
    try {
      if (seen) await client.messageFlagsAdd(String(uid), ['\\Seen'], { uid: true })
      else await client.messageFlagsRemove(String(uid), ['\\Seen'], { uid: true })
    } finally {
      lock.release()
    }
  })
}

// ---------- HTTP ----------

function send(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(body))
}

async function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    size += (chunk as Buffer).length
    if (size > 64 * 1024) throw new Error('Anfrage zu groß')
    chunks.push(chunk as Buffer)
  }
  return chunks.length ? (JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>) : {}
}

async function addAccount(body: Record<string, unknown>) {
  const str = (key: string) => (typeof body[key] === 'string' ? (body[key] as string).trim() : '')
  const email = str('email')
  const host = str('host')
  const password = typeof body.password === 'string' ? body.password : ''
  const port = Number(body.port) || 993
  if (!email || !host || !password) return { status: 400, body: { error: 'E-Mail, Server und Passwort sind nötig.' } }

  const accounts = await readAccounts()
  if (accounts.some((a) => a.email.toLowerCase() === email.toLowerCase() && a.host === host)) {
    return { status: 409, body: { error: 'Dieses Konto ist schon eingebunden.' } }
  }

  const account: Omit<StoredAccount, 'secret' | 'protection'> = {
    id: randomUUID(),
    label: str('label') || email,
    email,
    host,
    port,
    user: str('user') || email,
    provider: str('provider') || 'custom',
    webmailUrl: str('webmailUrl') || undefined,
  }

  // Erst anmelden, dann speichern – so landen nur funktionierende Konten in der Liste
  try {
    await withClient(account, password, async () => undefined)
  } catch (err) {
    return { status: 422, body: { error: explain(err, host) } }
  }

  const stored: StoredAccount = { ...account, ...(await protect(password)) }
  passwordCache.set(stored.id, password)
  await writeAccounts([...accounts, stored])
  return { status: 201, body: publicView(stored) }
}

// ---------- Suche für den E-Mail-Verlauf einer Bewerbung ----------

interface MailHit {
  accountId: string
  uid: number
  folder: string
  direction: 'in' | 'out'
  messageId?: string
  from: string
  fromAddress: string
  subject: string
  date: string
  snippet: string
  rejection: boolean
  invitation: boolean
  link?: string
}

const REJECTION =
  /(leider|absage|nicht berücksichtig|nicht weiter berücksichtig|anderen? (kandidat|bewerber)|für eine?n? andere|unfortunately|regret to inform|not (be )?mov(e|ing) forward|other candidates|decided not to)/i
const INVITATION =
  /(einladung|vorstellungsgespräch|kennenlerngespräch|bewerbungsgespräch|interview|invite you|invitation)/i

interface StructureNode {
  part?: string
  type?: string
  childNodes?: StructureNode[]
}

function findPart(node: StructureNode | undefined, type: string): StructureNode | null {
  if (!node) return null
  if (node.childNodes?.length) {
    for (const child of node.childNodes) {
      const found = findPart(child, type)
      if (found) return found
    }
    return null
  }
  return node.type === type ? node : null
}

/** Textauszug einer Mail: erster text/plain-Teil, sonst HTML ohne Tags; Zitate abgeschnitten. */
async function readSnippet(client: ImapFlow, uid: number, structure: unknown): Promise<string> {
  const root = structure as StructureNode | undefined
  const plain = findPart(root, 'text/plain')
  const html = plain ? null : findPart(root, 'text/html')
  const node = plain ?? html
  if (!node) return ''
  const { content } = await client.download(String(uid), node.part ?? '1', { uid: true })
  const chunks: Buffer[] = []
  for await (const chunk of content) chunks.push(chunk as Buffer)
  let text = Buffer.concat(chunks).toString('utf8')
  if (html) {
    text = text
      .replace(/<(style|script)[\s\S]*?<\/\1>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|tr)>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
  }
  // Zitierte Vorgeschichte abschneiden
  text = text.split(/\n(?:>|Am .{5,120} schrieb|On .{5,120} wrote|-----Original)/)[0]
  return text.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, 1500)
}

async function searchAccount(
  acc: StoredAccount,
  terms: string[],
  domains: string[],
  since: Date,
): Promise<MailHit[]> {
  const pass = await passwordOf(acc)
  return withClient(acc, pass, async (client) => {
    const boxes = await client.list()
    const all = boxes.find((b) => b.specialUse === '\\All')?.path
    const sent = boxes.find((b) => b.specialUse === '\\Sent')?.path
    // Gmail: "Alle Nachrichten" enthält auch archivierte und gesendete Mails
    const targets = all ? [all] : [...new Set(['INBOX', ...(sent ? [sent] : [])])]

    const or: Array<Record<string, string>> = []
    for (const d of domains) or.push({ from: d }, { to: d })
    for (const t of terms) or.push({ subject: t }, { from: t }, { to: t })
    const query = (or.length === 1 ? { ...or[0], since } : { or, since }) as Parameters<ImapFlow['search']>[0]

    const own = acc.email.toLowerCase()
    const hits: MailHit[] = []
    for (const folder of targets) {
      const lock = await client.getMailboxLock(folder, { readOnly: true })
      try {
        const found = (await client.search(query, { uid: true })) || []
        const uids = found.slice(-25)
        if (uids.length === 0) continue
        const messages = []
        for await (const msg of client.fetch(
          uids,
          { uid: true, envelope: true, bodyStructure: true, internalDate: true },
          { uid: true },
        )) {
          messages.push(msg)
        }
        // Inhalte erst nach der FETCH-Schleife laden – mittendrin verträgt imapflow keine Befehle
        for (const msg of messages) {
          const env = msg.envelope
          const sender = env?.from?.[0]
          const outgoing = (sender?.address ?? '').toLowerCase() === own
          const person = outgoing ? env?.to?.[0] : sender
          const subject = env?.subject || '(kein Betreff)'
          const snippet = await readSnippet(client, msg.uid, msg.bodyStructure).catch(() => '')
          const probe = `${subject}\n${snippet}`
          const date = env?.date ?? msg.internalDate
          hits.push({
            accountId: acc.id,
            uid: msg.uid,
            folder,
            direction: outgoing ? 'out' : 'in',
            messageId: env?.messageId,
            from: person?.name || person?.address || 'Unbekannt',
            fromAddress: person?.address ?? '',
            subject,
            date: (date instanceof Date ? date : new Date(date ?? Date.now())).toISOString(),
            snippet,
            rejection: !outgoing && REJECTION.test(probe),
            invitation: !outgoing && INVITATION.test(probe),
            link: messageLink(acc, env?.messageId),
          })
        }
      } finally {
        lock.release()
      }
    }
    return hits
  })
}

async function searchRoute(body: Record<string, unknown>): Promise<{ status: number; body: unknown }> {
  const list = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])
  const terms = list(body.terms)
    .map((t) => t.trim().slice(0, 80))
    .filter((t) => t.length >= 3)
    .slice(0, 5)
  const domains = list(body.domains)
    .map((d) => d.trim().toLowerCase())
    .filter((d) => /^[a-z0-9.-]+\.[a-z]{2,}$/.test(d))
    .slice(0, 5)
  if (!terms.length && !domains.length) {
    return { status: 400, body: { error: 'Keine Suchbegriffe – Unternehmen oder Firmen-Link fehlt.' } }
  }

  const accounts = await readAccounts()
  if (!accounts.length) return { status: 409, body: { error: 'Noch kein Postfach eingebunden.' } }

  const since = new Date(Date.now() - 365 * 86_400_000)
  const settled = await Promise.allSettled(accounts.map((a) => searchAccount(a, terms, domains, since)))
  const results: MailHit[] = []
  const errors: Array<{ accountId: string; error: string }> = []
  settled.forEach((r, i) => {
    if (r.status === 'fulfilled') results.push(...r.value)
    else errors.push({ accountId: accounts[i].id, error: `${accounts[i].label}: ${explain(r.reason, accounts[i].host)}` })
  })
  results.sort((a, b) => b.date.localeCompare(a.date))
  return { status: 200, body: { results, errors } }
}

async function handle(req: IncomingMessage, res: ServerResponse, next: () => void) {
  const url = new URL(req.url ?? '/', 'http://localhost')
  if (!url.pathname.startsWith('/api/mail')) return next()

  // Eigener Header erzwingt bei fremden Seiten einen CORS-Preflight, der scheitert
  if (req.headers[HEADER_NAME] !== HEADER_VALUE) return send(res, 403, { error: 'Nicht erlaubt' })

  try {
    if (req.method === 'POST' && url.pathname === '/api/mail/search') {
      const result = await searchRoute(await readBody(req))
      return send(res, result.status, result.body)
    }

    const q = url.searchParams
    const folder = (q.get('folder') || 'INBOX').slice(0, 500)
    const uid = Number(q.get('uid'))
    const requireUid = () => {
      if (!Number.isInteger(uid) || uid <= 0) throw new MailError(400, 'Ungültige Mail.')
    }

    if (req.method === 'GET' && url.pathname === '/api/mail/folders') {
      return send(res, 200, await listFolders(await accountById(q.get('account'))))
    }

    if (req.method === 'GET' && url.pathname === '/api/mail/list') {
      const limit = Math.min(Math.max(Number(q.get('limit')) || 50, 10), 500)
      const one = q.get('account')
      // Ohne Konto: Posteingang aller Konten; mit Konto: der gewählte Ordner
      const accounts = one ? [await accountById(one)] : await readAccounts()
      return send(res, 200, await collect(accounts, one ? folder : 'INBOX', q.get('filter') === 'unread', limit))
    }

    if (req.method === 'POST' && url.pathname === '/api/mail/overview') {
      const result = await overviewRoute(await readBody(req))
      return send(res, result.status, result.body)
    }

    if (req.method === 'GET' && url.pathname === '/api/mail/message') {
      requireUid()
      const acc = await accountById(q.get('account'))
      return send(res, 200, await messageView(acc, folder, uid, q.get('seen') === '1'))
    }

    if (req.method === 'GET' && url.pathname === '/api/mail/attachment') {
      requireUid()
      const acc = await accountById(q.get('account'))
      const parsed = await simpleParser(await downloadMessage(acc, folder, uid, false))
      const att = parsed.attachments[Number(q.get('index'))]
      if (!att) throw new MailError(404, 'Anhang nicht gefunden.')
      // Immer als Download – ein HTML-Anhang darf nie im App-Kontext angezeigt werden
      res.statusCode = 200
      res.setHeader('Content-Type', 'application/octet-stream')
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(att.filename || 'anhang')}`)
      res.setHeader('X-Content-Type-Options', 'nosniff')
      res.setHeader('Cache-Control', 'no-store')
      return res.end(att.content)
    }

    if (req.method === 'POST' && url.pathname === '/api/mail/flags') {
      const body = await readBody(req)
      const acc = await accountById(typeof body.accountId === 'string' ? body.accountId : null)
      const target = Number(body.uid)
      if (!Number.isInteger(target) || target <= 0) throw new MailError(400, 'Ungültige Mail.')
      const box = typeof body.folder === 'string' ? body.folder.slice(0, 500) : 'INBOX'
      await setSeen(acc, box, target, body.seen !== false)
      return send(res, 200, { ok: true })
    }

    if (req.method === 'GET' && url.pathname === '/api/mail/accounts') {
      return send(res, 200, (await readAccounts()).map(publicView))
    }

    if (req.method === 'POST' && url.pathname === '/api/mail/accounts') {
      const result = await addAccount(await readBody(req))
      return send(res, result.status, result.body)
    }

    const match = url.pathname.match(/^\/api\/mail\/accounts\/([\w-]+)$/)
    if (req.method === 'DELETE' && match) {
      const accounts = await readAccounts()
      const rest = accounts.filter((a) => a.id !== match[1])
      if (rest.length === accounts.length) return send(res, 404, { error: 'Konto nicht gefunden' })
      passwordCache.delete(match[1])
      await writeAccounts(rest)
      return send(res, 200, { ok: true })
    }

    if (req.method === 'GET' && url.pathname === '/api/mail/unread') {
      // Parallele Abfragen (z. B. zwei Tabs) teilen sich eine IMAP-Runde
      inflight ??= collectUnread().finally(() => {
        inflight = null
      })
      return send(res, 200, await inflight)
    }

    return send(res, 404, { error: 'Unbekannter Endpunkt' })
  } catch (err) {
    if (err instanceof MailError) return send(res, err.status, { error: err.message })
    const e = err as { authenticationFailed?: boolean; code?: string; responseText?: string }
    // IMAP- und Verbindungsfehler verständlich machen
    if (e?.authenticationFailed || e?.code || e?.responseText) return send(res, 502, { error: explain(err, '') })
    return send(res, 500, { error: (err as Error).message })
  }
}

export function mailApi(): Plugin {
  const middleware = (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    void handle(req, res, next)
  }
  return {
    name: 'mail-api',
    configResolved(config) {
      accountsFile = path.resolve(config.root, 'data', 'mail-accounts.json')
    },
    configureServer(server) {
      server.middlewares.use(middleware)
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware)
    },
  }
}
