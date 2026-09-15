import { useCallback, useEffect, useState } from 'react'

export type Theme = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'mt.theme'

function read(): Theme {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'light' || v === 'dark' || v === 'system') return v
  } catch {
    /* Storage kann blockiert sein */
  }
  return 'system'
}

/** Setzt die dark-Klasse und meldet zurück, ob dunkel aktiv ist. */
function apply(theme: Theme): boolean {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const dark = theme === 'dark' || (theme === 'system' && prefersDark)
  document.documentElement.classList.toggle('dark', dark)
  return dark
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(read)
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    setIsDark(apply(theme))
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => theme === 'system' && setIsDark(apply(theme))
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [theme])

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* ignorieren */
    }
  }, [])

  return { theme, setTheme, isDark }
}
