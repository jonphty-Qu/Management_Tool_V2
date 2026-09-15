import { useState } from 'react'
import { BellRing, Check, TriangleAlert } from 'lucide-react'
import AlertPicker from './AlertPicker'

interface Props {
  /** Kommt von der Einstellungsseite – eine gemeinsame Kopie, damit sich Änderungen nicht überschreiben. */
  interviewAlerts: number[]
  onInterviewAlertsChange: (next: number[]) => void
}

/** Desktop-Hinweise erlauben und Standard-Erinnerungen für Gespräche festlegen. */
export default function NotificationSettings({ interviewAlerts, onInterviewAlertsChange }: Props) {
  const supported = typeof Notification !== 'undefined'
  const [permission, setPermission] = useState<NotificationPermission>(
    supported ? Notification.permission : 'denied',
  )

  const request = async () => {
    if (!supported) return
    const result = await Notification.requestPermission()
    setPermission(result)
    if (result === 'granted') {
      new Notification('Benachrichtigungen aktiv', {
        body: 'So sehen Erinnerungen aus dem Management Tool aus.',
        icon: '/favicon.svg',
      })
    }
  }

  return (
    <>
      <section className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
        <h3 className="text-sm font-semibold">Desktop-Benachrichtigungen</h3>
        <p className="mt-0.5 text-xs text-neutral-500">
          Erinnerungen erscheinen zusätzlich als Windows-Benachrichtigung, solange das Tool geöffnet ist.
        </p>
        <div className="mt-4">
          {permission === 'granted' ? (
            <p className="flex items-center gap-1.5 text-sm text-emerald-700 dark:text-emerald-400">
              <Check className="size-4" />
              Aktiv
            </p>
          ) : permission === 'denied' ? (
            <p className="flex items-start gap-1.5 text-sm text-amber-700 dark:text-amber-300">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" />
              {supported
                ? 'Blockiert. In Edge unter Einstellungen → Cookies und Websiteberechtigungen → Benachrichtigungen für localhost:5180 wieder erlauben.'
                : 'Dieser Browser unterstützt keine Desktop-Benachrichtigungen.'}
            </p>
          ) : (
            <button
              type="button"
              onClick={() => void request()}
              className="flex items-center gap-1.5 rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
            >
              <BellRing className="size-4" />
              Erlauben
            </button>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
        <h3 className="text-sm font-semibold">Erinnerungen für Vorstellungsgespräche</h3>
        <p className="mt-0.5 text-xs text-neutral-500">
          Standard beim Eintragen eines Gesprächs – pro Termin weiterhin änderbar.
        </p>
        <div className="mt-4">
          <AlertPicker value={interviewAlerts} onChange={onInterviewAlertsChange} />
        </div>
      </section>
    </>
  )
}
