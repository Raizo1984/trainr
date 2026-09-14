/**
 * Trainr — datamodel.
 *
 * Bron: AI_AGENT_INSTRUCTION_FitnessCoachApp.md, secties 2.1 (profiel),
 * 4.1 (training log), 6.2 (metingen) en 9 (safety flags).
 *
 * Ontwerpregel: alle domeinlogica is puur en zonder UI- of storage-afhankelijkheid,
 * zodat de progressie- en veiligheidsregels los getest kunnen worden (sectie 10.3).
 */

/* ------------------------------------------------------------------ */
/* Basistypen                                                          */
/* ------------------------------------------------------------------ */

/** ISO-datum, `YYYY-MM-DD`. */
export type IsoDate = string

export type Scale5 = 1 | 2 | 3 | 4 | 5
export type Pain = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10

export type BodyRegion =
  | 'nek'
  | 'schouder-links'
  | 'schouder-rechts'
  | 'elleboog-links'
  | 'elleboog-rechts'
  | 'pols-hand'
  | 'bovenrug'
  | 'onderrug'
  | 'heup'
  | 'knie-links'
  | 'knie-rechts'
  | 'enkel-voet'
  | 'hamstring'
  | 'kuit'

export const BODY_REGIONS: BodyRegion[] = [
  'nek',
  'schouder-links',
  'schouder-rechts',
  'elleboog-links',
  'elleboog-rechts',
  'pols-hand',
  'bovenrug',
  'onderrug',
  'heup',
  'knie-links',
  'knie-rechts',
  'enkel-voet',
  'hamstring',
  'kuit',
]

export const REGION_LABEL: Record<BodyRegion, string> = {
  nek: 'Nek',
  'schouder-links': 'Schouder links',
  'schouder-rechts': 'Schouder rechts',
  'elleboog-links': 'Elleboog links',
  'elleboog-rechts': 'Elleboog rechts',
  'pols-hand': 'Pols / hand',
  bovenrug: 'Bovenrug',
  onderrug: 'Onderrug',
  heup: 'Heup',
  'knie-links': 'Knie links',
  'knie-rechts': 'Knie rechts',
  'enkel-voet': 'Enkel / voet',
  hamstring: 'Hamstring',
  kuit: 'Kuit',
}

/* ------------------------------------------------------------------ */
/* Intake (sectie 2.1)                                                 */
/* ------------------------------------------------------------------ */

export interface MedicalHistory {
  diagnoses: string
  previousInjuries: string
  surgeries: string
  medication: string
  contraindications: string
  lastCheckup: string
  /** Rode vlaggen uit sectie 9.1, expliciet uitgevraagd tijdens intake. */
  redFlagSymptoms: RedFlagSymptom[]
}

export type RedFlagSymptom =
  | 'scherpe-pijn'
  | 'uitstralende-pijn'
  | 'doofheid-tintelingen'
  | 'zwelling-blauw'
  | 'niet-kunnen-belasten'
  | 'pijn-borst-ademhaling'
  | 'duizeligheid-zicht'

export const RED_FLAG_LABEL: Record<RedFlagSymptom, string> = {
  'scherpe-pijn': 'Plotselinge scherpe pijn (7+/10)',
  'uitstralende-pijn': 'Uitstralende pijn in een ledemaat',
  'doofheid-tintelingen': 'Doofheid of tintelingen',
  'zwelling-blauw': 'Zwelling of blauwe verkleuring',
  'niet-kunnen-belasten': 'Niet kunnen belasten / steunen',
  'pijn-borst-ademhaling': 'Pijn op de borst of ademhalingsproblemen',
  'duizeligheid-zicht': 'Duizeligheid of veranderingen in zicht',
}

export type TrainingLevel = 'nul' | 'beginner' | 'intermediate' | 'advanced'

export interface Complaint {
  region: BodyRegion
  intensity: Pain
  character: 'mechanisch' | 'neurologisch' | 'onbekend'
  course: 'acuut' | 'chronisch'
  worseWhen: string
  /** Reactie 24 uur na belasting (sectie 2.1). */
  reaction24h: 'erger' | 'gelijk' | 'beter' | 'onbekend'
}

export interface TrainingSituation {
  level: TrainingLevel
  sportHistory: string
  complaints: Complaint[]
  equipment: Equipment[]
  sessionsPerWeek: number
  sessionMinutes: number
}

export type Equipment =
  | 'sportschool'
  | 'halters'
  | 'barbell'
  | 'kettlebell'
  | 'machines'
  | 'pull-up-bar'
  | 'banden'
  | 'geen'

export const EQUIPMENT_LABEL: Record<Equipment, string> = {
  sportschool: 'Volledige sportschool',
  halters: 'Dumbbells',
  barbell: 'Barbell + rek',
  kettlebell: 'Kettlebell',
  machines: 'Machines',
  'pull-up-bar': 'Optrekstang',
  banden: 'Weerstandsbanden',
  geen: 'Alleen lichaamsgewicht',
}

export interface NutritionHistory {
  weightLowestKg: number | null
  weightHighestKg: number | null
  weightCurrentKg: number | null
  yoyo: boolean
  /** Crashdiëten, vasten, IF, extreme deficits (sectie 2.1). */
  extremePatterns: boolean
  eatingDisorderHistory: boolean
  mealsPerDay: number
  preferences: string
  supplements: string
  /** Zelfrapportage die een rode vlag triggert (sectie 2.1, waarschuwingsblok). */
  selfReportedExtreme: boolean
  focus: 'spier' | 'vet' | 'gewicht' | 'gezondheid'
}

export interface Goals {
  vision48m: string
  primary: 'spiermassa' | 'kracht' | 'skill' | 'transformatie' | 'pijnvrij-bewegen'
  /** Maximaal 3 (sectie 2.1). */
  secondary: string[]
  dreamGoals: string[]
  hardNo: string
  learningStyle: 'direct' | 'stap-voor-stap' | 'weinig-theorie' | 'veel-practicum'
}

export interface Lifestyle {
  sleepHours: number
  sleepQuality: Scale5
  stress: number
  dailyActivity: 'zittend' | 'gemengd' | 'actief'
  travel: 'stabiel' | 'wisselend' | 'veel-reizen'
  householdSupport: string
}

export interface IntakeData {
  name: string
  birthYear: number | null
  heightCm: number | null
  medical: MedicalHistory
  training: TrainingSituation
  nutrition: NutritionHistory
  goals: Goals
  lifestyle: Lifestyle
  completedAt: string | null
}

/* ------------------------------------------------------------------ */
/* Risico & fase (sectie 2.2)                                          */
/* ------------------------------------------------------------------ */

export type RiskLevel = 'laag' | 'verhoogd' | 'hoog'

export type ReferralKind = 'medisch' | 'fysio' | 'dietist' | 'ggz'

export interface Referral {
  kind: ReferralKind
  reason: string
  /** `true` = training blijft gepauzeerd tot groen licht (sectie 2.2 / 9.1). */
  blocking: boolean
}

export interface SafetySettings {
  /** Startdosis als fractie van het normale volume. */
  startingSetsFactor: number
  /** Aantal weken tussen verplichte deloads (standaard 6, sectie 9.2 C). */
  deloadIntervalWeeks: number
  /** Pijn boven deze waarde tijdens een set = oefening pauzeren. */
  painCeiling: Pain
  /** Hoe vaak de app een vorm-check vraagt (in sessies). */
  formCheckEverySessions: number
  /** Maximale weekstijging in sets (sectie 9.2 A). */
  maxWeeklyVolumeIncreasePct: number
  /** Progressiestap in procent van de belasting. */
  loadStepPct: number
}

export interface RiskAssessment {
  level: RiskLevel
  factors: RiskFactor[]
  referrals: Referral[]
  safety: SafetySettings
  /** Voedingsmodel volgens sectie 2.2 stap 3 / 5.1. */
  nutritionModel: 'laag-risico' | 'hoog-risico'
  /** Startfase volgens sectie 2.2 stap 2. */
  startPhase: PhaseId
  trainingPaused: boolean
}

export interface RiskFactor {
  code:
    | 'extreme-voedingshistorie'
    | 'eetstoornis-historie'
    | 'neurologische-symptomen'
    | 'onverklaarde-klachten'
    | 'rode-vlag-symptoom'
    | 'overuse-risico'
    | 'form-check-prioriteit'
    | 'slaaptekort'
    | 'hoge-stress'
    | 'geen-trainingservaring'
  label: string
  detail: string
  severity: 'info' | 'let-op' | 'kritiek'
}

/* ------------------------------------------------------------------ */
/* Fasen (sectie 3.2)                                                  */
/* ------------------------------------------------------------------ */

export type PhaseId = 0 | 1 | 2 | 3 | 4 | 5 | 6

export interface PhaseDefinition {
  id: PhaseId
  name: string
  tagline: string
  philosophy: string
  minWeeks: number
  typicalWeeks: number
  /** Richting in maanden, puur informatief — overgang is criteria-gedreven. */
  monthWindow: string
  sessionsPerWeek: number
  sources: string[]
  gateCriteria: GateCriterionDefinition[]
}

export type GateCriterionId =
  | 'adherence'
  | 'pijn'
  | 'techniek'
  | 'bewegingsruimte'
  | 'slaap-stress'
  | 'voeding'
  | 'medisch'
  | 'prestatie'

export interface GateCriterionDefinition {
  id: GateCriterionId
  label: string
  requirement: string
  /** Automatisch af te leiden uit data, of handmatig te bevestigen. */
  source: 'auto' | 'bevestiging'
}

export type GateStatus = 'groen' | 'geel' | 'rood' | 'onbekend'

export interface GateCriterionResult {
  id: GateCriterionId
  label: string
  requirement: string
  status: GateStatus
  value: string
  explanation: string
}

export interface GateEvaluation {
  phase: PhaseId
  criteria: GateCriterionResult[]
  decision: 'doorstromen' | 'verlengen' | 'professionele-beoordeling' | 'nog-niet-beoordeelbaar'
  summary: string
  weeksInPhase: number
}

/* ------------------------------------------------------------------ */
/* Oefeningen & programma (sectie 3.3)                                 */
/* ------------------------------------------------------------------ */

export type MovementPattern =
  | 'squat'
  | 'hinge'
  | 'horizontale-push'
  | 'verticale-push'
  | 'horizontale-pull'
  | 'verticale-pull'
  | 'carry-core'
  | 'isolatie'
  | 'skill'
  | 'conditie'

export interface LadderStep {
  id: string
  name: string
  /** Hoger = zwaardere trede in de progressielader (Low, sectie 3.1). */
  rung: number
  equipment: Equipment[]
  cue: string
  /** Bodyweight-progressies gaan via treden, belaste oefeningen via gewicht. */
  loadType: 'gewicht' | 'trede' | 'afstand' | 'tijd'
}

export interface ExerciseLadder {
  id: string
  name: string
  pattern: MovementPattern
  goal: string
  rule: string
  steps: LadderStep[]
}

export interface PrescribedExercise {
  ladderId: string
  stepId: string
  sets: number
  repMin: number
  repMax: number
  targetRir: number
  /** Vaste onderdelen (warming-up / cool-down) zijn niet progressief. */
  fixed?: boolean
  note?: string
}

export interface SessionTemplate {
  id: string
  name: string
  subtitle: string
  warmup: PrescribedExercise[]
  main: PrescribedExercise[]
  cooldown: PrescribedExercise[]
}

/* ------------------------------------------------------------------ */
/* Training log (sectie 4.1)                                           */
/* ------------------------------------------------------------------ */

export interface SetEntry {
  setIndex: number
  reps: number
  /** Kilogram, of aantal trede-assist; betekenis volgt `loadType`. */
  load: number
  /** Reps in reserve: 0 = tot falen, 4 = ruim binnen. */
  rir: number
  pain: Pain
  painRegion: BodyRegion | null
  /** 1-5, waarbij <4 techniekverlies betekent (sectie 4.2). */
  formQuality: Scale5
  note?: string
}

export interface ExerciseLog {
  ladderId: string
  stepId: string
  planned: { sets: number; repMin: number; repMax: number; targetRir: number }
  sets: SetEntry[]
  substitutionReason?: string
}

export interface PreSessionVitals {
  sleepQuality: Scale5
  energy: Scale5
  stress: Scale5
}

export interface PostSessionReport {
  painByRegion: Partial<Record<BodyRegion, Pain>>
  fatigue: Scale5
}

export interface FollowUp24h {
  soreness: Scale5
  painByRegion: Partial<Record<BodyRegion, Pain>>
  sleepQuality: Scale5
  recordedAt: string
}

export interface SessionLog {
  id: string
  date: IsoDate
  templateId: string
  phase: PhaseId
  /** Weeknummer binnen de fase, 1-based. */
  phaseWeek: number
  isDeload: boolean
  durationMinutes: number
  vitals: PreSessionVitals
  exercises: ExerciseLog[]
  post: PostSessionReport | null
  followUp: FollowUp24h | null
  completedAt: string
}

export interface PlannedSession {
  date: IsoDate
  templateId: string
  phaseWeek: number
  isDeload: boolean
}

/* ------------------------------------------------------------------ */
/* Voeding (sectie 5)                                                  */
/* ------------------------------------------------------------------ */

export interface NutritionPlan {
  model: 'laag-risico' | 'hoog-risico'
  proteinMinG: number
  proteinTargetG: number
  minMealsPerDay: number
  showCalories: boolean
  /** Expliciet verboden gedrag bij hoog risico (sectie 5.1). */
  prohibited: string[]
  guardrails: string[]
  dietitianRequired: boolean
}

export interface NutritionDay {
  date: IsoDate
  proteinG: number
  meals: number
  weightKg: number | null
  energy: Scale5
  note?: string
}

export type NutritionFlagLevel = 1 | 2 | 3 | 4

export interface NutritionAlert {
  level: NutritionFlagLevel
  title: string
  message: string
  action: string
}

/* ------------------------------------------------------------------ */
/* Metingen (sectie 6)                                                 */
/* ------------------------------------------------------------------ */

export interface Measurement {
  id: string
  date: IsoDate
  weightKg: number | null
  restingHr: number | null
  waistCm: number | null
  hipCm: number | null
  chestCm: number | null
  pushUpMax: number | null
  pullUpMax: number | null
  carryMeters: number | null
  painAverage: number | null
  energyAverage: number | null
  sleepAverage: number | null
  note?: string
  /** `true` voor de nulmeting uit sectie 6.1. */
  isBaseline?: boolean
}

/* ------------------------------------------------------------------ */
/* Coaching & signalering (secties 4.3, 7.1, 9)                        */
/* ------------------------------------------------------------------ */

export type AlertSeverity = 'info' | 'let-op' | 'kritiek'

export type AlertCode =
  | 'pijn-toename'
  | 'pijn-patroon'
  | 'techniek-verval'
  | 'plateau'
  | 'adherence'
  | 'deload-due'
  | 'volume-sprong'
  | 'gewricht-cap'
  | 'rir-overtreding'
  | 'voeding-eiwit'
  | 'voeding-gewicht'
  | 'voeding-taal'
  | 'medische-rode-vlag'
  | 'fase-gate'
  | 'weekcheck'
  | 'maandrapport'

export interface CoachAlert {
  id: string
  code: AlertCode
  severity: AlertSeverity
  title: string
  body: string
  /** Concrete handeling — nooit alleen motivatie (sectie 12, factor 4). */
  action: string
  /** Waar de regel vandaan komt, zodat advies traceerbaar blijft. */
  source: string
  createdAt: IsoDate
  subject?: string
  options?: string[]
}

/* ------------------------------------------------------------------ */
/* Bewegingskwaliteit (sectie 6.1)                                      */
/* ------------------------------------------------------------------ */

export type Grade = 'groen' | 'geel' | 'rood'

export interface MovementAssessment {
  id: string
  date: IsoDate
  /** Score per checkpunt, gesleuteld op `CheckItem.id`. */
  grades: Record<string, Grade>
  note?: string
}

/* ------------------------------------------------------------------ */
/* Planaanpassingen                                                     */
/* ------------------------------------------------------------------ */

export type AdjustmentKind =
  | 'sets-omhoog'
  | 'sets-omlaag'
  | 'trede-omlaag'
  | 'trede-omhoog'
  | 'oefening-pauzeren'
  | 'repbereik-wijzigen'
  | 'deload-vervroegen'
  | 'frequentie-omlaag'

export type AdjustmentSource = 'regel' | 'coach'

export interface PlanAdjustment {
  id: string
  kind: AdjustmentKind
  /** Op welke lader de aanpassing slaat. Leeg betekent: hele programma. */
  ladderId?: string
  amount?: number
  repMin?: number
  repMax?: number
  reason: string
  source: AdjustmentSource
  createdAt: IsoDate
  /** Vervalt automatisch na dit aantal weken. Leeg betekent: tot intrekking. */
  expiresAfterWeeks?: number
  /** Door de gebruiker geaccepteerd. Voorstellen wachten hierop. */
  accepted: boolean
}

/* ------------------------------------------------------------------ */
/* Applicatiestatus                                                     */
/* ------------------------------------------------------------------ */

export interface PhaseState {
  current: PhaseId
  startedAt: IsoDate
  /** Handmatig bevestigde gate-criteria (bron `bevestiging`). */
  confirmations: Partial<Record<GateCriterionId, boolean>>
  history: Array<{ phase: PhaseId; from: IsoDate; to: IsoDate }>
  /**
   * Zelfgekozen focus voor de specialisatiecyclus in fase 5 (sectie 3.2).
   * Leeg betekent: de app rouleert massa, kracht en skill.
   */
  blockFocus?: 'massa' | 'kracht' | 'skill'
}

export interface AppState {
  intake: IntakeData
  /** Actieve en voorgestelde planaanpassingen (adapt.ts). */
  adjustments: PlanAdjustment[]
  /** Bewegingskwaliteit-beoordelingen (sectie 6.1), nieuwste laatst. */
  movementAssessments: MovementAssessment[]
  risk: RiskAssessment | null
  phase: PhaseState
  sessions: SessionLog[]
  measurements: Measurement[]
  nutritionDays: NutritionDay[]
  acknowledgedAlerts: string[]
  /** Gezet door de rode-vlaggenprocedure, sectie 9.1. */
  medicalHold: { active: boolean; since: IsoDate; reason: string } | null
}
