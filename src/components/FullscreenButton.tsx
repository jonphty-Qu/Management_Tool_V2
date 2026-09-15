import { useEffect, useState } from 'react'
import { Maximize, Minimize } from 'lucide-react'

export default function FullscreenButton() {
  const [active, setActive] = useState(() => Boolean(document.fullscreenElement))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const sync = () => {
      setActive(Boolean(document.fullscreenElement))
      setError('')
    }
    document.addEventListener('fullscreenchange', sync)
    return () => document.removeEventListener('fullscreenchange', sync)
  }, [])

  const toggle = async () => {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await document.documentElement.requestFullscreen()
    } catch {
      setError('Vollbild ist hier nicht verfügbar. Versuche F11 im Browser.')
    } finally {
      setBusy(false)
    }
  }

  const label = active ? 'Vollbild verlassen' : 'Vollbild aktivieren'
  return (
    <div className="relative">
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        aria-label={label}
        aria-pressed={active}
        title={active ? `${label} (Escape)` : label}
        className="rounded-lg p-2 text-neutral-500 transition hover:bg-neutral-100 disabled:opacity-50 dark:hover:bg-neutral-800"
      >
        {active ? <Minimize className="size-[18px]" /> : <Maximize className="size-[18px]" />}
      </button>
      {error && (
        <p role="status" className="absolute top-full right-0 mt-2 w-56 rounded-lg border border-neutral-200 bg-white p-3 text-xs text-neutral-600 shadow-lg dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
          {error}
        </p>
      )}
    </div>
  )
}
