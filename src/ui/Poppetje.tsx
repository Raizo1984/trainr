/**
 * Het poppetje dat de standen van een oefening tekent.
 *
 * Alles komt uit de coördinaten in tekeningen.ts, zodat een houding aanpassen
 * geen tekenwerk is maar het verzetten van een paar getallen. Twee standen
 * komen naast elkaar met een pijl ertussen: van links naar rechts is de
 * richting van de beweging.
 */

import { Fragment } from 'react'
import type { MovementPattern } from '@/domain/types'
import { type Houding, tekeningVoor } from '@/domain/tekeningen'

function Figuur({ houding, vaag = false }: { houding: Houding; vaag?: boolean }) {
  const { hoofd, nek, heup, knie, voet, elleboog, hand } = houding
  const lijn = (a: [number, number], b: [number, number], key: string) => (
    <line key={key} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} />
  )

  return (
    <g
      stroke="currentColor"
      strokeWidth={4}
      strokeLinecap="round"
      fill="none"
      opacity={vaag ? 0.35 : 1}
    >
      {lijn(nek, heup, 'romp')}
      {lijn(heup, knie, 'bovenbeen')}
      {lijn(knie, voet, 'onderbeen')}
      {lijn(nek, elleboog, 'bovenarm')}
      {lijn(elleboog, hand, 'onderarm')}
      <circle cx={hoofd[0]} cy={hoofd[1]} r={6} strokeWidth={3.5} />
    </g>
  )
}

function Vak({ label, houding }: { label: string; houding: Houding }) {
  return (
    <figure className="min-w-0 flex-1 basis-0">
      <svg
        viewBox="0 0 100 100"
        role="img"
        aria-label={label}
        className="block h-auto w-full text-ink-2"
        style={{ maxHeight: 132 }}
      >
        {/* De grond, zodat je ziet dat het poppetje ergens op staat. */}
        <line
          x1={8}
          y1={93}
          x2={92}
          y2={93}
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          opacity={0.3}
        />
        <Figuur houding={houding} />
      </svg>
      <figcaption className="mt-0.5 text-center text-[11px] text-ink-3">{label}</figcaption>
    </figure>
  )
}

function Pijl() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="mt-[52px] size-4 shrink-0 text-ink-3"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M2 8 H12 M8.5 4.5 L12 8 L8.5 11.5"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function Poppetje({ pattern }: { pattern: MovementPattern }) {
  const tekening = tekeningVoor(pattern)
  if (!tekening) return null

  return (
    <div
      className="mt-3 rounded-xl border px-3 py-2.5"
      style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-2)' }}
    >
      {/*
        De twee vakken moeten even breed zijn, anders schaalt het ene poppetje
        groter dan het andere en liggen de grondlijnen niet op één hoogte. De
        pijl staat daarom naast de vakken, niet erin.
      */}
      <div className="flex items-start justify-center gap-2">
        {tekening.standen.map((stand, i) => (
          <Fragment key={stand.label}>
            {i > 0 && <Pijl />}
            <Vak label={stand.label} houding={stand.houding} />
          </Fragment>
        ))}
      </div>
      <p className="mt-1.5 text-center text-[11.5px] leading-snug text-ink-3">{tekening.let_op}</p>
    </div>
  )
}
