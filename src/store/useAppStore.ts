/**
 * Applicatiestatus met persistentie in localStorage.
 *
 * Alle data blijft op het apparaat van de gebruiker staan (sectie 8.2, regel 1:
 * de gebruiker is eigenaar van de data). Export en verwijderen zitten in de
 * instellingen.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  AppState,
  FollowUp24h,
  GateCriterionId,
  IntakeData,
  Measurement,
  MovementAssessment,
  NutritionDay,
  PhaseId,
  SessionLog,
} from '@/domain/types'
import { emptyState } from '@/domain/defaults'
import { assessRisk } from '@/domain/risk'
import { todayIso } from '@/domain/analytics'
import { buildDemoState } from './demo'

export interface AppStore extends AppState {
  completeIntake: (intake: IntakeData) => void
  updateIntake: (patch: Partial<IntakeData>) => void
  logSession: (session: SessionLog) => void
  addFollowUp: (sessionId: string, followUp: FollowUp24h) => void
  addMeasurement: (measurement: Measurement) => void
  saveMovementAssessment: (assessment: MovementAssessment) => void
  removeMeasurement: (id: string) => void
  addNutritionDay: (day: NutritionDay) => void
  confirmGate: (criterion: GateCriterionId, value: boolean) => void
  setBlockFocus: (focus: 'massa' | 'kracht' | 'skill' | undefined) => void
  advancePhase: () => void
  setPhase: (phase: PhaseId) => void
  raiseMedicalHold: (reason: string) => void
  clearMedicalHold: () => void
  acknowledgeAlert: (id: string) => void
  loadDemo: () => void
  resetAll: () => void
  exportJson: () => string
}

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      ...emptyState(),

      completeIntake: (intake) => {
        const risk = assessRisk(intake)
        set({
          intake: { ...intake, completedAt: new Date().toISOString() },
          risk,
          phase: { current: risk.startPhase, startedAt: todayIso(), confirmations: {}, history: [] },
          medicalHold: risk.trainingPaused
            ? {
                active: true,
                since: todayIso(),
                reason:
                  'Je gaf tijdens de intake een symptoom aan dat eerst medisch beoordeeld hoort te worden.',
              }
            : null,
        })
      },

      updateIntake: (patch) => {
        const intake = { ...get().intake, ...patch }
        set({ intake, risk: intake.completedAt ? assessRisk(intake) : get().risk })
      },

      logSession: (session) =>
        set((state) => ({
          sessions: [...state.sessions.filter((s) => s.id !== session.id), session].sort((a, b) =>
            a.date.localeCompare(b.date),
          ),
        })),

      addFollowUp: (sessionId, followUp) =>
        set((state) => ({
          sessions: state.sessions.map((s) => (s.id === sessionId ? { ...s, followUp } : s)),
        })),

      addMeasurement: (measurement) =>
        set((state) => ({
          measurements: [...state.measurements.filter((m) => m.id !== measurement.id), measurement].sort(
            (a, b) => a.date.localeCompare(b.date),
          ),
        })),

      saveMovementAssessment: (assessment) =>
        set((state) => ({
          movementAssessments: [
            ...state.movementAssessments.filter((a) => a.id !== assessment.id),
            assessment,
          ].sort((a, b) => a.date.localeCompare(b.date)),
        })),

      removeMeasurement: (id) =>
        set((state) => ({ measurements: state.measurements.filter((m) => m.id !== id) })),

      addNutritionDay: (day) =>
        set((state) => ({
          nutritionDays: [...state.nutritionDays.filter((d) => d.date !== day.date), day].sort((a, b) =>
            a.date.localeCompare(b.date),
          ),
        })),

      confirmGate: (criterion, value) =>
        set((state) => ({
          phase: { ...state.phase, confirmations: { ...state.phase.confirmations, [criterion]: value } },
        })),

      setBlockFocus: (focus) => set((state) => ({ phase: { ...state.phase, blockFocus: focus } })),

      advancePhase: () =>
        set((state) => {
          if (state.phase.current >= 6) return state
          const next = (state.phase.current + 1) as PhaseId
          return {
            phase: {
              current: next,
              startedAt: todayIso(),
              confirmations: {},
              history: [
                ...state.phase.history,
                { phase: state.phase.current, from: state.phase.startedAt, to: todayIso() },
              ],
            },
          }
        }),

      setPhase: (phase) =>
        set((state) => ({ phase: { ...state.phase, current: phase, startedAt: todayIso(), confirmations: {} } })),

      raiseMedicalHold: (reason) => set({ medicalHold: { active: true, since: todayIso(), reason } }),

      clearMedicalHold: () => set({ medicalHold: null }),

      acknowledgeAlert: (id) =>
        set((state) => ({ acknowledgedAlerts: [...new Set([...state.acknowledgedAlerts, id])] })),

      loadDemo: () => set(buildDemoState()),

      resetAll: () => set(emptyState()),

      exportJson: () => {
        const { intake, risk, phase, sessions, measurements, movementAssessments, nutritionDays, medicalHold } = get()
        return JSON.stringify(
          { exportedAt: new Date().toISOString(), intake, risk, phase, sessions, measurements, movementAssessments, nutritionDays, medicalHold },
          null,
          2,
        )
      },
    }),
    {
      name: 'trainr-v1',
      version: 1,
      partialize: (state) => ({
        intake: state.intake,
        risk: state.risk,
        phase: state.phase,
        sessions: state.sessions,
        measurements: state.measurements,
        movementAssessments: state.movementAssessments,
        nutritionDays: state.nutritionDays,
        acknowledgedAlerts: state.acknowledgedAlerts,
        medicalHold: state.medicalHold,
      }),
    },
  ),
)

export const useIntakeDone = () => useAppStore((s) => Boolean(s.intake.completedAt))
