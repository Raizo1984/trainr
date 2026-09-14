/**
 * Oordeel tussen twee sets door.
 *
 * `decideProgression` kijkt naar een hele oefening en bepaalt wat je de
 * volgende keer doet. Dat is te laat voor de vraag die je in de zaal hebt:
 * wat doe ik nú, bij de volgende set. Deze functie beantwoordt die vraag,
 * met dezelfde drempels, zodat het advies tijdens en na de sessie niet
 * uiteenloopt.
 *
 * Bewust beperkt: tussen sets kan het advies alleen gelijk blijven of omlaag,
 * nooit omhoog. Verhogen is een beslissing die De Regel na afloop neemt, met
 * alle sets in beeld. Zou je halverwege verzwaren, dan telt `heaviestLoad` dat
 * hogere gewicht als uitgangspunt voor de volgende sessie, en stapel je
 * ongemerkt twee verhogingen op elkaar.
 */

import {
  FORM_MIN,
  PAIN_STOP,
  REDUCE_FORM,
  REDUCE_PAIN_CEILING,
  REDUCE_PAIN_STOP,
  REDUCE_RIR,
  RIR_MIN,
  roundLoadDown,
} from './rule.ts'
import type { LadderStep, Pain, SafetySettings, SetEntry } from './types.ts'

export type SetVerdict = 'stop' | 'lichter' | 'let-op' | 'goed'

export interface SetFeedback {
  verdict: SetVerdict
  /** Het oordeel over de set die net gelogd is. */
  headline: string
  /** Wat je bij de volgende set doet. */
  action: string
  /** Voorgestelde belasting voor de volgende set, of null als die gelijk blijft. */
  nextLoad: number | null
  source: string
}

export interface SetFeedbackContext {
  set: SetEntry
  planned: { sets: number; repMin: number; repMax: number; targetRir: number }
  /** Aantal werksets dat nu gelogd is, deze set meegeteld. */
  setsDone: number
  isDeload: boolean
  safety: SafetySettings
  loadType: LadderStep['loadType']
  /** Warming-up en cooldown zijn niet progressief. */
  fixed?: boolean
}

/** Zelfde belasting, maar netjes afgerond en nooit negatief. */
function lighter(load: number, factor: number): number | null {
  if (load <= 0) return null
  const next = roundLoadDown(load * factor)
  return next > 0 ? next : null
}

function loadText(next: number | null, loadType: LadderStep['loadType']): string {
  if (next === null) return 'Beperk in plaats daarvan het bereik van de beweging.'
  if (loadType === 'trede') return `Zak naar ${next} assist.`
  return `Ga naar ${next} kg.`
}

export function feedbackForSet(ctx: SetFeedbackContext): SetFeedback {
  const { set, planned, safety, loadType } = ctx
  const laatste = ctx.setsDone >= planned.sets

  // 1. Pijn gaat altijd voor.
  if (set.pain >= PAIN_STOP) {
    return {
      verdict: 'stop',
      headline: `Pijn ${set.pain}/10. Stop deze oefening.`,
      action:
        'Niet doorzetten en niet lichter proberen. Noteer de plek, ga door met de rest van de sessie en laat de app morgen de 24-uursreactie uitvragen.',
      nextLoad: lighter(set.load, REDUCE_PAIN_STOP),
      source: 'Sectie 4.3 trigger 1',
    }
  }

  if (set.pain >= safety.painCeiling) {
    const next = lighter(set.load, REDUCE_PAIN_CEILING)
    return {
      verdict: 'lichter',
      headline: `Pijn ${set.pain}/10 zit op je grens van ${safety.painCeiling}.`,
      action: `Belasting 30% terug. ${loadText(next, loadType)} Blijft de pijn, dan stop je de oefening.`,
      nextLoad: next,
      source: 'Sectie 4.3 trigger 1',
    }
  }

  // 2. Techniek. Onder de 4 telt de set niet mee als goede rep.
  if (set.formQuality < FORM_MIN) {
    const next = lighter(set.load, REDUCE_FORM)
    return {
      verdict: 'lichter',
      headline: `Techniek ${set.formQuality}/5. Techniekverlies betekent: set over.`,
      action: `Belasting 15% terug tot de beweging weer schoon is. ${loadText(next, loadType)}`,
      nextLoad: next,
      source: 'Sectie 4.2 stap 1',
    }
  }

  // 3. Te dicht bij falen. Tot falen gaan levert geen extra progressie op.
  if (set.rir < RIR_MIN) {
    const next = lighter(set.load, REDUCE_RIR)
    return {
      verdict: 'lichter',
      headline: `RIR ${set.rir}. Dat is te dicht bij falen.`,
      action: laatste
        ? `Deze oefening is klaar. Volgende sessie start je lichter: ${next === null ? 'een trede terug' : `${next} kg`}.`
        : `Iets lichter voor de volgende set. ${loadText(next, loadType)}`,
      nextLoad: next,
      source: 'Sectie 4.2 / 9.2 D',
    }
  }

  // 4. Vaste onderdelen klimmen niet mee.
  if (ctx.fixed) {
    return {
      verdict: 'goed',
      headline: 'Genoteerd.',
      action: 'Warming-up en cooldown blijven gelijk. Die horen niet zwaarder te worden.',
      nextLoad: null,
      source: 'Sectie 4.1',
    }
  }

  // 5. Deloadweek: de dosis is expres laag. Niet laten verleiden.
  if (ctx.isDeload) {
    return {
      verdict: 'goed',
      headline: 'Deloadweek, dit is precies de bedoeling.',
      action: 'Zelfde gewicht, halve dosis. Herstel is deze week het werk.',
      nextLoad: null,
      source: 'Sectie 9.2 C',
    }
  }

  // 6. Onder het voorgeschreven bereik, zonder dat je bij falen zat.
  if (set.reps < planned.repMin) {
    return {
      verdict: 'let-op',
      headline: `${set.reps} reps, onder je bereik van ${planned.repMin} tot ${planned.repMax}.`,
      action: `Je had nog ${set.rir} reps over, dus het gewicht is niet de rem. Ga voor minstens ${planned.repMin} bij de volgende set.`,
      nextLoad: null,
      source: 'Sectie 3.1',
    }
  }

  // 7. Bovenkant gehaald en het ging makkelijk. Verhogen gebeurt na de sessie.
  if (set.reps >= planned.repMax && set.rir > planned.targetRir) {
    return {
      verdict: 'let-op',
      headline: `${set.reps} reps met RIR ${set.rir}. Dit was te licht.`,
      action: `Deze sessie houd je het gewicht gelijk, anders telt de verhoging straks dubbel. Haal je dit op alle sets, dan gaat het gewicht na afloop omhoog.`,
      nextLoad: null,
      source: 'Sectie 3.1, The Rule',
    }
  }

  // 8. Op koers.
  const restant = planned.repMax - set.reps
  return {
    verdict: 'goed',
    headline: `${set.reps} reps, RIR ${set.rir}. Op koers.`,
    action: laatste
      ? 'Oefening klaar. De Regel bepaalt na de sessie wat er volgende keer verandert.'
      : restant > 0
        ? `Zelfde gewicht. Doel is ${planned.repMax} reps per set, dus ${restant} meer.`
        : 'Zelfde gewicht, zelfde uitvoering.',
    nextLoad: null,
    source: 'Sectie 3.1, The Rule',
  }
}

/**
 * Toon bij het oordeel. De namen zijn die van het ontwerpsysteem, zodat het
 * scherm ze rechtstreeks kan doorgeven en er geen tweede vertaaltabel ontstaat.
 */
export function verdictTone(v: SetVerdict): 'good' | 'warn' | 'serious' {
  if (v === 'stop') return 'serious'
  if (v === 'lichter' || v === 'let-op') return 'warn'
  return 'good'
}

export type { Pain }
