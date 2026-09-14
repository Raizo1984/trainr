import { emptyIntake, emptyState } from '../defaults'
import type { AppState, ExerciseLog, IntakeData, SessionLog, SetEntry } from '../types'

export function intakeWith(patch: (intake: IntakeData) => void): IntakeData {
  const intake = emptyIntake()
  patch(intake)
  return intake
}

export function makeSet(partial: Partial<SetEntry> & { reps: number }): SetEntry {
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

export function makeExercise(
  ladderId: string,
  stepId: string,
  sets: SetEntry[],
  planned = { sets: 3, repMin: 8, repMax: 12, targetRir: 3 },
): ExerciseLog {
  return { ladderId, stepId, planned, sets: sets.map((s, i) => ({ ...s, setIndex: i })) }
}

let counter = 0

export function makeSession(date: string, exercises: ExerciseLog[], patch: Partial<SessionLog> = {}): SessionLog {
  counter += 1
  return {
    id: `s${counter}`,
    date,
    templateId: 'p1-anker',
    phase: 1,
    phaseWeek: 1,
    isDeload: false,
    durationMinutes: 55,
    vitals: { sleepQuality: 4, energy: 4, stress: 2 },
    exercises,
    post: null,
    followUp: null,
    completedAt: `${date}T18:00:00.000Z`,
    ...patch,
  }
}

export function stateWith(sessions: SessionLog[], patch: Partial<AppState> = {}): AppState {
  return { ...emptyState(), sessions, ...patch }
}
