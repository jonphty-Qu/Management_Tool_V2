import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ExternalLink,
  Loader2,
  Search,
  Wand2,
  Mail,
  Send,
  Trash2,
  CalendarPlus,
  CalendarCheck,
  MapPin,
  Pencil,
  TriangleAlert,
  Bell,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { parseJobUrl, type Application, type LinkedMail } from '@/lib/applications'
import { searchMailsFor, type MailHit } from '@/lib/mailSearch'
import { useEventStore } from '@/lib/store'
import type { CalEvent } from '@/lib/events'
import { formatDateInput, formatDayLong, formatTime } from '@/lib/date'
import { formatAlert } from '../AlertPicker'
import InterviewDialog from './InterviewDialog'

interface Props {
  app: Application
  onChange: (app: Application) => void
  onEdit: () => void
}

const mailKey = (m: Pick<LinkedMail, 'accountId' | 'folder' | 'uid'>) => `${m.accountId}:${m.folder}:${m.uid}`

/** Nur die Felder, die dauerhaft an der Bewerbung gespeichert werden. */
function toLinked(hit: MailHit, isRejection = false): LinkedMail {
  const { rejection: _r, invitation: _i, ...mail } = hit
  return isRejection ? { ...mail, isRejection: true } : mail
}

const smallButton =
  'flex items-center gap-1.5 rounded-lg border border-neutral-200 px-2.5 py-1 text-xs transition hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-800'

/** Aufgeklappte Bewerbung: Stellenanzeige, E-Mail-Verlauf, Vorstellungsgespräche. */
export default function ApplicationDetails({ app, onChange, onEdit }: Props) {
  const { events, save: saveEvent, remove: removeEvent } = useEventStore()
  const interviews = events
    .filter((e) => app.interviewIds?.includes(e.id))
    .sort((a, b) => a.start.localeCompare(b.start))
  const linked = [...(app.emails ?? [])].sort((a, b) => b.date.localeCompare(a.date))
  const linkedKeys = new Set(linked.map(mailKey))

  const [reading, setReading] = useState(false)
  const [readError, setReadError] = useState<string | null>(null)
  const [searching, setSearching] = useState(false)
  const [hits, setHits] = useState<MailHit[] | null>(null)
  const [searchErrors, setSearchErrors] = useState<string[]>([])
  const [openMail, setOpenMail] = useState<string | null>(null)
  const [interviewFor, setInterviewFor] = useState<{ note?: string; mail?: MailHit } | null>(null)

  const newHits = (hits ?? []).filter((h) => !linkedKeys.has(mailKey(h)))

  /** Nur die Beschreibung nachladen – Firma/Position hat der Nutzer evtl. selbst angepasst. */
  const loadPosting = async () => {
    if (!app.jobUrl) return
    setReading(true)
    setReadError(null)
    const { job, error } = await parseJobUrl(app.jobUrl)
    setReading(false)
    if (job.description) onChange({ ...app, jobDescription: job.description })
    else setReadError(error ?? 'Die Seite liefert keine Stellenbeschreibung.')
  }

  const search = async () => {
    setSearching(true)
    setSearchErrors([])
    try {
      const result = await searchMailsFor(app)
      setHits(result.hits)
      setSearchErrors(result.errors)
    } catch (err) {
      setHits([])
      setSearchErrors([(err as Error).message])
    } finally {
      setSearching(false)
    }
  }

  const attach = (hit: MailHit, asRejection = false) => {
    onChange({
      ...app,
      emails: [...(app.emails ?? []), toLinked(hit, asRejection)],
      status: asRejection ? 'absage' : app.status,
    })
  }

  const detach = (mail: LinkedMail) =>
    onChange({ ...app, emails: (app.emails ?? []).filter((m) => mailKey(m) !== mailKey(mail)) })

  const saveInterview = (event: CalEvent, mail?: MailHit) => {
    saveEvent(event)
    const emails = mail && !linkedKeys.has(mailKey(mail)) ? [...(app.emails ?? []), toLinked(mail)] : app.emails
    onChange({
      ...app,
      emails,
      interviewIds: [...(app.interviewIds ?? []), event.id],
      // Ein Gespräch heißt: mindestens „Gespräch“ – Zusage/Absage bleiben stehen
      status: app.status === 'entwurf' || app.status === 'abgeschickt' ? 'gespraech' : app.status,
    })
    setInterviewFor(null)
  }

  const deleteInterview = (id: string) => {
    if (!confirm('Gespräch aus dem Kalender löschen?')) return
    removeEvent(id)
    onChange({ ...app, interviewIds: (app.interviewIds ?? []).filter((x) => x !== id) })
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      {/* Stellenanzeige */}
      <Panel
        title="Stellenanzeige"
        actions={
          <>
            {app.jobUrl && (
              <a href={app.jobUrl} target="_blank" rel="noreferrer noopener" className={smallButton}>
                <ExternalLink className="size-3.5" />
                Original
              </a>
            )}
            <button type="button" onClick={onEdit} className={smallButton}>
              <Pencil className="size-3.5" />
              Bearbeiten
            </button>
          </>
        }
      >
        {app.jobDescription ? (
          <div className="max-h-96 overflow-y-auto pr-1 text-sm leading-relaxed whitespace-pre-line text-neutral-700 dark:text-neutral-300">
            {app.jobDescription}
          </div>
        ) : (
          <div className="text-sm text-neutral-500">
            Noch keine Stellenbeschreibung gespeichert.
            {app.jobUrl ? (
              <button
                type="button"
                onClick={() => void loadPosting()}
                disabled={reading}
                className={cn(smallButton, 'mt-3 text-sm')}
              >
                {reading ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />}
                Aus dem Link laden
              </button>
            ) : (
              ' Trag einen Link zur Stellenanzeige ein, dann lässt sie sich hier anzeigen.'
            )}
            {readError && (
              <p className="mt-2 flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-300">
                <TriangleAlert className="mt-px size-3.5 shrink-0" />
                {readError}
              </p>
            )}
          </div>
        )}
        {app.notes && (
          <div className="mt-3 border-t border-neutral-100 pt-3 text-xs whitespace-pre-line text-neutral-500 dark:border-neutral-800">
            {app.notes}
          </div>
        )}
      </Panel>

      <div className="min-w-0 space-y-4">
        {/* E-Mail-Verlauf */}
        <Panel
          title="E-Mail-Verlauf"
          actions={
            <button type="button" onClick={() => void search()} disabled={searching} className={smallButton}>
              {searching ? <Loader2 className="size-3.5 animate-spin" /> : <Search className="size-3.5" />}
              {hits ? 'Erneut suchen' : 'Passende Mails suchen'}
            </button>
          }
        >
          {linked.length === 0 && !hits && !searching && (
            <p className="text-sm text-neutral-500">
              Noch keine Mails zugeordnet. Die Suche findet Mails von und an das Unternehmen in deinen Postfächern.
            </p>
          )}

          {linked.length > 0 && (
            <ul className="space-y-1.5">
              {linked.map((m) => (
                <MailItem
                  key={mailKey(m)}
                  mail={m}
                  open={openMail === mailKey(m)}
                  onToggle={() => setOpenMail(openMail === mailKey(m) ? null : mailKey(m))}
                  trailing={
                    <button
                      type="button"
                      onClick={() => detach(m)}
                      title="Zuordnung entfernen"
                      aria-label="Zuordnung entfernen"
                      className="rounded p-1 text-neutral-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  }
                />
              ))}
            </ul>
          )}

          {searching && (
            <p className="flex items-center gap-2 py-3 text-sm text-neutral-500">
              <Loader2 className="size-4 animate-spin" />
              Postfächer werden durchsucht…
            </p>
          )}

          {searchErrors.map((e) => (
            <p key={e} className="mt-2 flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-300">
              <TriangleAlert className="mt-px size-3.5 shrink-0" />
              <span>
                {e}
                {e.includes('Postfach') && (
                  <>
                    {' '}
                    <Link to="/mail" className="font-medium underline underline-offset-2">
                      Postfach einbinden
                    </Link>
                  </>
                )}
              </span>
            </p>
          ))}

          {hits && !searching && (
            <div className="mt-3 border-t border-neutral-100 pt-3 dark:border-neutral-800">
              <div className="mb-1.5 text-[11px] font-semibold tracking-wide text-neutral-400 uppercase">
                Gefunden · {newHits.length}
              </div>
              {newHits.length === 0 ? (
                <p className="text-sm text-neutral-500">Keine weiteren passenden Mails im letzten Jahr.</p>
              ) : (
                <ul className="space-y-1.5">
                  {newHits.map((h) => (
                    <MailItem
                      key={mailKey(h)}
                      mail={h}
                      flags={h}
                      open={openMail === mailKey(h)}
                      onToggle={() => setOpenMail(openMail === mailKey(h) ? null : mailKey(h))}
                      footer={
                        <>
                          {h.rejection && (
                            <button
                              type="button"
                              onClick={() => attach(h, true)}
                              className={cn(smallButton, 'border-rose-200 text-rose-700 dark:border-rose-900 dark:text-rose-300')}
                            >
                              Als Absage zuordnen
                            </button>
                          )}
                          {h.invitation && (
                            <button
                              type="button"
                              onClick={() => setInterviewFor({ mail: h, note: h.subject })}
                              className={cn(smallButton, 'border-violet-200 text-violet-700 dark:border-violet-900 dark:text-violet-300')}
                            >
                              Gespräch eintragen
                            </button>
                          )}
                          <button type="button" onClick={() => attach(h)} className={smallButton}>
                            Zuordnen
                          </button>
                        </>
                      }
                    />
                  ))}
                </ul>
              )}
            </div>
          )}
        </Panel>

        {/* Vorstellungsgespräche */}
        <Panel
          title="Vorstellungsgespräche"
          actions={
            <button type="button" onClick={() => setInterviewFor({})} className={smallButton}>
              <CalendarPlus className="size-3.5" />
              Gespräch eintragen
            </button>
          }
        >
          {interviews.length === 0 ? (
            <p className="text-sm text-neutral-500">
              Noch kein Gespräch eingetragen. Es landet im Kalender – mit Erinnerungen.
            </p>
          ) : (
            <ul className="space-y-2">
              {interviews.map((ev) => {
                const past = new Date(ev.end) < new Date()
                return (
                  <li
                    key={ev.id}
                    className={cn(
                      'flex items-start gap-3 rounded-lg border border-neutral-200 px-3 py-2 dark:border-neutral-800',
                      past && 'opacity-60',
                    )}
                  >
                    <CalendarCheck className="mt-0.5 size-4 shrink-0 text-violet-500" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">
                        {formatDayLong(new Date(ev.start))}, {formatTime(new Date(ev.start))}–
                        {formatTime(new Date(ev.end))}
                        {past && <span className="ml-1.5 text-xs font-normal text-neutral-400">vorbei</span>}
                      </div>
                      {ev.location && (
                        <div className="flex items-center gap-1 truncate text-xs text-neutral-500">
                          <MapPin className="size-3 shrink-0" />
                          {ev.location}
                        </div>
                      )}
                      {ev.alerts && ev.alerts.length > 0 && (
                        <div className="flex items-center gap-1 text-xs text-neutral-400">
                          <Bell className="size-3 shrink-0" />
                          {ev.alerts.map((m) => formatAlert(m)).join(', ')}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => deleteInterview(ev.id)}
                      title="Gespräch löschen"
                      aria-label="Gespräch löschen"
                      className="rounded p-1 text-neutral-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </Panel>
      </div>

      {interviewFor && (
        <InterviewDialog
          app={app}
          initialNote={interviewFor.note}
          onClose={() => setInterviewFor(null)}
          onSave={(event) => saveInterview(event, interviewFor.mail)}
        />
      )}
    </div>
  )
}

function Panel({ title, actions, children }: { title: string; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="min-w-0 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h4 className="mr-auto text-sm font-semibold">{title}</h4>
        {actions}
      </div>
      {children}
    </section>
  )
}

function Badge({ tone, children }: { tone: 'rose' | 'violet'; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium',
        tone === 'rose'
          ? 'bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-200'
          : 'bg-violet-100 text-violet-800 dark:bg-violet-500/20 dark:text-violet-200',
      )}
    >
      {children}
    </span>
  )
}

function MailItem({
  mail,
  flags,
  open,
  onToggle,
  trailing,
  footer,
}: {
  mail: LinkedMail
  flags?: { rejection: boolean; invitation: boolean }
  open: boolean
  onToggle: () => void
  trailing?: React.ReactNode
  footer?: React.ReactNode
}) {
  const Icon = mail.direction === 'out' ? Send : Mail
  return (
    <li className="rounded-lg border border-neutral-200 dark:border-neutral-800">
      <div className="flex items-start gap-2.5 px-3 py-2">
        <Icon className="mt-0.5 size-4 shrink-0 text-neutral-400" />
        <button type="button" onClick={onToggle} aria-expanded={open} className="min-w-0 flex-1 text-left">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-medium">{mail.subject}</span>
            {mail.isRejection && <Badge tone="rose">Absage</Badge>}
            {flags?.rejection && <Badge tone="rose">Absage erkannt</Badge>}
            {flags?.invitation && <Badge tone="violet">Einladung erkannt</Badge>}
          </div>
          <div className="truncate text-xs text-neutral-500">
            {mail.direction === 'out' ? 'an' : 'von'} {mail.from} · {formatDateInput(new Date(mail.date))}
          </div>
        </button>
        {mail.link && (
          <a
            href={mail.link}
            target="_blank"
            rel="noreferrer noopener"
            title="Im Postfach öffnen"
            aria-label="Im Postfach öffnen"
            className="rounded p-1 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-white"
          >
            <ExternalLink className="size-3.5" />
          </a>
        )}
        {trailing}
      </div>
      {open && mail.snippet && (
        <div className="border-t border-neutral-100 px-3 py-2 text-xs leading-relaxed whitespace-pre-line text-neutral-600 dark:border-neutral-800 dark:text-neutral-300">
          {mail.snippet}
        </div>
      )}
      {footer && (
        <div className="flex flex-wrap justify-end gap-1.5 border-t border-neutral-100 px-3 py-1.5 dark:border-neutral-800">
          {footer}
        </div>
      )}
    </li>
  )
}
