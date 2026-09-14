/**
 * Adaptieve planner: van signalering naar een aanpassing die het plan
 * daadwerkelijk verandert.
 *
 * Tot nu toe berekende de app wat er moest veranderen, maar veranderde er
 * niets: de gebruiker las een advies en moest het zelf onthouden. Deze module
 * maakt van dat advies een `PlanAdjustment` die in de status blijft staan en
 * het voorschrift van de komende sessies aanpast.
 *
 * Twee bronnen leveren aanpassingen aan:
 *   - `regel`  de deterministische motor uit triggers.ts en blockReview.ts
 *   - `coach`  een voorstel van de taalmodel-laag
 *
 * Beide gaan door dezelfde poort: `validateAdjustment`. Wat de veiligheidsregels
 * verbieden, komt er niet doorheen. Een voorstel is een voorstel, geen bevel.
 */

import type {
  AdjustmentKind,
  AdjustmentSource,
  AppState,
  PhaseDefinition,
  PlanAdjustment,
  PrescribedExercise,
  SafetySettings,
  SessionTemplate,
} from './types'

export type { AdjustmentKind, AdjustmentSource, PlanAdjustment }
import { advanceStep, getLadder, regressStep, tryGetStep } from './exercises'
import { HARD_CAP_JOINTS, JOINT_CAPS, jointsFor, todayIso, weeklyJointSets, weeklyVolume } from './analytics'
import { detectPlateau, historyFor, painPerExercise } from './analytics'
import { maxPain, minFormQuality, workingSets } from './rule'

export interface ValidationResult {
  allowed: boolean
  /** Waarom niet, in taal die de gebruiker kan lezen. */
  reason: string
  /** Aangepaste versie die wel mag, als die bestaat. */
  altered?: PlanAdjustment
}

/* ------------------------------------------------------------------ */
/* Veiligheidspoort                                                    */
/* ------------------------------------------------------------------ */

export interface ValidationContext {
  state: AppState
  safety: SafetySettings
  phase: PhaseDefinition
  phaseWeek: number
}

/**
 * De harde grenzen. Geen enkele bron, ook de taalmodel-laag niet, komt hier
 * langs. Dit is het verschil tussen een coach en een risico.
 */
export function validateAdjustment(adjustment: PlanAdjustment, ctx: ValidationContext): ValidationResult {
  const { state, safety } = ctx

  // 0. Medische pauze overrulet alles.
  if (state.medicalHold?.active && adjustment.kind !== 'oefening-pauzeren') {
    return {
      allowed: false,
      reason: 'Training staat gepauzeerd na een medische rode vlag. Er wordt niets aan het programma veranderd tot er groen licht is.',
    }
  }

  // 1. Een verplichte deload kan niet worden weggeduwd.
  if (adjustment.kind === 'sets-omhoog' && isDeloadImminent(ctx)) {
    return {
      allowed: false,
      reason: 'Deze week of de volgende is een deloadweek. Volume verhogen vlak voor een deload haalt precies weg wat de deload moet opleveren.',
    }
  }

  // 2. Volume verhogen mag niet bij recente pijn op die oefening.
  if (adjustment.kind === 'sets-omhoog' || adjustment.kind === 'trede-omhoog') {
    const ladderId = adjustment.ladderId
    if (ladderId) {
      const pains = painPerExercise(state.sessions, ladderId, 3)
      const worst = Math.max(0, ...pains)
      if (worst >= safety.painCeiling) {
        return {
          allowed: false,
          reason: `${getLadder(ladderId).name} gaf recent pijn ${worst} van 10. Zwaarder maken is hier het verkeerde antwoord.`,
        }
      }
      const forms = historyFor(state.sessions, ladderId).slice(-2).map(({ log }) => minFormQuality(log))
      if (forms.length > 0 && Math.min(...forms) < 4) {
        return {
          allowed: false,
          reason: `De techniek op ${getLadder(ladderId).name} staat nog niet. Eerst schoon, dan zwaarder.`,
        }
      }
    }
  }

  // 3. Volumeplafond per gewricht (sectie 9.2, systeem B).
  if (adjustment.kind === 'sets-omhoog' && adjustment.ladderId) {
    const totals = weeklyJointSets(state.sessions)
    const joints = jointsFor(adjustment.ladderId).filter((joint) => HARD_CAP_JOINTS.includes(joint))
    const over = joints.find((joint) => totals[joint] + (adjustment.amount ?? 1) > JOINT_CAPS[joint])
    if (over) {
      return {
        allowed: false,
        reason: `Het volumeplafond voor ${over} is deze week al bereikt (${totals[over]} van ${JOINT_CAPS[over]} sets). Hier komt niets meer bij.`,
      }
    }
  }

  // 4. Meer dan één set tegelijk erbij is twee variabelen tegelijk.
  if (adjustment.kind === 'sets-omhoog' && (adjustment.amount ?? 1) > 1) {
    return {
      allowed: true,
      reason: 'Teruggebracht tot één set. Twee variabelen tegelijk veranderen maakt onvindbaar wat werkte.',
      altered: { ...adjustment, amount: 1 },
    }
  }

  // 5. Snelheid van opbouw (sectie 9.2, systeem A).
  //
  // Eén set is de kleinste stap die bestaat. Bij een streng profiel is die
  // stap al meer dan de weekgrens toestaat, en dan zou de regel elke verhoging
  // voorgoed verbieden. Dat is geen voorzichtigheid maar een doodlopende weg:
  // de gebruiker die de meeste bescherming nodig heeft, zou als enige nooit
  // meer vooruit kunnen. De grens begrenst daarom de snelheid, niet de stap:
  // je mag de stap zetten, maar daarna moet je lang genoeg wachten zodat het
  // gemiddelde onder de grens blijft.
  if (adjustment.kind === 'sets-omhoog') {
    const baseline = toleratedWeeklySets(state)
    if (baseline > 0) {
      // Een set erbij telt zo vaak als de oefening per week terugkomt, niet zo
      // vaak als je traint: een squat in de lower-A sessie komt één keer langs.
      const perWeek = occurrencesPerWeek(state, adjustment.ladderId)
      const added = (adjustment.amount ?? 1) * perWeek
      const increase = (added / baseline) * 100

      if (increase > 25) {
        return {
          allowed: false,
          reason: `Eén set erbij is hier ${Math.round(increase)}% van je weekvolume. Dat zegt meer over hoe klein het programma nu is dan over de set. Bouw eerst een paar weken op wat er staat.`,
        }
      }

      const weeksToWait = Math.min(6, Math.ceil(increase / safety.maxWeeklyVolumeIncreasePct))
      if (weeksToWait > 1) {
        const last = lastVolumeIncrease(state)
        if (last !== null && last < weeksToWait) {
          return {
            allowed: false,
            reason: `Je hebt ${last === 0 ? 'deze week' : `${last} ${last === 1 ? 'week' : 'weken'} geleden`} al volume toegevoegd. Met jouw opbouwgrens van ${safety.maxWeeklyVolumeIncreasePct}% per week mag de volgende stap na ${weeksToWait} weken.`,
          }
        }
      }
    }
  }

  // 6. Een trede omhoog vraagt een volle lader onder je.
  if (adjustment.kind === 'trede-omhoog' && adjustment.ladderId) {
    const history = historyFor(state.sessions, adjustment.ladderId)
    if (history.length < 3) {
      return {
        allowed: false,
        reason: `Nog te weinig sessies op ${getLadder(adjustment.ladderId).name} om een trede omhoog te verantwoorden.`,
      }
    }
    const last = history[history.length - 1].log
    const reachedTop = workingSets(last).every((s) => s.reps >= last.planned.repMax)
    if (!reachedTop) {
      return {
        allowed: false,
        reason: `De bovenkant van het repbereik is nog niet gehaald op ${getLadder(adjustment.ladderId).name}. Dat is de voorwaarde, niet het gevoel.`,
      }
    }
  }

  // 7. Repbereiken buiten wat de fase kent.
  if (adjustment.kind === 'repbereik-wijzigen') {
    const min = adjustment.repMin ?? 0
    const max = adjustment.repMax ?? 0
    if (min < 1 || max < min) {
      return { allowed: false, reason: 'Ongeldig repbereik.' }
    }
    if (min < 3) {
      return {
        allowed: true,
        reason: 'Ondergrens opgetrokken naar 3 reps. Lager hoort bij maximaalkracht, en dat zit niet in dit programma.',
        altered: { ...adjustment, repMin: 3, repMax: Math.max(3, max) },
      }
    }
  }

  return { allowed: true, reason: 'Past binnen de veiligheidsregels.' }
}

/**
 * Het weekvolume dat de gebruiker aantoonbaar verdraagt: het hoogste aantal
 * werksets in een van de laatste vier niet-deloadweken. De lopende week telt
 * mee, maar is nooit de enige maatstaf: halverwege de week is die bak nog
 * halfleeg, en daartegen afzetten laat elke toevoeging op honderden procenten
 * uitkomen.
 */
function toleratedWeeklySets(state: AppState): number {
  const weeks = weeklyVolume(state.sessions.filter((s) => !s.isDeload)).slice(-4)
  return weeks.length === 0 ? 0 : Math.max(...weeks.map((w) => w.sets))
}

/**
 * Hoeveel hele weken geleden er voor het laatst volume is toegevoegd.
 * `null` betekent: nog nooit.
 */
function lastVolumeIncrease(state: AppState): number | null {
  const increases = state.adjustments
    .filter((a) => a.accepted && a.kind === 'sets-omhoog')
    .map((a) => Math.floor((Date.parse(todayIso()) - Date.parse(a.createdAt)) / (7 * 86_400_000)))
  return increases.length === 0 ? null : Math.min(...increases)
}

/** Hoe vaak een oefening de afgelopen twee weken per week langskwam. */
function occurrencesPerWeek(state: AppState, ladderId: string | undefined): number {
  if (!ladderId) return 1
  const recent = state.sessions.filter((s) => {
    const age = (Date.parse(todayIso()) - Date.parse(s.date)) / 86_400_000
    return age >= 0 && age <= 14
  })
  const hits = recent.filter((s) => s.exercises.some((e) => e.ladderId === ladderId)).length
  return Math.max(1, Math.round(hits / 2))
}

function isDeloadImminent(ctx: ValidationContext): boolean {
  const remainder = ctx.phaseWeek % ctx.safety.deloadIntervalWeeks
  return remainder === 0 || ctx.safety.deloadIntervalWeeks - remainder === 1
}

/* ------------------------------------------------------------------ */
/* Aanpassingen toepassen op het programma                             */
/* ------------------------------------------------------------------ */

function isActive(adjustment: PlanAdjustment, today: string): boolean {
  if (!adjustment.accepted) return false
  if (adjustment.expiresAfterWeeks === undefined) return true
  const ageDays = (Date.parse(today) - Date.parse(adjustment.createdAt)) / 86_400_000
  return ageDays <= adjustment.expiresAfterWeeks * 7
}

export function activeAdjustments(adjustments: PlanAdjustment[], today = todayIso()): PlanAdjustment[] {
  return adjustments.filter((a) => isActive(a, today))
}

function applyToExercise(exercise: PrescribedExercise, adjustments: PlanAdjustment[]): PrescribedExercise | null {
  let result = { ...exercise }

  for (const adjustment of adjustments) {
    if (adjustment.ladderId && adjustment.ladderId !== exercise.ladderId) continue

    switch (adjustment.kind) {
      case 'oefening-pauzeren':
        // Alleen als de aanpassing deze lader expliciet noemt: een pauze op
        // het hele programma is de medische hold, niet dit.
        if (adjustment.ladderId === exercise.ladderId) return null
        break
      case 'sets-omhoog':
        result = { ...result, sets: result.sets + (adjustment.amount ?? 1) }
        break
      case 'sets-omlaag':
        result = { ...result, sets: Math.max(1, result.sets - (adjustment.amount ?? 1)) }
        break
      case 'trede-omlaag': {
        const lower = regressStep(result.ladderId, result.stepId)
        if (lower) result = { ...result, stepId: lower.id }
        break
      }
      case 'trede-omhoog': {
        const higher = advanceStep(result.ladderId, result.stepId)
        if (higher) result = { ...result, stepId: higher.id }
        break
      }
      case 'repbereik-wijzigen':
        result = {
          ...result,
          repMin: adjustment.repMin ?? result.repMin,
          repMax: adjustment.repMax ?? result.repMax,
        }
        break
      default:
        break
    }
  }

  return result
}

/** Past de geaccepteerde aanpassingen toe op de sessiesjablonen. */
export function applyAdjustments(
  templates: SessionTemplate[],
  adjustments: PlanAdjustment[],
  today = todayIso(),
): SessionTemplate[] {
  const active = activeAdjustments(adjustments, today)
  if (active.length === 0) return templates

  return templates.map((template) => ({
    ...template,
    main: template.main
      .map((exercise) => applyToExercise(exercise, active))
      .filter((exercise): exercise is PrescribedExercise => exercise !== null),
  }))
}

/** Vervroegde deload: staat er een geaccepteerde aanpassing die dat vraagt? */
export function deloadForcedEarly(adjustments: PlanAdjustment[], today = todayIso()): boolean {
  return activeAdjustments(adjustments, today).some((a) => a.kind === 'deload-vervroegen')
}

/* ------------------------------------------------------------------ */
/* De deterministische motor                                           */
/* ------------------------------------------------------------------ */

let counter = 0
function nextId(prefix: string): string {
  counter += 1
  return `${prefix}-${Date.now().toString(36)}-${counter}`
}

/**
 * Leidt uit de gelogde data af welke aanpassingen het programma nodig heeft.
 * Deze voorstellen zijn de basis; de taalmodel-laag voegt hooguit toelichting
 * of een alternatief toe.
 */
export function proposeAdjustments(ctx: ValidationContext): PlanAdjustment[] {
  const { state, safety } = ctx
  const proposals: PlanAdjustment[] = []
  const today = todayIso()
  const ladderIds = [...new Set(state.sessions.flatMap((s) => s.exercises.map((e) => e.ladderId)))]
  const stalled: Array<{ ladderId: string; name: string; sessions: number }> = []

  for (const ladderId of ladderIds) {
    const history = historyFor(state.sessions, ladderId)
    if (history.length === 0) continue
    const name = getLadder(ladderId).name

    // Pijn boven de grens: trede terug, of pauzeren bij een piek.
    const pains = painPerExercise(state.sessions, ladderId, 3)
    const worst = Math.max(0, ...pains)
    if (worst >= 5) {
      proposals.push({
        id: nextId('pauze'),
        kind: 'oefening-pauzeren',
        ladderId,
        reason: `${name} gaf pijn ${worst} van 10. Pauzeren tot de klacht zakt, daarna opnieuw opbouwen vanaf een lagere trede.`,
        source: 'regel',
        createdAt: today,
        expiresAfterWeeks: 2,
        accepted: false,
      })
    } else if (pains.length >= 3 && pains.every((p) => p >= safety.painCeiling)) {
      const lower = regressStep(ladderId, history[history.length - 1].log.stepId)
      if (lower) {
        proposals.push({
          id: nextId('regressie'),
          kind: 'trede-omlaag',
          ladderId,
          reason: `Drie sessies op rij pijn op ${name}. Terug naar ${lower.name} en de 24-uursreactie volgen.`,
          source: 'regel',
          createdAt: today,
          expiresAfterWeeks: 4,
          accepted: false,
        })
      }
    }

    // Techniekverlies: belasting terug via een tredestap.
    const forms = history.slice(-2).map(({ log }) => minFormQuality(log))
    if (forms.length === 2 && forms.every((f) => f <= 3)) {
      const lower = regressStep(ladderId, history[history.length - 1].log.stepId)
      if (lower) {
        proposals.push({
          id: nextId('techniek'),
          kind: 'trede-omlaag',
          ladderId,
          reason: `Techniek op ${name} zakte twee sessies achter elkaar naar ${Math.min(...forms)} van 5. Een trede terug tot de beweging weer schoon is.`,
          source: 'regel',
          createdAt: today,
          expiresAfterWeeks: 3,
          accepted: false,
        })
      }
    }

    // Plateau bij goed herstel: kandidaat voor één set erbij. Of dat echt een
    // voorstel wordt, hangt af van hoeveel oefeningen tegelijk stilstaan.
    const plateau = detectPlateau(state.sessions, ladderId)
    if (plateau.stalled && worst < safety.painCeiling) {
      stalled.push({ ladderId, name, sessions: plateau.stalledSessions })
    }
  }

  // Eén oefening die stilstaat is een oefeningprobleem en krijgt een set erbij.
  // Staat het merendeel stil, dan is het een herstelprobleem: dan komt er één
  // voorstel voor een vervroegde deload, niet vijf losse setverhogingen die
  // samen een volumesprong van tientallen procenten zouden opleveren. Dit is
  // dezelfde tweedeling als de beslisboom van sectie 6.3 maakt.
  if (stalled.length >= 3) {
    proposals.push({
      id: nextId('deload'),
      kind: 'deload-vervroegen',
      reason: `${stalled.length} oefeningen staan tegelijk stil. Als alles tegelijk stilvalt is meer volume zelden het antwoord; een deloadweek naar voren halen is de zuinigste zet.`,
      source: 'regel',
      createdAt: today,
      expiresAfterWeeks: 2,
      accepted: false,
    })
  } else {
    for (const item of stalled) {
      const candidate: PlanAdjustment = {
        id: nextId('plateau'),
        kind: 'sets-omhoog',
        ladderId: item.ladderId,
        amount: 1,
        reason: `${item.name} staat ${item.sessions} sessies stil. Eén set erbij is de kleinste zinvolle prikkel.`,
        source: 'regel',
        createdAt: today,
        expiresAfterWeeks: 6,
        accepted: false,
      }
      const check = validateAdjustment(candidate, ctx)
      if (check.allowed) proposals.push(check.altered ?? candidate)
    }
  }

  // Lage opkomst: volume omlaag in plaats van het schema laten verlopen.
  const recent = state.sessions.filter((s) => s.phase === ctx.phase.id)
  const expected = ctx.phase.sessionsPerWeek * Math.max(1, ctx.phaseWeek)
  if (ctx.phaseWeek >= 3 && recent.length / expected < 0.6) {
    proposals.push({
      id: nextId('volume'),
      kind: 'sets-omlaag',
      amount: 1,
      reason: `Je haalt ${recent.length} van ${expected} sessies. Een korter programma dat je wel doet verslaat een volledig programma dat blijft liggen.`,
      source: 'regel',
      createdAt: today,
      expiresAfterWeeks: 4,
      accepted: false,
    })
  }

  return proposals
}

/** Korte omschrijving van een aanpassing, voor lijsten en bevestigingen. */
export function describeAdjustment(adjustment: PlanAdjustment): string {
  const target = adjustment.ladderId ? getLadder(adjustment.ladderId).name : 'Hele programma'
  switch (adjustment.kind) {
    case 'sets-omhoog':
      return `${target}: ${adjustment.amount ?? 1} set erbij`
    case 'sets-omlaag':
      return `${target}: ${adjustment.amount ?? 1} set eraf`
    case 'trede-omlaag':
      return `${target}: één trede terug`
    case 'trede-omhoog':
      return `${target}: één trede vooruit`
    case 'oefening-pauzeren':
      return `${target}: gepauzeerd`
    case 'repbereik-wijzigen':
      return `${target}: repbereik naar ${adjustment.repMin}-${adjustment.repMax}`
    case 'deload-vervroegen':
      return 'Deloadweek naar voren halen'
    case 'frequentie-omlaag':
      return 'Eén sessie per week minder'
  }
}

/** Naam van de huidige trede, voor toelichting in de interface. */
export function currentStepName(stepId: string): string | null {
  return tryGetStep(stepId)?.name ?? null
}

export function maxPainFor(state: AppState, ladderId: string): number {
  const history = historyFor(state.sessions, ladderId)
  return Math.max(0, ...history.map(({ log }) => maxPain(log)))
}
