import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { cn } from '@/lib/cn'

const DAY = 1440
const WEEK = 7 * DAY
const timedOptions = [0, 30, 60, 120, DAY, 3 * DAY, WEEK]
const allDayOptions = [0, DAY, 3 * DAY, WEEK]

/** Minuten vor Beginn als Text: „2 Std. vorher“, „3 Tage vorher“ … */
export function formatAlert(minutes: number, allDay = false): string {
  if (minutes === 0) return allDay ? 'Am Tag' : 'Zum Beginn'
  if (minutes % WEEK === 0) {
    const w = minutes / WEEK
    return w === 1 ? '1 Woche vorher' : `${w} Wochen vorher`
  }
  if (minutes % DAY === 0) {
    const d = minutes / DAY
    return d === 1 ? '1 Tag vorher' : `${d} Tage vorher`
  }
  if (minutes % 60 === 0) return `${minutes / 60} Std. vorher`
  return `${minutes} Min. vorher`
}

const sortDesc = (list: number[]) => [...list].sort((a, b) => b - a)

const chip = (active: boolean) =>
  cn(
    'rounded-full border px-2.5 py-1 text-xs transition',
    active
      ? 'border-neutral-900 font-medium dark:border-white'
      : 'border-neutral-200 text-neutral-500 hover:border-neutral-300 dark:border-neutral-700 dark:hover:border-neutral-600',
  )

interface Props {
  /** Minuten vor Beginn. */
  value: number[]
  onChange: (next: number[]) => void
  allDay?: boolean
}

/** Erinnerungen wählen: feste Stufen plus frei einstellbare eigene Zeiten. */
export default function AlertPicker({ value, onChange, allDay = false }: Props) {
  const [amount, setAmount] = useState('')
  const [unit, setUnit] = useState<'min' | 'std' | 'tag'>(allDay ? 'tag' : 'std')

  const options = allDay ? allDayOptions : timedOptions
  const custom = sortDesc(value.filter((v) => !options.includes(v)))

  const toggle = (m: number) =>
    onChange(value.includes(m) ? value.filter((v) => v !== m) : sortDesc([...value, m]))

  const add = () => {
    const n = Number(amount.replace(',', '.'))
    if (!Number.isFinite(n) || n <= 0) return
    const minutes = Math.round(n * (unit === 'min' ? 1 : unit === 'std' ? 60 : DAY))
    if (!value.includes(minutes)) onChange(sortDesc([...value, minutes]))
    setAmount('')
  }

  const small =
    'rounded-md border border-neutral-200 bg-white px-1.5 py-1 text-xs outline-none focus:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-800 dark:focus:border-neutral-500'

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {options.map((m) => (
          <button key={m} type="button" onClick={() => toggle(m)} className={chip(value.includes(m))}>
            {formatAlert(m, allDay)}
          </button>
        ))}
        {custom.map((m) => (
          <span key={m} className={cn(chip(true), 'flex items-center gap-1')}>
            {formatAlert(m, allDay)}
            <button
              type="button"
              onClick={() => toggle(m)}
              aria-label={`${formatAlert(m, allDay)} entfernen`}
              className="opacity-60 hover:opacity-100"
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-1.5 text-xs text-neutral-500">
        <span>Eigene:</span>
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add()
            }
          }}
          inputMode="decimal"
          placeholder="z. B. 5"
          aria-label="Eigene Erinnerung – Anzahl"
          className={cn(small, 'w-14 tabular-nums')}
        />
        <select
          value={unit}
          onChange={(e) => setUnit(e.target.value as 'min' | 'std' | 'tag')}
          aria-label="Einheit"
          className={small}
        >
          {[
            ['min', 'Minuten'],
            ['std', 'Stunden'],
            ['tag', 'Tage'],
          ].map(([v, label]) => (
            <option key={v} value={v} className="bg-white text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100">
              {label}
            </option>
          ))}
        </select>
        <span>vorher</span>
        <button
          type="button"
          onClick={add}
          disabled={!amount.trim()}
          aria-label="Erinnerung hinzufügen"
          className="rounded-md border border-neutral-200 p-1 transition hover:bg-neutral-50 disabled:opacity-40 dark:border-neutral-700 dark:hover:bg-neutral-800"
        >
          <Plus className="size-3.5" />
        </button>
      </div>
    </div>
  )
}
