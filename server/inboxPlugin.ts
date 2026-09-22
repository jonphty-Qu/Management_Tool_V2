import type { Plugin } from 'vite'
import type { IncomingMessage, ServerResponse } from 'node:http'
import path from 'node:path'
import { promises as fs } from 'node:fs'

/**
 * Posteingang für Aufgaben.
 *
 * Liegt eine Liste in `data/inbox.json`, bietet die Projektseite sie zur
 * Übernahme an. So lassen sich Aufgaben von außen vorbereiten (Skript,
 * Assistent) – angelegt werden sie erst auf Knopfdruck im Tool.
 *
 * Format der Datei:
 * { "tasks": [{ "title": "Einkaufen", "description": "Brot", "priority": "mittel", "due": "2026-09-25" }] }
 */

export interface InboxTask {
  title: string
  description?: string
  priority?: 'niedrig' | 'mittel' | 'hoch'
  /** ISO-Datum (Tag reicht). */
  due?: string
}

const MAX_TASKS = 200
const MAX_BYTES = 256 * 1024

function cleanTask(value: unknown): InboxTask | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Record<string, unknown>
  const title = typeof raw.title === 'string' ? raw.title.trim().slice(0, 200) : ''
  if (!title) return null
  const priority = raw.priority
  const due = typeof raw.due === 'string' && !Number.isNaN(Date.parse(raw.due)) ? raw.due : undefined
  return {
    title,
    description:
      typeof raw.description === 'string' && raw.description.trim()
        ? raw.description.trim().slice(0, 2000)
        : undefined,
    priority: priority === 'niedrig' || priority === 'hoch' ? priority : 'mittel',
    due,
  }
}

export function inboxApi(): Plugin {
  let file = path.resolve('data', 'inbox.json')

  const send = (res: ServerResponse, status: number, data: unknown) => {
    res.statusCode = status
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Cache-Control', 'no-store')
    res.end(JSON.stringify(data))
  }

  const read = async (): Promise<InboxTask[]> => {
    const stat = await fs.stat(file).catch(() => null)
    if (!stat || stat.size > MAX_BYTES) return []
    const raw = await fs.readFile(file, 'utf8').catch(() => '')
    if (!raw.trim()) return []
    try {
      const parsed = JSON.parse(raw) as { tasks?: unknown }
      const list = Array.isArray(parsed.tasks) ? parsed.tasks : []
      return list.map(cleanTask).filter((t): t is InboxTask => t !== null).slice(0, MAX_TASKS)
    } catch {
      return []
    }
  }

  const middleware = async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    if (!url.pathname.startsWith('/api/inbox')) return next()
    if (req.headers['x-requested-with'] !== 'management-tool') return send(res, 403, { error: 'Nicht erlaubt.' })

    try {
      if (req.method === 'GET' && url.pathname === '/api/inbox') {
        return send(res, 200, { tasks: await read() })
      }
      // Nach der Übernahme im Tool wird die Datei geleert, nicht gelöscht –
      // so bleibt sie als Ablage für den nächsten Schwung bestehen.
      if (req.method === 'POST' && url.pathname === '/api/inbox/clear') {
        await fs.mkdir(path.dirname(file), { recursive: true })
        await fs.writeFile(file, JSON.stringify({ tasks: [] }, null, 2), 'utf8')
        return send(res, 200, { ok: true })
      }
      return send(res, 404, { error: 'Unbekannter Endpunkt.' })
    } catch (error) {
      send(res, 400, { error: (error as Error).message })
    }
  }

  return {
    name: 'inbox-api',
    configResolved(config) {
      file = path.resolve(config.root, 'data', 'inbox.json')
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        void middleware(req, res, next)
      })
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        void middleware(req, res, next)
      })
    },
  }
}
