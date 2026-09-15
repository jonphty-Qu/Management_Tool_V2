import { useEffect, useRef, useState } from 'react'
import { CalendarDays } from 'lucide-react'
import { cn } from '@/lib/cn'
import { formatDateInput, formatTime, parseDateText, parseTimeText, toLocalInput } from '@/lib/date'

interface DateProps {
  value: Date
  onChange: (next: Date) => void
  className?: string
}

/**
 * Datumsfeld mit freier Eingabe (04062026, 4.6.26, "morgen") und
 * nativem Datepicker über das Kalender-Symbol.
 */
export function DateInput({ value, onChange, className }: DateProps) {
  const [text, setText] = useState(() => formatDateInput(value))
  const [focused, setFocused] = useState(false)
  const [invalid, setInvalid] = useState(false)
  const pickerRef = useRef<HTMLInputElement>(null)

  // Externe Änderungen übernehmen, solange nicht getippt wird
  useEffect(() => {
    if (!focused) setText(formatDateInput(value))
  }, [value, focused])

  const commit = (raw: string) => {
    const parsed = parseDateText(raw, value)
    if (!parsed) {
      setInvalid(raw.trim().length > 0)
      setText(formatDateInput(value))
      return
    }
    setInvalid(false)
    // Uhrzeit des bisherigen Werts behalten
    const next = new Date(parsed)
    next.setHours(value.getHours(), value.getMinutes(), 0, 0)
    onChange(next)
    setText(formatDateInput(next))
  }

  const openPicker = () => {
    const el = pickerRef.current
    if (!el) return
    if (typeof el.showPicker === 'function') el.showPicker()
    else el.click()
  }

  return (
    <div className={cn('relative', className)}>
      <input
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          setInvalid(false)
        }}
        onFocus={(e) => {
          setFocused(true)
          e.target.select()
        }}
        onBlur={(e) => {
          setFocused(false)
          commit(e.target.value)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            commit((e.target as HTMLInputElement).value)
          }
        }}
        inputMode="numeric"
        placeholder="TT.MM.JJJJ"
        aria-label="Datum"
        className={cn(
          'w-[8.5rem] rounded-lg border bg-white py-1.5 pr-8 pl-2.5 text-sm tabular-nums outline-none transition dark:bg-neutral-800',
          invalid
            ? 'border-red-400 dark:border-red-500'
            : 'border-neutral-200 focus:border-neutral-400 dark:border-neutral-700 dark:focus:border-neutral-500',
        )}
      />

      <button
        type="button"
        onClick={openPicker}
        aria-label="Datum auswählen"
        className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded p-1 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-700 dark:hover:text-white"
      >
        <CalendarDays className="size-4" />
      </button>

      {/* Nativer Picker – unsichtbar, wird über das Symbol geöffnet */}
      <input
        ref={pickerRef}
        type="date"
        tabIndex={-1}
        aria-hidden
        value={toLocalInput(value, false)}
        onChange={(e) => {
          const parsed = e.target.value ? new Date(`${e.target.value}T00:00`) : null
          if (!parsed) return
          const next = new Date(parsed)
          next.setHours(value.getHours(), value.getMinutes(), 0, 0)
          onChange(next)
        }}
        className="pointer-events-none absolute right-2 bottom-0 size-0 opacity-0"
      />
    </div>
  )
}

interface TimeProps {
  value: Date
  onChange: (next: Date) => void
  className?: string
}

/** Uhrzeitfeld mit freier Eingabe: 1430, 14:30, 14. */
export function TimeInput({ value, onChange, className }: TimeProps) {
  const [text, setText] = useState(() => formatTime(value))
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (!focused) setText(formatTime(value))
  }, [value, focused])

  const commit = (raw: string) => {
    const minutes = parseTimeText(raw)
    if (minutes === null) {
      setText(formatTime(value))
      return
    }
    const next = new Date(value)
    next.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0)
    onChange(next)
    setText(formatTime(next))
  }

  return (
    <input
      value={text}
      onChange={(e) => setText(e.target.value)}
      onFocus={(e) => {
        setFocused(true)
        e.target.select()
      }}
      onBlur={(e) => {
        setFocused(false)
        commit(e.target.value)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          commit((e.target as HTMLInputElement).value)
        }
      }}
      inputMode="numeric"
      placeholder="HH:MM"
      aria-label="Uhrzeit"
      className={cn(
        'w-[5rem] rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-sm tabular-nums outline-none transition focus:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-800 dark:focus:border-neutral-500',
        className,
      )}
    />
  )
}
