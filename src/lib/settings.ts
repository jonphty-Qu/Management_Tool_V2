import { useCallback, useEffect, useRef, useState } from 'react'

export interface AppSettings {
  externalBrowser: 'default' | 'firefox'
  /** Standard-Erinnerungen für Vorstellungsgespräche in Minuten vor Beginn. */
  interviewAlerts: number[]
  profileName: string
  profileEmail: string
  profilePhone: string
  profileLocation: string
  profileTitle: string
  profileWebsite: string
  profileBio: string
  notifications: {
    dueTasks: boolean
    eventReminders: boolean
    weeklySummary: boolean
  }
  /** Frei belegbare Tastenkürzel. */
  shortcuts: {
    /** Öffnet die Spracheingabe. */
    voice: string
    /** Öffnet die Suche. */
    search: string
  }
  /** Spracheingabe und -ausgabe. */
  voice: {
    /** Antworten vorlesen. */
    speak: boolean
    /** Vor dem Anlegen nachfragen statt sofort anzulegen. */
    confirm: boolean
    /** Nach einem Eintrag weiter zuhören. */
    continuous: boolean
    /** Gewählte Stimme (voiceURI) – leer heißt automatisch. */
    voiceURI: string
    /** Sprechtempo 0.5 bis 1.5. */
    rate: number
  }
}

const KEY = 'mt.settings'

export const defaultSettings: AppSettings = {
  externalBrowser: 'default',
  // 3 Tage, 1 Tag, 2 Stunden vorher
  interviewAlerts: [3 * 1440, 1440, 120],
  profileName: '',
  profileEmail: '',
  profilePhone: '',
  profileLocation: '',
  profileTitle: '',
  profileWebsite: '',
  profileBio: '',
  notifications: { dueTasks: true, eventReminders: true, weeklySummary: false },
  shortcuts: { voice: 'ctrl+m', search: 'ctrl+k' },
  voice: { speak: true, confirm: false, continuous: true, voiceURI: '', rate: 1 },
}

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AppSettings>
      return {
        ...defaultSettings,
        ...parsed,
        notifications: { ...defaultSettings.notifications, ...parsed.notifications },
        shortcuts: { ...defaultSettings.shortcuts, ...parsed.shortcuts },
        voice: { ...defaultSettings.voice, ...parsed.voice },
      }
    }
  } catch {
    /* Storage kann blockiert sein */
  }
  return defaultSettings
}

/** Jede Kopie des Hooks soll dieselbe Einstellung sehen – auch ohne Neuladen. */
const CHANGED = 'mt:settings'

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(loadSettings)
  // Spiegel, damit `update` ohne Updater-Funktion auskommt
  const current = useRef(settings)
  current.current = settings

  useEffect(() => {
    const sync = () => setSettings(loadSettings())
    window.addEventListener(CHANGED, sync)
    return () => window.removeEventListener(CHANGED, sync)
  }, [])

  const update = useCallback((patch: Partial<AppSettings>) => {
    const next = { ...current.current, ...patch }
    current.current = next
    try {
      localStorage.setItem(KEY, JSON.stringify(next))
    } catch {
      /* ignorieren */
    }
    setSettings(next)
    // Andere Kopien nachziehen (Kopfzeile, Tastenkürzel, Browserwahl …).
    // Muss außerhalb des Renderns passieren, sonst aktualisiert es fremde
    // Komponenten mitten im Rendern.
    window.dispatchEvent(new Event(CHANGED))
  }, [])

  return { settings, update }
}
