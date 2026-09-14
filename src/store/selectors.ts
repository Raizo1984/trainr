/**
 * Afgeleide waarden. Alles wat de UI toont wordt hier één keer berekend,
 * zodat schermen geen eigen interpretatie van de regels maken.
 */

import { useMemo } from 'react'
import { useAppStore } from './useAppStore'
import type { CoachAlert, NutritionPlan, SessionTemplate } from '@/domain/types'
import { getPhase } from '@/domain/phases'
import { applyDeload, buildTemplates, isDeloadWeek, weeksUntilDeload } from '@/domain/program'
import { DEFAULT_SAFETY } from '@/domain/risk'
import { adherence, daysBetween, lastNDays, todayIso } from '@/domain/analytics'
import { evaluateTriggers, strengthDeclining } from '@/domain/triggers'
import { evaluateGate } from '@/domain/gates'
import { buildNutritionPlan, evaluateNutrition } from '@/domain/nutrition'
import { monthlyRecap, weeklyCheckIn } from '@/domain/coaching'
import { blockPlan } from '@/domain/blocks'
import { reviewBlock } from '@/domain/blockReview'
import { activeSkillLadders, progressForGoals } from '@/domain/skills'

export function useSafety() {
  return useAppStore((s) => s.risk?.safety ?? DEFAULT_SAFETY)
}

/** Weken sinds de start van de huidige fase, 1-based. */
export function usePhaseWeek(): number {
  const startedAt = useAppStore((s) => s.phase.startedAt)
  return useMemo(() => Math.max(1, Math.floor(daysBetween(startedAt, todayIso()) / 7) + 1), [startedAt])
}

export function useCurrentPhase() {
  const id = useAppStore((s) => s.phase.current)
  return useMemo(() => getPhase(id), [id])
}

export function useBlockPlan() {
  const phaseId = useAppStore((s) => s.phase.current)
  const focus = useAppStore((s) => s.phase.blockFocus)
  const week = usePhaseWeek()
  return useMemo(() => blockPlan(phaseId, week, focus), [phaseId, week, focus])
}

/** Droomdoelen met hun route en voortgang. */
export function useSkillProgress() {
  const sessions = useAppStore((s) => s.sessions)
  const goals = useAppStore((s) => s.intake.goals.dreamGoals)
  const phaseId = useAppStore((s) => s.phase.current)
  return useMemo(() => progressForGoals(sessions, goals, phaseId), [sessions, goals, phaseId])
}

export function useTemplates(): SessionTemplate[] {
  const equipment = useAppStore((s) => s.intake.training.equipment)
  const phaseId = useAppStore((s) => s.phase.current)
  const goals = useAppStore((s) => s.intake.goals.dreamGoals)
  const sessions = useAppStore((s) => s.sessions)
  const focus = useAppStore((s) => s.phase.blockFocus)
  const safety = useSafety()
  const week = usePhaseWeek()

  return useMemo(() => {
    const skills = activeSkillLadders(sessions, goals, phaseId)
    const templates = buildTemplates({ phase: phaseId, equipment, safety, week, skills, focus })
    return isDeloadWeek(week, safety) ? templates.map(applyDeload) : templates
  }, [phaseId, equipment, safety, week, sessions, goals, focus])
}

/**
 * Blokevaluatie, alleen in de deloadweek. Buiten die week is een blok nog niet
 * af en zegt de vergelijking niets (sectie 6.3).
 */
export function useBlockReview() {
  const sessions = useAppStore((s) => s.sessions)
  const phase = useCurrentPhase()
  const plan = useBlockPlan()
  const deload = useDeloadInfo()
  return useMemo(
    () => (deload.isDeload ? reviewBlock(sessions.filter((s) => s.phase === phase.id), phase, plan.lengthWeeks) : null),
    [sessions, phase, plan.lengthWeeks, deload.isDeload],
  )
}

export function useDeloadInfo() {
  const safety = useSafety()
  const week = usePhaseWeek()
  return useMemo(
    () => ({ isDeload: isDeloadWeek(week, safety), weeksUntil: weeksUntilDeload(week, safety), week }),
    [safety, week],
  )
}

export function useNutritionPlan(): NutritionPlan {
  const intake = useAppStore((s) => s.intake)
  const model = useAppStore((s) => s.risk?.nutritionModel ?? 'laag-risico')
  return useMemo(() => buildNutritionPlan(intake, model), [intake, model])
}

export function useNutritionAlerts() {
  const plan = useNutritionPlan()
  const days = useAppStore((s) => s.nutritionDays)
  const sessions = useAppStore((s) => s.sessions)
  const phaseId = useAppStore((s) => s.phase.current)
  return useMemo(
    () =>
      evaluateNutrition(plan, days, {
        strengthDeclining: strengthDeclining(sessions),
        phaseIsBuilding: phaseId >= 1,
      }),
    [plan, days, sessions, phaseId],
  )
}

export function useAlerts(): CoachAlert[] {
  const state = useAppStore()
  const phase = useCurrentPhase()
  const week = usePhaseWeek()
  const safety = useSafety()

  return useMemo(
    () =>
      evaluateTriggers({
        sessions: state.sessions,
        phase,
        phaseWeek: week,
        weeksElapsed: week,
        safety,
        state,
      }).filter((a) => !state.acknowledgedAlerts.includes(a.id)),
    [state, phase, week, safety],
  )
}

export function useGate() {
  const state = useAppStore()
  const phase = useCurrentPhase()
  const week = usePhaseWeek()
  return useMemo(() => evaluateGate(state, phase, week), [state, phase, week])
}

export function useWeeklyCheckIn() {
  const state = useAppStore()
  const phase = useCurrentPhase()
  const week = usePhaseWeek()
  return useMemo(() => weeklyCheckIn(state, phase, week), [state, phase, week])
}

export function useMonthlyRecap() {
  const state = useAppStore()
  const phase = useCurrentPhase()
  return useMemo(() => monthlyRecap(state, phase), [state, phase])
}

export function useAdherence() {
  const sessions = useAppStore((s) => s.sessions)
  const phase = useCurrentPhase()
  const week = usePhaseWeek()
  return useMemo(
    () => adherence(sessions.filter((s) => s.phase === phase.id), phase.sessionsPerWeek, week),
    [sessions, phase, week],
  )
}

export function useRecentSessions(days = 30) {
  const sessions = useAppStore((s) => s.sessions)
  return useMemo(() => lastNDays(sessions, days), [sessions, days])
}

/** Sessies waarvan de 24-uursreactie nog ontbreekt (sectie 4.1). */
export function usePendingFollowUps() {
  const sessions = useAppStore((s) => s.sessions)
  return useMemo(
    () =>
      sessions.filter(
        (s) => s.followUp === null && daysBetween(s.date, todayIso()) >= 1 && daysBetween(s.date, todayIso()) <= 4,
      ),
    [sessions],
  )
}
