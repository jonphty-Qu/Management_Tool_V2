import { useCallback, useEffect, useState } from 'react'
import type { Application } from './applications'

export type DocCategory =
  | 'lebenslauf'
  | 'anschreiben'
  | 'zeugnis'
  | 'zertifikat'
  | 'vertrag'
  | 'rechnung'
  | 'versicherung'
  | 'behoerde'
  | 'gesundheit'
  | 'sonstiges'

/** Bewerbungsunterlagen oder allgemeine Ablage („Dokumente“). */
export type DocSpace = 'bewerbung' | 'ablage'

export interface DocFile {
  id: string
  title: string
  fileName: string
  mime: string
  size: number
  category: DocCategory
  /** Fehlt bei Dateien aus der ersten Version – die gehören zu den Bewerbungen. */
  space?: DocSpace
  /** Wird bei neuen Bewerbungen automatisch als „mitgeschickt“ vorausgewählt. */
  isDefault: boolean
  note?: string
  createdAt: string
}

export interface DocTemplate {
  id: string
  title: string
  content: string
  createdAt: string
  updatedAt: string
}

export const docCategories: Record<DocCategory, { label: string }> = {
  lebenslauf: { label: 'Lebenslauf' },
  anschreiben: { label: 'Anschreiben' },
  zeugnis: { label: 'Zeugnisse' },
  zertifikat: { label: 'Zertifikate' },
  vertrag: { label: 'Verträge' },
  rechnung: { label: 'Rechnungen' },
  versicherung: { label: 'Versicherungen' },
  behoerde: { label: 'Behörden & Steuern' },
  gesundheit: { label: 'Gesundheit' },
  sonstiges: { label: 'Sonstiges' },
}

/** Kategorien je Bereich, in Anzeigereihenfolge. */
export const spaceCategories: Record<DocSpace, DocCategory[]> = {
  bewerbung: ['lebenslauf', 'anschreiben', 'zeugnis', 'zertifikat', 'sonstiges'],
  ablage: ['vertrag', 'rechnung', 'versicherung', 'behoerde', 'gesundheit', 'sonstiges'],
}

/** Muss zur Freigabeliste im Server (server/docsPlugin.ts) passen. */
export const ACCEPT =
  '.pdf,.png,.jpg,.jpeg,.webp,.gif,.txt,.csv,.doc,.docx,.odt,.xls,.xlsx,.ods,.pptx,.odp,.zip'

export function filesIn(files: DocFile[], space: DocSpace): DocFile[] {
  return files.filter((f) => (f.space ?? 'bewerbung') === space)
}

/** Kategorie am Dateinamen erraten – lässt sich danach jederzeit ändern. */
export function guessCategory(fileName: string, space: DocSpace = 'bewerbung'): DocCategory {
  const n = fileName.toLowerCase()
  if (space === 'ablage') {
    if (/vertrag|contract|vereinbarung|kündigung|kuendigung/.test(n)) return 'vertrag'
    if (/rechnung|invoice|beleg|quittung|kassenbon/.test(n)) return 'rechnung'
    if (/versicherung|police|insurance/.test(n)) return 'versicherung'
    if (/steuer|finanzamt|bescheid|behörde|behoerde|ausweis|meldebescheinigung|elster/.test(n)) return 'behoerde'
    if (/arzt|befund|rezept|krankenkasse|attest|impf/.test(n)) return 'gesundheit'
    return 'sonstiges'
  }
  if (/lebenslauf|resume|résumé|vita|(^|[^a-z])cv([^a-z]|$)/.test(n)) return 'lebenslauf'
  if (/anschreiben|cover|motivation/.test(n)) return 'anschreiben'
  if (/zeugnis|abschluss|bachelor|master|abitur|diplom|referenz/.test(n)) return 'zeugnis'
  if (/zertifikat|certificate|nachweis|teilnahme|schein/.test(n)) return 'zertifikat'
  return 'sonstiges'
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`
}

/** Im Browser anzeigbar – Office, CSV und ZIP werden stattdessen heruntergeladen. */
export function isPreviewable(file: DocFile): boolean {
  return file.mime === 'application/pdf' || file.mime.startsWith('image/') || file.mime.startsWith('text/plain')
}

// ---------- API ----------

const HEADERS = { 'X-Requested-With': 'management-tool' }

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { ...HEADERS }
  if (typeof init?.body === 'string') headers['Content-Type'] = 'application/json'
  Object.assign(headers, init?.headers as Record<string, string> | undefined)
  const res = await fetch(path, { ...init, headers })
  const data = (await res.json().catch(() => ({}))) as { error?: string }
  if (!res.ok) throw new Error(data.error || `Fehler ${res.status}`)
  return data as T
}

async function fetchBlob(file: DocFile): Promise<Blob> {
  const res = await fetch(`/api/docs/files/${file.id}/content`, { headers: HEADERS })
  if (!res.ok) throw new Error(`„${file.fileName}“ konnte nicht geladen werden.`)
  return res.blob()
}

export async function downloadDocument(file: DocFile) {
  const url = URL.createObjectURL(await fetchBlob(file))
  const a = document.createElement('a')
  a.href = url
  a.download = file.fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/** Öffnet PDF, Bild oder Text in einem neuen Fenster. */
export async function openDocument(file: DocFile) {
  // Fenster sofort öffnen – nach einem await würde der Popup-Blocker zuschlagen
  const win = window.open('', '_blank')
  if (!win) return downloadDocument(file)
  try {
    const url = URL.createObjectURL(await fetchBlob(file))
    win.location.href = url
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  } catch (err) {
    win.close()
    throw err
  }
}

export function useDocuments() {
  const [files, setFiles] = useState<DocFile[]>([])
  const [templates, setTemplates] = useState<DocTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    try {
      const data = await api<{ files: DocFile[]; templates: DocTemplate[] }>('/api/docs')
      setFiles(data.files)
      setTemplates(data.templates)
      setError(null)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  /** Lädt nacheinander hoch; Fehler einzelner Dateien werden gesammelt gemeldet. */
  const upload = useCallback(
    async (list: File[], space: DocSpace = 'bewerbung', category?: DocCategory) => {
      const errors: string[] = []
      for (const file of list) {
        try {
          const cat = category ?? guessCategory(file.name, space)
          await api<DocFile>(`/api/docs/files?space=${space}&category=${cat}`, {
            method: 'POST',
            headers: {
              'Content-Type': file.type || 'application/octet-stream',
              'X-File-Name': encodeURIComponent(file.name),
            },
            body: file,
          })
        } catch (err) {
          errors.push((err as Error).message)
        }
      }
      await reload()
      if (errors.length) throw new Error(errors.join('\n'))
    },
    [reload],
  )

  const updateFile = useCallback(
    async (id: string, patch: Partial<Pick<DocFile, 'title' | 'category' | 'isDefault' | 'note'>>) => {
      await api(`/api/docs/files/${id}`, { method: 'PATCH', body: JSON.stringify(patch) })
      await reload()
    },
    [reload],
  )

  const removeFile = useCallback(
    async (id: string) => {
      await api(`/api/docs/files/${id}`, { method: 'DELETE' })
      await reload()
    },
    [reload],
  )

  const saveTemplate = useCallback(
    async (t: { id?: string; title: string; content: string }) => {
      const body = JSON.stringify({ title: t.title, content: t.content })
      if (t.id) await api(`/api/docs/templates/${t.id}`, { method: 'PUT', body })
      else await api('/api/docs/templates', { method: 'POST', body })
      await reload()
    },
    [reload],
  )

  const removeTemplate = useCallback(
    async (id: string) => {
      await api(`/api/docs/templates/${id}`, { method: 'DELETE' })
      await reload()
    },
    [reload],
  )

  return { files, templates, loading, error, reload, upload, updateFile, removeFile, saveTemplate, removeTemplate }
}

export type DocumentsStore = ReturnType<typeof useDocuments>

// ---------- Vorlagen ----------

export const placeholders = [
  { key: 'firma', label: 'Unternehmen' },
  { key: 'position', label: 'Position' },
  { key: 'ort', label: 'Ort der Stelle' },
  { key: 'quelle', label: 'Gefunden über' },
  { key: 'datum', label: 'Heutiges Datum' },
  { key: 'name', label: 'Dein Name' },
  { key: 'email', label: 'Deine E-Mail' },
  { key: 'telefon', label: 'Deine Telefonnummer' },
  { key: 'standort', label: 'Dein Standort' },
  { key: 'beruf', label: 'Deine Berufsbezeichnung' },
  { key: 'profil', label: 'Dein Kurzprofil' },
]

/** Setzt Platzhalter ein; fehlende Werte bleiben als {{…}} stehen, damit sie auffallen. */
export function fillTemplate(content: string, values: Record<string, string | undefined>): string {
  return content.replace(/\{\{\s*([a-zäöüß_]+)\s*\}\}/gi, (match, key: string) => {
    const value = values[key.toLowerCase()]?.trim()
    return value || match
  })
}

export function letterValues(app: Pick<Application, 'company' | 'position' | 'location' | 'source'>, profile?: { profileName?: string; profileEmail?: string; profilePhone?: string; profileLocation?: string; profileTitle?: string; profileBio?: string }) {
  return {
    firma: app.company,
    position: app.position,
    ort: app.location,
    // "über Karriereseite" liest sich schief
    quelle: app.source === 'Karriereseite' ? 'Ihre Karriereseite' : app.source,
    datum: new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date()),
    name: profile?.profileName,
    email: profile?.profileEmail,
    telefon: profile?.profilePhone,
    standort: profile?.profileLocation,
    beruf: profile?.profileTitle,
    profil: profile?.profileBio,
  }
}

export const sampleTemplate = `{{datum}}

Bewerbung als {{position}}

Sehr geehrte Damen und Herren,

mit großem Interesse habe ich Ihre Ausschreibung für die Position als {{position}} bei {{firma}} gelesen, auf die ich über {{quelle}} aufmerksam geworden bin.

[2–3 Sätze: Erfahrung, Stärken und ein konkreter Erfolg, der zur Stelle passt.]

[1–2 Sätze: Was dich an {{firma}} reizt.]

Über die Einladung zu einem persönlichen Gespräch freue ich mich sehr.

Mit freundlichen Grüßen

Dein Name`
