/**
 * Een ingesproken set omzetten naar velden.
 *
 * Tussen twee sets door is typen het grootste ongemak: je handen zijn bezweet,
 * je telefoon ligt op de bank en je wilt door. Inspreken lost dat op, maar
 * alleen als het begrijpen betrouwbaar is. Daarom staat het hier, los van het
 * scherm, en niet ergens in een component: zo is elke zin te testen.
 *
 * Uitgangspunt: liever niets invullen dan iets verkeerds. Een veld dat niet
 * eenduidig uit de zin volgt, blijft leeg. Een verkeerd ingevuld gewicht of een
 * gemiste pijnmelding is erger dan nog een keer inspreken.
 */

import type { Scale5, Pain } from './types.ts'

export interface SpokenSet {
  reps?: number
  load?: number
  rir?: number
  pain?: Pain
  formQuality?: Scale5
}

export interface SpeechResult {
  /** Wat er begrepen is. Leeg als er niets bruikbaars in zat. */
  velden: SpokenSet
  /** De zin na normalisatie, zodat het scherm kan tonen wat het hoorde. */
  gehoord: string
  /** Korte uitleg wanneer er niets begrepen is. */
  probleem?: string
}

const EENHEDEN: Record<string, number> = {
  nul: 0, een: 1, één: 1, twee: 2, drie: 3, vier: 4,
  vijf: 5, zes: 6, zeven: 7, acht: 8, negen: 9,
}

const TIENERS: Record<string, number> = {
  tien: 10, elf: 11, twaalf: 12, dertien: 13, veertien: 14,
  vijftien: 15, zestien: 16, zeventien: 17, achttien: 18, negentien: 19,
}

const TIENTALLEN: Record<string, number> = {
  twintig: 20, dertig: 30, veertig: 40, vijftig: 50,
  zestig: 60, zeventig: 70, tachtig: 80, negentig: 90,
}

/** Losse klinkertekens weghalen, zodat "tweeëntwintig" hetzelfde is als "tweeentwintig". */
function normaliseer(tekst: string): string {
  return tekst
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9,.\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Eén Nederlands telwoord naar een getal, of null. */
function woordNaarGetal(woord: string): number | null {
  if (woord in TIENERS) return TIENERS[woord]
  if (woord in TIENTALLEN) return TIENTALLEN[woord]
  if (woord in EENHEDEN) return EENHEDEN[woord]

  // "vijfentwintig", "tweeentwintig"
  const samen = /^([a-z]+)en([a-z]+)$/.exec(woord)
  if (samen) {
    const eenheid = EENHEDEN[samen[1]]
    const tiental = TIENTALLEN[samen[2]]
    if (eenheid !== undefined && tiental !== undefined) return tiental + eenheid
  }

  // "honderd", "honderdtien", "honderdvijfentwintig"
  if (woord === 'honderd') return 100
  if (woord.startsWith('honderd')) {
    const rest = woordNaarGetal(woord.slice('honderd'.length))
    if (rest !== null) return 100 + rest
  }
  return null
}

/**
 * Telwoorden vervangen door cijfers, zodat er daarna één soort tekst staat.
 * Spraakherkenning levert meestal al cijfers; dit vangt de rest op.
 */
function cijfers(tekst: string): string {
  const woorden = tekst.split(' ')
  const uit: string[] = []
  for (let i = 0; i < woorden.length; i++) {
    // "vijf en een half" en "twee en een halve"
    if (
      woorden[i + 1] === 'en' &&
      woorden[i + 2] === 'een' &&
      (woorden[i + 3] === 'half' || woorden[i + 3] === 'halve')
    ) {
      const basis = woordNaarGetal(woorden[i]) ?? Number(woorden[i])
      if (Number.isFinite(basis)) {
        uit.push(String(basis + 0.5))
        i += 3
        continue
      }
    }
    const getal = woordNaarGetal(woorden[i])
    uit.push(getal === null ? woorden[i] : String(getal))
  }
  return uit.join(' ')
}

/*
 * De richting verschilt per woord, en dat is geen detail. Een eenheid volgt op
 * het getal ("10 reps", "50 kilo"), een label gaat eraan vooraf ("rir 3",
 * "pijn 4"). Behandel je dat als één geval, dan leest "10 reps 50 kilo" als
 * vijftig reps, want vlak achter "reps" staat een 50.
 */

const GETAL = String.raw`(\d+(?:[.,]\d+)?)`

/** Getal direct vóór een eenheid: "50 kilo". */
function getalVoor(tekst: string, trefwoorden: string): number | null {
  const m = new RegExp(`${GETAL}\\s*(?:${trefwoorden})\\b`).exec(tekst)
  return m ? Number(m[1].replace(',', '.')) : null
}

/** Getal direct ná een label: "rir 3". */
function getalNa(tekst: string, trefwoorden: string): number | null {
  const m = new RegExp(`\\b(?:${trefwoorden})\\s*(?:van\\s*|is\\s*)?${GETAL}`).exec(tekst)
  return m ? Number(m[1].replace(',', '.')) : null
}

function begrens(n: number, min: number, max: number): number | null {
  if (!Number.isFinite(n)) return null
  return n >= min && n <= max ? n : null
}

export function parseSpokenSet(ruw: string): SpeechResult {
  const gehoord = normaliseer(ruw)
  if (!gehoord) return { velden: {}, gehoord: '', probleem: 'Niets verstaan.' }

  const tekst = cijfers(gehoord)
  const velden: SpokenSet = {}

  const reps = getalVoor(tekst, 'reps|rep|herhalingen|herhaling|keer|stuks')
  if (reps !== null) {
    const v = begrens(Math.round(reps), 1, 100)
    if (v !== null) velden.reps = v
  }

  const kg = getalVoor(tekst, 'kilo|kg|kilogram')
  if (kg !== null) {
    const v = begrens(kg, 0, 500)
    if (v !== null) velden.load = v
  }

  // "rir 3" en "nog twee in reserve" betekenen hetzelfde.
  const rir = getalNa(tekst, 'rir') ?? getalVoor(tekst, 'in reserve')
  if (rir !== null) {
    const v = begrens(Math.round(rir), 0, 10)
    if (v !== null) velden.rir = v
  }

  if (/\bgeen pijn\b|\bpijnvrij\b/.test(tekst)) {
    velden.pain = 0
  } else {
    const pijn = getalNa(tekst, 'pijn')
    if (pijn !== null) {
      const v = begrens(Math.round(pijn), 0, 10)
      if (v !== null) velden.pain = v as Pain
    }
  }

  const vorm = getalNa(tekst, 'techniek|vorm|uitvoering')
  if (vorm !== null) {
    const v = begrens(Math.round(vorm), 1, 5)
    if (v !== null) velden.formQuality = v as Scale5
  }

  // Kortste vorm zonder trefwoord: "tien keer vijftig" is al afgevangen, maar
  // "tien vijftig" niet. Dat blijft bewust ongeraden: het verschil tussen tien
  // reps van vijftig kilo en vijftig reps van tien kilo is te groot om te gokken.
  if (Object.keys(velden).length === 0) {
    return {
      velden,
      gehoord,
      probleem: 'Geen reps, kilo, RIR, pijn of techniek herkend.',
    }
  }

  return { velden, gehoord }
}
