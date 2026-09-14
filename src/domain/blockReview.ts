/**
 * Blokevaluatie (sectie 6.3). Draait automatisch in de deloadweek.
 *
 * Het punt van deze module is de beslisboom: niet "hoe ging het", maar
 * "wat doen we het volgende blok anders, en waarom". Precies één aanpassing
 * per blok, want twee tegelijk maakt onvindbaar wat werkte.
 */

import type { PhaseDefinition, SessionLog } from './types'
import { adherence, average, historyFor, peakPain, round1 } from './analytics'
import { getLadder } from './exercises'
import { heaviestLoad, minFormQuality, workingSets } from './rule'

export type BlockDecision =
  | 'doorgaan'
  | 'oefening-vervangen'
  | 'plateau-onderzoeken'
  | 'regressie'
  | 'planning-aanpassen'

export interface BlockMetric {
  label: string
  value: string
  trend: 'op' | 'stabiel' | 'af' | 'onbekend'
  comment: string
}

export interface BlockReview {
  /** Sessies in dit blok. */
  sessionCount: number
  weeks: number
  metrics: BlockMetric[]
  decision: BlockDecision
  headline: string
  reasoning: string
  /** Precies één aanpassing voor het volgende blok. */
  action: string
  /** Oefeningen die pijn gaven of vervangen moeten worden. */
  problemExercises: Array<{ ladderId: string; name: string; reason: string }>
}

/** Sessies van het meest recente blok, plus die van het blok ervoor. */
export function splitIntoBlocks(
  sessions: SessionLog[],
  blockWeeks: number,
): { current: SessionLog[]; previous: SessionLog[] } {
  const sorted = sessions.slice().sort((a, b) => a.date.localeCompare(b.date))
  if (sorted.length === 0) return { current: [], previous: [] }

  const lastWeek = sorted[sorted.length - 1].phaseWeek
  const currentStart = Math.max(1, lastWeek - blockWeeks + 1)
  const previousStart = Math.max(1, currentStart - blockWeeks)

  return {
    current: sorted.filter((s) => s.phaseWeek >= currentStart),
    previous: sorted.filter((s) => s.phaseWeek >= previousStart && s.phaseWeek < currentStart),
  }
}

function loadTrend(current: SessionLog[], previous: SessionLog[]): { improved: number; counted: number } {
  const ladderIds = [...new Set(current.flatMap((s) => s.exercises.map((e) => e.ladderId)))]
  let improved = 0
  let counted = 0
  for (const ladderId of ladderIds) {
    const now = historyFor(current, ladderId).filter(({ session }) => !session.isDeload)
    const before = historyFor(previous, ladderId).filter(({ session }) => !session.isDeload)
    if (now.length === 0 || before.length === 0) continue
    counted++
    const nowBest = Math.max(...now.map(({ log }) => heaviestLoad(log) * 10 + Math.max(0, ...workingSets(log).map((s) => s.reps))))
    const beforeBest = Math.max(...before.map(({ log }) => heaviestLoad(log) * 10 + Math.max(0, ...workingSets(log).map((s) => s.reps))))
    if (nowBest > beforeBest) improved++
  }
  return { improved, counted }
}

function findProblemExercises(sessions: SessionLog[]): BlockReview['problemExercises'] {
  const ladderIds = [...new Set(sessions.flatMap((s) => s.exercises.map((e) => e.ladderId)))]
  const problems: BlockReview['problemExercises'] = []

  for (const ladderId of ladderIds) {
    const logs = historyFor(sessions, ladderId)
    if (logs.length === 0) continue

    const pains = logs.flatMap(({ log }) => workingSets(log).map((s) => s.pain))
    const worst = Math.max(0, ...pains)
    const painful = pains.filter((p) => p >= 3).length

    if (worst >= 5) {
      problems.push({ ladderId, name: getLadder(ladderId).name, reason: `Pijn tot ${worst}/10 in dit blok` })
    } else if (painful >= 3) {
      problems.push({ ladderId, name: getLadder(ladderId).name, reason: `${painful} sets met pijn 3 of hoger` })
    } else {
      const forms = logs.map(({ log }) => minFormQuality(log))
      const worstForm = Math.min(5, ...forms)
      if (worstForm <= 2) {
        problems.push({ ladderId, name: getLadder(ladderId).name, reason: `Techniek zakte tot ${worstForm}/5` })
      }
    }

    const substituted = logs.filter(({ log }) => log.substitutionReason)
    if (substituted.length > 0 && !problems.some((p) => p.ladderId === ladderId)) {
      problems.push({ ladderId, name: getLadder(ladderId).name, reason: 'Moest vervangen worden tijdens het blok' })
    }
  }
  return problems
}

export function reviewBlock(
  sessions: SessionLog[],
  phase: PhaseDefinition,
  blockWeeks: number,
): BlockReview | null {
  const { current, previous } = splitIntoBlocks(sessions, blockWeeks)
  if (current.length < 3) return null

  const metrics: BlockMetric[] = []

  // 1. Opkomst.
  const { done, planned, ratio } = adherence(current, phase.sessionsPerWeek, blockWeeks)
  metrics.push({
    label: 'Sessies afgerond',
    value: `${done} van ${planned} (${Math.round(ratio * 100)}%)`,
    trend: ratio >= 0.8 ? 'op' : ratio >= 0.65 ? 'stabiel' : 'af',
    comment:
      ratio >= 0.8
        ? 'Genoeg sessies om het blok te kunnen beoordelen.'
        : 'Te weinig sessies om conclusies aan het programma te verbinden.',
  })

  // 2. Belastingprogressie ten opzichte van het vorige blok.
  const { improved, counted } = loadTrend(current, previous)
  metrics.push({
    label: 'Progressie op oefeningen',
    value: counted === 0 ? 'geen vergelijking mogelijk' : `${improved} van ${counted} vooruit`,
    trend: counted === 0 ? 'onbekend' : improved / counted >= 0.6 ? 'op' : improved > 0 ? 'stabiel' : 'af',
    comment:
      counted === 0
        ? 'Eerste blok in deze fase, dus er is nog niets om mee te vergelijken.'
        : 'Vergeleken met hetzelfde aantal weken daarvoor.',
  })

  // 3. Pijn.
  const painNow = average(current.map(peakPain)) ?? 0
  const painBefore = previous.length > 0 ? average(previous.map(peakPain)) : null
  const painDelta = painBefore === null ? 0 : painNow - painBefore
  metrics.push({
    label: 'Pijn',
    value: `gemiddeld ${round1(painNow)}/10${painBefore === null ? '' : ` (was ${round1(painBefore)})`}`,
    trend: painBefore === null ? 'onbekend' : painDelta < -0.4 ? 'op' : painDelta > 0.4 ? 'af' : 'stabiel',
    comment: painNow <= 2 ? 'Binnen de marge waarin doortrainen verantwoord is.' : 'Boven de grens die de fase stelt.',
  })

  // 4. Techniek.
  const forms = current.flatMap((s) => s.exercises.map(minFormQuality))
  const formAvg = average(forms) ?? 5
  metrics.push({
    label: 'Techniek',
    value: `gemiddeld ${round1(formAvg)}/5`,
    trend: formAvg >= 4.2 ? 'op' : formAvg >= 3.6 ? 'stabiel' : 'af',
    comment: formAvg >= 4 ? 'De patronen houden stand onder de belasting.' : 'Techniek levert in. Dat gaat voor op meer gewicht.',
  })

  // 5. Herstel.
  const sleep = average(current.map((s) => s.vitals.sleepQuality))
  const energy = average(current.map((s) => s.vitals.energy))
  metrics.push({
    label: 'Herstel',
    value: sleep === null ? 'geen data' : `slaap ${round1(sleep)}/5, energie ${round1(energy ?? 0)}/5`,
    trend: (sleep ?? 0) >= 3.5 ? 'op' : (sleep ?? 0) >= 2.8 ? 'stabiel' : 'af',
    comment: (sleep ?? 0) >= 3 ? 'Herstel houdt de belasting bij.' : 'Herstel is de beperkende factor, niet het programma.',
  })

  const problemExercises = findProblemExercises(current)

  // De beslisboom uit sectie 6.3, in volgorde van zwaarte.
  let decision: BlockDecision
  let headline: string
  let reasoning: string
  let action: string

  if (painNow > 2.5 || problemExercises.some((p) => p.reason.includes('Pijn tot'))) {
    decision = 'regressie'
    headline = 'Pijn is in dit blok opgelopen'
    reasoning =
      'Zolang pijn de bepalende factor is, zegt de rest van de cijfers weinig. Meer volume maakt het probleem groter, niet kleiner.'
    action = problemExercises.length > 0
      ? `Zet ${problemExercises[0].name} een trede terug en houd de 24-uursreactie twee weken bij. Blijft het aanhouden, laat het dan beoordelen.`
      : 'Zet de zwaarste oefeningen een trede terug en houd de 24-uursreactie twee weken bij.'
  } else if (ratio < 0.75) {
    decision = 'planning-aanpassen'
    headline = 'Te weinig sessies om het blok te beoordelen'
    reasoning =
      'Het programma is niet de variabele die hier klopt of niet klopt. Een schema dat je haalt verslaat een schema dat perfect is.'
    action = 'Kies er één: sessies verplaatsen, korter maken, of een dag minder per week. Volgend blok opnieuw meten.'
  } else if (problemExercises.length === 1) {
    decision = 'oefening-vervangen'
    headline = `Eén oefening werkt niet: ${problemExercises[0].name}`
    reasoning = `${problemExercises[0].reason}. De rest van het blok liep goed, dus dit is een oefeningprobleem en geen programmaprobleem.`
    action = `Vervang ${problemExercises[0].name} door een variant uit dezelfde lader. De rest blijft ongewijzigd.`
  } else if (counted > 0 && improved === 0) {
    decision = 'plateau-onderzoeken'
    headline = 'Niets ging vooruit dit blok'
    reasoning =
      (sleep ?? 5) < 3
        ? 'Slaap zit onder de 3 van 5. Dat is waarschijnlijk de oorzaak, niet het programma.'
        : 'Slaap, pijn en opkomst zien er goed uit. Dan is dit waarschijnlijk een natuurlijk plateau, en was de deload precies op tijd.'
    action =
      (sleep ?? 5) < 3
        ? 'Herstel eerst op orde, programma ongewijzigd. Volgend blok opnieuw meten.'
        : 'Kies één aanpassing: één set erbij op de twee zwakste oefeningen, óf een variant met een ander bereik. Niet allebei.'
  } else {
    decision = 'doorgaan'
    headline = 'Het blok deed wat het moest doen'
    reasoning = `${improved} van ${counted} oefeningen ging vooruit, pijn bleef op ${round1(painNow)}/10 en de techniek hield stand.`
    action = 'Eén aanpassing voor het volgende blok: één set erbij, óf de kleinste stap zwaarder, óf een nieuwe variant. Kies er één.'
  }

  return {
    sessionCount: current.length,
    weeks: blockWeeks,
    metrics,
    decision,
    headline,
    reasoning,
    action,
    problemExercises,
  }
}
