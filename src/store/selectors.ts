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
import { applyAdjustments, deloadForcedEarly, proposeAdjustments, type ValidationContext } from '@/domain/adapt'

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

  const adjustments = useAppStore((s) => s.adjustments)

  return useMemo(() => {
    const skills = activeSkillLadders(sessions, goals, phaseId)
    const base = buildTemplates({ phase: phaseId, equipment, safety, week, skills, focus })
    // Geaccepteerde aanpassingen gaan vóór de deload: een deloadweek halveert
    // wat er na de aanpassing overblijft, niet wat er zonder zou staan.
    const adapted = applyAdjustments(base, adjustments)
    const deload = deloadForcedEarly(adjustments) || isDeloadWeek(week, safety)
    return deload ? adapted.map(applyDeload) : adapted
  }, [phaseId, equipment, safety, week, sessions, goals, focus, adjustments])
}

/** Context die de veiligheidspoort nodig heeft om een aanpassing te beoordelen. */
export function useValidationContext(): ValidationContext {
  const state = useAppStore()
  const phase = useCurrentPhase()
  const week = usePhaseWeek()
  const safety = useSafety()
  return useMemo(() => ({ state, safety, phase, phaseWeek: week }), [state, safety, phase, week])
}

/**
 * Voorstellen van de regelmotor die nog niet in de status staan.
 * Dubbele voorstellen voor dezelfde oefening en soort worden weggelaten.
 */
export function usePendingProposals() {
  const ctx = useValidationContext()
  const existing = useAppStore((s) => s.adjustments)
  return useMemo(() => {
    const seen = new Set(existing.map((a) => `${a.kind}:${a.ladderId ?? ''}`))
    return proposeAdjustments(ctx).filter((p) => !seen.has(`${p.kind}:${p.ladderId ?? ''}`))
  }, [ctx, existing])
}

/** Aanpassingen die de gebruiker heeft geaccepteerd en die nu gelden. */
export function useActiveAdjustments() {
  const adjustments = useAppStore((s) => s.adjustments)
  return useMemo(() => adjustments.filter((a) => a.accepted), [adjustments])
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
  const adjustments = useAppStore((s) => s.adjustments)
  return useMemo(() => {
    // Een geaccepteerde vervroeging maakt van deze week een deloadweek. De
    // vaste cyclus loopt daarna gewoon door: een deload naar voren halen mag,
    // overslaan niet.
    const forced = deloadForcedEarly(adjustments)
    return {
      isDeload: forced || isDeloadWeek(week, safety),
      weeksUntil: forced ? 0 : weeksUntilDeload(week, safety),
      week,
      forcedEarly: forced,
    }
  }, [safety, week, adjustments])
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
