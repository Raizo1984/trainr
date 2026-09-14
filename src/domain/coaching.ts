/**
 * Coachingmomenten (sectie 7.1) en de maandrapportage (sectie 6.2).
 *
 * Toon: direct, eerlijk, zonder opsmuk. Elk bericht bevat een waarneming,
 * een interpretatie en één concrete actie. Geen generieke motivatie
 * (sectie 12, factor 4).
 */

import type { AppState, CoachAlert, Measurement, PhaseDefinition, SessionLog } from './types'
import {
  adherence,
  average,
  lastNDays,
  peakPain,
  round1,
  todayIso,
  weeklyVolume,
} from './analytics'
import { getLadder } from './exercises'
import { decideProgression, heaviestLoad, workingSets } from './rule'
import { evaluateGate } from './gates'
import { DEFAULT_SAFETY } from './risk'
import { weightTrendPerWeek } from './nutrition'

export interface WeeklyCheckIn {
  headline: string
  observations: string[]
  tip: string
  question: string
}

/** Moment 1: wekelijkse check-in. */
export function weeklyCheckIn(
  state: AppState,
  phase: PhaseDefinition,
  weeksElapsed: number,
): WeeklyCheckIn | null {
  const week = lastNDays(state.sessions, 7)
  if (week.length === 0) {
    const { ratio } = adherence(state.sessions, phase.sessionsPerWeek, weeksElapsed)
    return {
      headline: 'Geen sessies deze week',
      observations: [
        state.sessions.length === 0
          ? 'Er staat nog niets in je log. Beginnen is de enige stap die niet uit te stellen valt.'
          : `Je totale opkomst staat op ${Math.round(ratio * 100)}%.`,
      ],
      tip: 'Plan de eerstvolgende sessie op een vast tijdstip in je agenda. Een afspraak met jezelf wint het van een voornemen.',
      question: 'Wat zit er deze week in de weg: tijd, energie of motivatie?',
    }
  }

  const observations: string[] = []
  let improved = 0
  let total = 0

  for (const session of week) {
    for (const exercise of session.exercises) {
      if (exercise.planned.sets === 0) continue
      const previous = state.sessions
        .filter((s) => s.date < session.date)
        .flatMap((s) => s.exercises.filter((e) => e.ladderId === exercise.ladderId))
        .slice(-1)[0]
      if (!previous) continue
      total++
      const before = heaviestLoad(previous) * 10 + Math.max(...workingSets(previous).map((s) => s.reps), 0)
      const after = heaviestLoad(exercise) * 10 + Math.max(...workingSets(exercise).map((s) => s.reps), 0)
      if (after > before) improved++
    }
  }

  observations.push(`${week.length} ${week.length === 1 ? 'sessie' : 'sessies'} afgerond.`)
  if (total > 0) observations.push(`Vooruitgang op ${improved} van ${total} oefeningen ten opzichte van de vorige keer.`)

  const sleep = average(week.map((s) => s.vitals.sleepQuality))
  const energy = average(week.map((s) => s.vitals.energy))
  if (sleep !== null) observations.push(`Slaap gemiddeld ${round1(sleep)}/5, energie ${round1(energy ?? 0)}/5.`)

  const worstPain = Math.max(...week.map(peakPain), 0)
  if (worstPain > 0) observations.push(`Hoogste pijnwaarde deze week: ${worstPain}/10.`)

  // Eén tip, afgeleid van het meest concrete probleem in de week.
  let tip = 'Blijf op dezelfde belasting tot alle sets de bovenkant van het bereik halen. Dat is de hele regel.'
  const flagged = week
    .flatMap((session) =>
      session.exercises.map((exercise) => ({
        exercise,
        decision: decideProgression({ log: exercise, isDeload: session.isDeload, safety: state.risk?.safety ?? DEFAULT_SAFETY }),
      })),
    )
    .filter((x) => x.decision.flagged)
  if (flagged.length > 0) {
    const first = flagged[0]
    tip = `${getLadder(first.exercise.ladderId).name}: ${first.decision.reason}`
  } else if (worstPain >= 3) {
    tip = 'Vul de 24-uursreactie in op de sessies met pijn. Die reactie bepaalt de volgende sessie, niet hoe het voelde tijdens het trainen.'
  } else if (sleep !== null && sleep < 3) {
    tip = 'Slaap staat onder de 3/5. Dat begrenst wat trainen kan opleveren. Volume verhogen heeft nu weinig zin.'
  }

  return {
    headline:
      improved > 0 && total > 0
        ? `Goede week. Vooruit op ${improved} van ${total} oefeningen.`
        : 'Week afgerond. Consistentie telt zwaarder dan het resultaat van één week.',
    observations,
    tip,
    question: 'Zijn slaap en energie stabiel? Is er iets waar je tegenaan loopt?',
  }
}

export interface MonthlyRecap {
  period: string
  performance: string[]
  structure: string[]
  subjective: string[]
  interpretation: string
  focus: string
  wins: string[]
}

/** Moment 8: maandrapport (secties 6.2 en 7.1). */
export function monthlyRecap(state: AppState, phase: PhaseDefinition): MonthlyRecap | null {
  const month = lastNDays(state.sessions, 30)
  if (month.length === 0) return null

  const measurements = state.measurements.slice().sort((a, b) => a.date.localeCompare(b.date))
  const latest: Measurement | undefined = measurements[measurements.length - 1]
  const previous: Measurement | undefined = measurements[measurements.length - 2]

  const performance: string[] = []
  const volumes = weeklyVolume(month)
  if (volumes.length >= 2) {
    const first = volumes[0].volume
    const last = volumes[volumes.length - 1].volume
    const delta = first > 0 ? Math.round(((last - first) / first) * 100) : 0
    performance.push(`Weekvolume ${delta >= 0 ? '+' : ''}${delta}% over de maand.`)
  }
  performance.push(`${month.length} sessies, ${month.reduce((t, s) => t + s.exercises.length, 0)} oefeningen gelogd.`)
  if (latest?.pushUpMax != null) {
    const before = previous?.pushUpMax
    performance.push(
      before != null
        ? `Push-ups: ${before} naar ${latest.pushUpMax} reps.`
        : `Push-ups: ${latest.pushUpMax} reps (nulmeting).`,
    )
  }
  if (latest?.pullUpMax != null) {
    const before = previous?.pullUpMax
    performance.push(
      before != null ? `Pull-ups: ${before} naar ${latest.pullUpMax}.` : `Pull-ups: ${latest.pullUpMax}.`,
    )
  }

  const structure: string[] = []
  const weightTrend = weightTrendPerWeek(state.nutritionDays)
  if (latest?.weightKg != null && previous?.weightKg != null) {
    structure.push(`Gewicht: ${previous.weightKg} naar ${latest.weightKg} kg.`)
  } else if (weightTrend !== null) {
    structure.push(`Gewichtstrend: ${weightTrend >= 0 ? '+' : ''}${weightTrend} kg per week.`)
  }
  if (latest?.waistCm != null && previous?.waistCm != null) {
    structure.push(`Taille: ${previous.waistCm} naar ${latest.waistCm} cm.`)
  }
  if (latest?.restingHr != null && previous?.restingHr != null) {
    structure.push(`Rusthartslag: ${previous.restingHr} naar ${latest.restingHr} slagen per minuut.`)
  }

  const subjective: string[] = []
  const pain = average(month.map(peakPain))
  const energy = average(month.map((s) => s.vitals.energy))
  const sleep = average(month.map((s) => s.vitals.sleepQuality))
  const { ratio } = adherence(month, phase.sessionsPerWeek, 4.3)
  if (pain !== null) subjective.push(`Pijn gemiddeld ${round1(pain)}/10.`)
  if (energy !== null) subjective.push(`Energie ${round1(energy)}/5, slaap ${round1(sleep ?? 0)}/5.`)
  subjective.push(`Opkomst ${Math.round(ratio * 100)}%.`)

  // Interpretatie: recompositie, opbouw of stilstand.
  let interpretation = 'Stabiele maand. Belasting loopt op zonder dat pijn of herstel inlevert.'
  const waistDown = latest?.waistCm != null && previous?.waistCm != null && latest.waistCm < previous.waistCm
  const repsUp = latest?.pushUpMax != null && previous?.pushUpMax != null && latest.pushUpMax > previous.pushUpMax
  if (waistDown && repsUp) {
    interpretation = 'Recompositie: omvang omlaag terwijl prestatie omhoog gaat. Dat is de gunstigste combinatie die er is.'
  } else if (weightTrend !== null && weightTrend > 0.2 && weightTrend < 0.6 && repsUp) {
    interpretation = 'Gecontroleerde opbouw: gewicht stijgt in het juiste tempo en de prestatie volgt.'
  } else if (pain !== null && pain >= 3) {
    interpretation = 'Pijn is de bepalende factor deze maand. Volume komt pas weer aan bod als dat zakt.'
  } else if (ratio < 0.7) {
    interpretation = 'Opkomst is de beperkende factor, niet het programma. Dat is goed nieuws, want dat is oplosbaar.'
  }

  const gate = evaluateGate(state, phase, Math.max(1, Math.round(state.sessions.length / phase.sessionsPerWeek)))
  const weakest = gate.criteria.find((c) => c.status === 'rood') ?? gate.criteria.find((c) => c.status === 'geel')
  const focus = weakest
    ? `${weakest.label}: ${weakest.requirement}.`
    : 'Doorgaan op dezelfde regel. Eén goede rep per set erbij is genoeg.'

  const wins: string[] = []
  if (ratio >= 0.8) wins.push(`Je haalde ${Math.round(ratio * 100)}% van je sessies. Dat is de basis waar alles op rust.`)
  if (pain !== null && pain <= 2) wins.push('Pijn bleef binnen de marge. Je lichaam verdraagt de belasting.')
  if (repsUp && latest?.pushUpMax != null && previous?.pushUpMax != null) {
    wins.push(`Push-ups van ${previous.pushUpMax} naar ${latest.pushUpMax}. Dat is meetbaar sterker.`)
  }
  if (wins.length === 0) wins.push('Je hebt deze maand gelogd wat er gebeurde. Zonder data is coachen gokken.')

  return {
    period: `Laatste 30 dagen tot ${todayIso()}`,
    performance,
    structure,
    subjective,
    interpretation,
    focus,
    wins,
  }
}

/** Moment 7: fase-overgang aankondigen. */
export function phaseTransitionAlert(state: AppState, phase: PhaseDefinition, weeksInPhase: number): CoachAlert | null {
  const gate = evaluateGate(state, phase, weeksInPhase)
  if (gate.decision !== 'doorstromen') return null
  return {
    id: `gate-${phase.id}`,
    code: 'fase-gate',
    severity: 'info',
    title: `${phase.name} is afgerond`,
    body: `Alle criteria staan groen na ${weeksInPhase} weken. ${gate.summary}`,
    action: 'Bekijk de gate en zet de overgang in gang wanneer je er klaar voor bent.',
    source: 'Sectie 6.4',
    createdAt: todayIso(),
  }
}

/** Moment 5: vorm-check inplannen op basis van de veiligheidsinstellingen. */
export function formCheckDue(sessions: SessionLog[], everyNSessions: number): boolean {
  if (sessions.length === 0) return false
  return sessions.length % everyNSessions === 0
}
