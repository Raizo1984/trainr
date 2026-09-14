/**
 * Grafieken pas laden wanneer ze in beeld komen.
 *
 * Recharts is met ongeveer 112 kB gecomprimeerd de zwaarste afhankelijkheid van
 * de app, goed voor bijna veertig procent van de eerste lading. De grafieken
 * staan bovendien onder de vouw of op schermen die je niet meteen opent. Ze bij
 * het opstarten meesturen kost een sportschool met slecht bereik seconden voor
 * iets dat je op dat moment niet ziet.
 *
 * De plaatshouder heeft dezelfde hoogte als de grafiek, zodat de pagina niet
 * verspringt zodra het echte onderdeel binnen is.
 */

import { Suspense, lazy, useEffect, useRef, useState, type ComponentType } from 'react'
import type { ChartProps } from './chartParts'

const charts = () => import('./charts')

const Volume = lazy(() => charts().then((m) => ({ default: m.VolumeChart })))
const Pain = lazy(() => charts().then((m) => ({ default: m.PainChart })))
const Load = lazy(() => charts().then((m) => ({ default: m.LoadChart })))
const Weight = lazy(() => charts().then((m) => ({ default: m.WeightChart })))

/** Hoogte per grafiek, gelijk aan wat `charts.tsx` zelf gebruikt. */
const HEIGHT = { volume: 190, pain: 180, load: 200, weight: 190 } as const

function Placeholder({ height }: { height: number }) {
  return (
    <div
      aria-hidden
      className="w-full animate-pulse rounded-xl"
      style={{ height: height + 22, background: 'var(--surface-3)', opacity: 0.55 }}
    />
  )
}

/**
 * Laadt pas zodra het onderdeel bijna in beeld komt. Zonder deze stap zou de
 * grafiek onder de vouw alsnog bij het opstarten worden opgehaald.
 */
function WhenVisible({ height, children }: { height: number; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (!element || visible) return
    if (typeof IntersectionObserver === 'undefined') {
      // Oudere of uitgeklede omgevingen: dan maar meteen laden.
      setVisible(true)
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin: '200px' },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [visible])

  return <div ref={ref}>{visible ? children : <Placeholder height={height} />}</div>
}

function wrap<P extends object>(Component: ComponentType<P>, height: number) {
  return function LazyChart(props: P) {
    return (
      <WhenVisible height={height}>
        <Suspense fallback={<Placeholder height={height} />}>
          <Component {...props} />
        </Suspense>
      </WhenVisible>
    )
  }
}

export const VolumeChart = wrap<ChartProps['volume']>(Volume, HEIGHT.volume)
export const PainChart = wrap<ChartProps['pain']>(Pain, HEIGHT.pain)
export const LoadChart = wrap<ChartProps['load']>(Load, HEIGHT.load)
export const WeightChart = wrap<ChartProps['weight']>(Weight, HEIGHT.weight)

// Legenda en sparkline zijn eigen SVG zonder recharts en mogen direct mee.
export { Legend, Sparkline } from './chartParts'
