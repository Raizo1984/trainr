import { describe, expect, it } from 'vitest'
import { MOVEMENT_SCREENS, gradeScreen, summarise } from '../movement'
import type { Grade, MovementAssessment } from '../types'

const squat = MOVEMENT_SCREENS.find((s) => s.id === 'squat')!

function assessment(grades: Record<string, Grade>): MovementAssessment {
  return { id: 'm1', date: '2026-02-01', grades }
}

function allGreen(): Record<string, Grade> {
  return Object.fromEntries(MOVEMENT_SCREENS.flatMap((s) => s.items.map((i) => [i.id, 'groen' as Grade])))
}

describe('bewegingskwaliteit', () => {
  it('laat de zwakste schakel het patroon bepalen', () => {
    const grades = Object.fromEntries(squat.items.map((i) => [i.id, 'groen' as Grade]))
    expect(gradeScreen(squat, grades).grade).toBe('groen')

    grades[squat.items[1].id] = 'geel'
    expect(gradeScreen(squat, grades).grade).toBe('geel')

    grades[squat.items[2].id] = 'rood'
    expect(gradeScreen(squat, grades).grade).toBe('rood')
  })

  it('levert bij elk afwijkend punt een concrete correctie', () => {
    const grades = { [squat.items[0].id]: 'rood' as Grade }
    const result = gradeScreen(squat, grades)
    expect(result.issues).toHaveLength(1)
    expect(result.issues[0].item.correction.length).toBeGreaterThan(20)
    expect(result.issues[0].item.fault.length).toBeGreaterThan(10)
  })

  it('telt een onbeoordeeld patroon niet als goedgekeurd', () => {
    expect(gradeScreen(squat, {}).grade).toBe('geel')
    expect(gradeScreen(squat, {}).graded).toBe(0)
  })

  it('benoemt zonder beoordeling dat er nog niets bekend is', () => {
    const summary = summarise(null)
    expect(summary.completed).toBe(0)
    expect(summary.gradedItems).toBe(0)
    expect(summary.verdict).toMatch(/nog niet beoordeeld/i)
    expect(summary.limits).toHaveLength(0)
  })

  it('spreekt zichzelf niet tegen bij een half ingevulde beoordeling', () => {
    // Eén rood punt, verder niets: de tekst mag dan niet "nog niet beoordeeld" zijn.
    const summary = summarise(assessment({ [squat.items[1].id]: 'rood' }))
    expect(summary.completed).toBe(0)
    expect(summary.gradedItems).toBe(1)
    expect(summary.worst).toBe('rood')
    expect(summary.verdict).not.toMatch(/nog niet beoordeeld/i)
    expect(summary.verdict).toMatch(/aandacht/i)
  })

  it('vraagt de rest af te maken als het beoordeelde deel in orde is', () => {
    const grades = Object.fromEntries(squat.items.map((i) => [i.id, 'groen' as Grade]))
    const summary = summarise(assessment(grades))
    expect(summary.worst).toBe('groen')
    expect(summary.verdict).toMatch(/Maak de rest af/i)
  })

  it('geeft groen licht als alles staat', () => {
    const summary = summarise(assessment(allGreen()))
    expect(summary.completed).toBe(summary.total)
    expect(summary.worst).toBe('groen')
    expect(summary.verdict).toMatch(/staan/i)
  })

  it('vertaalt een rood patroon naar een concrete beperking voor het programma', () => {
    const grades = allGreen()
    grades[squat.items[1].id] = 'rood'
    const summary = summarise(assessment(grades))
    expect(summary.worst).toBe('rood')
    expect(summary.limits).toHaveLength(1)
    expect(summary.limits[0]).toMatch(/Squatdiepte/)
    expect(summary.verdict).toMatch(/geen afkeuring/i)
  })

  it('dekt alle patronen uit sectie 6.1', () => {
    const ids = MOVEMENT_SCREENS.map((s) => s.id)
    expect(ids).toEqual(expect.arrayContaining(['squat', 'hinge', 'push', 'row', 'shoulder', 'ankle']))
    for (const screen of MOVEMENT_SCREENS) {
      expect(screen.items.length).toBeGreaterThanOrEqual(2)
      expect(screen.setup).toMatch(/film|test/i)
      expect(screen.consequence.length).toBeGreaterThan(20)
    }
  })
})

describe('koppeling met de fase-gate', () => {
  it('leidt bewegingsruimte af uit de beoordeling zodra die er is', async () => {
    const { evaluateGate } = await import('../gates')
    const { getPhase } = await import('../phases')
    const { emptyState } = await import('../defaults')

    const base = emptyState()
    const zonder = evaluateGate(base, getPhase(1), 12)
    expect(zonder.criteria.find((c) => c.id === 'bewegingsruimte')?.status).toBe('onbekend')
    expect(zonder.criteria.find((c) => c.id === 'bewegingsruimte')?.explanation).toMatch(/Metingen/)

    const groen = { ...base, movementAssessments: [assessment(allGreen())] }
    expect(evaluateGate(groen, getPhase(1), 12).criteria.find((c) => c.id === 'bewegingsruimte')?.status).toBe('groen')

    const rood = allGreen()
    rood[squat.items[0].id] = 'rood'
    const metProbleem = { ...base, movementAssessments: [assessment(rood)] }
    const result = evaluateGate(metProbleem, getPhase(1), 12).criteria.find((c) => c.id === 'bewegingsruimte')!
    expect(result.status).toBe('rood')
    expect(result.explanation).toMatch(/Squatdiepte/)
  })
})
