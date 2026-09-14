/**
 * Lege startwaarden en de baselinetestbatterij (sectie 6.1).
 */

import type { AppState, IntakeData, Measurement, PhaseState } from './types'
import { todayIso } from './analytics'

export function emptyIntake(): IntakeData {
  return {
    name: '',
    birthYear: null,
    heightCm: null,
    medical: {
      diagnoses: '',
      previousInjuries: '',
      surgeries: '',
      medication: '',
      contraindications: '',
      lastCheckup: '',
      redFlagSymptoms: [],
    },
    training: {
      level: 'beginner',
      sportHistory: '',
      complaints: [],
      equipment: ['sportschool'],
      sessionsPerWeek: 3,
      sessionMinutes: 60,
    },
    nutrition: {
      weightLowestKg: null,
      weightHighestKg: null,
      weightCurrentKg: null,
      yoyo: false,
      extremePatterns: false,
      eatingDisorderHistory: false,
      mealsPerDay: 3,
      preferences: '',
      supplements: '',
      selfReportedExtreme: false,
      focus: 'spier',
    },
    goals: {
      vision48m: '',
      primary: 'spiermassa',
      secondary: [],
      dreamGoals: [],
      hardNo: '',
      learningStyle: 'stap-voor-stap',
    },
    lifestyle: {
      sleepHours: 7,
      sleepQuality: 3,
      stress: 5,
      dailyActivity: 'gemengd',
      travel: 'stabiel',
      householdSupport: '',
    },
    completedAt: null,
  }
}

export function emptyPhaseState(): PhaseState {
  return { current: 0, startedAt: todayIso(), confirmations: {}, history: [] }
}

export function emptyState(): AppState {
  return {
    intake: emptyIntake(),
    risk: null,
    phase: emptyPhaseState(),
    sessions: [],
    measurements: [],
    movementAssessments: [],
    nutritionDays: [],
    acknowledgedAlerts: [],
    medicalHold: null,
  }
}

/**
 * Baselinetests (sectie 6.1). Submaximaal en herhaalbaar: geen 1RM,
 * geen maximale inspanning. Deze waarden dienen als referentie voor het
 * programmaontwerp, niet als doel om te verbeteren.
 */
export interface BaselineTest {
  key: keyof Measurement
  label: string
  unit: string
  instruction: string
  category: 'prestatie' | 'structuur' | 'vitaal'
}

export const BASELINE_TESTS: BaselineTest[] = [
  {
    key: 'pushUpMax',
    label: 'Push-ups',
    unit: 'reps',
    instruction: 'Stop op RPE 6-7, dus met nog drie of vier reps over. Niet tot falen.',
    category: 'prestatie',
  },
  {
    key: 'pullUpMax',
    label: 'Pull-ups of lat pulldown',
    unit: 'reps',
    instruction: 'Geassisteerd mag. Noteer de assistentie in de notitie.',
    category: 'prestatie',
  },
  {
    key: 'carryMeters',
    label: 'Farmer carry',
    unit: 'meter',
    instruction: 'Matige belasting, rechte lijnen, stoppen bij grip- of houdingsverlies.',
    category: 'prestatie',
  },
  {
    key: 'weightKg',
    label: 'Gewicht',
    unit: 'kg',
    instruction: "'s Ochtends, na toiletbezoek, voor het eten. Eén keer.",
    category: 'structuur',
  },
  {
    key: 'waistCm',
    label: 'Taille',
    unit: 'cm',
    instruction: 'Op navelhoogte, ontspannen buik, zelfde moment als het wegen.',
    category: 'structuur',
  },
  {
    key: 'hipCm',
    label: 'Heup',
    unit: 'cm',
    instruction: 'Breedste punt, meetlint horizontaal.',
    category: 'structuur',
  },
  {
    key: 'chestCm',
    label: 'Borst',
    unit: 'cm',
    instruction: 'Op tepelhoogte, aan het einde van een normale uitademing.',
    category: 'structuur',
  },
  {
    key: 'restingHr',
    label: 'Rusthartslag',
    unit: 'slagen/min',
    instruction: "'s Ochtends, voor het opstaan, één minuut liggend.",
    category: 'vitaal',
  },
]

export function emptyMeasurement(isBaseline = false): Measurement {
  return {
    id: crypto.randomUUID(),
    date: todayIso(),
    weightKg: null,
    restingHr: null,
    waistCm: null,
    hipCm: null,
    chestCm: null,
    pushUpMax: null,
    pullUpMax: null,
    carryMeters: null,
    painAverage: null,
    energyAverage: null,
    sleepAverage: null,
    isBaseline,
  }
}
