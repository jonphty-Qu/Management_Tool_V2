import { useState } from 'react'
import { Mic, Play, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/cn'
import ShortcutRecorder from './ShortcutRecorder'
import { defaultSettings, type AppSettings } from '@/lib/settings'
import { formatHotkey } from '@/lib/hotkeys'
import { cancelSpeech, recognitionSupported, speak, synthesisSupported, useGermanVoices } from '@/lib/speech'

interface Props {
  /** Kommt von der Einstellungsseite – eine gemeinsame Kopie, damit sich Änderungen nicht überschreiben. */
  voice: AppSettings['voice']
  onChange: (patch: Partial<AppSettings['voice']>) => void
  shortcuts: AppSettings['shortcuts']
  onShortcutsChange: (patch: Partial<AppSettings['shortcuts']>) => void
}

/** Stimme, Tempo und Ablauf der Spracheingabe. */
export default function VoiceSettings({ voice, onChange, shortcuts, onShortcutsChange }: Props) {
  const voices = useGermanVoices()
  const canListen = recognitionSupported()
  const canSpeak = synthesisSupported()
  const [testing, setTesting] = useState(false)

  const test = async () => {
    setTesting(true)
    await speak('Aufgabe „Angebot schreiben“ angelegt, fällig am Freitag.', {
      voiceURI: voice.voiceURI || undefined,
      rate: voice.rate,
    })
    setTesting(false)
  }

  return (
    <>
      <section className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Mic className="size-4 text-indigo-500" />
          Spracheingabe
        </h3>
        <p className="mt-0.5 text-xs text-neutral-500">
          Mit {formatHotkey(shortcuts.voice)} öffnest du das Mikrofon und sprichst Aufgaben, Termine und
          Notizen ein.
        </p>

        <div className="mt-4 space-y-4">
          <Toggle
            label="Antworten vorlesen"
            hint="Bestätigungen und Auskünfte werden gesprochen."
            checked={voice.speak}
            disabled={!canSpeak}
            onChange={(value) => onChange({ speak: value })}
          />
          <Toggle
            label="Vor dem Anlegen nachfragen"
            hint="Aus: Gesagtes wird sofort angelegt, Rückgängig bleibt möglich."
            checked={voice.confirm}
            onChange={(value) => onChange({ confirm: value })}
          />
          <Toggle
            label="Nach einem Eintrag weiter zuhören"
            hint="So kannst du mehrere Sachen hintereinander diktieren."
            checked={voice.continuous}
            onChange={(value) => onChange({ continuous: value })}
          />

          {!canListen && (
            <p className="flex items-start gap-1.5 text-sm text-amber-700 dark:text-amber-300">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" />
              Dieser Browser erkennt keine Sprache. Chrome oder Edge können es – das Tool startet ohnehin
              in einem davon.
            </p>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
        <h3 className="text-sm font-semibold">Tastenkürzel</h3>
        <p className="mt-0.5 text-xs text-neutral-500">
          Auf den Knopf klicken und die gewünschte Kombination drücken.
        </p>

        <div className="mt-4 space-y-4">
          <ShortcutRecorder
            label="Spracheingabe öffnen"
            value={shortcuts.voice}
            fallback={defaultSettings.shortcuts.voice}
            taken={{ [shortcuts.search]: 'Suche' }}
            onChange={(value) => onShortcutsChange({ voice: value })}
          />
          <ShortcutRecorder
            label="Suche öffnen"
            value={shortcuts.search}
            fallback={defaultSettings.shortcuts.search}
            taken={{ [shortcuts.voice]: 'Spracheingabe' }}
            onChange={(value) => onShortcutsChange({ search: value })}
          />
        </div>
      </section>

      <section className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
        <h3 className="text-sm font-semibold">Stimme</h3>
        <p className="mt-0.5 text-xs text-neutral-500">
          Die Ausgabe spricht dein Rechner. Welche Stimmen es gibt, hängt von Windows und dem Browser ab.
        </p>

        <div className="mt-4 space-y-4">
          <label className="block max-w-md">
            <span className="mb-1.5 block text-xs font-medium text-neutral-500">Deutsche Stimme</span>
            <select
              value={voice.voiceURI}
              onChange={(e) => onChange({ voiceURI: e.target.value })}
              disabled={!voices.length}
              className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-800"
            >
              <option value="">Automatisch</option>
              {voices.map((v) => (
                <option key={v.voiceURI} value={v.voiceURI}>
                  {v.name}
                  {v.localService ? '' : ' (online)'}
                </option>
              ))}
            </select>
          </label>

          <label className="block max-w-md">
            <span className="mb-1.5 flex items-center justify-between text-xs font-medium text-neutral-500">
              Sprechtempo
              <span className="tabular-nums">{voice.rate.toFixed(1)}×</span>
            </span>
            <input
              type="range"
              min={0.6}
              max={1.6}
              step={0.1}
              value={voice.rate}
              onChange={(e) => onChange({ rate: Number(e.target.value) })}
              className="w-full accent-neutral-900 dark:accent-white"
            />
          </label>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={test}
              disabled={!canSpeak || testing}
              className="flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-1.5 text-sm transition hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
            >
              <Play className="size-3.5" />
              {testing ? 'Spricht…' : 'Stimme testen'}
            </button>
            {testing && (
              <button
                type="button"
                onClick={() => {
                  cancelSpeech()
                  setTesting(false)
                }}
                className="text-sm text-neutral-500 transition hover:text-neutral-900 dark:hover:text-white"
              >
                Stopp
              </button>
            )}
          </div>

          <p className="max-w-2xl text-xs text-neutral-500">
            Hinweis: Die Erkennung läuft über den Sprachdienst des Browsers, das Gesagte wird dorthin
            übertragen. Die Einträge selbst bleiben wie bisher lokal auf diesem Rechner.
          </p>
        </div>
      </section>
    </>
  )
}

function Toggle({
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  label: string
  hint?: string
  checked: boolean
  disabled?: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <div className="flex max-w-md items-start justify-between gap-4">
      <span>
        <span className="block text-sm">{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-neutral-500">{hint}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition disabled:opacity-40',
          checked ? 'bg-neutral-900 dark:bg-white' : 'bg-neutral-200 dark:bg-neutral-700',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 size-5 rounded-full bg-white shadow transition dark:bg-neutral-900',
            checked ? 'left-[22px]' : 'left-0.5',
          )}
        />
      </button>
    </div>
  )
}
