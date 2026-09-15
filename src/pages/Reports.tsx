import { useMemo } from 'react'
import { ChartCard, ColumnChart, HBarChart, type BarRow } from '@/components/charts'
import { formatEuro, useFinance } from '@/lib/finance'
import { statusMeta, statusOrder, useApplications } from '@/lib/applications'
import { addDays, isoWeek, startOfWeek } from '@/lib/date'
import { cn } from '@/lib/cn'

const SERIES = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)']
const WEEKS = 12

const pct = new Intl.NumberFormat('de-DE', { style: 'percent', maximumFractionDigits: 0 })
const dayMonth = new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'numeric' })
const count = (v: number) => String(Math.round(v))

export default function Reports() {
  const { totals, byCompany } = useFinance()
  const { applications, counts } = useApplications()

  // ---------- Finanzen ----------

  const expenses = totals.fixed + totals.flexible
  const hasFinance = totals.income > 0 || expenses > 0

  const balanceRows: BarRow[] = [
    {
      key: 'einnahmen',
      label: 'Einnahmen',
      segments: [{ key: 'einnahmen', label: 'Einnahmen', value: totals.income, color: SERIES[0] }],
    },
    {
      key: 'ausgaben',
      label: 'Ausgaben',
      segments: [
        { key: 'fix', label: 'Fixkosten', value: totals.fixed, color: SERIES[1] },
        { key: 'flex', label: 'Flexible Kosten', value: totals.flexible, color: SERIES[2] },
      ],
    },
  ]

  // Über 8 Unternehmen: der Rest wird zu „Weitere“ zusammengefasst
  const companyRows: BarRow[] = useMemo(() => {
    const top = byCompany.slice(0, 8)
    const rest = byCompany.slice(8)
    const rows = top.map((c) => ({
      key: c.company,
      label: c.company,
      segments: [{ key: 'kosten', label: 'Kosten', value: c.amount, color: SERIES[0] }],
    }))
    if (rest.length) {
      rows.push({
        key: '__weitere',
        label: `Weitere (${rest.length})`,
        segments: [{ key: 'kosten', label: 'Kosten', value: rest.reduce((s, c) => s + c.amount, 0), color: SERIES[0] }],
      })
    }
    return rows
  }, [byCompany])

  // ---------- Bewerbungen ----------

  const sent = applications.filter((a) => a.status !== 'entwurf').length
  const responded = (counts.gespraech ?? 0) + (counts.zusage ?? 0) + (counts.absage ?? 0)
  const interviews = (counts.gespraech ?? 0) + (counts.zusage ?? 0)

  const weekly = useMemo(() => {
    const first = addDays(startOfWeek(new Date()), -(WEEKS - 1) * 7)
    return Array.from({ length: WEEKS }, (_, i) => {
      const from = addDays(first, i * 7)
      const to = addDays(from, 7)
      const value = applications.filter((a) => {
        if (!a.appliedAt) return false
        const d = new Date(a.appliedAt)
        return d >= from && d < to
      }).length
      return {
        key: from.toISOString(),
        label: `KW ${isoWeek(from)}`,
        detail: `${dayMonth.format(from)}–${dayMonth.format(addDays(to, -1))}`,
        value,
      }
    })
  }, [applications])

  const statusRows: BarRow[] = statusOrder.map((s) => ({
    key: s,
    label: statusMeta[s].label,
    marker: statusMeta[s].dot,
    segments: [{ key: 'anzahl', label: 'Bewerbungen', value: counts[s] ?? 0, color: SERIES[0] }],
  }))

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Berichte</h2>
        <p className="text-sm text-neutral-500">Finanzen und Bewerbungen auf einen Blick.</p>
      </div>

      {/* Kennzahlen */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Stat
          label="Bleibt übrig pro Monat"
          value={formatEuro(totals.balance)}
          tone={totals.balance < 0 ? 'negative' : undefined}
        />
        <Stat
          label="Sparquote"
          value={totals.income > 0 ? pct.format(totals.balance / totals.income) : '–'}
          hint="Anteil der Einnahmen, der übrig bleibt"
        />
        <Stat label="Bewerbungen" value={String(applications.length)} hint={`${sent} abgeschickt`} />
        <Stat
          label="Antwortquote"
          value={sent > 0 ? pct.format(responded / sent) : '–'}
          hint="Gespräch, Zusage oder Absage"
        />
        <Stat
          label="Gesprächsquote"
          value={sent > 0 ? pct.format(interviews / sent) : '–'}
          hint="Gespräch oder Zusage"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <ChartCard
          title="Einnahmen und Ausgaben pro Monat"
          subtitle={
            totals.balance >= 0
              ? `Es bleiben ${formatEuro(totals.balance)} übrig.`
              : `Fehlbetrag von ${formatEuro(-totals.balance)}.`
          }
          legend={[
            { label: 'Einnahmen', color: SERIES[0] },
            { label: 'Fixkosten', color: SERIES[1] },
            { label: 'Flexible Kosten', color: SERIES[2] },
          ]}
          empty={hasFinance ? undefined : 'Noch keine Finanzeinträge.'}
          table={{
            columns: ['Posten', 'pro Monat'],
            rows: [
              ['Einnahmen', formatEuro(totals.income)],
              ['Fixkosten', formatEuro(totals.fixed)],
              ['Flexible Kosten', formatEuro(totals.flexible)],
              ['Bleibt übrig', formatEuro(totals.balance)],
            ],
          }}
        >
          <HBarChart rows={balanceRows} format={formatEuro} />
        </ChartCard>

        <ChartCard
          title="Kosten je Unternehmen"
          subtitle="Monatlich umgerechnet, fixe und flexible Kosten zusammen"
          empty={companyRows.length ? undefined : 'Noch keine Kosten erfasst.'}
          table={{
            columns: ['Unternehmen', 'pro Monat'],
            rows: byCompany.map((c) => [c.company, formatEuro(c.amount)]),
          }}
        >
          <HBarChart rows={companyRows} format={formatEuro} />
        </ChartCard>

        <ChartCard
          title="Bewerbungen pro Woche"
          subtitle={`Nach Bewerbungsdatum, letzte ${WEEKS} Wochen`}
          empty={applications.some((a) => a.appliedAt) ? undefined : 'Noch keine abgeschickten Bewerbungen.'}
          table={{
            columns: ['Woche', 'Zeitraum', 'Bewerbungen'],
            rows: weekly.map((w) => [w.label, w.detail, String(w.value)]),
          }}
        >
          <ColumnChart data={weekly} color={SERIES[0]} seriesLabel="Bewerbungen" />
        </ChartCard>

        <ChartCard
          title="Bewerbungen nach Status"
          subtitle={`${applications.length} insgesamt`}
          empty={applications.length ? undefined : 'Noch keine Bewerbungen.'}
          table={{
            columns: ['Status', 'Anzahl'],
            rows: statusOrder.map((s) => [statusMeta[s].label, String(counts[s] ?? 0)]),
          }}
        >
          <HBarChart rows={statusRows} format={count} />
        </ChartCard>
      </div>
    </div>
  )
}

function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string
  value: string
  hint?: string
  tone?: 'negative'
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="text-xs text-neutral-500">{label}</div>
      {/* Große Einzelwerte mit proportionalen Ziffern */}
      <div className={cn('mt-1 text-2xl font-semibold', tone === 'negative' && 'text-red-600 dark:text-red-400')}>
        {value}
      </div>
      {hint && <div className="mt-0.5 text-[11px] text-neutral-400">{hint}</div>}
    </div>
  )
}
