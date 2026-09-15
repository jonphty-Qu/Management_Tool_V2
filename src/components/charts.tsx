import { useState } from 'react'
import { cn } from '@/lib/cn'

/**
 * Schlanke Diagramm-Bausteine nach den Dataviz-Regeln: dünne Balken (≤ 24 px),
 * 4 px gerundetes Datenende, 2 px Flächenlücke zwischen Segmenten, Haarlinien-Raster,
 * Tooltips pro Balken, Werte in Textfarben – nie in der Serienfarbe.
 * Farben kommen als CSS-Variablen (--series-*, --chart-*), hell/dunkel in index.css.
 */

// ---------- Karte mit Legende und Tabellenansicht ----------

interface LegendItem {
  label: string
  color: string
}

interface ChartCardProps {
  title: string
  subtitle?: string
  /** Nur bei zwei oder mehr Serien – eine Serie braucht keine Legende. */
  legend?: LegendItem[]
  /** Tabellen-Zwilling des Diagramms (Barrierefreiheit, exakte Werte). */
  table: { columns: string[]; rows: string[][] }
  empty?: string
  children: React.ReactNode
}

export function ChartCard({ title, subtitle, legend, table, empty, children }: ChartCardProps) {
  const [showTable, setShowTable] = useState(false)

  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-neutral-500">{subtitle}</p>}
        </div>
        {!empty && (
          <button
            type="button"
            onClick={() => setShowTable((v) => !v)}
            className="shrink-0 rounded-md border border-neutral-200 px-2 py-1 text-xs text-neutral-500 transition hover:bg-neutral-50 hover:text-neutral-900 dark:border-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-white"
          >
            {showTable ? 'Diagramm' : 'Tabelle'}
          </button>
        )}
      </div>

      {empty ? (
        <p className="py-10 text-center text-sm text-neutral-500">{empty}</p>
      ) : showTable ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500 dark:border-neutral-800">
                {table.columns.map((c, i) => (
                  <th key={c} className={cn('py-1.5 pr-3 font-medium', i > 0 && 'text-right')}>
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {table.rows.map((row) => (
                <tr key={row.join('|')}>
                  {row.map((cell, i) => (
                    <td key={i} className={cn('py-1.5 pr-3', i > 0 && 'text-right tabular-nums')}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <>
          {legend && legend.length > 1 && (
            <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-600 dark:text-neutral-300">
              {legend.map((l) => (
                <li key={l.label} className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-[2px]" style={{ background: l.color }} />
                  {l.label}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4">{children}</div>
        </>
      )}
    </section>
  )
}

// ---------- Tooltip ----------

function Tooltip({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <div
      role="tooltip"
      className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 -translate-x-1/2 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 whitespace-nowrap shadow-md dark:border-neutral-700 dark:bg-neutral-900"
    >
      {/* Wert zuerst, Serie als Linien-Schlüssel dahinter */}
      <div className="text-sm font-semibold tabular-nums">{value}</div>
      <div className="mt-0.5 flex items-center gap-1.5 text-xs text-neutral-500">
        <span className="h-0.5 w-3 rounded-full" style={{ background: color }} />
        {label}
      </div>
    </div>
  )
}

// ---------- Horizontale Balken (einfach oder gestapelt) ----------

export interface BarSegment {
  key: string
  label: string
  value: number
  color: string
}

export interface BarRow {
  key: string
  label: string
  /** Kleiner Identitätspunkt neben der Beschriftung (z. B. Statusfarbe). */
  marker?: string
  segments: BarSegment[]
}

export function HBarChart({ rows, format }: { rows: BarRow[]; format: (v: number) => string }) {
  const [hover, setHover] = useState<string | null>(null)
  const totals = rows.map((r) => r.segments.reduce((s, x) => s + x.value, 0))
  const max = Math.max(1, ...totals)

  return (
    <div className="space-y-1" role="list">
      {rows.map((row, ri) => {
        const total = totals[ri]
        const visible = row.segments.filter((s) => s.value > 0)
        return (
          <div key={row.key} role="listitem" className="grid grid-cols-[minmax(0,9rem)_1fr] items-center gap-3">
            <div className="flex min-w-0 items-center gap-1.5 text-sm text-neutral-600 dark:text-neutral-300">
              {row.marker && <span className={cn('size-2 shrink-0 rounded-full', row.marker)} />}
              <span className="truncate" title={row.label}>
                {row.label}
              </span>
            </div>

            {/* Rechts Platz für den Wert am Balkenende */}
            <div className="flex h-7 min-w-0 items-center pr-24">
              <div className="flex h-full shrink-0 items-center gap-[2px]" style={{ width: `${(total / max) * 100}%` }}>
                {visible.map((seg, i) => {
                  const id = `${row.key}:${seg.key}`
                  const last = i === visible.length - 1
                  return (
                    <div
                      key={seg.key}
                      tabIndex={0}
                      aria-label={`${row.label} – ${seg.label}: ${format(seg.value)}`}
                      onPointerEnter={() => setHover(id)}
                      onPointerLeave={() => setHover(null)}
                      onFocus={() => setHover(id)}
                      onBlur={() => setHover(null)}
                      className="relative flex h-full min-w-[3px] items-center outline-none"
                      style={{ flexGrow: seg.value, flexBasis: 0 }}
                    >
                      <div
                        className={cn('h-5 w-full transition', last && 'rounded-r-[4px]', hover === id && 'brightness-110')}
                        style={{ background: seg.color }}
                      />
                      {hover === id && (
                        <Tooltip
                          value={format(seg.value)}
                          label={visible.length > 1 ? seg.label : row.label}
                          color={seg.color}
                        />
                      )}
                    </div>
                  )
                })}
              </div>
              <span className="ml-2 shrink-0 text-xs font-medium whitespace-nowrap text-neutral-700 tabular-nums dark:text-neutral-200">
                {format(total)}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ---------- Säulen (z. B. pro Woche) ----------

export interface ColumnDatum {
  key: string
  label: string
  /** Zusatz im Tooltip, z. B. der Datumsbereich. */
  detail?: string
  value: number
}

/** Runde Achsenschritte: 1, 2, 5 × 10^n. */
function niceStep(raw: number): number {
  if (raw <= 1) return 1
  const exp = 10 ** Math.floor(Math.log10(raw))
  const f = raw / exp
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * exp
}

export function ColumnChart({
  data,
  color,
  seriesLabel,
  height = 176,
}: {
  data: ColumnDatum[]
  color: string
  seriesLabel: string
  height?: number
}) {
  const [hover, setHover] = useState<string | null>(null)
  const maxValue = Math.max(0, ...data.map((d) => d.value))
  const step = niceStep(maxValue / 4)
  const top = Math.max(step, Math.ceil(maxValue / step) * step)
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step)
  const peak = data.reduce((best, d) => (d.value > (best?.value ?? -1) ? d : best), data[0])

  return (
    <div>
      <div className="grid grid-cols-[2rem_1fr]">
        {/* Y-Achse */}
        <div className="relative" style={{ height }}>
          {ticks.map((t) => (
            <span
              key={t}
              className="absolute right-2 translate-y-1/2 text-[10px] tabular-nums"
              style={{ bottom: `${(t / top) * 100}%`, color: 'var(--chart-muted)' }}
            >
              {t}
            </span>
          ))}
        </div>

        {/* Zeichenfläche */}
        <div className="relative" style={{ height }}>
          {ticks.map((t) => (
            <div
              key={t}
              className="absolute inset-x-0 border-t"
              style={{ bottom: `${(t / top) * 100}%`, borderColor: t === 0 ? 'var(--chart-axis)' : 'var(--chart-grid)' }}
            />
          ))}
          <div className="absolute inset-0 flex items-end gap-1">
            {data.map((d) => {
              const pct = (d.value / top) * 100
              return (
                <div
                  key={d.key}
                  tabIndex={0}
                  aria-label={`${d.label}${d.detail ? ` (${d.detail})` : ''}: ${d.value}`}
                  onPointerEnter={() => setHover(d.key)}
                  onPointerLeave={() => setHover(null)}
                  onFocus={() => setHover(d.key)}
                  onBlur={() => setHover(null)}
                  className="relative flex h-full flex-1 items-end justify-center outline-none"
                >
                  <div
                    className={cn('w-full max-w-6 rounded-t-[4px] transition', hover === d.key && 'brightness-110')}
                    style={{ height: `${pct}%`, minHeight: d.value > 0 ? 2 : 0, background: color }}
                  />
                  {/* Nur der Spitzenwert bekommt ein direktes Label */}
                  {peak && d.key === peak.key && d.value > 0 && hover !== d.key && (
                    <span
                      className="absolute text-[10px] font-medium text-neutral-700 tabular-nums dark:text-neutral-200"
                      style={{ bottom: `calc(${pct}% + 3px)` }}
                    >
                      {d.value}
                    </span>
                  )}
                  {hover === d.key && (
                    <div className="absolute inset-x-0" style={{ bottom: `${pct}%` }}>
                      <Tooltip
                        value={String(d.value)}
                        label={`${seriesLabel} · ${d.label}${d.detail ? ` · ${d.detail}` : ''}`}
                        color={color}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* X-Achse – gehört zur Kartenhöhe, kein eigener Scrollbereich */}
      <div className="mt-1.5 grid grid-cols-[2rem_1fr]">
        <span />
        <div className="flex gap-1">
          {data.map((d, i) => (
            <span
              key={d.key}
              className={cn('flex-1 truncate text-center text-[10px]', i % 2 === 1 && 'max-sm:invisible')}
              style={{ color: 'var(--chart-muted)' }}
            >
              {d.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
