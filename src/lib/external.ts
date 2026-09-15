import { loadSettings } from './settings'

/**
 * Link außerhalb der App öffnen – je nach Einstellung in Firefox (über den lokalen Server)
 * oder im Standardbrowser. Scheitert Firefox, bleibt der Standardbrowser als Rückfall.
 */
export async function openExternal(url: string): Promise<void> {
  if (loadSettings().externalBrowser === 'firefox') {
    const res = await fetch('/api/browser/open', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'management-tool' },
      body: JSON.stringify({ url }),
    }).catch(() => null)
    if (res?.ok) return
  }
  window.open(url, '_blank', 'noopener,noreferrer')
}
