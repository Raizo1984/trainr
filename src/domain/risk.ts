/**
 * Risicostratificatie, veiligheidsinstellingen, doorverwijzingen en startfase.
 * Bron: sectie 2.2 (stappen 1-3) en sectie 9.1.
 *
 * Uitgangspunt uit de slotinstructie: bij twijfel conservatief. Een verkeerde
 * inschatting mag de gebruiker hooguit vertragen, nooit blesseren.
 */

import type {
  IntakeData,
  NutritionPlan,
  Referral,
  RiskAssessment,
  RiskFactor,
  SafetySettings,
} from './types'
import { RED_FLAG_LABEL, REGION_LABEL } from './types'

/** Standaardinstellingen voor een gebruiker zonder bijzonderheden. */
export const DEFAULT_SAFETY: SafetySettings = {
  startingSetsFactor: 1,
  deloadIntervalWeeks: 6,
  painCeiling: 3,
  formCheckEverySessions: 8,
  maxWeeklyVolumeIncreasePct: 10,
  loadStepPct: 5,
}

/** Strengere instellingen voor verhoogd risico. */
const ELEVATED_SAFETY: SafetySettings = {
  startingSetsFactor: 0.8,
  deloadIntervalWeeks: 5,
  painCeiling: 3,
  formCheckEverySessions: 6,
  maxWeeklyVolumeIncreasePct: 8,
  loadStepPct: 2.5,
}

/** Meest conservatieve instellingen (sectie 2.2, stap 1). */
const HIGH_SAFETY: SafetySettings = {
  startingSetsFactor: 0.67,
  deloadIntervalWeeks: 4,
  painCeiling: 2,
  formCheckEverySessions: 4,
  maxWeeklyVolumeIncreasePct: 5,
  loadStepPct: 2.5,
}

function age(intake: IntakeData): number | null {
  if (!intake.birthYear) return null
  return new Date().getFullYear() - intake.birthYear
}

/**
 * Bepaalt alle risicofactoren uit de intake.
 * Elke factor draagt een severity die de uiteindelijke `RiskLevel` bepaalt.
 */
export function collectRiskFactors(intake: IntakeData): RiskFactor[] {
  const factors: RiskFactor[] = []
  const { nutrition, training, medical, lifestyle, goals } = intake

  if (nutrition.extremePatterns || nutrition.selfReportedExtreme) {
    factors.push({
      code: 'extreme-voedingshistorie',
      label: 'Extreme voedingshistorie',
      detail:
        'Crashdiëten, vasten of zelfbenoemde extremen in de voorgeschiedenis. De app schakelt het beschermende voedingsmodel in en houdt calorieën buiten beeld.',
      severity: 'kritiek',
    })
  }
  if (nutrition.eatingDisorderHistory) {
    factors.push({
      code: 'eetstoornis-historie',
      label: 'Eetstoornis in de voorgeschiedenis',
      detail:
        'Voedingsbegeleiding loopt via een diëtist. De app stuurt nooit op calorieën, gewichtdoelen of eetvensters.',
      severity: 'kritiek',
    })
  }
  if (nutrition.yoyo) {
    factors.push({
      code: 'extreme-voedingshistorie',
      label: 'Jojopatroon in gewicht',
      detail: 'Gewichtstrend wordt op een voortschrijdend gemiddelde van vier weken beoordeeld, niet per dag.',
      severity: 'let-op',
    })
  }

  const neuro = training.complaints.filter((c) => c.character === 'neurologisch')
  if (neuro.length > 0) {
    factors.push({
      code: 'neurologische-symptomen',
      label: 'Neurologische klachten',
      detail: `Gemeld in: ${neuro.map((c) => REGION_LABEL[c.region]).join(', ')}. Dit hoort eerst bij een arts, niet bij een trainingsprogramma.`,
      severity: 'kritiek',
    })
  }

  const chronicUndiagnosed = training.complaints.filter(
    (c) => c.course === 'chronisch' && c.intensity >= 3 && medical.diagnoses.trim().length === 0,
  )
  if (chronicUndiagnosed.length > 0) {
    factors.push({
      code: 'onverklaarde-klachten',
      label: 'Aanhoudende klachten zonder diagnose',
      detail: `${chronicUndiagnosed.map((c) => REGION_LABEL[c.region]).join(', ')}. Een fysiotherapeut stelt vast waar de grens ligt, daarna bouwt de app daarbinnen op.`,
      severity: 'let-op',
    })
  }

  if (medical.redFlagSymptoms.length > 0) {
    factors.push({
      code: 'rode-vlag-symptoom',
      label: 'Medische rode vlag gemeld',
      detail: medical.redFlagSymptoms.map((s) => RED_FLAG_LABEL[s]).join('; '),
      severity: 'kritiek',
    })
  }

  const userAge = age(intake)
  const bigGoals = goals.dreamGoals.length >= 3 || goals.primary === 'transformatie'
  if (userAge !== null && userAge < 21 && bigGoals) {
    factors.push({
      code: 'overuse-risico',
      label: 'Overbelastingsrisico',
      detail: 'Jonge leeftijd in combinatie met grote doelen. Volumeplafonds per gewricht worden strenger bewaakt.',
      severity: 'let-op',
    })
  }
  if (training.sessionsPerWeek >= 5 && training.level === 'nul') {
    factors.push({
      code: 'overuse-risico',
      label: 'Trainingsfrequentie boven het startniveau',
      detail: `${training.sessionsPerWeek} sessies per week zonder trainingsbasis. De app start met minder en bouwt op gedrag, niet op ambitie.`,
      severity: 'let-op',
    })
  }

  if (training.level === 'nul' || training.level === 'beginner') {
    factors.push({
      code: 'form-check-prioriteit',
      label: 'Techniek heeft prioriteit',
      detail: 'Vormcontrole wordt vaker gevraagd en de startbelasting ligt laag.',
      severity: 'info',
    })
  }
  if (training.level === 'nul') {
    factors.push({
      code: 'geen-trainingservaring',
      label: 'Geen trainingservaring',
      detail: 'Fase 0 en fase 1 zijn hier niet optioneel. Belastbaarheid komt eerst.',
      severity: 'info',
    })
  }

  if (lifestyle.sleepHours > 0 && lifestyle.sleepHours < 6) {
    factors.push({
      code: 'slaaptekort',
      label: 'Structureel kort slapen',
      detail: `${lifestyle.sleepHours} uur per nacht. Herstel is training; dit begrenst hoeveel volume zinvol is.`,
      severity: 'let-op',
    })
  }
  if (lifestyle.stress >= 8) {
    factors.push({
      code: 'hoge-stress',
      label: 'Hoge stressbelasting',
      detail: `Stress ${lifestyle.stress}/10. Totale belasting is training plus leven; de app houdt het startvolume laag.`,
      severity: 'let-op',
    })
  }

  return factors
}

export function levelFromFactors(factors: RiskFactor[]): RiskAssessment['level'] {
  if (factors.some((f) => f.severity === 'kritiek')) return 'hoog'
  if (factors.filter((f) => f.severity === 'let-op').length >= 2) return 'hoog'
  if (factors.some((f) => f.severity === 'let-op')) return 'verhoogd'
  return 'laag'
}

export function safetyForLevel(level: RiskAssessment['level']): SafetySettings {
  if (level === 'hoog') return { ...HIGH_SAFETY }
  if (level === 'verhoogd') return { ...ELEVATED_SAFETY }
  return { ...DEFAULT_SAFETY }
}

export function buildReferrals(intake: IntakeData, factors: RiskFactor[]): Referral[] {
  const referrals: Referral[] = []
  const has = (code: RiskFactor['code']) => factors.some((f) => f.code === code)

  if (has('rode-vlag-symptoom')) {
    referrals.push({
      kind: 'medisch',
      reason:
        'Je gaf een symptoom aan dat eerst medisch beoordeeld hoort te worden. Training staat gepauzeerd tot je groen licht hebt.',
      blocking: true,
    })
  }
  if (has('neurologische-symptomen')) {
    referrals.push({
      kind: 'medisch',
      reason:
        'Neurologische klachten (uitstraling, doofheid, tintelingen) horen bij een arts. Daarna pakt de app het binnen de gestelde grenzen op.',
      blocking: true,
    })
  }
  if (has('onverklaarde-klachten')) {
    referrals.push({
      kind: 'fysio',
      reason:
        'Aanhoudende klachten zonder diagnose. Een fysiotherapeut stelt de grenzen vast, de app werkt daarbinnen verder.',
      blocking: false,
    })
  }
  if (has('extreme-voedingshistorie') || has('eetstoornis-historie')) {
    referrals.push({
      kind: 'dietist',
      reason:
        'Je voedingsgeschiedenis vraagt om begeleiding van een diëtist. De app stuurt op ondergrenzen (eiwit en maaltijden), niet op beperking.',
      blocking: false,
    })
  }
  if (intake.nutrition.eatingDisorderHistory) {
    referrals.push({
      kind: 'ggz',
      reason:
        'Optioneel, maar het aanbod staat: begeleiding bij eetgedrag werkt beter samen met de training dan ernaast.',
      blocking: false,
    })
  }
  return referrals
}

export function nutritionModelFor(intake: IntakeData): NutritionPlan['model'] {
  const n = intake.nutrition
  return n.extremePatterns || n.selfReportedExtreme || n.eatingDisorderHistory
    ? 'hoog-risico'
    : 'laag-risico'
}

/**
 * Startfase (sectie 2.2, stap 2).
 *
 * Iedereen begint in fase 0, ook de ervaren gebruiker: zonder baseline en
 * zonder bekend 24-uurspatroon is elk programma een gok. Bij een blokkerende
 * doorverwijzing staat training bovendien stil tot er groen licht is; dat legt
 * `trainingPaused` vast, niet de fase.
 */
export function determineStartPhase(referrals: Referral[]): RiskAssessment['startPhase'] {
  void referrals
  return 0
}

/** Mag deze gebruiker na fase 0 direct door naar fase 2? Zelden. */
export function qualifiesForDirectPhase2(intake: IntakeData): boolean {
  const noComplaints = intake.training.complaints.every((c) => c.intensity <= 1)
  const experienced = intake.training.level === 'advanced'
  const stableNutrition =
    !intake.nutrition.extremePatterns &&
    !intake.nutrition.eatingDisorderHistory &&
    !intake.nutrition.selfReportedExtreme
  const noRedFlags = intake.medical.redFlagSymptoms.length === 0
  return noComplaints && experienced && stableNutrition && noRedFlags
}

export function assessRisk(intake: IntakeData): RiskAssessment {
  const factors = collectRiskFactors(intake)
  const level = levelFromFactors(factors)
  const referrals = buildReferrals(intake, factors)
  return {
    level,
    factors,
    referrals,
    safety: safetyForLevel(level),
    nutritionModel: nutritionModelFor(intake),
    startPhase: determineStartPhase(referrals),
    trainingPaused: referrals.some((r) => r.blocking),
  }
}
