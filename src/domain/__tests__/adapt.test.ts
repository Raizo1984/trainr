import { describe, expect, it } from 'vitest'
import {
  activeAdjustments,
  applyAdjustments,
  describeAdjustment,
  proposeAdjustments,
  validateAdjustment,
  type PlanAdjustment,
  type ValidationContext,
} from '../adapt'
import { DEFAULT_SAFETY } from '../risk'
import { getPhase } from '../phases'
import { buildTemplates } from '../program'
import { addDays, todayIso } from '../analytics'
import { makeExercise, makeSession, makeSet, stateWith } from './factories'
import type { AppState, SessionLog } from '../types'

const phase = getPhase(2)
const equipment = ['sportschool', 'halters', 'machines', 'pull-up-bar', 'banden'] as const

function ctxFor(state: AppState, week = 3, safety = DEFAULT_SAFETY): ValidationContext {
  return { state, safety, phase, phaseWeek: week }
}

function adjustment(patch: Partial<PlanAdjustment>): PlanAdjustment {
  return {
    id: 'a1',
    kind: 'sets-omhoog',
    reason: 'test',
    source: 'coach',
    createdAt: todayIso(),
    accepted: true,
    ...patch,
  }
}

/**
 * Realistische reeks sessies: vier oefeningen van drie sets, zoals een echte
 * week eruitziet. Met te dunne data ziet elke setverhoging eruit als een
 * volumesprong van honderden procenten, en dan test je de fixture in plaats
 * van de regel.
 */
function sessions(
  count: number,
  opts: { pain?: number; form?: 1 | 2 | 3 | 4 | 5; load?: number; reps?: number; ladderId?: string; stepId?: string } = {},
): SessionLog[] {
  const target = opts.ladderId ?? 'squat'
  const filler: Array<[string, string]> = [
    ['hinge', 'hinge-3'],
    ['h-pull', 'pull-2'],
    ['carry-core', 'carry-3'],
  ].filter(([id]) => id !== target) as Array<[string, string]>

  return Array.from({ length: count }, (_, i) =>
    makeSession(
      addDays(todayIso(), -(count - i) * 2),
      [
        makeExercise(
          target,
          opts.stepId ?? 'squat-3',
          [0, 1, 2].map(() =>
            makeSet({
              reps: opts.reps ?? 10,
              load: opts.load ?? 50,
              pain: (opts.pain ?? 0) as never,
              formQuality: opts.form ?? 5,
            }),
          ),
        ),
        ...filler.map(([ladderId, stepId]) =>
          makeExercise(ladderId, stepId, [0, 1, 2].map(() => makeSet({ reps: 10, load: 40 }))),
        ),
      ],
      { phase: 2, phaseWeek: i + 1 },
    ),
  )
}

describe('veiligheidspoort', () => {
  it('laat een normale setverhoging door', () => {
    const state = stateWith(sessions(4))
    const result = validateAdjustment(adjustment({ ladderId: 'squat', amount: 1 }), ctxFor(state))
    expect(result.allowed).toBe(true)
  })

  it('blokkeert elke wijziging tijdens een medische pauze', () => {
    const state = stateWith(sessions(4), {
      medicalHold: { active: true, since: todayIso(), reason: 'Uitstralende pijn.' },
    })
    const result = validateAdjustment(adjustment({ ladderId: 'squat', amount: 1 }), ctxFor(state))
    expect(result.allowed).toBe(false)
    expect(result.reason).toMatch(/gepauzeerd/i)
  })

  it('weigert zwaarder maken bij recente pijn', () => {
    const state = stateWith(sessions(4, { pain: 4 }))
    const result = validateAdjustment(adjustment({ ladderId: 'squat', amount: 1 }), ctxFor(state))
    expect(result.allowed).toBe(false)
    expect(result.reason).toMatch(/pijn 4 van 10/)
  })

  it('weigert zwaarder maken bij techniekverlies', () => {
    const state = stateWith(sessions(4, { form: 3 }))
    const result = validateAdjustment(adjustment({ ladderId: 'squat', amount: 1 }), ctxFor(state))
    expect(result.allowed).toBe(false)
    expect(result.reason).toMatch(/techniek/i)
  })

  it('weigert volume verhogen vlak voor een verplichte deload', () => {
    const state = stateWith(sessions(4))
    const result = validateAdjustment(adjustment({ ladderId: 'squat', amount: 1 }), ctxFor(state, 6))
    expect(result.allowed).toBe(false)
    expect(result.reason).toMatch(/deload/i)
  })

  it('bewaakt het volumeplafond per gewricht', () => {
    const many = Array.from({ length: 16 }, () => makeSet({ reps: 10 }))
    const state = stateWith([makeSession(todayIso(), [makeExercise('v-push', 'vpush-1', many)])])
    const result = validateAdjustment(adjustment({ ladderId: 'v-push', amount: 1 }), ctxFor(state))
    expect(result.allowed).toBe(false)
    expect(result.reason).toMatch(/volumeplafond/i)
  })

  it('brengt meer dan één set tegelijk terug naar één', () => {
    const state = stateWith(sessions(4))
    const result = validateAdjustment(adjustment({ ladderId: 'squat', amount: 3 }), ctxFor(state))
    expect(result.allowed).toBe(true)
    expect(result.altered?.amount).toBe(1)
    expect(result.reason).toMatch(/twee variabelen/i)
  })

  it('staat een trede omhoog pas toe als de bovenkant gehaald is', () => {
    const tooSoon = stateWith(sessions(4, { reps: 9 }))
    expect(validateAdjustment(adjustment({ kind: 'trede-omhoog', ladderId: 'squat' }), ctxFor(tooSoon)).allowed).toBe(false)

    const ready = stateWith(
      sessions(4, { reps: 12 }).map((s) => ({
        ...s,
        exercises: s.exercises.map((e) => ({ ...e, planned: { ...e.planned, repMax: 12 } })),
      })),
    )
    expect(validateAdjustment(adjustment({ kind: 'trede-omhoog', ladderId: 'squat' }), ctxFor(ready)).allowed).toBe(true)
  })

  it('trekt een te laag repbereik op naar 3', () => {
    const state = stateWith(sessions(4))
    const result = validateAdjustment(
      adjustment({ kind: 'repbereik-wijzigen', ladderId: 'squat', repMin: 1, repMax: 3 }),
      ctxFor(state),
    )
    expect(result.allowed).toBe(true)
    expect(result.altered?.repMin).toBe(3)
    expect(result.reason).toMatch(/maximaalkracht/i)
  })

  it('laat pauzeren wel toe tijdens een medische pauze', () => {
    const state = stateWith(sessions(4), {
      medicalHold: { active: true, since: todayIso(), reason: 'x' },
    })
    expect(validateAdjustment(adjustment({ kind: 'oefening-pauzeren', ladderId: 'squat' }), ctxFor(state)).allowed).toBe(true)
  })
})

describe('aanpassingen toepassen', () => {
  const templates = () => buildTemplates({ phase: 2, equipment: [...equipment], safety: DEFAULT_SAFETY, week: 3 })

  it('verandert niets zonder geaccepteerde aanpassingen', () => {
    const before = templates()
    const after = applyAdjustments(before, [adjustment({ accepted: false, ladderId: 'squat' })])
    expect(after[0].main).toEqual(before[0].main)
  })

  it('voegt een set toe aan de juiste oefening', () => {
    const before = templates()
    const squatBefore = before[0].main.find((e) => e.ladderId === 'squat')!
    const after = applyAdjustments(before, [adjustment({ ladderId: 'squat', amount: 1 })])
    const squatAfter = after[0].main.find((e) => e.ladderId === 'squat')!
    expect(squatAfter.sets).toBe(squatBefore.sets + 1)
    const other = after[0].main.find((e) => e.ladderId === 'hinge')!
    expect(other.sets).toBe(before[0].main.find((e) => e.ladderId === 'hinge')!.sets)
  })

  it('haalt een gepauzeerde oefening uit het programma', () => {
    const after = applyAdjustments(templates(), [adjustment({ kind: 'oefening-pauzeren', ladderId: 'squat' })])
    expect(after[0].main.some((e) => e.ladderId === 'squat')).toBe(false)
  })

  it('zet een trede terug', () => {
    const before = templates()
    const stepBefore = before[0].main.find((e) => e.ladderId === 'squat')!.stepId
    const after = applyAdjustments(before, [adjustment({ kind: 'trede-omlaag', ladderId: 'squat' })])
    expect(after[0].main.find((e) => e.ladderId === 'squat')!.stepId).not.toBe(stepBefore)
  })

  it('past een aanpassing zonder lader toe op alle oefeningen', () => {
    const before = templates()
    const after = applyAdjustments(before, [adjustment({ kind: 'sets-omlaag', amount: 1 })])
    for (const [i, exercise] of after[0].main.entries()) {
      expect(exercise.sets).toBe(Math.max(1, before[0].main[i].sets - 1))
    }
  })

  it('laat een verlopen aanpassing vervallen', () => {
    const old = adjustment({ ladderId: 'squat', createdAt: addDays(todayIso(), -40), expiresAfterWeeks: 4 })
    expect(activeAdjustments([old])).toHaveLength(0)
    const fresh = adjustment({ ladderId: 'squat', createdAt: addDays(todayIso(), -3), expiresAfterWeeks: 4 })
    expect(activeAdjustments([fresh])).toHaveLength(1)
  })
})

describe('de deterministische motor', () => {
  it('stelt pauzeren voor bij een pijnpiek', () => {
    const state = stateWith(sessions(3, { pain: 6 }))
    const proposals = proposeAdjustments(ctxFor(state))
    const pause = proposals.find((p) => p.kind === 'oefening-pauzeren')
    expect(pause).toBeDefined()
    expect(pause?.source).toBe('regel')
    expect(pause?.accepted).toBe(false)
  })

  it('stelt een regressie voor bij aanhoudende pijn onder de piek', () => {
    const state = stateWith(sessions(3, { pain: 3 }))
    const proposals = proposeAdjustments(ctxFor(state))
    expect(proposals.some((p) => p.kind === 'trede-omlaag')).toBe(true)
  })

  it('stelt een trede terug voor bij techniekverlies', () => {
    const state = stateWith(sessions(3, { form: 3 }))
    const proposals = proposeAdjustments(ctxFor(state))
    const fix = proposals.find((p) => p.reason.includes('Techniek'))
    expect(fix?.kind).toBe('trede-omlaag')
  })

  it('stelt bij één stilstaande oefening precies één set voor', () => {
    // Alleen de squat staat stil; de andere oefeningen lopen op.
    const base = sessions(4, { reps: 9, load: 50 })
    const moving = base.map((s, i) => ({
      ...s,
      exercises: s.exercises.map((e) =>
        e.ladderId === 'squat' ? e : { ...e, sets: e.sets.map((set) => ({ ...set, load: 40 + i * 5, reps: 10 + i })) },
      ),
    }))
    const proposals = proposeAdjustments(ctxFor(stateWith(moving)))
    const more = proposals.filter((p) => p.kind === 'sets-omhoog')
    expect(more).toHaveLength(1)
    expect(more[0].ladderId).toBe('squat')
    expect(more[0].amount).toBe(1)
  })

  it('bundelt brede stilstand tot één vervroegde deload in plaats van vijf setverhogingen', () => {
    // Vier oefeningen die allemaal stilstaan. Vijf losse setverhogingen zouden
    // samen een volumesprong van tientallen procenten opleveren.
    const proposals = proposeAdjustments(ctxFor(stateWith(sessions(4, { reps: 9, load: 50 }))))
    expect(proposals.filter((p) => p.kind === 'sets-omhoog')).toHaveLength(0)
    const deload = proposals.find((p) => p.kind === 'deload-vervroegen')
    expect(deload).toBeDefined()
    expect(deload?.reason).toMatch(/tegelijk stil/)
  })

  it('stelt geen setverhoging voor op de oefening die pijn doet', () => {
    const state = stateWith(sessions(4, { reps: 9, load: 50, pain: 4 }))
    const proposals = proposeAdjustments(ctxFor(state))
    // Andere oefeningen mogen wel vooruit; het gaat om de pijnlijke.
    expect(proposals.some((p) => p.kind === 'sets-omhoog' && p.ladderId === 'squat')).toBe(false)
    expect(proposals.some((p) => p.ladderId === 'squat' && p.kind === 'trede-omlaag')).toBe(true)
  })

  it('stelt minder volume voor bij lage opkomst', () => {
    const state = stateWith(sessions(2))
    // Twee sessies in zes weken bij een fase die er vier per week vraagt.
    const proposals = proposeAdjustments(ctxFor(state, 6))
    const less = proposals.find((p) => p.kind === 'sets-omlaag')
    expect(less).toBeDefined()
    expect(less?.reason).toMatch(/verslaat een volledig programma/i)
  })

  it('beschrijft elke soort aanpassing leesbaar', () => {
    expect(describeAdjustment(adjustment({ ladderId: 'squat', amount: 1 }))).toMatch(/set erbij/)
    expect(describeAdjustment(adjustment({ kind: 'oefening-pauzeren', ladderId: 'squat' }))).toMatch(/gepauzeerd/)
    expect(describeAdjustment(adjustment({ kind: 'deload-vervroegen' }))).toMatch(/Deloadweek/)
  })
})

/**
 * De coachlaag is de enige bron die niet deterministisch is. Deze reeks gaat
 * er expliciet van uit dat het model zich vergist of wordt overgehaald, en
 * controleert dat de poort dat opvangt. Slaagt dit niet, dan is de hele
 * coachfunctie onverantwoord.
 */
describe('een coachvoorstel is nooit een bevel', () => {
  const coach = (patch: Partial<PlanAdjustment>): PlanAdjustment =>
    adjustment({ source: 'coach', accepted: false, ...patch })

  it('houdt zwaarder maken tegen bij pijn, ook als de coach het voorstelt', () => {
    const state = stateWith(sessions(4, { pain: 6 }))
    const result = validateAdjustment(coach({ kind: 'sets-omhoog', ladderId: 'squat', amount: 1 }), ctxFor(state))
    expect(result.allowed).toBe(false)
  })

  it('houdt een tredestap tegen bij techniekverlies', () => {
    const state = stateWith(sessions(4, { form: 2, reps: 12 }))
    const result = validateAdjustment(coach({ kind: 'trede-omhoog', ladderId: 'squat' }), ctxFor(state))
    expect(result.allowed).toBe(false)
  })

  it('houdt elk voorstel tegen tijdens een medische pauze', () => {
    const state = stateWith(sessions(4), {
      medicalHold: { active: true, since: todayIso(), reason: 'Tintelingen in de arm.' },
    })
    for (const kind of ['sets-omhoog', 'trede-omhoog', 'repbereik-wijzigen', 'deload-vervroegen'] as const) {
      expect(validateAdjustment(coach({ kind, ladderId: 'squat' }), ctxFor(state)).allowed).toBe(false)
    }
  })

  it('knipt een overenthousiast voorstel terug in plaats van het te weigeren', () => {
    const state = stateWith(sessions(4))
    const result = validateAdjustment(coach({ kind: 'sets-omhoog', ladderId: 'squat', amount: 5 }), ctxFor(state))
    expect(result.allowed).toBe(true)
    expect(result.altered?.amount).toBe(1)
  })

  it('trekt een maximaalkracht-repbereik op naar wat het programma kent', () => {
    const state = stateWith(sessions(4))
    const result = validateAdjustment(
      coach({ kind: 'repbereik-wijzigen', ladderId: 'squat', repMin: 1, repMax: 2 }),
      ctxFor(state),
    )
    expect(result.altered?.repMin).toBe(3)
  })

  it('past een onbevestigd voorstel niet toe op het programma', () => {
    const templates = buildTemplates({ phase: 2, equipment: [...equipment], safety: DEFAULT_SAFETY, week: 3 })
    const after = applyAdjustments(templates, [coach({ kind: 'oefening-pauzeren', ladderId: 'squat' })])
    expect(after[0].main.some((e) => e.ladderId === 'squat')).toBe(true)
  })
})

describe('wat de coach te zien krijgt', () => {
  it('stuurt geen naam of vrije notities mee', async () => {
    const { buildCoachContext } = await import('../coachContext')
    const state = stateWith(sessions(3))
    state.intake.name = 'Rasim'
    state.intake.medical.previousInjuries = 'Privégegevens over een operatie in 2019'
    const context = buildCoachContext(state, phase, 3, 130, 3, [])
    const json = JSON.stringify(context)
    expect(json).not.toMatch(/Rasim/)
    expect(json).not.toMatch(/Priv/)
  })

  it('geeft de harde grenzen expliciet mee', async () => {
    const { buildCoachContext } = await import('../coachContext')
    const context = buildCoachContext(stateWith(sessions(3)), phase, 3, 130, 3, [])
    expect(context.grenzen.join(' ')).toMatch(/Pijn van 5 of hoger/)
    expect(context.grenzen.join(' ')).toMatch(/Deloadweken/)
  })

  it('waarschuwt de coach expliciet bij het beschermende voedingsmodel', async () => {
    const { buildCoachContext } = await import('../coachContext')
    const { assessRisk } = await import('../risk')
    const { intakeWith } = await import('./factories')
    const state = stateWith(sessions(3), {
      risk: assessRisk(intakeWith((i) => { i.nutrition.extremePatterns = true })),
    })
    const context = buildCoachContext(state, phase, 3, 130, 3, ['Calorieën tellen'])
    expect(context.voedingsmodel).toBe('beschermend')
    expect(context.grenzen.join(' ')).toMatch(/geen calorie/i)
    expect(context.grenzen.join(' ')).toMatch(/Ook niet op verzoek/i)
  })

  it('meldt een medische pauze aan de coach', async () => {
    const { buildCoachContext } = await import('../coachContext')
    const state = stateWith(sessions(3), {
      medicalHold: { active: true, since: todayIso(), reason: 'Uitstralende pijn gemeld.' },
    })
    const context = buildCoachContext(state, phase, 3, 130, 3, [])
    expect(context.medischePauze).toMatch(/Uitstralende/)
    expect(context.grenzen.join(' ')).toMatch(/geen enkele programmawijziging/i)
  })
})

describe('volumeplafonds blokkeren geen normaal programma', () => {
  it('telt volume per belaste groep, niet per aangeraakt gewricht', async () => {
    const { jointsFor } = await import('../analytics')
    // Drukwerk is schoudervolume, geen elleboogvolume.
    expect(jointsFor('h-push')).toEqual(['schouder'])
    expect(jointsFor('v-push')).toEqual(['schouder'])
    // Trekwerk is rug- en elleboogvolume, geen schoudervolume.
    expect(jointsFor('h-pull')).toContain('elleboog')
    expect(jointsFor('h-pull')).not.toContain('schouder')
    // Direct armwerk telt bij de elleboog, daar zit de peesbelasting.
    expect(jointsFor('triceps')).toContain('elleboog')
    expect(jointsFor('biceps')).toContain('elleboog')
  })

  it('laat een gewone bovenlichaamsweek binnen de plafonds vallen', async () => {
    const { weeklyJointSets, JOINT_CAPS } = await import('../analytics')
    const upper = (date: string) =>
      makeSession(date, [
        makeExercise('h-push', 'push-4', [0, 1, 2].map(() => makeSet({ reps: 10, load: 0 }))),
        makeExercise('h-pull', 'pull-2', [0, 1, 2].map(() => makeSet({ reps: 10, load: 40 }))),
        makeExercise('v-pull', 'vpull-1', [0, 1, 2].map(() => makeSet({ reps: 10, load: 40 }))),
      ])
    const week = [0, 3].map((d) => upper(addDays(todayIso(), -d)))
    const totals = weeklyJointSets(week)
    expect(totals.elleboog).toBeLessThanOrEqual(JOINT_CAPS.elleboog)
    expect(totals.schouder).toBeLessThanOrEqual(JOINT_CAPS.schouder)
  })
})

describe('opbouwsnelheid in plaats van een verbod', () => {
  it('laat een hoog-risicogebruiker wél een eerste set toevoegen', () => {
    const strict = { ...DEFAULT_SAFETY, maxWeeklyVolumeIncreasePct: 5 }
    const state = stateWith(sessions(6))
    const result = validateAdjustment(adjustment({ ladderId: 'squat', amount: 1, accepted: false }), ctxFor(state, 3, strict))
    expect(result.allowed).toBe(true)
  })

  it('laat de volgende verhoging pas toe na de wachttijd', () => {
    const strict = { ...DEFAULT_SAFETY, maxWeeklyVolumeIncreasePct: 5 }
    const justRaised = stateWith(sessions(6), {
      adjustments: [adjustment({ id: 'eerder', kind: 'sets-omhoog', ladderId: 'hinge', createdAt: todayIso(), accepted: true })],
    })
    const tooSoon = validateAdjustment(adjustment({ ladderId: 'squat', amount: 1 }), ctxFor(justRaised, 3, strict))
    expect(tooSoon.allowed).toBe(false)
    expect(tooSoon.reason).toMatch(/opbouwgrens/)

    const longAgo = stateWith(sessions(6), {
      adjustments: [
        adjustment({ id: 'eerder', kind: 'sets-omhoog', ladderId: 'hinge', createdAt: addDays(todayIso(), -60), accepted: true }),
      ],
    })
    expect(validateAdjustment(adjustment({ ladderId: 'squat', amount: 1 }), ctxFor(longAgo, 3, strict)).allowed).toBe(true)
  })

  it('weigert wel als één set een kwart van het weekvolume is', () => {
    // Twee sessies met elk één oefening van twee sets: zo klein dat één set
    // erbij geen prikkel is maar een sprong.
    const tiny = stateWith(
      [0, 3].map((d) =>
        makeSession(addDays(todayIso(), -d), [
          makeExercise('squat', 'squat-3', [makeSet({ reps: 10 }), makeSet({ reps: 10 })]),
        ]),
      ),
    )
    const result = validateAdjustment(adjustment({ ladderId: 'squat', amount: 1 }), ctxFor(tiny))
    expect(result.allowed).toBe(false)
    expect(result.reason).toMatch(/hoe klein het programma/)
  })
})
