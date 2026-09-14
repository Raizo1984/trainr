/**
 * Blokstructuur voor de fasen 4 tot en met 6 (sectie 3.2).
 *
 * Fase 4: blokperiodisering, één accent per zes weken.
 * Fase 5: specialisatiecycli van acht weken op massa, kracht of skill.
 * Fase 6: pieken op de droomdoelen, daarna houdbaar onderhoud.
 *
 * Uitgangspunt: één ding tegelijk zwaar, de rest op onderhoud. Onderhoud is
 * niet nul. Wegvallen kost meer dan het oplevert.
 */

import type { PhaseId } from './types'

export type Accent = 'squat' | 'hinge' | 'push' | 'pull'
export type SpecialisationFocus = 'massa' | 'kracht' | 'skill'

export const ACCENT_LABEL: Record<Accent, string> = {
  squat: 'Squat en kniepatroon',
  hinge: 'Heupscharnier en achterketen',
  push: 'Drukken',
  pull: 'Trekken',
}

/** Welke laders vallen onder welk accent. */
export const ACCENT_LADDERS: Record<Accent, string[]> = {
  squat: ['squat', 'quad-iso'],
  hinge: ['hinge', 'ham-iso'],
  push: ['h-push', 'v-push', 'triceps'],
  pull: ['h-pull', 'v-pull', 'biceps'],
}

const ACCENT_ORDER: Accent[] = ['squat', 'pull', 'hinge', 'push']

export const FOCUS_LABEL: Record<SpecialisationFocus, string> = {
  massa: 'Massa',
  kracht: 'Kracht',
  skill: 'Skill',
}

export interface BlockPlan {
  /** Lengte van het blok in weken. */
  lengthWeeks: number
  /** Nulgebaseerd bloknummer binnen de fase. */
  index: number
  /** Week binnen het blok, 1-based. */
  weekInBlock: number
  weeksLeft: number
  accent: Accent | null
  focus: SpecialisationFocus | null
  title: string
  rationale: string
}

/** Blokindeling afleiden uit de fase en de week daarbinnen. */
export function blockPlan(phase: PhaseId, phaseWeek: number, chosenFocus?: SpecialisationFocus): BlockPlan {
  const week = Math.max(1, phaseWeek)

  if (phase === 4) {
    const length = 6
    const index = Math.floor((week - 1) / length)
    const accent = ACCENT_ORDER[index % ACCENT_ORDER.length]
    return {
      lengthWeeks: length,
      index,
      weekInBlock: ((week - 1) % length) + 1,
      weeksLeft: length - (((week - 1) % length) + 1),
      accent,
      focus: null,
      title: `Accentblok ${index + 1}: ${ACCENT_LABEL[accent]}`,
      rationale:
        'Eén patroon krijgt zes weken de ruimte om zwaar te worden. De rest draait op onderhoud, want alles tegelijk zwaar maken levert nergens vooruitgang op.',
    }
  }

  if (phase === 5) {
    const length = 8
    const index = Math.floor((week - 1) / length)
    const rotation: SpecialisationFocus[] = ['massa', 'kracht', 'skill']
    const focus = chosenFocus ?? rotation[index % rotation.length]
    return {
      lengthWeeks: length,
      index,
      weekInBlock: ((week - 1) % length) + 1,
      weeksLeft: length - (((week - 1) % length) + 1),
      accent: null,
      focus,
      title: `Specialisatiecyclus ${index + 1}: ${FOCUS_LABEL[focus]}`,
      rationale:
        'Acht weken op één doel. De andere twee blijven op onderhoud staan, zodat je ze niet kwijtraakt terwijl je ergens anders wint.',
    }
  }

  if (phase === 6) {
    const length = 8
    const index = Math.floor((week - 1) / length)
    // Eerste twee blokken pieken op de droomdoelen, daarna onderhoud.
    const peaking = index < 2
    return {
      lengthWeeks: length,
      index,
      weekInBlock: ((week - 1) % length) + 1,
      weeksLeft: length - (((week - 1) % length) + 1),
      accent: null,
      focus: peaking ? 'skill' : null,
      title: peaking ? `Piekblok ${index + 1}: droomdoelen afmaken` : 'Onderhoud',
      rationale: peaking
        ? 'Volume omlaag, scherpte omhoog. Dit is het moment om af te maken waar je vier jaar naartoe hebt gewerkt.'
        : 'Minder volume, zelfde regelmaat. Dit is het schema dat je de komende jaren kunt volhouden, en dat is het punt.',
    }
  }

  // Fasen 0 tot en met 3 kennen geen accentblokken; het blok is de deloadcyclus.
  const length = 6
  const index = Math.floor((week - 1) / length)
  return {
    lengthWeeks: length,
    index,
    weekInBlock: ((week - 1) % length) + 1,
    weeksLeft: length - (((week - 1) % length) + 1),
    accent: null,
    focus: null,
    title: `Blok ${index + 1}`,
    rationale: 'Zes weken opbouwen, dan een deloadweek. Pezen passen zich trager aan dan spieren.',
  }
}

export interface Dosage {
  sets: number
  repMin: number
  repMax: number
  rir: number
}

/**
 * Dosering voor een oefening, gegeven het blok.
 * Accent en focus bepalen wie zwaar mag en wie op onderhoud staat.
 */
export function dosageFor(
  ladderId: string,
  base: Dosage,
  plan: BlockPlan,
  isSkill: boolean,
): { dosage: Dosage; role: 'accent' | 'onderhoud' | 'basis' } {
  // Fase 4: accentpatroon zwaar, de rest terug naar onderhoud.
  if (plan.accent) {
    const inAccent = ACCENT_LADDERS[plan.accent].includes(ladderId)
    if (inAccent) {
      return {
        dosage: { sets: base.sets + 1, repMin: 3, repMax: 6, rir: 2 },
        role: 'accent',
      }
    }
    return {
      dosage: { sets: Math.max(2, base.sets - 1), repMin: base.repMin, repMax: base.repMax, rir: 3 },
      role: 'onderhoud',
    }
  }

  // Fase 5 en 6: focus bepaalt het repbereik.
  if (plan.focus === 'kracht') {
    return isSkill
      ? { dosage: { ...base, sets: Math.max(2, base.sets - 1) }, role: 'onderhoud' }
      : { dosage: { sets: base.sets, repMin: 4, repMax: 6, rir: 2 }, role: 'accent' }
  }
  if (plan.focus === 'massa') {
    return isSkill
      ? { dosage: { ...base, sets: Math.max(2, base.sets - 1) }, role: 'onderhoud' }
      : { dosage: { sets: base.sets + 1, repMin: 8, repMax: 12, rir: 2 }, role: 'accent' }
  }
  if (plan.focus === 'skill') {
    return isSkill
      ? { dosage: { sets: base.sets + 1, repMin: base.repMin, repMax: base.repMax, rir: 3 }, role: 'accent' }
      : { dosage: { sets: Math.max(2, base.sets - 1), repMin: base.repMin, repMax: base.repMax, rir: 3 }, role: 'onderhoud' }
  }

  return { dosage: base, role: 'basis' }
}

/** Fase 6 zonder piek draait op minder volume, niet op minder regelmaat. */
export function isMaintenanceBlock(phase: PhaseId, plan: BlockPlan): boolean {
  return phase === 6 && plan.focus === null
}
