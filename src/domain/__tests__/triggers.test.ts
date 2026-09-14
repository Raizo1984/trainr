import { describe, expect, it } from 'vitest'
import {
  adherenceAlerts,
  deloadAlerts,
  formAlerts,
  jointCapAlerts,
  painAlerts,
  plateauAlerts,
  redFlagAlert,
  rirAlerts,
  strengthDeclining,
  volumeAlerts,
} from '../triggers'
import { DEFAULT_SAFETY } from '../risk'
import { getPhase } from '../phases'
import { makeExercise, makeSession, makeSet, stateWith } from './factories'
import { todayIso, addDays } from '../analytics'

const safety = DEFAULT_SAFETY
const phase1 = getPhase(1)

describe('trigger 1 — pijn', () => {
  it('pauzeert bij pijn 5 of hoger en benoemt het gebied', () => {
    const session = makeSession(todayIso(), [
      makeExercise('squat', 'squat-3', [makeSet({ reps: 10, pain: 6, painRegion: 'knie-links' })]),
    ])
    const alerts = painAlerts([session], safety)
    expect(alerts[0].severity).toBe('kritiek')
    expect(alerts[0].body).toContain('Knie links')
  })

  it('herkent drie sessies op rij pijn als patroon', () => {
    const sessions = [0, 1, 2].map((i) =>
      makeSession(addDays(todayIso(), -i * 3), [
        makeExercise('squat', 'squat-3', [makeSet({ reps: 10, pain: 3, painRegion: 'knie-links' })]),
      ]),
    )
    const alerts = painAlerts(sessions, safety)
    expect(alerts.some((a) => a.code === 'pijn-patroon')).toBe(true)
  })

  it('zwijgt bij pijn onder de grens', () => {
    const session = makeSession(todayIso(), [makeExercise('squat', 'squat-3', [makeSet({ reps: 10, pain: 1 })])])
    expect(painAlerts([session], safety)).toHaveLength(0)
  })
})

describe('trigger 2 — techniek', () => {
  it('meldt twee sessies met een vormscore van 3 of lager', () => {
    const sessions = [0, 1].map((i) =>
      makeSession(addDays(todayIso(), -i * 3), [
        makeExercise('h-pull', 'pull-2', [makeSet({ reps: 10, formQuality: 3 })]),
      ]),
    )
    const alerts = formAlerts(sessions)
    expect(alerts).toHaveLength(1)
    expect(alerts[0].action).toMatch(/10 tot 20%/)
  })
})

describe('trigger 3 — plateau', () => {
  it('meldt drie sessies zonder progressie en biedt opties in plaats van een bevel', () => {
    const sessions = [2, 1, 0].map((i) =>
      makeSession(addDays(todayIso(), -i * 3), [
        makeExercise('squat', 'squat-3', [makeSet({ reps: 9, load: 50 }), makeSet({ reps: 9, load: 50 })]),
      ]),
    )
    const alerts = plateauAlerts(sessions)
    expect(alerts).toHaveLength(1)
    expect(alerts[0].options?.length).toBeGreaterThan(2)
  })

  it('telt deloadweken niet mee als stilstand', () => {
    const sessions = [2, 1, 0].map((i) =>
      makeSession(addDays(todayIso(), -i * 3), [
        makeExercise('squat', 'squat-3', [makeSet({ reps: 9, load: 50 })]),
      ], { isDeload: i === 1 }),
    )
    expect(plateauAlerts(sessions)).toHaveLength(0)
  })
})

describe('trigger 4 — opkomst', () => {
  it('is niet veroordelend en biedt een oplossing', () => {
    const alerts = adherenceAlerts([makeSession(todayIso(), [])], phase1, 4)
    expect(alerts[0].severity).toBe('let-op')
    expect(alerts[0].body).not.toMatch(/moet|faal/i)
    expect(alerts[0].action).toMatch(/volume|deload/i)
  })

  it('oordeelt nog niet in de eerste weken', () => {
    expect(adherenceAlerts([], phase1, 1)).toHaveLength(0)
  })
})

describe('trigger 5 en systeem C — deload', () => {
  it('kondigt de deloadweek aan en markeert hem als niet-optioneel', () => {
    const alerts = deloadAlerts(6, safety)
    expect(alerts[0].title).toMatch(/deloadweek/i)
    expect(alerts[0].action).toMatch(/niet overgeslagen/i)
  })

  it('waarschuwt een week vooraf', () => {
    expect(deloadAlerts(5, safety)[0].title).toMatch(/volgende week/i)
  })

  it('volgt een kortere deloadcyclus bij hoog risico', () => {
    expect(deloadAlerts(4, { ...safety, deloadIntervalWeeks: 4 })[0].code).toBe('deload-due')
  })
})

describe('systeem A en B — overbelasting', () => {
  it('meldt een volumesprong boven de ingestelde grens', () => {
    // Week van 5 januari 2026 (maandag) tegen de week erna.
    const weekA = ['2026-01-05', '2026-01-07'].map((date) =>
      makeSession(date, [makeExercise('squat', 'squat-3', [makeSet({ reps: 10 })])]),
    )
    const weekB = ['2026-01-12', '2026-01-13', '2026-01-14', '2026-01-15'].map((date) =>
      makeSession(date, [
        makeExercise('squat', 'squat-3', [makeSet({ reps: 10 }), makeSet({ reps: 10 }), makeSet({ reps: 10 })]),
      ]),
    )
    const alerts = volumeAlerts([...weekA, ...weekB], safety)
    expect(alerts).toHaveLength(1)
    expect(alerts[0].code).toBe('volume-sprong')
    expect(alerts[0].action).toMatch(/terug naar het niveau/i)
  })

  it('zwijgt bij een opbouw binnen de toegestane 10%', () => {
    const weekA = ['2026-01-05', '2026-01-07'].map((date) =>
      makeSession(date, [
        makeExercise('squat', 'squat-3', [makeSet({ reps: 10 }), makeSet({ reps: 10 }), makeSet({ reps: 10 }), makeSet({ reps: 10 }), makeSet({ reps: 10 })]),
      ]),
    )
    const weekB = ['2026-01-12', '2026-01-14'].map((date) =>
      makeSession(date, [
        makeExercise('squat', 'squat-3', [makeSet({ reps: 10 }), makeSet({ reps: 10 }), makeSet({ reps: 10 }), makeSet({ reps: 10 }), makeSet({ reps: 10 })]),
      ]),
    )
    expect(volumeAlerts([...weekA, ...weekB], safety)).toHaveLength(0)
  })

  it('meldt een overschreden gewrichtsplafond', () => {
    const sets = Array.from({ length: 16 }, () => makeSet({ reps: 10 }))
    const session = makeSession(todayIso(), [makeExercise('v-push', 'vpush-1', sets)])
    const alerts = jointCapAlerts([session])
    expect(alerts.some((a) => a.subject === 'schouder')).toBe(true)
  })
})

describe('systeem D — RIR', () => {
  it('spreekt trainen tot falen aan zonder te bestraffen', () => {
    const session = makeSession(todayIso(), [
      makeExercise('squat', 'squat-3', [makeSet({ reps: 10, rir: 0 })]),
    ])
    const alerts = rirAlerts([session])
    expect(alerts[0].body).toMatch(/2 tot 4 reps/)
  })
})

describe('rode vlaggen', () => {
  it('meldt de pauze zonder schuldtoon', () => {
    const state = stateWith([], {
      medicalHold: { active: true, since: todayIso(), reason: 'Uitstralende pijn gemeld.' },
    })
    const alert = redFlagAlert(state)
    expect(alert?.severity).toBe('kritiek')
    expect(alert?.body).toMatch(/geen schaamte/i)
  })

  it('meldt niets zonder hold', () => {
    expect(redFlagAlert(stateWith([]))).toBeNull()
  })
})

describe('krachtverlies', () => {
  it('herkent teruglopende belasting over meerdere oefeningen', () => {
    const sessions = [0, 1, 2, 3].map((i) =>
      makeSession(addDays(todayIso(), -20 + i * 5), [
        makeExercise('squat', 'squat-3', [makeSet({ reps: 8, load: 60 - i * 5 })]),
        makeExercise('h-pull', 'pull-2', [makeSet({ reps: 8, load: 40 - i * 4 })]),
      ]),
    )
    expect(strengthDeclining(sessions)).toBe(true)
  })
})

describe('weekaggregatie', () => {
  it('markeert een week als deload zodra er een deloadsessie in zit', async () => {
    const { weeklyVolume } = await import('../analytics')
    const weeks = weeklyVolume([
      makeSession('2026-01-05', [makeExercise('squat', 'squat-3', [makeSet({ reps: 10 })])]),
      makeSession('2026-01-07', [makeExercise('squat', 'squat-3', [makeSet({ reps: 10 })])], { isDeload: true }),
      makeSession('2026-01-12', [makeExercise('squat', 'squat-3', [makeSet({ reps: 10 })])]),
    ])
    expect(weeks.map((w) => w.isDeload)).toEqual([true, false])
  })
})
