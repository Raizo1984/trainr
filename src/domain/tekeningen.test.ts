import { describe, expect, it } from 'vitest'
import { type Houding, tekeningVoor } from './tekeningen'
import { LADDERS } from './exercises'
import type { MovementPattern } from './types'

/** Patronen waar met opzet geen poppetje bij hoort: te veel verschillends. */
const GEEN_TEKENING: MovementPattern[] = ['isolatie', 'skill', 'conditie']

const ALLE: MovementPattern[] = [
  'squat',
  'hinge',
  'horizontale-push',
  'verticale-push',
  'horizontale-pull',
  'verticale-pull',
  'carry-core',
  ...GEEN_TEKENING,
]

const gewrichten = (h: Houding) => Object.values(h) as Array<[number, number]>

describe('oefeningtekeningen', () => {
  it('heeft een tekening voor elk patroon waar er een bij hoort', () => {
    for (const patroon of ALLE) {
      const heeft = tekeningVoor(patroon) !== null
      expect(heeft, `${patroon}`).toBe(!GEEN_TEKENING.includes(patroon))
    }
  })

  it('tekent elk patroon dat in een ladder zit, of laat het bewust weg', () => {
    for (const ladder of LADDERS) {
      expect(ALLE, `${ladder.pattern} is onbekend in de tekeningen`).toContain(ladder.pattern)
    }
  })

  it('houdt elk gewricht binnen het tekenvlak', () => {
    for (const patroon of ALLE) {
      const tekening = tekeningVoor(patroon)
      if (!tekening) continue
      for (const stand of tekening.standen) {
        for (const [x, y] of gewrichten(stand.houding)) {
          expect(x, `${patroon} · ${stand.label}`).toBeGreaterThanOrEqual(8)
          expect(x, `${patroon} · ${stand.label}`).toBeLessThanOrEqual(92)
          expect(y, `${patroon} · ${stand.label}`).toBeGreaterThanOrEqual(8)
          expect(y, `${patroon} · ${stand.label}`).toBeLessThanOrEqual(93)
        }
      }
    }
  })

  it('laat één of twee standen zien, met uitleg erbij', () => {
    for (const patroon of ALLE) {
      const tekening = tekeningVoor(patroon)
      if (!tekening) continue
      expect(tekening.standen.length, patroon).toBeGreaterThanOrEqual(1)
      expect(tekening.standen.length, patroon).toBeLessThanOrEqual(2)
      expect(tekening.let_op.length, patroon).toBeGreaterThan(10)
      for (const stand of tekening.standen) expect(stand.label.length, patroon).toBeGreaterThan(0)
    }
  })

  it('zet de twee standen niet op dezelfde plek', () => {
    for (const patroon of ALLE) {
      const tekening = tekeningVoor(patroon)
      if (!tekening || tekening.standen.length < 2) continue
      const [a, b] = tekening.standen.map((s) => gewrichten(s.houding))
      const verschil = a.reduce((som, [x, y], i) => som + Math.abs(x - b[i][0]) + Math.abs(y - b[i][1]), 0)
      expect(verschil, `${patroon} beweegt te weinig om iets te laten zien`).toBeGreaterThan(20)
    }
  })
})
