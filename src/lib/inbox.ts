import { useCallback, useEffect, useState } from 'react'
import type { Priority } from './board'

/**
 * Aufgaben, die außerhalb des Tools vorbereitet wurden (`data/inbox.json`).
 * Sie werden nur angezeigt – angelegt wird erst auf Knopfdruck.
 */
export interface InboxTask {
  title: string
  description?: string
  priority?: Priority
  /** ISO-Datum. */
  due?: string
}

const headers = { 'Content-Type': 'application/json', 'X-Requested-With': 'management-tool' }

async function fetchInbox(): Promise<InboxTask[]> {
  const res = await fetch('/api/inbox', { headers }).catch(() => null)
  if (!res?.ok) return []
  const data = (await res.json().catch(() => null)) as { tasks?: InboxTask[] } | null
  return data?.tasks ?? []
}

async function clearInbox(): Promise<void> {
  await fetch('/api/inbox/clear', { method: 'POST', headers }).catch(() => null)
}

export function useInbox() {
  const [tasks, setTasks] = useState<InboxTask[]>([])

  const reload = useCallback(() => {
    void fetchInbox().then(setTasks)
  }, [])

  useEffect(() => {
    reload()
    // Beim Zurückkommen ins Fenster erneut schauen – so taucht eine neue Liste
    // auf, ohne dass die Seite neu geladen werden muss.
    const onFocus = () => reload()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [reload])

  const clear = useCallback(async () => {
    setTasks([])
    await clearInbox()
  }, [])

  return { tasks, reload, clear }
}
