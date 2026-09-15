/**
 * "The Rule" — de universele progressieregel (secties 3.1 en 4.2).
 *
 * Deze module is opzettelijk het saaiste en best geteste stuk van de app.
 * Sectie 12, factor 1: als dit algoritme kapot is, faalt de hele app.
 *
 * Volgorde van beslissen (veiligheid boven progressie):
 *   1. Deloadweek        → niets veranderen
 *   2. Pijn              → adaptatieprotocol, nooit progressie
 *   3. Techniekverlies   → belasting terug
 *   4. RIR te laag       → belasting terug
 *   5. Bovenkant bereikt → kleinste stap zwaarder, terug naar onderkant
 *   6. Anders            → zelfde belasting, reps toevoegen
 *
 * Twee variabelen tegelijk veranderen mag nooit.
 */

import type { ExerciseLog, LadderStep, Pain, SafetySettings, SetEntry } from './types'
import { advanceStep, getLadder, getStep, regressStep } from './exercises'

export type ProgressionAction =
  | 'deload-aanhouden'
  | 'pijn-protocol'
  | 'techniek-herstellen'
  | 'belasting-verlagen'
  | 'belasting-verhogen'
  | 'trede-omhoog'
  | 'reps-toevoegen'

export interface NextPrescription {
  stepId: string
  sets: number
  repMin: number
  repMax: number
  /** Aanbevolen belasting; bij `loadType: 'trede'` blijft dit 0. */
  load: number
}

export interface ProgressionDecision {
  action: ProgressionAction
  next: NextPrescription
  /** Korte, directe uitleg voor de gebruiker. */
  reason: string
  /** Herleidbaarheid naar de brondocumentatie. */
  source: string
  /** Signaleert dat er een pijn- of techniekprobleem meespeelt. */
  flagged: boolean
}

export interface ProgressionContext {
  log: ExerciseLog
  isDeload: boolean
  safety: SafetySettings
  /** Hoogste pijn 24 uur na de sessie in het betrokken gebied. */
  followUpPain?: Pain
}

/**
 * Drempels van De Regel, op één plek.
 *
 * Zowel de beslissing na afloop van een oefening (`decideProgression`) als de
 * directe feedback tussen twee sets (`feedbackForSet`) leunt hierop. Stonden ze
 * op twee plekken, dan lopen ze vroeg of laat uit elkaar en geeft de app tijdens
 * het trainen ander advies dan erna. Dat is precies het soort verschil dat
 * niemand opmerkt tot het fout gaat.
 */
export const PAIN_STOP: Pain = 5
export const FORM_MIN = 4
export const RIR_MIN = 2

/** Hoeveel de belasting terug moet, per aanleiding. */
export const REDUCE_PAIN_STOP = 0.5
export const REDUCE_PAIN_CEILING = 0.7
export const REDUCE_FORM = 0.85
export const REDUCE_RIR = 0.92

/**
 * Belasting afronden naar boven, op een stap die bestaat.
 *
 * Bij een verhoging is naar beneden afronden zinloos: dan kom je vaak op
 * hetzelfde gewicht uit en gebeurt er niets. Naar boven levert altijd een
 * echte stap op.
 */
export function roundLoadUp(kg: number): number {
  if (kg <= 0) return 0
  if (kg < 10) return Math.ceil(kg * 2) / 2
  if (kg < 30) return Math.ceil(kg)
  return Math.ceil(kg / 2.5) * 2.5
}

/** Belasting afronden op een stap die in de zaal ook echt bestaat. */
export function roundLoad(kg: number): number {
  if (kg <= 0) return 0
  if (kg < 10) return Math.round(kg * 2) / 2
  if (kg < 30) return Math.round(kg)
  return Math.round(kg / 2.5) * 2.5
}

/**
 * Afronden naar beneden. Elke verlaging uit een veiligheidsregel gaat hier
 * doorheen: bij twijfel liever iets te licht dan iets te zwaar
 * (slotinstructie, punt 7).
 */
export function roundLoadDown(kg: number): number {
  if (kg <= 0) return 0
  if (kg < 10) return Math.floor(kg * 2) / 2
  if (kg < 30) return Math.floor(kg)
  return Math.floor(kg / 2.5) * 2.5
}

/**
 * Conservatieve startbelasting: 70% van de geschatte max (sectie 3.1, stap 2).
 * Bij verhoogde veiligheidsinstellingen gaat daar nog een marge af.
 */
export function conservativeStartLoad(estimatedMaxKg: number, safety: SafetySettings): number {
  const base = estimatedMaxKg * 0.7
  const factor = safety.startingSetsFactor < 1 ? 0.9 : 1
  return roundLoad(base * factor)
}

export function workingSets(log: ExerciseLog): SetEntry[] {
  return log.sets.filter((s) => s.reps > 0)
}

export function finalWorkSet(log: ExerciseLog): SetEntry | null {
  const sets = workingSets(log)
  return sets.length > 0 ? sets[sets.length - 1] : null
}

export function heaviestLoad(log: ExerciseLog): number {
  return workingSets(log).reduce((max, s) => Math.max(max, s.load), 0)
}

/**
 * Het gewicht waarmee je de oefening hebt afgesloten.
 *
 * Dit is de grondslag voor de volgende sessie, niet het zwaarste gewicht.
 * Het verschil telt zodra je tijdens een sessie verzwaart: met het zwaarste
 * gewicht als basis zou die verhoging daarna nog een keer meetellen, en dan
 * stapel je twee stappen op elkaar zonder dat iemand dat kiest.
 *
 * Het werkt ook de andere kant op. Ging je halverwege omlaag vanwege pijn of
 * techniek, dan begin je de volgende keer op dat lagere gewicht. Dat is precies
 * wat een voorzichtige coach zou doen.
 */
export function werkbelasting(log: ExerciseLog): number {
  return finalWorkSet(log)?.load ?? 0
}

/** Is er tijdens deze oefening al verzwaard? Hoogstens één stap per sessie. */
export function verhoogdTijdensSessie(log: ExerciseLog): boolean {
  const sets = workingSets(log)
  if (sets.length < 2) return false
  return sets[sets.length - 1].load > sets[0].load
}

export function maxPain(log: ExerciseLog): Pain {
  return workingSets(log).reduce<Pain>((max, s) => (s.pain > max ? s.pain : max), 0)
}

export function minFormQuality(log: ExerciseLog): number {
  const sets = workingSets(log)
  if (sets.length === 0) return 5
  return sets.reduce((min, s) => Math.min(min, s.formQuality), 5)
}

/** Alle werksets haalden de bovenkant van het repbereik. */
export function reachedTopOfRange(log: ExerciseLog): boolean {
  const sets = workingSets(log)
  if (sets.length < log.planned.sets) return false
  return sets.every((s) => s.reps >= log.planned.repMax)
}

function stepOf(log: ExerciseLog): LadderStep {
  return getStep(log.stepId)
}

function keep(
  log: ExerciseLog,
  load: number,
  stepId = log.stepId,
  direction: 'nearest' | 'omlaag' = 'nearest',
): NextPrescription {
  return {
    stepId,
    sets: log.planned.sets,
    repMin: log.planned.repMin,
    repMax: log.planned.repMax,
    load: direction === 'omlaag' ? roundLoadDown(load) : roundLoad(load),
  }
}

/**
 * Bepaalt het voorschrift voor de vólgende sessie van deze oefening.
 *
 * De functie is puur: zelfde invoer geeft altijd dezelfde uitvoer.
 */
export function decideProgression(ctx: ProgressionContext): ProgressionDecision {
  const { log, isDeload, safety } = ctx
  const step = stepOf(log)
  const current = werkbelasting(log)
  const sets = workingSets(log)

  if (sets.length === 0) {
    return {
      action: 'reps-toevoegen',
      next: keep(log, current),
      reason: 'Geen sets gelogd. Voorschrift blijft ongewijzigd.',
      source: 'Sectie 4.2',
      flagged: false,
    }
  }

  // 1. Deload: niets veranderen. Deloads worden nooit overgeslagen (sectie 9.2 C).
  if (isDeload) {
    return {
      action: 'deload-aanhouden',
      next: keep(log, current),
      reason: 'Deloadweek. Helft van de sets, zelfde gewicht. Geen progressie deze week.',
      source: 'Sectie 4.2 / 9.2 C',
      flagged: false,
    }
  }

  // 2. Pijn gaat altijd voor (principe 4).
  const pain = Math.max(maxPain(log), ctx.followUpPain ?? 0) as Pain
  if (pain >= PAIN_STOP) {
    const lower = regressStep(log.ladderId, log.stepId)
    return {
      action: 'pijn-protocol',
      next: lower
        ? keep(log, current * REDUCE_PAIN_STOP, lower.id, 'omlaag')
        : keep(log, current * REDUCE_PAIN_STOP, log.stepId, 'omlaag'),
      reason: lower
        ? `Pijn ${pain}/10. Oefening pauzeren en één trede terug naar ${lower.name}, met halve belasting.`
        : `Pijn ${pain}/10. Oefening pauzeren, belasting halveren en bereik beperken tot pijnvrij.`,
      source: 'Sectie 4.3 trigger 1',
      flagged: true,
    }
  }
  if (pain >= safety.painCeiling) {
    return {
      action: 'pijn-protocol',
      next: keep(log, current * REDUCE_PAIN_CEILING, log.stepId, 'omlaag'),
      reason: `Pijn ${pain}/10 zit op of boven je grens van ${safety.painCeiling}. Belasting 30% terug en 24-uursreactie afwachten.`,
      source: 'Sectie 4.3 trigger 1',
      flagged: true,
    }
  }

  // 3. Techniek. Score onder 4 betekent techniekverlies (sectie 4.2 stap 1).
  const form = minFormQuality(log)
  if (form < FORM_MIN) {
    return {
      action: 'techniek-herstellen',
      next: keep(log, current * REDUCE_FORM, log.stepId, 'omlaag'),
      reason: `Techniekscore ${form}/5. Belasting 15% terug tot de beweging weer schoon is. Techniekverlies betekent: set over.`,
      source: 'Sectie 4.2 stap 1 / 4.3 trigger 2',
      flagged: true,
    }
  }

  // 4. RIR. Doel is 2-4 reps in reserve; tot falen gaan is geen progressie.
  const last = finalWorkSet(log)!
  if (last.rir < RIR_MIN) {
    return {
      action: 'belasting-verlagen',
      next: keep(log, current * REDUCE_RIR, log.stepId, 'omlaag'),
      reason: `RIR ${last.rir} op de laatste set. Dat is te dicht bij falen. Volgende sessie 8% lichter en opnieuw opbouwen.`,
      source: 'Sectie 4.2 / 9.2 D',
      flagged: true,
    }
  }

  // 5. Bovenkant van het bereik gehaald op alle sets → kleinste stap zwaarder.
  if (reachedTopOfRange(log)) {
    if (step.loadType === 'trede') {
      const next = advanceStep(log.ladderId, log.stepId)
      if (next) {
        return {
          action: 'trede-omhoog',
          next: {
            stepId: next.id,
            sets: log.planned.sets,
            repMin: log.planned.repMin,
            repMax: log.planned.repMax,
            load: 0,
          },
          reason: `Alle sets op ${log.planned.repMax} reps. Volgende trede: ${next.name}. Terug naar ${log.planned.repMin} reps.`,
          source: 'Sectie 3.1, calisthenics-lader',
          flagged: false,
        }
      }
      return {
        action: 'reps-toevoegen',
        next: keep(log, current),
        reason: `Bovenste trede van ${getLadder(log.ladderId).name} bereikt. Blijf reps toevoegen of overleg over verzwaren.`,
        source: 'Sectie 3.1',
        flagged: false,
      }
    }
    /*
     * Ben je tijdens de sessie al omhoog gegaan, dan is die stap genoeg. Nog
     * een stap erbovenop zou betekenen dat één goede oefening twee verhogingen
     * oplevert, en dat is precies hoe je in twee weken op een gewicht staat
     * waar je techniek niet bij past.
     */
    if (verhoogdTijdensSessie(log)) {
      return {
        action: 'reps-toevoegen',
        next: keep(log, current),
        reason: `Je bent tijdens deze sessie al naar ${roundLoad(current)} kg gegaan. Houd dat eerst een sessie vast voordat er weer een stap bij komt.`,
        source: 'Sectie 3.1, The Rule',
        flagged: false,
      }
    }

    const increased = current > 0 ? current * (1 + safety.loadStepPct / 100) : 0
    return {
      action: 'belasting-verhogen',
      next: keep(log, increased),
      reason:
        current > 0
          ? `Alle sets op ${log.planned.repMax} reps. Kleinste stap zwaarder naar ${roundLoad(increased)} kg, terug naar ${log.planned.repMin} reps.`
          : `Alle sets op ${log.planned.repMax} reps. Voeg de kleinste weerstand toe die je hebt en ga terug naar ${log.planned.repMin} reps.`,
        source: 'Sectie 3.1, The Rule',
      flagged: false,
    }
  }

  // 6. Standaard: zelfde gewicht, meer goede reps.
  const best = Math.max(...sets.map((s) => s.reps))
  return {
    action: 'reps-toevoegen',
    next: keep(log, current),
    reason: `Zelfde belasting. Doel: één goede rep meer per set, tot alle sets op ${log.planned.repMax} staan. Beste set nu: ${best}.`,
    source: 'Sectie 3.1, The Rule',
    flagged: false,
  }
}

/**
 * Totaal volume (sets x reps x belasting) van een oefening.
 * Bij bodyweight telt de trede als belastingfactor, zodat progressie in de
 * lader zichtbaar blijft in de trend (sectie 4.2, maandevaluatie).
 */
export function exerciseVolume(log: ExerciseLog): number {
  const step = getStep(log.stepId)
  return workingSets(log).reduce((total, s) => {
    const load = step.loadType === 'trede' ? step.rung * 10 : Math.max(s.load, 1)
    return total + s.reps * load
  }, 0)
}
