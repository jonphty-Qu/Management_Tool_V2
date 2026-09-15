import { useEffect, useRef, useState } from 'react'
import { X, Copy, Check, TriangleAlert } from 'lucide-react'

interface Props {
  /** Bereits ausgefüllter Text – lässt sich hier noch anpassen. */
  text: string
  onClose: () => void
}

/** Zeigt ein aus der Vorlage erzeugtes Anschreiben zum Prüfen und Kopieren. */
export default function CoverLetterDialog({ text, onClose }: Props) {
  const [value, setValue] = useState(text)
  const [copied, setCopied] = useState(false)
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  // Offene Platzhalter = in der Bewerbung fehlende Angaben
  const missing = [...new Set(value.match(/\{\{\s*[a-zäöüß_]+\s*\}\}/gi) ?? [])]

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
    } catch {
      ref.current?.select()
      document.execCommand('copy')
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl dark:border-neutral-800 dark:bg-neutral-900"
      >
        <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-3.5 dark:border-neutral-800">
          <h2 className="text-sm font-semibold">Anschreiben</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-neutral-400 transition hover:bg-neutral-100 dark:hover:bg-neutral-800"
            aria-label="Schließen"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {missing.length > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
              <TriangleAlert className="mt-px size-3.5 shrink-0" />
              Noch offen: {missing.join(', ')} – diese Angaben fehlen in der Bewerbung. Direkt hier ergänzen.
            </div>
          )}
          <textarea
            ref={ref}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            rows={20}
            className="w-full resize-y rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm leading-relaxed outline-none transition focus:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-800 dark:focus:border-neutral-500"
          />
        </div>

        <div className="flex justify-end gap-2 border-t border-neutral-200 px-5 py-3.5 dark:border-neutral-800">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-neutral-200 px-3 py-1.5 text-sm transition hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
          >
            Schließen
          </button>
          <button
            type="button"
            onClick={() => void copy()}
            className="flex items-center gap-1.5 rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied ? 'Kopiert' : 'Kopieren'}
          </button>
        </div>
      </div>
    </div>
  )
}
