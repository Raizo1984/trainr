/**
 * Grafieken. Eén meetwaarde per as, nooit twee schalen naast elkaar.
 * Kleuren komen uit een gevalideerd categorisch palet; statuskleuren
 * (groen, amber, rood) blijven gereserveerd voor toestand en worden hier
 * nooit als seriekleur gebruikt.
 */

import type { ReactNode } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Legend } from './chartParts'

const AXIS_PROPS = {
  stroke: 'var(--axis)',
  tick: { fill: 'var(--text-muted)', fontSize: 11 },
  tickLine: false,
  axisLine: false,
} as const

function ChartTooltip({
  active,
  payload,
  label,
  unit,
  formatLabel,
}: {
  active?: boolean
  payload?: Array<{ name?: string; value?: number | string; color?: string; dataKey?: string | number }>
  label?: string | number
  unit?: string
  formatLabel?: (value: string | number) => string
}) {
  if (!active || !payload?.length) return null
  return (
    <div
      className="rounded-xl px-3 py-2 text-[12px] shadow-lg"
      style={{ background: 'var(--surface-1)', border: '1px solid var(--border-strong)', color: 'var(--text-primary)' }}
    >
      {label !== undefined && (
        <div className="mb-1 font-semibold">{formatLabel ? formatLabel(label) : label}</div>
      )}
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2">
          {entry.color && (
            <span className="size-2 shrink-0 rounded-full" style={{ background: entry.color }} aria-hidden />
          )}
          <span className="text-ink-2">{entry.name}</span>
          <span className="num ml-auto font-semibold">
            {entry.value}
            {unit ? ` ${unit}` : ''}
          </span>
        </div>
      ))}
    </div>
  )
}

export function ChartFrame({ height = 200, children }: { height?: number; children: ReactNode }) {
  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>{children as never}</ResponsiveContainer>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Weekvolume                                                          */
/* ------------------------------------------------------------------ */

export function VolumeChart({
  data,
}: {
  data: Array<{ week: string; sets: number; isDeload?: boolean }>
}) {
  const max = Math.max(...data.map((d) => d.sets), 1)
  return (
    <>
      <Legend
        items={[
          { label: 'Werksets per week', color: 'var(--series-1)' },
          { label: 'Deloadweek', color: 'var(--status-neutral)' },
        ]}
      />
      <ChartFrame height={190}>
        <BarChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: -18 }} barCategoryGap="22%">
          <CartesianGrid vertical={false} stroke="var(--grid)" />
          <XAxis dataKey="week" {...AXIS_PROPS} tickFormatter={(v: string) => v.slice(5)} />
          <YAxis {...AXIS_PROPS} domain={[0, Math.ceil(max * 1.15)]} width={44} />
          <Tooltip
            cursor={{ fill: 'color-mix(in oklab, var(--text-muted) 10%, transparent)' }}
            content={<ChartTooltip unit="sets" formatLabel={(v) => `Week van ${v}`} />}
          />
          <Bar dataKey="sets" name="Werksets" radius={[4, 4, 0, 0]} isAnimationActive>
            {data.map((entry) => (
              <Cell
                key={entry.week}
                fill={entry.isDeload ? 'var(--status-neutral)' : 'var(--series-1)'}
                stroke="var(--surface-1)"
                strokeWidth={2}
              />
            ))}
          </Bar>
        </BarChart>
      </ChartFrame>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Pijnverloop                                                         */
/* ------------------------------------------------------------------ */

export function PainChart({ data }: { data: Array<{ date: string; pain: number }> }) {
  return (
    <>
      <Legend items={[{ label: 'Hoogste pijn per sessie (0-10)', color: 'var(--series-1)' }]} />
      <ChartFrame height={180}>
        <AreaChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -20 }}>
          <defs>
            <linearGradient id="painFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--series-1)" stopOpacity={0.28} />
              <stop offset="100%" stopColor="var(--series-1)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          {/* Zone waarin doortrainen verantwoord is (0-2), conform de pijnregel. */}
          <ReferenceArea y1={0} y2={2} fill="var(--status-good)" fillOpacity={0.07} />
          <ReferenceLine
            y={5}
            stroke="var(--status-serious)"
            strokeDasharray="4 4"
            strokeWidth={1.5}
            label={{ value: 'pauzeergrens', position: 'insideTopRight', fill: 'var(--status-serious)', fontSize: 11 }}
          />
          <CartesianGrid vertical={false} stroke="var(--grid)" />
          <XAxis dataKey="date" {...AXIS_PROPS} tickFormatter={(v: string) => v.slice(5)} minTickGap={24} />
          <YAxis {...AXIS_PROPS} domain={[0, 10]} ticks={[0, 2, 5, 10]} width={44} />
          <Tooltip content={<ChartTooltip unit="/10" />} cursor={{ stroke: 'var(--border-strong)', strokeWidth: 1 }} />
          <Area
            type="monotone"
            dataKey="pain"
            name="Pijn"
            stroke="var(--series-1)"
            strokeWidth={2}
            fill="url(#painFill)"
            dot={{ r: 2.5, strokeWidth: 0, fill: 'var(--series-1)' }}
            activeDot={{ r: 5, stroke: 'var(--surface-1)', strokeWidth: 2 }}
          />
        </AreaChart>
      </ChartFrame>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Belastingverloop per oefening (maximaal drie series)                */
/* ------------------------------------------------------------------ */

const SERIES = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)']

export function LoadChart({
  data,
  series,
  unit = 'kg',
}: {
  data: Array<Record<string, string | number | null>>
  series: string[]
  unit?: string
}) {
  const limited = series.slice(0, 3)
  return (
    <>
      <Legend items={limited.map((name, i) => ({ label: name, color: SERIES[i] }))} />
      <ChartFrame height={200}>
        <LineChart data={data} margin={{ top: 6, right: 12, bottom: 0, left: -18 }}>
          <CartesianGrid vertical={false} stroke="var(--grid)" />
          <XAxis dataKey="date" {...AXIS_PROPS} tickFormatter={(v: string) => String(v).slice(5)} minTickGap={26} />
          <YAxis {...AXIS_PROPS} width={44} />
          <Tooltip content={<ChartTooltip unit={unit} />} cursor={{ stroke: 'var(--border-strong)', strokeWidth: 1 }} />
          {limited.map((name, i) => (
            <Line
              key={name}
              type="monotone"
              dataKey={name}
              name={name}
              stroke={SERIES[i]}
              strokeWidth={2}
              connectNulls
              dot={{ r: 2.5, strokeWidth: 0, fill: SERIES[i] }}
              activeDot={{ r: 5, stroke: 'var(--surface-1)', strokeWidth: 2 }}
            />
          ))}
        </LineChart>
      </ChartFrame>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Gewichtstrend                                                       */
/* ------------------------------------------------------------------ */

export function WeightChart({
  data,
}: {
  data: Array<{ date: string; gewicht: number | null; trend: number | null }>
}) {
  const values = data.flatMap((d) => [d.gewicht, d.trend]).filter((v): v is number => v !== null)
  // Het domein volgt de metingen zelf. Vanaf nul beginnen maakt elke echte
  // verandering onzichtbaar, en juist die verandering is hier het onderwerp.
  const min = values.length > 0 ? Math.floor(Math.min(...values) - 1) : 0
  const max = values.length > 0 ? Math.ceil(Math.max(...values) + 1) : 1
  return (
    <>
      <Legend
        items={[
          { label: 'Dagmeting', color: 'var(--series-2)' },
          { label: 'Trend over 7 dagen', color: 'var(--series-1)' },
        ]}
      />
      <ChartFrame height={190}>
        <LineChart data={data} margin={{ top: 6, right: 10, bottom: 0, left: -14 }}>
          <CartesianGrid vertical={false} stroke="var(--grid)" />
          <XAxis dataKey="date" {...AXIS_PROPS} tickFormatter={(v: string) => String(v).slice(5)} minTickGap={30} />
          <YAxis {...AXIS_PROPS} domain={[min, max]} width={46} />
          <Tooltip content={<ChartTooltip unit="kg" />} cursor={{ stroke: 'var(--border-strong)', strokeWidth: 1 }} />
          <Line
            type="monotone"
            dataKey="gewicht"
            name="Dagmeting"
            stroke="var(--series-2)"
            strokeWidth={0}
            dot={{ r: 2, strokeWidth: 0, fill: 'var(--series-2)' }}
            activeDot={{ r: 5, stroke: 'var(--surface-1)', strokeWidth: 2 }}
          />
          <Line
            type="monotone"
            dataKey="trend"
            name="Trend"
            stroke="var(--series-1)"
            strokeWidth={2.5}
            dot={false}
            connectNulls
          />
        </LineChart>
      </ChartFrame>
    </>
  )
}
