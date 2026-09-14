/**
 * De samenvatting die de coach te zien krijgt.
 *
 * Bewust een samenvatting en geen volledige dump. Twee redenen: sectie 8.2
 * schrijft voor dat er niet meer data wordt verzameld dan de coaching nodig
 * heeft, en elke overbodige regel kost tokens zonder het advies beter te maken.
 *
 * Wat er níet in staat: naam, geboortejaar, vrije tekstvelden uit de intake en
 * losse notities. De coach heeft die niet nodig om over belasting te oordelen.
 */

import type { AppState, PhaseDefinition, SessionLog } from './types'
import { REGION_LABEL } from './types'
import { adherence, average, historyFor, peakPain, round1, weeklyJointSets, weeklyVolume } from './analytics'
import { getLadder, getStep } from './exercises'
import { heaviestLoad, minFormQuality, workingSets } from './rule'
import { proteinAverage, weightTrendPerWeek } from './nutrition'
import { blockPlan } from './blocks'
import { weeksUntilDeload } from './program'
import { DEFAULT_SAFETY } from './risk'
import { summarise } from './movement'
import { describeAdjustment } from './adapt'

export interface CoachContext {
  fase: string
  faseWeek: number
  blok: string
  deloadOver: number
  risico: string
  voedingsmodel: string
  medischePauze: string | null
  opkomst: string
  oefeningen: Array<{
    lader: string
    ladderId: string
    trede: string
    laatsteBelasting: string
    laatsteReps: string
    hoogstePijn: number
    techniek: number
    sessies: number
  }>
  pijnPerGebied: Record<string, number>
  volumePerWeek: Array<{ week: string; sets: number }>
  gewrichtsbelasting: Record<string, number>
  voeding: {
    eiwitGemiddeld: number | null
    eiwitOndergrens: number
    gewichtstrendPerWeek: number | null
    maaltijdenOnderNorm: number
    verboden: string[]
  }
  herstel: { slaap: number | null; energie: number | null; stress: number | null }
  bewegingskwaliteit: string
  actieveAanpassingen: string[]
  droomdoelen: string[]
  /** Regels die het model niet mag overtreden, nog eens expliciet bij de data. */
  grenzen: string[]
}

function recentSessions(sessions: SessionLog[], count: number): SessionLog[] {
  return sessions.slice().sort((a, b) => a.date.localeCompare(b.date)).slice(-count)
}

export function buildCoachContext(
  state: AppState,
  phase: PhaseDefinition,
  phaseWeek: number,
  proteinMin: number,
  minMeals: number,
  prohibited: string[],
): CoachContext {
  const phaseSessions = state.sessions.filter((s) => s.phase === phase.id)
  const recent = recentSessions(state.sessions, 12)
  const plan = blockPlan(phase.id, phaseWeek, state.phase.blockFocus)
  const { done, planned, ratio } = adherence(phaseSessions, phase.sessionsPerWeek, phaseWeek)
  const highRisk = state.risk?.nutritionModel === 'hoog-risico'

  const ladderIds = [...new Set(recent.flatMap((s) => s.exercises.map((e) => e.ladderId)))]
  const oefeningen = ladderIds.map((ladderId) => {
    const history = historyFor(state.sessions, ladderId)
    const last = history[history.length - 1]?.log
    const pains = history.slice(-4).flatMap(({ log }) => workingSets(log).map((s) => s.pain))
    const forms = history.slice(-3).map(({ log }) => minFormQuality(log))
    const step = last ? getStep(last.stepId) : null
    return {
      lader: getLadder(ladderId).name,
      ladderId,
      trede: step ? step.name : 'onbekend',
      laatsteBelasting: last && heaviestLoad(last) > 0 ? `${heaviestLoad(last)} kg` : 'lichaamsgewicht',
      laatsteReps: last ? workingSets(last).map((s) => s.reps).join('-') : '',
      hoogstePijn: Math.max(0, ...pains),
      techniek: forms.length > 0 ? round1(average(forms) ?? 5) : 5,
      sessies: history.length,
    }
  })

  const pijnPerGebied: Record<string, number> = {}
  for (const session of recent) {
    for (const exercise of session.exercises) {
      for (const set of workingSets(exercise)) {
        if (set.painRegion && set.pain > (pijnPerGebied[REGION_LABEL[set.painRegion]] ?? 0)) {
          pijnPerGebied[REGION_LABEL[set.painRegion]] = set.pain
        }
      }
    }
  }

  const lowMealDays = state.nutritionDays.slice(-7).filter((d) => d.meals > 0 && d.meals < minMeals).length

  const grenzen = [
    'Pijn van 5 of hoger: nooit meer belasting voorstellen.',
    'Deloadweken worden niet overgeslagen of uitgesteld.',
    'Eén aanpassing per keer, nooit twee variabelen tegelijk.',
  ]
  if (highRisk) {
    grenzen.push(
      'Beschermend voedingsmodel actief: geen calorieën, geen eetvensters, geen vasten, geen gewichtsdoel. Ook niet op verzoek.',
    )
  }
  if (state.medicalHold?.active) {
    grenzen.push('Medische pauze actief: geen enkele programmawijziging voorstellen, wel doorverwijzen.')
  }

  return {
    fase: phase.name,
    faseWeek: phaseWeek,
    blok: plan.title,
    // Hergebruikt dezelfde teller als het programma zelf: een eigen berekening
    // hier zou vroeg of laat uit de pas gaan lopen met het echte schema.
    deloadOver: weeksUntilDeload(phaseWeek, state.risk?.safety ?? DEFAULT_SAFETY),
    risico: state.risk?.level ?? 'onbekend',
    voedingsmodel: highRisk ? 'beschermend' : 'standaard',
    medischePauze: state.medicalHold?.active ? state.medicalHold.reason : null,
    opkomst: `${done} van ${planned} sessies (${Math.round(ratio * 100)}%)`,
    oefeningen,
    pijnPerGebied,
    volumePerWeek: weeklyVolume(state.sessions).slice(-6).map((w) => ({ week: w.week, sets: w.sets })),
    gewrichtsbelasting: weeklyJointSets(state.sessions),
    voeding: {
      eiwitGemiddeld: proteinAverage(state.nutritionDays),
      eiwitOndergrens: proteinMin,
      gewichtstrendPerWeek: weightTrendPerWeek(state.nutritionDays),
      maaltijdenOnderNorm: lowMealDays,
      verboden: prohibited,
    },
    herstel: {
      slaap: recent.length > 0 ? round1(average(recent.map((s) => s.vitals.sleepQuality)) ?? 0) : null,
      energie: recent.length > 0 ? round1(average(recent.map((s) => s.vitals.energy)) ?? 0) : null,
      stress: recent.length > 0 ? round1(average(recent.map((s) => s.vitals.stress)) ?? 0) : null,
    },
    bewegingskwaliteit: summarise(state.movementAssessments[state.movementAssessments.length - 1] ?? null).verdict,
    actieveAanpassingen: state.adjustments.filter((a) => a.accepted).map(describeAdjustment),
    droomdoelen: state.intake.goals.dreamGoals,
    grenzen,
  }
}

/** Hoogste pijnwaarde over de meegestuurde sessies, voor de snelle check. */
export function contextPeakPain(state: AppState): number {
  return Math.max(0, ...recentSessions(state.sessions, 12).map(peakPain))
}
