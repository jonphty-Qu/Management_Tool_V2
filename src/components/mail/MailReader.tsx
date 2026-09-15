import { useEffect, useMemo, useState } from 'react'
import { X, Loader2, TriangleAlert, ExternalLink, Paperclip, Download, Mail, MailOpen, Image as ImageIcon } from 'lucide-react'
import { cn } from '@/lib/cn'
import {
  downloadAttachment,
  fetchMessage,
  setSeen,
  type FullMessage,
  type MailAccount,
  type MailMessage,
} from '@/lib/mail'
import { formatSize } from '@/lib/documents'

const fmtFull = new Intl.DateTimeFormat('de-DE', { dateStyle: 'full', timeStyle: 'short' })

/**
 * HTML-Mails laufen in einem abgeschotteten iframe: keine Skripte, keine Formulare,
 * kein Zugriff auf die App. Die CSP blockiert externe Inhalte (Tracking-Pixel),
 * bis „Bilder laden“ geklickt wird. Links öffnen sich in einem neuen Fenster.
 */
function buildSrcDoc(html: string, allowImages: boolean): string {
  const csp = [
    "default-src 'none'",
    `img-src data: ${allowImages ? 'https: http:' : ''}`,
    "style-src 'unsafe-inline'",
    'font-src data:',
  ].join('; ')
  return `<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<base target="_blank">
<style>
  body { margin: 0; padding: 20px; font: 14px/1.55 system-ui, -apple-system, "Segoe UI", sans-serif; color: #171717; background: #fff; overflow-wrap: anywhere; }
  img { max-width: 100%; height: auto; }
  a { color: #4f46e5; }
  table { max-width: 100%; }
  pre { white-space: pre-wrap; }
</style></head><body>${html}</body></html>`
}

const REMOTE_CONTENT = /<img[^>]+src\s*=\s*["']?\s*https?:|url\(\s*["']?\s*https?:|<link[^>]+href\s*=\s*["']?\s*https?:/i

interface Props {
  message: MailMessage
  account?: MailAccount
  onClose: () => void
  /** Rückmeldung an die Liste, wenn sich „gelesen“ ändert. */
  onSeenChange: (seen: boolean) => void
  /** true: als rechte Spalte neben der Liste; sonst Einblendung von rechts (schmale Fenster). */
  inline?: boolean
}

export default function MailReader({ message, account, onClose, onSeenChange, inline = false }: Props) {
  const [full, setFull] = useState<FullMessage | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [allowImages, setAllowImages] = useState(false)
  const [seen, setSeenState] = useState(true)
  const [busy, setBusy] = useState(false)
  const [attError, setAttError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setFull(null)
    setError(null)
    setAllowImages(false)
    setAttError(null)
    fetchMessage(message, true)
      .then((m) => {
        if (cancelled) return
        setFull(m)
        setSeenState(true)
        if (!message.seen) onSeenChange(true)
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message)
      })
    return () => {
      cancelled = true
    }
    // Nur neu laden, wenn eine andere Mail geöffnet wird
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message.accountId, message.folder, message.uid])

  // Esc schließt nur die Einblendung – in der Spaltenansicht bleibt die Mail stehen
  useEffect(() => {
    if (inline) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose, inline])

  const hasRemote = useMemo(() => Boolean(full?.html && REMOTE_CONTENT.test(full.html)), [full])
  const srcDoc = useMemo(() => (full?.html ? buildSrcDoc(full.html, allowImages) : null), [full, allowImages])

  const toggleSeen = async () => {
    setBusy(true)
    try {
      await setSeen(message, !seen)
      setSeenState(!seen)
      onSeenChange(!seen)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const panel = (
    <aside
      role={inline ? 'region' : 'dialog'}
      aria-label="E-Mail"
      className={cn(
        'flex h-full min-h-0 w-full flex-col overflow-hidden bg-white dark:bg-neutral-900',
        inline
          ? 'rounded-xl border border-neutral-200 dark:border-neutral-800'
          : 'max-w-3xl border-l border-neutral-200 shadow-2xl dark:border-neutral-800',
      )}
    >
      {/* Kopf */}
      <div className="flex items-center gap-2 border-b border-neutral-200 px-4 py-2.5 dark:border-neutral-800">
        <span className="min-w-0 flex-1 truncate text-xs text-neutral-500">
          {account?.label ?? account?.email}
          {' · '}
          {message.folder === 'INBOX' ? 'Posteingang' : message.folder}
        </span>
        <button
          type="button"
          onClick={() => void toggleSeen()}
          disabled={busy || !full}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900 disabled:opacity-50 dark:hover:bg-neutral-800 dark:hover:text-white"
        >
          {seen ? <Mail className="size-3.5" /> : <MailOpen className="size-3.5" />}
          {seen ? 'Als ungelesen markieren' : 'Als gelesen markieren'}
        </button>
        {(full?.link ?? message.link) && (
          <a
            href={full?.link ?? message.link}
            target="_blank"
            rel="noreferrer noopener"
            className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-white"
          >
            <ExternalLink className="size-3.5" />
            Im Postfach
          </a>
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label="Schließen"
          className="rounded-lg p-1.5 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-white"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Betreff und Adressen */}
      <div className="space-y-1 border-b border-neutral-200 px-5 py-4 dark:border-neutral-800">
        <h2 className="text-lg font-semibold tracking-tight">{full?.subject ?? message.subject}</h2>
        <div className="text-sm">
          <span className="font-medium">{full?.from ?? `${message.from} <${message.fromAddress}>`}</span>
        </div>
        {full?.to && <div className="text-xs text-neutral-500">An: {full.to}</div>}
        {full?.cc && <div className="text-xs text-neutral-500">Cc: {full.cc}</div>}
        <div className="text-xs text-neutral-400">{fmtFull.format(new Date(full?.date ?? message.date))}</div>
      </div>

      {hasRemote && !allowImages && (
        <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-5 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          <ImageIcon className="size-3.5 shrink-0" />
          <span className="flex-1">
            Externe Bilder sind blockiert – sie können dem Absender verraten, dass du die Mail geöffnet hast.
          </span>
          <button type="button" onClick={() => setAllowImages(true)} className="font-medium underline underline-offset-2">
            Bilder laden
          </button>
        </div>
      )}

      {/* Inhalt */}
      <div className="min-h-0 flex-1 overflow-hidden">
        {error ? (
          <div className="m-5 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            {error}
          </div>
        ) : !full ? (
          <div className="flex h-full items-center justify-center gap-2 text-sm text-neutral-500">
            <Loader2 className="size-4 animate-spin" />
            Mail wird geladen…
          </div>
        ) : srcDoc ? (
          <iframe
            title="Inhalt der Mail"
            srcDoc={srcDoc}
            sandbox="allow-popups allow-popups-to-escape-sandbox"
            referrerPolicy="no-referrer"
            className="h-full w-full bg-white"
          />
        ) : (
          <pre className="h-full overflow-auto px-5 py-4 font-sans text-sm leading-relaxed whitespace-pre-wrap text-neutral-800 dark:text-neutral-200">
            {full.text || '(Diese Mail hat keinen Text.)'}
          </pre>
        )}
      </div>

      {/* Anhänge */}
      {full && full.attachments.length > 0 && (
        <div className="border-t border-neutral-200 px-5 py-3 dark:border-neutral-800">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-neutral-500">
            <Paperclip className="size-3.5" />
            {full.attachments.length === 1 ? '1 Anhang' : `${full.attachments.length} Anhänge`}
          </div>
          <div className="flex flex-wrap gap-2">
            {full.attachments.map((att) => (
              <button
                key={att.index}
                type="button"
                onClick={() => void downloadAttachment(message, att).catch((err: Error) => setAttError(err.message))}
                title="Herunterladen"
                className="flex max-w-full items-center gap-2 rounded-lg border border-neutral-200 px-2.5 py-1.5 text-left text-xs transition hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
              >
                <Download className="size-3.5 shrink-0 text-neutral-400" />
                <span className="truncate font-medium">{att.filename}</span>
                <span className="shrink-0 text-neutral-400">{formatSize(att.size)}</span>
              </button>
            ))}
          </div>
          {attError && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{attError}</p>}
        </div>
      )}
    </aside>
  )

  if (inline) return panel

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/30"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      {panel}
    </div>
  )
}
