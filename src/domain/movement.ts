/**
 * Bewegingskwaliteit (sectie 6.1, blok "movement quality") en de
 * techniekbeoordeling uit sectie 7.2.
 *
 * Sectie 7.2 beschrijft een AI die video analyseert. Die zit hier niet in, en
 * de app doet ook niet alsof. Wat er wel in zit is het bruikbare deel: een
 * vaste checklist per patroon, met dezelfde groen-geel-rood uitkomst en
 * dezelfde concrete correcties. De gebruiker filmt zichzelf en beoordeelt aan
 * de hand van de punten die een coach ook zou nalopen.
 */

import type { Grade, MovementAssessment } from './types'

export type { Grade, MovementAssessment }

export interface CheckItem {
  id: string
  /** Wat je precies bekijkt, in gewone taal. */
  question: string
  /** Wat je ziet als het misgaat. */
  fault: string
  /** De correctie, concreet genoeg om direct toe te passen. */
  correction: string
}

export interface MovementScreen {
  id: string
  name: string
  /** Hoe je de opname maakt. Zonder vaste hoek is vergelijken zinloos. */
  setup: string
  items: CheckItem[]
  /** Wat deze test begrenst in het programma. */
  consequence: string
}

export const MOVEMENT_SCREENS: MovementScreen[] = [
  {
    id: 'squat',
    name: 'Squatdiepte en knievolgen',
    setup: 'Film van opzij, camera op heuphoogte, drie meter afstand. Twee reps op je normale tempo.',
    consequence: 'Bepaalt de diepte die je programma voorschrijft en of de squatlader omhoog mag.',
    items: [
      {
        id: 'squat-depth',
        question: 'Kom je tot minstens bovenbeen horizontaal, zonder pijn?',
        fault: 'Je stopt hoger, of de diepte doet pijn.',
        correction: 'Blijf in het pijnvrije bereik en werk aan enkel- en heupmobiliteit. Diepte forceren levert niets op.',
      },
      {
        id: 'squat-back',
        question: 'Blijft je onderrug neutraal tot onderin?',
        fault: 'Het bekken kantelt onderin naar achteren, de rug rondt.',
        correction: 'Stop één centimeter boven het punt waar het kantelt. Dat punt schuift vanzelf omlaag.',
      },
      {
        id: 'squat-hips',
        question: 'Komen heup en schouders gelijk omhoog?',
        fault: 'De heup schiet eerst omhoog, daarna volgt de romp.',
        correction: 'Duw trager uit het diepste punt en houd de borst mee omhoog.',
      },
      {
        id: 'squat-knee',
        question: 'Volgen je knieën de richting van je tenen?',
        fault: 'De knieën vallen naar binnen bij het omhoogkomen.',
        correction: 'Duw de knieën actief naar buiten. Lukt dat niet, dan is de belasting te hoog.',
      },
    ],
  },
  {
    id: 'hinge',
    name: 'Heupscharnier',
    setup: 'Film van opzij. Twee reps romanian deadlift of goodmorning met licht gewicht.',
    consequence: 'Bepaalt hoe ver de hinge-lader mag oplopen en of RDL veilig is.',
    items: [
      {
        id: 'hinge-lead',
        question: 'Begint de beweging bij de heup en niet bij de rug?',
        fault: 'De rug buigt eerst, de heup gaat nauwelijks naar achteren.',
        correction: 'Oefen met een stok langs de rug: achterhoofd, bovenrug en staartbeen blijven contact houden.',
      },
      {
        id: 'hinge-neutral',
        question: 'Blijft de rug over het hele bereik neutraal?',
        fault: 'De onderrug rondt voordat je halverwege bent.',
        correction: 'Verklein het bereik tot waar het neutraal blijft. Dat is je huidige bereik, niet een tekortkoming.',
      },
      {
        id: 'hinge-end',
        question: 'Sluit je bovenin af met de bilspieren, zonder door te buigen?',
        fault: 'Je duwt de heup voorbij de lijn en holt de onderrug.',
        correction: 'Stop op de lijn schouder-heup-knie. Knijpen mag, doorbuigen niet.',
      },
    ],
  },
  {
    id: 'push',
    name: 'Push-up en drukpatroon',
    setup: 'Film schuin van voren, camera op borsthoogte. Drie reps.',
    consequence: 'Bepaalt op welke trede van de pushlader je start.',
    items: [
      {
        id: 'push-line',
        question: 'Blijft je lichaam één rechte lijn?',
        fault: 'De heup zakt door of steekt omhoog.',
        correction: 'Span de billen aan en trek de ribben omlaag. Kan dat niet, ga dan een trede terug.',
      },
      {
        id: 'push-depth',
        question: 'Kom je met de borst tot ongeveer vuisthoogte?',
        fault: 'Je komt nauwelijks halverwege.',
        correction: 'Kies een hogere incline waarop de volledige range wel lukt.',
      },
      {
        id: 'push-elbow',
        question: 'Blijven je ellebogen rond de 45 graden?',
        fault: 'De ellebogen waaieren naar 90 graden uit.',
        correction: 'Trek de ellebogen twintig graden naar binnen. Dat scheelt direct schouderbelasting.',
      },
      {
        id: 'push-scap',
        question: 'Blijven je schouderbladen stabiel op de ribbenkast?',
        fault: 'De schouderbladen steken uit bovenin.',
        correction: 'Duw actief weg aan het einde, zonder de bovenrug te ronden.',
      },
    ],
  },
  {
    id: 'row',
    name: 'Scapulacontrole bij trekken',
    setup: 'Film van opzij of schuin achter. Drie reps row met een gewicht dat je zeker aankunt.',
    consequence: 'Bepaalt of verticale trekprogressies verantwoord zijn.',
    items: [
      {
        id: 'row-order',
        question: 'Trek je eerst de schouder omlaag en pas daarna met de arm?',
        fault: 'De elleboog beweegt meteen, de schouder blijft hoog.',
        correction: 'Doe eerst vijf losse scapula-reps zonder armbuiging, dan pas de volledige beweging.',
      },
      {
        id: 'row-torso',
        question: 'Blijft je romp stil?',
        fault: 'Je gebruikt een rompzwaai om het gewicht op gang te krijgen.',
        correction: 'Belasting omlaag tot de romp stil kan blijven. Zwaai is geen kracht.',
      },
      {
        id: 'row-shrug',
        question: 'Blijven je schouders laag, weg van de oren?',
        fault: 'De schouders trekken omhoog bij elke rep.',
        correction: 'Adem uit bij de trek en houd de schouderbladen bewust omlaag.',
      },
    ],
  },
  {
    id: 'shoulder',
    name: 'Schouder en borstwervelkolom',
    setup: 'Zonder gewicht. Film van opzij terwijl je je armen recht boven het hoofd brengt.',
    consequence: 'Bepaalt of drukken boven het hoofd en handstandwerk in je programma kunnen.',
    items: [
      {
        id: 'shoulder-rom',
        question: 'Kom je met gestrekte armen langs je oren, zonder de rug te hollen?',
        fault: 'De armen blijven voor het hoofd, of de onderrug holt om het te compenseren.',
        correction: 'Beperk drukken boven het hoofd tot het bereik dat wel lukt en werk aan de borstwervelkolom.',
      },
      {
        id: 'shoulder-pain',
        question: 'Is het hele bereik pijnvrij?',
        fault: 'Er zit een pijnlijk punt in de beweging.',
        correction: 'Vermijd dat traject voorlopig. Blijft het na vier weken, laat het dan beoordelen.',
      },
    ],
  },
  {
    id: 'ankle',
    name: 'Enkel en voet',
    setup: 'Knie-naar-muur test. Voet recht voor de muur, knie over de tenen naar de muur.',
    consequence: 'Bepaalt squatdiepte en stabiliteit bij eenbenig werk.',
    items: [
      {
        id: 'ankle-rom',
        question: 'Raakt je knie de muur met de hak op de grond, vanaf ongeveer tien centimeter afstand?',
        fault: 'De hak komt los voordat de knie de muur raakt.',
        correction: 'Voeg enkelmobiliteit toe aan je warming-up en houd de squatdiepte voorlopig lager.',
      },
      {
        id: 'ankle-balance',
        question: 'Kun je tien seconden op één been staan zonder te wankelen?',
        fault: 'Je moet steeds corrigeren of neerzetten.',
        correction: 'Bouw eenbenig werk rustiger op en houd de carry-oefeningen erin.',
      },
    ],
  },
]

export interface ScreenResult {
  screen: MovementScreen
  grade: Grade
  /** Punten die aandacht vragen, met hun correctie. */
  issues: Array<{ item: CheckItem; grade: Grade }>
  graded: number
}

/** Eén rood punt maakt het hele patroon rood. Zwakste schakel telt. */
export function gradeScreen(screen: MovementScreen, grades: Record<string, Grade>): ScreenResult {
  const scored = screen.items.map((item) => ({ item, grade: grades[item.id] }))
  const graded = scored.filter((s) => s.grade !== undefined)
  const issues = graded.filter((s) => s.grade !== 'groen') as Array<{ item: CheckItem; grade: Grade }>

  let grade: Grade = 'groen'
  if (graded.length === 0) grade = 'geel'
  else if (issues.some((i) => i.grade === 'rood')) grade = 'rood'
  else if (issues.length > 0) grade = 'geel'

  return { screen, grade, issues, graded: graded.length }
}

export function gradeAll(assessment: MovementAssessment | null): ScreenResult[] {
  return MOVEMENT_SCREENS.map((screen) => gradeScreen(screen, assessment?.grades ?? {}))
}

export interface MovementSummary {
  results: ScreenResult[]
  /** Aantal patronen dat volledig beoordeeld is. */
  completed: number
  /** Aantal losse punten dat een score heeft. */
  gradedItems: number
  total: number
  worst: Grade
  /** Het advies dat uit de beoordeling volgt, in de toon van de app. */
  verdict: string
  /** Concrete beperkingen die hieruit volgen voor het programma. */
  limits: string[]
}

export function summarise(assessment: MovementAssessment | null): MovementSummary {
  const results = gradeAll(assessment)
  const completed = results.filter((r) => r.graded === r.screen.items.length).length
  const gradedItems = results.reduce((total, r) => total + r.graded, 0)
  const reds = results.filter((r) => r.grade === 'rood')
  const yellows = results.filter((r) => r.grade === 'geel' && r.graded > 0)

  let worst: Grade = 'groen'
  if (reds.length > 0) worst = 'rood'
  else if (yellows.length > 0) worst = 'geel'

  // Het oordeel volgt de beoordeelde punten, niet de volledig afgeronde
  // patronen: anders staat er "nog niet beoordeeld" naast een rode score.
  let verdict: string
  if (gradedItems === 0) {
    verdict = 'Nog niet beoordeeld. Zonder nulmeting weet de app niet welk bereik voor jou normaal is.'
  } else if (reds.length > 0) {
    verdict = `${reds.length} ${reds.length === 1 ? 'patroon vraagt' : 'patronen vragen'} aandacht voordat de belasting omhoog kan. Dat is geen afkeuring, dat is de startlijn.`
  } else if (yellows.length > 0) {
    verdict = 'Bruikbaar met aandachtspunten. Werk aan de genoemde correcties terwijl je gewoon traint.'
  } else if (completed < results.length) {
    verdict = `${completed} van ${results.length} patronen volledig beoordeeld, en wat er staat is in orde. Maak de rest af voor een compleet beeld.`
  } else {
    verdict = 'Alle patronen staan. De lader mag omhoog zodra The Rule dat aangeeft.'
  }

  const limits = reds.map((r) => `${r.screen.name}: ${r.screen.consequence}`)

  return { results, completed, gradedItems, total: results.length, worst, verdict, limits }
}
