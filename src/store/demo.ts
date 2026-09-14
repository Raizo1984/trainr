/**
 * Demo-dataset: veertien weken fase 1 van een gebruiker met knieklachten in de
 * voorgeschiedenis en een verhoogd voedingsrisico. Bedoeld om de app met
 * realistische data te kunnen beoordelen, niet als echte gebruikersdata.
 *
 * De data bevat bewust een paar oncomfortabele patronen: een pijnpiek in week 5,
 * een plateau op de horizontale push en een week met lage opkomst. Zo is te zien
 * of de signalering doet wat ze belooft.
 */

import type { AppState, ExerciseLog, Measurement, NutritionDay, SessionLog, SetEntry } from '@/domain/types'
import { emptyIntake, emptyState } from '@/domain/defaults'
import { assessRisk } from '@/domain/risk'
import { addDays, todayIso } from '@/domain/analytics'
import { buildTemplates, isDeloadWeek } from '@/domain/program'

const WEEKS = 14
const SESSIONS_PER_WEEK = 3

function clampPain(value: number): SetEntry['pain'] {
  return Math.max(0, Math.min(10, Math.round(value))) as SetEntry['pain']
}

function clamp5(value: number): 1 | 2 | 3 | 4 | 5 {
  return Math.max(1, Math.min(5, Math.round(value))) as 1 | 2 | 3 | 4 | 5
}

/** Deterministische pseudo-ruis, zodat de demo tussen sessies identiek blijft. */
function noise(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

function demoIntake() {
  const intake = emptyIntake()
  intake.name = 'Demo'
  intake.birthYear = 1983
  intake.heightCm = 182
  intake.medical.previousInjuries = 'Knieklachten links sinds 2019, geen diagnose gesteld.'
  intake.medical.lastCheckup = 'Huisarts, voorjaar 2026'
  intake.training.level = 'beginner'
  intake.training.sportHistory = 'Voetbal tot 2008, daarna onregelmatig gesport.'
  intake.training.complaints = [
    {
      region: 'knie-links',
      intensity: 3,
      character: 'mechanisch',
      course: 'chronisch',
      worseWhen: 'Traplopen naar beneden en lang zitten',
      reaction24h: 'gelijk',
    },
  ]
  intake.training.equipment = ['sportschool', 'halters', 'machines', 'pull-up-bar', 'banden']
  intake.training.sessionsPerWeek = 3
  intake.training.sessionMinutes = 60
  intake.nutrition.weightCurrentKg = 84
  intake.nutrition.weightLowestKg = 71
  intake.nutrition.weightHighestKg = 96
  intake.nutrition.yoyo = true
  intake.nutrition.extremePatterns = true
  intake.nutrition.mealsPerDay = 2
  intake.nutrition.focus = 'spier'
  intake.goals.vision48m = 'Tien strakke pull-ups, pijnvrij traplopen en er over vier jaar sterker uitzien dan nu.'
  intake.goals.primary = 'spiermassa'
  intake.goals.secondary = ['Pijnvrije knie', 'Zichtbaar sterker worden']
  intake.goals.dreamGoals = ['Pull-up', 'Dip', 'Touwklimmen']
  intake.goals.hardNo = 'Geen crashdiëten meer. Nooit meer vasten.'
  intake.goals.learningStyle = 'direct'
  intake.lifestyle.sleepHours = 7
  intake.lifestyle.sleepQuality = 3
  intake.lifestyle.stress = 6
  intake.lifestyle.dailyActivity = 'zittend'
  intake.lifestyle.householdSupport = 'Gezin met twee kinderen, eten samen.'
  intake.completedAt = new Date(Date.parse(addDays(todayIso(), -WEEKS * 7 - 14))).toISOString()
  return intake
}

export function buildDemoState(): AppState {
  const intake = demoIntake()
  const risk = assessRisk(intake)
  const start = addDays(todayIso(), -(WEEKS * 7) + 1)

  const sessions: SessionLog[] = []
  let sessionIndex = 0

  for (let week = 1; week <= WEEKS; week++) {
    const deload = isDeloadWeek(week, risk.safety)
    // Week 9 loopt bewust slecht: één sessie, zodat de opkomstmelding zichtbaar wordt.
    const count = week === 9 ? 1 : deload ? SESSIONS_PER_WEEK : SESSIONS_PER_WEEK
    const [template] = buildTemplates({
      phase: 1,
      equipment: intake.training.equipment,
      safety: risk.safety,
      week,
    })

    for (let s = 0; s < count; s++) {
      sessionIndex++
      const date = addDays(start, (week - 1) * 7 + s * 2)
      if (date > todayIso()) continue

      const exercises: ExerciseLog[] = template.main.map((prescribed, exerciseIndex) => {
        const seed = sessionIndex * 10 + exerciseIndex
        // Belasting loopt op met de weken; de horizontale push blijft bewust hangen.
        const plateau = prescribed.ladderId === 'h-push' && week >= 8
        const progression = plateau ? 7 : Math.min(week, 12)
        const baseLoad = prescribed.ladderId === 'carry-core' ? 16 : 20
        const load = deload
          ? baseLoad + progression * 2.5
          : baseLoad + progression * 2.5

        const repBase = prescribed.repMin + Math.min(3, Math.floor(progression / 3))
        const setCount = deload ? Math.max(1, Math.ceil(prescribed.sets / 2)) : prescribed.sets

        // Kniepijn piekt in week 5 op de squat en zakt daarna weer weg.
        const kneePain =
          prescribed.ladderId === 'squat'
            ? week === 5
              ? 5
              : week < 5
                ? 3 - Math.floor(week / 3)
                : Math.max(0, 3 - Math.floor((week - 5) / 2))
            : 0

        const sets: SetEntry[] = Array.from({ length: setCount }, (_, i) => ({
          setIndex: i,
          reps: Math.min(prescribed.repMax, repBase + (noise(seed + i) > 0.6 ? 1 : 0)),
          load: prescribed.ladderId === 'h-push' ? 0 : load,
          rir: deload ? 4 : noise(seed + i * 3) > 0.85 ? 1 : 3,
          pain: clampPain(kneePain),
          painRegion: kneePain > 0 ? 'knie-links' : null,
          formQuality: clamp5(week < 3 ? 3 + noise(seed) : 4 + (noise(seed) > 0.7 ? 1 : 0)),
        }))

        return {
          ladderId: prescribed.ladderId,
          stepId: prescribed.stepId,
          planned: {
            sets: prescribed.sets,
            repMin: prescribed.repMin,
            repMax: prescribed.repMax,
            targetRir: prescribed.targetRir,
          },
          sets,
        }
      })

      const worstPain = Math.max(...exercises.flatMap((e) => e.sets.map((set) => set.pain)))

      sessions.push({
        id: `demo-${sessionIndex}`,
        date,
        templateId: template.id,
        phase: 1,
        phaseWeek: week,
        isDeload: deload,
        durationMinutes: 52 + Math.round(noise(sessionIndex) * 14),
        vitals: {
          sleepQuality: clamp5(3 + noise(sessionIndex) * 2),
          energy: clamp5(3 + noise(sessionIndex * 2) * 2),
          stress: clamp5(2 + noise(sessionIndex * 3) * 2),
        },
        exercises,
        post: {
          painByRegion: worstPain > 0 ? { 'knie-links': clampPain(worstPain) } : {},
          fatigue: clamp5(3 + noise(sessionIndex * 5)),
        },
        followUp: {
          soreness: clamp5(2 + noise(sessionIndex * 7) * 2),
          painByRegion: worstPain > 0 ? { 'knie-links': clampPain(worstPain - 1) } : {},
          sleepQuality: clamp5(3 + noise(sessionIndex * 11)),
          recordedAt: addDays(date, 1),
        },
        completedAt: `${date}T18:30:00.000Z`,
      })
    }
  }

  const measurements: Measurement[] = Array.from({ length: 4 }, (_, i) => {
    const date = addDays(start, i * 28)
    return {
      id: `demo-m-${i}`,
      date,
      weightKg: 84 + i * 0.6,
      restingHr: 64 - i,
      waistCm: 92 - i * 0.8,
      hipCm: 101,
      chestCm: 103 + i * 0.5,
      pushUpMax: 12 + i * 4,
      pullUpMax: i === 0 ? 0 : i,
      carryMeters: 30 + i * 8,
      painAverage: Math.max(0, 3 - i * 0.7),
      energyAverage: 3.2 + i * 0.2,
      sleepAverage: 3.4,
      isBaseline: i === 0,
      note: i === 0 ? 'Nulmeting, submaximaal uitgevoerd.' : undefined,
    }
  }).filter((m) => m.date <= todayIso())

  const nutritionDays: NutritionDay[] = Array.from({ length: 42 }, (_, i) => {
    const date = addDays(todayIso(), -41 + i)
    const protein = 118 + Math.round(noise(i) * 30)
    return {
      date,
      proteinG: protein,
      meals: noise(i * 3) > 0.85 ? 2 : 3,
      weightKg: 84 + i * 0.02 + noise(i * 5) * 0.4,
      energy: clamp5(3 + noise(i * 7) * 2),
      note: i === 38 ? 'Overwogen om even strenger te gaan eten.' : undefined,
    }
  })

  return {
    ...emptyState(),
    intake,
    risk,
    phase: {
      current: 1,
      startedAt: start,
      confirmations: { medisch: true, voeding: true },
      history: [{ phase: 0, from: addDays(start, -21), to: start }],
    },
    sessions,
    measurements,
    nutritionDays,
  }
}
