/**
 * Vakjargon naar gewone taal.
 *
 * De app rekent in bewegingspatronen, fases en RIR, en dat moet ook zo blijven:
 * daar zit de logica in. Maar een beginner die "horizontale push, fase 2, RIR 3"
 * leest, haakt af voordat hij aan zijn eerste set toekomt.
 *
 * Deze tabel verandert niets aan de werking. Hij zet er alleen woorden bij die
 * mensen zelf gebruiken. Het vakwoord blijft staan waar het herleidbaar moet
 * zijn, de uitleg komt ernaast.
 */

import type { MovementPattern, PhaseId } from './types.ts'

/** Welke spieren je hiermee traint, in de woorden van de sportschool. */
export const SPIERGROEP: Record<MovementPattern, string> = {
  squat: 'Benen',
  hinge: 'Billen en hamstrings',
  'horizontale-push': 'Borst en triceps',
  'verticale-push': 'Schouders en triceps',
  'horizontale-pull': 'Rug en biceps',
  'verticale-pull': 'Rug en biceps',
  'carry-core': 'Romp',
  isolatie: 'Losse spier',
  skill: 'Vaardigheid',
  conditie: 'Conditie',
}

/** Eén zin die zegt waar deze fase over gaat, zonder vakjargon. */
export const FASE_UITLEG: Record<PhaseId, string> = {
  0: 'We kijken eerst waar je staat voordat er iets zwaars bij komt.',
  1: 'Je lichaam laten wennen aan trainen, zodat het later meer aankan.',
  2: 'De basisoefeningen leren, met gewicht dat je techniek aankan.',
  3: 'Nu bouw je zichtbaar spiermassa op, en leer je je eerste kunstjes.',
  4: 'Zwaarder en explosiever, met minder herhalingen per set.',
  5: 'Extra aandacht voor wat jij het belangrijkst vindt.',
  6: 'Vasthouden wat je hebt opgebouwd, zonder in te leveren.',
}

/**
 * Het primaire doel in de woorden die mensen zelf gebruiken.
 *
 * De waarde blijft hetzelfde, want daar hangt de logica aan. Alleen het label
 * en de uitleg veranderen.
 */
export const DOEL_LABEL: Record<
  'spiermassa' | 'kracht' | 'skill' | 'transformatie' | 'pijnvrij-bewegen',
  { label: string; uitleg: string }
> = {
  spiermassa: {
    label: 'Groter worden',
    uitleg: 'Zichtbaar meer spier op je borst, armen, schouders en benen.',
  },
  kracht: {
    label: 'Sterker worden',
    uitleg: 'Meer gewicht kunnen tillen, ook als je er niet groter van wordt.',
  },
  skill: {
    label: 'Iets kunnen',
    uitleg: 'Een pull-up, een dip, een handstand. Je lichaam beheersen.',
  },
  transformatie: {
    label: 'Slanker en strakker',
    uitleg: 'Vet eraf terwijl je je spiermassa vasthoudt.',
  },
  'pijnvrij-bewegen': {
    label: 'Zonder pijn bewegen',
    uitleg: 'Traplopen, tillen en sporten zonder dat het later zeer doet.',
  },
}

/**
 * RIR uitgelegd zonder het woord te vermijden.
 *
 * Het begrip zelf is nuttig en kort, dus dat blijft. Maar de eerste keer dat
 * iemand het ziet, moet erbij staan wat het betekent.
 */
export function rirUitleg(rir: number): string {
  if (rir === 0) return 'tot je er geen meer kunt'
  if (rir === 1) return 'nog één in reserve'
  return `nog ${rir} in reserve`
}

/** Korte omschrijving van een oefening voor wie de naam niet kent. */
export function oefeningInHetKort(pattern: MovementPattern): string {
  return SPIERGROEP[pattern]
}
