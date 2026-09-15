import { createContext, useContext } from 'react'
import { useEvents } from './events'

type EventStore = ReturnType<typeof useEvents>

const EventsContext = createContext<EventStore | null>(null)

/** Termine an einer Stelle halten – Kalender und Benachrichtigungen teilen sie sich. */
export function EventsProvider({ children }: { children: React.ReactNode }) {
  const store = useEvents()
  return <EventsContext.Provider value={store}>{children}</EventsContext.Provider>
}

export function useEventStore(): EventStore {
  const ctx = useContext(EventsContext)
  if (!ctx) throw new Error('useEventStore muss innerhalb von EventsProvider verwendet werden')
  return ctx
}
