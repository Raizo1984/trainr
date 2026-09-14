/**
 * Van historie naar het voorschrift van vandaag.
 *
 * De app vult zelf in wat er vorige keer gebeurde en wat The Rule daarvan vindt,
 * zodat de gebruiker alleen nog hoeft te bevestigen wat er werkelijk gebeurde
 * (sectie 4.1, vereenvoudiging voor de gebruiker).
 */

import type { PrescribedExercise, SafetySettings, SessionLog } from './types'
import { historyFor } from './analytics'
import { decideProgression, heaviestLoad, type ProgressionDecision } from './rule'
import { getStep } from './exercises'

export interface Prescription {
  ladderId: string
  stepId: string
  sets: number
  repMin: number
  repMax: number
  targetRir: number
  /** Aanbevolen belasting in kilo, of 0 bij bodyweight-progressies. */
  load: number
  /** Wat er vorige keer gebeurde, in één zin. */
  lastTime: string | null
  decision: ProgressionDecision | null
  note?: string
  fixed?: boolean
}

export function prescribeExercise(
  sessions: SessionLog[],
  planned: PrescribedExercise,
  safety: SafetySettings,
): Prescription {
  const base: Prescription = {
    ladderId: planned.ladderId,
    stepId: planned.stepId,
    sets: planned.sets,
    repMin: planned.repMin,
    repMax: planned.repMax,
    targetRir: planned.targetRir,
    load: 0,
    lastTime: null,
    decision: null,
    note: planned.note,
    fixed: planned.fixed,
  }

  const history = historyFor(sessions, planned.ladderId)
  const previous = history[history.length - 1]
  if (!previous) return base

  const decision = decideProgression({
    log: previous.log,
    isDeload: previous.session.isDeload,
    safety,
    followUpPain: previous.session.followUp?.painByRegion
      ? (Math.max(0, ...Object.values(previous.session.followUp.painByRegion).map((v) => v ?? 0)) as never)
      : undefined,
  })

  const lastLoad = heaviestLoad(previous.log)
  const lastReps = previous.log.sets.map((s) => s.reps).join('-')
  const step = getStep(previous.log.stepId)
  const lastTime =
    step.loadType === 'trede'
      ? `Vorige keer: ${step.name}, ${lastReps} reps`
      : `Vorige keer: ${lastLoad} kg, ${lastReps} reps`

  return {
    ...base,
    // Het sjabloon bepaalt sets en repbereik; The Rule bepaalt trede en belasting.
    stepId: decision.next.stepId,
    load: decision.next.load,
    repMin: decision.next.repMin,
    repMax: decision.next.repMax,
    lastTime,
    decision,
  }
}

export function prescribeSession(
  sessions: SessionLog[],
  planned: PrescribedExercise[],
  safety: SafetySettings,
): Prescription[] {
  return planned.map((exercise) => prescribeExercise(sessions, exercise, safety))
}
