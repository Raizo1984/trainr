/**
 * Droomdoelen als route, niet als wens (secties 3.2 fase 3-6 en 2.1).
 *
 * Elk droomdoel hangt aan een progressielader plus toelatingseisen. Skills
 * worden in het programma zelf opgenomen, niet als los kunstje erbovenop
 * (sectie 3.2, fase 3). Voor die eisen groen zijn, is skillwerk geen training
 * maar een blessure in wording.
 */

import type { PhaseId, SessionLog } from './types'
import { getLadder, getStep, tryGetStep } from './exercises'
import { historyFor } from './analytics'
import { workingSets } from './rule'

export interface SkillPath {
  /** Label zoals het in de intake gekozen wordt. */
  goal: string
  ladderId: string
  /** Fase waarin deze skill in het programma mag komen. */
  unlocksAtPhase: PhaseId
  /** Waarom die fase, in één zin voor de gebruiker. */
  gatekeeping: string
  /** Voorwaarden die eerst moeten staan. Leeg betekent: geen voorwaarde. */
  prerequisites: Array<{ ladderId: string; minReps: number; label: string }>
}

export const SKILL_PATHS: SkillPath[] = [
  {
    goal: 'Pull-up',
    ladderId: 'v-pull',
    unlocksAtPhase: 2,
    gatekeeping: 'Trekwerk zit vanaf fase 2 in elke bovenlichaamssessie. De lader doet de rest.',
    prerequisites: [],
  },
  {
    goal: 'Dip',
    ladderId: 'v-push',
    unlocksAtPhase: 2,
    gatekeeping: 'Drukwerk boven het hoofd start in fase 2, mits de schouder pijnvrij is.',
    prerequisites: [],
  },
  {
    goal: 'L-sit',
    ladderId: 'l-sit',
    unlocksAtPhase: 3,
    gatekeeping: 'Vraagt rompkracht die in fase 1 en 2 wordt opgebouwd.',
    prerequisites: [{ ladderId: 'carry-core', minReps: 8, label: '8 schone reps anti-rotatie of carry' }],
  },
  {
    goal: 'Touwklimmen',
    ladderId: 'hang-rope',
    unlocksAtPhase: 3,
    gatekeeping: 'Grip en hangkracht komen eerst. Een touw vergeeft niets.',
    prerequisites: [{ ladderId: 'v-pull', minReps: 5, label: '5 reps op de pull-up lader' }],
  },
  {
    goal: 'Handstand',
    ladderId: 'handstand',
    unlocksAtPhase: 3,
    gatekeeping: 'Alleen zinvol bij een pijnvrije schouder en pols.',
    prerequisites: [{ ladderId: 'v-push', minReps: 8, label: '8 schone reps verticaal drukken' }],
  },
  {
    goal: 'Muscle-up',
    ladderId: 'muscle-up',
    unlocksAtPhase: 4,
    gatekeeping: 'De zwaarste van het rijtje. Vraagt een complete trek- en drukbasis.',
    prerequisites: [
      { ladderId: 'v-pull', minReps: 8, label: '8 schone pull-ups' },
      { ladderId: 'v-push', minReps: 8, label: '8 schone dips' },
    ],
  },
]

export function pathForGoal(goal: string): SkillPath | null {
  return SKILL_PATHS.find((p) => p.goal.toLowerCase() === goal.trim().toLowerCase()) ?? null
}

export interface SkillProgress {
  path: SkillPath
  /** Hoogste trede waarop de gebruiker daadwerkelijk heeft getraind. */
  currentStepId: string | null
  currentRung: number
  totalRungs: number
  /** Beste aantal reps of seconden op de huidige trede. */
  best: number
  sessionsOnStep: number
  unlocked: boolean
  /** Staat deze lader daadwerkelijk in het huidige programma? */
  active: boolean
  blockedBy: string[]
  nextStepName: string | null
}

/** Beste prestatie op een lader, en op welke trede dat was. */
function bestOnLadder(sessions: SessionLog[], ladderId: string): { stepId: string | null; rung: number; reps: number; sessions: number } {
  const history = historyFor(sessions, ladderId)
  if (history.length === 0) return { stepId: null, rung: 0, reps: 0, sessions: 0 }

  let bestRung = 0
  let bestStepId: string | null = null
  for (const { log } of history) {
    const step = tryGetStep(log.stepId)
    if (step && step.rung > bestRung && workingSets(log).length > 0) {
      bestRung = step.rung
      bestStepId = log.stepId
    }
  }
  if (!bestStepId) return { stepId: null, rung: 0, reps: 0, sessions: 0 }

  const onStep = history.filter(({ log }) => log.stepId === bestStepId)
  const reps = Math.max(0, ...onStep.flatMap(({ log }) => workingSets(log).map((s) => s.reps)))
  return { stepId: bestStepId, rung: bestRung, reps, sessions: onStep.length }
}

export function skillProgress(
  sessions: SessionLog[],
  path: SkillPath,
  phase: PhaseId,
  activeLadders: string[] = [],
): SkillProgress {
  const ladder = getLadder(path.ladderId)
  const best = bestOnLadder(sessions, path.ladderId)

  const blockedBy: string[] = []
  if (phase < path.unlocksAtPhase) {
    blockedBy.push(`Komt in het programma vanaf fase ${path.unlocksAtPhase}`)
  }
  for (const prerequisite of path.prerequisites) {
    const achieved = bestOnLadder(sessions, prerequisite.ladderId)
    if (achieved.reps < prerequisite.minReps) {
      blockedBy.push(prerequisite.label)
    }
  }

  const index = best.stepId ? ladder.steps.findIndex((s) => s.id === best.stepId) : -1
  const next = index >= 0 && index < ladder.steps.length - 1 ? ladder.steps[index + 1] : null

  return {
    path,
    currentStepId: best.stepId,
    currentRung: best.rung,
    totalRungs: ladder.steps[ladder.steps.length - 1].rung,
    best: best.reps,
    sessionsOnStep: best.sessions,
    unlocked: blockedBy.length === 0,
    active: blockedBy.length === 0 && activeLadders.includes(path.ladderId),
    blockedBy,
    nextStepName: next ? next.name : null,
  }
}

function pathsForGoals(goals: string[]): SkillPath[] {
  return goals.map((goal) => pathForGoal(goal)).filter((path): path is SkillPath => path !== null)
}

export function progressForGoals(sessions: SessionLog[], goals: string[], phase: PhaseId): SkillProgress[] {
  // De standaardsplit bevat verticaal trekken en drukken sowieso; die tellen
  // daarom altijd als actief.
  const active = [...activeSkillLadders(sessions, goals, phase), 'v-pull', 'v-push']
  return pathsForGoals(goals).map((path) => skillProgress(sessions, path, phase, active))
}

/**
 * Skillladders die in de huidige fase daadwerkelijk in het programma horen.
 * Maximaal twee tegelijk: drie mini-doelen per blok is de bovengrens
 * (principe 3), en skillwerk telt mee in het volume van schouder en elleboog.
 */
export function activeSkillLadders(sessions: SessionLog[], goals: string[], phase: PhaseId): string[] {
  // Let op: hier bewust niet via `progressForGoals`, want die vraagt op zijn
  // beurt weer welke laders actief zijn.
  return pathsForGoals(goals)
    .map((path) => skillProgress(sessions, path, phase))
    .filter((p) => p.unlocked)
    // Laders die al in de standaardsplit zitten hoeven niet nog een keer.
    .filter((p) => !['v-pull', 'v-push'].includes(p.path.ladderId))
    .slice(0, 2)
    .map((p) => p.path.ladderId)
}

export function skillStepName(stepId: string | null): string | null {
  return stepId ? getStep(stepId).name : null
}
