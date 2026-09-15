import { promises as fs } from 'node:fs'
import path from 'node:path'
import { createHash, randomUUID } from 'node:crypto'

export const MAX_BACKUP = 200 * 1024 * 1024
export interface Archive { format: 'management-tool'; version: 1; createdAt: string; storage: Record<string, string>; files: Array<{ path: string; base64: string; sha256: string }> }
const hash = (buffer: Buffer) => createHash('sha256').update(buffer).digest('hex')
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const safeFile = /^(index\.json|files\/[a-zA-Z0-9_-]+\.(pdf|png|jpg|jpeg|webp|gif|txt|csv|docx|doc|odt|xlsx|xls|ods|pptx|odp|zip))$/
const strings = (v: unknown, keys: string[]): v is Record<string, unknown> => object(v) && keys.every(k => typeof v[k] === 'string')
function validBoard(v: unknown): boolean { return object(v) && Array.isArray(v.columns) && v.columns.every(c => strings(c, ['id', 'title']) && typeof c.order === 'number') && Array.isArray(v.cards) && v.cards.every(c => strings(c, ['id', 'columnId', 'title', 'priority']) && ['niedrig', 'mittel', 'hoch'].includes(c.priority as string) && typeof c.order === 'number') }

export function validateArchive(value: unknown): Archive {
  if (!object(value) || value.format !== 'management-tool' || value.version !== 1 || typeof value.createdAt !== 'string' || !Number.isFinite(Date.parse(value.createdAt)) || !object(value.storage) || !Array.isArray(value.files)) throw new Error('Keine unterstützte Management-Tool-Sicherung (Version 1).')
  for (const [key, raw] of Object.entries(value.storage)) {
    if (!/^mt\.[a-zA-Z0-9_.-]+$/.test(key) || typeof raw !== 'string') throw new Error('Ungültige Browserdaten.')
    if (key === 'mt.theme') { if (!['light', 'dark', 'system'].includes(raw)) throw new Error('Ungültiges Design.'); continue }
    let parsed: unknown
    try { parsed = JSON.parse(raw) } catch { throw new Error(`Ungültige JSON-Daten: ${key}`) }
    if (['mt.applications', 'mt.events', 'mt.finance', 'mt.notes', 'mt.remindersRead', 'mt.remindersNotified'].includes(key) && !Array.isArray(parsed)) throw new Error(`Ungültige Liste: ${key}`)
    if (key === 'mt.projects' && (!object(parsed) || !Array.isArray(parsed.projects) || typeof parsed.activeId !== 'string' || parsed.projects.some(p => !object(p) || !Array.isArray(p.cards) || !Array.isArray(p.columns)))) throw new Error('Ungültige Projekte.')
    if (key === 'mt.settings' && !object(parsed)) throw new Error('Ungültige Einstellungen.')
    const shapes: Record<string, string[]> = { 'mt.applications': ['id', 'company', 'position', 'status'], 'mt.events': ['id', 'title', 'start', 'end', 'category'], 'mt.notes': ['id', 'title', 'content', 'date', 'createdAt', 'updatedAt'], 'mt.finance': ['id', 'label', 'company', 'kind', 'interval'] }
    if (shapes[key] && (parsed as unknown[]).some(v => !strings(v, shapes[key]))) throw new Error(`Ungültiger Eintrag: ${key}`)
    if (key === 'mt.applications' && (parsed as Record<string, unknown>[]).some(v => !['entwurf', 'abgeschickt', 'gespraech', 'absage', 'zusage'].includes(v.status as string) || ['documentIds', 'interviewIds'].some(k => v[k] !== undefined && (!Array.isArray(v[k]) || !(v[k] as unknown[]).every(x => typeof x === 'string'))) || (v.emails !== undefined && (!Array.isArray(v.emails) || !v.emails.every(m => strings(m, ['accountId', 'folder', 'direction', 'from', 'fromAddress', 'subject', 'date', 'snippet']) && typeof m.uid === 'number'))))) throw new Error('Ungültige Bewerbung.')
    if (key === 'mt.events' && (parsed as Record<string, unknown>[]).some(v => !['arbeit', 'privat', 'termin', 'gespraech', 'deadline', 'geburtstag', 'sonstiges'].includes(v.category as string) || !Number.isFinite(Date.parse(v.start as string)) || !Number.isFinite(Date.parse(v.end as string)) || ['alerts', 'reminders'].some(k => v[k] !== undefined && (!Array.isArray(v[k]) || !(v[k] as unknown[]).every(n => typeof n === 'number' && Number.isFinite(n) && n >= 0))))) throw new Error('Ungültiger Termin.')
    if (key === 'mt.finance' && (parsed as Record<string, unknown>[]).some(v => typeof v.amount !== 'number' || !Number.isFinite(v.amount) || !['fix', 'flexibel', 'einnahme'].includes(v.kind as string) || !['monatlich', 'quartalsweise', 'jaehrlich'].includes(v.interval as string))) throw new Error('Ungültiger Finanzeintrag.')
    if (['mt.remindersRead', 'mt.remindersNotified'].includes(key) && !(parsed as unknown[]).every(v => typeof v === 'string')) throw new Error('Ungültige Erinnerungen.')
    if (key === 'mt.board' && !validBoard(parsed)) throw new Error('Ungültiges altes Board.')
    if (key === 'mt.projects' && !(parsed as { projects: unknown[] }).projects.every(p => strings(p, ['id', 'name', 'createdAt']) && validBoard(p))) throw new Error('Ungültiges Projekt.')
    if (key === 'mt.settings' && object(parsed) && parsed.interviewAlerts !== undefined && (!Array.isArray(parsed.interviewAlerts) || !parsed.interviewAlerts.every(n => typeof n === 'number' && Number.isFinite(n) && n >= 0))) throw new Error('Ungültige Erinnerungsabstände.')
  }
  const names = new Set<string>()
  let total = Buffer.byteLength(JSON.stringify(value.storage))
  const buffers = new Map<string, Buffer>()
  for (const file of value.files) {
    if (!object(file) || typeof file.path !== 'string' || !safeFile.test(file.path) || names.has(file.path.toLowerCase()) || typeof file.base64 !== 'string' || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(file.base64)) throw new Error('Ungültiger oder doppelter Dateipfad in der Sicherung.')
    names.add(file.path.toLowerCase())
    total += file.base64.length
    if (total > MAX_BACKUP) throw new Error('Sicherung überschreitet 200 MB.')
    const buffer = Buffer.from(file.base64, 'base64')
    if (hash(buffer) !== file.sha256) throw new Error(`Beschädigte Datei: ${file.path}`)
    buffers.set(file.path, buffer)
  }
  const indexBuffer = buffers.get('index.json')
  if (!indexBuffer) throw new Error('Dokumentenindex fehlt.')
  let index: unknown
  try { index = JSON.parse(indexBuffer.toString('utf8')) } catch { throw new Error('Dokumentenindex ist beschädigt.') }
  if (!object(index) || !Array.isArray(index.files) || !Array.isArray(index.templates)) throw new Error('Ungültiger Dokumentenindex.')
  const referenced = new Set<string>(['index.json'])
  const documentIds = new Set<string>()
  for (const item of index.files) {
    if (!object(item) || typeof item.id !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(item.id) || typeof item.fileName !== 'string' || /[\\/]/.test(item.fileName) || typeof item.title !== 'string' || typeof item.mime !== 'string' || typeof item.size !== 'number' || typeof item.category !== 'string' || typeof item.createdAt !== 'string') throw new Error('Ungültiger Dokumenteneintrag.')
    const name = `files/${item.id}${path.extname(item.fileName).toLowerCase()}`
    if (documentIds.has(item.id) || !['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/gif', 'text/plain; charset=utf-8', 'text/csv; charset=utf-8', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword', 'application/vnd.oasis.opendocument.text', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel', 'application/vnd.oasis.opendocument.spreadsheet', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/vnd.oasis.opendocument.presentation', 'application/zip'].includes(item.mime) || (item.space !== undefined && !['bewerbung', 'ablage'].includes(item.space as string)) || typeof item.isDefault !== 'boolean' || (item.note !== undefined && typeof item.note !== 'string')) throw new Error('Ungültige Dokumentenmetadaten.')
    documentIds.add(item.id)
    if (!safeFile.test(name) || referenced.has(name) || !buffers.has(name) || buffers.get(name)!.length !== item.size) throw new Error(`Dokument fehlt oder hat eine falsche Größe: ${item.fileName}`)
    referenced.add(name)
  }
  for (const template of index.templates) if (!object(template) || ['id', 'title', 'content', 'createdAt', 'updatedAt'].some(k => typeof template[k] !== 'string')) throw new Error('Ungültige Anschreiben-Vorlage.')
  if (buffers.size !== referenced.size) throw new Error('Sicherung enthält Dateien ohne Dokumenteneintrag.')
  return value as unknown as Archive
}

export async function createArchive(root: string, storage: Record<string, string>): Promise<Archive> {
  const files: Archive['files'] = []
  async function walk(dir: string, prefix = '') {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) throw new Error('Symbolische Verknüpfungen können nicht gesichert werden.')
      const name = prefix + entry.name
      if (entry.isDirectory() && name === 'files') await walk(path.join(dir, entry.name), 'files/')
      else if (entry.isFile() && safeFile.test(name)) {
        const stat = await fs.stat(path.join(dir, entry.name))
        if (stat.size > MAX_BACKUP || files.reduce((n, f) => n + f.base64.length, 0) + Math.ceil(stat.size / 3) * 4 > MAX_BACKUP) throw new Error('Sicherung überschreitet 200 MB.')
        const buffer = await fs.readFile(path.join(dir, entry.name))
        files.push({ path: name, base64: buffer.toString('base64'), sha256: hash(buffer) })
      }
    }
  }
  try { await walk(path.join(root, 'documents')) } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
  if (!files.some(f => f.path === 'index.json')) { const buffer = Buffer.from('{"files":[],"templates":[]}'); files.push({ path: 'index.json', base64: buffer.toString('base64'), sha256: hash(buffer) }) }
  return validateArchive({ format: 'management-tool', version: 1, createdAt: new Date().toISOString(), storage, files })
}

/** Staging and renames stay on the same volume. Previous documents and browser data remain recoverable. */
export async function restoreArchive(root: string, input: unknown, previousStorage: Record<string, string>, finalize?: (id: string) => Promise<void>): Promise<string> {
  const archive = validateArchive(input)
  const id = randomUUID()
  const staging = path.join(root, `.restore-${id}`)
  const current = path.join(root, 'documents')
  const recovery = path.join(root, 'backups', id)
  await fs.mkdir(path.join(staging, 'files'), { recursive: true })
  let moved = false
  try {
    for (const file of archive.files) await fs.writeFile(path.join(staging, file.path), Buffer.from(file.base64, 'base64'))
    await fs.mkdir(recovery, { recursive: true })
    await fs.writeFile(path.join(recovery, 'browser-storage.json'), JSON.stringify(previousStorage))
    try { await fs.rename(current, path.join(recovery, 'documents')); moved = true } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
    let installed = false
    try {
      await fs.rename(staging, current); installed = true
      await finalize?.(id)
    } catch (error) {
      if (installed) await fs.rename(current, staging)
      if (moved) await fs.rename(path.join(recovery, 'documents'), current)
      throw error
    }
    return id
  } finally { await fs.rm(staging, { recursive: true, force: true }) }
}
