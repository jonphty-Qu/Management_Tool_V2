import { useEffect, useRef, useState } from 'react'
import { Keyboard, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/cn'
import { formatHotkey, hotkeyFromEvent, reservedFor } from '@/lib/hotkeys'

interface Props {
  label: string
  hint?: string
  value: string
  /** Standardwert für den Zurücksetzen-Knopf. */
  fallback: string
  /** Schon anderweitig vergebene Kürzel: {kürzel: wofür}. */
  taken?: Record<string, string>
  onChange: (value: string) => void
}

/**
 * Nimmt die nächste Tastenkombination auf. Während der Aufnahme geht jeder
 * Tastendruck an dieses Feld – sonst würde man beim Drücken die Funktion
 * auslösen, die man gerade belegen will.
 */
export default function ShortcutRecorder({ label, hint, value, fallback, taken, onChange }: Props) {
  const [recording, setRecording] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!recording) return

    const onKey = (event: KeyboardEvent) => {
      event.preventDefault()
      event.stopPropagation()

      if (event.key === 'Escape') {
        setRecording(false)
        setProblem(null)
        return
      }

      const hotkey = hotkeyFromEvent(event)
      if (!hotkey) {
        // Reine Modifier oder ein einzelner Buchstabe – weiter warten
        setProblem('Mit Strg, Alt oder Umschalt kombinieren (oder eine F-Taste nehmen).')
        return
      }

      const conflict = taken?.[hotkey]
      if (conflict) {
        setProblem(`${formatHotkey(hotkey)} ist schon für „${conflict}“ vergeben.`)
        return
      }

      const reserved = reservedFor(hotkey)
      if (reserved) {
        setProblem(`${formatHotkey(hotkey)} fängt der Browser selbst ab (${reserved}).`)
        return
      }

      onChange(hotkey)
      setRecording(false)
      setProblem(null)
    }

    // capture: vor allen anderen Hörern, damit nichts ausgelöst wird
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onChange, recording, taken])

  return (
    <div className="max-w-md">
      <div className="flex items-center justify-between gap-4">
        <span>
          <span className="block text-sm">{label}</span>
          {hint && <span className="mt-0.5 block text-xs text-neutral-500">{hint}</span>}
        </span>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            ref={buttonRef}
            type="button"
            onClick={() => {
              setProblem(null)
              setRecording((v) => !v)
            }}
            onBlur={() => setRecording(false)}
            aria-label={`${label} ändern`}
            className={cn(
              'min-w-[120px] rounded-lg border px-3 py-1.5 text-sm transition',
              recording
                ? 'animate-pulse border-indigo-500 text-indigo-600 dark:text-indigo-300'
                : 'border-neutral-200 hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800',
            )}
          >
            {recording ? (
              <span className="flex items-center justify-center gap-1.5">
                <Keyboard className="size-3.5" />
                Taste drücken…
              </span>
            ) : (
              formatHotkey(value)
            )}
          </button>

          {value !== fallback && !recording && (
            <button
              type="button"
              onClick={() => onChange(fallback)}
              title={`Zurück auf ${formatHotkey(fallback)}`}
              aria-label="Zurücksetzen"
              className="rounded-lg p-2 text-neutral-400 transition hover:text-neutral-900 dark:hover:text-white"
            >
              <RotateCcw className="size-4" />
            </button>
          )}
        </div>
      </div>

      {recording && !problem && (
        <p className="mt-1.5 text-xs text-neutral-500">Esc bricht ab.</p>
      )}
      {problem && <p className="mt-1.5 text-xs text-amber-700 dark:text-amber-300">{problem}</p>}
    </div>
  )
}
