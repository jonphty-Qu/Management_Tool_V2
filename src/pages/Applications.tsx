import { useMemo, useState } from 'react'
import {
  Plus,
  Pencil,
  Trash2,
  X,
  ExternalLink,
  TriangleAlert,
  Search,
  Wand2,
  Loader2,
  Link2,
  CircleCheck,
  Paperclip,
  PenLine,
  Eye,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import {
  applyParsedJob,
  hostOf,
  newApplicationId,
  parseJobUrl,
  normalizeUrl,
  statusMeta,
  statusOrder,
  useApplications,
  type AppStatus,
  type Application,
} from '@/lib/applications'
import { DateInput } from '@/components/DateInput'
import { formatDateInput, startOfDay } from '@/lib/date'
import { useSearchParams } from 'react-router-dom'
import DocumentsPanel from '@/components/applications/DocumentsPanel'
import CoverLetterDialog from '@/components/applications/CoverLetterDialog'
import ApplicationDetails from '@/components/applications/ApplicationDetails'
import {
  docCategories,
  fillTemplate,
  letterValues,
  filesIn,
  useDocuments,
  type DocFile,
  type DocTemplate,
} from '@/lib/documents'
import { useSettings } from '@/lib/settings'

const inputClass =
  'rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-sm outline-none transition focus:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-800 dark:focus:border-neutral-500'

export default function Applications() {
  const { applications, save, remove, setStatus, counts, duplicates } = useApplications()
  const docs = useDocuments()
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'unterlagen' ? 'unterlagen' : 'uebersicht'
  const docById = useMemo(() => new Map(docs.files.map((d) => [d.id, d])), [docs.files])
  const applicationDocs = useMemo(() => filesIn(docs.files, 'bewerbung'), [docs.files])
  const [filter, setFilter] = useState<AppStatus | 'alle'>('alle')
  const [query, setQuery] = useState('')
  const [draft, setDraft] = useState<Application | null>(null)
  const [existing, setExisting] = useState(false)
  const [importUrl, setImportUrl] = useState('')
  const [importing, setImporting] = useState(false)
  const [importNote, setImportNote] = useState<ImportNote | null>(null)
  const [detailsId, setDetailsId] = useState<string | null>(null)
  const detailsApp = detailsId ? applications.find((app) => app.id === detailsId) ?? null : null

  /** Link auslesen und eine vorausgefüllte Bewerbung zum Prüfen öffnen. */
  const importFromUrl = async (raw: string) => {
    const url = raw.trim()
    if (!url || importing) return
    setImporting(true)
    const { job, error } = await parseJobUrl(url)
    setImporting(false)
    setImportUrl('')
    setExisting(false)
    setDraft(
      applyParsedJob(
        { id: newApplicationId(), company: '', position: '', status: 'entwurf' },
        { ...job, url: job.url ?? url },
      ),
    )
    setImportNote(
      error
        ? { kind: 'warn', text: error }
        : job.via === 'none'
          ? { kind: 'warn', text: 'Die Seite liefert keine Stellendaten – bitte die Felder ergänzen.' }
          : { kind: 'ok', text: 'Automatisch ausgelesen – bitte kurz prüfen und speichern.' },
    )
  }

  const closeDialog = () => {
    setDraft(null)
    setImportNote(null)
  }

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return applications
      .filter((a) => (filter === 'alle' ? true : a.status === filter))
      .filter((a) =>
        q
          ? [a.company, a.position, a.location, a.source]
              .join(' ')
              .toLowerCase()
              .includes(q)
          : true,
      )
      .sort((a, b) => {
        const da = a.appliedAt ? new Date(a.appliedAt).getTime() : 0
        const db = b.appliedAt ? new Date(b.appliedAt).getTime() : 0
        return db - da || a.company.localeCompare(b.company)
      })
  }, [applications, filter, query])

  const openNew = () => {
    setExisting(false)
    setDraft({
      id: newApplicationId(),
      company: '',
      position: '',
      status: 'entwurf',
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Bewerbungen</h2>
          <p className="text-sm text-neutral-500">
            Überblick, wo du dich beworben hast – mit Link zur Stelle und zum Unternehmen.
          </p>
        </div>
        {tab === 'uebersicht' && (
        <button
          type="button"
          onClick={openNew}
          className="ml-auto flex items-center gap-1.5 rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          <Plus className="size-4" />
          Bewerbung
        </button>
        )}
      </div>

      {/* Reiter */}
      <div className="flex gap-1 border-b border-neutral-200 dark:border-neutral-800">
        {(
          [
            ['uebersicht', 'Übersicht'],
            ['unterlagen', 'Unterlagen'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setParams(key === 'uebersicht' ? {} : { tab: key })}
            className={cn(
              '-mb-px border-b-2 px-3 py-2 text-sm transition',
              tab === key
                ? 'border-neutral-900 font-medium text-neutral-900 dark:border-white dark:text-white'
                : 'border-transparent text-neutral-500 hover:text-neutral-900 dark:hover:text-white',
            )}
          >
            {label}
            {key === 'unterlagen' && applicationDocs.length > 0 && (
              <span className="ml-1.5 text-neutral-400 tabular-nums">{applicationDocs.length}</span>
            )}
          </button>
        ))}
      </div>

      {tab === 'uebersicht' ? (
        <>
      {/* Link einfügen → Bewerbung wird ausgefüllt */}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void importFromUrl(importUrl)
        }}
        className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-white p-1.5 pl-3 dark:border-neutral-800 dark:bg-neutral-900"
      >
        <Link2 className="size-4 shrink-0 text-neutral-400" />
        <input
          value={importUrl}
          onChange={(e) => setImportUrl(e.target.value)}
          onPaste={(e) => {
            const pasted = e.clipboardData.getData('text').trim()
            if (/^(https?:\/\/|www\.)\S+$/i.test(pasted)) {
              e.preventDefault()
              setImportUrl(pasted)
              void importFromUrl(pasted)
            }
          }}
          disabled={importing}
          placeholder="Link zur Stellenanzeige einfügen – die Angaben werden automatisch ausgelesen"
          className="min-w-0 flex-1 bg-transparent py-1.5 text-sm outline-none placeholder:text-neutral-400"
        />
        <button
          type="submit"
          disabled={importing || !importUrl.trim()}
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:opacity-40 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          {importing ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />}
          {importing ? 'Lese aus…' : 'Auslesen'}
        </button>
      </form>

      {/* Status-Filter mit Zählern */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setFilter('alle')}
          className={cn(
            'rounded-lg border px-3 py-1.5 text-sm transition',
            filter === 'alle'
              ? 'border-neutral-900 font-medium dark:border-white'
              : 'border-neutral-200 text-neutral-500 hover:border-neutral-300 dark:border-neutral-700',
          )}
        >
          Alle <span className="tabular-nums">{applications.length}</span>
        </button>

        {statusOrder.map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setFilter(status)}
            className={cn(
              'flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition',
              filter === status
                ? 'border-neutral-900 font-medium dark:border-white'
                : 'border-neutral-200 text-neutral-500 hover:border-neutral-300 dark:border-neutral-700',
            )}
          >
            <span className={cn('size-2 rounded-full', statusMeta[status].dot)} />
            {statusMeta[status].label}
            <span className="tabular-nums">{counts[status] ?? 0}</span>
          </button>
        ))}

        <div className="relative ml-auto">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-neutral-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Firma oder Position…"
            className={cn(inputClass, 'w-56 pl-8')}
          />
        </div>
      </div>

      {/* Liste */}
      <section className="overflow-hidden rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500 dark:border-neutral-800">
                <th className="px-4 py-2 font-medium">Unternehmen</th>
                <th className="px-4 py-2 font-medium">Position</th>
                <th className="px-4 py-2 font-medium">Links</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Beworben</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {visible.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-neutral-500">
                    Keine Bewerbungen in dieser Ansicht.
                  </td>
                </tr>
              )}

              {visible.map((app) => (
                <tr
                  key={app.id}
                  className="group transition hover:bg-neutral-50 dark:hover:bg-neutral-800/40"
                >
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1.5 font-medium">
                      <span className="truncate">{app.company || '–'}</span>
                      {duplicates.has(app.id) && (
                        <span
                          title="Bei diesem Unternehmen liegt schon eine weitere Bewerbung"
                          className="flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-500/20 dark:text-amber-200"
                        >
                          <TriangleAlert className="size-3" />
                          mehrfach
                        </span>
                      )}
                    </div>
                    {app.location && (
                      <div className="text-xs text-neutral-500">{app.location}</div>
                    )}
                  </td>

                  <td className="px-4 py-2.5 text-neutral-600 dark:text-neutral-300">
                    {app.position || '–'}
                    {app.source && (
                      <div className="text-xs text-neutral-500">über {app.source}</div>
                    )}
                  </td>

                  <td className="px-4 py-2.5">
                    <div className="flex flex-col gap-0.5">
                      {app.jobUrl && <LinkChip url={app.jobUrl} label="Stelle" />}
                      {app.companyUrl && <LinkChip url={app.companyUrl} label="Firma" />}
                      {!app.jobUrl && !app.companyUrl && (
                        <span className="text-xs text-neutral-400">–</span>
                      )}
                      {(() => {
                        const attached = (app.documentIds ?? [])
                          .map((id) => docById.get(id))
                          .filter((d): d is DocFile => Boolean(d))
                        return attached.length > 0 ? (
                          <span
                            className="flex items-center gap-1 text-xs text-neutral-500"
                            title={attached.map((d) => d.title).join('\n')}
                          >
                            <Paperclip className="size-3 shrink-0" />
                            {attached.length === 1 ? '1 Unterlage' : `${attached.length} Unterlagen`}
                          </span>
                        ) : null
                      })()}
                    </div>
                  </td>

                  <td className="px-4 py-2.5">
                    <select
                      value={app.status}
                      onChange={(e) => setStatus(app.id, e.target.value as AppStatus)}
                      className={cn(
                        'cursor-pointer rounded border-0 px-1.5 py-1 text-xs font-medium outline-none',
                        statusMeta[app.status].className,
                      )}
                    >
                      {statusOrder.map((status) => (
                        <option
                          key={status}
                          value={status}
                          className="bg-white text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100"
                        >
                          {statusMeta[status].label}
                        </option>
                      ))}
                    </select>
                  </td>

                  <td className="px-4 py-2.5 whitespace-nowrap text-neutral-600 tabular-nums dark:text-neutral-300">
                    {app.appliedAt ? formatDateInput(new Date(app.appliedAt)) : '–'}
                  </td>

                  <td className="px-2 py-2.5">
                    <div className="flex justify-end gap-0.5 opacity-0 transition group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={() => setDetailsId(detailsId === app.id ? null : app.id)}
                        className={cn(
                          'rounded p-1.5 transition hover:bg-neutral-200 hover:text-neutral-900 dark:hover:bg-neutral-700 dark:hover:text-white',
                          detailsId === app.id ? 'text-neutral-900 dark:text-white' : 'text-neutral-400',
                        )}
                        aria-label={detailsId === app.id ? 'Details schließen' : 'Details öffnen'}
                        aria-expanded={detailsId === app.id}
                      >
                        <Eye className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setExisting(true)
                          setDraft(app)
                        }}
                        className="rounded p-1.5 text-neutral-400 transition hover:bg-neutral-200 hover:text-neutral-900 dark:hover:bg-neutral-700 dark:hover:text-white"
                        aria-label="Bearbeiten"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(app.id)}
                        className="rounded p-1.5 text-neutral-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                        aria-label="Löschen"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

        </>
      ) : (
        <DocumentsPanel docs={docs} />
      )}

      {detailsApp && tab === 'uebersicht' && (
        <ApplicationDetails
          app={detailsApp}
          onChange={save}
          onEdit={() => {
            setExisting(true)
            setDraft(detailsApp)
          }}
        />
      )}

      {draft && (
        <ApplicationDialog
          draft={draft}
          existing={existing}
          note={importNote}
          docs={applicationDocs}
          templates={docs.templates}
          onSave={(app) => {
            save(app)
            closeDialog()
          }}
          onDelete={(id) => {
            remove(id)
            closeDialog()
          }}
          onClose={closeDialog}
        />
      )}
    </div>
  )
}

function LinkChip({ url, label }: { url: string; label: string }) {
  const { settings } = useSettings()
  const open = async (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (settings.externalBrowser !== 'firefox') return
    event.preventDefault()
    const response = await fetch('/api/browser/open', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-requested-with': 'management-tool' }, body: JSON.stringify({ url }) }).catch(() => null)
    if (!response?.ok) window.open(url, '_blank', 'noopener,noreferrer')
  }
  return (
    <a
      href={url}
      onClick={(event) => void open(event)}
      target="_blank"
      rel="noreferrer noopener"
      className="flex items-center gap-1 text-xs text-indigo-600 hover:underline dark:text-indigo-400"
      title={url}
    >
      <ExternalLink className="size-3 shrink-0" />
      <span className="truncate">
        {label}: {hostOf(url)}
      </span>
    </a>
  )
}

interface ImportNote {
  kind: 'ok' | 'warn'
  text: string
}

function ApplicationDialog({
  draft,
  existing,
  note,
  docs,
  templates,
  onSave,
  onDelete,
  onClose,
}: {
  draft: Application
  existing: boolean
  note: ImportNote | null
  docs: DocFile[]
  templates: DocTemplate[]
  onSave: (app: Application) => void
  onDelete: (id: string) => void
  onClose: () => void
}) {
  const { settings } = useSettings()
  const [form, setForm] = useState<Application>(() =>
    existing || draft.documentIds
      ? draft
      : { ...draft, documentIds: docs.filter((d) => d.isDefault).map((d) => d.id) },
  )
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? '')
  const [letter, setLetter] = useState<string | null>(null)
  const [banner, setBanner] = useState<ImportNote | null>(note)
  const [reading, setReading] = useState(false)

  /** Link im Dialog (erneut) auslesen. */
  const readLink = async () => {
    if (!form.jobUrl?.trim() || reading) return
    setReading(true)
    const { job, error } = await parseJobUrl(form.jobUrl)
    setReading(false)
    setForm((f) => applyParsedJob(f, job))
    setBanner(
      error
        ? { kind: 'warn', text: error }
        : job.via === 'none'
          ? { kind: 'warn', text: 'Die Seite liefert keine Stellendaten.' }
          : { kind: 'ok', text: 'Angaben aus dem Link übernommen.' },
    )
  }

  const set = <K extends keyof Application>(key: K, value: Application[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        // Nur ein Druck auf den Hintergrund selbst schließt
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <form
        onMouseDown={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault()
          onSave({
            ...form,
            company: form.company.trim() || 'Ohne Namen',
            jobUrl: form.jobUrl ? normalizeUrl(form.jobUrl) : undefined,
            companyUrl: form.companyUrl ? normalizeUrl(form.companyUrl) : undefined,
          })
        }}
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-neutral-200 bg-white shadow-2xl dark:border-neutral-800 dark:bg-neutral-900"
      >
        <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-3.5 dark:border-neutral-800">
          <h2 className="text-sm font-semibold">
            {existing ? 'Bewerbung bearbeiten' : 'Neue Bewerbung'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-neutral-400 transition hover:bg-neutral-100 dark:hover:bg-neutral-800"
            aria-label="Schließen"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-3 px-5 py-4">
          {banner && (
            <div
              className={cn(
                'flex items-start gap-2 rounded-lg border px-3 py-2 text-xs',
                banner.kind === 'ok'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200'
                  : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200',
              )}
            >
              {banner.kind === 'ok' ? (
                <CircleCheck className="mt-px size-3.5 shrink-0" />
              ) : (
                <TriangleAlert className="mt-px size-3.5 shrink-0" />
              )}
              {banner.text}
            </div>
          )}

          <Field label="Unternehmen">
            <input
              autoFocus
              value={form.company}
              onChange={(e) => set('company', e.target.value)}
              className={cn(inputClass, 'w-full')}
            />
          </Field>

          <Field label="Position">
            <input
              value={form.position}
              onChange={(e) => set('position', e.target.value)}
              className={cn(inputClass, 'w-full')}
            />
          </Field>

          <Field label="Link zur Stellenanzeige">
            <div className="flex gap-2">
              <input
                value={form.jobUrl ?? ''}
                onChange={(e) => set('jobUrl', e.target.value)}
                placeholder="https://…"
                className={cn(inputClass, 'min-w-0 flex-1')}
              />
              <button
                type="button"
                onClick={() => void readLink()}
                disabled={reading || !form.jobUrl?.trim()}
                title="Angaben aus dem Link auslesen"
                className="flex shrink-0 items-center gap-1.5 rounded-lg border border-neutral-200 px-2.5 text-sm transition hover:bg-neutral-50 disabled:opacity-40 dark:border-neutral-700 dark:hover:bg-neutral-800"
              >
                {reading ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />}
                Auslesen
              </button>
            </div>
            {form.jobUrl && <div className="mt-1.5"><LinkChip url={normalizeUrl(form.jobUrl)} label="Im Browser öffnen" /></div>}
          </Field>

          <Field label="Link zum Unternehmen">
            <input
              value={form.companyUrl ?? ''}
              onChange={(e) => set('companyUrl', e.target.value)}
              placeholder="https://…"
              className={cn(inputClass, 'w-full')}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Ort">
              <input
                value={form.location ?? ''}
                onChange={(e) => set('location', e.target.value)}
                placeholder="z. B. Remote"
                className={cn(inputClass, 'w-full')}
              />
            </Field>

            <Field label="Gefunden über">
              <input
                value={form.source ?? ''}
                onChange={(e) => set('source', e.target.value)}
                placeholder="z. B. LinkedIn"
                className={cn(inputClass, 'w-full')}
              />
            </Field>
          </div>

          <Group label="Status">
            <div className="flex flex-wrap gap-1.5">
              {statusOrder.map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      status,
                      // Wie in der Tabelle: beim Abschicken das Datum setzen, falls noch keins da ist
                      appliedAt:
                        status !== 'entwurf' && !f.appliedAt
                          ? startOfDay(new Date()).toISOString()
                          : f.appliedAt,
                    }))
                  }
                  className={cn(
                    'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition',
                    form.status === status
                      ? 'border-neutral-900 font-medium dark:border-white'
                      : 'border-neutral-200 text-neutral-500 hover:border-neutral-300 dark:border-neutral-700 dark:hover:border-neutral-600',
                  )}
                >
                  <span className={cn('size-2 rounded-full', statusMeta[status].dot)} />
                  {statusMeta[status].label}
                </button>
              ))}
            </div>
          </Group>

          <Group label="Beworben am">
            {form.appliedAt ? (
              <div className="flex items-center gap-2">
                <DateInput
                  value={new Date(form.appliedAt)}
                  onChange={(d) => set('appliedAt', d.toISOString())}
                />
                <button
                  type="button"
                  onClick={() => set('appliedAt', undefined)}
                  className="text-xs text-neutral-500 hover:underline"
                >
                  leeren
                </button>
              </div>
            ) : (
              // Ohne Datum nichts vortäuschen – ein angezeigtes "heute" würde nicht gespeichert
              <button
                type="button"
                onClick={() => set('appliedAt', startOfDay(new Date()).toISOString())}
                className="rounded-lg border border-dashed border-neutral-300 px-2.5 py-1.5 text-sm text-neutral-500 transition hover:border-neutral-400 hover:text-neutral-900 dark:border-neutral-700 dark:hover:border-neutral-500 dark:hover:text-white"
              >
                Noch nicht beworben – Datum setzen
              </button>
            )}
          </Group>

          <Group label="Mitgeschickte Unterlagen">
            {docs.length === 0 ? (
              <p className="text-xs text-neutral-400">
                Noch keine Unterlagen – im Reiter „Unterlagen“ hochladen.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {docs.map((doc) => {
                  const on = form.documentIds?.includes(doc.id) ?? false
                  return (
                    <button
                      key={doc.id}
                      type="button"
                      title={doc.fileName}
                      onClick={() =>
                        set(
                          'documentIds',
                          on
                            ? (form.documentIds ?? []).filter((id) => id !== doc.id)
                            : [...(form.documentIds ?? []), doc.id],
                        )
                      }
                      className={cn(
                        'flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition',
                        on
                          ? 'border-neutral-900 font-medium dark:border-white'
                          : 'border-neutral-200 text-neutral-500 hover:border-neutral-300 dark:border-neutral-700 dark:hover:border-neutral-600',
                      )}
                    >
                      <Paperclip className="size-3 shrink-0" />
                      <span className="truncate">
                        {docCategories[doc.category].label} · {doc.title}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </Group>

          <Group label="Anschreiben">
            {templates.length === 0 ? (
              <p className="text-xs text-neutral-400">
                Lege im Reiter „Unterlagen“ eine Vorlage an – hier wird sie dann mit Firma und
                Position ausgefüllt.
              </p>
            ) : (
              <div className="flex gap-2">
                <select
                  value={templateId}
                  onChange={(e) => setTemplateId(e.target.value)}
                  aria-label="Vorlage"
                  className={cn(inputClass, 'min-w-0 flex-1')}
                >
                  {templates.map((t) => (
                    <option
                      key={t.id}
                      value={t.id}
                      className="bg-white text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100"
                    >
                      {t.title}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    const t = templates.find((x) => x.id === templateId) ?? templates[0]
                    setLetter(fillTemplate(t.content, letterValues(form, settings)))
                  }}
                  className="flex shrink-0 items-center gap-1.5 rounded-lg border border-neutral-200 px-2.5 text-sm transition hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
                >
                  <PenLine className="size-4" />
                  Ausfüllen
                </button>
              </div>
            )}
          </Group>

          <Field label="Notizen">
            <textarea
              value={form.notes ?? ''}
              onChange={(e) => set('notes', e.target.value)}
              rows={3}
              className={cn(inputClass, 'w-full resize-y')}
            />
          </Field>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-neutral-200 px-5 py-3.5 dark:border-neutral-800">
          {existing ? (
            <button
              type="button"
              onClick={() => onDelete(form.id)}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
            >
              <Trash2 className="size-4" />
              Löschen
            </button>
          ) : (
            <span />
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-neutral-200 px-3 py-1.5 text-sm transition hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              className="rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
            >
              Speichern
            </button>
          </div>
        </div>
        {letter !== null && <CoverLetterDialog text={letter} onClose={() => setLetter(null)} />}
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

/** Wie Field, aber ohne <label> – ein Label würde beim Klick auf die Überschrift den ersten Knopf auslösen. */
function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="mb-1 block text-xs font-medium text-neutral-500">{label}</span>
      {children}
    </div>
  )
}
