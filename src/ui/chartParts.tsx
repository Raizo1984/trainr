/**
 * Onderdelen van een grafiek die geen recharts nodig hebben.
 *
 * Bewust een eigen bestand. Zolang de legenda en de sparkline uit `charts.tsx`
 * kwamen, was dat bestand een statische afhankelijkheid van elk scherm dat ze
 * gebruikt, en kwam recharts alsnog bij het opstarten mee. Dat is precies wat
 * het lui laden moest voorkomen.
 */

/** Propstypen van de grafieken, zodat `LazyChart.tsx` ze kan hergebruiken. */
export interface ChartProps {
  volume: { data: Array<{ week: string; sets: number; isDeload?: boolean }> }
  pain: { data: Array<{ date: string; pain: number }> }
  load: { data: Array<Record<string, string | number | null>>; series: string[]; unit?: string }
  weight: { data: Array<{ date: string; gewicht: number | null; trend: number | null }> }
}


export function Legend({ items }: { items: Array<{ label: string; color: string; dashed?: boolean }> }) {
  return (
    <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {items.map((item) => (
        <span key={item.label} className="flex items-center gap-1.5 text-[12px] text-ink-2">
          <span
            aria-hidden
            className="inline-block h-[3px] w-4 rounded-full"
            style={
              item.dashed
                ? { backgroundImage: `repeating-linear-gradient(90deg, ${item.color} 0 5px, transparent 5px 9px)` }
                : { background: item.color }
            }
          />
          {item.label}
        </span>
      ))}
    </div>
  )
}


/* ------------------------------------------------------------------ */
/* Sparkline voor stat-tegels                                          */
/* ------------------------------------------------------------------ */

export function Sparkline({ values, color = 'var(--series-1)' }: { values: number[]; color?: string }) {
  if (values.length < 2) return null
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const points = values
    .map((v, i) => `${(i / (values.length - 1)) * 100},${28 - ((v - min) / span) * 24}`)
    .join(' ')
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="h-8 w-full" aria-hidden>
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}
