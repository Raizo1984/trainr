import { describe, expect, it } from 'vitest'
import { evaluateGate } from '../gates'
import { getPhase } from '../phases'
import { applyDeload, buildTemplates, isDeloadWeek, weeksUntilDeload } from '../program'
import { DEFAULT_SAFETY } from '../risk'
import { makeExercise, makeSession, makeSet, stateWith } from './factories'
import type { SessionLog } from '../types'

const phase1 = getPhase(1)

function goodSessions(count: number): SessionLog[] {
  return Array.from({ length: count }, (_, i) =>
    makeSession(`2026-01-${String(i + 1).padStart(2, '0')}`, [
      makeExercise('squat', 'squat-3', [makeSet({ reps: 8 + Math.min(i, 4), load: 40 + i })]),
      makeExercise('h-pull', 'pull-2', [makeSet({ reps: 8 + Math.min(i, 4), load: 30 + i })]),
    ]),
  )
}

describe('fase-gate', () => {
  it('kan niets beoordelen zonder data', () => {
    const result = evaluateGate(stateWith([]), phase1, 12)
    expect(result.decision).toBe('nog-niet-beoordeelbaar')
  })

  it('stroomt door als alles groen is en de minimumduur gehaald', () => {
    const state = stateWith(goodSessions(36), {
      phase: { current: 1, startedAt: '2026-01-01', confirmations: { bewegingsruimte: true, voeding: true, medisch: true }, history: [] },
    })
    const result = evaluateGate(state, phase1, 12)
    expect(result.criteria.every((c) => c.status === 'groen')).toBe(true)
    expect(result.decision).toBe('doorstromen')
  })

  it('verlengt de fase als de minimumduur nog niet gehaald is, ook bij alles groen', () => {
    const state = stateWith(goodSessions(18), {
      phase: { current: 1, startedAt: '2026-01-01', confirmations: { bewegingsruimte: true, voeding: true, medisch: true }, history: [] },
    })
    const result = evaluateGate(state, phase1, 6)
    expect(result.decision).toBe('verlengen')
    expect(result.summary).toMatch(/minimum van 8 weken/)
  })

  it('vraagt een professionele beoordeling bij oplopende pijn', () => {
    const sessions = goodSessions(30).map((s, i) =>
      i % 2 === 0
        ? {
            ...s,
            exercises: [makeExercise('squat', 'squat-3', [makeSet({ reps: 8, pain: 6, painRegion: 'knie-links' })])],
          }
        : s,
    )
    const state = stateWith(sessions, {
      phase: { current: 1, startedAt: '2026-01-01', confirmations: { bewegingsruimte: true, voeding: true, medisch: true }, history: [] },
    })
    const result = evaluateGate(state, phase1, 12)
    expect(result.decision).toBe('professionele-beoordeling')
  })

  it('blokkeert doorstroom op een niet-bevestigd criterium', () => {
    const state = stateWith(goodSessions(36))
    const result = evaluateGate(state, phase1, 12)
    expect(result.decision).not.toBe('doorstromen')
    expect(result.criteria.filter((c) => c.status === 'onbekend').length).toBeGreaterThan(0)
  })
})

describe('programmageneratie', () => {
  const ctx = { phase: 1 as const, equipment: ['sportschool' as const], safety: DEFAULT_SAFETY, week: 1 }

  it('gebruikt twee sets in de leerweken van fase 1', () => {
    const [template] = buildTemplates(ctx)
    expect(template.main.every((e) => e.sets === 2)).toBe(true)
  })

  it('gaat in week 3 naar volle sets', () => {
    const [template] = buildTemplates({ ...ctx, week: 3 })
    expect(template.main.some((e) => e.sets === 3)).toBe(true)
  })

  it('schrijft precies vijf ankeroefeningen voor in fase 1', () => {
    const [template] = buildTemplates({ ...ctx, week: 3 })
    expect(template.main).toHaveLength(5)
  })

  it('bouwt een vierdaagse split vanaf fase 2', () => {
    const templates = buildTemplates({ ...ctx, phase: 2, week: 1 })
    expect(templates.map((t) => t.id)).toEqual(['lower-a', 'upper-a', 'lower-b', 'upper-b'])
  })

  it('kiest alleen oefeningen die met de aanwezige apparatuur kunnen', () => {
    const [template] = buildTemplates({ ...ctx, equipment: ['geen'], week: 3 })
    expect(template.main.every((e) => e.stepId.length > 0)).toBe(true)
    expect(template.main.find((e) => e.ladderId === 'h-push')?.stepId).toMatch(/^push-/)
  })

  it('verlaagt de startdosis bij een conservatief veiligheidsprofiel', () => {
    const [normal] = buildTemplates({ ...ctx, week: 3 })
    const [careful] = buildTemplates({ ...ctx, week: 3, safety: { ...DEFAULT_SAFETY, startingSetsFactor: 0.67 } })
    const normalSets = normal.main.reduce((t, e) => t + e.sets, 0)
    const carefulSets = careful.main.reduce((t, e) => t + e.sets, 0)
    expect(carefulSets).toBeLessThan(normalSets)
  })

  it('halveert de sets in een deloadweek en laat de vaste blokken staan', () => {
    const [template] = buildTemplates({ ...ctx, week: 3 })
    const deload = applyDeload(template)
    expect(deload.main.every((e, i) => e.sets <= template.main[i].sets)).toBe(true)
    expect(deload.warmup).toEqual(template.warmup)
    expect(deload.subtitle).toMatch(/licht/i)
  })

  it('plant de deload elke zes weken', () => {
    expect(isDeloadWeek(6, DEFAULT_SAFETY)).toBe(true)
    expect(isDeloadWeek(5, DEFAULT_SAFETY)).toBe(false)
    expect(weeksUntilDeload(4, DEFAULT_SAFETY)).toBe(2)
    expect(isDeloadWeek(4, { ...DEFAULT_SAFETY, deloadIntervalWeeks: 4 })).toBe(true)
  })
})
