import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, Pencil, Trash2, X, Building2 } from 'lucide-react'
import { cn } from '@/lib/cn'
import {
  formatEuro,
  intervalLabels,
  kindLabels,
  monthlyAmount,
  newFinanceId,
  useFinance,
  type EntryKind,
  type FinanceEntry,
  type Interval,
} from '@/lib/finance'

type Filter = 'alle' | EntryKind

const filters: Array<{ value: Filter; label: string }> = [
  { value: 'alle', label: 'Alle' },
  { value: 'einnahme', label: 'Einnahmen' },
  { value: 'fix', label: 'Fixkosten' },
  { value: 'flexibel', label: 'Flexible Kosten' },
]

const inputClass =
  'rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-sm outline-none transition focus:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-800 dark:focus:border-neutral-500'

export default function Finance() {
  const { entries, save, remove, totals, byCompany } = useFinance()
  const [filter, setFilter] = useState<Filter>('alle')
  const [draft, setDraft] = useState<FinanceEntry | null>(null)
  const [existing, setExisting] = useState(false)

  const visible = useMemo(() => {
    const list = filter === 'alle' ? entries : entries.filter((e) => e.kind === filter)
    return [...list].sort(
      (a, b) => a.kind.localeCompare(b.kind) || monthlyAmount(b) - monthlyAmount(a),
    )
  }, [entries, filter])

  const maxCompany = byCompany[0]?.amount ?? 0

  const openNew = () => {
    setExisting(false)
    setDraft({
      id: newFinanceId(),
      label: '',
      company: '',
      amount: 0,
      kind: filter === 'alle' ? 'fix' : filter,
      interval: 'monatlich',
      active: true,
    })
  }

  const [params, setParams] = useSearchParams()
  // Schnellanlage aus dem „Neu“-Menü (?neu=eintrag)
  useEffect(() => {
    if (params.get('neu') !== 'eintrag') return
    openNew()
    setParams({}, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Finanzen</h2>
          <p className="text-sm text-neutral-500">
            Monatliche Einnahmen und Kosten – fix und flexibel, je Unternehmen.
          </p>
        </div>
        <button
          type="button"
          onClick={openNew}
          className="ml-auto flex items-center gap-1.5 rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          <Plus className="size-4" />
          Eintrag
        </button>
      </div>

      {/* Kennzahlen */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Einnahmen" value={totals.income} hint="pro Monat" />
        <Stat label="Fixkosten" value={totals.fixed} hint="pro Monat" />
        <Stat label="Flexible Kosten" value={totals.flexible} hint="pro Monat" />
        <Stat
          label="Bleibt übrig"
          value={totals.balance}
          hint="Einnahmen minus Kosten"
          emphasis={totals.balance >= 0 ? 'positive' : 'negative'}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        {/* Einträge */}
        <section className="overflow-hidden rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex flex-wrap items-center gap-2 border-b border-neutral-200 px-4 py-2.5 dark:border-neutral-800">
            <h3 className="mr-auto text-sm font-semibold">Einträge</h3>
            <div className="flex flex-wrap gap-1">
              {filters.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setFilter(f.value)}
                  className={cn(
                    'rounded-full px-2.5 py-1 text-xs transition',
                    filter === f.value
                      ? 'bg-neutral-900 font-medium text-white dark:bg-white dark:text-neutral-900'
                      : 'text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800',
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500 dark:border-neutral-800">
                  <th className="px-4 py-2 font-medium">Posten</th>
                  <th className="px-4 py-2 font-medium">Unternehmen</th>
                  <th className="px-4 py-2 font-medium">Art</th>
                  <th className="px-4 py-2 text-right font-medium">Betrag</th>
                  <th className="px-4 py-2 text-right font-medium">pro Monat</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {visible.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-neutral-500">
                      Noch keine Einträge.
                    </td>
                  </tr>
                )}

                {visible.map((entry) => (
                  <tr
                    key={entry.id}
                    className={cn(
                      'group transition hover:bg-neutral-50 dark:hover:bg-neutral-800/40',
                      !entry.active && 'opacity-50',
                    )}
                  >
                    <td className="px-4 py-2.5">
                      <div className="font-medium">{entry.label}</div>
                      {entry.dueDay ? (
                        <div className="text-xs text-neutral-500">
                          fällig am {entry.dueDay}.
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-2.5 text-neutral-600 dark:text-neutral-300">
                      {entry.company || '–'}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={cn(
                          'rounded px-1.5 py-0.5 text-[11px] font-medium',
                          entry.kind === 'einnahme'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200'
                            : entry.kind === 'fix'
                              ? 'bg-neutral-200 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-200'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200',
                        )}
                      >
                        {kindLabels[entry.kind]}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {formatEuro(entry.amount)}
                      <div className="text-xs text-neutral-500">
                        {intervalLabels[entry.interval]}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium tabular-nums">
                      {formatEuro(monthlyAmount(entry))}
                    </td>
                    <td className="px-2 py-2.5">
                      <div className="flex justify-end gap-0.5 opacity-0 transition group-hover:opacity-100">
                        <button
                          type="button"
                          onClick={() => {
                            setExisting(true)
                            setDraft(entry)
                          }}
                          className="rounded p-1.5 text-neutral-400 transition hover:bg-neutral-200 hover:text-neutral-900 dark:hover:bg-neutral-700 dark:hover:text-white"
                          aria-label="Bearbeiten"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => remove(entry.id)}
                          className="rounded p-1.5 text-neutral-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                          aria-label="Löschen"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Nach Unternehmen */}
        <section className="h-fit rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex items-center gap-2 border-b border-neutral-200 px-4 py-2.5 dark:border-neutral-800">
            <Building2 className="size-4 text-neutral-400" />
            <h3 className="text-sm font-semibold">Kosten je Unternehmen</h3>
          </div>

          {byCompany.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-neutral-500">Keine Kosten erfasst.</p>
          ) : (
            <ul className="space-y-3 p-4">
              {byCompany.map((row) => (
                <li key={row.company}>
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="truncate">{row.company}</span>
                    <span className="shrink-0 font-medium tabular-nums">
                      {formatEuro(row.amount)}
                    </span>
                  </div>
                  <div
                    className="mt-1 h-1.5 rounded-full bg-neutral-100 dark:bg-neutral-800"
                    title={`${row.company}: ${formatEuro(row.amount)} pro Monat`}
                  >
                    <div
                      className="h-full rounded-full bg-indigo-500"
                      style={{ width: `${maxCompany ? (row.amount / maxCompany) * 100 : 0}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {draft && (
        <EntryDialog
          draft={draft}
          existing={existing}
          onSave={(entry) => {
            save(entry)
            setDraft(null)
          }}
          onDelete={(id) => {
            remove(id)
            setDraft(null)
          }}
          onClose={() => setDraft(null)}
        />
      )}
    </div>
  )
}

function Stat({
  label,
  value,
  hint,
  emphasis,
}: {
  label: string
  value: number
  hint: string
  emphasis?: 'positive' | 'negative'
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="text-xs text-neutral-500">{label}</div>
      <div
        className={cn(
          'mt-1 text-2xl font-semibold tabular-nums',
          emphasis === 'negative' && 'text-red-600 dark:text-red-400',
          emphasis === 'positive' && 'text-emerald-600 dark:text-emerald-400',
        )}
      >
        {formatEuro(value)}
      </div>
      <div className="mt-0.5 text-[11px] text-neutral-400">{hint}</div>
    </div>
  )
}

function EntryDialog({
  draft,
  existing,
  onSave,
  onDelete,
  onClose,
}: {
  draft: FinanceEntry
  existing: boolean
  onSave: (entry: FinanceEntry) => void
  onDelete: (id: string) => void
  onClose: () => void
}) {
  const [form, setForm] = useState<FinanceEntry>(draft)

  const set = <K extends keyof FinanceEntry>(key: K, value: FinanceEntry[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        // Nur ein Druck auf den Hintergrund selbst schließt
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <form
        onMouseDown={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault()
          onSave({ ...form, label: form.label.trim() || 'Ohne Bezeichnung' })
        }}
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-neutral-200 bg-white shadow-2xl dark:border-neutral-800 dark:bg-neutral-900"
      >
        <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-3.5 dark:border-neutral-800">
          <h2 className="text-sm font-semibold">
            {existing ? 'Eintrag bearbeiten' : 'Neuer Eintrag'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-neutral-400 transition hover:bg-neutral-100 dark:hover:bg-neutral-800"
            aria-label="Schließen"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-3 px-5 py-4">
          <Field label="Posten">
            <input
              autoFocus
              value={form.label}
              onChange={(e) => set('label', e.target.value)}
              placeholder="z. B. Strom"
              className={cn(inputClass, 'w-full')}
            />
          </Field>

          <Field label="Unternehmen">
            <input
              value={form.company}
              onChange={(e) => set('company', e.target.value)}
              placeholder="z. B. Stadtwerke"
              className={cn(inputClass, 'w-full')}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Betrag (€)">
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.amount}
                onChange={(e) => set('amount', Number(e.target.value))}
                className={cn(inputClass, 'w-full tabular-nums')}
              />
            </Field>

            <Field label="Intervall">
              <select
                value={form.interval}
                onChange={(e) => set('interval', e.target.value as Interval)}
                className={cn(inputClass, 'w-full')}
              >
                {(Object.keys(intervalLabels) as Interval[]).map((key) => (
                  <option key={key} value={key}>
                    {intervalLabels[key]}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Art">
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(kindLabels) as EntryKind[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => set('kind', key)}
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-xs transition',
                    form.kind === key
                      ? 'border-neutral-900 font-medium dark:border-white'
                      : 'border-neutral-200 text-neutral-500 hover:border-neutral-300 dark:border-neutral-700 dark:hover:border-neutral-600',
                  )}
                >
                  {kindLabels[key]}
                </button>
              ))}
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Fällig am (Tag)">
              <input
                type="number"
                min="1"
                max="31"
                value={form.dueDay ?? ''}
                onChange={(e) =>
                  set('dueDay', e.target.value ? Number(e.target.value) : undefined)
                }
                placeholder="optional"
                className={cn(inputClass, 'w-full tabular-nums')}
              />
            </Field>

            <Field label="Status">
              <label className="flex h-[34px] items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => set('active', e.target.checked)}
                  className="size-4 rounded border-neutral-300 dark:border-neutral-600"
                />
                Aktiv
              </label>
            </Field>
          </div>

          <Field label="Notiz">
            <textarea
              value={form.note ?? ''}
              onChange={(e) => set('note', e.target.value)}
              rows={2}
              className={cn(inputClass, 'w-full resize-y')}
            />
          </Field>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-neutral-200 px-5 py-3.5 dark:border-neutral-800">
          {existing ? (
            <button
              type="button"
              onClick={() => onDelete(form.id)}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
            >
              <Trash2 className="size-4" />
              Löschen
            </button>
          ) : (
            <span />
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-neutral-200 px-3 py-1.5 text-sm transition hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              className="rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
            >
              Speichern
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-neutral-500">{label}</span>
      {children}
    </label>
  )
}
