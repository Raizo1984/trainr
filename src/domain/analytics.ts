/**
 * Aggregaties over de trainingslog. Levert de cijfers waarop de
 * signaleringen (sectie 4.3), gates (sectie 6.4) en rapportages (sectie 6.2) draaien.
 */

import type { BodyRegion, ExerciseLog, MovementPattern, Pain, SessionLog } from './types'
import { getLadder, getStep } from './exercises'
import { exerciseVolume, heaviestLoad, maxPain, minFormQuality, workingSets } from './rule'

export const DAY_MS = 86_400_000

export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function todayIso(): string {
  return toIsoDate(new Date())
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS)
}

export function addDays(iso: string, days: number): string {
  return toIsoDate(new Date(Date.parse(iso) + days * DAY_MS))
}

export function sessionsInWindow(sessions: SessionLog[], fromIso: string, toIso: string): SessionLog[] {
  return sessions.filter((s) => s.date >= fromIso && s.date <= toIso)
}

export function lastNDays(sessions: SessionLog[], days: number, reference = todayIso()): SessionLog[] {
  return sessionsInWindow(sessions, addDays(reference, -days + 1), reference)
}

/**
 * Opkomst als fractie van de geplande sessies.
 * Planning = weken in de fase maal de frequentie van de fase.
 */
export function adherence(
  sessions: SessionLog[],
  sessionsPerWeek: number,
  weeksElapsed: number,
): { done: number; planned: number; ratio: number } {
  const planned = Math.max(1, Math.round(sessionsPerWeek * Math.max(weeksElapsed, 1)))
  const done = sessions.length
  return { done, planned, ratio: Math.min(done / planned, 1.5) }
}

export function sessionVolume(session: SessionLog): number {
  return session.exercises.reduce((total, e) => total + exerciseVolume(e), 0)
}

export function sessionSetCount(session: SessionLog): number {
  return session.exercises.reduce((total, e) => total + workingSets(e).length, 0)
}

/** Wekelijks volume, oplopend gesorteerd op ISO-weekstart. */
export function weeklyVolume(
  sessions: SessionLog[],
): Array<{ week: string; volume: number; sets: number; sessions: number; isDeload: boolean }> {
  const buckets = new Map<string, { volume: number; sets: number; sessions: number; isDeload: boolean }>()
  for (const session of sessions) {
    const key = weekStart(session.date)
    const bucket = buckets.get(key) ?? { volume: 0, sets: 0, sessions: 0, isDeload: false }
    bucket.volume += sessionVolume(session)
    bucket.sets += sessionSetCount(session)
    bucket.sessions += 1
    bucket.isDeload = bucket.isDeload || session.isDeload
    buckets.set(key, bucket)
  }
  return [...buckets.entries()]
    .map(([week, value]) => ({ week, ...value }))
    .sort((a, b) => a.week.localeCompare(b.week))
}

/** Maandag van de week waarin `iso` valt. */
export function weekStart(iso: string): string {
  const date = new Date(iso + 'T00:00:00Z')
  const day = (date.getUTCDay() + 6) % 7
  return toIsoDate(new Date(date.getTime() - day * DAY_MS))
}

/** Sets per gewrichtsgroep in de laatste zeven dagen (sectie 9.2, systeem B). */
export type JointGroup = 'schouder' | 'elleboog' | 'knie' | 'heup' | 'rug'

/**
 * Volumeplafonds per week.
 *
 * Schouder, elleboog en knie komen uit sectie 9.2, systeem B. Heup en rug
 * staan daar niet: die zijn hier toegevoegd omdat ze wel meetellen, maar hun
 * grens is ruimer omdat zowat elke onderlichaamsoefening erop uitkomt. Een
 * gewone vierdaagse split met squat en hinge tikt anders elke week tegen het
 * plafond, en een waarschuwing die altijd afgaat is geen waarschuwing.
 */
export const JOINT_CAPS: Record<JointGroup, number> = {
  schouder: 15,
  elleboog: 12,
  knie: 15,
  heup: 24,
  rug: 24,
}

/**
 * Alleen deze drie zijn harde grenzen die een aanpassing kunnen tegenhouden.
 * Voor heup en rug volstaat een melding: hun plafond is een schatting, en een
 * schatting hoort de gebruiker niet te blokkeren.
 */
export const HARD_CAP_JOINTS: JointGroup[] = ['schouder', 'elleboog', 'knie']

/**
 * Welke gewrichten een bewegingspatroon belast, voor de volumeplafonds.
 *
 * Geteld zoals in krachttraining gebruikelijk is: per belaste groep, niet per
 * aangeraakt gewricht. Een barbell row raakt de schouder, maar telt als
 * trek- en rugvolume, niet als schoudervolume. Alles meetellen wat een
 * gewricht passeert laat een doodgewone vierdaagse split al over elk plafond
 * gaan, en een grens die altijd afgaat beschermt niemand.
 *
 * De elleboog telt trekkend en direct armwerk: sectie 9.2 noemt bij dat
 * plafond uitdrukkelijk "traction work", en daar ontstaat de peesoverbelasting
 * die de grens moet voorkomen.
 */
const PATTERN_JOINTS: Record<MovementPattern, JointGroup[]> = {
  squat: ['knie', 'heup'],
  hinge: ['heup', 'rug'],
  'horizontale-push': ['schouder'],
  'verticale-push': ['schouder'],
  'horizontale-pull': ['elleboog', 'rug'],
  'verticale-pull': ['elleboog', 'rug'],
  'carry-core': ['rug'],
  isolatie: [],
  skill: ['schouder', 'elleboog'],
  conditie: [],
}

const LADDER_JOINTS: Record<string, JointGroup[]> = {
  'quad-iso': ['knie'],
  'ham-iso': ['knie', 'heup'],
  'rear-delt': ['schouder'],
  biceps: ['elleboog'],
  triceps: ['elleboog'],
  calf: [],
  tibialis: [],
}

export function jointsFor(ladderId: string): JointGroup[] {
  const override = LADDER_JOINTS[ladderId]
  if (override) return override
  return PATTERN_JOINTS[getLadder(ladderId).pattern] ?? []
}

export function weeklyJointSets(sessions: SessionLog[], reference = todayIso()): Record<JointGroup, number> {
  const totals: Record<JointGroup, number> = { schouder: 0, elleboog: 0, knie: 0, heup: 0, rug: 0 }
  for (const session of lastNDays(sessions, 7, reference)) {
    for (const exercise of session.exercises) {
      const count = workingSets(exercise).length
      for (const joint of jointsFor(exercise.ladderId)) totals[joint] += count
    }
  }
  return totals
}

/** Hoogste pijnwaarde per lichaamsgebied in een sessie, inclusief nameting. */
export function painByRegion(session: SessionLog): Partial<Record<BodyRegion, Pain>> {
  const result: Partial<Record<BodyRegion, Pain>> = { ...(session.post?.painByRegion ?? {}) }
  for (const exercise of session.exercises) {
    for (const set of workingSets(exercise)) {
      if (set.painRegion && set.pain > (result[set.painRegion] ?? 0)) result[set.painRegion] = set.pain
    }
  }
  for (const [region, value] of Object.entries(session.followUp?.painByRegion ?? {})) {
    const key = region as BodyRegion
    if ((value ?? 0) > (result[key] ?? 0)) result[key] = value as Pain
  }
  return result
}

export function peakPain(session: SessionLog): Pain {
  const values = Object.values(painByRegion(session)) as Pain[]
  return values.length === 0 ? 0 : (Math.max(...values) as Pain)
}

/** Alle logs van één oefening, oudste eerst. */
export function historyFor(sessions: SessionLog[], ladderId: string): Array<{ session: SessionLog; log: ExerciseLog }> {
  return sessions
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .flatMap((session) =>
      session.exercises
        .filter((e) => e.ladderId === ladderId)
        .map((log) => ({ session, log })),
    )
}

export interface PlateauCheck {
  ladderId: string
  stalledSessions: number
  stalled: boolean
  load: number
  bestReps: number
}

/**
 * Stilstand: zelfde belasting én geen repprogressie over drie of meer sessies
 * (sectie 4.3, trigger 3). Deloadweken tellen niet mee.
 */
export function detectPlateau(sessions: SessionLog[], ladderId: string): PlateauCheck {
  const history = historyFor(sessions, ladderId)
    .filter(({ session }) => !session.isDeload)
    .slice(-6)
  if (history.length < 3) {
    return { ladderId, stalledSessions: history.length, stalled: false, load: 0, bestReps: 0 }
  }
  const latest = history[history.length - 1].log
  const load = heaviestLoad(latest)
  const stepId = latest.stepId
  const bestReps = Math.max(...workingSets(latest).map((s) => s.reps), 0)

  let stalled = 0
  for (let i = history.length - 1; i >= 0; i--) {
    const log = history[i].log
    const sameLoad = Math.abs(heaviestLoad(log) - load) < 0.01 && log.stepId === stepId
    const best = Math.max(...workingSets(log).map((s) => s.reps), 0)
    if (sameLoad && best <= bestReps) stalled++
    else break
  }
  return { ladderId, stalledSessions: stalled, stalled: stalled >= 3, load, bestReps }
}

/** Gemiddelde vormscore per oefening over de laatste sessies. */
export function formTrend(sessions: SessionLog[], ladderId: string, count = 3): number[] {
  return historyFor(sessions, ladderId)
    .slice(-count)
    .map(({ log }) => minFormQuality(log))
}

export function average(values: number[]): number | null {
  if (values.length === 0) return null
  return values.reduce((a, b) => a + b, 0) / values.length
}

export function round1(value: number): number {
  return Math.round(value * 10) / 10
}

/**
 * Voortschrijdend gemiddelde over de laatste `window` bekende waarden.
 * Ontbrekende metingen tellen niet als nul mee; die zouden de trend omlaag
 * trekken terwijl er alleen niet gewogen is.
 */
export function trailingAverage(values: Array<number | null>, window: number): Array<number | null> {
  const result: Array<number | null> = []
  for (let i = 0; i < values.length; i++) {
    const slice = values.slice(Math.max(0, i - window + 1), i + 1).filter((v): v is number => v !== null)
    result.push(slice.length === 0 ? null : slice.reduce((a, b) => a + b, 0) / slice.length)
  }
  return result
}

/** Voortschrijdend gemiddelde over `window` punten. */
export function movingAverage(values: number[], window: number): number[] {
  return values.map((_, i) => {
    const slice = values.slice(Math.max(0, i - window + 1), i + 1)
    return slice.reduce((a, b) => a + b, 0) / slice.length
  })
}

/** Hoogste pijn per oefening, over alle sessies waarin die oefening voorkwam. */
export function painPerExercise(sessions: SessionLog[], ladderId: string, count = 4): Pain[] {
  return historyFor(sessions, ladderId)
    .slice(-count)
    .map(({ log }) => maxPain(log))
}

export function exerciseLabel(log: ExerciseLog): string {
  return getStep(log.stepId).name
}
