/**
 * Beeld bij een oefening.
 *
 * De afbeeldingen komen uit wger, een vrije oefeningendatabank. Twee dingen
 * bepalen hoe dit werkt.
 *
 * Ten eerste de licentie. wger staat onder CC-BY-SA, maar hun eigen
 * documentatie zegt dat losse oefeningen een eigen licentie kunnen hebben. Elk
 * beeld draagt daarom zijn licentie en maker mee, en zonder die gegevens komt
 * het er niet in.
 *
 * Ten tweede de koppeling. Een verkeerd beeld bij een oefening is erger dan
 * geen beeld: dan leert iemand een beweging aan die hij niet moest doen. Een
 * automatische zoekopdracht kan daar niet over beslissen, dus elk beeld staat
 * op `bevestigd: false` tot een mens het heeft nagekeken. Onbevestigd beeld
 * wordt niet getoond.
 */

import gegenereerd from './exerciseMedia.generated.json' with { type: 'json' }

export interface ExerciseMedia {
  /** Bestandsnaam in public/exercises/. */
  bestand: string
  /** Naam van de oefening zoals wger die kent, om de koppeling te kunnen nakijken. */
  bron: string
  licentie: string
  auteur: string
  /** Pas na controle door een mens komt dit beeld in beeld. */
  bevestigd: boolean
}

const REGISTER = gegenereerd as Record<string, ExerciseMedia>

/** Het beeld bij een trede, of null als er geen bevestigd beeld is. */
export function mediaVoorStap(stepId: string): ExerciseMedia | null {
  const media = REGISTER[stepId]
  if (!media || !media.bevestigd) return null
  if (!media.bestand || !media.licentie || !media.auteur) return null
  return media
}

/** Hoe de bronvermelding eruitziet. Verplicht bij CC-BY-SA. */
export function bronvermelding(media: ExerciseMedia): string {
  return `${media.bron} door ${media.auteur}, ${media.licentie}, via wger`
}

/** Alles in het register, ook het onbevestigde. Voor het nakijkoverzicht. */
export function heelRegister(): Record<string, ExerciseMedia> {
  return REGISTER
}
