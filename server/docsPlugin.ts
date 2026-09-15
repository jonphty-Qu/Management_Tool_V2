import type { Plugin } from 'vite'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

/**
 * Dateiablage mit zwei Bereichen: Bewerbungsunterlagen (inkl. Anschreiben-Vorlagen)
 * und die allgemeine Ablage (Verträge, Rechnungen …). Alles liegt lokal unter data/documents/.
 */

interface DocFile {
  id: string
  title: string
  fileName: string
  mime: string
  size: number
  category: string
  /** Fehlt bei Dateien aus der ersten Version – die gehören zu den Bewerbungen. */
  space?: string
  isDefault: boolean
  note?: string
  createdAt: string
}

interface DocTemplate {
  id: string
  title: string
  content: string
  createdAt: string
  updatedAt: string
}

interface Store {
  files: DocFile[]
  templates: DocTemplate[]
}

const HEADER_NAME = 'x-requested-with'
const HEADER_VALUE = 'management-tool'
const MAX_UPLOAD = 50 * 1024 * 1024
const SPACES = ['bewerbung', 'ablage']
const CATEGORIES = [
  'lebenslauf',
  'anschreiben',
  'zeugnis',
  'zertifikat',
  'vertrag',
  'rechnung',
  'versicherung',
  'behoerde',
  'gesundheit',
  'sonstiges',
]

/**
 * Nur Formate, die gefahrlos sind – kein HTML/SVG/JS, die könnten im App-Kontext Skripte ausführen.
 * Office- und ZIP-Dateien werden nie angezeigt, nur heruntergeladen.
 */
const allowedTypes: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.txt': 'text/plain; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.doc': 'application/msword',
  '.odt': 'application/vnd.oasis.opendocument.text',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xls': 'application/vnd.ms-excel',
  '.ods': 'application/vnd.oasis.opendocument.spreadsheet',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.odp': 'application/vnd.oasis.opendocument.presentation',
  '.zip': 'application/zip',
}

let baseDir = path.resolve(process.cwd(), 'data', 'documents')
const indexFile = () => path.join(baseDir, 'index.json')
// Auf der Platte zählt nur die ID – der Originalname landet nie in einem Pfad
const storedPath = (f: Pick<DocFile, 'id' | 'fileName'>) =>
  path.join(baseDir, 'files', f.id + path.extname(f.fileName).toLowerCase())
const spaceOf = (f: DocFile) => f.space ?? 'bewerbung'
/** "Standard" (bei neuen Bewerbungen vorausgewählt) gibt es nur für Bewerbungsunterlagen. */
const hasDefaults = (space: string) => space === 'bewerbung'

class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

// ---------- Speicherung ----------

// Index-Schreibzugriffe nacheinander – parallele Uploads würden sich sonst gegenseitig überschreiben
let queue: Promise<unknown> = Promise.resolve()
export function exclusive<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn)
  queue = run.catch(() => undefined)
  return run
}

async function readStore(): Promise<Store> {
  try {
    const data = JSON.parse(await fs.readFile(indexFile(), 'utf8')) as Partial<Store>
    return { files: data.files ?? [], templates: data.templates ?? [] }
  } catch {
    return { files: [], templates: [] }
  }
}

async function writeStore(store: Store) {
  await fs.mkdir(baseDir, { recursive: true })
  const tmp = `${indexFile()}.tmp`
  await fs.writeFile(tmp, JSON.stringify(store, null, 2), 'utf8')
  await fs.rename(tmp, indexFile())
}

// ---------- HTTP-Helfer ----------

function send(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(body))
}

async function readRaw(req: IncomingMessage, limit: number): Promise<Buffer> {
  const tooBig = `Datei zu groß (max. ${Math.round(limit / 1024 / 1024)} MB).`
  if (Number(req.headers['content-length'] ?? 0) > limit) throw new HttpError(413, tooBig)
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    size += (chunk as Buffer).length
    if (size > limit) throw new HttpError(413, tooBig)
    chunks.push(chunk as Buffer)
  }
  return Buffer.concat(chunks)
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const raw = await readRaw(req, 1024 * 1024)
  if (raw.length === 0) return {}
  try {
    return JSON.parse(raw.toString('utf8')) as Record<string, unknown>
  } catch {
    throw new HttpError(400, 'Ungültige Anfrage.')
  }
}

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

// ---------- Dateien ----------

async function uploadFile(req: IncomingMessage, url: URL): Promise<DocFile> {
  let rawName: string
  try {
    rawName = decodeURIComponent(String(req.headers['x-file-name'] ?? ''))
  } catch {
    throw new HttpError(400, 'Ungültiger Dateiname.')
  }
  const fileName = path.basename(rawName).slice(0, 200)
  const ext = path.extname(fileName).toLowerCase()
  if (!fileName || !allowedTypes[ext]) {
    throw new HttpError(
      415,
      `„${fileName || 'Datei'}“: erlaubt sind PDF, Office-Dokumente, Bilder, Text/CSV und ZIP.`,
    )
  }

  const requestedSpace = url.searchParams.get('space') ?? ''
  const space = SPACES.includes(requestedSpace) ? requestedSpace : 'bewerbung'
  const requested = url.searchParams.get('category') ?? ''
  const category = CATEGORIES.includes(requested) ? requested : 'sonstiges'
  const body = await readRaw(req, MAX_UPLOAD)
  if (body.length === 0) throw new HttpError(400, `„${fileName}“ ist leer.`)

  const file: DocFile = {
    id: randomUUID(),
    title: fileName.replace(/\.[^.]+$/, ''),
    fileName,
    mime: allowedTypes[ext],
    size: body.length,
    category,
    space,
    isDefault: false,
    createdAt: new Date().toISOString(),
  }

  await exclusive(async () => {
    await fs.mkdir(path.join(baseDir, 'files'), { recursive: true })
    await fs.writeFile(storedPath(file), body)
    const store = await readStore()
    // Die erste Bewerbungsunterlage einer Kategorie wird automatisch Standard
    file.isDefault =
      hasDefaults(space) && !store.files.some((f) => spaceOf(f) === space && f.category === category)
    store.files.push(file)
    await writeStore(store)
  })
  return file
}

async function serveFile(res: ServerResponse, id: string) {
  const file = (await readStore()).files.find((f) => f.id === id)
  if (!file) throw new HttpError(404, 'Datei nicht gefunden.')
  const data = await fs.readFile(storedPath(file)).catch(() => {
    throw new HttpError(404, 'Die Datei fehlt auf der Festplatte.')
  })
  res.statusCode = 200
  res.setHeader('Content-Type', file.mime)
  res.setHeader('Content-Length', data.length)
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(file.fileName)}`)
  res.setHeader('Cache-Control', 'no-store')
  res.end(data)
}

async function updateFile(id: string, body: Record<string, unknown>): Promise<DocFile> {
  return exclusive(async () => {
    const store = await readStore()
    const file = store.files.find((f) => f.id === id)
    if (!file) throw new HttpError(404, 'Datei nicht gefunden.')
    const space = spaceOf(file)
    const sameGroup = (f: DocFile) => spaceOf(f) === space && f.category === file.category

    const title = str(body.title, 200)
    if (title) file.title = title
    if (typeof body.note === 'string') file.note = str(body.note, 2000) || undefined

    if (typeof body.category === 'string' && CATEGORIES.includes(body.category) && body.category !== file.category) {
      file.category = body.category
      // In der neuen Kategorie nur Standard werden, wenn dort noch keiner ist
      file.isDefault =
        hasDefaults(space) && !store.files.some((f) => f.id !== file.id && sameGroup(f) && f.isDefault)
    }

    if (body.isDefault === true && hasDefaults(space)) {
      for (const f of store.files) if (sameGroup(f)) f.isDefault = f.id === file.id
    } else if (body.isDefault === false) {
      file.isDefault = false
    }

    await writeStore(store)
    return file
  })
}

async function deleteFile(id: string) {
  await exclusive(async () => {
    const store = await readStore()
    const file = store.files.find((f) => f.id === id)
    if (!file) throw new HttpError(404, 'Datei nicht gefunden.')
    store.files = store.files.filter((f) => f.id !== id)
    // War es der Standard, rückt die neueste Datei derselben Kategorie nach
    if (file.isDefault) {
      const next = store.files
        .filter((f) => spaceOf(f) === spaceOf(file) && f.category === file.category)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
      if (next) next.isDefault = true
    }
    await writeStore(store)
    await fs.unlink(storedPath(file)).catch(() => undefined)
  })
}

// ---------- Vorlagen ----------

async function saveTemplate(id: string | undefined, body: Record<string, unknown>): Promise<DocTemplate> {
  const title = str(body.title, 200) || 'Vorlage'
  if (typeof body.content !== 'string') throw new HttpError(400, 'Der Vorlagentext fehlt.')
  const content = body.content.slice(0, 50_000)

  return exclusive(async () => {
    const store = await readStore()
    const now = new Date().toISOString()
    if (id) {
      const existing = store.templates.find((t) => t.id === id)
      if (!existing) throw new HttpError(404, 'Vorlage nicht gefunden.')
      Object.assign(existing, { title, content, updatedAt: now })
      await writeStore(store)
      return existing
    }
    const created: DocTemplate = { id: randomUUID(), title, content, createdAt: now, updatedAt: now }
    store.templates.push(created)
    await writeStore(store)
    return created
  })
}

async function deleteTemplate(id: string) {
  await exclusive(async () => {
    const store = await readStore()
    if (!store.templates.some((t) => t.id === id)) throw new HttpError(404, 'Vorlage nicht gefunden.')
    store.templates = store.templates.filter((t) => t.id !== id)
    await writeStore(store)
  })
}

// ---------- Routing ----------

async function route(req: IncomingMessage, res: ServerResponse, url: URL) {
  const method = req.method ?? 'GET'
  if (url.pathname === '/api/docs' && method === 'GET') return send(res, 200, await readStore())

  const match = url.pathname.match(/^\/api\/docs\/(files|templates)(?:\/([\w-]+))?(\/content)?$/)
  if (!match) throw new HttpError(404, 'Unbekannter Endpunkt')
  const [, kind, id, content] = match

  if (kind === 'files') {
    if (!id && method === 'POST') return send(res, 201, await uploadFile(req, url))
    if (id && content && method === 'GET') return serveFile(res, id)
    if (id && !content && method === 'PATCH') return send(res, 200, await updateFile(id, await readJson(req)))
    if (id && !content && method === 'DELETE') {
      await deleteFile(id)
      return send(res, 200, { ok: true })
    }
  } else if (!content) {
    if (!id && method === 'POST') return send(res, 201, await saveTemplate(undefined, await readJson(req)))
    if (id && method === 'PUT') return send(res, 200, await saveTemplate(id, await readJson(req)))
    if (id && method === 'DELETE') {
      await deleteTemplate(id)
      return send(res, 200, { ok: true })
    }
  }
  throw new HttpError(405, 'Methode nicht erlaubt')
}

async function handle(req: IncomingMessage, res: ServerResponse, next: () => void) {
  const url = new URL(req.url ?? '/', 'http://localhost')
  if (url.pathname !== '/api/docs' && !url.pathname.startsWith('/api/docs/')) return next()
  // Eigener Header erzwingt bei fremden Seiten einen CORS-Preflight, der scheitert
  if (req.headers[HEADER_NAME] !== HEADER_VALUE) return send(res, 403, { error: 'Nicht erlaubt' })

  try {
    await route(req, res, url)
  } catch (err) {
    if (err instanceof HttpError) send(res, err.status, { error: err.message })
    else send(res, 500, { error: (err as Error).message })
  }
}

export function docsApi(): Plugin {
  const middleware = (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    void handle(req, res, next)
  }
  return {
    name: 'docs-api',
    configResolved(config) {
      baseDir = path.resolve(config.root, 'data', 'documents')
    },
    configureServer(server) {
      server.middlewares.use(middleware)
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware)
    },
  }
}
