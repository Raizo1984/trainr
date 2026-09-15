/**
 * De sessie waar je nu mee bezig bent.
 *
 * Wat je logt tussen "Beginnen" en "Opslaan" stond tot nu toe alleen in het
 * geheugen van het scherm. Ging het tabblad weg, dan was alles weg: je begint
 * een sessie, logt drie sets, krijgt een telefoontje, en de browser ruimt
 * ondertussen het tabblad op om geheugen vrij te maken. Op een telefoon
 * gebeurt dat sneller dan je denkt.
 *
 * Daarom staat het concept nu op het toestel, en wordt het pas gewist als de
 * sessie is opgeslagen of je hem zelf weggooit.
 *
 * Bewust géén onderdeel van wat er naar de server gaat. Een half ingevulde
 * sessie hoort niet op je andere apparaten te verschijnen, en elke set zou
 * anders een verzoek naar de server opleveren.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Scale5, SetEntry } from '@/domain/types'

export type ConceptSets = Record<string, SetEntry[]>

export interface Vitals {
  sleepQuality: Scale5
  energy: Scale5
  stress: Scale5
}

export const STANDAARD_VITALS: Vitals = { sleepQuality: 3, energy: 3, stress: 3 }

interface ConceptStaat {
  /** Welke sessie uit het programma. Leeg betekent: geen lopend concept. */
  templateId: string | null
  /** Wanneer je begon. Bepaalt ook de datum van de sessie. */
  begonnenOp: string | null
  vitals: Vitals
  sets: ConceptSets
}

interface ConceptStore extends ConceptStaat {
  begin: (templateId: string, vitals: Vitals) => void
  zetVitals: (vitals: Vitals) => void
  zetSets: (ladderId: string, sets: SetEntry[]) => void
  hervat: () => void
  wis: () => void
}

const LEEG: ConceptStaat = {
  templateId: null,
  begonnenOp: null,
  vitals: STANDAARD_VITALS,
  sets: {},
}

export const useConcept = create<ConceptStore>()(
  persist(
    (set) => ({
      ...LEEG,
      begin: (templateId, vitals) =>
        set({ templateId, begonnenOp: new Date().toISOString(), vitals, sets: {} }),
      zetVitals: (vitals) => set({ vitals }),
      zetSets: (ladderId, sets) =>
        set((staat) => ({ sets: { ...staat.sets, [ladderId]: sets } })),
      /*
       * Een concept van een andere dag oppakken. De begindatum blijft staan:
       * die sets zijn toen gedaan, en ze vandaag dateren zou je grafieken
       * laten liegen.
       */
      hervat: () => set({}),
      wis: () => set({ ...LEEG }),
    }),
    { name: 'trainr-concept-v1', version: 1 },
  ),
)

/** Hoeveel sets er in het concept staan. Nul betekent: niets te verliezen. */
export function conceptOmvang(sets: ConceptSets): number {
  return Object.values(sets).reduce((totaal, rij) => totaal + rij.length, 0)
}

/** De dag waarop dit concept begon, als datum zonder tijd. */
export function conceptDatum(begonnenOp: string | null): string | null {
  return begonnenOp ? begonnenOp.slice(0, 10) : null
}

export function isVanVandaag(begonnenOp: string | null, vandaag: string): boolean {
  return conceptDatum(begonnenOp) === vandaag
}
