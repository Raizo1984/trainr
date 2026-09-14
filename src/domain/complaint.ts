/**
 * Wat er met het programma gebeurt als je een klacht meldt.
 *
 * De taal is elders begrepen: een klacht komt hier binnen als een gebied, een
 * lijst oefeningen en eventueel een pijncijfer. Wat daaruit volgt, staat hier,
 * en het volgt dezelfde drempels als De Regel. Hetzelfde verhaal geeft dus
 * altijd hetzelfde gevolg, ook als het model morgen anders formuleert.
 *
 * Het resultaat is een vóórstel, geen wijziging. Het gaat daarna door dezelfde
 * veiligheidspoort als alle andere voorstellen en wacht op jouw akkoord.
 */

import { PAIN_STOP } from './rule.ts'
import { getLadder, regressStep } from './exercises.ts'
import type { BodyRegion, IsoDate, PlanAdjustment, SafetySettings } from './types.ts'

export interface ComplaintReading {
  region: BodyRegion
  ladderIds: string[]
  painLevel?: number
  summary: string
}

export interface ComplaintContext {
  reading: ComplaintReading
  safety: SafetySettings
  /** Huidige trede per lader, zodat een stap terug de juiste kant op gaat. */
  stepByLadder: Record<string, string | undefined>
  today: IsoDate
}

export interface ComplaintOutcome {
  /** Voorstellen die de gebruiker kan accepteren. Kan leeg zijn. */
  proposals: PlanAdjustment[]
  /** Wat de app met de melding doet, in gewone taal. */
  uitleg: string
}

let teller = 0
function id(prefix: string): string {
  teller += 1
  return `${prefix}-${Date.now().toString(36)}-${teller}`
}

function naam(ladderId: string): string {
  try {
    return getLadder(ladderId).name
  } catch {
    return ladderId
  }
}

export function outcomeForComplaint(ctx: ComplaintContext): ComplaintOutcome {
  const { reading, safety, today } = ctx
  const pijn = reading.painLevel
  const raakt = reading.ladderIds

  if (raakt.length === 0) {
    return {
      proposals: [],
      uitleg:
        'Geen van je huidige oefeningen belast dit gebied. De klacht is genoteerd, maar er verandert niets aan je programma.',
    }
  }

  // Geen cijfer betekent niet automatisch mild. Het betekent: onbekend, en
  // daar hoort geen ingreep bij maar een vraag.
  if (pijn === undefined) {
    return {
      proposals: [],
      uitleg: `Genoteerd bij ${raakt.map(naam).join(', ')}. Vul de pijn bij je set in van 0 tot 10; pas dan weet de app of er iets moet veranderen.`,
    }
  }

  if (pijn >= PAIN_STOP) {
    return {
      proposals: raakt.map((ladderId) => ({
        id: id('klacht-pauze'),
        kind: 'oefening-pauzeren' as const,
        ladderId,
        reason: `${reading.summary} Pijn ${pijn} van 10 op ${naam(ladderId)}. Pauzeren tot de klacht zakt, daarna opnieuw opbouwen vanaf een lagere trede.`,
        source: 'coach' as const,
        createdAt: today,
        expiresAfterWeeks: 2,
        accepted: false,
      })),
      uitleg: `Pijn ${pijn} van 10 is boven de grens waarop je doortraint. Voorstel: ${raakt.length === 1 ? 'deze oefening' : 'deze oefeningen'} pauzeren.`,
    }
  }

  if (pijn >= safety.painCeiling) {
    const proposals: PlanAdjustment[] = []
    for (const ladderId of raakt) {
      const huidig = ctx.stepByLadder[ladderId]
      const lager = huidig ? regressStep(ladderId, huidig) : null
      proposals.push({
        id: id(lager ? 'klacht-trede' : 'klacht-pauze'),
        kind: lager ? ('trede-omlaag' as const) : ('oefening-pauzeren' as const),
        ladderId,
        reason: lager
          ? `${reading.summary} Pijn ${pijn} van 10 zit op je grens van ${safety.painCeiling}. Terug naar ${lager.name} en de 24-uursreactie volgen.`
          : `${reading.summary} Pijn ${pijn} van 10 zit op je grens van ${safety.painCeiling}, en lager dan dit kan deze oefening niet. Pauzeren.`,
        source: 'coach' as const,
        createdAt: today,
        expiresAfterWeeks: 3,
        accepted: false,
      })
    }
    return {
      proposals,
      uitleg: `Pijn ${pijn} van 10 zit op of boven je grens van ${safety.painCeiling}. Voorstel: een trede terug waar dat kan.`,
    }
  }

  return {
    proposals: [],
    uitleg: `Pijn ${pijn} van 10 blijft onder je grens van ${safety.painCeiling}. Genoteerd bij ${raakt.map(naam).join(', ')}; het programma blijft zoals het is. Loopt het op, meld het dan opnieuw.`,
  }
}
