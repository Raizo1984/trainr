import { describe, expect, it } from 'vitest'
import { controleerRapport, ongedekteGetallen, verzamelGetallen } from '../report'

describe('verzamelGetallen', () => {
  it('vindt getallen in objecten, lijsten en tekst', () => {
    const g = verzamelGetallen({ sessies: 3, oefeningen: [{ pijn: 4 }], notitie: 'op 50 kg' })
    expect(g.has(3)).toBe(true)
    expect(g.has(4)).toBe(true)
    expect(g.has(50)).toBe(true)
  })

  it('staat een verhouding als percentage toe', () => {
    expect(verzamelGetallen({ opkomst: 0.85 }).has(85)).toBe(true)
  })

  it('staat afronden toe', () => {
    expect(verzamelGetallen({ gemiddelde: 4.7 }).has(5)).toBe(true)
  })
})

describe('controleerRapport', () => {
  const data = { sessies: 3, gepland: 3, opkomst: 1, oefeningen: [{ naam: 'Squat', kg: 50, pijn: 2 }] }

  it('laat een rapport door dat bij de cijfers blijft', () => {
    const r = controleerRapport('Je deed 3 van de 3 sessies en squat staat op 50 kg.', data)
    expect(r.ok).toBe(true)
  })

  it('houdt een verzonnen getal tegen', () => {
    const r = controleerRapport('Je opkomst ging van 60 naar 85 procent.', data)
    expect(r.ok).toBe(false)
    expect(r.ongedekt).toContain(60)
  })

  it('laat tekst zonder getallen door', () => {
    expect(controleerRapport('Je traint stabiel en de techniek houdt stand.', data).ok).toBe(true)
  })

  it('negeert jaartallen', () => {
    expect(ongedekteGetallen('In 2026 begon je hiermee.', new Set([3]))).toEqual([])
  })

  it('meldt elk ongedekt getal maar één keer', () => {
    expect(ongedekteGetallen('99 en nog eens 99', new Set())).toEqual([99])
  })

  it('kijkt ook naar kommagetallen', () => {
    const r = controleerRapport('Je zit op 57,5 kg.', { kg: 50 })
    expect(r.ok).toBe(false)
    expect(r.ongedekt).toContain(57.5)
  })
})
