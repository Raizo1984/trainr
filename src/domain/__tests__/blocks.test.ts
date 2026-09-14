import { describe, expect, it } from 'vitest'
import { ACCENT_LADDERS, blockPlan, dosageFor, isMaintenanceBlock } from '../blocks'
import { buildTemplates } from '../program'
import { DEFAULT_SAFETY } from '../risk'
import { activeSkillLadders, pathForGoal, progressForGoals, skillProgress } from '../skills'
import { reviewBlock, splitIntoBlocks } from '../blockReview'
import { getPhase } from '../phases'
import { makeExercise, makeSession, makeSet } from './factories'
import type { SessionLog } from '../types'

const equipment = ['sportschool', 'halters', 'machines', 'pull-up-bar', 'banden'] as const
const ctx = { equipment: [...equipment], safety: DEFAULT_SAFETY }

describe('blokperiodisering', () => {
  it('roteert het accent elke zes weken in fase 4', () => {
    expect(blockPlan(4, 1).accent).toBe('squat')
    expect(blockPlan(4, 6).accent).toBe('squat')
    expect(blockPlan(4, 7).accent).toBe('pull')
    expect(blockPlan(4, 13).accent).toBe('hinge')
    expect(blockPlan(4, 19).accent).toBe('push')
    expect(blockPlan(4, 25).accent).toBe('squat')
  })

  it('telt de week binnen het blok en wat er nog rest', () => {
    const plan = blockPlan(4, 9)
    expect(plan.index).toBe(1)
    expect(plan.weekInBlock).toBe(3)
    expect(plan.weeksLeft).toBe(3)
  })

  it('gebruikt cycli van acht weken in fase 5 en respecteert een eigen keuze', () => {
    expect(blockPlan(5, 1).focus).toBe('massa')
    expect(blockPlan(5, 9).focus).toBe('kracht')
    expect(blockPlan(5, 17).focus).toBe('skill')
    expect(blockPlan(5, 1, 'skill').focus).toBe('skill')
  })

  it('piekt eerst in fase 6 en gaat daarna naar onderhoud', () => {
    expect(blockPlan(6, 1).focus).toBe('skill')
    expect(isMaintenanceBlock(6, blockPlan(6, 1))).toBe(false)
    expect(blockPlan(6, 17).focus).toBeNull()
    expect(isMaintenanceBlock(6, blockPlan(6, 17))).toBe(true)
  })

  it('kent geen accent in de fasen 0 tot en met 3', () => {
    for (const phase of [0, 1, 2, 3] as const) {
      expect(blockPlan(phase, 4).accent).toBeNull()
      expect(blockPlan(phase, 4).focus).toBeNull()
    }
  })
})

describe('dosering per blok', () => {
  const base = { sets: 3, repMin: 8, repMax: 12, rir: 3 }

  it('maakt het accentpatroon zwaar en zet de rest op onderhoud', () => {
    const plan = blockPlan(4, 1)
    const accent = dosageFor('squat', base, plan, false)
    expect(accent.role).toBe('accent')
    expect(accent.dosage.repMax).toBe(6)
    expect(accent.dosage.sets).toBe(4)

    const rest = dosageFor('h-pull', base, plan, false)
    expect(rest.role).toBe('onderhoud')
    expect(rest.dosage.sets).toBe(2)
    expect(rest.dosage.rir).toBe(3)
  })

  it('rekent alle laders van een accent mee', () => {
    const plan = blockPlan(4, 7)
    for (const ladderId of ACCENT_LADDERS.pull) {
      expect(dosageFor(ladderId, base, plan, false).role).toBe('accent')
    }
  })

  it('laat een krachtcyclus lage reps voorschrijven en skills op onderhoud staan', () => {
    const plan = blockPlan(5, 9)
    expect(dosageFor('squat', base, plan, false).dosage.repMax).toBe(6)
    expect(dosageFor('l-sit', base, plan, true).role).toBe('onderhoud')
  })

  it('draait het om in een skillcyclus', () => {
    const plan = blockPlan(5, 17)
    expect(dosageFor('l-sit', base, plan, true).role).toBe('accent')
    expect(dosageFor('squat', base, plan, false).role).toBe('onderhoud')
  })
})

describe('programma voor de fasen 4 tot en met 6', () => {
  it('schrijft in fase 4 zwaardere squats voor tijdens het squat-accent', () => {
    const [lowerA] = buildTemplates({ ...ctx, phase: 4, week: 1 })
    const squat = lowerA.main.find((e) => e.ladderId === 'squat')
    expect(squat?.repMax).toBe(6)
    expect(squat?.note).toMatch(/accent/i)
  })

  it('zet de squat op onderhoud zodra het accent verschuift', () => {
    const [lowerA] = buildTemplates({ ...ctx, phase: 4, week: 7 })
    const squat = lowerA.main.find((e) => e.ladderId === 'squat')
    expect(squat?.repMax).toBe(12)
    expect(squat?.note).toMatch(/onderhoud/i)
  })

  it('neemt skillwerk op in de bovenlichaamssessies, niet als losse sessie', () => {
    const templates = buildTemplates({ ...ctx, phase: 3, week: 1, skills: ['l-sit'] })
    expect(templates).toHaveLength(4)
    const withSkill = templates.filter((t) => t.main.some((e) => e.ladderId === 'l-sit'))
    expect(withSkill).toHaveLength(1)
    expect(withSkill[0].id).toBe('upper-a')
  })

  it('gaat in het onderhoudsblok van fase 6 naar drie sessies per week', () => {
    expect(buildTemplates({ ...ctx, phase: 6, week: 1 })).toHaveLength(4)
    const maintenance = buildTemplates({ ...ctx, phase: 6, week: 17 })
    expect(maintenance).toHaveLength(3)
    expect(maintenance[0].subtitle).toMatch(/onderhoud/i)
  })
})

describe('skillroutes', () => {
  const history = (ladderId: string, stepId: string, reps: number): SessionLog[] =>
    [1, 2].map((i) => makeSession(`2026-03-0${i}`, [makeExercise(ladderId, stepId, [makeSet({ reps, load: 0 })])]))

  it('blokkeert een skill zolang de fase nog niet bereikt is', () => {
    const path = pathForGoal('L-sit')!
    const progress = skillProgress([], path, 1)
    expect(progress.unlocked).toBe(false)
    expect(progress.blockedBy[0]).toMatch(/fase 3/)
  })

  it('benoemt een ontbrekende voorwaarde in plaats van alleen te blokkeren', () => {
    const progress = skillProgress([], pathForGoal('Muscle-up')!, 4)
    expect(progress.unlocked).toBe(false)
    expect(progress.blockedBy).toContain('8 schone pull-ups')
    expect(progress.blockedBy).toContain('8 schone dips')
  })

  it('opent de route zodra de voorwaarden gehaald zijn', () => {
    const sessions = [...history('v-pull', 'vpull-5', 9), ...history('v-push', 'vpush-5', 9)]
    const progress = skillProgress(sessions, pathForGoal('Muscle-up')!, 4)
    expect(progress.unlocked).toBe(true)
    expect(progress.blockedBy).toHaveLength(0)
  })

  it('volgt de hoogste trede waarop daadwerkelijk getraind is', () => {
    const progress = skillProgress(history('l-sit', 'lsit-3', 20), pathForGoal('L-sit')!, 3)
    expect(progress.currentRung).toBe(3)
    expect(progress.totalRungs).toBe(5)
    expect(progress.nextStepName).toBe('Eén been gestrekt')
    expect(progress.best).toBe(20)
  })

  it('kiest hooguit twee skills tegelijk en slaat de standaardsplit over', () => {
    const sessions = [...history('v-pull', 'vpull-5', 9), ...history('v-push', 'vpush-5', 9), ...history('carry-core', 'carry-4', 10)]
    const active = activeSkillLadders(sessions, ['Pull-up', 'Dip', 'L-sit', 'Touwklimmen', 'Handstand'], 3)
    expect(active).not.toContain('v-pull')
    expect(active).not.toContain('v-push')
    expect(active.length).toBeLessThanOrEqual(2)
  })

  it('negeert doelen zonder route', () => {
    expect(progressForGoals([], ['100 kg squat'], 4)).toHaveLength(0)
  })
})

describe('blokevaluatie', () => {
  const phase = getPhase(2)
  const SESSIONS_PER_WEEK = 4

  /** Een volledig blok van zes weken met de frequentie van de fase. */
  function block(startWeek: number, opts: { pain?: number; load?: number; sleep?: 1 | 2 | 3 | 4 | 5 } = {}): SessionLog[] {
    const sessions: SessionLog[] = []
    for (let week = 0; week < 6; week++) {
      for (let day = 0; day < SESSIONS_PER_WEEK; day++) {
        const dayOfYear = (startWeek + week - 1) * 7 + day + 1
        const date = new Date(Date.UTC(2026, 0, dayOfYear)).toISOString().slice(0, 10)
        sessions.push(
          makeSession(
            date,
            [
              makeExercise('squat', 'squat-3', [
                makeSet({ reps: 10, load: opts.load ?? 50, pain: (opts.pain ?? 0) as never }),
              ]),
            ],
            {
              phase: 2,
              phaseWeek: startWeek + week,
              vitals: { sleepQuality: opts.sleep ?? 4, energy: 4, stress: 2 },
            },
          ),
        )
      }
    }
    return sessions
  }

  it('geeft niets terug bij te weinig sessies', () => {
    expect(reviewBlock(block(1).slice(0, 2), phase, 6)).toBeNull()
  })

  it('splitst het huidige blok van het vorige', () => {
    const sessions = [...block(1, { load: 40 }), ...block(7, { load: 50 })]
    const { current, previous } = splitIntoBlocks(sessions, 6)
    expect(current.every((s) => s.phaseWeek >= 7)).toBe(true)
    expect(previous.every((s) => s.phaseWeek < 7)).toBe(true)
    expect(previous.length).toBeGreaterThan(0)
  })

  it('adviseert regressie zodra pijn de bepalende factor is', () => {
    const review = reviewBlock(block(1, { pain: 6 }), phase, 6)!
    expect(review.decision).toBe('regressie')
    expect(review.action).toMatch(/trede terug/i)
    expect(review.problemExercises[0].reason).toMatch(/Pijn tot 6/)
  })

  it('wijst bij lage opkomst naar de planning en niet naar het programma', () => {
    // Halve opkomst: elke tweede sessie weggelaten.
    const sessions = block(1).filter((_, i) => i % 2 === 0)
    const review = reviewBlock(sessions, phase, 6)!
    expect(review.decision).toBe('planning-aanpassen')
    expect(review.reasoning).toMatch(/niet de variabele/i)
  })

  it('vraagt precies één aanpassing bij een geslaagd blok', () => {
    const sessions = [...block(1, { load: 40 }), ...block(7, { load: 55 })]
    const review = reviewBlock(sessions, phase, 6)!
    expect(review.decision).toBe('doorgaan')
    expect(review.action).toMatch(/Kies er één/i)
    expect(review.metrics.find((m) => m.label === 'Progressie op oefeningen')?.trend).toBe('op')
  })

  it('onderzoekt een plateau en wijst naar herstel als dat de oorzaak is', () => {
    const flat = [...block(1, { load: 50 }), ...block(7, { load: 50, sleep: 2 })]
    const review = reviewBlock(flat, phase, 6)!
    expect(review.decision).toBe('plateau-onderzoeken')
    expect(review.reasoning).toMatch(/slaap/i)
    expect(review.action).toMatch(/Herstel eerst/i)
  })

  it('noemt een plateau bij goed herstel een natuurlijk plateau', () => {
    const flat = [...block(1, { load: 50 }), ...block(7, { load: 50 })]
    const review = reviewBlock(flat, phase, 6)!
    expect(review.decision).toBe('plateau-onderzoeken')
    expect(review.reasoning).toMatch(/natuurlijk plateau/i)
    expect(review.action).toMatch(/Niet allebei/i)
  })
})

describe('regressies uit de visuele controle', () => {
  const history = (ladderId: string, stepId: string, reps: number): SessionLog[] =>
    [1, 2].map((i) => makeSession(`2026-03-0${i}`, [makeExercise(ladderId, stepId, [makeSet({ reps, load: 0 })])]))

  it('markeert alleen skills die ook echt in het programma staan als actief', () => {
    const sessions = [
      ...history('v-pull', 'vpull-5', 9),
      ...history('v-push', 'vpush-5', 9),
      ...history('carry-core', 'carry-4', 10),
    ]
    const goals = ['Pull-up', 'Dip', 'L-sit', 'Touwklimmen', 'Muscle-up']
    const progress = progressForGoals(sessions, goals, 4)
    const active = progress.filter((p) => p.active).map((p) => p.path.goal)

    // Verticaal trekken en drukken zitten sowieso in de split.
    expect(active).toContain('Pull-up')
    expect(active).toContain('Dip')
    // Van de overige skills draaien er hooguit twee tegelijk mee.
    const extras = active.filter((g) => !['Pull-up', 'Dip'].includes(g))
    expect(extras.length).toBeLessThanOrEqual(2)
    // Wat niet meedraait is wel vrijgegeven, maar staat niet in het programma.
    const muscleUp = progress.find((p) => p.path.goal === 'Muscle-up')!
    if (!muscleUp.active) expect(muscleUp.unlocked).toBe(true)
  })

  it('bundelt brede stilstand tot één melding in plaats van acht identieke', async () => {
    const { plateauAlerts } = await import('../triggers')
    const ladders = ['squat', 'hinge', 'h-push', 'h-pull', 'carry-core']
    const steps = ['squat-3', 'hinge-3', 'push-3', 'pull-2', 'carry-3']
    const sessions = [0, 1, 2, 3].map((i) =>
      makeSession(
        `2026-04-0${i + 1}`,
        ladders.map((ladderId, j) => makeExercise(ladderId, steps[j], [makeSet({ reps: 9, load: 50 })])),
      ),
    )
    const alerts = plateauAlerts(sessions)
    expect(alerts).toHaveLength(1)
    expect(alerts[0].id).toBe('plateau-breed')
    expect(alerts[0].title).toMatch(/tegelijk stil/)
  })

  it('houdt één stilstaande oefening een losse melding', () => {
    const sessions = [0, 1, 2, 3].map((i) =>
      makeSession(`2026-04-0${i + 1}`, [
        makeExercise('squat', 'squat-3', [makeSet({ reps: 9, load: 50 })]),
        makeExercise('h-pull', 'pull-2', [makeSet({ reps: 9 + i, load: 30 + i * 5 })]),
      ]),
    )
    return import('../triggers').then(({ plateauAlerts }) => {
      const alerts = plateauAlerts(sessions)
      expect(alerts).toHaveLength(1)
      expect(alerts[0].subject).toBe('squat')
    })
  })
})
