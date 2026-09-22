import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import BackupPanel from '@/components/BackupPanel'
import NotificationSettings from '@/components/NotificationSettings'
import VoiceSettings from '@/components/VoiceSettings'
import { Sun, Moon, Monitor } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { Theme } from '@/lib/useTheme'
import { useSettings } from '@/lib/settings'

interface Props {
  theme: Theme
  onThemeChange: (theme: Theme) => void
}

const sections = ['Profil', 'Darstellung', 'Sprache', 'Benachrichtigungen', 'Daten'] as const
type Section = (typeof sections)[number]

/** ?bereich=benachrichtigungen springt direkt in einen Reiter (z. B. aus der Glocke). */
function sectionFromParam(value: string | null): Section | null {
  return sections.find((s) => s.toLowerCase() === value?.toLowerCase()) ?? null
}

const themeOptions: Array<{ value: Theme; label: string; icon: typeof Sun }> = [
  { value: 'light', label: 'Hell', icon: Sun },
  { value: 'dark', label: 'Dunkel', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
]

export default function Settings({ theme, onThemeChange }: Props) {
  const [params] = useSearchParams()
  const [section, setSection] = useState<Section>(() => sectionFromParam(params.get('bereich')) ?? 'Profil')
  const { settings, update } = useSettings()

  useEffect(() => {
    const target = sectionFromParam(params.get('bereich'))
    if (target) setSection(target)
  }, [params])

  return (
    <div className="mx-auto max-w-4xl">
      <h2 className="text-2xl font-semibold tracking-tight">Einstellungen</h2>
      <p className="mt-1 text-sm text-neutral-500">Profil, Darstellung und Daten verwalten.</p>

      <div className="mt-6 flex gap-1 border-b border-neutral-200 dark:border-neutral-800">
        {sections.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSection(s)}
            className={cn(
              '-mb-px border-b-2 px-3 py-2 text-sm transition',
              section === s
                ? 'border-neutral-900 font-medium text-neutral-900 dark:border-white dark:text-white'
                : 'border-transparent text-neutral-500 hover:text-neutral-900 dark:hover:text-white',
            )}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="mt-6 space-y-6">
        {section === 'Profil' && (
          <Card title="Profil" description="Diese Angaben erscheinen im Profilmenü.">
            <div className="flex items-center gap-4">
              <span className="grid size-16 place-items-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-lg font-semibold text-white">
                {settings.profileName.trim().split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || '?'}
              </span>
              <button
                type="button"
                className="rounded-lg border border-neutral-200 px-3 py-1.5 text-sm transition hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
              >
                Bild ändern
              </button>
            </div>
            <Field label="Name" value={settings.profileName} onChange={(value) => update({ profileName: value })} />
            <Field label="E-Mail" value={settings.profileEmail} onChange={(value) => update({ profileEmail: value })} type="email" />
            <Field label="Telefon" value={settings.profilePhone} onChange={(value) => update({ profilePhone: value })} type="tel" />
            <Field label="Standort" value={settings.profileLocation} onChange={(value) => update({ profileLocation: value })} placeholder="z. B. Hamburg · Remote" />
            <Field label="Berufsbezeichnung" value={settings.profileTitle} onChange={(value) => update({ profileTitle: value })} placeholder="z. B. Frontend-Entwickler" />
            <Field label="Website / LinkedIn" value={settings.profileWebsite} onChange={(value) => update({ profileWebsite: value })} type="url" placeholder="https://…" />
            <label className="block max-w-md"><span className="mb-1.5 block text-xs font-medium text-neutral-500">Kurzprofil</span><textarea value={settings.profileBio} onChange={(e) => update({ profileBio: e.target.value })} rows={4} placeholder="Ein kurzer Text für Bewerbungen und Anschreiben…" className="w-full resize-y rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-800 dark:focus:border-neutral-500" /></label>
          </Card>
        )}

        {section === 'Profil' && (
          <Card title="Externe Links" description="Wähle, wo Stellenanzeigen und Lesezeichen geöffnet werden.">
            <label className="block max-w-md"><span className="mb-1.5 block text-xs font-medium text-neutral-500">Browser</span><select value={settings.externalBrowser} onChange={(e) => update({ externalBrowser: e.target.value as 'default' | 'firefox' })} className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800"><option value="default">Standardbrowser</option><option value="firefox">Firefox</option></select></label>
            {settings.externalBrowser === 'firefox' && <p className="text-xs text-neutral-500">Firefox muss unter dem üblichen Windows-Pfad installiert sein.</p>}
          </Card>
        )}

        {section === 'Darstellung' && (
          <Card title="Design" description="Hell, dunkel oder automatisch nach Systemeinstellung.">
            <div className="grid max-w-md grid-cols-3 gap-2">
              {themeOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onThemeChange(opt.value)}
                  className={cn(
                    'flex flex-col items-center gap-2 rounded-xl border px-3 py-4 text-sm transition',
                    theme === opt.value
                      ? 'border-neutral-900 dark:border-white'
                      : 'border-neutral-200 text-neutral-500 hover:border-neutral-300 dark:border-neutral-800 dark:hover:border-neutral-700',
                  )}
                >
                  <opt.icon className="size-5" />
                  {opt.label}
                </button>
              ))}
            </div>
          </Card>
        )}

        {section === 'Sprache' && (
          <VoiceSettings
            voice={settings.voice}
            onChange={(patch) => update({ voice: { ...settings.voice, ...patch } })}
            shortcuts={settings.shortcuts}
            onShortcutsChange={(patch) => update({ shortcuts: { ...settings.shortcuts, ...patch } })}
          />
        )}

        {section === 'Benachrichtigungen' && (
          <>
            <Card title="Benachrichtigungen" description="Wobei soll dich das Tool erinnern?">
              <Toggle label="Fällige Aufgaben" checked={settings.notifications.dueTasks} onChange={(value) => update({ notifications: { ...settings.notifications, dueTasks: value } })} />
              <Toggle label="Termin-Erinnerungen" checked={settings.notifications.eventReminders} onChange={(value) => update({ notifications: { ...settings.notifications, eventReminders: value } })} />
              <Toggle label="Wöchentliche Zusammenfassung" checked={settings.notifications.weeklySummary} onChange={(value) => update({ notifications: { ...settings.notifications, weeklySummary: value } })} />
            </Card>
            {/* Dieselbe Einstellungs-Kopie wie oben – sonst überschreiben sich die Karten gegenseitig */}
            <NotificationSettings
              interviewAlerts={settings.interviewAlerts}
              onInterviewAlertsChange={(next) => update({ interviewAlerts: next })}
            />
          </>
        )}

        {section === 'Daten' && (
          <>
            <Card title="Datenspeicher" description="Wo persönliche Daten abgelegt werden.">
              <div className="max-w-2xl space-y-2 text-sm text-neutral-600 dark:text-neutral-300">
                <p>Board, Kalender, Finanzen, Bewerbungen, Profil und Zeiterfassung bleiben lokal im Browser auf diesem Rechner (localStorage).</p>
                <p>E-Mail-Zugangsdaten liegen ausschließlich lokal im Ordner <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800">data/</code>. Dieser Ordner ist von Git ausgeschlossen und wird nicht zu GitHub hochgeladen.</p>
                <p>Für einen frei wählbaren Ablageort nutze den Export weiter unten. Der Browser darf den dauerhaften Speicherpfad aus Sicherheitsgründen nicht automatisch festlegen.</p>
              </div>
            </Card>
            <Card title="Daten" description="Lokale Sicherung exportieren oder wiederherstellen.">
            <BackupPanel />
            </Card>
          </>
        )}
      </div>
    </div>
  )
}

function Card({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-0.5 text-xs text-neutral-500">{description}</p>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  )
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  placeholder?: string
}) {
  return (
    <label className="block max-w-md">
      <span className="mb-1.5 block text-xs font-medium text-neutral-500">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-800 dark:focus:border-neutral-500"
      />
    </label>
  )
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <div className="flex max-w-md items-center justify-between">
      <span className="text-sm">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative h-6 w-11 rounded-full transition',
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
