import { useEffect, useRef, useState } from 'react'
import { X, Loader2, TriangleAlert } from 'lucide-react'
import { placeholders } from '@/lib/documents'

export interface TemplateDraft {
  id?: string
  title: string
  content: string
}

interface Props {
  draft: TemplateDraft
  onSave: (template: TemplateDraft) => Promise<void>
  onClose: () => void
}

const inputClass =
  'rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-sm outline-none transition focus:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-800 dark:focus:border-neutral-500'

export default function TemplateDialog({ draft, onSave, onClose }: Props) {
  const [title, setTitle] = useState(draft.title)
  const [content, setContent] = useState(draft.content)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const textRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [busy, onClose])

  /** Platzhalter an der Cursorposition einfügen. */
  const insert = (key: string) => {
    const el = textRef.current
    const token = `{{${key}}}`
    const start = el?.selectionStart ?? content.length
    const end = el?.selectionEnd ?? content.length
    setContent(content.slice(0, start) + token + content.slice(end))
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(start + token.length, start + token.length)
    })
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await onSave({ id: draft.id, title: title.trim() || 'Vorlage', content })
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose()
      }}
    >
      <form
        onMouseDown={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl dark:border-neutral-800 dark:bg-neutral-900"
      >
        <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-3.5 dark:border-neutral-800">
          <h2 className="text-sm font-semibold">{draft.id ? 'Vorlage bearbeiten' : 'Neue Vorlage'}</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg p-1.5 text-neutral-400 transition hover:bg-neutral-100 dark:hover:bg-neutral-800"
            aria-label="Schließen"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Name der Vorlage, z. B. Anschreiben IT"
            className="w-full border-b border-neutral-200 pb-2 text-lg font-medium outline-none transition placeholder:text-neutral-400 focus:border-neutral-900 dark:border-neutral-700 dark:focus:border-white"
          />

          <div>
            <span className="mb-1.5 block text-xs font-medium text-neutral-500">
              Platzhalter einfügen – werden in jeder Bewerbung automatisch ersetzt
            </span>
            <div className="flex flex-wrap gap-1.5">
              {placeholders.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => insert(p.key)}
                  title={p.label}
                  className="rounded-md border border-neutral-200 bg-neutral-50 px-2 py-0.5 font-mono text-xs text-neutral-700 transition hover:border-neutral-300 hover:bg-white dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:border-neutral-600"
                >
                  {`{{${p.key}}}`}
                </button>
              ))}
            </div>
          </div>

          <textarea
            ref={textRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={16}
            placeholder="Sehr geehrte Damen und Herren, …"
            className={`${inputClass} w-full resize-y leading-relaxed`}
          />

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" />
              {error}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-neutral-200 px-5 py-3.5 dark:border-neutral-800">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg border border-neutral-200 px-3 py-1.5 text-sm transition hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
          >
            Abbrechen
          </button>
          <button
            type="submit"
            disabled={busy}
            className="flex items-center gap-1.5 rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:opacity-60 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            {busy && <Loader2 className="size-4 animate-spin" />}
            Speichern
          </button>
        </div>
      </form>
    </div>
  )
}
