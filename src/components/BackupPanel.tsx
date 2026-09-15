import { useRef, useState } from 'react'

type Archive = { format: string; version: number; createdAt: string; storage: Record<string, string>; files: { path: string; base64: string }[] }
const button = 'rounded-lg border border-neutral-200 px-3 py-2 text-sm hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-800'
function snapshot() { return Object.fromEntries(Object.keys(localStorage).filter(k => k.startsWith('mt.')).map(k => [k, localStorage.getItem(k)!])) }
function replaceStorage(data: Record<string, string>) {
  Object.keys(localStorage).filter(k => k.startsWith('mt.')).forEach(k => localStorage.removeItem(k))
  Object.entries(data).forEach(([key, value]) => localStorage.setItem(key, value))
}
async function api(action: string, data: unknown) {
  const res = await fetch(`/api/backup/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-requested-with': 'management-tool' }, body: JSON.stringify(data) })
  const result = await res.json()
  if (!res.ok) throw new Error(result.error || 'Sicherung fehlgeschlagen.')
  return result
}
function download(archive: unknown, name: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(archive)], { type: 'application/json' }))
  const link = document.createElement('a'); link.href = url; link.download = name; link.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
export default function BackupPanel() {
  const input = useRef<HTMLInputElement>(null)
  const [candidate, setCandidate] = useState<Archive | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [locked, setLocked] = useState(() => !!sessionStorage.getItem('management-tool.restore'))
  async function exportData() {
    setBusy(true); setMessage('')
    try { const archive = await api('export', { storage: snapshot() }); download(archive, `management-tool-${new Date().toISOString().slice(0, 10)}.json`); setMessage('Sicherung wurde zum Download bereitgestellt.') }
    catch (error) { setMessage((error as Error).message) } finally { setBusy(false) }
  }
  async function selectFile(file?: File) {
    setCandidate(null); setMessage('')
    if (!file) return
    try {
      if (file.size > 200 * 1024 * 1024) throw new Error('Sicherungen dürfen höchstens 200 MB groß sein.')
      const value = JSON.parse(await file.text()) as Archive
      if (value.format !== 'management-tool' || value.version !== 1 || !value.storage || !Array.isArray(value.files)) throw new Error('Keine unterstützte Management-Tool-Sicherung.')
      setCandidate(value)
    } catch (error) { setMessage((error as Error).message) }
  }
  async function restore() {
    if (!candidate) return
    setBusy(true); setMessage('')
    let previous: Record<string, string> | undefined
    let changed = false
    try {
      previous = snapshot()
      const { token } = await api('prepare', { archive: candidate, previous })
      // Keep an independent rollback copy before touching the origin's keys.
      sessionStorage.setItem('management-tool.restore', JSON.stringify({ token, previous }))
      setLocked(true)
      changed = true
      replaceStorage(candidate.storage)
      try { await api('commit', { token }) }
      catch (error) {
        const state = await api('status', { token }).catch(() => null)
        if (!state || state.state === 'unknown') {
          setMessage('Verbindung unterbrochen. Bitte diese Seite offen lassen und den lokalen Server wieder starten. Mit „Wiederherstellung prüfen“ wird der gespeicherte Vorgang aufgelöst.')
          return
        }
        if (state.state !== 'complete') throw error
      }
      sessionStorage.removeItem('management-tool.restore')
      location.reload()
    } catch (error) {
      if (changed && previous) { try { replaceStorage(previous); sessionStorage.removeItem('management-tool.restore'); setLocked(false) } catch { setMessage('Browser-Speicher blockiert. Die Rücksicherung bleibt im Sitzungsspeicher erhalten.'); return } }
      setMessage((error as Error).message)
    } finally { setBusy(false) }
  }
  async function recover() {
    setBusy(true)
    try {
      const raw = sessionStorage.getItem('management-tool.restore')
      if (!raw) { setMessage('Kein offener Wiederherstellungsvorgang.'); return }
      const { token, previous } = JSON.parse(raw)
      const state = await api('status', { token })
      if (state.state === 'pending') {
        setMessage('Die Wiederherstellung läuft noch. Bitte etwas warten und erneut prüfen.')
        return
      }
      if (state.state !== 'complete') replaceStorage(previous)
      sessionStorage.removeItem('management-tool.restore'); location.reload()
    } catch (error) { setMessage((error as Error).message) } finally { setBusy(false) }
  }
  return <div className="space-y-4">
    {locked && <div className="fixed inset-0 z-[100] grid place-items-center bg-black/70 p-6"><div role="dialog" aria-modal="true" aria-label="Wiederherstellung abschließen" className="max-w-lg rounded-xl bg-white p-6 text-neutral-900 space-y-4"><p>Die Wiederherstellung wird abgeschlossen. Bitte diese Seite offen lassen.</p><p role="status">{message || 'Daten werden übertragen …'}</p><button className={button} disabled={busy} onClick={() => void recover()}>Wiederherstellung prüfen</button></div></div>}
    <p className="text-sm text-neutral-500">Sichert alle App-Daten dieses Browsers, hochgeladene Unterlagen und Anschreiben-Vorlagen in einer JSON-Datei (maximal 200 MB). Die Datei enthält persönliche Daten und ist unverschlüsselt.</p>
    <p className="text-sm text-neutral-500">E-Mail-Konten und Zugangsdaten sind ausgeschlossen. Bestehende E-Mail-Verbindungen bleiben beim Import erhalten; auf einem anderen Rechner bitte erneut verbinden.</p>
    <div className="flex flex-wrap gap-2">
      <button className={button} disabled={busy} onClick={() => void exportData()}>Daten exportieren</button>
      <button className={button} disabled={busy} onClick={() => input.current?.click()}>Daten importieren</button>
      <button className={button} disabled={busy} onClick={() => void recover()}>Wiederherstellung prüfen</button>
      <input ref={input} type="file" accept=".json,application/json" className="hidden" aria-label="Sicherungsdatei auswählen" onChange={e => { void selectFile(e.target.files?.[0]); e.target.value = '' }} />
    </div>
    {candidate && <div className="rounded-lg border border-amber-300 p-4 text-sm space-y-3">
      <p>Sicherung vom {new Date(candidate.createdAt).toLocaleString('de-DE')}: {Object.keys(candidate.storage).length} Browserbereiche, {candidate.files.length - 1} Dokumentdateien.</p>
      <p>Alle App-Daten und Dokumente werden ersetzt, auch Einträge, die in der Sicherung fehlen. Bitte andere Tabs dieses Tools schließen. Die bisherigen Daten werden zusätzlich unter data/backups aufbewahrt. Die App lädt danach neu.</p>
      <div className="flex gap-2"><button className={button} disabled={busy} onClick={() => void restore()}>Ja, Daten ersetzen</button><button className={button} disabled={busy} onClick={() => setCandidate(null)}>Abbrechen</button></div>
    </div>}
    {busy && <p role="status" className="text-sm">Sicherung wird verarbeitet …</p>}
    {message && <p role="status" className="text-sm">{message}</p>}
  </div>
}
