import { useCallback, useState } from 'react'

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
}

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AppSettings>
      return { ...defaultSettings, ...parsed, notifications: { ...defaultSettings.notifications, ...parsed.notifications } }
    }
  } catch {
    /* Storage kann blockiert sein */
  }
  return defaultSettings
}

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(loadSettings)

  const update = useCallback((patch: Partial<AppSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch }
      try {
        localStorage.setItem(KEY, JSON.stringify(next))
      } catch {
        /* ignorieren */
      }
      return next
    })
  }, [])

  return { settings, update }
}
