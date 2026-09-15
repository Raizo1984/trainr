/**
 * Wat iemand aan de deur heeft gekozen.
 *
 * Twee dingen onthouden we, en allebei moeten ze een herstart overleven:
 * of iemand bewust zonder account verder wilde, en of we het na de intake nog
 * een keer gevraagd hebben. Zonder dat krijg je bij elke keer openen dezelfde
 * vraag, en dan leert iemand hem wegklikken zonder te lezen.
 */

const SLEUTEL = 'trainr-onboarding-v1'

interface Keuzes {
  /** Heeft bewust gekozen om zonder account te werken. */
  zonderAccount: boolean
  /** Na het afronden van de intake is er nog een keer gevraagd. */
  naIntakeGevraagd: boolean
}

const LEEG: Keuzes = { zonderAccount: false, naIntakeGevraagd: false }

export function leesKeuzes(): Keuzes {
  try {
    const ruw = localStorage.getItem(SLEUTEL)
    if (!ruw) return LEEG
    const data = JSON.parse(ruw) as Partial<Keuzes>
    return {
      zonderAccount: data.zonderAccount === true,
      naIntakeGevraagd: data.naIntakeGevraagd === true,
    }
  } catch {
    return LEEG
  }
}

export function zetKeuze(patch: Partial<Keuzes>): void {
  try {
    localStorage.setItem(SLEUTEL, JSON.stringify({ ...leesKeuzes(), ...patch }))
  } catch {
    // Geen opslag beschikbaar. Dan vraagt de app het opnieuw, wat vervelend is
    // maar niet erger dan dat.
  }
}

/** Na het aanmaken of verwijderen van een account is de keuze niet meer relevant. */
export function vergeetKeuzes(): void {
  try {
    localStorage.removeItem(SLEUTEL)
  } catch {
    // niets te doen
  }
}
