/**
 * Fasearchitectuur (sectie 3.2) en gate-criteria (secties 3.3 en 6.4).
 *
 * Faseovergangen zijn criteria-gedreven, nooit kalender-gedreven (principe 2).
 * De maandvensters hieronder zijn richting, geen belofte.
 */

import type { GateCriterionDefinition, PhaseDefinition, PhaseId } from './types'

const ADHERENCE: GateCriterionDefinition = {
  id: 'adherence',
  label: 'Opkomst',
  requirement: 'Minimaal 80% van de geplande sessies afgerond',
  source: 'auto',
}
const PAIN: GateCriterionDefinition = {
  id: 'pijn',
  label: 'Pijn',
  requirement: 'Overwegend 0-2/10 en geen 24-uursverslechteringen',
  source: 'auto',
}
const TECHNIQUE: GateCriterionDefinition = {
  id: 'techniek',
  label: 'Techniek',
  requirement: 'Basispatronen gecontroleerd reproduceerbaar (vormscore 4+)',
  source: 'auto',
}
const ROM: GateCriterionDefinition = {
  id: 'bewegingsruimte',
  label: 'Bewegingsruimte',
  requirement: 'Voldoende bereik voor de oefeningen van de volgende fase',
  source: 'bevestiging',
}
const RECOVERY: GateCriterionDefinition = {
  id: 'slaap-stress',
  label: 'Slaap en stress',
  requirement: 'Stabiel, geen chronische vermoeidheid',
  source: 'auto',
}
const NUTRITION: GateCriterionDefinition = {
  id: 'voeding',
  label: 'Voeding',
  requirement: 'Plan afgesproken; diëtistverwijzing gedaan als er risico is',
  source: 'bevestiging',
}
const MEDICAL: GateCriterionDefinition = {
  id: 'medisch',
  label: 'Medisch',
  requirement: 'Klachten gediagnosticeerd of vastgesteld dat er geen rode vlaggen zijn',
  source: 'bevestiging',
}
const PERFORMANCE: GateCriterionDefinition = {
  id: 'prestatie',
  label: 'Prestatie',
  requirement: 'Aantoonbare progressie op de kernoefeningen ten opzichte van het begin van de fase',
  source: 'auto',
}

export const PHASES: PhaseDefinition[] = [
  {
    id: 0,
    name: 'Fase 0 — Intake',
    tagline: 'Meten, leren, nog niet programmeren',
    philosophy:
      'Twee tot vier weken waarin je jezelf leert kennen: submaximale baselines, je 24-uursreactie op belasting en je eetpatroon. Geen programmering, wel een dagboek.',
    minWeeks: 2,
    typicalWeeks: 3,
    monthWindow: 'Week 1-4',
    sessionsPerWeek: 3,
    sources: ['Sectie 2.2 stap 2', 'Sectie 6.1'],
    gateCriteria: [PAIN, NUTRITION, MEDICAL],
  },
  {
    id: 1,
    name: 'Fase 1 — Belastbaarheid',
    tagline: 'Bouw eerst een lichaam dat training kan verdragen',
    philosophy:
      'Kracht en spiermassa zijn welkome bijvangst, niet de reden. Lage dosis, hoge frequentie, de hele keten tegelijk. Bindweefsel heeft weken nodig, geen sessies.',
    minWeeks: 8,
    typicalWeeks: 12,
    monthWindow: 'Maand 1-3',
    sessionsPerWeek: 3,
    sources: ['Joyce & Lewindon', 'Steven Low', 'McGill', 'Starrett'],
    gateCriteria: [ADHERENCE, PAIN, TECHNIQUE, ROM, RECOVERY, NUTRITION, MEDICAL],
  },
  {
    id: 2,
    name: 'Fase 2 — Introductie bodybuilding',
    tagline: 'Vierdaagse split, progressive overload volgens Helms',
    philosophy:
      'Lower A/B en Upper A/B. Drie tot vier reps in reserve, één progressieregel, geen variatie om de variatie.',
    minWeeks: 16,
    typicalWeeks: 24,
    monthWindow: 'Maand 4-9',
    sessionsPerWeek: 4,
    sources: ['Eric Helms — Muscle & Strength Training Pyramid'],
    gateCriteria: [ADHERENCE, PAIN, TECHNIQUE, PERFORMANCE, RECOVERY, NUTRITION],
  },
  {
    id: 3,
    name: 'Fase 3 — Massa en eerste skills',
    tagline: 'Zelfde split, zwaarder, skills geïntegreerd',
    philosophy:
      'Pull-ups, push-ups, dips, L-sit en swings komen in het programma zelf, niet als los kunstje erbovenop.',
    minWeeks: 24,
    typicalWeeks: 36,
    monthWindow: 'Maand 10-18',
    sessionsPerWeek: 4,
    sources: ['Helms', 'Steven Low — Overcoming Gravity'],
    gateCriteria: [ADHERENCE, PAIN, TECHNIQUE, PERFORMANCE, RECOVERY, NUTRITION],
  },
  {
    id: 4,
    name: 'Fase 4 — Kracht en power',
    tagline: 'Blokperiodisering, één accent per zes weken',
    philosophy: 'Eén ding tegelijk zwaar. De rest draait op onderhoud.',
    minWeeks: 24,
    typicalWeeks: 48,
    monthWindow: 'Maand 19-30',
    sessionsPerWeek: 4,
    sources: ['Pavel', 'Jamieson', 'Helms'],
    gateCriteria: [ADHERENCE, PAIN, TECHNIQUE, PERFORMANCE, RECOVERY],
  },
  {
    id: 5,
    name: 'Fase 5 — Specialisatie',
    tagline: 'Blokken van acht weken: massa, kracht of skill',
    philosophy: 'Kies per blok één focus. De andere twee draaien op onderhoud, niet op nul.',
    minWeeks: 24,
    typicalWeeks: 48,
    monthWindow: 'Maand 31-42',
    sessionsPerWeek: 4,
    sources: ['Helms', 'Jamieson'],
    gateCriteria: [ADHERENCE, PAIN, PERFORMANCE, RECOVERY],
  },
  {
    id: 6,
    name: 'Fase 6 — Pieken en duurzaamheid',
    tagline: 'Droomdoelen afmaken, daarna houdbaar maken',
    philosophy:
      'De overgang naar iets dat je de rest van je leven volhoudt. Vier jaar consequent verslaat drie maanden heldendom.',
    minWeeks: 24,
    typicalWeeks: 24,
    monthWindow: 'Maand 43-48+',
    sessionsPerWeek: 4,
    sources: ['Helms', 'Joyce & Lewindon'],
    gateCriteria: [ADHERENCE, PAIN, PERFORMANCE],
  },
]

const PHASE_INDEX = new Map(PHASES.map((p) => [p.id, p]))

export function getPhase(id: PhaseId): PhaseDefinition {
  const phase = PHASE_INDEX.get(id)
  if (!phase) throw new Error(`Onbekende fase: ${id}`)
  return phase
}

export function nextPhase(id: PhaseId): PhaseId | null {
  return id >= 6 ? null : ((id + 1) as PhaseId)
}
