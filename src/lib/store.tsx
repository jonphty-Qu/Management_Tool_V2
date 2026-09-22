import { createContext, useContext } from 'react'
import { useEvents } from './events'
import { useBoard } from './board'
import { useNotes } from './notes'

type EventStore = ReturnType<typeof useEvents>
type BoardStore = ReturnType<typeof useBoard>
type NoteStore = ReturnType<typeof useNotes>

const EventsContext = createContext<EventStore | null>(null)
const BoardContext = createContext<BoardStore | null>(null)
const NotesContext = createContext<NoteStore | null>(null)

/**
 * Termine, Board und Notizen an je einer Stelle halten.
 *
 * Mehrere Kopien desselben Hooks würden sich beim Speichern gegenseitig
 * überschreiben – seit die Spracheingabe von überall anlegt, muss der Zustand
 * geteilt sein.
 */
export function AppStoreProvider({ children }: { children: React.ReactNode }) {
  const events = useEvents()
  const board = useBoard()
  const notes = useNotes()
  return (
    <EventsContext.Provider value={events}>
      <BoardContext.Provider value={board}>
        <NotesContext.Provider value={notes}>{children}</NotesContext.Provider>
      </BoardContext.Provider>
    </EventsContext.Provider>
  )
}

export function useEventStore(): EventStore {
  const ctx = useContext(EventsContext)
  if (!ctx) throw new Error('useEventStore muss innerhalb von AppStoreProvider verwendet werden')
  return ctx
}

export function useBoardStore(): BoardStore {
  const ctx = useContext(BoardContext)
  if (!ctx) throw new Error('useBoardStore muss innerhalb von AppStoreProvider verwendet werden')
  return ctx
}

export function useNoteStore(): NoteStore {
  const ctx = useContext(NotesContext)
  if (!ctx) throw new Error('useNoteStore muss innerhalb von AppStoreProvider verwendet werden')
  return ctx
}
