import { useEffect, useMemo, useState } from 'react'
import { Clock3, Play, Square, Trash2 } from 'lucide-react'
import { useBoardStore } from '@/lib/store'

interface Entry {
  id: string
  task: string
  startedAt: string
  endedAt: string
  seconds: number
  cardId?: string
  projectId?: string
}
interface Running { task: string; startedAt: string; accumulated?: number; paused?: boolean; cardId?: string; projectId?: string }
const KEY = 'mt.time'
const RUNNING_KEY = 'mt.time.running'
const format = (seconds: number) => `${Math.floor(seconds / 3600).toString().padStart(2, '0')}:${Math.floor((seconds % 3600) / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`
const id = () => `time-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`

export default function Time() {
  const { projects } = useBoardStore()
  const [entries, setEntries] = useState<Entry[]>(() => { try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') } catch { return [] } })
  const [running, setRunning] = useState<Running | null>(() => { try { const value = localStorage.getItem(RUNNING_KEY); return value ? JSON.parse(value) : null } catch { return null } })
  const [task, setTask] = useState('')
  const [selectedCard, setSelectedCard] = useState('')
  const [, tick] = useState(0)
  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(entries)) }, [entries])
  useEffect(() => { if (running) localStorage.setItem(RUNNING_KEY, JSON.stringify(running)); else localStorage.removeItem(RUNNING_KEY) }, [running])
  useEffect(() => { if (!running) return; const timer = window.setInterval(() => tick((n) => n + 1), 1000); return () => window.clearInterval(timer) }, [running])
  const elapsed = running ? (running.accumulated ?? 0) + (running.paused ? 0 : Math.max(0, Math.floor((Date.now() - new Date(running.startedAt).getTime()) / 1000))) : 0
  const today = localDateKey(new Date())
  const todayEntries = useMemo(() => entries.filter((entry) => localDateKey(new Date(entry.startedAt)) === today), [entries, today])
  const todaySeconds = todayEntries.reduce((sum, entry) => sum + entry.seconds, 0) + elapsed
  const start = () => { if (!running) { const selected = projects.flatMap((project) => project.cards.map((card) => ({ ...card, projectId: project.id }))).find((card) => card.id === selectedCard); setRunning({ task: selected?.title || task.trim() || 'Allgemein', startedAt: new Date().toISOString(), cardId: selected?.id, projectId: selected?.projectId }) }; setTask('') }
  const pause = () => { if (!running || running.paused) return; setRunning({ ...running, accumulated: elapsed, startedAt: new Date().toISOString(), paused: true }) }
  const resume = () => { if (!running || !running.paused) return; setRunning({ ...running, startedAt: new Date().toISOString(), paused: false }) }
  const stop = () => { if (!running) return; const endedAt = new Date().toISOString(); setEntries((prev) => [{ id: id(), task: running.task, startedAt: running.startedAt, endedAt, seconds: Math.max(1, elapsed), cardId: running.cardId, projectId: running.projectId }, ...prev]); setRunning(null) }
  const chart = Array.from({ length: 7 }, (_, offset) => { const date = new Date(); date.setDate(date.getDate() - (6 - offset)); const key = localDateKey(date); const seconds = entries.filter((entry) => localDateKey(new Date(entry.startedAt)) === key).reduce((sum, entry) => sum + entry.seconds, 0); return { key, label: date.toLocaleDateString('de-DE', { weekday: 'short' }), seconds } })
  const chartMax = Math.max(1, ...chart.map((day) => day.seconds))
  return <div className="mx-auto w-full max-w-4xl space-y-6">
    <div><h2 className="text-2xl font-semibold tracking-tight">Zeiterfassung</h2><p className="mt-1 text-sm text-neutral-500">Arbeitszeit mit Start und Stopp erfassen.</p></div>
    <section className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex flex-wrap items-center gap-3"><Clock3 className="size-5 text-neutral-400" /><div className="mr-auto"><div className="text-sm font-medium">{running ? `${running.task}${running.paused ? ' (pausiert)' : ''}` : 'Bereit für den nächsten Eintrag'}</div><div className="font-mono text-3xl tabular-nums">{format(elapsed)}</div></div>{running ? <div className="flex items-center gap-2"><button type="button" onClick={running.paused ? resume : pause} className="rounded-lg border border-neutral-200 px-3 py-2 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800">{running.paused ? 'Weiter' : 'Pause'}</button><button type="button" onClick={stop} className="flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700"><Square className="size-4" />Stopp</button></div> : <><select value={selectedCard} onChange={(e) => setSelectedCard(e.target.value)} className="max-w-xs rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none dark:border-neutral-700 dark:bg-neutral-800"><option value="">Aufgabe auswählen …</option>{projects.map((project) => <optgroup key={project.id} label={project.name}>{project.cards.map((card) => <option key={card.id} value={card.id}>{card.title}</option>)}</optgroup>)}</select><input value={task} onChange={(e) => setTask(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') start() }} placeholder="Oder eigene Tätigkeit …" className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-800" /><button type="button" onClick={start} className="flex items-center gap-2 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900"><Play className="size-4" />Start</button></>}</div>
    </section>
    <section className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900"><h3 className="text-sm font-semibold">Letzte 7 Tage</h3><div className="mt-4 flex h-36 items-end gap-2">{chart.map((day) => <div key={day.key} className="flex min-w-0 flex-1 flex-col items-center gap-1"><div className="w-full rounded-t bg-indigo-500 transition" style={{ height: `${Math.max(4, (day.seconds / chartMax) * 100)}%` }} title={format(day.seconds)} /><span className="text-[10px] text-neutral-500">{day.label}</span></div>)}</div></section>
    <section className="rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900"><div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3 dark:border-neutral-800"><h3 className="text-sm font-semibold">Heute</h3><span className="font-mono text-sm tabular-nums">{format(todaySeconds)}</span></div><ul className="divide-y divide-neutral-100 dark:divide-neutral-800">{todayEntries.length === 0 && <li className="px-4 py-8 text-center text-sm text-neutral-500">Noch keine Zeit erfasst.</li>}{todayEntries.map((entry) => <li key={entry.id} className="flex items-center gap-3 px-4 py-3"><div className="min-w-0 flex-1"><div className="truncate text-sm">{entry.task}</div><div className="text-xs text-neutral-500">{new Date(entry.startedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}–{new Date(entry.endedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</div></div><span className="font-mono text-sm tabular-nums">{format(entry.seconds)}</span><button type="button" onClick={() => setEntries((prev) => prev.filter((item) => item.id !== entry.id))} aria-label="Zeiteintrag löschen" className="rounded p-1.5 text-neutral-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="size-3.5" /></button></li>)}</ul></section>
  </div>
}

function localDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
