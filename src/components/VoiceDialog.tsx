import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CalendarDays,
  Check,
  FolderKanban,
  Loader2,
  Mic,
  MicOff,
  NotebookPen,
  Send,
  Sparkles,
  Undo2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { useBoardStore, useEventStore, useNoteStore } from '@/lib/store'
import { newId } from '@/lib/events'
import { priorities } from '@/lib/board'
import { loadSettings } from '@/lib/settings'
import {
  cancelSpeech,
  micPermission,
  recognitionSupported,
  speak,
  synthesisSupported,
  useDictation,
} from '@/lib/speech'
import {
  isCreateIntent,
  parseConfirmation,
  parseTaskList,
  parseVoiceCommand,
  splitCommands,
  type CreateIntent,
  type EventIntent,
  type TaskIntent,
  type VoiceIntent,
} from '@/lib/voiceCommands'
import {
  answerQuery,
  batchConfirmation,
  doneColumn,
  eventConfirmation,
  findOpenTask,
  noteConfirmation,
  spokenDay,
  taskConfirmation,
  updateConfirmation,
  VOICE_HELP,
} from '@/lib/voiceAnswers'
import { formatTime } from '@/lib/date'
import {
  formatTrackedTime,
  loadRunningTime,
  pauseTracking,
  resumeTracking,
  startTracking,
  stopTracking,
  trackedSeconds,
} from '@/lib/time'

interface Props {
  onClose: () => void
}

type EntryKind = 'task' | 'event' | 'note'

interface LogEntry {
  id: string
  role: 'user' | 'assistant'
  text: string
  /** Angelegter Eintrag – für die Karte im Verlauf. */
  entry?: { kind: EntryKind; title: string; meta: string }
  /** Anlage zurücknehmen. */
  undo?: () => void
  undone?: boolean
}

const entryIcons: Record<EntryKind, typeof FolderKanban> = {
  task: FolderKanban,
  event: CalendarDays,
  note: NotebookPen,
}

const EXAMPLES = [
  'Aufgabe Angebot schreiben bis Freitag, hohe Priorität',
  'Termin morgen um 14 Uhr Zahnarzt',
  'Aufgaben: Einkaufen, Bett neu beziehen, Prof antworten',
  'Hake Einkaufen ab',
  'Was steht heute an?',
]

/** Kurzbeschreibung unter dem Titel im Verlauf. */
function taskMeta(intent: TaskIntent, projectName: string): string {
  const parts = [`Projekt ${projectName}`, `Priorität ${priorities[intent.priority].label}`]
  if (intent.due) parts.unshift(`fällig ${spokenDay(intent.due)}`)
  return parts.join(' · ')
}

function eventMeta(intent: EventIntent): string {
  const start = new Date(intent.start)
  const when = intent.allDay
    ? `${spokenDay(start)}, ganztägig`
    : `${spokenDay(start)}, ${formatTime(start)}–${formatTime(new Date(intent.end))}`
  return when
}

export default function VoiceDialog({ onClose }: Props) {
  const navigate = useNavigate()
  const { projects, quickAdd, setActive, removeCard, removeProject, moveCardTo, updateCard } =
    useBoardStore()
  const { events, save: saveEvent, remove: removeEvent } = useEventStore()
  const { create: createNote, update: updateNote, remove: removeNote } = useNoteStore()

  // Einstellungen einmal je Sitzung lesen – der Dialog wird beim Öffnen frisch gemountet
  const [settings] = useState(loadSettings)
  const [speakAnswers, setSpeakAnswers] = useState(settings.voice.speak && synthesisSupported())
  const [log, setLog] = useState<LogEntry[]>([])
  const [pending, setPending] = useState<VoiceIntent | null>(null)
  const [speaking, setSpeaking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [typed, setTyped] = useState('')
  const [micBlocked, setMicBlocked] = useState(false)

  const supported = recognitionSupported()
  const logRef = useRef<HTMLDivElement>(null)
  const pendingRef = useRef<VoiceIntent | null>(null)
  const alive = useRef(true)
  const speakRef = useRef(speakAnswers)
  const helpGiven = useRef(false)

  const logItems = useRef<LogEntry[]>([])
  /** Letzter erkannter Satz – gegen doppelte Ergebnisse der Erkennung. */
  const lastHeard = useRef({ text: '', at: 0 })

  pendingRef.current = pending
  speakRef.current = speakAnswers
  logItems.current = log

  const push = useCallback((item: Omit<LogEntry, 'id'>) => {
    setLog((prev) => [...prev, { ...item, id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}` }])
  }, [])

  const dictation = useDictation({
    onResult: (text) => handleText(text),
    onError: (message) => setError(message),
  })

  const dictationRef = useRef(dictation)
  dictationRef.current = dictation

  /** Antwort zeigen und – wenn gewünscht – sprechen. Das Mikrofon pausiert solange. */
  const respond = useCallback(
    async (text: string, extra?: Partial<LogEntry>) => {
      push({ role: 'assistant', text, ...extra })
      if (!speakRef.current) return
      const wasListening = dictationRef.current.listening
      setSpeaking(true)
      dictationRef.current.stop()
      await speak(text, {
        voiceURI: settings.voice.voiceURI || undefined,
        rate: settings.voice.rate,
      })
      if (!alive.current) return
      setSpeaking(false)
      if (wasListening && settings.voice.continuous) dictationRef.current.start()
    },
    [push, settings.voice.continuous, settings.voice.rate, settings.voice.voiceURI],
  )

  // ---------- Einträge anlegen ----------

  /** Anlegen, ohne zu sprechen – der Aufrufer entscheidet über die Antwort. */
  const createEntry = useCallback(
    (intent: CreateIntent): { text: string; item: Omit<LogEntry, 'id' | 'role' | 'text'> } => {
      if (intent.kind === 'task') {
        const where = quickAdd({
          title: intent.title,
          priority: intent.priority,
          end: intent.due?.toISOString(),
          description: intent.description ?? undefined,
          projectName: intent.project,
        })
        return {
          text: taskConfirmation(intent, where),
          item: {
            entry: { kind: 'task', title: intent.title, meta: taskMeta(intent, where.projectName) },
            undo: () => {
              // Ein eigens angelegtes Projekt soll nicht leer zurückbleiben
              if (where.createdProject) {
                removeProject(where.projectId)
                return
              }
              setActive(where.projectId)
              removeCard(where.cardId)
            },
          },
        }
      }

      if (intent.kind === 'event') {
        const id = newId()
        saveEvent({
          id,
          title: intent.title,
          start: intent.start.toISOString(),
          end: intent.end.toISOString(),
          allDay: intent.allDay,
          category: intent.category,
          notes: intent.description ?? undefined,
        })
        return {
          text: eventConfirmation(intent),
          item: {
            entry: { kind: 'event', title: intent.title, meta: eventMeta(intent) },
            undo: () => removeEvent(id),
          },
        }
      }

      const note = createNote()
      updateNote(note.id, { title: intent.title, content: intent.content })
      return {
        text: noteConfirmation(intent),
        item: {
          entry: { kind: 'note', title: intent.title, meta: 'Notiz' },
          undo: () => removeNote(note.id),
        },
      }
    },
    [createNote, quickAdd, removeCard, removeEvent, removeNote, removeProject, saveEvent, setActive, updateNote],
  )

  const commit = useCallback(
    (intent: VoiceIntent) => {
      setPending(null)
      if (!isCreateIntent(intent)) return
      const { text, item } = createEntry(intent)
      void respond(text, item)
    },
    [createEntry, respond],
  )

  /** Mehrere Aufträge aus einem Diktat: alle anlegen, einmal antworten. */
  const commitAll = useCallback(
    (intents: CreateIntent[]) => {
      setPending(null)
      const created = intents.map((intent) => ({ intent, result: createEntry(intent) }))
      for (const { result } of created) push({ role: 'assistant', text: '', ...result.item })
      void respond(batchConfirmation(created.map(({ intent }) => ({ kind: intent.kind, title: intent.title }))))
    },
    [createEntry, push, respond],
  )

  const undoEntry = useCallback((item: LogEntry) => {
    item.undo?.()
    setLog((prev) => prev.map((l) => (l.id === item.id ? { ...l, undone: true } : l)))
  }, [])

  const undoLast = useCallback(() => {
    const target = [...logItems.current].reverse().find((item) => item.undo && !item.undone)
    if (!target) {
      void respond('Da ist nichts, was ich zurücknehmen kann.')
      return
    }
    undoEntry(target)
    void respond('Rückgängig gemacht.')
  }, [respond, undoEntry])

  // ---------- Gesprochenes verarbeiten ----------

  const handleIntent = useCallback(
    (intent: VoiceIntent) => {
      switch (intent.kind) {
        case 'control':
          if (intent.action === 'cancel') {
            cancelSpeech()
            onClose()
          } else if (intent.action === 'undo') {
            undoLast()
          } else if (intent.action === 'help') {
            void respond(VOICE_HELP)
          } else {
            const last = [...log].reverse().find((item) => item.role === 'assistant')
            void respond(last?.text ?? 'Ich habe noch nichts gesagt.')
          }
          return

        case 'navigate': {
          navigate(intent.path)
          // Kurz die Ansage abwarten, aber die Seite nicht unnötig lange verdecken
          const spoken = respond(`Ich öffne ${intent.label}.`)
          void Promise.race([spoken, new Promise((done) => window.setTimeout(done, 1500))]).then(() => {
            if (alive.current) onClose()
          })
          return
        }

        case 'query':
          void respond(answerQuery(intent.scope, events, projects))
          return

        case 'timer': {
          const running = loadRunningTime()
          if (intent.action === 'start') {
            if (running) {
              void respond(`Es läuft schon ein Timer für ${running.task}.`)
              return
            }
            const hit = intent.query ? findOpenTask(projects, intent.query) : null
            const label = hit?.card.title ?? intent.query
            if (!label) {
              void respond('Wofür soll der Timer laufen?')
              return
            }
            startTracking(label, hit?.card.id, hit?.projectId)
            void respond(`Timer läuft für ${label}.`, {
              entry: { kind: 'task', title: label, meta: 'Zeiterfassung gestartet' },
              undo: () => {
                stopTracking()
              },
            })
            return
          }

          if (!running) {
            void respond('Es läuft gerade kein Timer.')
            return
          }
          if (intent.action === 'pause') {
            pauseTracking()
            void respond(`Timer pausiert bei ${formatTrackedTime(trackedSeconds(running))}.`)
            return
          }
          if (intent.action === 'resume') {
            resumeTracking()
            void respond(`Timer läuft weiter für ${running.task}.`)
            return
          }
          const entry = stopTracking()
          void respond(
            entry
              ? `Timer gestoppt: ${formatTrackedTime(entry.seconds)} für ${entry.task}.`
              : 'Timer gestoppt.',
          )
          return
        }

        case 'update': {
          const hit = findOpenTask(projects, intent.query)
          if (!hit) {
            void respond(`Ich finde keine offene Aufgabe, die „${intent.query}“ heißt.`)
            return
          }
          const before = { end: hit.card.end, priority: hit.card.priority }
          updateCard(hit.projectId, hit.card.id, {
            ...(intent.due ? { end: intent.due.toISOString() } : {}),
            ...(intent.priority ? { priority: intent.priority } : {}),
          })
          void respond(updateConfirmation(hit.card.title, intent.due, intent.priority), {
            entry: {
              kind: 'task',
              title: hit.card.title,
              meta: `${hit.projectName} · geändert`,
            },
            undo: () => updateCard(hit.projectId, hit.card.id, before),
          })
          return
        }

        case 'complete': {
          const hit = findOpenTask(projects, intent.query)
          if (!hit) {
            void respond(`Ich finde keine offene Aufgabe, die „${intent.query}“ heißt.`)
            return
          }
          const project = projects.find((p) => p.id === hit.projectId)
          if (!project) return
          const target = doneColumn(project)
          const fromColumn = hit.card.columnId
          if (fromColumn === target.id) {
            void respond(`„${hit.card.title}“ ist schon erledigt.`)
            return
          }
          moveCardTo(hit.projectId, hit.card.id, target.id)
          void respond(`Erledigt: ${hit.card.title}.`, {
            entry: { kind: 'task', title: hit.card.title, meta: `${project.name} · ${target.title}` },
            undo: () => moveCardTo(hit.projectId, hit.card.id, fromColumn),
          })
          return
        }

        case 'task':
        case 'event':
        case 'note':
          if (settings.voice.confirm) {
            setPending(intent)
            const what =
              intent.kind === 'task'
                ? `Aufgabe „${intent.title}“`
                : intent.kind === 'event'
                  ? `Termin „${intent.title}“`
                  : `Notiz „${intent.title}“`
            void respond(`Soll ich ${what} anlegen?`)
          } else {
            commit(intent)
          }
          return

        default: {
          const hint = helpGiven.current ? '' : ` ${VOICE_HELP}`
          helpGiven.current = true
          void respond(`Das habe ich nicht verstanden.${hint}`)
        }
      }
    },
    [
      commit,
      events,
      log,
      moveCardTo,
      navigate,
      onClose,
      projects,
      respond,
      settings.voice.confirm,
      undoLast,
      updateCard,
    ],
  )

  function handleText(text: string) {
    const clean = text.trim()
    if (!clean) return

    // Chrome liefert denselben Satz gelegentlich zweimal – sonst entstünde alles doppelt
    const now = Date.now()
    if (lastHeard.current.text === clean.toLowerCase() && now - lastHeard.current.at < 3000) return
    lastHeard.current = { text: clean.toLowerCase(), at: now }

    setError(null)
    push({ role: 'user', text: clean })

    const waiting = pendingRef.current
    if (waiting) {
      const answer = parseConfirmation(clean)
      if (answer === true) {
        commit(waiting)
        return
      }
      if (answer === false) {
        setPending(null)
        void respond('Alles klar, ich lege nichts an.')
        return
      }
      // Keine klare Antwort: den Satz als neuen Auftrag lesen
      setPending(null)
    }

    // Angesagte Liste: „Aufgaben: Werkstatt anrufen, Präsentation, Einkaufen“
    const list = parseTaskList(clean)
    if (list && !settings.voice.confirm) {
      const intents = list
        .map((part) => parseVoiceCommand(part, new Date(), 'task'))
        .filter(isCreateIntent)
      if (intents.length > 1) {
        commitAll(intents)
        return
      }
    }

    // Ein Diktat kann mehrere Aufträge enthalten („… und dann Aufgabe …“)
    const parts = splitCommands(clean)
    if (parts.length > 1) {
      const intents = parts.map((part) => parseVoiceCommand(part))
      const creates = intents.filter(isCreateIntent)
      if (creates.length > 1 && creates.length === intents.length && !settings.voice.confirm) {
        commitAll(creates)
        return
      }
    }

    handleIntent(parseVoiceCommand(clean))
  }

  // ---------- Lebenszyklus ----------

  useEffect(() => {
    alive.current = true
    if (supported) dictation.start()
    // Blockiertes Mikrofon gleich melden, statt auf den ersten Fehler zu warten
    void micPermission().then((state) => {
      if (alive.current) setMicBlocked(state === 'denied')
    })
    return () => {
      alive.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Verlauf immer am Ende halten
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' })
  }, [log, pending])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        cancelSpeech()
        onClose()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const toggleSpeak = () => {
    setSpeakAnswers((value) => {
      if (value) cancelSpeech()
      return !value
    })
  }

  const status = speaking
    ? 'Antwortet…'
    : dictation.listening
      ? 'Ich höre zu…'
      : supported
        ? 'Mikrofon aus'
        : 'Spracherkennung nicht verfügbar'

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 backdrop-blur-sm sm:items-center"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          cancelSpeech()
          onClose()
        }
      }}
    >
      <div
        role="dialog"
        aria-label="Sprachassistent"
        className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-xl dark:border-neutral-800 dark:bg-neutral-900"
      >
        {/* Kopf */}
        <div className="flex items-center gap-2 border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
          <Sparkles className="size-4 text-indigo-500" />
          <h2 className="flex-1 text-sm font-semibold">Sprache</h2>
          <button
            type="button"
            onClick={toggleSpeak}
            title={speakAnswers ? 'Antworten vorlesen: an' : 'Antworten vorlesen: aus'}
            aria-pressed={speakAnswers}
            className="rounded-lg p-2 text-neutral-500 transition hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            {speakAnswers ? <Volume2 className="size-[18px]" /> : <VolumeX className="size-[18px]" />}
          </button>
          <button
            type="button"
            onClick={() => {
              cancelSpeech()
              onClose()
            }}
            aria-label="Schließen"
            className="rounded-lg p-2 text-neutral-500 transition hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            <X className="size-[18px]" />
          </button>
        </div>

        {/* Mikrofon */}
        <div className="flex flex-col items-center gap-3 px-4 py-5">
          <button
            type="button"
            onClick={() => (dictation.listening ? dictation.stop() : dictation.start())}
            disabled={!supported}
            aria-label={dictation.listening ? 'Mikrofon aus' : 'Mikrofon an'}
            className={cn(
              'relative grid size-16 place-items-center rounded-full transition disabled:opacity-40',
              dictation.listening
                ? 'bg-indigo-600 text-white'
                : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700',
            )}
          >
            {dictation.listening && (
              <span className="absolute inset-0 animate-ping rounded-full bg-indigo-500/40" />
            )}
            {speaking ? (
              <Loader2 className="size-6 animate-spin" />
            ) : dictation.listening ? (
              <Mic className="relative size-6" />
            ) : (
              <MicOff className="size-6" />
            )}
          </button>

          <p className="min-h-5 text-center text-sm text-neutral-500">
            {dictation.interim || status}
          </p>

          {error && (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-center text-xs text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
              {error}
            </p>
          )}
          {!supported && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-center text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
              Dieser Browser erkennt keine Sprache. In Chrome oder Edge funktioniert es – tippen geht hier
              trotzdem.
            </p>
          )}
          {supported && micBlocked && !error && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-center text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
              Das Mikrofon ist für diese Seite gesperrt. Im Browser links neben der Adresse (bzw. über das
              Schloss-Symbol) wieder erlauben.
            </p>
          )}
        </div>

        {/* Verlauf */}
        <div ref={logRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto border-t border-neutral-200 px-4 py-4 dark:border-neutral-800">
          {log.length === 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold tracking-wide text-neutral-400 uppercase">Sag zum Beispiel</p>
              {EXAMPLES.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => handleText(example)}
                  className="block w-full rounded-lg border border-neutral-200 px-3 py-2 text-left text-sm text-neutral-600 transition hover:border-neutral-300 hover:bg-neutral-50 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-800"
                >
                  „{example}“
                </button>
              ))}
            </div>
          )}

          {log.map((item) => (
            <div key={item.id} className={cn('flex', item.role === 'user' ? 'justify-end' : 'justify-start')}>
              <div
                className={cn(
                  'max-w-[85%] rounded-2xl px-3 py-2 text-sm',
                  item.role === 'user'
                    ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                    : 'bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-100',
                )}
              >
                {item.text && (
                  <p className={cn(item.undone && 'line-through opacity-60')}>{item.text}</p>
                )}

                {item.entry && (
                  <div
                    className={cn(
                      'flex items-center gap-2 rounded-lg bg-white/70 px-2 py-1.5 dark:bg-neutral-900/60',
                      item.text && 'mt-2',
                      item.undone && 'opacity-60',
                    )}
                  >
                    {(() => {
                      const Icon = entryIcons[item.entry.kind]
                      return <Icon className="size-4 shrink-0 text-indigo-500" />
                    })()}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium">{item.entry.title}</span>
                      <span className="block truncate text-[11px] text-neutral-500">{item.entry.meta}</span>
                    </span>
                    {item.undo && !item.undone && (
                      <button
                        type="button"
                        onClick={() => undoEntry(item)}
                        title="Rückgängig"
                        className="rounded p-1 text-neutral-400 transition hover:text-neutral-900 dark:hover:text-white"
                      >
                        <Undo2 className="size-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Rückfrage vor dem Anlegen */}
          {pending && (pending.kind === 'task' || pending.kind === 'event' || pending.kind === 'note') && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => commit(pending)}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-neutral-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
              >
                <Check className="size-4" /> Anlegen
              </button>
              <button
                type="button"
                onClick={() => {
                  setPending(null)
                  void respond('Alles klar, ich lege nichts an.')
                }}
                className="rounded-lg border border-neutral-200 px-3 py-2 text-sm transition hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
              >
                Verwerfen
              </button>
            </div>
          )}
        </div>

        {/* Tippen als Rückfall */}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            const value = typed
            setTyped('')
            handleText(value)
          }}
          className="flex items-center gap-2 border-t border-neutral-200 px-3 py-2.5 dark:border-neutral-800"
        >
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="… oder hier tippen"
            className="min-w-0 flex-1 rounded-lg border border-neutral-200 bg-transparent px-3 py-2 text-sm outline-none transition focus:border-neutral-400 dark:border-neutral-700 dark:focus:border-neutral-500"
          />
          <button
            type="submit"
            disabled={!typed.trim()}
            aria-label="Senden"
            className="rounded-lg bg-neutral-900 p-2 text-white transition hover:bg-neutral-700 disabled:opacity-30 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            <Send className="size-4" />
          </button>
        </form>

        <p className="border-t border-neutral-200 px-4 py-2 text-[11px] text-neutral-400 dark:border-neutral-800">
          Die Erkennung läuft über den Sprachdienst des Browsers – das Gesagte wird dorthin übertragen.
          Die Antwort spricht der Rechner selbst.
        </p>
      </div>
    </div>
  )
}
