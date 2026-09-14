/**
 * Programmageneratie: van intake en fase naar concrete sessies.
 * Bron: sectie 3.3 (fase 1 als blauwdruk) en sectie 3.4 (fase 2-6, Helms).
 *
 * Ontwerpregel uit principe 3: minimaal levensvatbaar volume, één
 * progressieregel, hooguit drie mini-doelen per blok.
 */

import type {
  Equipment,
  PhaseId,
  PrescribedExercise,
  SafetySettings,
  SessionTemplate,
} from './types'
import { getLadder, selectStep } from './exercises'
import { blockPlan, dosageFor, isMaintenanceBlock, type SpecialisationFocus } from './blocks'

/**
 * Hoogste toegestane trede per fase. Houdt gevorderde varianten uit een fase
 * waar ze niet horen, ook als de apparatuur ze toelaat.
 */
const MAX_RUNG_BY_PHASE: Record<PhaseId, number> = {
  0: 2,
  1: 3,
  2: 4,
  3: 5,
  4: 6,
  5: 6,
  6: 6,
}

export interface BuildContext {
  phase: PhaseId
  equipment: Equipment[]
  safety: SafetySettings
  /** Weeknummer binnen de fase, 1-based. Stuurt de leerweken (sectie 3.3). */
  week: number
  /**
   * Skillladders die in deze fase in het programma horen (sectie 3.2, fase 3).
   * Komt uit `activeSkillLadders`; leeg betekent alleen de standaardsplit.
   */
  skills?: string[]
  /** Zelfgekozen focus voor een specialisatiecyclus in fase 5. */
  focus?: SpecialisationFocus
}

function sets(base: number, ctx: BuildContext): number {
  // Week 1-2 is een leerfase: twee sets, niet drie (sectie 3.3).
  const learning = ctx.phase === 1 && ctx.week <= 2
  const raw = learning ? Math.min(base, 2) : base
  return Math.max(1, Math.round(raw * ctx.safety.startingSetsFactor))
}

function ex(
  ladderId: string,
  ctx: BuildContext,
  spec: { sets: number; repMin: number; repMax: number; rir?: number; note?: string; fixed?: boolean; rungCap?: number },
): PrescribedExercise {
  const cap = Math.min(spec.rungCap ?? 99, MAX_RUNG_BY_PHASE[ctx.phase])
  const step = selectStep(ladderId, ctx.equipment, cap)

  // Vaste blokken (warming-up, cool-down) blijven buiten de blokdosering:
  // die horen elke sessie hetzelfde te zijn.
  if (spec.fixed) {
    return {
      ladderId,
      stepId: step.id,
      sets: spec.sets,
      repMin: spec.repMin,
      repMax: spec.repMax,
      targetRir: spec.rir ?? 3,
      fixed: true,
      note: spec.note,
    }
  }

  const plan = blockPlan(ctx.phase, ctx.week, ctx.focus)
  const isSkill = getLadder(ladderId).pattern === 'skill'
  const base = { sets: spec.sets, repMin: spec.repMin, repMax: spec.repMax, rir: spec.rir ?? 3 }
  const { dosage, role } = dosageFor(ladderId, base, plan, isSkill)

  // Onderhoud in fase 6 zonder piek: nog een set eraf, regelmaat blijft.
  const maintenanceTrim = isMaintenanceBlock(ctx.phase, plan) ? 1 : 0

  return {
    ladderId,
    stepId: step.id,
    sets: Math.max(1, sets(dosage.sets, ctx) - maintenanceTrim),
    repMin: dosage.repMin,
    repMax: dosage.repMax,
    targetRir: dosage.rir,
    note:
      role === 'accent' && plan.accent
        ? spec.note ?? 'Accent van dit blok. Hier mag het zwaar zijn.'
        : role === 'onderhoud'
          ? spec.note ?? 'Onderhoud. Niet zwaarder maken dan nodig.'
          : spec.note,
  }
}

/** Vaste warming-up, elke sessie identiek (sectie 3.3). */
function warmup(ctx: BuildContext): PrescribedExercise[] {
  return [
    ex('warmup-cardio', ctx, { sets: 5, repMin: 1, repMax: 1, fixed: true, rungCap: 1, note: '5 minuten rustig, praten moet kunnen' }),
    ex('birddog', ctx, { sets: 2, repMin: 8, repMax: 8, fixed: true, rungCap: 1, note: 'Per kant' }),
    ex('rear-delt', ctx, { sets: 2, repMin: 15, repMax: 15, fixed: true, rungCap: 1 }),
  ]
}

/**
 * Vaste cool-down, elke sessie identiek (sectie 3.3).
 *
 * De treden staan hier vast. Warming-up en cool-down zijn geen plek voor
 * progressie: ze moeten elke sessie hetzelfde voelen, ook als de gebruiker
 * inmiddels zwaardere varianten aankan.
 */
function cooldown(ctx: BuildContext): PrescribedExercise[] {
  return [
    ex('calf', ctx, { sets: 2, repMin: 15, repMax: 15, fixed: true, rungCap: 2, note: 'Vanaf een opstapje, volledige range' }),
    ex('tibialis', ctx, { sets: 2, repMin: 15, repMax: 15, fixed: true, rungCap: 1, note: 'Hakken tegen de muur' }),
    ex('mobility-hip', ctx, { sets: 1, repMin: 1, repMax: 1, fixed: true, rungCap: 1, note: '1 minuut per been' }),
  ]
}

/**
 * Fase 0: geen programmering, wel bewegen en meten. Drie identieke, korte
 * sessies waarin de baseline wordt vastgelegd.
 */
function phase0(ctx: BuildContext): SessionTemplate[] {
  const template: SessionTemplate = {
    id: 'p0-baseline',
    name: 'Baselinesessie',
    subtitle: 'Submaximaal. Doel is meten en leren, niet presteren.',
    warmup: warmup(ctx),
    main: [
      ex('squat', ctx, { sets: 2, repMin: 8, repMax: 10, rir: 4, note: 'Alleen pijnvrije diepte. Dit hoort makkelijk te voelen.' }),
      ex('hinge', ctx, { sets: 2, repMin: 10, repMax: 12, rir: 4 }),
      ex('h-push', ctx, { sets: 2, repMin: 6, repMax: 10, rir: 4, note: 'Stop op RPE 6-7, nooit tot falen' }),
      ex('h-pull', ctx, { sets: 2, repMin: 8, repMax: 12, rir: 4 }),
      ex('carry-core', ctx, { sets: 2, repMin: 8, repMax: 10, rir: 4 }),
    ],
    cooldown: cooldown(ctx),
  }
  return [template]
}

/**
 * Fase 1: drie identieke sessies per week met vijf ankeroefeningen
 * (sectie 3.3). Vanaf blok 2 komt de hinge-lader hoger uit.
 */
function phase1(ctx: BuildContext): SessionTemplate[] {
  const block = ctx.week <= 4 ? 1 : ctx.week <= 8 ? 2 : 3
  const rungCap = Math.min(1 + block, MAX_RUNG_BY_PHASE[1])
  const template: SessionTemplate = {
    id: 'p1-anker',
    name: `Belastbaarheid — blok ${block}`,
    subtitle: 'Vijf ankeroefeningen, 3-4 RIR, altijd dezelfde volgorde.',
    warmup: warmup(ctx),
    main: [
      ex('squat', ctx, { sets: 3, repMin: 8, repMax: 12, rungCap, note: 'Pijnvrije diepte, traag en gecontroleerd' }),
      ex('hinge', ctx, { sets: 3, repMin: 10, repMax: 15, rungCap, note: 'Prioriteit in deze fase: bekken kantelen, top knijpen' }),
      ex('h-push', ctx, { sets: 3, repMin: 6, repMax: 12, rungCap }),
      ex('h-pull', ctx, { sets: 3, repMin: 8, repMax: 12, rungCap, note: 'Schouders eerst omlaag, dán trekken' }),
      ex('carry-core', ctx, { sets: 3, repMin: 8, repMax: 10, rungCap }),
    ],
    cooldown: cooldown(ctx),
  }
  return [template]
}

/**
 * Fase 2 en hoger: vierdaagse split met de repbereiken uit sectie 3.4.
 * De structuur blijft 36+ maanden gelijk; alleen de treden en belasting lopen op.
 */
function splitPhase(ctx: BuildContext): SessionTemplate[] {
  const plan = blockPlan(ctx.phase, ctx.week, ctx.focus)
  const lowerA: SessionTemplate = {
    id: 'lower-a',
    name: 'Onderlichaam A',
    subtitle: plan.accent || plan.focus ? plan.title : 'Compounds 3x8-12, isolatie 3x10-15.',
    warmup: warmup(ctx),
    main: [
      ex('squat', ctx, { sets: 3, repMin: 8, repMax: 12 }),
      ex('hinge', ctx, { sets: 3, repMin: 8, repMax: 12 }),
      ex('quad-iso', ctx, { sets: 3, repMin: 10, repMax: 15 }),
      ex('carry-core', ctx, { sets: 3, repMin: 8, repMax: 10 }),
    ],
    cooldown: cooldown(ctx),
  }
  const upperA: SessionTemplate = {
    id: 'upper-a',
    name: 'Bovenlichaam A',
    subtitle: 'Press 3x6-10, rows 3x8-12, pull 3x8-12, triceps 2x12-20.',
    warmup: warmup(ctx),
    main: [
      ex('v-push', ctx, { sets: 3, repMin: 6, repMax: 10 }),
      ex('h-pull', ctx, { sets: 3, repMin: 8, repMax: 12 }),
      ex('v-pull', ctx, { sets: 3, repMin: 8, repMax: 12, note: 'Skillwerk zit hierin, niet ernaast' }),
      ex('rear-delt', ctx, { sets: 2, repMin: 15, repMax: 20 }),
      ex('triceps', ctx, { sets: 2, repMin: 12, repMax: 20 }),
    ],
    cooldown: cooldown(ctx),
  }
  const lowerB: SessionTemplate = {
    id: 'lower-b',
    name: 'Onderlichaam B',
    subtitle: 'Hinge 3x8-10, quads 2x10-15, curl 2x10-15, kuit 3x12-20.',
    warmup: warmup(ctx),
    main: [
      ex('hinge', ctx, { sets: 3, repMin: 8, repMax: 10 }),
      ex('quad-iso', ctx, { sets: 2, repMin: 10, repMax: 15 }),
      ex('ham-iso', ctx, { sets: 2, repMin: 10, repMax: 15 }),
      ex('calf', ctx, { sets: 3, repMin: 12, repMax: 20 }),
    ],
    cooldown: cooldown(ctx),
  }
  const upperB: SessionTemplate = {
    id: 'upper-b',
    name: 'Bovenlichaam B',
    subtitle: 'Push 3x6-12, row 3x10-12, pull-up 3x8-12, face pull 2x15-20, biceps 2x12-15.',
    warmup: warmup(ctx),
    main: [
      ex('h-push', ctx, { sets: 3, repMin: 6, repMax: 12 }),
      ex('h-pull', ctx, { sets: 3, repMin: 10, repMax: 12 }),
      ex('v-pull', ctx, { sets: 3, repMin: 8, repMax: 12 }),
      ex('rear-delt', ctx, { sets: 2, repMin: 15, repMax: 20 }),
      ex('biceps', ctx, { sets: 2, repMin: 12, repMax: 15 }),
    ],
    cooldown: cooldown(ctx),
  }
  const templates = [lowerA, upperA, lowerB, upperB]

  // Skillwerk komt in de bovenlichaamssessies, niet als losse sessie ernaast
  // (sectie 3.2, fase 3: geïntegreerd, niet apart).
  const skills = ctx.skills ?? []
  if (skills.length > 0) {
    const upperSessions = [upperA, upperB]
    skills.forEach((ladderId, i) => {
      const target = upperSessions[i % upperSessions.length]
      target.main.splice(1, 0, ex(ladderId, ctx, { sets: 3, repMin: 3, repMax: 8, rir: 3, note: 'Skillwerk: techniek boven reps. Stop bij vormverlies.' }))
    })
  }

  if (isMaintenanceBlock(ctx.phase, plan)) {
    // Onderhoud: drie sessies per week in plaats van vier. Minder volume,
    // zelfde regelmaat. Dit is het schema dat je jaren volhoudt.
    return [
      { ...lowerA, name: 'Onderlichaam', subtitle: 'Onderhoud. Alles blijft staan, niets wordt zwaarder.' },
      { ...upperA, name: 'Bovenlichaam A', subtitle: 'Onderhoud, met ruimte voor je skills.' },
      { ...upperB, name: 'Bovenlichaam B', subtitle: 'Onderhoud. Regelmaat wint van intensiteit.' },
    ]
  }

  return templates
}

export function buildTemplates(ctx: BuildContext): SessionTemplate[] {
  if (ctx.phase === 0) return phase0(ctx)
  if (ctx.phase === 1) return phase1(ctx)
  return splitPhase(ctx)
}

/** Een deloadweek halveert de sets en houdt de belasting gelijk (sectie 4.3, trigger 5). */
export function applyDeload(template: SessionTemplate): SessionTemplate {
  const half = (list: PrescribedExercise[]) =>
    list.map((e) => (e.fixed ? e : { ...e, sets: Math.max(1, Math.ceil(e.sets / 2)) }))
  return {
    ...template,
    name: `${template.name} — deload`,
    subtitle: 'Helft van de sets, zelfde gewicht. Dit hoort licht te voelen.',
    warmup: template.warmup,
    main: half(template.main),
    cooldown: template.cooldown,
  }
}

/** Is deze week een verplichte deloadweek? (sectie 9.2, systeem C) */
export function isDeloadWeek(phaseWeek: number, safety: SafetySettings): boolean {
  return phaseWeek > 0 && phaseWeek % safety.deloadIntervalWeeks === 0
}

/** Weken tot de volgende verplichte deload. */
export function weeksUntilDeload(phaseWeek: number, safety: SafetySettings): number {
  const interval = safety.deloadIntervalWeeks
  const remainder = phaseWeek % interval
  return remainder === 0 ? 0 : interval - remainder
}
