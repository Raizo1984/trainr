/**
 * Eigen oefeningtekeningen.
 *
 * De beeldbank van wger bleek geen begaanbare weg: de licentie verschilt per
 * oefening, de koppeling naam-naar-beeld moet een mens nakijken, en het
 * ophalen hangt af van een server buiten ons bereik. Alles bij elkaar drie
 * afhankelijkheden voor iets wat een beginner alleen maar hoeft te zien.
 *
 * Deze tekeningen zijn van onszelf. Ze staan in de bundel, werken offline,
 * hebben geen bronvermelding nodig en veranderen niet als iemand anders zijn
 * database opschoont.
 *
 * Ze zijn met opzet schematisch. Een poppetje van lijnen laat de richting van
 * de beweging zien, en meer moet het niet beloven: de techniek staat in de
 * regel en de cue ernaast, en die zijn nagekeken. Een gedetailleerde tekening
 * zou suggereren dat je hem tot op de graad kunt naspelen.
 *
 * Aanzicht: van opzij, met het gezicht naar rechts. De grond ligt op y=90 in
 * een vak van 100 bij 100. Eén arm en één been, want het is een zijaanzicht.
 */

import type { MovementPattern } from './types.ts'

export interface Houding {
  hoofd: [number, number]
  nek: [number, number]
  heup: [number, number]
  knie: [number, number]
  voet: [number, number]
  elleboog: [number, number]
  hand: [number, number]
}

export interface Tekening {
  /** Eén of twee standen. Twee betekent: van links naar rechts bewegen. */
  standen: Array<{ label: string; houding: Houding }>
  /** Wat je in deze beweging moet voelen of bewaken. */
  let_op: string
}

const TEKENINGEN: Partial<Record<MovementPattern, Tekening>> = {
  squat: {
    let_op: 'Knieën volgen je tenen, borst blijft omhoog.',
    standen: [
      {
        label: 'Start',
        houding: {
          hoofd: [50, 23], nek: [50, 30], heup: [50, 52], knie: [50, 70], voet: [50, 90],
          elleboog: [58, 43], hand: [53, 35],
        },
      },
      {
        label: 'Diepste punt',
        houding: {
          hoofd: [49, 36], nek: [48, 43], heup: [42, 64], knie: [59, 69], voet: [50, 90],
          elleboog: [54, 51], hand: [49, 45],
        },
      },
    ],
  },

  hinge: {
    let_op: 'De beweging komt uit je heupen, je rug blijft recht.',
    standen: [
      {
        label: 'Start',
        houding: {
          hoofd: [50, 23], nek: [50, 30], heup: [50, 52], knie: [50, 70], voet: [50, 90],
          elleboog: [55, 42], hand: [57, 59],
        },
      },
      {
        label: 'Heupen naar achteren',
        houding: {
          hoofd: [68, 44], nek: [62, 48], heup: [42, 58], knie: [53, 71], voet: [50, 90],
          elleboog: [62, 59], hand: [60, 73],
        },
      },
    ],
  },

  'horizontale-push': {
    let_op: 'Duw recht vooruit. Je schouderbladen blijven laag en breed.',
    standen: [
      {
        label: 'Bij je borst',
        houding: {
          hoofd: [50, 23], nek: [50, 30], heup: [50, 52], knie: [51, 70], voet: [50, 90],
          elleboog: [42, 39], hand: [58, 37],
        },
      },
      {
        label: 'Gestrekt vooruit',
        houding: {
          hoofd: [50, 23], nek: [50, 30], heup: [50, 52], knie: [51, 70], voet: [50, 90],
          elleboog: [63, 34], hand: [77, 33],
        },
      },
    ],
  },

  'verticale-push': {
    let_op: 'Ribben omlaag, duw recht omhoog langs je hoofd.',
    standen: [
      {
        label: 'Bij je schouders',
        houding: {
          hoofd: [46, 25], nek: [50, 32], heup: [50, 54], knie: [50, 71], voet: [50, 90],
          elleboog: [60, 42], hand: [56, 31],
        },
      },
      {
        label: 'Boven je hoofd',
        houding: {
          hoofd: [46, 25], nek: [50, 32], heup: [50, 54], knie: [50, 71], voet: [50, 90],
          elleboog: [58, 24], hand: [56, 10],
        },
      },
    ],
  },

  'horizontale-pull': {
    let_op: 'Trek met je ellebogen langs je lijf, niet met je handen.',
    standen: [
      {
        label: 'Armen gestrekt',
        houding: {
          hoofd: [68, 44], nek: [62, 48], heup: [42, 58], knie: [53, 71], voet: [50, 90],
          elleboog: [64, 61], hand: [66, 75],
        },
      },
      {
        label: 'Bij je romp',
        houding: {
          hoofd: [68, 44], nek: [62, 48], heup: [42, 58], knie: [53, 71], voet: [50, 90],
          elleboog: [44, 55], hand: [58, 61],
        },
      },
    ],
  },

  'verticale-pull': {
    let_op: 'Schouders eerst omlaag, dan pas trekken.',
    standen: [
      {
        label: 'Hangend',
        houding: {
          hoofd: [52, 33], nek: [48, 38], heup: [46, 60], knie: [46, 77], voet: [46, 92],
          elleboog: [53, 24], hand: [56, 10],
        },
      },
      {
        label: 'Kin bij de stang',
        houding: {
          hoofd: [49, 17], nek: [45, 26], heup: [44, 48], knie: [44, 66], voet: [44, 81],
          elleboog: [58, 21], hand: [56, 10],
        },
      },
    ],
  },

  'carry-core': {
    let_op: 'Er beweegt niets. Dat is precies de oefening.',
    standen: [
      {
        label: 'Vasthouden',
        houding: {
          hoofd: [50, 23], nek: [50, 30], heup: [50, 52], knie: [50, 70], voet: [50, 90],
          elleboog: [55, 43], hand: [57, 60],
        },
      },
    ],
  },
}

/**
 * De tekening bij een bewegingspatroon, of null.
 *
 * Isolatie, skill en conditie krijgen er met opzet geen. Daar zit te veel
 * verschillends onder om met één poppetje te vangen, en een tekening die niet
 * klopt is erger dan geen tekening.
 */
export function tekeningVoor(pattern: MovementPattern): Tekening | null {
  return TEKENINGEN[pattern] ?? null
}
