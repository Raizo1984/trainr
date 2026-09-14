/**
 * Fase-gates (secties 3.3 en 6.4).
 *
 * Alle criteria moeten groen zijn om door te stromen. Eén geel criterium
 * betekent de fase verlengen, rood betekent eerst een professionele beoordeling.
 * Tijd is geen criterium; tijd is hooguit een waarschuwing dat we te vroeg kijken.
 */

import type {
  AppState,
  GateCriterionResult,
  GateEvaluation,
  GateStatus,
  PhaseDefinition,
  SessionLog,
} from './types'
import { adherence, average, formTrend, peakPain, round1 } from './analytics'
import { summarise } from './movement'
import { heaviestLoad, workingSets } from './rule'

function status(order: GateStatus[]): GateStatus {
  if (order.includes('rood')) return 'rood'
  if (order.includes('onbekend')) return 'onbekend'
  if (order.includes('geel')) return 'geel'
  return 'groen'
}

function adherenceCriterion(sessions: SessionLog[], phase: PhaseDefinition, weeks: number): GateCriterionResult {
  const { done, planned, ratio } = adherence(sessions, phase.sessionsPerWeek, weeks)
  const pct = Math.round(ratio * 100)
  return {
    id: 'adherence',
    label: 'Opkomst',
    requirement: 'Minimaal 80% van de geplande sessies afgerond',
    status: sessions.length === 0 ? 'onbekend' : ratio >= 0.8 ? 'groen' : ratio >= 0.65 ? 'geel' : 'rood',
    value: `${pct}% (${done} van ${planned})`,
    explanation:
      ratio >= 0.8
        ? 'Je komt opdagen. Dat is de enige variabele die over vier jaar echt telt.'
        : 'Onder de 80% is het programma niet te beoordelen. Eerst de planning passend maken, dan pas doorstromen.',
  }
}

/**
 * Pijn beoordelen op pieken, niet op een gemiddelde: vier sessies met 0 en
 * vier met 6 komen gemiddeld op 3 uit, terwijl dat precies het patroon is dat
 * je niet wilt doorlaten. De eis luidt "meestal 0-2/10", dus telt het aandeel
 * sessies boven die grens, plus elke 24-uursverslechtering.
 */
function painCriterion(sessions: SessionLog[]): GateCriterionResult {
  if (sessions.length === 0) {
    return {
      id: 'pijn',
      label: 'Pijn',
      requirement: 'Overwegend 0-2/10 en geen 24-uursverslechteringen',
      status: 'onbekend',
      value: 'geen data',
      explanation: 'Zonder gelogde sessies valt hier niets over te zeggen.',
    }
  }

  const peaks = sessions.map(peakPain)
  const avg = average(peaks) ?? 0
  const high = peaks.filter((p) => p >= 5).length
  const elevated = peaks.filter((p) => p >= 3).length
  const elevatedShare = elevated / peaks.length

  const worsenings = sessions.filter((s) => {
    const during = peakPain({ ...s, followUp: null })
    const after = Object.values(s.followUp?.painByRegion ?? {}).reduce<number>((m, v) => Math.max(m, v ?? 0), 0)
    return after > during + 1
  }).length

  let state: GateStatus
  if (high > 0 || elevatedShare > 0.25 || worsenings >= 2) state = 'rood'
  else if (elevatedShare > 0 || worsenings === 1 || avg > 2) state = 'geel'
  else state = 'groen'

  return {
    id: 'pijn',
    label: 'Pijn',
    requirement: 'Overwegend 0-2/10 en geen 24-uursverslechteringen',
    status: state,
    value: `gemiddeld ${round1(avg)}/10, ${elevated} van ${peaks.length} sessies boven 2, ${worsenings} verslechtering(en)`,
    explanation:
      state === 'groen'
        ? 'Je lichaam verdraagt de belasting. Dat is precies wat deze fase moest opleveren.'
        : state === 'geel'
          ? 'Nog niet alarmerend, maar te vaak boven de grens om zwaarder te gaan belasten.'
          : 'Zolang pijn oploopt of pieken terugkomen, is meer volume geen vooruitgang maar uitstel van een probleem.',
  }
}

function techniqueCriterion(sessions: SessionLog[]): GateCriterionResult {
  const ladderIds = [...new Set(sessions.flatMap((s) => s.exercises.map((e) => e.ladderId)))]
  const scores = ladderIds.flatMap((id) => formTrend(sessions, id, 3))
  const avg = average(scores)
  const weakest = scores.length > 0 ? Math.min(...scores) : null
  let state: GateStatus = 'onbekend'
  if (avg !== null) {
    if (avg >= 4 && (weakest ?? 5) >= 3) state = 'groen'
    else if (avg >= 3.5) state = 'geel'
    else state = 'rood'
  }
  return {
    id: 'techniek',
    label: 'Techniek',
    requirement: 'Basispatronen gecontroleerd reproduceerbaar (vormscore 4+)',
    status: state,
    value: avg === null ? 'geen data' : `gemiddeld ${round1(avg)}/5`,
    explanation:
      state === 'groen'
        ? 'De patronen staan. Zwaarder worden is nu verantwoord.'
        : 'Zwaarder trainen op een wankel patroon versnelt niets, behalve de blessure.',
  }
}

function recoveryCriterion(sessions: SessionLog[]): GateCriterionResult {
  const sleep = average(sessions.map((s) => s.vitals.sleepQuality))
  const stress = average(sessions.map((s) => s.vitals.stress))
  let state: GateStatus = 'onbekend'
  if (sleep !== null && stress !== null) {
    if (sleep >= 3 && stress <= 3.5) state = 'groen'
    else if (sleep >= 2.5) state = 'geel'
    else state = 'rood'
  }
  return {
    id: 'slaap-stress',
    label: 'Slaap en stress',
    requirement: 'Stabiel, geen chronische vermoeidheid',
    status: state,
    value:
      sleep === null ? 'geen data' : `slaap ${round1(sleep)}/5, stress ${round1(stress ?? 0)}/5`,
    explanation:
      state === 'groen'
        ? 'Herstel is op orde. Dat is de bodem onder elke verhoging.'
        : 'Meer trainen zonder herstel is meer schade zonder meer aanpassing.',
  }
}

function performanceCriterion(sessions: SessionLog[]): GateCriterionResult {
  const ladderIds = [...new Set(sessions.flatMap((s) => s.exercises.map((e) => e.ladderId)))]
  let improved = 0
  let counted = 0
  for (const ladderId of ladderIds) {
    const logs = sessions
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date))
      .flatMap((s) => s.exercises.filter((e) => e.ladderId === ladderId))
    if (logs.length < 3) continue
    counted++
    const first = logs[0]
    const last = logs[logs.length - 1]
    const firstScore = heaviestLoad(first) * 10 + Math.max(...workingSets(first).map((s) => s.reps), 0)
    const lastScore = heaviestLoad(last) * 10 + Math.max(...workingSets(last).map((s) => s.reps), 0)
    if (lastScore > firstScore) improved++
  }
  const ratio = counted === 0 ? null : improved / counted
  return {
    id: 'prestatie',
    label: 'Prestatie',
    requirement: 'Aantoonbare progressie op de kernoefeningen',
    status: ratio === null ? 'onbekend' : ratio >= 0.7 ? 'groen' : ratio >= 0.5 ? 'geel' : 'rood',
    value: ratio === null ? 'te weinig data' : `${improved} van ${counted} oefeningen vooruit`,
    explanation:
      ratio !== null && ratio >= 0.7
        ? 'The Rule doet zijn werk. Belasting en reps lopen op zonder dat pijn of techniek inlevert.'
        : 'Als het merendeel stilstaat, ligt de oorzaak meestal buiten het programma: herstel, voeding of planning.',
  }
}

function confirmationCriterion(
  id: 'bewegingsruimte' | 'voeding' | 'medisch',
  label: string,
  requirement: string,
  confirmed: boolean | undefined,
  explanation: string,
): GateCriterionResult {
  return {
    id,
    label,
    requirement,
    status: confirmed === true ? 'groen' : confirmed === false ? 'rood' : 'onbekend',
    value: confirmed === true ? 'bevestigd' : confirmed === false ? 'niet in orde' : 'nog te bevestigen',
    explanation,
  }
}

/**
 * Bewegingsruimte. Zodra er een bewegingskwaliteit-beoordeling ligt, leidt de
 * app dit af uit die data in plaats van uit een vinkje. Zonder beoordeling
 * valt het terug op de handmatige bevestiging.
 */
function movementCriterion(state: AppState, requirement: string): GateCriterionResult {
  const latest = state.movementAssessments[state.movementAssessments.length - 1] ?? null
  const summary = summarise(latest)

  if (summary.gradedItems === 0) {
    return confirmationCriterion(
      'bewegingsruimte',
      'Bewegingsruimte',
      requirement,
      state.phase.confirmations.bewegingsruimte,
      'Er ligt nog geen bewegingsbeoordeling. Leg die vast bij Metingen, dan vult dit criterium zichzelf.',
    )
  }

  const status: GateStatus = summary.worst === 'rood' ? 'rood' : summary.worst === 'geel' ? 'geel' : 'groen'
  return {
    id: 'bewegingsruimte',
    label: 'Bewegingsruimte',
    requirement,
    status,
    value: `${summary.completed} van ${summary.total} patronen beoordeeld, slechtste ${summary.worst}`,
    explanation:
      status === 'groen'
        ? 'De patronen die de volgende fase vraagt zijn uitvoerbaar binnen een pijnvrij bereik.'
        : summary.limits[0] ?? 'Eén of meer patronen vragen aandacht voordat de belasting omhoog kan.',
  }
}

export function evaluateGate(state: AppState, phase: PhaseDefinition, weeksInPhase: number): GateEvaluation {
  const sessions = state.sessions.filter((s) => s.phase === phase.id)
  const criteria: GateCriterionResult[] = phase.gateCriteria.map((def) => {
    switch (def.id) {
      case 'adherence':
        return adherenceCriterion(sessions, phase, weeksInPhase)
      case 'pijn':
        return painCriterion(sessions)
      case 'techniek':
        return techniqueCriterion(sessions)
      case 'slaap-stress':
        return recoveryCriterion(sessions)
      case 'prestatie':
        return performanceCriterion(sessions)
      case 'bewegingsruimte':
        return movementCriterion(state, def.requirement)
      case 'voeding':
        return confirmationCriterion(
          'voeding',
          'Voeding',
          def.requirement,
          state.phase.confirmations.voeding,
          'Zonder afgesproken voedingsplan bouw je op een basis die er niet is.',
        )
      case 'medisch':
        return confirmationCriterion(
          'medisch',
          'Medisch',
          def.requirement,
          state.phase.confirmations.medisch,
          'Klachten horen benoemd te zijn voordat je er zwaarder op gaat belasten.',
        )
      default:
        return {
          id: def.id,
          label: def.label,
          requirement: def.requirement,
          status: 'onbekend' as GateStatus,
          value: 'geen data',
          explanation: '',
        }
    }
  })

  const overall = status(criteria.map((c) => c.status))
  const tooEarly = weeksInPhase < phase.minWeeks

  let decision: GateEvaluation['decision']
  let summary: string

  if (criteria.every((c) => c.status === 'onbekend')) {
    decision = 'nog-niet-beoordeelbaar'
    summary = 'Nog te weinig data. Log sessies en metingen, dan wordt dit vanzelf beoordeelbaar.'
  } else if (overall === 'rood') {
    decision = 'professionele-beoordeling'
    summary =
      'Eén of meer criteria staan op rood. Dat is geen falen, het is informatie: eerst dat oplossen, daarna doorstromen.'
  } else if (overall === 'groen' && !tooEarly) {
    decision = 'doorstromen'
    summary = 'Alle criteria groen en de minimumduur is gehaald. Je bent klaar voor de volgende fase.'
  } else if (overall === 'groen' && tooEarly) {
    decision = 'verlengen'
    summary = `Alles groen, maar deze fase kent een minimum van ${phase.minWeeks} weken. Bindweefsel houdt zich niet aan enthousiasme.`
  } else {
    decision = 'verlengen'
    summary = 'Nog niet alles groen. De fase wordt met 4 tot 8 weken verlengd op de zwakke punten.'
  }

  return { phase: phase.id, criteria, decision, summary, weeksInPhase }
}
