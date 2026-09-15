import { useCallback, useEffect, useMemo, useState } from 'react'

export type EntryKind = 'fix' | 'flexibel' | 'einnahme'
export type Interval = 'monatlich' | 'quartalsweise' | 'jaehrlich'

export interface FinanceEntry {
  id: string
  /** Wofür – z. B. "Strom", "Gehalt". */
  label: string
  /** Unternehmen oder Auftraggeber. */
  company: string
  /** Betrag im gewählten Intervall, in Euro. */
  amount: number
  kind: EntryKind
  interval: Interval
  /** Fälligkeitstag im Monat, optional. */
  dueDay?: number
  note?: string
  active: boolean
}

export const kindLabels: Record<EntryKind, string> = {
  fix: 'Fixkosten',
  flexibel: 'Flexible Kosten',
  einnahme: 'Einnahmen',
}

export const intervalLabels: Record<Interval, string> = {
  monatlich: 'monatlich',
  quartalsweise: 'quartalsweise',
  jaehrlich: 'jährlich',
}

const intervalFactor: Record<Interval, number> = {
  monatlich: 1,
  quartalsweise: 3,
  jaehrlich: 12,
}

/** Betrag auf einen Monat umgerechnet. */
export function monthlyAmount(entry: FinanceEntry): number {
  return entry.amount / intervalFactor[entry.interval]
}

const euro = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 2,
})

export const formatEuro = (value: number) => euro.format(value)

const STORAGE_KEY = 'mt.finance'

function seed(): FinanceEntry[] {
  return [
    {
      id: 'fin-1',
      label: 'Gehalt',
      company: 'Arbeitgeber',
      amount: 3200,
      kind: 'einnahme',
      interval: 'monatlich',
      active: true,
    },
    {
      id: 'fin-2',
      label: 'Miete',
      company: 'Hausverwaltung Meyer',
      amount: 890,
      kind: 'fix',
      interval: 'monatlich',
      dueDay: 1,
      active: true,
    },
    {
      id: 'fin-3',
      label: 'Strom',
      company: 'Stadtwerke',
      amount: 62,
      kind: 'fix',
      interval: 'monatlich',
      dueDay: 5,
      active: true,
    },
    {
      id: 'fin-4',
      label: 'Mobilfunk',
      company: 'Telekom',
      amount: 29.99,
      kind: 'fix',
      interval: 'monatlich',
      active: true,
    },
    {
      id: 'fin-5',
      label: 'Kfz-Versicherung',
      company: 'HUK',
      amount: 480,
      kind: 'fix',
      interval: 'jaehrlich',
      active: true,
    },
    {
      id: 'fin-6',
      label: 'Lebensmittel',
      company: 'diverse',
      amount: 420,
      kind: 'flexibel',
      interval: 'monatlich',
      active: true,
    },
    {
      id: 'fin-7',
      label: 'Streaming',
      company: 'Netflix',
      amount: 13.99,
      kind: 'flexibel',
      interval: 'monatlich',
      active: true,
    },
  ]
}

function load(): FinanceEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as FinanceEntry[]
  } catch {
    /* Storage kann blockiert sein */
  }
  return seed()
}

export interface FinanceTotals {
  income: number
  fixed: number
  flexible: number
  balance: number
}

export function useFinance() {
  const [entries, setEntries] = useState<FinanceEntry[]>(load)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
    } catch {
      /* ignorieren */
    }
  }, [entries])

  const save = useCallback((entry: FinanceEntry) => {
    setEntries((prev) => {
      const exists = prev.some((e) => e.id === entry.id)
      return exists ? prev.map((e) => (e.id === entry.id ? entry : e)) : [...prev, entry]
    })
  }, [])

  const remove = useCallback((id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id))
  }, [])

  const totals = useMemo<FinanceTotals>(() => {
    const active = entries.filter((e) => e.active)
    const sum = (kind: EntryKind) =>
      active.filter((e) => e.kind === kind).reduce((acc, e) => acc + monthlyAmount(e), 0)
    const income = sum('einnahme')
    const fixed = sum('fix')
    const flexible = sum('flexibel')
    return { income, fixed, flexible, balance: income - fixed - flexible }
  }, [entries])

  /** Monatliche Kosten je Unternehmen, absteigend. */
  const byCompany = useMemo(() => {
    const map = new Map<string, number>()
    for (const entry of entries) {
      if (!entry.active || entry.kind === 'einnahme') continue
      const name = entry.company.trim() || 'Ohne Angabe'
      map.set(name, (map.get(name) ?? 0) + monthlyAmount(entry))
    }
    return [...map.entries()]
      .map(([company, amount]) => ({ company, amount }))
      .sort((a, b) => b.amount - a.amount)
  }, [entries])

  return { entries, save, remove, totals, byCompany }
}

export function newFinanceId(): string {
  return `fin-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}
