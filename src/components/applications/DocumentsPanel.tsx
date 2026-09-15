import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Upload,
  UploadCloud,
  FileText,
  FileImage,
  FileSpreadsheet,
  FileArchive,
  File as FileIcon,
  Star,
  Download,
  Pencil,
  Trash2,
  Plus,
  Loader2,
  TriangleAlert,
  CircleCheck,
  Copy,
  ScrollText,
  Sparkles,
  X,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import {
  ACCEPT,
  docCategories,
  downloadDocument,
  filesIn,
  formatSize,
  isPreviewable,
  openDocument,
  sampleTemplate,
  spaceCategories,
  type DocCategory,
  type DocFile,
  type DocSpace,
  type DocumentsStore,
} from '@/lib/documents'
import { formatDateInput } from '@/lib/date'
import TemplateDialog, { type TemplateDraft } from './TemplateDialog'

interface Notice {
  kind: 'ok' | 'warn'
  text: string
}

interface Props {
  docs: DocumentsStore
  space?: DocSpace
  /** 'window': Dateien lassen sich irgendwo ins Fenster ziehen, nicht nur auf die Karte. */
  dropScope?: 'card' | 'window'
}

function iconFor(file: DocFile) {
  if (file.mime.startsWith('image/')) return FileImage
  if (file.mime.includes('sheet') || file.mime.includes('excel') || file.mime.startsWith('text/csv')) {
    return FileSpreadsheet
  }
  if (file.mime === 'application/zip') return FileArchive
  if (file.mime === 'application/pdf' || file.mime.includes('word') || file.mime.includes('opendocument')) {
    return FileText
  }
  return FileIcon
}

/** Erste aussagekräftige Zeile einer Vorlage – ohne reine Platzhalterzeilen. */
function preview(content: string): string {
  const line = content
    .split('\n')
    .map((s) => s.trim())
    .find((s) => s && !/^\{\{[^}]+\}\}$/.test(s))
  return line ? (line.length > 80 ? `${line.slice(0, 80)} …` : line) : 'leer'
}

export default function DocumentsPanel({ docs, space = 'bewerbung', dropScope = 'card' }: Props) {
  const isApplication = space === 'bewerbung'
  const categories = spaceCategories[space]
  const files = useMemo(() => filesIn(docs.files, space), [docs.files, space])

  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [windowDrag, setWindowDrag] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [templateDraft, setTemplateDraft] = useState<TemplateDraft | null>(null)

  const grouped = useMemo(
    () =>
      categories
        .map((category) => ({
          category,
          items: files
            .filter((f) => f.category === category)
            .sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || b.createdAt.localeCompare(a.createdAt)),
        }))
        .filter((g) => g.items.length > 0),
    [files, categories],
  )

  /** Aktion ausführen, Fehler als Hinweis zeigen. */
  const run = (fn: () => Promise<unknown>) => {
    void fn().catch((err: Error) => setNotice({ kind: 'warn', text: err.message }))
  }

  const handleFiles = async (list: FileList | null) => {
    const picked = list ? [...list] : []
    if (picked.length === 0) return
    setBusy(true)
    setNotice(null)
    try {
      await docs.upload(picked, space)
      setNotice({
        kind: 'ok',
        text: picked.length === 1 ? `„${picked[0].name}“ gespeichert.` : `${picked.length} Dateien gespeichert.`,
      })
    } catch (err) {
      setNotice({ kind: 'warn', text: (err as Error).message })
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  // Immer die aktuelle Fassung für die Fenster-Listener
  const handleFilesRef = useRef(handleFiles)
  handleFilesRef.current = handleFiles

  // Ganzes Fenster als Ablagefläche
  useEffect(() => {
    if (dropScope !== 'window') return
    let depth = 0
    const hasFiles = (e: DragEvent) => e.dataTransfer?.types.includes('Files') ?? false
    const onEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return
      depth += 1
      setWindowDrag(true)
    }
    const onLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return
      depth = Math.max(0, depth - 1)
      if (depth === 0) setWindowDrag(false)
    }
    const onOver = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault()
    }
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      depth = 0
      setWindowDrag(false)
      void handleFilesRef.current(e.dataTransfer?.files ?? null)
    }
    window.addEventListener('dragenter', onEnter)
    window.addEventListener('dragleave', onLeave)
    window.addEventListener('dragover', onOver)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragenter', onEnter)
      window.removeEventListener('dragleave', onLeave)
      window.removeEventListener('dragover', onOver)
      window.removeEventListener('drop', onDrop)
    }
  }, [dropScope])

  const cardDrop =
    dropScope === 'card'
      ? {
          onDragOver: (e: React.DragEvent) => {
            if (!e.dataTransfer.types.includes('Files')) return
            e.preventDefault()
            setDragOver(true)
          },
          onDragLeave: (e: React.DragEvent) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragOver(false)
          },
          onDrop: (e: React.DragEvent) => {
            e.preventDefault()
            setDragOver(false)
            void handleFiles(e.dataTransfer.files)
          },
        }
      : {}

  return (
    <div className="space-y-6">
      {notice && (
        <div
          className={cn(
            'flex items-start gap-2 rounded-lg border px-3 py-2 text-sm whitespace-pre-line',
            notice.kind === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200'
              : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200',
          )}
        >
          {notice.kind === 'ok' ? (
            <CircleCheck className="mt-0.5 size-4 shrink-0" />
          ) : (
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          )}
          <span className="flex-1">{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label="Hinweis schließen" className="opacity-60 hover:opacity-100">
            <X className="size-4" />
          </button>
        </div>
      )}

      {docs.error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          {docs.error}
        </div>
      )}

      {/* Dateien */}
      <section
        {...cardDrop}
        className={cn(
          'overflow-hidden rounded-xl border bg-white transition dark:bg-neutral-900',
          dragOver
            ? 'border-indigo-400 ring-2 ring-indigo-400/30 dark:border-indigo-500'
            : 'border-neutral-200 dark:border-neutral-800',
        )}
      >
        <div className="flex flex-wrap items-center gap-2 border-b border-neutral-200 px-4 py-2.5 dark:border-neutral-800">
          <h3 className="mr-auto text-sm font-semibold">Dateien</h3>
          <span className="text-xs text-neutral-400">
            {isApplication ? 'PDF, Word, Bilder' : 'PDF, Office, Bilder, CSV, ZIP'} · max. 50 MB · einfach
            hierher ziehen
          </span>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="flex items-center gap-1.5 rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:opacity-60 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            Hochladen
          </button>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPT}
            hidden
            onChange={(e) => void handleFiles(e.target.files)}
          />
        </div>

        {docs.loading ? (
          <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-neutral-500">
            <Loader2 className="size-4 animate-spin" />
            Lade Dateien…
          </div>
        ) : files.length === 0 ? (
          <div className="p-4">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex w-full flex-col items-center gap-2 rounded-lg border border-dashed border-neutral-300 px-6 py-12 text-center transition hover:border-neutral-400 dark:border-neutral-700 dark:hover:border-neutral-500"
            >
              <Upload className="size-8 text-neutral-300 dark:text-neutral-600" />
              <span className="text-sm font-medium">Dateien hierher ziehen oder klicken</span>
              <span className="max-w-sm text-xs text-neutral-500">
                {isApplication
                  ? 'Lebenslauf, Zeugnisse, Zertifikate …'
                  : 'Verträge, Rechnungen, Bescheide …'}{' '}
                Die Kategorie wird am Dateinamen erkannt und lässt sich danach ändern.
              </span>
            </button>
          </div>
        ) : (
          <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {grouped.map(({ category, items }) => (
              <div key={category}>
                <div className="bg-neutral-50/80 px-4 py-1.5 text-[11px] font-semibold tracking-wide text-neutral-500 uppercase dark:bg-neutral-950/40">
                  {docCategories[category].label}{' '}
                  <span className="text-neutral-400 tabular-nums">{items.length}</span>
                </div>
                <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
                  {items.map((file) => {
                    const Icon = iconFor(file)
                    const previewable = isPreviewable(file)
                    return (
                      <li key={file.id} className="group flex items-center gap-3 px-4 py-2.5">
                        <Icon className="size-5 shrink-0 text-neutral-400" />
                        <button
                          type="button"
                          onClick={() => run(() => (previewable ? openDocument(file) : downloadDocument(file)))}
                          title={previewable ? 'Öffnen' : 'Herunterladen'}
                          className="min-w-0 flex-1 text-left"
                        >
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-medium group-hover:underline">{file.title}</span>
                            {isApplication && file.isDefault && (
                              <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-500/20 dark:text-amber-200">
                                Standard
                              </span>
                            )}
                          </div>
                          <div className="truncate text-xs text-neutral-500">
                            {file.fileName} · {formatSize(file.size)} · {formatDateInput(new Date(file.createdAt))}
                          </div>
                        </button>

                        <select
                          value={file.category}
                          onChange={(e) =>
                            run(() => docs.updateFile(file.id, { category: e.target.value as DocCategory }))
                          }
                          aria-label="Kategorie"
                          className="hidden rounded-md border border-neutral-200 bg-white px-1.5 py-1 text-xs text-neutral-600 outline-none sm:block dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
                        >
                          {categories.map((c) => (
                            <option
                              key={c}
                              value={c}
                              className="bg-white text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100"
                            >
                              {docCategories[c].label}
                            </option>
                          ))}
                        </select>

                        <div className="flex shrink-0 items-center gap-0.5">
                          {isApplication && (
                            <IconButton
                              label={
                                file.isDefault
                                  ? 'Standard entfernen'
                                  : 'Als Standard markieren – wird bei neuen Bewerbungen vorausgewählt'
                              }
                              onClick={() => run(() => docs.updateFile(file.id, { isDefault: !file.isDefault }))}
                            >
                              <Star className={cn('size-4', file.isDefault && 'fill-amber-400 text-amber-500')} />
                            </IconButton>
                          )}
                          <IconButton label="Herunterladen" onClick={() => run(() => downloadDocument(file))}>
                            <Download className="size-4" />
                          </IconButton>
                          <IconButton
                            label="Umbenennen"
                            onClick={() => {
                              const title = prompt('Neuer Name', file.title)
                              if (title?.trim()) run(() => docs.updateFile(file.id, { title: title.trim() }))
                            }}
                          >
                            <Pencil className="size-4" />
                          </IconButton>
                          <IconButton
                            label="Löschen"
                            danger
                            onClick={() => {
                              if (confirm(`„${file.title}“ endgültig löschen?`)) run(() => docs.removeFile(file.id))
                            }}
                          >
                            <Trash2 className="size-4" />
                          </IconButton>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Anschreiben-Vorlagen – nur bei Bewerbungsunterlagen */}
      {isApplication && (
        <section className="overflow-hidden rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex flex-wrap items-center gap-2 border-b border-neutral-200 px-4 py-2.5 dark:border-neutral-800">
            <h3 className="mr-auto text-sm font-semibold">Anschreiben-Vorlagen</h3>
            <button
              type="button"
              onClick={() => setTemplateDraft({ title: '', content: '' })}
              className="flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-1.5 text-sm transition hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
            >
              <Plus className="size-4" />
              Vorlage
            </button>
          </div>

          {docs.templates.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <ScrollText className="mx-auto size-8 text-neutral-300 dark:text-neutral-600" />
              <p className="mx-auto mt-2 max-w-md text-sm text-neutral-500">
                Schreib dein Anschreiben einmal mit Platzhaltern wie {'{{firma}}'} und {'{{position}}'} – in jeder
                Bewerbung wird es dann mit einem Klick ausgefüllt.
              </p>
              <button
                type="button"
                onClick={() => setTemplateDraft({ title: 'Standard-Anschreiben', content: sampleTemplate })}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
              >
                <Sparkles className="size-4" />
                Mit Beispiel starten
              </button>
            </div>
          ) : (
            <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {docs.templates.map((t) => (
                <li key={t.id} className="group flex items-center gap-3 px-4 py-2.5">
                  <ScrollText className="size-5 shrink-0 text-neutral-400" />
                  <button type="button" onClick={() => setTemplateDraft(t)} className="min-w-0 flex-1 text-left">
                    <div className="truncate text-sm font-medium group-hover:underline">{t.title}</div>
                    <div className="truncate text-xs text-neutral-500">
                      {preview(t.content)} · geändert {formatDateInput(new Date(t.updatedAt))}
                    </div>
                  </button>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <IconButton
                      label="Text kopieren"
                      onClick={() =>
                        run(async () => {
                          await navigator.clipboard.writeText(t.content)
                          setNotice({ kind: 'ok', text: `„${t.title}“ in die Zwischenablage kopiert.` })
                        })
                      }
                    >
                      <Copy className="size-4" />
                    </IconButton>
                    <IconButton label="Bearbeiten" onClick={() => setTemplateDraft(t)}>
                      <Pencil className="size-4" />
                    </IconButton>
                    <IconButton
                      label="Löschen"
                      danger
                      onClick={() => {
                        if (confirm(`Vorlage „${t.title}“ löschen?`)) run(() => docs.removeTemplate(t.id))
                      }}
                    >
                      <Trash2 className="size-4" />
                    </IconButton>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Fenster-Ablage: sichtbare Rückmeldung beim Ziehen */}
      {windowDrag && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-indigo-500/10 p-6 backdrop-blur-[2px]">
          <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-indigo-400 bg-white/95 px-10 py-8 text-center shadow-xl dark:bg-neutral-900/95">
            <UploadCloud className="size-10 text-indigo-500" />
            <div className="text-base font-semibold">Loslassen zum Speichern</div>
            <div className="text-sm text-neutral-500">Die Kategorie wird am Dateinamen erkannt.</div>
          </div>
        </div>
      )}

      {templateDraft && (
        <TemplateDialog
          draft={templateDraft}
          onClose={() => setTemplateDraft(null)}
          onSave={async (t) => {
            await docs.saveTemplate(t)
            setTemplateDraft(null)
            setNotice({ kind: 'ok', text: `Vorlage „${t.title}“ gespeichert.` })
          }}
        />
      )}
    </div>
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
