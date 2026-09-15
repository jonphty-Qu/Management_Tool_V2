import type { Plugin } from 'vite'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { existsSync } from 'node:fs'
import { spawn } from 'node:child_process'

const firefoxPaths = ['C:\\Program Files\\Mozilla Firefox\\firefox.exe', 'C:\\Program Files (x86)\\Mozilla Firefox\\firefox.exe']

export function browserApi(): Plugin {
  return { name: 'browser-api', configureServer(server) { server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next) => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    if (url.pathname !== '/api/browser/open' || req.method !== 'POST') return next()
    if (req.headers['x-requested-with'] !== 'management-tool') { res.statusCode = 403; res.end(JSON.stringify({ error: 'Nicht erlaubt.' })); return }
    const chunks: Buffer[] = []; for await (const chunk of req) chunks.push(Buffer.from(chunk))
    let body: { url?: unknown } = {}; try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch { /* below */ }
    if (typeof body.url !== 'string') { res.statusCode = 400; res.end(JSON.stringify({ error: 'Ungültiger Link.' })); return }
    let target: URL; try { target = new URL(body.url) } catch { res.statusCode = 400; res.end(JSON.stringify({ error: 'Ungültiger Link.' })); return }
    if (!['http:', 'https:'].includes(target.protocol)) { res.statusCode = 400; res.end(JSON.stringify({ error: 'Nur HTTP- und HTTPS-Links sind erlaubt.' })); return }
    const executable = firefoxPaths.find(existsSync)
    if (!executable) { res.statusCode = 404; res.end(JSON.stringify({ error: 'Firefox wurde nicht gefunden.' })); return }
    const child = spawn(executable, [target.toString()], { detached: true, stdio: 'ignore', windowsHide: true }); child.unref()
    res.statusCode = 204; res.end()
  }) } }
}
