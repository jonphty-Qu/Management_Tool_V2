import type { Plugin } from 'vite'
import type { IncomingMessage, ServerResponse } from 'node:http'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { promises as fs } from 'node:fs'
import { createArchive, restoreArchive, validateArchive, MAX_BACKUP, type Archive } from './backupStore'
import { exclusive } from './docsPlugin'

export function backupApi(): Plugin {
  let root = path.resolve('data')
  const pending = new Map<string, { archive: Archive; previous: Record<string, string>; created: number }>()
  const send = (res: ServerResponse, status: number, data: unknown) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store'); res.end(JSON.stringify(data)) }
  const cleanupExpired = () => { for (const [key, entry] of pending) if (Date.now() - entry.created > 600_000) pending.delete(key) }
  const middleware = async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    if (!url.pathname.startsWith('/api/backup/')) return next()
    if (req.headers['x-requested-with'] !== 'management-tool') return send(res, 403, { error: 'Nicht erlaubt.' })
    try {
      if (req.method !== 'POST') return send(res, 405, { error: 'POST erforderlich.' })
      const chunks: Buffer[] = []; let size = 0
      for await (const chunk of req) { size += chunk.length; if (size > MAX_BACKUP) throw new Error('Sicherung überschreitet 200 MB.'); chunks.push(Buffer.from(chunk)) }
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
      if (url.pathname === '/api/backup/export') return send(res, 200, await exclusive(() => createArchive(root, body.storage)))
      if (url.pathname === '/api/backup/prepare') {
        const archive = validateArchive(body.archive)
        // Validate the browser rollback snapshot using the same rules, before staging.
        validateArchive({ ...archive, storage: body.previous })
        cleanupExpired()
        if (pending.size >= 2) throw new Error('Eine Wiederherstellung ist bereits vorbereitet. Bitte zehn Minuten warten.')
        const token = randomUUID()
        pending.set(token, { archive, previous: body.previous, created: Date.now() })
        return send(res, 200, { token })
      }
      if (url.pathname === '/api/backup/commit' || url.pathname === '/api/backup/status') {
        if (typeof body.token !== 'string' || !/^[a-f0-9-]{36}$/.test(body.token)) throw new Error('Ungültige Wiederherstellungs-ID.')
        return await exclusive(async () => {
        cleanupExpired()
        const marker = path.join(root, 'backups', `${body.token}.json`)
        const completed = await fs.readFile(marker, 'utf8').then(JSON.parse).catch(() => null)
        if (completed) return send(res, 200, completed)
        if (url.pathname.endsWith('/status')) return send(res, 200, { state: pending.has(body.token) ? 'pending' : 'unknown' })
        const entry = pending.get(body.token)
        if (!entry) throw new Error('Vorbereitung abgelaufen. Sicherung erneut auswählen.')
        const result = await (async () => {
          const recoveryId = await restoreArchive(root, entry.archive, entry.previous, async recoveryId => {
            const temporary = marker + '.tmp'
            await fs.writeFile(temporary, JSON.stringify({ state: 'complete', recoveryId }))
            await fs.rename(temporary, marker)
          })
          const result = { state: 'complete', recoveryId }
          pending.delete(body.token)
          return result
        })()
        return send(res, 200, result)
        })
      }
      return send(res, 404, { error: 'Unbekannter Endpunkt.' })
    } catch (error) { send(res, 400, { error: (error as Error).message }) }
  }
  return { name: 'backup-api', configResolved(config) { root = path.resolve(config.root, 'data') }, configureServer(server) { server.middlewares.use((req, res, next) => { void middleware(req, res, next) }) }, configurePreviewServer(server) { server.middlewares.use((req, res, next) => { void middleware(req, res, next) }) } }
}
