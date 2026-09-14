import { describe, expect, it } from 'vitest'
import {
  conservativeStartLoad,
  decideProgression,
  exerciseVolume,
  reachedTopOfRange,
  roundLoad,
  roundLoadDown,
} from '../rule'
import { DEFAULT_SAFETY } from '../risk'
import type { ExerciseLog, SafetySettings, SetEntry } from '../types'

const safety: SafetySettings = DEFAULT_SAFETY

function set(partial: Partial<SetEntry> & { reps: number }): SetEntry {
  return {
    setIndex: 0,
    load: 40,
    rir: 3,
    pain: 0,
    painRegion: null,
    formQuality: 5,
    ...partial,
  }
}

function log(sets: SetEntry[], overrides: Partial<ExerciseLog> = {}): ExerciseLog {
  return {
    ladderId: 'squat',
    stepId: 'squat-3',
    planned: { sets: 3, repMin: 8, repMax: 12, targetRir: 3 },
    sets: sets.map((s, i) => ({ ...s, setIndex: i })),
    ...overrides,
  }
}

describe('The Rule — basisgedrag', () => {
  it('houdt belasting gelijk en vraagt om meer reps als het bereik niet vol is', () => {
    const d = decideProgression({ log: log([set({ reps: 9 }), set({ reps: 9 }), set({ reps: 8 })]), isDeload: false, safety })
    expect(d.action).toBe('reps-toevoegen')
    expect(d.next.load).toBe(40)
    expect(d.next.repMin).toBe(8)
    expect(d.flagged).toBe(false)
  })

  it('verhoogt de belasting pas als ALLE sets de bovenkant halen', () => {
    const notAll = decideProgression({ log: log([set({ reps: 12 }), set({ reps: 12 }), set({ reps: 11 })]), isDeload: false, safety })
    expect(notAll.action).toBe('reps-toevoegen')

    const all = decideProgression({ log: log([set({ reps: 12 }), set({ reps: 12 }), set({ reps: 12 })]), isDeload: false, safety })
    expect(all.action).toBe('belasting-verhogen')
    expect(all.next.load).toBeGreaterThan(40)
    expect(all.next.repMin).toBe(8)
  })

  it('telt een onvolledige sessie niet als bovenkant bereikt', () => {
    expect(reachedTopOfRange(log([set({ reps: 12 }), set({ reps: 12 })]))).toBe(false)
  })

  it('gebruikt de kleinste stap uit de veiligheidsinstellingen', () => {
    const conservative = { ...safety, loadStepPct: 2.5 }
    const d = decideProgression({
      log: log([set({ reps: 12, load: 100 }), set({ reps: 12, load: 100 }), set({ reps: 12, load: 100 })]),
      isDeload: false,
      safety: conservative,
    })
    expect(d.next.load).toBe(102.5)
  })
})

describe('The Rule — veiligheid gaat voor progressie', () => {
  it('pauzeert bij pijn 5 of hoger en zet een trede terug', () => {
    const d = decideProgression({
      log: log([set({ reps: 12 }), set({ reps: 12 }), set({ reps: 12, pain: 6 })]),
      isDeload: false,
      safety,
    })
    expect(d.action).toBe('pijn-protocol')
    expect(d.next.stepId).toBe('squat-2')
    expect(d.next.load).toBe(20)
    expect(d.flagged).toBe(true)
  })

  it('laat 24-uurspijn even zwaar wegen als pijn tijdens de sessie', () => {
    const d = decideProgression({
      log: log([set({ reps: 10 }), set({ reps: 10 }), set({ reps: 10 })]),
      isDeload: false,
      safety,
      followUpPain: 6,
    })
    expect(d.action).toBe('pijn-protocol')
  })

  it('verlaagt de belasting bij pijn op de ingestelde grens', () => {
    const d = decideProgression({
      log: log([set({ reps: 10, pain: 3 }), set({ reps: 10 }), set({ reps: 10 })]),
      isDeload: false,
      safety,
    })
    expect(d.action).toBe('pijn-protocol')
    expect(d.next.load).toBe(28)
  })

  it('respecteert een strengere pijngrens voor hoog-risicogebruikers', () => {
    const strict = { ...safety, painCeiling: 2 as const }
    const d = decideProgression({
      log: log([set({ reps: 10, pain: 2 }), set({ reps: 10 }), set({ reps: 10 })]),
      isDeload: false,
      safety: strict,
    })
    expect(d.action).toBe('pijn-protocol')
  })

  it('zet techniekverlies boven repprogressie', () => {
    const d = decideProgression({
      log: log([set({ reps: 12 }), set({ reps: 12 }), set({ reps: 12, formQuality: 3 })]),
      isDeload: false,
      safety,
    })
    expect(d.action).toBe('techniek-herstellen')
    expect(d.next.load).toBe(32.5)
  })

  it('verlaagt de belasting als de laatste set te dicht bij falen zat', () => {
    const d = decideProgression({
      log: log([set({ reps: 12 }), set({ reps: 12 }), set({ reps: 12, rir: 0 })]),
      isDeload: false,
      safety,
    })
    expect(d.action).toBe('belasting-verlagen')
    expect(d.next.load).toBeLessThan(40)
  })

  it('verandert niets tijdens een deloadweek', () => {
    const d = decideProgression({
      log: log([set({ reps: 12 }), set({ reps: 12 }), set({ reps: 12 })]),
      isDeload: true,
      safety,
    })
    expect(d.action).toBe('deload-aanhouden')
    expect(d.next.load).toBe(40)
  })

  it('laat pijn voorgaan op techniek en RIR tegelijk', () => {
    const d = decideProgression({
      log: log([set({ reps: 5, pain: 7, formQuality: 2, rir: 0 })]),
      isDeload: false,
      safety,
    })
    expect(d.action).toBe('pijn-protocol')
  })
})

describe('The Rule — calisthenics via de lader', () => {
  const pushLog = (sets: SetEntry[]) =>
    log(sets, { ladderId: 'h-push', stepId: 'push-2', planned: { sets: 3, repMin: 6, repMax: 12, targetRir: 3 } })

  it('zet een trede omhoog in plaats van gewicht toe te voegen', () => {
    const d = decideProgression({
      log: pushLog([set({ reps: 12, load: 0 }), set({ reps: 12, load: 0 }), set({ reps: 12, load: 0 })]),
      isDeload: false,
      safety,
    })
    expect(d.action).toBe('trede-omhoog')
    expect(d.next.stepId).toBe('push-3')
    expect(d.next.load).toBe(0)
    expect(d.next.repMin).toBe(6)
  })

  it('blijft op de bovenste trede staan als de lader op is', () => {
    const d = decideProgression({
      log: log([set({ reps: 12 }), set({ reps: 12 }), set({ reps: 12 })], {
        ladderId: 'tibialis',
        stepId: 'tib-1',
        planned: { sets: 3, repMin: 8, repMax: 12, targetRir: 3 },
      }),
      isDeload: false,
      safety,
    })
    expect(d.action).toBe('reps-toevoegen')
  })
})

describe('hulpfuncties', () => {
  it('rondt belasting af op bestaande stappen', () => {
    expect(roundLoad(7.3)).toBe(7.5)
    expect(roundLoad(23.4)).toBe(23)
    expect(roundLoad(101.2)).toBe(100)
    expect(roundLoad(0)).toBe(0)
  })

  it('rondt elke veiligheidsverlaging naar beneden af', () => {
    expect(roundLoadDown(36.8)).toBe(35)
    expect(roundLoadDown(7.9)).toBe(7.5)
    expect(roundLoadDown(23.9)).toBe(23)
  })

  it('start conservatief op 70% van de geschatte max', () => {
    expect(conservativeStartLoad(100, safety)).toBe(70)
    expect(conservativeStartLoad(100, { ...safety, startingSetsFactor: 0.67 })).toBe(62.5)
  })

  it('berekent volume en telt bodyweight via de trede mee', () => {
    expect(exerciseVolume(log([set({ reps: 10, load: 50 }), set({ reps: 10, load: 50 })]))).toBe(1000)
    const bw = log([set({ reps: 10, load: 0 })], { ladderId: 'h-push', stepId: 'push-4' })
    expect(exerciseVolume(bw)).toBe(400)
  })
})

describe('voorschrift uit historie', () => {
  it('neemt het oordeel van The Rule over in de volgende sessie', async () => {
    const { prescribeExercise } = await import('../prescribe')
    const { makeExercise, makeSession, makeSet } = await import('./factories')
    const previous = makeSession('2026-02-01', [
      makeExercise('squat', 'squat-3', [
        makeSet({ reps: 12, load: 50 }),
        makeSet({ reps: 12, load: 50 }),
        makeSet({ reps: 12, load: 50 }),
      ]),
    ])
    const result = prescribeExercise(
      [previous],
      { ladderId: 'squat', stepId: 'squat-3', sets: 3, repMin: 8, repMax: 12, targetRir: 3 },
      safety,
    )
    expect(result.decision?.action).toBe('belasting-verhogen')
    expect(result.load).toBe(52.5)
    expect(result.lastTime).toBe('Vorige keer: 50 kg, 12-12-12 reps')
  })

  it('geeft een leeg voorschrift terug zonder historie', async () => {
    const { prescribeExercise } = await import('../prescribe')
    const result = prescribeExercise(
      [],
      { ladderId: 'squat', stepId: 'squat-1', sets: 3, repMin: 8, repMax: 12, targetRir: 3 },
      safety,
    )
    expect(result.decision).toBeNull()
    expect(result.lastTime).toBeNull()
    expect(result.stepId).toBe('squat-1')
  })
})
