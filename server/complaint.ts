/**
 * Een klacht in eigen woorden duiden.
 *
 * Het model doet hier één ding: taal begrijpen. Het zet "mijn knie voelt raar
 * vanaf rep zes" om in een lichaamsgebied en de oefeningen waar dat over gaat.
 * Wat er vervolgens met het programma gebeurt, beslist de app zelf met de
 * veiligheidsregels die er al staan.
 *
 * Die scheiding is opzettelijk. Een taalmodel dat mag besluiten hoeveel
 * belasting eraf gaat, geeft bij dezelfde klacht op dinsdag een ander antwoord
 * dan op donderdag. Voor een app die letsel moet helpen voorkomen is dat geen
 * acceptabele eigenschap.
 */

import type OpenAI from 'openai'

export const COMPLAINT_TOOL_NAME = 'duid_klacht'

export const BODY_REGIONS = [
  'nek',
  'schouder-links',
  'schouder-rechts',
  'elleboog-links',
  'elleboog-rechts',
  'pols-hand',
  'bovenrug',
  'onderrug',
  'heup',
  'knie-links',
  'knie-rechts',
  'enkel-voet',
  'hamstring',
  'kuit',
] as const

export type BodyRegion = (typeof BODY_REGIONS)[number]

export const COMPLAINT_SYSTEM = `Je duidt één klacht van een sporter.

Je doet precies twee dingen:
1. Bepaal welk lichaamsgebied het is, uit de vaste lijst.
2. Bepaal welke van de meegestuurde oefeningen dat gebied belasten.

Wat je NIET doet:
- Geen diagnose stellen. Je bent geen arts en de app is dat ook niet.
- Niet zeggen wat er met het programma moet gebeuren. Dat rekent de app zelf uit.
- Geen oefeningen verzinnen. Gebruik alleen de meegestuurde id's.
- Niet geruststellen en niet dramatiseren.

Noemt iemand links of rechts niet, kies dan de kant die het meest voor de hand
ligt of laat de zijde weg door het gebied te kiezen dat geen kant heeft. Twijfel
je over het gebied, kies dan niets: liever geen duiding dan de verkeerde.

Een pijncijfer geef je alleen als de sporter er zelf een noemt of duidelijk
beschrijft. Verzin geen getal.`

export const COMPLAINT_TOOL: OpenAI.Chat.Completions.ChatCompletionFunctionTool = {
  type: 'function',
  function: {
    name: COMPLAINT_TOOL_NAME,
    description:
      'Leg vast welk lichaamsgebied de klacht betreft en welke van de meegestuurde oefeningen dat gebied belasten. Stel geen behandeling of programmawijziging voor.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        region: {
          type: 'string',
          enum: [...BODY_REGIONS],
          description: 'Het lichaamsgebied, exact uit deze lijst.',
        },
        ladderIds: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Id\'s van de meegestuurde oefeningen die dit gebied belasten, exact zoals meegestuurd. Leeg als geen enkele oefening erop slaat.',
        },
        painLevel: {
          type: 'number',
          description: 'Pijn van 0 tot 10, alleen als de sporter dat zelf aangeeft.',
        },
        summary: {
          type: 'string',
          description:
            'De klacht in één zin, in de woorden van de app. Feitelijk, zonder oordeel of geruststelling.',
        },
      },
      required: ['region', 'ladderIds', 'summary'],
    },
  },
}

export interface ComplaintReading {
  region: BodyRegion
  ladderIds: string[]
  painLevel?: number
  summary: string
}

/**
 * Het antwoord van het model nalezen voordat het de app in gaat.
 *
 * Alles wat niet klopt wordt geweigerd in plaats van gerepareerd. Een verzonnen
 * oefening-id of een gebied dat niet bestaat is geen klein foutje: dat zou tot
 * een aanpassing leiden op iets wat de sporter helemaal niet traint.
 */
export function parseComplaintArguments(
  raw: string,
  toegestaneLadders: string[],
): { ok: true; waarde: ComplaintReading } | { ok: false; fout: string } {
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return { ok: false, fout: 'Het model gaf geen leesbare JSON terug.' }
  }
  if (typeof data !== 'object' || data === null) {
    return { ok: false, fout: 'Het model gaf geen object terug.' }
  }
  const o = data as Record<string, unknown>

  if (typeof o.region !== 'string' || !(BODY_REGIONS as readonly string[]).includes(o.region)) {
    return { ok: false, fout: 'Onbekend lichaamsgebied.' }
  }
  if (typeof o.summary !== 'string' || o.summary.trim() === '') {
    return { ok: false, fout: 'Geen samenvatting van de klacht.' }
  }
  if (!Array.isArray(o.ladderIds)) {
    return { ok: false, fout: 'De lijst met oefeningen ontbreekt.' }
  }

  const ids: string[] = []
  for (const id of o.ladderIds) {
    if (typeof id !== 'string') return { ok: false, fout: 'Een oefening-id is geen tekst.' }
    if (!toegestaneLadders.includes(id)) {
      return { ok: false, fout: `Onbekende oefening: ${id}.` }
    }
    if (!ids.includes(id)) ids.push(id)
  }

  const uit: ComplaintReading = {
    region: o.region as BodyRegion,
    ladderIds: ids,
    summary: o.summary.trim(),
  }

  if (o.painLevel !== undefined) {
    if (typeof o.painLevel !== 'number' || !Number.isFinite(o.painLevel)) {
      return { ok: false, fout: 'Het pijncijfer is geen getal.' }
    }
    const n = Math.round(o.painLevel)
    if (n < 0 || n > 10) return { ok: false, fout: 'Het pijncijfer valt buiten 0 tot 10.' }
    uit.painLevel = n
  }

  return { ok: true, waarde: uit }
}
